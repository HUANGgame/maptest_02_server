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
  name: "K區模擬跨地圖",
  description: "Demo 模擬資料，可用來展示地下街標點、出口、樓梯、數字點與跨樓層導航。",
});

floors.push(
  {
    id: "coordinate-demo-f1",
    mapId: "coordinate-demo",
    floorName: "K區 1F",
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
  },
  {
    id: "coordinate-demo-f2",
    mapId: "coordinate-demo",
    floorName: "出口連接層 2F",
    floorLevel: 2,
    imageUrl: null,
    width: 1989,
    height: 621,
    scaleValue: 1,
    coordinateUnit: "pixel",
    mapHeadingOffsetDegrees: 0,
  }
);

const coordinateNumberPoints = [
  [1, 1761, 97], [2, 1897, 480], [3, 1818, 480], [4, 1639, 480], [5, 1548, 480], [6, 1417, 479],
  [7, 1362, 480], [8, 1306, 480], [9, 1136, 478], [10, 1136, 545], [11, 840, 480], [12, 729, 480],
  [13, 564, 480], [14, 445, 480], [15, 900, 321], [16, 127, 480], [17, 476, 161], [18, 685, 161],
  [19, 742, 161], [20, 799, 161], [21, 856, 161], [22, 1139, 97], [23, 1280, 97], [24, 1376, 97],
  [25, 1496, 97], [26, 1617, 97], [27, 1690, 97], [28, 1583, 263], [29, 1423, 247], [30, 1271, 288],
  [31, 1194, 280], [32, 1139, 249], [33, 827, 314], [34, 742, 314], [35, 449, 315], [36, 1601, 318],
];

const coordinateSecondFloorPoints = [
  [101, 300, 250], [102, 560, 250], [103, 820, 250], [104, 1080, 250], [105, 1340, 250], [106, 1600, 250],
];

const coordinateExits = [
  ["west", "西側出口", 20, 282],
  ["east", "東側出口", 1970, 282],
  ["south-west", "西南出口", 225, 600],
  ["south-middle", "中段出口", 988, 600],
  ["south-east", "東南出口", 1735, 600],
];

const coordinateStairs = [
  ["north", "北側樓梯", 1138, 135, 1138, 210],
  ["south-west", "西南樓梯", 225, 445, 300, 390],
  ["south-east", "東南樓梯", 1735, 445, 1600, 390],
];

places.push(
  ...coordinateNumberPoints.map(([number, x, y]) => ({
    id: `coordinate-number-${number}`,
    mapId: "coordinate-demo",
    floorId: "coordinate-demo-f1",
    name: String(number),
    category: "標點",
    x,
    y,
    description: "圖片上標示的數字點，供 Demo 搜尋與導航使用。",
    searchable: true,
    businessStatus: "unset",
  })),
  ...coordinateSecondFloorPoints.map(([number, x, y]) => ({
    id: `coordinate-number-${number}`,
    mapId: "coordinate-demo",
    floorId: "coordinate-demo-f2",
    name: String(number),
    category: "標點",
    x,
    y,
    description: "跨樓層 Demo 的模擬數字點，可隨時刪除。",
    searchable: true,
    businessStatus: "unset",
  })),
  ...coordinateExits.map(([key, name, x, y]) => ({
    id: `coordinate-exit-${key}`,
    mapId: "coordinate-demo",
    floorId: "coordinate-demo-f1",
    name,
    category: "出口",
    x,
    y,
    description: "依圖面開口建立的模擬出口。",
    searchable: true,
    businessStatus: "unset",
  })),
  ...coordinateStairs.map(([key, name, x, y]) => ({
    id: `coordinate-stairs-${key}`,
    mapId: "coordinate-demo",
    floorId: "coordinate-demo-f1",
    name,
    category: "樓梯",
    x,
    y,
    description: "依圖面連接通道建立的模擬樓梯。",
    searchable: true,
    businessStatus: "unset",
  }))
);

const coordinateWalkwayNodes = [
  ["west-exit", 20, 282, "entrance"], ["main-west", 225, 282, "walkway"], ["main-left", 520, 282, "walkway"],
  ["main-center", 880, 282, "walkway"], ["main-north", 1138, 282, "walkway"], ["main-right", 1500, 282, "walkway"],
  ["east-exit", 1970, 282, "entrance"], ["south-west", 225, 445, "stairs"], ["south-west-exit", 225, 600, "entrance"],
  ["south-middle", 988, 445, "walkway"], ["south-middle-exit", 988, 600, "entrance"], ["south-east", 1735, 445, "stairs"],
  ["south-east-exit", 1735, 600, "entrance"], ["north-stairs", 1138, 135, "stairs"],
];

const coordinateWalkwayEdges = [
  ["west-exit", "main-west"], ["main-west", "main-left"], ["main-left", "main-center"], ["main-center", "main-north"],
  ["main-north", "main-right"], ["main-right", "east-exit"], ["main-west", "south-west"], ["south-west", "south-west-exit"],
  ["main-center", "south-middle"], ["south-middle", "south-middle-exit"], ["main-right", "south-east"], ["south-east", "south-east-exit"],
  ["main-north", "north-stairs"],
];

routeNodes.push(
  ...coordinateWalkwayNodes.map(([key, x, y, nodeType]) => ({
    id: `coordinate-node-${key}`,
    mapId: "coordinate-demo",
    floorId: "coordinate-demo-f1",
    x,
    y,
    nodeType,
    isWalkable: true,
  })),
  ...coordinateNumberPoints.map(([number, x, y]) => ({
    id: `coordinate-node-number-${number}`,
    mapId: "coordinate-demo",
    floorId: "coordinate-demo-f1",
    x,
    y,
    nodeType: "marker",
    isWalkable: true,
  })),
  ...coordinateSecondFloorPoints.map(([number, x, y]) => ({
    id: `coordinate-node-number-${number}`,
    mapId: "coordinate-demo",
    floorId: "coordinate-demo-f2",
    x,
    y,
    nodeType: "marker",
    isWalkable: true,
  })),
  { id: "coordinate-node-f2-stairs", mapId: "coordinate-demo", floorId: "coordinate-demo-f2", x: 300, y: 390, nodeType: "stairs", isWalkable: true }
);

routeEdges.push(
  ...coordinateWalkwayEdges.map(([from, to]) => ({
    id: `coordinate-edge-${from}-${to}`,
    mapId: "coordinate-demo",
    floorId: "coordinate-demo-f1",
    fromNodeId: `coordinate-node-${from}`,
    toNodeId: `coordinate-node-${to}`,
    distance: Math.round(Math.hypot(
      coordinateWalkwayNodes.find(([key]) => key === from)[1] - coordinateWalkwayNodes.find(([key]) => key === to)[1],
      coordinateWalkwayNodes.find(([key]) => key === from)[2] - coordinateWalkwayNodes.find(([key]) => key === to)[2]
    )),
    isBlocked: false,
  })),
  ...coordinateNumberPoints.map(([number, x, y]) => {
    const nearest = coordinateWalkwayNodes
      .map(([key, nodeX, nodeY]) => ({ key, distance: Math.hypot(x - nodeX, y - nodeY) }))
      .sort((left, right) => left.distance - right.distance)[0];
    return {
      id: `coordinate-edge-number-${number}`,
      mapId: "coordinate-demo",
      floorId: "coordinate-demo-f1",
      fromNodeId: `coordinate-node-number-${number}`,
      toNodeId: `coordinate-node-${nearest.key}`,
      distance: Math.round(nearest.distance),
      isBlocked: false,
    };
  }),
  ...coordinateSecondFloorPoints.map(([number, x, y], index) => ({
    id: `coordinate-edge-number-${number}`,
    mapId: "coordinate-demo",
    floorId: "coordinate-demo-f2",
    fromNodeId: `coordinate-node-number-${number}`,
    toNodeId: index === 0 ? "coordinate-node-f2-stairs" : `coordinate-node-number-${coordinateSecondFloorPoints[index - 1][0]}`,
    distance: Math.round(index === 0 ? Math.hypot(x - 300, y - 390) : Math.hypot(x - coordinateSecondFloorPoints[index - 1][1], y - coordinateSecondFloorPoints[index - 1][2])),
    isBlocked: false,
  }))
);

floorTransitions.push(
  { id: "coordinate-transition-up", mapId: "coordinate-demo", fromFloorId: "coordinate-demo-f1", toFloorId: "coordinate-demo-f2", fromNodeId: "coordinate-node-south-west", toNodeId: "coordinate-node-f2-stairs", transitionType: "stairs", name: "西南樓梯" },
  { id: "coordinate-transition-down", mapId: "coordinate-demo", fromFloorId: "coordinate-demo-f2", toFloorId: "coordinate-demo-f1", fromNodeId: "coordinate-node-f2-stairs", toNodeId: "coordinate-node-south-west", transitionType: "stairs", name: "西南樓梯" }
);

module.exports = {
  floors,
  maps,
  places,
  floorTransitions,
  routeEdges,
  routeNodes,
};
