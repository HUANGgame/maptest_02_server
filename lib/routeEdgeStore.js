const fs = require("fs");
const path = require("path");
const { routeEdges } = require("./demoData");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const overridesPath = path.join(dataDir, "route_edge_overrides.json");

function readRouteEdges() {
  const overrides = readOverrides();
  return routeEdges.map((edge) => ({
    ...edge,
    ...(overrides[edge.id] || {}),
  }));
}

function setRouteEdgeBlocked(edgeId, isBlocked) {
  const edge = routeEdges.find((item) => item.id === edgeId);
  if (!edge) return null;
  const overrides = readOverrides();
  overrides[edgeId] = {
    ...(overrides[edgeId] || {}),
    isBlocked: isBlocked === true,
    updatedAt: new Date().toISOString(),
  };
  writeOverrides(overrides);
  return readRouteEdges().find((item) => item.id === edgeId);
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
  readRouteEdges,
  setRouteEdgeBlocked,
};
