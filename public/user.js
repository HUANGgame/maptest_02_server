const i18n = {
  zh: {
    appTitle: "台北車站地下街拍照定位",
    waiting: "等待定位",
    photoHelp: "拍攝牆上的固定地圖後，系統會比對已校正的地圖點位，更新手機地圖與目前座標。",
    currentFloorHint: "目前樓層提示",
    destinationFloor: "目的樓層",
    destination: "目的地",
    photoMap: "拍攝牆上地圖",
    locateByPhoto: "拍照定位",
    reroute: "重新規劃",
    testPoint: "測試點位",
    publicNote: "這是使用者介面，不含管理員功能。若拍照定位失敗，代表該牆面地圖尚未由管理員校正。",
    noFloorHint: "不指定",
    serverDown: "Server 無法連線。請確認已啟動 npm.cmd start。",
    choosePhoto: "請先拍攝或選擇一張牆上地圖照片。",
    analyzing: "正在分析照片...",
    located: "定位成功",
    failed: "拍照定位失敗",
    routeFailed: "路線規劃失敗",
    routeTo: "沿著路線前往",
    goVertical: "請先前往電梯 / 樓梯，再移動到",
    distance: "距離約",
    path: "路徑",
    confidence: "信心",
    manual: "手動座標",
    test: "測試座標",
    source: "比對方式",
    coordinate: "座標"
  },
  en: {
    appTitle: "Taipei Station Underground Photo Navigation",
    waiting: "Waiting for location",
    photoHelp: "Take a photo of a fixed wall map. The system matches it with calibrated map boards and updates your phone map position.",
    currentFloorHint: "Current floor hint",
    destinationFloor: "Destination floor",
    destination: "Destination",
    photoMap: "Photo of wall map",
    locateByPhoto: "Locate by Photo",
    reroute: "Reroute",
    testPoint: "Test Point",
    publicNote: "This is the visitor interface. Admin tools are separated. If photo location fails, the wall map has not been calibrated yet.",
    noFloorHint: "No hint",
    serverDown: "Server is unavailable. Please make sure npm.cmd start is running.",
    choosePhoto: "Please take or choose a wall-map photo first.",
    analyzing: "Analyzing photo...",
    located: "Located",
    failed: "Photo location failed",
    routeFailed: "Route planning failed",
    routeTo: "Follow the route to",
    goVertical: "Go to Elevator / Stairs first, then move to",
    distance: "Distance about",
    path: "Path",
    confidence: "confidence",
    manual: "Manual coordinate",
    test: "Test coordinate",
    source: "Match method",
    coordinate: "Coordinate"
  }
};

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const langSelect = document.getElementById("langSelect");
const floorSelect = document.getElementById("floorSelect");
const destFloor = document.getElementById("destFloor");
const destPlace = document.getElementById("destPlace");
const photoInput = document.getElementById("photoInput");
const locateBtn = document.getElementById("locateBtn");
const routeBtn = document.getElementById("routeBtn");
const testBtn = document.getElementById("testBtn");
const statusBox = document.getElementById("statusBox");
const mapBadge = document.getElementById("mapBadge");
const routeHint = document.getElementById("routeHint");
const sessionId = localStorage.getItem("mapSessionId") || crypto.randomUUID();
localStorage.setItem("mapSessionId", sessionId);

let lang = localStorage.getItem("lang") || "zh";
let config = null;
let currentFloor = "B1";
let currentPosition = { x: 545, y: 360 };
let currentBoard = null;
let routeData = null;

langSelect.value = lang;
langSelect.addEventListener("change", () => {
  lang = langSelect.value;
  localStorage.setItem("lang", lang);
  applyI18n();
  fillSelects();
  updateRouteText();
});

function t(key) {
  return i18n[lang][key] || i18n.zh[key] || key;
}

function label(item) {
  return lang === "en" ? item.labelEn || item.nameEn || item.labelZh || item.nameZh : item.labelZh || item.nameZh || item.labelEn || item.nameEn;
}

function applyI18n() {
  document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
  document.querySelectorAll("[data-i18n]").forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
}

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

async function init() {
  applyI18n();
  try {
    const health = await api("/api/health");
    config = await api("/api/config");
    canvas.width = config.canvas.width;
    canvas.height = config.canvas.height;
    fillSelects();
    statusBox.textContent = `${health.message}\nSession: ${sessionId}`;
    draw();
    await requestRoute("init");
  } catch (error) {
    statusBox.textContent = `${t("serverDown")}\n${error.message}`;
  }
}

function fillSelects() {
  if (!config) return;
  floorSelect.innerHTML = `<option value="">${t("noFloorHint")}</option>` + Object.values(config.floors)
    .map(floor => `<option value="${floor.id}" ${floor.id === currentFloor ? "selected" : ""}>${lang === "en" ? floor.nameEn : floor.nameZh}</option>`).join("");
  destFloor.innerHTML = Object.values(config.floors)
    .map(floor => `<option value="${floor.id}" ${floor.id === currentFloor ? "selected" : ""}>${lang === "en" ? floor.nameEn : floor.nameZh}</option>`).join("");
  destPlace.innerHTML = Object.entries(config.places)
    .map(([id, place]) => `<option value="${id}" ${id === "M3" ? "selected" : ""}>${label(place)}</option>`).join("");
}

function draw() {
  if (!config) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBase();
  drawRoute();
  drawBoards();
  drawAccessPoints();
  drawPosition();
  requestAnimationFrame(draw);
}

function drawBase() {
  ctx.fillStyle = "#eef4f3";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#c4ced8";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [a, b] of config.graphEdges) {
    ctx.beginPath();
    ctx.moveTo(config.graphNodes[a].x, config.graphNodes[a].y);
    ctx.lineTo(config.graphNodes[b].x, config.graphNodes[b].y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#7e8a98";
  ctx.lineWidth = 2;
  for (const node of Object.values(config.graphNodes)) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const place of Object.values(config.places)) {
    ctx.fillStyle = place.node === "ELEVATOR" ? "#7c3aed" : "#d99a22";
    ctx.beginPath();
    ctx.arc(place.x, place.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1f2933";
    ctx.font = "bold 16px Microsoft JhengHei, Arial";
    ctx.fillText(label(place), place.x + 14, place.y - 10);
  }
  ctx.fillStyle = "rgba(31, 41, 51, .14)";
  ctx.font = "bold 66px Microsoft JhengHei, Arial";
  const floor = config.floors[currentFloor];
  ctx.fillText(floor ? (lang === "en" ? floor.nameEn : floor.nameZh) : currentFloor, 42, 92);
}

function drawBoards() {
  for (const board of config.mapBoards.filter(item => item.floor === currentFloor)) {
    ctx.save();
    ctx.translate(board.x, board.y);
    ctx.rotate((Number(board.heading || 0) - 90) * Math.PI / 180);
    ctx.fillStyle = board.id === currentBoard?.boardId ? "#0f766e" : "#2f5f9f";
    ctx.fillRect(-15, -10, 30, 20);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-9, -5, 18, 10);
    ctx.restore();
    ctx.fillStyle = "#1f2933";
    ctx.font = "13px Microsoft JhengHei, Arial";
    ctx.fillText(board.id, board.x + 18, board.y + 5);
  }
}

function drawAccessPoints() {
  for (const ap of config.accessPoints.filter(item => item.floor === currentFloor)) {
    ctx.strokeStyle = "rgba(180, 83, 9, .45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ap.x, ap.y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.arc(ap.x, ap.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPosition() {
  ctx.fillStyle = "rgba(220, 38, 38, .18)";
  ctx.beginPath();
  ctx.arc(currentPosition.x, currentPosition.y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(currentPosition.x, currentPosition.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawRoute() {
  if (!routeData?.path?.length) return;
  const path = [currentPosition, ...routeData.path, routeData.destination];
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i += 1) ctx.lineTo(path[i].x, path[i].y);
  ctx.stroke();
}

async function imageHash(file) {
  const bitmap = await createImageBitmap(file);
  const side = 16;
  const offscreen = document.createElement("canvas");
  offscreen.width = side;
  offscreen.height = side;
  const tiny = offscreen.getContext("2d", { willReadFrequently: true });
  tiny.drawImage(bitmap, 0, 0, side, side);
  const data = tiny.getImageData(0, 0, side, side).data;
  const values = [];
  for (let i = 0; i < data.length; i += 4) values.push(Math.round(data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114));
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.map(value => value >= avg ? "1" : "0").join("");
}

async function locateFromPhoto() {
  const file = photoInput.files[0];
  if (!file) {
    statusBox.textContent = t("choosePhoto");
    return;
  }
  statusBox.textContent = t("analyzing");
  try {
    const photoHash = await imageHash(file);
    const data = await api("/api/location/photo", {
      method: "POST",
      body: JSON.stringify({ sessionId, floor: floorSelect.value, photoHash, userAgent: navigator.userAgent })
    });
    currentBoard = data.location;
    currentFloor = data.location.floor;
    currentPosition = { x: data.location.x, y: data.location.y };
    mapBadge.textContent = `${t("located")}: ${lang === "en" ? data.location.boardNameEn : data.location.boardNameZh}, ${t("confidence")} ${Math.round(data.location.confidence * 100)}%`;
    statusBox.textContent = `${t("located")}\n${t("coordinate")}: x=${data.location.x}, y=${data.location.y}\n${t("source")}: ${data.location.source}`;
    fillSelects();
    await requestRoute("photo-location");
  } catch (error) {
    statusBox.textContent = `${t("failed")}: ${error.message}`;
  }
}

async function requestRoute(reason) {
  try {
    routeData = await api("/api/route", {
      method: "POST",
      body: JSON.stringify({ sessionId, currentFloor, destFloor: destFloor.value, destPlace: destPlace.value, position: currentPosition, reason })
    });
    updateRouteText();
  } catch (error) {
    routeData = null;
    routeHint.textContent = `${t("routeFailed")}: ${error.message}`;
  }
}

function updateRouteText() {
  if (!routeData || !config) return;
  const dest = routeData.destination;
  const floor = config.floors[routeData.destFloor];
  const intro = routeData.sameFloor ? `${t("routeTo")} ${label(dest)}.` : `${t("goVertical")} ${lang === "en" ? floor.nameEn : floor.nameZh}.`;
  routeHint.innerHTML = `${intro}<br>${t("distance")} ${routeData.totalDistance}px, ${t("path")}: ${routeData.pathKeys.join(" -> ")}`;
}

locateBtn.addEventListener("click", locateFromPhoto);
routeBtn.addEventListener("click", () => requestRoute("manual"));
destFloor.addEventListener("change", () => requestRoute("destination-floor"));
destPlace.addEventListener("change", () => requestRoute("destination-place"));
floorSelect.addEventListener("change", () => {
  if (floorSelect.value) currentFloor = floorSelect.value;
  requestRoute("floor-hint");
});
testBtn.addEventListener("click", () => {
  currentFloor = floorSelect.value || "B1";
  currentPosition = { x: 380 + Math.random() * 360, y: 280 + Math.random() * 230 };
  mapBadge.textContent = `${t("test")}: x=${currentPosition.x.toFixed(0)}, y=${currentPosition.y.toFixed(0)}`;
  requestRoute("test");
});
canvas.addEventListener("click", event => {
  const rect = canvas.getBoundingClientRect();
  currentPosition = {
    x: Math.round((event.clientX - rect.left) / rect.width * canvas.width),
    y: Math.round((event.clientY - rect.top) / rect.height * canvas.height)
  };
  mapBadge.textContent = `${t("manual")}: x=${currentPosition.x}, y=${currentPosition.y}`;
  requestRoute("map-click");
});

init();
