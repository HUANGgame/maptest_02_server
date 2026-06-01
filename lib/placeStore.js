const fs = require("fs");
const path = require("path");
const { readCatalogPlaces } = require("./catalogStore");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const overridesPath = path.join(dataDir, "place_overrides.json");

function readPlaces() {
  const overrides = readOverrides();
  return readCatalogPlaces().map((place) => ({
    ...place,
    ...(overrides[place.id] || {}),
  }));
}

function updatePlaceStatus(placeId, businessStatus) {
  const allowed = new Set(["open", "closed", "suspended", "unset"]);
  if (!allowed.has(businessStatus)) return null;
  const exists = readCatalogPlaces().some((place) => place.id === placeId);
  if (!exists) return null;
  const overrides = readOverrides();
  overrides[placeId] = {
    ...(overrides[placeId] || {}),
    businessStatus,
    updatedAt: new Date().toISOString(),
  };
  writeOverrides(overrides);
  return readPlaces().find((place) => place.id === placeId);
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
  readPlaces,
  updatePlaceStatus,
};
