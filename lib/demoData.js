const maps = [
  {
    id: "tkut-demo",
    name: "淡江大學淡水校園 Demo",
    description: "第一階段 Demo 場域，用校園模擬地下街找地點、找設施、找路線與回到原位置等情境。",
  },
];

const floors = [
  {
    id: "tkut-demo-ground",
    mapId: "tkut-demo",
    floorName: "校園平面",
    floorLevel: 1,
    imageUrl: null,
    width: 1200,
    height: 800,
    scaleValue: 1,
  },
  {
    id: "tkut-demo-second",
    mapId: "tkut-demo",
    floorName: "Demo 二樓",
    floorLevel: 2,
    imageUrl: null,
    width: 1200,
    height: 800,
    scaleValue: 1,
  },
];

const places = [
  { id: "place-main-gate", mapId: "tkut-demo", floorId: "tkut-demo-ground", name: "校門口", category: "入口", x: 120, y: 680, description: "Demo 入口與集合點。", searchable: true, businessStatus: "unset" },
  { id: "place-library", mapId: "tkut-demo", floorId: "tkut-demo-ground", name: "圖書館", category: "設施", x: 520, y: 330, description: "大型地標與目的地。", searchable: true, businessStatus: "unset" },
  { id: "place-engineering", mapId: "tkut-demo", floorId: "tkut-demo-ground", name: "工學大樓", category: "建築", x: 790, y: 360, description: "Demo 建築目的地。", searchable: true, businessStatus: "unset" },
  { id: "place-restroom-a", mapId: "tkut-demo", floorId: "tkut-demo-ground", name: "公共廁所 A", category: "廁所", x: 430, y: 420, description: "模擬地下街設施搜尋。", searchable: true, businessStatus: "unset" },
  { id: "place-parking-a", mapId: "tkut-demo", floorId: "tkut-demo-ground", name: "停車區 A", category: "停車場", x: 250, y: 570, description: "模擬找停車位與回到停車位置。", searchable: true, businessStatus: "unset" },
  { id: "place-service-desk", mapId: "tkut-demo", floorId: "tkut-demo-ground", name: "服務台", category: "服務台", x: 610, y: 500, description: "模擬地下街服務設施。", searchable: true, businessStatus: "unset" },
  { id: "place-second-office", mapId: "tkut-demo", floorId: "tkut-demo-second", name: "二樓辦公室", category: "辦公室", x: 610, y: 300, description: "跨樓層導航 Demo 目的地。", searchable: true, businessStatus: "unset" },
];

const routeNodes = [
  { id: "node-main-gate", mapId: "tkut-demo", floorId: "tkut-demo-ground", x: 120, y: 680, nodeType: "entrance", isWalkable: true },
  { id: "node-parking-a", mapId: "tkut-demo", floorId: "tkut-demo-ground", x: 250, y: 570, nodeType: "walkway", isWalkable: true },
  { id: "node-cross-a", mapId: "tkut-demo", floorId: "tkut-demo-ground", x: 390, y: 500, nodeType: "walkway", isWalkable: true },
  { id: "node-restroom-a", mapId: "tkut-demo", floorId: "tkut-demo-ground", x: 430, y: 420, nodeType: "facility", isWalkable: true },
  { id: "node-service-desk", mapId: "tkut-demo", floorId: "tkut-demo-ground", x: 610, y: 500, nodeType: "facility", isWalkable: true },
  { id: "node-library", mapId: "tkut-demo", floorId: "tkut-demo-ground", x: 520, y: 330, nodeType: "building", isWalkable: true },
  { id: "node-engineering", mapId: "tkut-demo", floorId: "tkut-demo-ground", x: 790, y: 360, nodeType: "building", isWalkable: true },
  { id: "node-elevator-1f", mapId: "tkut-demo", floorId: "tkut-demo-ground", x: 610, y: 500, nodeType: "elevator", isWalkable: true },
  { id: "node-elevator-2f", mapId: "tkut-demo", floorId: "tkut-demo-second", x: 610, y: 500, nodeType: "elevator", isWalkable: true },
  { id: "node-second-office", mapId: "tkut-demo", floorId: "tkut-demo-second", x: 610, y: 300, nodeType: "office", isWalkable: true },
];

const routeEdges = [
  { id: "edge-main-parking", mapId: "tkut-demo", floorId: "tkut-demo-ground", fromNodeId: "node-main-gate", toNodeId: "node-parking-a", distance: 170, isBlocked: false },
  { id: "edge-parking-cross", mapId: "tkut-demo", floorId: "tkut-demo-ground", fromNodeId: "node-parking-a", toNodeId: "node-cross-a", distance: 170, isBlocked: false },
  { id: "edge-cross-restroom", mapId: "tkut-demo", floorId: "tkut-demo-ground", fromNodeId: "node-cross-a", toNodeId: "node-restroom-a", distance: 90, isBlocked: false },
  { id: "edge-cross-service", mapId: "tkut-demo", floorId: "tkut-demo-ground", fromNodeId: "node-cross-a", toNodeId: "node-service-desk", distance: 220, isBlocked: false },
  { id: "edge-restroom-library", mapId: "tkut-demo", floorId: "tkut-demo-ground", fromNodeId: "node-restroom-a", toNodeId: "node-library", distance: 130, isBlocked: false },
  { id: "edge-service-engineering", mapId: "tkut-demo", floorId: "tkut-demo-ground", fromNodeId: "node-service-desk", toNodeId: "node-engineering", distance: 230, isBlocked: false },
  { id: "edge-library-engineering", mapId: "tkut-demo", floorId: "tkut-demo-ground", fromNodeId: "node-library", toNodeId: "node-engineering", distance: 280, isBlocked: false },
  { id: "edge-elevator-office", mapId: "tkut-demo", floorId: "tkut-demo-second", fromNodeId: "node-elevator-2f", toNodeId: "node-second-office", distance: 200, isBlocked: false },
];

const floorTransitions = [
  { id: "transition-main-elevator-up", mapId: "tkut-demo", fromFloorId: "tkut-demo-ground", toFloorId: "tkut-demo-second", fromNodeId: "node-elevator-1f", toNodeId: "node-elevator-2f", transitionType: "elevator", name: "主要電梯" },
  { id: "transition-main-elevator-down", mapId: "tkut-demo", fromFloorId: "tkut-demo-second", toFloorId: "tkut-demo-ground", fromNodeId: "node-elevator-2f", toNodeId: "node-elevator-1f", transitionType: "elevator", name: "主要電梯" },
];

module.exports = {
  floors,
  maps,
  places,
  floorTransitions,
  routeEdges,
  routeNodes,
};
