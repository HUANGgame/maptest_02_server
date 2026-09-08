const fs = require("fs");
const path = require("path");
const { routeEdges, routeNodes } = require("./demoData");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const overridesPath = path.join(dataDir, "route_edge_overrides.json");
const graphPath = path.join(dataDir, "route_graph_records.json");

function readRouteNodes() {
  return mergeById(routeNodes, readGraph().nodes);
}

function readRouteEdges() {
  const overrides = readOverrides();
  return mergeById(routeEdges, readGraph().edges).map((edge) => ({
    ...edge,
    ...(overrides[edge.id] || {}),
  }));
}

function setRouteEdgeBlocked(edgeId, isBlocked) {
  const edge = readRouteEdges().find((item) => item.id === edgeId);
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

function createRouteSegment(body) {
  const mapId = String(body.mapId || "").trim();
  const floorId = String(body.floorId || "").trim();
  const from = normalizePoint(body.from);
  const to = normalizePoint(body.to);
  if (!mapId || !floorId || !from || !to) {
    throw new Error("mapId、floorId、from、to 都是必填");
  }
  const graph = readGraph();
  const existingNodes = mergeById(routeNodes, graph.nodes).filter((node) => node.mapId === mapId && node.floorId === floorId);
  const fromNode = reuseOrCreateNode(existingNodes, graph.nodes, mapId, floorId, from, body.fromLabel || "路線點");
  const toNode = reuseOrCreateNode(existingNodes.concat([fromNode]), graph.nodes, mapId, floorId, to, body.toLabel || "路線點");
  const distance = Math.round(Math.hypot(fromNode.x - toNode.x, fromNode.y - toNode.y) * 100) / 100;
  const edgeId = safeId(body.id || `route-edge-${mapId}-${floorId}-${fromNode.id}-${toNode.id}`);
  const edge = {
    id: edgeId,
    mapId,
    floorId,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    distance,
    isBlocked: false,
    source: "admin",
    name: String(body.name || "").trim(),
    createdAt: new Date().toISOString(),
  };
  graph.edges = mergeById(graph.edges, [edge]);
  writeGraph(graph);
  return { success: true, fromNode, toNode, edge };
}

function readOverrides() {
  ensureDataDir();
  if (!fs.existsSync(overridesPath)) return {};
  const raw = fs.readFileSync(overridesPath, "utf8").trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function readGraph() {
  ensureDataDir();
  if (!fs.existsSync(graphPath)) return { nodes: [], edges: [] };
  const raw = fs.readFileSync(graphPath, "utf8").trim();
  if (!raw) return { nodes: [], edges: [] };
  const parsed = JSON.parse(raw);
  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
  };
}

function writeGraph(graph) {
  ensureDataDir();
  fs.writeFileSync(graphPath, JSON.stringify({
    nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph.edges) ? graph.edges : [],
  }, null, 2), "utf8");
}

function writeOverrides(overrides) {
  ensureDataDir();
  fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2), "utf8");
}

function reuseOrCreateNode(existingNodes, dynamicNodes, mapId, floorId, point, label) {
  const nearest = existingNodes
    .map((node) => ({ node, distance: Math.hypot(node.x - point.x, node.y - point.y) }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (nearest && nearest.distance <= 8) return nearest.node;
  const node = {
    id: safeId(`route-node-${mapId}-${floorId}-${Date.now()}-${Math.round(point.x)}-${Math.round(point.y)}`),
    mapId,
    floorId,
    x: point.x,
    y: point.y,
    nodeType: "walkway",
    label: String(label || "").trim(),
    isWalkable: true,
    source: "admin",
    createdAt: new Date().toISOString(),
  };
  dynamicNodes.push(node);
  return node;
}

function normalizePoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
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

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  createRouteSegment,
  readRouteEdges,
  readRouteNodes,
  setRouteEdgeBlocked,
};
