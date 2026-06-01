const fs = require("fs");
const path = require("path");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const historyPath = path.join(dataDir, "navigation_history.json");
const savedPath = path.join(dataDir, "saved_locations.json");

function appendHistory(record) {
  return append(historyPath, record);
}

function readHistory(userId) {
  return readArray(historyPath).filter((item) => !userId || item.userId === userId);
}

function appendSavedLocation(record) {
  return append(savedPath, record);
}

function readSavedLocations(userId) {
  return readArray(savedPath).filter((item) => !userId || item.userId === userId);
}

function clearHistory(userId) {
  const existing = readArray(historyPath);
  const remaining = existing.filter((item) => userId && item.userId !== userId);
  writeArray(historyPath, remaining);
  return existing.length - remaining.length;
}

function clearSavedLocations(userId) {
  const existing = readArray(savedPath);
  const remaining = existing.filter((item) => userId && item.userId !== userId);
  writeArray(savedPath, remaining);
  return existing.length - remaining.length;
}

function append(filePath, record) {
  const items = readArray(filePath);
  const now = new Date().toISOString();
  const next = {
    id: items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    ...record,
    createdAt: now,
  };
  writeArray(filePath, items.concat(next));
  return next;
}

function readArray(filePath) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writeArray(filePath, items) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  appendHistory,
  appendSavedLocation,
  clearHistory,
  clearSavedLocations,
  readHistory,
  readSavedLocations,
};
