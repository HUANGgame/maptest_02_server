const fs = require("fs");
const path = require("path");
const { floorTransitions, routeEdges, routeNodes } = require("./demoData");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const overridesPath = path.join(dataDir, "route_edge_overrides.json");
const graphPath = path.join(dataDir, "route_graph_records.json");

function readRouteNodes() {
  const graph = readGraph();
  const deleted = new Set(graph.deletedNodeIds);
  return mergeById(baseRouteNodes(), graph.nodes).filter((node) => !deleted.has(node.id));
}

function readRouteEdges() {
  const graph = readGraph();
  const deletedNodes = new Set(graph.deletedNodeIds);
  const deletedEdges = new Set(graph.deletedEdgeIds);
  const overrides = readOverrides();
  return mergeById(baseRouteEdges(), graph.edges)
    .filter((edge) => !deletedEdges.has(edge.id) && !deletedNodes.has(edge.fromNodeId) && !deletedNodes.has(edge.toNodeId))
    .map((edge) => ({
      ...edge,
      ...(overrides[edge.id] || {}),
    }));
}

function readFloorTransitions() {
  const graph = readGraph();
  const deletedNodes = new Set(graph.deletedNodeIds);
  return mergeById(baseFloorTransitions(), graph.transitions)
    .filter((transition) => !deletedNodes.has(transition.fromNodeId) && !deletedNodes.has(transition.toNodeId));
}

function readRouteZones() {
  const graph = readGraph();
  const deleted = new Set(graph.deletedZoneIds);
  return graph.zones.filter((zone) => !deleted.has(zone.id));
}

function createRouteZone(body) {
  const mapId = String(body.mapId || "").trim();
  const floorId = String(body.floorId || "").trim();
  const zoneType = normalizeZoneType(body.zoneType || body.type);
  const x = Number(body.x);
  const y = Number(body.y);
  const width = Number(body.width);
  const height = Number(body.height);
  if (!mapId || !floorId || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error("mapId、floorId、x、y、width、height 都是必填");
  }
  if (Math.abs(width) < 3 || Math.abs(height) < 3) throw new Error("框選範圍太小");
  const left = Math.min(x, x + width);
  const top = Math.min(y, y + height);
  const zone = {
    id: safeId(body.id || `route-zone-${mapId}-${floorId}-${Date.now()}-${Math.round(left)}-${Math.round(top)}`),
    mapId,
    floorId,
    zoneType,
    x: left,
    y: top,
    width: Math.abs(width),
    height: Math.abs(height),
    label: String(body.label || zoneTypeLabel(zoneType)).trim(),
    source: "admin",
    createdAt: new Date().toISOString(),
  };
  const graph = readGraph();
  graph.zones = mergeById(graph.zones, [zone]);
  writeGraph(graph);
  return { success: true, zone };
}

function updateRouteZone(zoneId, body) {
  const id = String(zoneId || body.id || "").trim();
  if (!id) return null;
  const existing = readRouteZones().find((item) => item.id === id);
  if (!existing) return null;
  const next = normalizeZone({
    ...existing,
    zoneType: body.zoneType || body.type || existing.zoneType,
    x: body.x ?? existing.x,
    y: body.y ?? existing.y,
    width: body.width ?? existing.width,
    height: body.height ?? existing.height,
    label: body.label ?? existing.label,
    updatedAt: new Date().toISOString(),
  });
  const graph = readGraph();
  graph.zones = mergeById(graph.zones, [next]);
  writeGraph(graph);
  return { success: true, zone: next };
}

function deleteRouteZone(zoneId) {
  const id = String(zoneId || "").trim();
  if (!id) return null;
  const graph = readGraph();
  const zone = readRouteZones().find((item) => item.id === id);
  if (!zone) return null;
  graph.zones = graph.zones.filter((item) => item.id !== id);
  graph.deletedZoneIds = Array.from(new Set(graph.deletedZoneIds.concat(id)));
  graph.undoStack.push({ type: "zone", zone });
  writeGraph(graph);
  return { success: true, zoneId: id };
}

function normalizeZone(zone) {
  const x = Number(zone.x);
  const y = Number(zone.y);
  const width = Number(zone.width);
  const height = Number(zone.height);
  const left = Math.min(x, x + width);
  const top = Math.min(y, y + height);
  return {
    ...zone,
    zoneType: normalizeZoneType(zone.zoneType || zone.type),
    x: left,
    y: top,
    width: Math.abs(width),
    height: Math.abs(height),
    label: String(zone.label || zoneTypeLabel(zone.zoneType)).trim(),
  };
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

function createRouteNode(body) {
  const mapId = String(body.mapId || "").trim();
  const floorId = String(body.floorId || "").trim();
  const point = normalizePoint(body);
  if (!mapId || !floorId || !point) throw new Error("mapId、floorId、x、y 都是必填");
  const graph = readGraph();
  const node = {
    id: safeId(body.id || `route-node-${mapId}-${floorId}-${Date.now()}-${Math.round(point.x)}-${Math.round(point.y)}`),
    mapId,
    floorId,
    x: point.x,
    y: point.y,
    nodeType: String(body.nodeType || "walkway").trim(),
    label: String(body.label || "路線點").trim(),
    isWalkable: true,
    source: "admin",
    createdAt: new Date().toISOString(),
  };
  graph.nodes = mergeById(graph.nodes, [node]);
  writeGraph(graph);
  return { success: true, node };
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
  const existingNodes = mergeById(baseRouteNodes(), graph.nodes).filter((node) => node.mapId === mapId && node.floorId === floorId);
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

function deleteRouteEdge(edgeId) {
  const id = String(edgeId || "").trim();
  if (!id) return null;
  const graph = readGraph();
  const edge = readRouteEdges().find((item) => item.id === id);
  if (!edge) return null;
  graph.edges = graph.edges.filter((item) => item.id !== id);
  graph.deletedEdgeIds = Array.from(new Set(graph.deletedEdgeIds.concat(id)));
  graph.undoStack.push({ type: "edge", edge });
  writeGraph(graph);
  return { success: true, deleted: true, edgeId: id };
}

function deleteRouteNode(nodeId) {
  const id = String(nodeId || "").trim();
  if (!id) return null;
  const graph = readGraph();
  const node = readRouteNodes().find((item) => item.id === id);
  if (!node) return null;
  const connectedEdges = readRouteEdges().filter((edge) => edge.fromNodeId === id || edge.toNodeId === id);
  graph.nodes = graph.nodes.filter((item) => item.id !== id);
  graph.edges = graph.edges.filter((edge) => edge.fromNodeId !== id && edge.toNodeId !== id);
  graph.transitions = graph.transitions.filter((transition) => transition.fromNodeId !== id && transition.toNodeId !== id);
  graph.deletedNodeIds = Array.from(new Set(graph.deletedNodeIds.concat(id)));
  graph.deletedEdgeIds = Array.from(new Set(graph.deletedEdgeIds.concat(connectedEdges.map((edge) => edge.id))));
  graph.undoStack.push({ type: "node", node, edges: connectedEdges });
  writeGraph(graph);
  return { success: true, nodeId: id };
}

function clearRouteGraphForFloor(mapIdValue, floorIdValue) {
  const mapId = String(mapIdValue || "").trim();
  const floorId = String(floorIdValue || "").trim();
  if (!mapId || !floorId) throw new Error("mapId、floorId 都是必填");
  const nodes = readRouteNodes().filter((node) => node.mapId === mapId && node.floorId === floorId);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = readRouteEdges().filter((edge) => edge.mapId === mapId && edge.floorId === floorId);
  const transitionsToRemove = readFloorTransitions().filter((transition) => {
    if (transition.mapId !== mapId) return false;
    return nodeIds.has(transition.fromNodeId) || nodeIds.has(transition.toNodeId) ||
      transition.fromFloorId === floorId || transition.toFloorId === floorId;
  });
  const graph = readGraph();
  graph.nodes = graph.nodes.filter((node) => !(node.mapId === mapId && node.floorId === floorId));
  graph.edges = graph.edges.filter((edge) => !(edge.mapId === mapId && edge.floorId === floorId));
  graph.transitions = graph.transitions.filter((transition) => !transitionsToRemove.some((item) => item.id === transition.id));
  graph.deletedNodeIds = Array.from(new Set(graph.deletedNodeIds.concat(nodes.map((node) => node.id))));
  graph.deletedEdgeIds = Array.from(new Set(graph.deletedEdgeIds.concat(edges.map((edge) => edge.id))));
  graph.undoStack.push({
    type: "clear-floor-route-graph",
    mapId,
    floorId,
    nodes,
    edges,
    transitions: transitionsToRemove,
  });
  writeGraph(graph);
  return {
    success: true,
    mapId,
    floorId,
    deletedNodes: nodes.length,
    deletedEdges: edges.length,
    deletedTransitions: transitionsToRemove.length,
  };
}

function restoreLastDeleted() {
  const graph = readGraph();
  const action = graph.undoStack.pop();
  if (!action) return null;
  if (action.type === "node") {
    graph.deletedNodeIds = graph.deletedNodeIds.filter((id) => id !== action.node.id);
    graph.deletedEdgeIds = graph.deletedEdgeIds.filter((id) => !(action.edges || []).some((edge) => edge.id === id));
    if (action.node.source === "admin") graph.nodes = mergeById(graph.nodes, [action.node]);
    (action.edges || []).filter((edge) => edge.source === "admin").forEach((edge) => {
      graph.edges = mergeById(graph.edges, [edge]);
    });
  }
  if (action.type === "edge") {
    graph.deletedEdgeIds = graph.deletedEdgeIds.filter((id) => id !== action.edge.id);
    if (action.edge.source === "admin") graph.edges = mergeById(graph.edges, [action.edge]);
  }
  if (action.type === "zone") {
    graph.deletedZoneIds = graph.deletedZoneIds.filter((id) => id !== action.zone.id);
    if (action.zone.source === "admin") graph.zones = mergeById(graph.zones, [action.zone]);
  }
  if (action.type === "clear-floor-route-graph") {
    graph.deletedNodeIds = graph.deletedNodeIds.filter((id) => !(action.nodes || []).some((node) => node.id === id));
    graph.deletedEdgeIds = graph.deletedEdgeIds.filter((id) => !(action.edges || []).some((edge) => edge.id === id));
    (action.nodes || []).filter((node) => node.source === "admin").forEach((node) => {
      graph.nodes = mergeById(graph.nodes, [node]);
    });
    (action.edges || []).filter((edge) => edge.source === "admin").forEach((edge) => {
      graph.edges = mergeById(graph.edges, [edge]);
    });
    (action.transitions || []).filter((transition) => transition.source === "admin").forEach((transition) => {
      graph.transitions = mergeById(graph.transitions, [transition]);
    });
  }
  writeGraph(graph);
  return { success: true, restored: action.type };
}

function createFloorTransition(body) {
  const mapId = String(body.mapId || "").trim();
  const fromNodeId = String(body.fromNodeId || "").trim();
  const toNodeId = String(body.toNodeId || "").trim();
  const transitionType = String(body.transitionType || "escalator").trim();
  const name = String(body.name || "樓層連接點").trim();
  const nodes = readRouteNodes();
  const from = nodes.find((node) => node.id === fromNodeId && node.mapId === mapId);
  const to = nodes.find((node) => node.id === toNodeId && node.mapId === mapId);
  if (!mapId || !from || !to) throw new Error("請選擇同一地圖內的兩個節點");
  if (from.floorId === to.floorId) throw new Error("連接點必須連到不同樓層");
  const graph = readGraph();
  const transition = {
    id: safeId(body.id || `transition-${mapId}-${fromNodeId}-${toNodeId}`),
    mapId,
    fromFloorId: from.floorId,
    toFloorId: to.floorId,
    fromNodeId,
    toNodeId,
    transitionType,
    name,
    source: "admin",
    createdAt: new Date().toISOString(),
  };
  const records = [transition];
  if (body.bidirectional !== false) {
    records.push({
      id: safeId(`${transition.id}-back`),
      mapId,
      fromFloorId: to.floorId,
      toFloorId: from.floorId,
      fromNodeId: toNodeId,
      toNodeId: fromNodeId,
      transitionType,
      name,
      source: "admin",
      pairedTransitionId: transition.id,
      createdAt: transition.createdAt,
    });
  }
  graph.transitions = mergeById(graph.transitions, records);
  writeGraph(graph);
  return { success: true, transitions: records };
}

function deleteFloorTransition(transitionId) {
  const id = String(transitionId || "").trim();
  if (!id) return null;
  const graph = readGraph();
  const target = graph.transitions.find((transition) => transition.id === id);
  const pairedId = target?.pairedTransitionId || id;
  const before = graph.transitions.length;
  graph.transitions = graph.transitions.filter((transition) => transition.id !== id && transition.id !== pairedId && transition.pairedTransitionId !== id && transition.pairedTransitionId !== pairedId);
  if (graph.transitions.length === before) return null;
  writeGraph(graph);
  return { success: true, transitionId: id };
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
  if (!fs.existsSync(graphPath)) return emptyGraph();
  const raw = fs.readFileSync(graphPath, "utf8").trim();
  if (!raw) return emptyGraph();
  const parsed = JSON.parse(raw);
  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    transitions: Array.isArray(parsed.transitions) ? parsed.transitions : [],
    zones: Array.isArray(parsed.zones) ? parsed.zones : [],
    deletedNodeIds: Array.isArray(parsed.deletedNodeIds) ? parsed.deletedNodeIds : [],
    deletedEdgeIds: Array.isArray(parsed.deletedEdgeIds) ? parsed.deletedEdgeIds : [],
    deletedZoneIds: Array.isArray(parsed.deletedZoneIds) ? parsed.deletedZoneIds : [],
    undoStack: Array.isArray(parsed.undoStack) ? parsed.undoStack : [],
  };
}

function writeGraph(graph) {
  ensureDataDir();
  fs.writeFileSync(graphPath, JSON.stringify({
    nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph.edges) ? graph.edges : [],
    transitions: Array.isArray(graph.transitions) ? graph.transitions : [],
    zones: Array.isArray(graph.zones) ? graph.zones : [],
    deletedNodeIds: Array.isArray(graph.deletedNodeIds) ? graph.deletedNodeIds : [],
    deletedEdgeIds: Array.isArray(graph.deletedEdgeIds) ? graph.deletedEdgeIds : [],
    deletedZoneIds: Array.isArray(graph.deletedZoneIds) ? graph.deletedZoneIds : [],
    undoStack: Array.isArray(graph.undoStack) ? graph.undoStack : [],
  }, null, 2), "utf8");
}

function emptyGraph() {
  return { nodes: [], edges: [], transitions: [], zones: [], deletedNodeIds: [], deletedEdgeIds: [], deletedZoneIds: [], undoStack: [] };
}

function demoRouteGraphEnabled() {
  return String(process.env.ENABLE_DEMO_ROUTE_GRAPH || "").toLowerCase() === "true";
}

function baseRouteNodes() {
  return demoRouteGraphEnabled() ? routeNodes : [];
}

function baseRouteEdges() {
  return demoRouteGraphEnabled() ? routeEdges : [];
}

function baseFloorTransitions() {
  return demoRouteGraphEnabled() ? floorTransitions : [];
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

function normalizeZoneType(value) {
  const type = String(value || "").trim();
  if (["walkable", "blocked", "caution"].includes(type)) return type;
  if (["green", "綠色", "可走"].includes(type)) return "walkable";
  if (["red", "紅色", "禁入"].includes(type)) return "blocked";
  if (["orange", "橘色", "待確認"].includes(type)) return "caution";
  return "walkable";
}

function zoneTypeLabel(zoneType) {
  if (zoneType === "blocked") return "不可進入區";
  if (zoneType === "caution") return "待確認區";
  return "可走區";
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  clearRouteGraphForFloor,
  createFloorTransition,
  createRouteZone,
  createRouteNode,
  createRouteSegment,
  deleteFloorTransition,
  deleteRouteEdge,
  deleteRouteNode,
  deleteRouteZone,
  readFloorTransitions,
  readRouteEdges,
  readRouteNodes,
  readRouteZones,
  restoreLastDeleted,
  setRouteEdgeBlocked,
  updateRouteZone,
};
