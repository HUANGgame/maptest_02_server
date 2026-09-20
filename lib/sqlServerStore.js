const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const DOCUMENT_FILES = [
  "catalog_records.json",
  "route_graph_records.json",
  "route_edge_overrides.json",
  "model_versions.json",
  "model_training_jobs.json",
  "navigation_feedback.json",
  "navigation_history.json",
  "saved_locations.json",
  "navigation_policy_logs.json",
  "strategy_training_runs.json",
  "user_reports.json",
  "place_overrides.json",
  "wifi_ap_calibrations.json",
];

let sql = null;
let pool = null;
let enabled = false;
const fingerprintProfileCache = new Map();
const fingerprintProfileCacheTtlMs = Math.max(5000, Number(process.env.AZURE_SQL_PROFILE_CACHE_TTL_MS || 60000));

function isConfigured() {
  return Boolean(process.env.AZURE_SQL_SERVER && process.env.AZURE_SQL_DATABASE);
}

function isEnabled() {
  return enabled;
}

async function closeStore() {
  enabled = false;
  fingerprintProfileCache.clear();
  if (!pool) return;
  const activePool = pool;
  pool = null;
  await activePool.close();
}

async function startStore() {
  if (!isConfigured()) return false;
  sql = require("mssql");
  pool = await sql.connect({
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    port: Number(process.env.AZURE_SQL_PORT || 1433),
    user: process.env.AZURE_SQL_USER || undefined,
    password: process.env.AZURE_SQL_PASSWORD || undefined,
    authentication: process.env.AZURE_SQL_AUTHENTICATION_TYPE
      ? { type: process.env.AZURE_SQL_AUTHENTICATION_TYPE }
      : undefined,
    options: {
      encrypt: process.env.AZURE_SQL_ENCRYPT !== "false",
      trustServerCertificate: process.env.AZURE_SQL_TRUST_SERVER_CERTIFICATE === "true",
      enableArithAbort: true,
    },
    pool: {
      max: Number(process.env.AZURE_SQL_POOL_LIMIT || 5),
      min: 0,
      idleTimeoutMillis: 30000,
    },
  });
  await ensureSchema();
  enabled = true;
  const scanCount = await scalar("SELECT COUNT_BIG(*) AS value FROM dbo.wifi_scan_records");
  const documentCount = await scalar("SELECT COUNT_BIG(*) AS value FROM dbo.system_documents");
  if (scanCount === 0 && documentCount === 0) {
    await seedFromLocalCache();
  } else if (process.env.AZURE_SQL_SKIP_CACHE_HYDRATE !== "true") {
    await hydrateLocalCache();
  }
  return true;
}

async function ensureSchema() {
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.system_documents', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.system_documents (
        document_name NVARCHAR(160) NOT NULL PRIMARY KEY,
        body NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF OBJECT_ID(N'dbo.wifi_scan_records', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.wifi_scan_records (
        record_key CHAR(64) NOT NULL PRIMARY KEY,
        source_id BIGINT NULL,
        sample_id NVARCHAR(100) NULL,
        point_id NVARCHAR(100) NOT NULL,
        map_id NVARCHAR(100) NOT NULL,
        floor_id NVARCHAR(100) NOT NULL,
        x FLOAT NOT NULL,
        y FLOAT NOT NULL,
        heading FLOAT NULL,
        ssid NVARCHAR(256) NULL,
        bssid NVARCHAR(64) NOT NULL,
        rssi INT NOT NULL,
        device_info NVARCHAR(320) NULL,
        source_mode NVARCHAR(80) NULL,
        data_priority NVARCHAR(40) NULL,
        session_id NVARCHAR(100) NULL,
        scan_freshness NVARCHAR(80) NULL,
        scanned_at DATETIME2(3) NULL,
        uploaded_at DATETIME2(3) NULL,
        created_at DATETIME2(3) NULL
      );
      CREATE INDEX ix_wifi_scope ON dbo.wifi_scan_records(map_id, floor_id);
      CREATE INDEX ix_wifi_point ON dbo.wifi_scan_records(map_id, floor_id, point_id);
      CREATE INDEX ix_wifi_bssid ON dbo.wifi_scan_records(map_id, floor_id, bssid);
      CREATE INDEX ix_wifi_scanned_at ON dbo.wifi_scan_records(scanned_at);
    END;
  `);
}

async function seedFromLocalCache() {
  await mirrorJsonFiles(DOCUMENT_FILES);
  await mirrorWifiScans(readJson("wifi_scans.json", []));
}

async function hydrateLocalCache() {
  fs.mkdirSync(dataDir, { recursive: true });
  const documents = await pool.request().query("SELECT document_name, body FROM dbo.system_documents");
  for (const row of documents.recordset) {
    if (!DOCUMENT_FILES.includes(row.document_name)) continue;
    fs.writeFileSync(path.join(dataDir, row.document_name), row.body, "utf8");
  }
  const records = await readWifiScansByScope("", "");
  if (records.length > 0) {
    fs.writeFileSync(path.join(dataDir, "wifi_scans.json"), JSON.stringify(records, null, 2), "utf8");
  }
}

async function mirrorJsonFiles(fileNames = DOCUMENT_FILES) {
  if (!enabled && !pool) return false;
  for (const fileName of fileNames) {
    if (!DOCUMENT_FILES.includes(fileName)) continue;
    const filePath = path.join(dataDir, fileName);
    if (!fs.existsSync(filePath)) continue;
    const body = fs.readFileSync(filePath, "utf8");
    await pool.request()
      .input("name", sql.NVarChar(160), fileName)
      .input("body", sql.NVarChar(sql.MAX), body)
      .query(`
        MERGE dbo.system_documents AS target
        USING (SELECT @name AS document_name, @body AS body) AS source
          ON target.document_name = source.document_name
        WHEN MATCHED THEN UPDATE SET body = source.body, updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (document_name, body) VALUES (source.document_name, source.body);
      `);
  }
  return true;
}

async function missingDocumentNames(fileNames = DOCUMENT_FILES) {
  if (!enabled && !pool) return [];
  const requested = fileNames.filter((fileName) => DOCUMENT_FILES.includes(fileName));
  if (requested.length === 0) return [];
  const result = await pool.request().query("SELECT document_name FROM dbo.system_documents");
  const stored = new Set(result.recordset.map((row) => row.document_name));
  return requested.filter((fileName) => !stored.has(fileName));
}

async function mirrorDocumentValues(documents) {
  if ((!enabled && !pool) || !documents || typeof documents !== "object") return false;
  fs.mkdirSync(dataDir, { recursive: true });
  for (const [fileName, value] of Object.entries(documents)) {
    if (!DOCUMENT_FILES.includes(fileName) || value === undefined) continue;
    const body = JSON.stringify(value, null, 2);
    fs.writeFileSync(path.join(dataDir, fileName), body, "utf8");
    await pool.request()
      .input("name", sql.NVarChar(160), fileName)
      .input("body", sql.NVarChar(sql.MAX), body)
      .query(`
        MERGE dbo.system_documents AS target
        USING (SELECT @name AS document_name, @body AS body) AS source
          ON target.document_name = source.document_name
        WHEN MATCHED THEN UPDATE SET body = source.body, updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (document_name, body) VALUES (source.document_name, source.body);
      `);
  }
  return true;
}

async function mirrorAdminData() {
  return mirrorJsonFiles(DOCUMENT_FILES);
}

async function mirrorModels() {
  return mirrorJsonFiles(["model_versions.json", "model_training_jobs.json"]);
}

async function mirrorWifiScans(records) {
  if ((!enabled && !pool) || !Array.isArray(records) || records.length === 0) return false;
  const batchSize = Math.max(1, Math.min(Number(process.env.AZURE_SQL_BATCH_SIZE || 75), 90));
  const concurrency = Math.max(1, Math.min(Number(process.env.AZURE_SQL_WRITE_CONCURRENCY || 3), 5));
  const batches = [];
  for (let index = 0; index < records.length; index += batchSize) {
    batches.push(records.slice(index, index + batchSize));
  }
  for (let index = 0; index < batches.length; index += concurrency) {
    await Promise.all(batches.slice(index, index + concurrency).map(upsertWifiScanBatch));
  }
  for (const record of records) {
    invalidateFingerprintProfileCache(record.mapId, record.floorId);
  }
  return true;
}

async function upsertWifiScanBatch(records) {
  if (records.length === 1) return upsertWifiScan(records[0]);
  const request = pool.request();
  const rows = records.map((record, index) => {
    const suffix = String(index);
    addScanInputs(request, record, suffix);
    return `(@recordKey${suffix}, @sourceId${suffix}, @sampleId${suffix}, @pointId${suffix},
      @mapId${suffix}, @floorId${suffix}, @x${suffix}, @y${suffix}, @heading${suffix},
      @ssid${suffix}, @bssid${suffix}, @rssi${suffix}, @deviceInfo${suffix}, @sourceMode${suffix},
      @dataPriority${suffix}, @sessionId${suffix}, @scanFreshness${suffix}, @scannedAt${suffix},
      @uploadedAt${suffix}, @createdAt${suffix})`;
  });

  await request.query(`
    MERGE dbo.wifi_scan_records AS target
    USING (VALUES ${rows.join(",\n")}) AS source
      (record_key, source_id, sample_id, point_id, map_id, floor_id, x, y, heading, ssid, bssid, rssi,
       device_info, source_mode, data_priority, session_id, scan_freshness, scanned_at, uploaded_at, created_at)
      ON target.record_key = source.record_key
    WHEN MATCHED THEN UPDATE SET
      rssi=source.rssi, uploaded_at=source.uploaded_at, data_priority=source.data_priority
    WHEN NOT MATCHED THEN INSERT
      (record_key, source_id, sample_id, point_id, map_id, floor_id, x, y, heading, ssid, bssid, rssi,
       device_info, source_mode, data_priority, session_id, scan_freshness, scanned_at, uploaded_at, created_at)
      VALUES
      (source.record_key, source.source_id, source.sample_id, source.point_id, source.map_id, source.floor_id,
       source.x, source.y, source.heading, source.ssid, source.bssid, source.rssi, source.device_info,
       source.source_mode, source.data_priority, source.session_id, source.scan_freshness, source.scanned_at,
       source.uploaded_at, source.created_at);
  `);
}

async function upsertWifiScan(record) {
    const request = pool.request();
    addScanInputs(request, record, "");
    await request.query(`
      MERGE dbo.wifi_scan_records AS target
      USING (SELECT @recordKey AS record_key) AS source ON target.record_key = source.record_key
      WHEN MATCHED THEN UPDATE SET rssi=@rssi, uploaded_at=@uploadedAt, data_priority=@dataPriority
      WHEN NOT MATCHED THEN INSERT
        (record_key, source_id, sample_id, point_id, map_id, floor_id, x, y, heading, ssid, bssid, rssi,
         device_info, source_mode, data_priority, session_id, scan_freshness, scanned_at, uploaded_at, created_at)
        VALUES
        (@recordKey, @sourceId, @sampleId, @pointId, @mapId, @floorId, @x, @y, @heading, @ssid, @bssid,
         @rssi, @deviceInfo, @sourceMode, @dataPriority, @sessionId, @scanFreshness, @scannedAt, @uploadedAt, @createdAt);
    `);
}

function addScanInputs(request, record, suffix) {
  request.input(`recordKey${suffix}`, sql.Char(64), scanIdentityKey(record));
  request.input(`sourceId${suffix}`, sql.BigInt, finiteOrNull(record.id));
  request.input(`sampleId${suffix}`, sql.NVarChar(100), textOrNull(record.sampleId));
  request.input(`pointId${suffix}`, sql.NVarChar(100), String(record.pointId || ""));
  request.input(`mapId${suffix}`, sql.NVarChar(100), String(record.mapId || ""));
  request.input(`floorId${suffix}`, sql.NVarChar(100), String(record.floorId || ""));
  request.input(`x${suffix}`, sql.Float, Number(record.x));
  request.input(`y${suffix}`, sql.Float, Number(record.y));
  request.input(`heading${suffix}`, sql.Float, finiteOrNull(record.heading));
  request.input(`ssid${suffix}`, sql.NVarChar(256), textOrNull(record.ssid));
  request.input(`bssid${suffix}`, sql.NVarChar(64), String(record.bssid || "").toLowerCase());
  request.input(`rssi${suffix}`, sql.Int, Number(record.rssi));
  request.input(`deviceInfo${suffix}`, sql.NVarChar(320), textOrNull(record.deviceInfo));
  request.input(`sourceMode${suffix}`, sql.NVarChar(80), textOrNull(record.sourceMode || record.source));
  request.input(`dataPriority${suffix}`, sql.NVarChar(40), textOrNull(record.dataPriority));
  request.input(`sessionId${suffix}`, sql.NVarChar(100), textOrNull(record.sessionId));
  request.input(`scanFreshness${suffix}`, sql.NVarChar(80), textOrNull(record.scanFreshness));
  request.input(`scannedAt${suffix}`, sql.DateTime2(3), dateOrNull(record.scannedAt));
  request.input(`uploadedAt${suffix}`, sql.DateTime2(3), dateOrNull(record.uploadedAt));
  request.input(`createdAt${suffix}`, sql.DateTime2(3), dateOrNull(record.createdAt));
}

async function readWifiScansByScope(mapId, floorId) {
  if (!enabled && !pool) return null;
  const request = pool.request();
  const clauses = [];
  if (mapId) {
    request.input("mapId", sql.NVarChar(100), mapId);
    clauses.push("map_id=@mapId");
  }
  if (floorId) {
    request.input("floorId", sql.NVarChar(100), floorId);
    clauses.push("floor_id=@floorId");
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await request.query(`SELECT * FROM dbo.wifi_scan_records ${where} ORDER BY scanned_at, record_key`);
  return result.recordset.map(normalizeScan);
}

async function readWifiScanIndexSummary(mapId, floorId) {
  if (!enabled || !mapId || !floorId) return null;
  const request = pool.request()
    .input("mapId", sql.NVarChar(100), mapId)
    .input("floorId", sql.NVarChar(100), floorId);
  const [summary, points] = await Promise.all([
    request.query(`SELECT COUNT_BIG(*) totalRecords, COUNT(DISTINCT point_id) pointCount,
      COUNT(DISTINCT bssid) bssidCount, MAX(scanned_at) latestScannedAt
      FROM dbo.wifi_scan_records WHERE map_id=@mapId AND floor_id=@floorId`),
    pool.request().input("mapId", sql.NVarChar(100), mapId).input("floorId", sql.NVarChar(100), floorId)
      .query(`SELECT point_id pointId, COUNT_BIG(*) scanCount, COUNT(DISTINCT bssid) bssidCount,
        AVG(CAST(rssi AS FLOAT)) averageRssi, MAX(scanned_at) latestScannedAt
        FROM dbo.wifi_scan_records WHERE map_id=@mapId AND floor_id=@floorId
        GROUP BY point_id ORDER BY point_id`),
  ]);
  const row = summary.recordset[0];
  return {
    mapId,
    floorId,
    totalRecords: Number(row.totalRecords || 0),
    pointCount: Number(row.pointCount || 0),
    bssidCount: Number(row.bssidCount || 0),
    latestScannedAt: isoOrEmpty(row.latestScannedAt),
    points: points.recordset.map((point) => ({
      ...point,
      scanCount: Number(point.scanCount || 0),
      bssidCount: Number(point.bssidCount || 0),
      averageRssi: point.averageRssi == null ? null : Number(point.averageRssi),
      latestScannedAt: isoOrEmpty(point.latestScannedAt),
    })),
    source: "azure-sql",
  };
}

async function readWifiScanIndexPoints(mapId, floorId) {
  if (!enabled || !mapId || !floorId) return null;
  const result = await pool.request()
    .input("mapId", sql.NVarChar(100), mapId)
    .input("floorId", sql.NVarChar(100), floorId)
    .query(`SELECT point_id pointId, AVG(x) x, AVG(y) y, AVG(heading) heading,
      COUNT_BIG(*) scanCount, COUNT(DISTINCT bssid) bssidCount, MAX(scanned_at) latestScannedAt
      FROM dbo.wifi_scan_records WHERE map_id=@mapId AND floor_id=@floorId GROUP BY point_id ORDER BY point_id`);
  return result.recordset.map((row) => ({
    pointId: row.pointId,
    mapId,
    floorId,
    x: Number(row.x),
    y: Number(row.y),
    heading: row.heading == null ? null : Number(row.heading),
    scanCount: Number(row.scanCount || 0),
    bssidCount: Number(row.bssidCount || 0),
    latestScannedAt: isoOrEmpty(row.latestScannedAt),
  }));
}

async function readWifiFingerprintProfiles(mapId, floorId) {
  if (!enabled || !mapId || !floorId) return null;
  const cacheKey = `${mapId}\u0000${floorId}`;
  const cached = fingerprintProfileCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.profiles;
  const scopeRequest = () => pool.request()
    .input("mapId", sql.NVarChar(100), mapId)
    .input("floorId", sql.NVarChar(100), floorId);
  const priorityExpression = `(CASE WHEN LOWER(ISNULL(data_priority, '')) IN ('field_verified', 'verified', 'high')
    OR UPPER(ISNULL(source_mode, '')) LIKE '%KEY_POINT%'
    OR UPPER(ISNULL(source_mode, '')) LIKE '%BACKEND_PLACE%'
    OR UPPER(ISNULL(source_mode, '')) LIKE '%MANUAL%' THEN 1 ELSE 0 END)`;
  const filteredCte = `WITH ranked AS (
      SELECT *, ${priorityExpression} priority_value,
        MAX(${priorityExpression}) OVER (PARTITION BY point_id) has_high_priority
      FROM dbo.wifi_scan_records WHERE map_id=@mapId AND floor_id=@floorId
    ), filtered AS (
      SELECT * FROM ranked WHERE has_high_priority=0 OR priority_value=1
    )`;
  const [pointResult, apResult] = await Promise.all([
    scopeRequest().query(`${filteredCte}
      SELECT point_id pointId, AVG(CAST(x AS FLOAT)) x, AVG(CAST(y AS FLOAT)) y,
        COUNT_BIG(*) AS [rowCount], COUNT(DISTINCT NULLIF(sample_id, '')) AS sampleCount,
        MAX(scanned_at) latestScannedAt, MAX(priority_value) priorityWeight
      FROM filtered GROUP BY point_id`),
    scopeRequest().query(`${filteredCte}
      SELECT point_id pointId, LOWER(bssid) bssid, AVG(CAST(rssi AS FLOAT)) averageRssi,
        COUNT_BIG(*) observationCount, STDEV(CAST(rssi AS FLOAT)) rssiStdDev
      FROM filtered WHERE bssid IS NOT NULL AND bssid <> ''
      GROUP BY point_id, LOWER(bssid)`),
  ]);
  const apsByPoint = new Map();
  for (const row of apResult.recordset) {
    const list = apsByPoint.get(row.pointId) || [];
    list.push({
      bssid: String(row.bssid || "").toLowerCase(),
      averageRssi: Number(row.averageRssi),
      observationCount: Number(row.observationCount || 0),
      rssiStdDev: row.rssiStdDev == null ? 0 : Number(row.rssiStdDev),
    });
    apsByPoint.set(row.pointId, list);
  }
  const profiles = pointResult.recordset.map((point) => {
    const sampleCount = Math.max(Number(point.sampleCount || 0), Number(point.rowCount || 0) > 0 ? 1 : 0);
    const aps = (apsByPoint.get(point.pointId) || []).filter((ap) => {
      if (ap.observationCount < 2 && sampleCount >= 6) return false;
      return ap.rssiStdDev <= 16 || ap.observationCount >= 8;
    });
    const stableApCount = aps.filter((ap) => ap.observationCount >= 3 && ap.rssiStdDev <= 10).length;
    const stabilityScore = aps.length ? clampNumber(stableApCount / aps.length, 0, 1) : 0;
    const recencyWeight = fingerprintRecencyWeight(point.latestScannedAt);
    const priorityWeight = Number(point.priorityWeight || 0) >= 1 ? 1 : 0.15;
    const trustedAnchorScore = fingerprintTrustedAnchorScore({ sampleCount, stableApCount, stabilityScore, priorityWeight, vectorSize: aps.length });
    return {
      pointId: point.pointId,
      mapId,
      floorId,
      x: Number(point.x),
      y: Number(point.y),
      vectorEntries: aps.map((ap) => [ap.bssid, ap.averageRssi]),
      sampleCount,
      stableApCount,
      stabilityScore,
      repeatBoost: clampNumber(Math.log(Math.max(1, sampleCount)), 0, 3.2),
      priorityWeight,
      recencyWeight,
      effectiveRecencyWeight: Math.max(recencyWeight, trustedAnchorRecencyFloor(trustedAnchorScore)),
      trustedAnchorScore,
    };
  }).filter((profile) => Number.isFinite(profile.x) && Number.isFinite(profile.y) && profile.vectorEntries.length >= 2);
  fingerprintProfileCache.set(cacheKey, {
    expiresAt: Date.now() + fingerprintProfileCacheTtlMs,
    profiles,
  });
  return profiles;
}

async function deleteWifiScansByPointAndDate({ mapId, floorId, pointId, since, before }) {
  if (!enabled) throw new Error("Azure SQL is not initialized");
  if (!mapId || !floorId || !pointId) throw new Error("mapId, floorId and pointId are required");
  const request = pool.request()
    .input("mapId", sql.NVarChar(100), mapId)
    .input("floorId", sql.NVarChar(100), floorId)
    .input("pointId", sql.NVarChar(100), pointId);
  const clauses = ["map_id=@mapId", "floor_id=@floorId", "point_id=@pointId"];
  if (since) {
    request.input("since", sql.DateTime2(3), dateOrNull(since));
    clauses.push("scanned_at>=@since");
  }
  if (before) {
    request.input("before", sql.DateTime2(3), dateOrNull(before));
    clauses.push("scanned_at<@before");
  }
  const result = await request.query(`DELETE FROM dbo.wifi_scan_records WHERE ${clauses.join(" AND ")}`);
  invalidateFingerprintProfileCache(mapId, floorId);
  return { done: true, processed: result.rowsAffected[0] || 0, deleted: result.rowsAffected[0] || 0 };
}

function invalidateFingerprintProfileCache(mapId, floorId) {
  if (!mapId || !floorId) return;
  fingerprintProfileCache.delete(`${mapId}\u0000${floorId}`);
}

async function statusSummary() {
  if (!enabled) return { enabled: false, storage: "azure-sql", configured: isConfigured() };
  const scanCount = await scalar("SELECT COUNT_BIG(*) AS value FROM dbo.wifi_scan_records");
  const documentCount = await scalar("SELECT COUNT_BIG(*) AS value FROM dbo.system_documents");
  const scopes = await pool.request().query(`SELECT map_id mapId, floor_id floorId, COUNT_BIG(*) records,
    COUNT(DISTINCT point_id) points, COUNT(DISTINCT bssid) aps
    FROM dbo.wifi_scan_records GROUP BY map_id, floor_id ORDER BY map_id, floor_id`);
  return {
    enabled: true,
    storage: "azure-sql",
    counts: { wifi_scan_records: scanCount, system_documents: documentCount },
    fingerprintScopes: scopes.recordset.map((row) => ({
      mapId: row.mapId,
      floorId: row.floorId,
      records: Number(row.records || 0),
      points: Number(row.points || 0),
      aps: Number(row.aps || 0),
    })),
  };
}

async function scalar(query) {
  const result = await pool.request().query(query);
  return Number(result.recordset[0]?.value || 0);
}

function scanIdentityKey(record) {
  return crypto.createHash("sha256").update([
    record.mapId || "", record.floorId || "", record.pointId || "",
    String(record.bssid || "").toLowerCase(), record.scannedAt || "",
  ].join("|")).digest("hex");
}

function normalizeScan(row) {
  return {
    id: row.source_id == null ? null : Number(row.source_id),
    sampleId: row.sample_id || "",
    pointId: row.point_id,
    mapId: row.map_id,
    floorId: row.floor_id,
    x: Number(row.x),
    y: Number(row.y),
    heading: row.heading == null ? null : Number(row.heading),
    ssid: row.ssid || "",
    bssid: String(row.bssid || "").toLowerCase(),
    rssi: Number(row.rssi),
    deviceInfo: row.device_info || "",
    sourceMode: row.source_mode || "",
    dataPriority: row.data_priority || "",
    sessionId: row.session_id || "",
    scanFreshness: row.scan_freshness || "",
    scannedAt: isoOrEmpty(row.scanned_at),
    uploadedAt: isoOrEmpty(row.uploaded_at),
    createdAt: isoOrEmpty(row.created_at),
  };
}

function readJson(fileName, fallback) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf8").trim();
  return raw ? JSON.parse(raw) : fallback;
}

function dateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textOrNull(value) {
  const text = String(value || "").trim();
  return text || null;
}

function isoOrEmpty(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function fingerprintRecencyWeight(value) {
  const sampledAt = value instanceof Date ? value.getTime() : Date.parse(value || "");
  if (!Number.isFinite(sampledAt)) return 0.25;
  const ageDays = Math.max(0, (Date.now() - sampledAt) / 86400000);
  return 0.25 + 0.75 * Math.pow(0.5, ageDays / 30);
}

function fingerprintTrustedAnchorScore({ sampleCount, stableApCount, stabilityScore, priorityWeight, vectorSize }) {
  const sampleScore = clampNumber(Math.log1p(Math.max(0, sampleCount)) / Math.log(10), 0, 1);
  const stableApScore = clampNumber(stableApCount / Math.min(10, Math.max(4, vectorSize || 4)), 0, 1);
  const trust = sampleScore * 0.34 + clampNumber(stabilityScore, 0, 1) * 0.34 + stableApScore * 0.22 + (priorityWeight >= 1 ? 0.1 : 0);
  if (sampleCount < 3 || stableApCount < 2) return trust * 0.45;
  return clampNumber(trust, 0, 1);
}

function trustedAnchorRecencyFloor(trust) {
  if (trust >= 0.72) return 0.72;
  if (trust >= 0.55) return 0.6;
  if (trust >= 0.4) return 0.45;
  return 0.25;
}

function clampNumber(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

module.exports = {
  closeStore,
  deleteWifiScansByPointAndDate,
  isConfigured,
  isEnabled,
  mirrorAdminData,
  mirrorJsonFiles,
  mirrorDocumentValues,
  missingDocumentNames,
  mirrorModels,
  mirrorWifiScans,
  readWifiScanIndexPoints,
  readWifiScanIndexSummary,
  readWifiScansByScope,
  readWifiFingerprintProfiles,
  startStore,
  statusSummary,
};
