const fs = require("fs");
const path = require("path");
const { deletePlace, readCatalogPlaces } = require("./catalogStore");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const overridesPath = path.join(dataDir, "place_overrides.json");

function readPlaces() {
  const overrides = readOverrides();
  return readCatalogPlaces()
    .filter((place) => !overrides[place.id]?.deleted)
    .map((place) => ({
      ...place,
      ...(overrides[place.id] || {}),
    }));
}

function updatePlaceStatus(placeId, businessStatus, openingHours) {
  const allowed = new Set(["open", "closed", "suspended", "unset"]);
  if (!allowed.has(businessStatus)) return null;
  const overrides = readOverrides();
  const exists = readCatalogPlaces().some((place) => place.id === placeId) && !overrides[placeId]?.deleted;
  if (!exists) return null;
  overrides[placeId] = {
    ...(overrides[placeId] || {}),
    businessStatus,
    ...(openingHours === undefined ? {} : { openingHours: String(openingHours).trim() }),
    updatedAt: new Date().toISOString(),
  };
  writeOverrides(overrides);
  return readPlaces().find((place) => place.id === placeId);
}

function deletePlaceRecord(criteria) {
  const target = findPlaceTarget(criteria);
  if (!target) return null;
  deletePlace(target.id);
  const overrides = readOverrides();
  // Keep a tombstone even if a dynamic record shadows a built-in place.
  overrides[target.id] = {
      ...(overrides[target.id] || {}),
      deleted: true,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
  };
  writeOverrides(overrides);
  return target;
}

function findPlaceTarget(criteria = {}) {
  const placeId = String(criteria.placeId || "").trim();
  const places = readPlaces();
  if (placeId) {
    const exact = places.find((place) => place.id === placeId);
    if (exact) return exact;
  }

  const mapId = String(criteria.mapId || "").trim();
  const floorId = String(criteria.floorId || "").trim();
  const x = Number(criteria.x);
  const y = Number(criteria.y);
  const tolerance = Number(criteria.tolerance || 4);
  if (!mapId || !floorId || !Number.isFinite(x) || !Number.isFinite(y)) return null;

  return places
    .filter((place) => place.mapId === mapId && place.floorId === floorId)
    .map((place) => ({
      ...place,
      hitDistance: Math.hypot(Number(place.x) - x, Number(place.y) - y),
    }))
    .filter((place) => place.hitDistance <= tolerance)
    .sort((left, right) => left.hitDistance - right.hitDistance)[0] || null;
}

function readOverrides() {
  ensureDataDir();
  if (!fs.existsSync(overridesPath)) return {};
  const raw = fs.readFileSync(overridesPath, "utf8").trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function writeOverrides(overrides) {
  ensureDataDir();
  fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2), "utf8");
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  deletePlaceRecord,
  readPlaces,
  updatePlaceStatus,
};
