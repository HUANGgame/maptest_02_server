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

function migrateKnownScanOwnership(records) {
  let changed = false;
  const migrated = records.map((record) => {
    if (record.mapId === "F1_M1" && (record.floorId === "floor_1" || record.floorId === "1" || record.floorId === "1F")) {
      changed = true;
      return {
        ...record,
        mapId: "k-area-airport",
        floorId: "k-area-airport-1f",
      };
    }
    return record;
  });
  if (changed) {
    fs.writeFileSync(scansPath, JSON.stringify(migrated, null, 2), "utf8");
  }
  return migrated;
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  appendScans,
  readScans,
};
