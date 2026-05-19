const i18n = {
  zh: {
    appTitle: "\u53f0\u5317\u8eca\u7ad9\u5730\u4e0b\u8857\u62cd\u7167\u5b9a\u4f4d",
    waiting: "\u7b49\u5f85\u62cd\u7167\u5b9a\u4f4d",
    photoHelp: "\u62cd\u651d\u7246\u4e0a\u56fa\u5b9a\u5730\u5716\u5f8c\uff0c\u7cfb\u7d71\u6703\u81ea\u52d5\u5207\u63db\u5e95\u5716\u3001\u66f4\u65b0\u5ea7\u6a19\u3001AP/IP \u8207\u8def\u7dda\u3002",
    destinationFloor: "\u76ee\u7684\u6a13\u5c64",
    destinationCategory: "\u76ee\u7684\u5730\u5206\u985e",
    destinationSearch: "\u8f38\u5165\u5730\u9ede",
    destinationSearchPlaceholder: "\u4f8b\uff1aM3\u3001Y\u5340\u3001\u52d5\u6f2b\u3001\u7f8e\u98df\u3001\u5ec1\u6240\u3001\u96fb\u68af",
    destination: "\u76ee\u7684\u5730",
    photoMap: "\u62cd\u651d\u7246\u4e0a\u5730\u5716",
    locateByPhoto: "\u62cd\u7167\u5b9a\u4f4d",
    publicNote: "\u62cd\u7167\u6210\u529f\u5f8c\u6703\u76f4\u63a5\u66f4\u65b0\u5e95\u5716\u3001\u6b63\u78ba\u5ea7\u6a19\u3001AP/IP \u548c\u65b9\u5411\u7bad\u982d\u8def\u7dda\u3002",
    centerCurrent: "\u56de\u5230\u76ee\u524d\u4f4d\u7f6e",
    serverDown: "Server \u7121\u6cd5\u9023\u7dda\u3002",
    choosePhoto: "\u8acb\u5148\u62cd\u651d\u6216\u9078\u64c7\u4e00\u5f35\u7246\u4e0a\u5730\u5716\u7167\u7247\u3002",
    analyzing: "\u6b63\u5728\u5206\u6790\u7167\u7247...",
    located: "\u5b9a\u4f4d\u6210\u529f",
    failed: "\u62cd\u7167\u5b9a\u4f4d\u5931\u6557",
    routeFailed: "\u8def\u7dda\u898f\u5283\u5931\u6557",
    routeTo: "\u6cbf\u8457\u7bad\u982d\u8def\u7dda\u524d\u5f80",
    goVertical: "\u8acb\u5148\u524d\u5f80\u96fb\u68af / \u6a13\u68af\uff0c\u518d\u79fb\u52d5\u5230",
    distance: "\u8ddd\u96e2\u7d04",
    path: "\u8def\u5f91",
    confidence: "\u4fe1\u5fc3",
    coordinate: "\u5ea7\u6a19",
    floor: "\u6a13\u5c64",
    board: "\u7246\u9762\u5730\u5716",
    apIp: "AP/IP",
    ssid: "SSID",
    noAp: "\u672a\u627e\u5230\u540c\u6a13\u5c64 AP/IP",
    autoUpdated: "\u5df2\u81ea\u52d5\u66f4\u65b0\u5e95\u5716\u8207\u8def\u7dda",
    matchedDestination: "\u5df2\u8fa8\u8b58\u76ee\u7684\u5730",
    noDestinationMatch: "\u627e\u4e0d\u5230\u76ee\u7684\u5730\uff0c\u8acb\u8a66\u8a66 M3\u3001Y\u5340\u3001\u7f8e\u98df\u3001\u5ec1\u6240\u7b49\u95dc\u9375\u5b57",
    gps: "GPS",
    gpsWaiting: "\u7b49\u5f85 GPS \u6b0a\u9650\u6216\u8cc7\u6599",
    gpsUnavailable: "GPS \u7121\u6cd5\u4f7f\u7528",
    view: "\u8996\u91ce"
  },
  en: {
    appTitle: "Taipei Station Underground Photo Navigation",
    waiting: "Waiting for photo location",
    photoHelp: "Take a photo of a fixed wall map. The base map, coordinates, AP/IP, and route update automatically.",
    destinationFloor: "Destination floor",
    destinationCategory: "Destination category",
    destinationSearch: "Search destination",
    destinationSearchPlaceholder: "e.g. M3, Y area, anime, food, restroom, elevator",
    destination: "Destination",
    photoMap: "Photo of wall map",
    locateByPhoto: "Locate by Photo",
    publicNote: "After a successful photo match, the base map, accurate coordinates, AP/IP, and arrow route update automatically.",
    centerCurrent: "Center current",
    serverDown: "Server is unavailable.",
    choosePhoto: "Please take or choose a wall-map photo first.",
    analyzing: "Analyzing photo...",
    located: "Located",
    failed: "Photo location failed",
    routeFailed: "Route planning failed",
    routeTo: "Follow the arrow route to",
    goVertical: "Go to Elevator / Stairs first, then move to",
    distance: "Distance about",
    path: "Path",
    confidence: "confidence",
    coordinate: "Coordinate",
    floor: "Floor",
    board: "Wall map",
    apIp: "AP/IP",
    ssid: "SSID",
    noAp: "No AP/IP found on this floor",
    autoUpdated: "Base map and route updated",
    matchedDestination: "Destination recognized",
    noDestinationMatch: "No destination matched. Try M3, Y area, food, restroom, or elevator.",
    gps: "GPS",
    gpsWaiting: "Waiting for GPS permission or data",
    gpsUnavailable: "GPS unavailable",
    view: "View"
  }
};

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const langSelect = document.getElementById("langSelect");
const categorySelect = document.getElementById("categorySelect");
const destinationSearch = document.getElementById("destinationSearch");
const destinationSuggestions = document.getElementById("destinationSuggestions");
const destFloor = document.getElementById("destFloor");
const destPlace = document.getElementById("destPlace");
const photoInput = document.getElementById("photoInput");
const locateBtn = document.getElementById("locateBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const centerBtn = document.getElementById("centerBtn");
const statusBox = document.getElementById("statusBox");
const locationBox = document.getElementById("locationBox");
const mapBadge = document.getElementById("mapBadge");
const routeHint = document.getElementById("routeHint");
const sessionId = localStorage.getItem("mapSessionId") || crypto.randomUUID();
localStorage.setItem("mapSessionId", sessionId);

let lang = localStorage.getItem("lang") || "zh";
let config = null;
let currentFloor = "B1";
let currentPosition = { x: 545, y: 360 };
let currentBoard = null;
let currentAccessPoint = null;
let routeData = null;
let currentCategory = "all";
let searchTimer = null;
let latestGps = null;
let view = { scale: 1, x: 0, y: 0 };
let dragging = false;
let dragStart = { x: 0, y: 0, viewX: 0, viewY: 0 };
let lastTouchDistance = null;
let lastTouchCenter = null;

const floorStyles = {
  B1: { bg: "#edf7f3", band: "#cde7df", label: "#0f766e" },
  B2: { bg: "#eef4ff", band: "#cfdef8", label: "#2f5f9f" },
  B3: { bg: "#fff4e8", band: "#f7d8af", label: "#b45309" }
};

langSelect.value = lang;
langSelect.addEventListener("change", () => {
  lang = langSelect.value;
  localStorage.setItem("lang", lang);
  applyI18n();
  fillSelects();
  updateLocationText();
  updateRouteText();
});

function t(key) {
  return i18n[lang][key] || i18n.zh[key] || key;
}

function text(item, key = "label") {
  if (!item) return "";
  if (lang === "en") return item[`${key}En`] || item.nameEn || item[`${key}Zh`] || item.nameZh || item.id || "";
  return item[`${key}Zh`] || item.nameZh || item[`${key}En`] || item.nameEn || item.id || "";
}

function applyI18n() {
  document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
  document.querySelectorAll("[data-i18n]").forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(node => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
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
    updateLocationText();
    statusBox.textContent = `${health.message}\nSession: ${sessionId}`;
    draw();
    await requestRoute("init");
  } catch (error) {
    statusBox.textContent = `${t("serverDown")}\n${error.message}`;
  }
}

function fillSelects() {
  if (!config) return;
  categorySelect.innerHTML = config.destinationCategories
    .map(category => `<option value="${category.id}" ${category.id === currentCategory ? "selected" : ""}>${lang === "en" ? category.labelEn : category.labelZh}</option>`)
    .join("");
  destFloor.innerHTML = Object.values(config.floors)
    .map(floor => `<option value="${floor.id}" ${floor.id === currentFloor ? "selected" : ""}>${lang === "en" ? floor.nameEn : floor.nameZh}</option>`)
    .join("");
  const places = filteredPlaces();
  const selected = places.some(([id]) => id === destPlace.value) ? destPlace.value : (places[0]?.[0] || "M3");
  destPlace.innerHTML = places
    .map(([id, place]) => `<option value="${id}" ${id === selected ? "selected" : ""}>${text(place)}</option>`)
    .join("");
  destPlace.value = selected;
  destinationSuggestions.innerHTML = Object.entries(config.places)
    .map(([id, place]) => {
      const aliases = (place.aliases || []).slice(0, 4).join(", ");
      return `<option value="${escapeHtml(text(place))}" label="${escapeHtml(`${id}${aliases ? ` / ${aliases}` : ""}`)}"></option>`;
    })
    .join("");
}

function filteredPlaces() {
  const entries = Object.entries(config.places);
  if (currentCategory === "all") return entries;
  return entries.filter(([, place]) => place.category === currentCategory);
}

function draw() {
  if (!config) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.scale, view.scale);
  drawBaseMap();
  drawRoute();
  drawBoards();
  drawAccessPoints();
  drawPosition();
  ctx.restore();
  requestAnimationFrame(draw);
}

function drawBaseMap() {
  const style = floorStyles[currentFloor] || floorStyles.B1;
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = style.band;
  ctx.fillRect(0, 0, canvas.width, 112);
  ctx.fillRect(0, canvas.height - 74, canvas.width, 74);

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
    ctx.fillText(text(place), place.x + 14, place.y - 10);
  }

  const floor = config.floors[currentFloor];
  ctx.fillStyle = style.label;
  ctx.font = "bold 48px Microsoft JhengHei, Arial";
  ctx.fillText(floor ? (lang === "en" ? floor.nameEn : floor.nameZh) : currentFloor, 38, 72);
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
    const active = currentAccessPoint && ap.id === currentAccessPoint.id;
    ctx.strokeStyle = active ? "rgba(15, 118, 110, .75)" : "rgba(180, 83, 9, .45)";
    ctx.lineWidth = active ? 4 : 2;
    ctx.beginPath();
    ctx.arc(ap.x, ap.y, active ? 30 : 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = active ? "#0f766e" : "#b45309";
    ctx.beginPath();
    ctx.arc(ap.x, ap.y, active ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPosition() {
  const radiusScale = 1 / Math.sqrt(view.scale);
  ctx.fillStyle = "rgba(220, 38, 38, .18)";
  ctx.beginPath();
  ctx.arc(currentPosition.x, currentPosition.y, 30 * radiusScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(currentPosition.x, currentPosition.y, 10 * radiusScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3 * radiusScale;
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

  for (let i = 1; i < path.length; i += 1) {
    const from = path[i - 1];
    const to = path[i];
    drawArrow(from, to, "#064e3b");
  }
}

function drawArrow(from, to, color) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 35) return;
  const angle = Math.atan2(dy, dx);
  const x = from.x + dx * 0.66;
  const y = from.y + dy * 0.66;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function clampView() {
  const rect = canvas.getBoundingClientRect();
  const minScale = 0.75;
  const maxScale = 4;
  view.scale = Math.max(minScale, Math.min(maxScale, view.scale));
  const scaledW = canvas.width * view.scale;
  const scaledH = canvas.height * view.scale;
  const minX = Math.min(0, rect.width - scaledW);
  const minY = Math.min(0, rect.height - scaledH);
  view.x = Math.max(minX - 80, Math.min(80, view.x));
  view.y = Math.max(minY - 80, Math.min(80, view.y));
}

function screenToMap(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = (clientX - rect.left) * (canvas.width / rect.width);
  const sy = (clientY - rect.top) * (canvas.height / rect.height);
  return {
    x: (sx - view.x) / view.scale,
    y: (sy - view.y) / view.scale,
    sx,
    sy
  };
}

function zoomAt(factor, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const fallbackX = rect.left + rect.width / 2;
  const fallbackY = rect.top + rect.height / 2;
  const point = screenToMap(clientX ?? fallbackX, clientY ?? fallbackY);
  const oldScale = view.scale;
  view.scale = Math.max(0.75, Math.min(4, view.scale * factor));
  view.x = point.sx - point.x * view.scale;
  view.y = point.sy - point.y * view.scale;
  clampView();
  if (oldScale !== view.scale) updateLocationText();
}

function centerOnCurrent() {
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width / 2 * (canvas.width / rect.width);
  const sy = rect.height / 2 * (canvas.height / rect.height);
  view.x = sx - currentPosition.x * view.scale;
  view.y = sy - currentPosition.y * view.scale;
  clampView();
  updateLocationText();
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
  for (let i = 0; i < data.length; i += 4) {
    values.push(Math.round(data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114));
  }
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
      body: JSON.stringify({ sessionId, floor: currentFloor, photoHash, userAgent: navigator.userAgent })
    });
    currentBoard = data.location;
    currentFloor = data.location.floor;
    currentPosition = { x: data.location.x, y: data.location.y };
    currentAccessPoint = data.location.accessPoint || null;
    destFloor.value = currentFloor;
    fillSelects();
    destFloor.value = currentFloor;
    mapBadge.textContent = `${t("located")}: ${lang === "en" ? data.location.boardNameEn : data.location.boardNameZh}`;
    statusBox.textContent = `${t("autoUpdated")}\n${t("confidence")}: ${Math.round(data.location.confidence * 100)}%`;
    updateLocationText();
    await requestRoute("photo-location");
  } catch (error) {
    statusBox.textContent = `${t("failed")}: ${error.message}`;
  }
}

async function requestRoute(reason) {
  try {
    routeData = await api("/api/route", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        currentFloor,
        destFloor: destFloor.value,
        destPlace: destPlace.value,
        position: currentPosition,
        reason
      })
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
  const intro = routeData.sameFloor
    ? `${t("routeTo")} ${text(dest)}.`
    : `${t("goVertical")} ${lang === "en" ? floor.nameEn : floor.nameZh}.`;
  routeHint.innerHTML = `${intro}<br>${t("distance")} ${routeData.totalDistance}px, ${t("path")}: ${routeData.pathKeys.join(" -> ")}`;
}

function updateLocationText() {
  const floor = config?.floors?.[currentFloor];
  const floorName = floor ? (lang === "en" ? floor.nameEn : floor.nameZh) : currentFloor;
  const boardName = currentBoard ? (lang === "en" ? currentBoard.boardNameEn : currentBoard.boardNameZh) : "-";
  const ap = currentAccessPoint;
  locationBox.innerHTML = [
    `<strong>${t("floor")}:</strong> ${floorName}`,
    `<strong>${t("coordinate")}:</strong> x=${Math.round(currentPosition.x)}, y=${Math.round(currentPosition.y)}`,
    `<strong>${t("board")}:</strong> ${boardName}`,
    ap
      ? `<strong>${t("apIp")}:</strong> ${ap.name} / ${ap.ip}<br><strong>${t("ssid")}:</strong> ${ap.ssid}`
      : `<strong>${t("apIp")}:</strong> ${t("noAp")}`,
    `<strong>${t("gps")}:</strong> ${formatGps()}`,
    `<strong>${t("view")}:</strong> ${Math.round(view.scale * 100)}%`
  ].join("<br>");
}

function formatGps() {
  if (!latestGps) return t("gpsWaiting");
  if (latestGps.error) return `${t("gpsUnavailable")}: ${latestGps.error}`;
  return `${latestGps.lat.toFixed(6)}, ${latestGps.lon.toFixed(6)} (${Math.round(latestGps.accuracy)}m)`;
}

function startGpsWatch() {
  if (!navigator.geolocation) {
    latestGps = { error: "not supported" };
    updateLocationText();
    return;
  }
  navigator.geolocation.watchPosition(
    position => {
      latestGps = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      updateLocationText();
    },
    error => {
      latestGps = { error: error.message || String(error.code) };
      updateLocationText();
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
  );
}

locateBtn.addEventListener("click", locateFromPhoto);
zoomInBtn.addEventListener("click", () => zoomAt(1.25));
zoomOutBtn.addEventListener("click", () => zoomAt(0.8));
centerBtn.addEventListener("click", centerOnCurrent);
photoInput.addEventListener("change", () => {
  if (photoInput.files[0]) locateFromPhoto();
});
destFloor.addEventListener("change", () => requestRoute("destination-floor"));
categorySelect.addEventListener("change", () => {
  currentCategory = categorySelect.value;
  fillSelects();
  requestRoute("destination-category");
});
destinationSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(resolveDestinationSearch, 280);
});
destinationSearch.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    clearTimeout(searchTimer);
    resolveDestinationSearch();
  }
});
destPlace.addEventListener("change", () => requestRoute("destination-place"));
canvas.addEventListener("wheel", event => {
  event.preventDefault();
  zoomAt(event.deltaY < 0 ? 1.12 : 0.9, event.clientX, event.clientY);
}, { passive: false });

canvas.addEventListener("pointerdown", event => {
  dragging = true;
  dragStart = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", event => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  view.x = dragStart.viewX + (event.clientX - dragStart.x) * scaleX;
  view.y = dragStart.viewY + (event.clientY - dragStart.y) * scaleY;
  clampView();
  updateLocationText();
});

canvas.addEventListener("pointerup", event => {
  dragging = false;
  try { canvas.releasePointerCapture(event.pointerId); } catch {}
});

canvas.addEventListener("pointercancel", () => {
  dragging = false;
});

canvas.addEventListener("touchstart", event => {
  if (event.touches.length === 2) {
    lastTouchDistance = touchDistance(event.touches);
    lastTouchCenter = touchCenter(event.touches);
  }
}, { passive: true });

canvas.addEventListener("touchmove", event => {
  if (event.touches.length !== 2 || !lastTouchDistance || !lastTouchCenter) return;
  event.preventDefault();
  const nextDistance = touchDistance(event.touches);
  const nextCenter = touchCenter(event.touches);
  zoomAt(nextDistance / lastTouchDistance, nextCenter.x, nextCenter.y);
  const rect = canvas.getBoundingClientRect();
  view.x += (nextCenter.x - lastTouchCenter.x) * (canvas.width / rect.width);
  view.y += (nextCenter.y - lastTouchCenter.y) * (canvas.height / rect.height);
  clampView();
  lastTouchDistance = nextDistance;
  lastTouchCenter = nextCenter;
  updateLocationText();
}, { passive: false });

canvas.addEventListener("touchend", () => {
  lastTouchDistance = null;
  lastTouchCenter = null;
}, { passive: true });

function touchDistance(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

function touchCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

async function resolveDestinationSearch() {
  const query = destinationSearch.value.trim();
  if (!query) return;
  try {
    const result = await api("/api/destination/resolve", {
      method: "POST",
      body: JSON.stringify({ query })
    });
    const match = result.best;
    currentCategory = match.category || "all";
    fillSelects();
    destPlace.value = match.id;
    destinationSearch.value = text(match);
    statusBox.textContent = `${t("matchedDestination")}: ${text(match)}`;
    await requestRoute("destination-search");
  } catch {
    statusBox.textContent = t("noDestinationMatch");
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

init();
startGpsWatch();
