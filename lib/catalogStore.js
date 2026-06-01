const fs = require("fs");
const path = require("path");
const demoData = require("./demoData");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const catalogPath = path.join(dataDir, "catalog_records.json");

function readCatalog() {
  ensureDataDir();
  if (!fs.existsSync(catalogPath)) return emptyCatalog();
  const raw = fs.readFileSync(catalogPath, "utf8").trim();
  if (!raw) return emptyCatalog();
  const parsed = JSON.parse(raw);
  return {
    maps: Array.isArray(parsed.maps) ? parsed.maps : [],
    floors: Array.isArray(parsed.floors) ? parsed.floors : [],
    places: Array.isArray(parsed.places) ? parsed.places : [],
  };
}

function readMaps() {
  const dynamic = readCatalog().maps;
  return mergeById(demoData.maps, dynamic);
}

function readFloors() {
  const dynamic = readCatalog().floors;
  return mergeById(demoData.floors, dynamic);
}

function readCatalogPlaces() {
  const dynamic = readCatalog().places;
  return mergeById(demoData.places, dynamic);
}

function createMap(body) {
  const now = new Date().toISOString();
  const id = safeId(body.id || `map-${Date.now()}`);
  const record = {
    id,
    name: String(body.name || id).trim(),
    description: String(body.description || "").trim(),
    createdAt: now,
    updatedAt: now,
  };
  if (!record.name) throw new Error("name is required");
  writeCollection("maps", record);
  return record;
}

function createFloor(body) {
  const now = new Date().toISOString();
  const mapId = String(body.mapId || "").trim();
  if (!mapId) throw new Error("mapId is required");
  const id = safeId(body.id || `${mapId}-floor-${Date.now()}`);
  const record = {
    id,
    mapId,
    floorName: String(body.floorName || body.name || id).trim(),
    floorLevel: Number(body.floorLevel || 0),
    imageUrl: body.imageUrl || null,
    width: Number(body.width || 0),
    height: Number(body.height || 0),
    scaleValue: Number(body.scale || body.scaleValue || 1),
    createdAt: now,
    updatedAt: now,
  };
  if (!record.floorName) throw new Error("floorName is required");
  writeCollection("floors", record);
  return record;
}

function createPlace(body) {
  const now = new Date().toISOString();
  const mapId = String(body.mapId || "").trim();
  const floorId = String(body.floorId || "").trim();
  if (!mapId || !floorId) throw new Error("mapId and floorId are required");
  const id = safeId(body.id || `place-${Date.now()}`);
  const record = {
    id,
    mapId,
    floorId,
    name: String(body.name || id).trim(),
    category: String(body.category || "未分類").trim(),
    x: Number(body.x),
    y: Number(body.y),
    description: String(body.description || "").trim(),
    searchable: body.searchable !== false,
    businessStatus: String(body.businessStatus || "unset").trim(),
    createdAt: now,
    updatedAt: now,
  };
  if (!record.name) throw new Error("name is required");
  if (!Number.isFinite(record.x) || !Number.isFinite(record.y)) throw new Error("x and y must be numbers");
  writeCollection("places", record);
  return record;
}

function writeCollection(collectionName, record) {
  const catalog = readCatalog();
  catalog[collectionName] = mergeById(catalog[collectionName], [record]);
  ensureDataDir();
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf8");
}

function mergeById(base, dynamic) {
  const merged = new Map();
  base.forEach((item) => merged.set(item.id, item));
  dynamic.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

function safeId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function emptyCatalog() {
  return { maps: [], floors: [], places: [] };
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  createFloor,
  createMap,
  createPlace,
  readCatalogPlaces,
  readFloors,
  readMaps,
};
