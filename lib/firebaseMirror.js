const fs = require("fs");
const path = require("path");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");

const DATA_FILES = [
  "catalog_records.json",
  "route_graph_records.json",
  "route_edge_overrides.json",
  "wifi_scans.json",
  "model_versions.json",
  "model_training_jobs.json",
  "navigation_feedback.json",
  "navigation_history.json",
  "saved_locations.json",
  "navigation_policy_logs.json",
  "strategy_training_runs.json",
  "user_reports.json",
  "place_overrides.json",
];
const WIFI_SCAN_BATCH_SIZE = Number(process.env.FIREBASE_WIFI_SCAN_BATCH_SIZE || 400);

let db = null;
let enabled = false;
let jsonMirrorQueue = Promise.resolve();
let startupSync = {
  restoredFiles: [],
  seededFiles: [],
  skippedFiles: [],
  syncedAt: null,
};

function isEnabled() {
  return enabled;
}

// Reviews use individual Firebase records so concurrent writers cannot replace each other's work.
function placeReviewRef(bucket, owner) {
  if (!enabled) throw new Error("Firebase reviews unavailable");
  const ref = root().child("place_reviews").child(bucket);
  return owner ? ref.child(owner) : ref;
}

async function readPlaceReviews(bucket) {
  return (await placeReviewRef(bucket).once("value")).val() || {};
}

async function savePlaceReview(bucket, owner, record) {
  const result = await placeReviewRef(bucket, owner).transaction(current => ({
    ...record, createdAt: current?.createdAt || record.updatedAt,
  }));
  if (!result.committed) throw new Error("Review transaction not committed");
}

async function removePlaceReview(bucket, owner) {
  await placeReviewRef(bucket, owner).remove();
}

function reviewModerationRef(bucket, reviewId) {
  if (!enabled) throw new Error("Firebase reviews unavailable");
  const ref = root().child("place_review_moderation").child(bucket);
  return reviewId ? ref.child(reviewId) : ref;
}

async function readReviewModeration(bucket) {
  return (await reviewModerationRef(bucket).once("value")).val() || {};
}

async function reportPlaceReview(bucket, reviewId, reporter, report) {
  const result = await reviewModerationRef(bucket, reviewId).child("reports").child(reporter)
    .transaction(current => current || report);
  if (!result.committed) throw new Error("Report transaction not committed");
}

async function moderatePlaceReview(bucket, reviewId, decision) {
  const ref = reviewModerationRef(bucket, reviewId);
  await ref.update({ decision, [`history/${ref.push().key}`]: decision });
}

async function startMirror(options = {}) {
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_RTDB_URL;
  if (!databaseURL) return false;

  const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
  const { getDatabase } = require("firebase-admin/database");
  const credential = loadCredential({ applicationDefault, cert });
  if (!credential) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_BASE64, or GOOGLE_APPLICATION_CREDENTIALS is required");
  }

  if (!getApps().length) {
    initializeApp({ credential, databaseURL });
  }
  db = getDatabase();
  enabled = true;
  if (options.skipCacheSync === true) {
    startupSync = {
      restoredFiles: [],
      seededFiles: [],
      skippedFiles: DATA_FILES.slice(),
      syncedAt: new Date().toISOString(),
      status: "skipped",
    };
    return true;
  }
  startupSync = {
    restoredFiles: [],
    seededFiles: [],
    skippedFiles: [],
    syncedAt: null,
    status: "running",
  };
  await syncJsonCacheWithFirebase()
    .then((result) => {
      startupSync = { ...result, status: "complete" };
    })
    .catch((error) => {
      startupSync = {
        ...startupSync,
        status: "failed",
        error: error.message,
        syncedAt: new Date().toISOString(),
      };
      enabled = false;
      db = null;
      console.error("Firebase startup sync failed:", error.message);
      throw error;
    });
  return true;
}

async function mirrorWifiScans(records) {
  if (!enabled || !Array.isArray(records) || records.length === 0) return false;
  for (let index = 0; index < records.length; index += WIFI_SCAN_BATCH_SIZE) {
    const updates = {};
    for (const record of records.slice(index, index + WIFI_SCAN_BATCH_SIZE)) {
      const id = safeFirebaseKey(record.id || scanIdentityKey(record));
      updates[`wifi_scans/${id}`] = record;
    }
    await root().update(updates);
  }
  await addScansToIndexes(records);
  await writeMeta();
  return true;
}

async function cleanupLegacyWifiScans(options = {}) {
  if (!enabled) throw new Error("Firebase is not enabled");
  const mapId = String(options.mapId || "").trim();
  const floorId = String(options.floorId || "").trim();
  if (!mapId || !floorId) throw new Error("mapId and floorId are required");
  const before = String(options.before || "2026-09-01T00:00:00.000Z");
  const batchSize = Math.max(100, Math.min(2000, Number(options.batchSize || 700)));
  const maxMillis = Math.max(3000, Math.min(25000, Number(options.maxMillis || 18000)));
  const startedAt = Date.now();
  let cursor = String(options.cursor || "");
  let processed = 0;
  let deleted = 0;
  let done = false;

  while (Date.now() - startedAt < maxMillis) {
    let query = root().child("wifi_scans").orderByKey();
    query = cursor ? query.startAt(cursor).limitToFirst(batchSize + 1) : query.limitToFirst(batchSize);
    const snapshot = await query.once("value");
    const updates = {};
    let seen = 0;
    let lastKey = cursor;
    snapshot.forEach((child) => {
      const childKey = child.key || "";
      if (cursor && childKey === cursor) return;
      seen += 1;
      lastKey = childKey;
      const record = child.val();
      if (isLegacyWifiScan(record, mapId, floorId, before)) {
        updates[`wifi_scans/${childKey}`] = null;
        deleted += 1;
      }
    });
    if (Object.keys(updates).length > 0) await root().update(updates);
    processed += seen;
    cursor = lastKey;
    if (seen < batchSize) {
      done = true;
      break;
    }
  }

  await writeMeta({ legacyWifiCleanupUpdatedAt: new Date().toISOString() });
  return { done, cursor, processed, deleted };
}

async function deleteWifiScansByPointAndDate(options = {}) {
  if (!enabled) throw new Error("Firebase is not enabled");
  const mapId = String(options.mapId || "").trim();
  const floorId = String(options.floorId || "").trim();
  const pointId = String(options.pointId || "").trim();
  const since = String(options.since || "").trim();
  const before = String(options.before || "").trim();
  if (!mapId || !floorId || !pointId || !since || !before) {
    throw new Error("mapId, floorId, pointId, since and before are required");
  }
  const batchSize = Math.max(100, Math.min(2000, Number(options.batchSize || 700)));
  const maxMillis = Math.max(3000, Math.min(25000, Number(options.maxMillis || 18000)));
  const startedAt = Date.now();
  let cursor = String(options.cursor || "");
  let processed = 0;
  let deleted = 0;
  let done = false;

  while (Date.now() - startedAt < maxMillis) {
    let query = root().child("wifi_scans").orderByKey();
    query = cursor ? query.startAt(cursor).limitToFirst(batchSize + 1) : query.limitToFirst(batchSize);
    const snapshot = await query.once("value");
    const updates = {};
    let seen = 0;
    let lastKey = cursor;
    snapshot.forEach((child) => {
      const childKey = child.key || "";
      if (cursor && childKey === cursor) return;
      seen += 1;
      lastKey = childKey;
      const record = child.val();
      if (isWifiScanInPointDateRange(record, mapId, floorId, pointId, since, before)) {
        updates[`wifi_scans/${childKey}`] = null;
        deleted += 1;
      }
    });
    if (Object.keys(updates).length > 0) await root().update(updates);
    processed += seen;
    cursor = lastKey;
    if (seen < batchSize) {
      done = true;
      break;
    }
  }

  await writeMeta({ wifiPointCleanupUpdatedAt: new Date().toISOString() });
  return { done, cursor, processed, deleted };
}

async function readWifiScansByScope(mapId, floorId) {
  if (!enabled || !mapId || !floorId) return null;
  const snapshot = await root().child("wifi_scans").orderByChild("floorId").equalTo(floorId).once("value");
  const records = [];
  snapshot.forEach((child) => {
    const record = child.val();
    if (record && record.mapId === mapId && record.floorId === floorId) {
      records.push(record);
    }
  });
  return records;
}

async function readAllWifiScans() {
  if (!enabled) return null;
  const snapshot = await root().child("wifi_scans").once("value");
  const records = [];
  snapshot.forEach((child) => {
    const record = child.val();
    if (record) records.push(record);
  });
  return records;
}

async function readWifiScanSummaryByScope(mapId, floorId) {
  const records = await readWifiScansByScope(mapId, floorId);
  if (!records) return null;
  return {
    records,
    source: "firebase-rtdb",
  };
}

async function readWifiScanIndexSummary(mapId, floorId) {
  if (!enabled || !mapId || !floorId) return null;
  const snapshot = await root().child("wifi_scan_indexes").child(scopeKey(mapId, floorId)).once("value");
  const index = snapshot.val();
  if (!index || !index.summary) return null;
  const points = Object.values(index.points || {})
    .map((point) => ({
      pointId: point.pointId,
      scanCount: Number(point.scanCount || 0),
      bssidCount: countRecords(point.bssids || {}),
      averageRssi: point.scanCount ? Math.round((Number(point.rssiTotal || 0) / Number(point.scanCount || 1)) * 100) / 100 : null,
      latestScannedAt: point.latestScannedAt || "",
    }))
    .sort((left, right) => String(left.pointId || "").localeCompare(String(right.pointId || "")));
  return {
    mapId,
    floorId,
    totalRecords: wifiIndexTotalRecords(index),
    pointCount: countRecords(index.points || {}),
    bssidCount: countRecords(index.bssids || {}),
    latestScannedAt: index.summary.latestScannedAt || "",
    points,
    source: "firebase-rtdb-index",
  };
}

async function readWifiScanIndexPoints(mapId, floorId) {
  const summary = await readWifiScanIndexSummary(mapId, floorId);
  if (!summary) return null;
  const snapshot = await root().child("wifi_scan_indexes").child(scopeKey(mapId, floorId)).child("points").once("value");
  const points = Object.values(snapshot.val() || {})
    .map((point) => ({
      pointId: point.pointId,
      mapId,
      floorId,
      x: Number(point.x),
      y: Number(point.y),
      heading: null,
      scanCount: Number(point.scanCount || 0),
      bssidCount: countRecords(point.bssids || {}),
      latestScannedAt: point.latestScannedAt || "",
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  return points;
}

async function readWifiFingerprintProfiles(mapId, floorId) {
  if (!enabled || !mapId || !floorId) return null;
  const snapshot = await root().child("wifi_scan_indexes").child(scopeKey(mapId, floorId)).once("value");
  const index = snapshot.val();
  if (!index || !index.points) return null;
  return Object.values(index.points || {})
    .map((point) => {
      const entries = Object.values(point.bssids || {})
        .map((ap) => {
          if (!ap || typeof ap !== "object") return null;
          const count = Number(ap.count || 0);
          const rssiTotal = Number(ap.rssiTotal || 0);
          if (!ap.bssid || count <= 0) return null;
          return [String(ap.bssid).toLowerCase(), rssiTotal / count];
        })
        .filter(Boolean);
      const sampleCount = Number(point.sampleCount || point.scanCount || 0);
      const stableApCount = entries.length;
      const stabilityScore = stableApCount ? 0.8 : 0;
      const recencyWeight = fingerprintRecencyWeightFromTimestamp(point.latestScannedAt);
      const trustedAnchorScore = fingerprintTrustedAnchorScore({
        sampleCount,
        stableApCount,
        stabilityScore,
        priorityWeight: 1,
        vectorSize: stableApCount,
      });
      return {
        pointId: point.pointId,
        mapId,
        floorId,
        x: Number(point.x),
        y: Number(point.y),
        vectorEntries: entries,
        sampleCount,
        stableApCount,
        stabilityScore,
        repeatBoost: Math.max(0, Math.min(3.2, Math.log(Math.max(1, sampleCount)))),
        priorityWeight: 1,
        recencyWeight,
        effectiveRecencyWeight: Math.max(recencyWeight, trustedAnchorRecencyFloor(trustedAnchorScore)),
        trustedAnchorScore,
      };
    })
    .filter((profile) => Number.isFinite(profile.x) && Number.isFinite(profile.y) && profile.vectorEntries.length >= 2);
}

async function rebuildWifiScanIndex(mapId, floorId, options = {}) {
  if (!enabled || !mapId || !floorId) throw new Error("Firebase is not enabled");
  const key = scopeKey(mapId, floorId);
  const batchSize = Math.max(100, Math.min(2000, Number(options.batchSize || 700)));
  const maxMillis = Math.max(3000, Math.min(25000, Number(options.maxMillis || 18000)));
  const startedAt = Date.now();
  const indexRef = root().child("wifi_scan_indexes").child(key);
  let cursor = String(options.cursor || "");
  if (options.reset === true && !cursor) {
    await indexRef.remove();
  }
  let index = (await indexRef.once("value")).val() || {};
  index = normalizeWifiScanIndex(index, mapId, floorId);

  let processed = 0;
  let matched = 0;
  let done = false;
  while (Date.now() - startedAt < maxMillis) {
    let query = root().child("wifi_scans").orderByKey();
    query = cursor ? query.startAt(cursor).limitToFirst(batchSize + 1) : query.limitToFirst(batchSize);
    const snapshot = await query.once("value");
    let seen = 0;
    let lastKey = cursor;
    snapshot.forEach((child) => {
      const childKey = child.key || "";
      if (cursor && childKey === cursor) return;
      seen += 1;
      lastKey = childKey;
      const record = child.val();
      if (record && record.mapId === mapId && record.floorId === floorId) {
        addScanToIndex(index, record);
        matched += 1;
      }
    });
    processed += seen;
    cursor = lastKey;
    if (seen < batchSize) {
      done = true;
      break;
    }
  }

  index.summary.updatedAt = new Date().toISOString();
  index.summary.rebuildCursor = done ? "" : cursor;
  index.summary.rebuildComplete = done;
  refreshWifiScanIndexSummary(index);
  await indexRef.set(index);
  await writeMeta({ wifiScanIndexUpdatedAt: index.summary.updatedAt });
  return {
    done,
    cursor,
    processed,
    matched,
    summary: {
      mapId,
      floorId,
      totalRecords: wifiIndexTotalRecords(index),
      pointCount: countRecords(index.points || {}),
      bssidCount: countRecords(index.bssids || {}),
      latestScannedAt: index.summary.latestScannedAt || "",
    },
  };
}

function wifiIndexTotalRecords(index) {
  return Object.values(index?.points || {}).reduce((sum, point) => sum + Number(point?.scanCount || 0), 0);
}

function refreshWifiScanIndexSummary(index) {
  index.summary.totalRecords = wifiIndexTotalRecords(index);
  index.summary.latestScannedAt = Object.values(index.points || {}).reduce((latest, point) => {
    const value = String(point?.latestScannedAt || "");
    return value > latest ? value : latest;
  }, "");
}

async function mirrorJsonFiles(fileNames = DATA_FILES) {
  const pending = jsonMirrorQueue.then(() => mirrorJsonFilesNow(fileNames));
  jsonMirrorQueue = pending.catch(() => {});
  return pending;
}

async function mirrorJsonFilesNow(fileNames) {
  if (!enabled) return false;
  const updates = {};
  for (const fileName of fileNames) {
    const value = readJsonFile(fileName);
    if (value === undefined) continue;
    const collection = collectionName(fileName);
    if (fileName === "wifi_scans.json" && Array.isArray(value)) {
      if (Object.keys(updates).length > 0) {
        await root().update(updates);
        Object.keys(updates).forEach((key) => delete updates[key]);
      }
      await mirrorWifiScans(value);
    } else {
      updates[collection] = value;
    }
  }
  await root().update(updates);
  await writeMeta();
  return true;
}

async function statusSummary() {
  if (!enabled) {
    return {
      enabled: false,
      storage: "json",
      databaseUrlConfigured: Boolean(process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_RTDB_URL),
      startupSync,
      note: "Firebase is not configured; JSON files are the active store.",
    };
  }

  const counts = {};
  for (const fileName of DATA_FILES) {
    const name = collectionName(fileName);
    if (fileName === "wifi_scans.json") {
      counts[name] = "large-collection";
      continue;
    }
    const snapshot = await root().child(name).once("value");
    counts[name] = countRecords(snapshot.val());
  }
  const metaSnapshot = await root().child("meta").once("value");
  const meta = metaSnapshot.val() || {};
  return {
    enabled: true,
    storage: "firebase-rtdb",
    sourceOfTruth: true,
    databaseUrl: process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_RTDB_URL,
    counts,
    updatedAt: meta.updatedAt || null,
    startupSync,
    note: "Firebase Realtime Database is the active store; JSON files are only the local runtime cache.",
  };
}

async function syncJsonCacheWithFirebase() {
  ensureDataDir();
  const result = {
    restoredFiles: [],
    seededFiles: [],
    skippedFiles: [],
    syncedAt: new Date().toISOString(),
    status: "running",
  };

  for (const fileName of DATA_FILES) {
    const collection = collectionName(fileName);
    if (fileName === "wifi_scans.json") {
      result.skippedFiles.push(fileName);
      continue;
    }
    const snapshot = await root().child(collection).once("value");
    const remoteValue = snapshot.val();
    if (hasMeaningfulValue(remoteValue)) {
      writeJsonFile(fileName, normalizeRemoteValue(fileName, remoteValue));
      result.restoredFiles.push(fileName);
      continue;
    }

    const localValue = readJsonFile(fileName);
    if (hasMeaningfulValue(localValue)) {
      if (fileName === "wifi_scans.json" && Array.isArray(localValue)) {
        await root().child(collection).remove();
        await mirrorWifiScans(localValue);
      } else {
        await root().child(collection).set(normalizeLocalValueForFirebase(fileName, localValue));
      }
      result.seededFiles.push(fileName);
      continue;
    }

    result.skippedFiles.push(fileName);
  }

  await writeMeta({
    startupSyncAt: result.syncedAt,
    startupRestoredFiles: result.restoredFiles,
    startupSeededFiles: result.seededFiles,
  });
  return { ...result, status: "complete" };
}

function loadCredential(provider) {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return provider.cert(parsed);
  }

  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (rawBase64) {
    const parsed = JSON.parse(Buffer.from(rawBase64, "base64").toString("utf8"));
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return provider.cert(parsed);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return provider.applicationDefault();
  }

  return null;
}

function root() {
  if (!db) throw new Error("Firebase mirror is not initialized");
  return db.ref(process.env.FIREBASE_ROOT_PATH || "indoor_navigation");
}

async function writeMeta(extra = {}) {
  await root().child("meta").update({
    updatedAt: new Date().toISOString(),
    source: "maptest-02-server",
    ...extra,
  });
}

function readJsonFile(fileName) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) return undefined;
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw);
}

function writeJsonFile(fileName, value) {
  ensureDataDir();
  fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(value, null, 2), "utf8");
}

function normalizeRemoteValue(fileName, value) {
  if (fileName === "wifi_scans.json" && value && !Array.isArray(value)) {
    return Object.values(value).sort((left, right) => (Number(left.id) || 0) - (Number(right.id) || 0));
  }
  return value;
}

function normalizeLocalValueForFirebase(fileName, value) {
  if (fileName === "wifi_scans.json" && Array.isArray(value)) {
    const records = {};
    value.forEach((record) => {
      const id = safeFirebaseKey(record.id || scanIdentityKey(record));
      records[id] = record;
    });
    return records;
  }
  return value;
}

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function collectionName(fileName) {
  return fileName.replace(/\.json$/i, "");
}

function countRecords(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    if (Array.isArray(value.maps) || Array.isArray(value.floors) || Array.isArray(value.places)) {
      return {
        maps: value.maps?.length || 0,
        floors: value.floors?.length || 0,
        places: value.places?.length || 0,
      };
    }
    if (Array.isArray(value.nodes) || Array.isArray(value.edges) || Array.isArray(value.transitions)) {
      return {
        nodes: value.nodes?.length || 0,
        edges: value.edges?.length || 0,
        transitions: value.transitions?.length || 0,
      };
    }
    return Object.keys(value).length;
  }
  return value == null ? 0 : 1;
}

function scanIdentityKey(record) {
  return [
    record.mapId || "",
    record.floorId || "",
    record.pointId || "",
    String(record.bssid || "").toLowerCase(),
    record.scannedAt || "",
  ].join("|");
}

function safeFirebaseKey(value) {
  return String(value || "")
    .replace(/[.#$/[\]]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 700);
}

function scopeKey(mapId, floorId) {
  return safeFirebaseKey(`${mapId}__${floorId}`);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fingerprintRecencyWeightFromTimestamp(scannedAt) {
  const sampledAt = Date.parse(scannedAt || "");
  if (!Number.isFinite(sampledAt)) return 0.25;
  const ageDays = Math.max(0, (Date.now() - sampledAt) / 86400000);
  return 0.25 + 0.75 * Math.pow(0.5, ageDays / 30);
}

function fingerprintTrustedAnchorScore({ sampleCount, stableApCount, stabilityScore, priorityWeight, vectorSize }) {
  const sampleScore = clamp(Math.log1p(Math.max(0, Number(sampleCount) || 0)) / Math.log(10), 0, 1);
  const stableApScore = clamp((Number(stableApCount) || 0) / Math.min(10, Math.max(4, Number(vectorSize) || 4)), 0, 1);
  const priorityScore = Number(priorityWeight) >= 1 ? 1 : 0;
  const trust = sampleScore * 0.34 + clamp(Number(stabilityScore) || 0, 0, 1) * 0.34 + stableApScore * 0.22 + priorityScore * 0.10;
  if ((Number(sampleCount) || 0) < 3 || (Number(stableApCount) || 0) < 2) return trust * 0.45;
  return clamp(trust, 0, 1);
}

function trustedAnchorRecencyFloor(trustedAnchorScore) {
  const trust = clamp(Number(trustedAnchorScore) || 0, 0, 1);
  if (trust >= 0.72) return 0.72;
  if (trust >= 0.55) return 0.6;
  if (trust >= 0.4) return 0.45;
  return 0.25;
}

function normalizeWifiScanIndex(index, mapId, floorId) {
  return {
    summary: {
      mapId,
      floorId,
      totalRecords: Number(index.summary?.totalRecords || 0),
      latestScannedAt: index.summary?.latestScannedAt || "",
      updatedAt: index.summary?.updatedAt || "",
      rebuildCursor: index.summary?.rebuildCursor || "",
      rebuildComplete: index.summary?.rebuildComplete === true,
    },
    points: index.points || {},
    bssids: index.bssids || {},
  };
}

function addScanToIndex(index, record) {
  const pointId = String(record.pointId || "").trim();
  const bssid = String(record.bssid || "").trim().toLowerCase();
  const rssi = Number(record.rssi);
  if (!pointId || !bssid || !Number.isFinite(rssi)) return;
  const pointKey = safeFirebaseKey(pointId);
  const bssidKey = safeFirebaseKey(bssid);
  const point = index.points[pointKey] || {
    pointId,
    x: Number(record.x),
    y: Number(record.y),
    scanCount: 0,
    sampleIds: {},
    rssiTotal: 0,
    latestScannedAt: "",
    bssids: {},
  };
  if (Number.isFinite(Number(record.x))) point.x = Number(record.x);
  if (Number.isFinite(Number(record.y))) point.y = Number(record.y);
  point.scanCount = Number(point.scanCount || 0) + 1;
  point.rssiTotal = Number(point.rssiTotal || 0) + rssi;
  if (record.sampleId) {
    point.sampleIds = point.sampleIds || {};
    point.sampleIds[safeFirebaseKey(record.sampleId)] = true;
    point.sampleCount = countRecords(point.sampleIds);
  } else {
    point.sampleCount = Math.max(Number(point.sampleCount || 0), Number(point.scanCount || 0));
  }
  point.bssids = point.bssids || {};
  const ap = point.bssids[bssidKey] || {
    bssid,
    count: 0,
    rssiTotal: 0,
    latestScannedAt: "",
  };
  ap.count = Number(ap.count || 0) + 1;
  ap.rssiTotal = Number(ap.rssiTotal || 0) + rssi;
  if (record.scannedAt && String(record.scannedAt) > String(ap.latestScannedAt || "")) {
    ap.latestScannedAt = record.scannedAt;
  }
  point.bssids[bssidKey] = ap;
  if (record.scannedAt && String(record.scannedAt) > String(point.latestScannedAt || "")) {
    point.latestScannedAt = record.scannedAt;
  }
  index.points[pointKey] = point;
  index.bssids[bssidKey] = true;
  index.summary.totalRecords = Number(index.summary.totalRecords || 0) + 1;
  if (record.scannedAt && String(record.scannedAt) > String(index.summary.latestScannedAt || "")) {
    index.summary.latestScannedAt = record.scannedAt;
  }
}

async function addScansToIndexes(records) {
  const grouped = new Map();
  for (const record of records) {
    if (!record || !record.mapId || !record.floorId) continue;
    const key = scopeKey(record.mapId, record.floorId);
    const list = grouped.get(key) || [];
    list.push(record);
    grouped.set(key, list);
  }
  for (const [key, scopedRecords] of grouped.entries()) {
    const first = scopedRecords[0];
    const indexRef = root().child("wifi_scan_indexes").child(key);
    let index = (await indexRef.once("value")).val() || {};
    index = normalizeWifiScanIndex(index, first.mapId, first.floorId);
    scopedRecords.forEach((record) => addScanToIndex(index, record));
    index.summary.updatedAt = new Date().toISOString();
    index.summary.rebuildComplete = false;
    await indexRef.set(index);
  }
}

function isLegacyWifiScan(record, mapId, floorId, before) {
  if (!record || record.mapId !== mapId || record.floorId !== floorId) return false;
  const pointId = String(record.pointId || "");
  if (!/^P\d{3,}$/i.test(pointId)) return false;
  const scannedAt = String(record.scannedAt || record.createdAt || "");
  return !scannedAt || scannedAt < before;
}

function isWifiScanInPointDateRange(record, mapId, floorId, pointId, since, before) {
  if (!record || record.mapId !== mapId || record.floorId !== floorId || record.pointId !== pointId) return false;
  const scannedAt = String(record.scannedAt || record.createdAt || "");
  return scannedAt >= since && scannedAt < before;
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  readPlaceReviews,
  savePlaceReview,
  removePlaceReview,
  readReviewModeration,
  reportPlaceReview,
  moderatePlaceReview,
  DATA_FILES,
  isEnabled,
  cleanupLegacyWifiScans,
  deleteWifiScansByPointAndDate,
  mirrorJsonFiles,
  mirrorWifiScans,
  readWifiScanIndexSummary,
  readWifiScanIndexPoints,
  readWifiFingerprintProfiles,
  readAllWifiScans,
  readWifiScansByScope,
  readWifiScanSummaryByScope,
  rebuildWifiScanIndex,
  startMirror,
  statusSummary,
};

