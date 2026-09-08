const fs = require("fs");
const path = require("path");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const scansPath = path.join(dataDir, "wifi_scans.json");

function readScans() {
  ensureDataDir();
  if (!fs.existsSync(scansPath)) return [];
  const raw = fs.readFileSync(scansPath, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? migrateKnownScanOwnership(parsed) : [];
}

function appendScans(records) {
  ensureDataDir();
  const existing = readScans();
  const now = new Date().toISOString();
  const existingKeys = new Set(existing.map(scanIdentityKey));
  const startId = existing.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
  const normalized = [];
  for (const record of records) {
    const candidate = {
      id: startId + normalized.length,
      pointId: record.pointId,
      mapId: record.mapId,
      floorId: record.floorId,
      x: Number(record.x),
      y: Number(record.y),
      heading: record.heading == null ? null : Number(record.heading),
      ssid: record.ssid || "",
      bssid: String(record.bssid || "").toLowerCase(),
      rssi: Number(record.rssi),
      deviceInfo: record.deviceInfo || "",
      scannedAt: record.scannedAt || now,
      uploadedAt: now,
      createdAt: now,
    };
    normalizeKnownScanOwnership(candidate);
    normalizeKnownScanCoordinates(candidate);
    const key = scanIdentityKey(candidate);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    normalized.push(candidate);
  }
  fs.writeFileSync(scansPath, JSON.stringify(existing.concat(normalized), null, 2), "utf8");
  return normalized;
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

function normalizeKnownScanOwnership(record) {
  if (record.mapId === "F1_M1" && (record.floorId === "floor_1" || record.floorId === "1" || record.floorId === "1F")) {
    record.mapId = "k-area-airport";
    record.floorId = "k-area-airport-1f";
    return true;
  }
  return false;
}

function normalizeKnownScanCoordinates(record) {
  if (record.mapId !== "k-area-airport" || record.floorId !== "k-area-airport-1f") return false;
  const x = Number(record.x);
  const y = Number(record.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < 120 || x > 260 || y < 100 || y > 230) return false;

  const sourceMinX = 178.8;
  const sourceMaxX = 217.6;
  const sourceMinY = 147.4;
  const sourceMaxY = 171.5;
  const targetMinX = 85;
  const targetMaxX = 1670;
  const targetMinY = 150;
  const targetMaxY = 510;
  record.x = ((x - sourceMinX) * ((targetMaxX - targetMinX) / (sourceMaxX - sourceMinX))) + targetMinX;
  record.y = ((y - sourceMinY) * ((targetMaxY - targetMinY) / (sourceMaxY - sourceMinY))) + targetMinY;
  return true;
}

function migrateKnownScanOwnership(records) {
  let changed = false;
  const migrated = records.map((record) => {
    const next = { ...record };
    if (normalizeKnownScanOwnership(next)) changed = true;
    if (normalizeKnownScanCoordinates(next)) changed = true;
    return next;
  });
  if (normalizeKnownScanCollectionCoordinates(migrated)) changed = true;
  if (changed) {
    fs.writeFileSync(scansPath, JSON.stringify(migrated, null, 2), "utf8");
  }
  return migrated;
}

function normalizeKnownScanCollectionCoordinates(records) {
  const scoped = records.filter((record) => record.mapId === "k-area-airport" && record.floorId === "k-area-airport-1f");
  if (scoped.length < 1000) return false;
  const xs = scoped.map((record) => Number(record.x)).filter(Number.isFinite);
  const ys = scoped.map((record) => Number(record.y)).filter(Number.isFinite);
  if (xs.length === 0 || ys.length === 0) return false;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  if (!(minX >= 0 && maxX <= 320 && minY >= 0 && maxY <= 260 && width >= 1 && width <= 160 && height >= 1 && height <= 120)) {
    return false;
  }

  for (const record of scoped) {
    record.x = transformRange(Number(record.x), minX, maxX, 85, 1670);
    record.y = transformRange(Number(record.y), minY, maxY, 130, 510);
  }
  return true;
}

function transformRange(value, sourceMin, sourceMax, targetMin, targetMax) {
  return ((value - sourceMin) * ((targetMax - targetMin) / (sourceMax - sourceMin))) + targetMin;
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  appendScans,
  readScans,
};
