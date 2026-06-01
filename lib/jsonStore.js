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
  return Array.isArray(parsed) ? parsed : [];
}

function appendScans(records) {
  ensureDataDir();
  const existing = readScans();
  const now = new Date().toISOString();
  const startId = existing.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
  const normalized = records.map((record, index) => ({
    id: startId + index,
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
  }));
  fs.writeFileSync(scansPath, JSON.stringify(existing.concat(normalized), null, 2), "utf8");
  return normalized;
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  appendScans,
  readScans,
};
