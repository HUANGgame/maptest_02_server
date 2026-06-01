const fs = require("fs");
const path = require("path");

let pool = null;
let enabled = false;

function isEnabled() {
  return enabled;
}

async function startMirror() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (!url) return false;
  const mysql = require("mysql2/promise");
  pool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_LIMIT || 5),
    charset: "utf8mb4",
  });
  await ensureSchema();
  await seedMysqlFromJsonIfEmpty();
  await hydrateJsonFromMysql();
  enabled = true;
  return true;
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS maps (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      description TEXT,
      createdAt DATETIME NULL,
      updatedAt DATETIME NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS floors (
      id VARCHAR(64) PRIMARY KEY,
      mapId VARCHAR(64) NOT NULL,
      floorName VARCHAR(120) NOT NULL,
      floorLevel INT NOT NULL DEFAULT 0,
      imageUrl VARCHAR(500),
      width DECIMAL(12,4) NOT NULL DEFAULT 0,
      height DECIMAL(12,4) NOT NULL DEFAULT 0,
      scaleValue DECIMAL(12,6) NOT NULL DEFAULT 1,
      createdAt DATETIME NULL,
      updatedAt DATETIME NULL,
      INDEX idx_floors_map (mapId)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wifi_scan_records (
      id BIGINT PRIMARY KEY,
      pointId VARCHAR(64) NOT NULL,
      mapId VARCHAR(64) NOT NULL,
      floorId VARCHAR(64) NOT NULL,
      x DECIMAL(12,4) NOT NULL,
      y DECIMAL(12,4) NOT NULL,
      heading DECIMAL(8,3) NULL,
      ssid VARCHAR(180),
      bssid VARCHAR(40) NOT NULL,
      rssi INT NOT NULL,
      deviceInfo VARCHAR(255),
      scannedAt DATETIME NULL,
      uploadedAt DATETIME NULL,
      createdAt DATETIME NULL,
      source VARCHAR(60),
      sampleId VARCHAR(80),
      sessionId VARCHAR(80),
      scanFreshness VARCHAR(80),
      INDEX idx_wifi_scope (mapId, floorId),
      INDEX idx_wifi_point (mapId, floorId, pointId),
      INDEX idx_wifi_bssid (mapId, floorId, bssid)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS model_versions (
      id VARCHAR(80) PRIMARY KEY,
      versionName VARCHAR(160) NOT NULL,
      mapId VARCHAR(64) NOT NULL,
      floorId VARCHAR(64) NOT NULL,
      algorithm VARCHAR(40) NOT NULL,
      trainingDataCount INT NOT NULL DEFAULT 0,
      averageError DECIMAL(12,4) NULL,
      modelPath VARCHAR(500),
      trainedAt DATETIME NULL,
      isActive BOOLEAN NOT NULL DEFAULT FALSE,
      isComparisonOnly BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      createdAt DATETIME NULL,
      updatedAt DATETIME NULL,
      INDEX idx_models_scope (mapId, floorId),
      INDEX idx_models_active (mapId, floorId, isActive)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

async function seedMysqlFromJsonIfEmpty() {
  const [[scanCount]] = await pool.query("SELECT COUNT(*) AS count FROM wifi_scan_records");
  if (Number(scanCount.count || 0) > 0) return;
  const maps = readJson("catalog_records.json", { maps: [], floors: [] });
  const scans = readJson("wifi_scans.json", []);
  const models = readJson("model_versions.json", []);
  await upsertMaps(maps.maps || []);
  await upsertFloors(maps.floors || []);
  await upsertWifiScans(scans);
  await upsertModels(models);
}

async function hydrateJsonFromMysql() {
  const [maps] = await pool.query("SELECT * FROM maps ORDER BY id");
  const [floors] = await pool.query("SELECT * FROM floors ORDER BY mapId, floorLevel, id");
  const [scans] = await pool.query("SELECT * FROM wifi_scan_records ORDER BY id");
  const [models] = await pool.query("SELECT * FROM model_versions ORDER BY trainedAt, id");
  writeJson("catalog_records.json", {
    maps: maps.map(normalizeMap),
    floors: floors.map(normalizeFloor),
    places: readJson("catalog_records.json", { places: [] }).places || [],
  });
  writeJson("wifi_scans.json", scans.map(normalizeScan));
  writeJson("model_versions.json", models.map(normalizeModel));
}

async function mirrorWifiScans(records) {
  if (!enabled || !records.length) return;
  await upsertMaps(mapsFromScans(records));
  await upsertFloors(floorsFromScans(records));
  await upsertWifiScans(records);
}

async function mirrorModels(models) {
  if (!enabled || !models.length) return;
  await upsertModels(models);
}

async function upsertMaps(maps) {
  for (const map of maps) {
    await pool.query(
      `INSERT INTO maps (id, name, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), updatedAt=VALUES(updatedAt)`,
      [
        map.id,
        map.name || map.id,
        map.description || "",
        toMysqlDate(map.createdAt),
        toMysqlDate(map.updatedAt),
      ]
    );
  }
}

async function upsertFloors(floors) {
  for (const floor of floors) {
    await pool.query(
      `INSERT INTO floors (id, mapId, floorName, floorLevel, imageUrl, width, height, scaleValue, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE floorName=VALUES(floorName), floorLevel=VALUES(floorLevel), imageUrl=VALUES(imageUrl),
       width=VALUES(width), height=VALUES(height), scaleValue=VALUES(scaleValue), updatedAt=VALUES(updatedAt)`,
      [
        floor.id,
        floor.mapId,
        floor.floorName || floor.name || floor.id,
        Number(floor.floorLevel || 0),
        floor.imageUrl || null,
        Number(floor.width || 0),
        Number(floor.height || 0),
        Number(floor.scaleValue || floor.scale || 1),
        toMysqlDate(floor.createdAt),
        toMysqlDate(floor.updatedAt),
      ]
    );
  }
}

async function upsertWifiScans(records) {
  const chunkSize = 500;
  for (let index = 0; index < records.length; index += chunkSize) {
    const chunk = records.slice(index, index + chunkSize);
    const values = chunk.map((record) => [
      Number(record.id),
      record.pointId,
      record.mapId,
      record.floorId,
      Number(record.x),
      Number(record.y),
      record.heading == null ? null : Number(record.heading),
      record.ssid || "",
      String(record.bssid || "").toLowerCase(),
      Number(record.rssi),
      record.deviceInfo || "",
      toMysqlDate(record.scannedAt),
      toMysqlDate(record.uploadedAt),
      toMysqlDate(record.createdAt),
      record.source || "",
      record.sampleId || "",
      record.sessionId || "",
      record.scanFreshness || "",
    ]);
    await pool.query(
      `INSERT INTO wifi_scan_records
       (id, pointId, mapId, floorId, x, y, heading, ssid, bssid, rssi, deviceInfo, scannedAt, uploadedAt, createdAt, source, sampleId, sessionId, scanFreshness)
       VALUES ?
       ON DUPLICATE KEY UPDATE rssi=VALUES(rssi), uploadedAt=VALUES(uploadedAt), createdAt=VALUES(createdAt)`,
      [values]
    );
  }
}

async function upsertModels(models) {
  for (const model of models) {
    await pool.query(
      `INSERT INTO model_versions
       (id, versionName, mapId, floorId, algorithm, trainingDataCount, averageError, modelPath, trainedAt, isActive, isComparisonOnly, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE versionName=VALUES(versionName), trainingDataCount=VALUES(trainingDataCount),
       averageError=VALUES(averageError), isActive=VALUES(isActive), isComparisonOnly=VALUES(isComparisonOnly), notes=VALUES(notes), updatedAt=VALUES(updatedAt)`,
      [
        model.id,
        model.versionName,
        model.mapId,
        model.floorId,
        model.algorithm,
        Number(model.trainingDataCount || 0),
        model.averageError == null ? null : Number(model.averageError),
        model.modelPath || "",
        toMysqlDate(model.trainedAt),
        model.isActive === true,
        model.isComparisonOnly === true,
        model.notes || "",
        toMysqlDate(model.createdAt),
        toMysqlDate(model.updatedAt),
      ]
    );
  }
}

function mapsFromScans(records) {
  return Array.from(new Set(records.map((record) => record.mapId))).map((mapId) => ({
    id: mapId,
    name: `上傳資料地圖 ${mapId}`,
    description: "由 Android 管理者採樣工具上傳後自動顯示。",
  }));
}

function floorsFromScans(records) {
  const grouped = new Map();
  for (const record of records) {
    const key = `${record.mapId}/${record.floorId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  }
  return Array.from(grouped.values()).map((rows) => {
    const first = rows[0];
    const xs = rows.map((row) => Number(row.x)).filter(Number.isFinite);
    const ys = rows.map((row) => Number(row.y)).filter(Number.isFinite);
    return {
      id: first.floorId,
      mapId: first.mapId,
      floorName: `上傳樓層 ${first.floorId}`,
      floorLevel: parseFloorLevel(first.floorId),
      imageUrl: null,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      scaleValue: 1,
    };
  });
}

function parseFloorLevel(floorId) {
  const match = String(floorId || "").match(/(-?\d+)/);
  return match ? Number(match[1]) : 0;
}

function normalizeMap(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function normalizeFloor(row) {
  return {
    id: row.id,
    mapId: row.mapId,
    floorName: row.floorName,
    floorLevel: Number(row.floorLevel || 0),
    imageUrl: row.imageUrl || null,
    width: Number(row.width || 0),
    height: Number(row.height || 0),
    scaleValue: Number(row.scaleValue || 1),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function normalizeScan(row) {
  return {
    id: Number(row.id),
    pointId: row.pointId,
    mapId: row.mapId,
    floorId: row.floorId,
    x: Number(row.x),
    y: Number(row.y),
    heading: row.heading == null ? null : Number(row.heading),
    ssid: row.ssid || "",
    bssid: String(row.bssid || "").toLowerCase(),
    rssi: Number(row.rssi),
    deviceInfo: row.deviceInfo || "",
    scannedAt: toIso(row.scannedAt),
    uploadedAt: toIso(row.uploadedAt),
    createdAt: toIso(row.createdAt),
    source: row.source || "",
    sampleId: row.sampleId || "",
    sessionId: row.sessionId || "",
    scanFreshness: row.scanFreshness || "",
  };
}

function normalizeModel(row) {
  return {
    id: row.id,
    versionName: row.versionName,
    mapId: row.mapId,
    floorId: row.floorId,
    algorithm: row.algorithm,
    trainingDataCount: Number(row.trainingDataCount || 0),
    averageError: row.averageError == null ? null : Number(row.averageError),
    modelPath: row.modelPath || "",
    trainedAt: toIso(row.trainedAt),
    isActive: row.isActive === true || row.isActive === 1,
    isComparisonOnly: row.isComparisonOnly === true || row.isComparisonOnly === 1,
    notes: row.notes || "",
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function readJson(fileName, fallback) {
  const filePath = path.join(__dirname, "..", "data", fileName);
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf8").trim();
  return raw ? JSON.parse(raw) : fallback;
}

function writeJson(fileName, value) {
  const filePath = path.join(__dirname, "..", "data", fileName);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function toMysqlDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

module.exports = {
  isEnabled,
  mirrorModels,
  mirrorWifiScans,
  startMirror,
};
