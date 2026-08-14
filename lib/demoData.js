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

maps.push({
  id: "coordinate-demo",
  name: "座標標註平面圖 Demo",
  description: "Demo 階段使用標註座標平面圖，模擬地下街出口、樓梯與可通行路線。",
});

floors.push({
  id: "coordinate-demo-f1",
  mapId: "coordinate-demo",
  floorName: "平面圖 1F",
  floorLevel: 1,
  imageUrl: "/maps/coordinate_demo_floor_1.png",
  width: 1989,
  height: 621,
  scaleValue: 1,
  imageLeft: 0,
  imageTop: 0,
  imageWidth: 1989,
  imageHeight: 621,
  imageNaturalWidth: 1989,
  imageNaturalHeight: 621,
  coordinateUnit: "pixel",
  mapHeadingOffsetDegrees: 0,
});

places.push(
  { id: "coordinate-exit-west", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", name: "西側出口", category: "出口", x: 20, y: 282, description: "左側主走道連接點，作為出口模擬。", searchable: true, businessStatus: "unset" },
  { id: "coordinate-exit-east", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", name: "東側出口", category: "出口", x: 1970, y: 282, description: "右側主走道連接點，作為出口模擬。", searchable: true, businessStatus: "unset" },
  { id: "coordinate-exit-south-west", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", name: "西南出口", category: "出口", x: 225, y: 600, description: "下方左側垂直通道，作為出口或跨區連接點模擬。", searchable: true, businessStatus: "unset" },
  { id: "coordinate-exit-south-middle", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", name: "中段出口", category: "出口", x: 988, y: 600, description: "下方中段垂直通道，作為出口或跨區連接點模擬。", searchable: true, businessStatus: "unset" },
  { id: "coordinate-exit-south-east", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", name: "東南出口", category: "出口", x: 1735, y: 600, description: "下方右側垂直通道，作為出口或跨區連接點模擬。", searchable: true, businessStatus: "unset" },
  { id: "coordinate-stairs-north", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", name: "北側樓梯", category: "樓梯", x: 1138, y: 135, description: "上方窄通道暫定為樓梯或樓層連接點。", searchable: true, businessStatus: "unset" },
  { id: "coordinate-stairs-south-west", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", name: "西南樓梯", category: "樓梯", x: 225, y: 445, description: "下方左側窄通道暫定為樓梯。", searchable: true, businessStatus: "unset" },
  { id: "coordinate-stairs-south-east", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", name: "東南樓梯", category: "樓梯", x: 1735, y: 445, description: "下方右側窄通道暫定為樓梯。", searchable: true, businessStatus: "unset" },
  { id: "coordinate-store-01", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", name: "店鋪 1", category: "商店", x: 1761, y: 97, description: "依圖面標號建立的示範店鋪。", searchable: true, businessStatus: "unset" },
  { id: "coordinate-store-28", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", name: "店鋪 28", category: "商店", x: 1585, y: 263, description: "依圖面標號建立的示範店鋪。", searchable: true, businessStatus: "unset" },
  { id: "coordinate-store-35", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", name: "店鋪 35", category: "商店", x: 453, y: 315, description: "依圖面標號建立的示範店鋪。", searchable: true, businessStatus: "unset" }
);

routeNodes.push(
  { id: "coordinate-node-west-exit", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 20, y: 282, nodeType: "entrance", isWalkable: true },
  { id: "coordinate-node-main-west", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 225, y: 282, nodeType: "walkway", isWalkable: true },
  { id: "coordinate-node-main-left", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 520, y: 282, nodeType: "walkway", isWalkable: true },
  { id: "coordinate-node-main-center", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 880, y: 282, nodeType: "walkway", isWalkable: true },
  { id: "coordinate-node-main-north", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 1138, y: 282, nodeType: "walkway", isWalkable: true },
  { id: "coordinate-node-main-right", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 1500, y: 282, nodeType: "walkway", isWalkable: true },
  { id: "coordinate-node-east-exit", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 1970, y: 282, nodeType: "entrance", isWalkable: true },
  { id: "coordinate-node-south-west", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 225, y: 445, nodeType: "stairs", isWalkable: true },
  { id: "coordinate-node-south-west-exit", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 225, y: 600, nodeType: "entrance", isWalkable: true },
  { id: "coordinate-node-south-middle", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 988, y: 445, nodeType: "walkway", isWalkable: true },
  { id: "coordinate-node-south-middle-exit", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 988, y: 600, nodeType: "entrance", isWalkable: true },
  { id: "coordinate-node-south-east", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 1735, y: 445, nodeType: "stairs", isWalkable: true },
  { id: "coordinate-node-south-east-exit", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 1735, y: 600, nodeType: "entrance", isWalkable: true },
  { id: "coordinate-node-north-stairs", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 1138, y: 135, nodeType: "stairs", isWalkable: true },
  { id: "coordinate-node-store-01", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 1761, y: 135, nodeType: "shop", isWalkable: true },
  { id: "coordinate-node-store-28", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 1585, y: 282, nodeType: "shop", isWalkable: true },
  { id: "coordinate-node-store-35", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", x: 453, y: 282, nodeType: "shop", isWalkable: true }
);

routeEdges.push(
  { id: "coordinate-edge-west-main", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-west-exit", toNodeId: "coordinate-node-main-west", distance: 205, isBlocked: false },
  { id: "coordinate-edge-main-west-left", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-west", toNodeId: "coordinate-node-main-left", distance: 295, isBlocked: false },
  { id: "coordinate-edge-main-left-center", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-left", toNodeId: "coordinate-node-main-center", distance: 360, isBlocked: false },
  { id: "coordinate-edge-main-center-north", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-center", toNodeId: "coordinate-node-main-north", distance: 258, isBlocked: false },
  { id: "coordinate-edge-main-north-right", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-north", toNodeId: "coordinate-node-main-right", distance: 362, isBlocked: false },
  { id: "coordinate-edge-main-right-east", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-right", toNodeId: "coordinate-node-east-exit", distance: 470, isBlocked: false },
  { id: "coordinate-edge-south-west", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-west", toNodeId: "coordinate-node-south-west", distance: 163, isBlocked: false },
  { id: "coordinate-edge-south-west-exit", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-south-west", toNodeId: "coordinate-node-south-west-exit", distance: 155, isBlocked: false },
  { id: "coordinate-edge-south-middle", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-center", toNodeId: "coordinate-node-south-middle", distance: 195, isBlocked: false },
  { id: "coordinate-edge-south-middle-exit", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-south-middle", toNodeId: "coordinate-node-south-middle-exit", distance: 155, isBlocked: false },
  { id: "coordinate-edge-south-east", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-right", toNodeId: "coordinate-node-south-east", distance: 286, isBlocked: false },
  { id: "coordinate-edge-south-east-exit", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-south-east", toNodeId: "coordinate-node-south-east-exit", distance: 155, isBlocked: false },
  { id: "coordinate-edge-north-stairs", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-north", toNodeId: "coordinate-node-north-stairs", distance: 147, isBlocked: false },
  { id: "coordinate-edge-store-01", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-right", toNodeId: "coordinate-node-store-01", distance: 300, isBlocked: false },
  { id: "coordinate-edge-store-28", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-right", toNodeId: "coordinate-node-store-28", distance: 85, isBlocked: false },
  { id: "coordinate-edge-store-35", mapId: "coordinate-demo", floorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-main-left", toNodeId: "coordinate-node-store-35", distance: 67, isBlocked: false }
);

module.exports = {
  floors,
  maps,
  places,
  floorTransitions,
  routeEdges,
  routeNodes,
};
