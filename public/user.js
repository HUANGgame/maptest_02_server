const i18n = {
  zh: {
    appTitle: "淡江校園 Wi-Fi 定位導覽 Demo",
    waiting: "等待 Wi-Fi 定位",
    photoHelp: "請先按 Wi-Fi 定位；路線會用 A* 自動繞過障礙物。",
    destinationFloor: "\u76ee\u7684\u6a13\u5c64",
    destinationCategory: "\u76ee\u7684\u5730\u5206\u985e",
    destinationSearch: "\u8f38\u5165\u6216\u9078\u64c7\u76ee\u7684\u5730",
    destinationSearchPlaceholder: "例：圖書館、活動中心、商管、工學館、公車站、克難坡",
    clearDestination: "\u6e05\u9664",
    destination: "\u76ee\u7684\u5730",
    wifiScan: "Wi-Fi 指紋由後台維護",
    wifiScanPlaceholder: "",
    locateByWifi: "Wi-Fi 定位",
    wifiLocated: "Wi-Fi 定位成功",
    objectPhoto: "圖片物品搜尋 Demo",
    objectDetected: "圖片辨識結果",
    saveParking: "記住車位",
    returnStart: "回到起點",
    returnParking: "回到停車位",
    parkingSaved: "已記住停車位",
    historyTitle: "歷史導航",
    noParking: "尚未記住停車位",
    centerCurrent: "\u56de\u5230\u76ee\u524d\u4f4d\u7f6e",
    serverDown: "Server \u7121\u6cd5\u9023\u7dda\u3002",
    located: "\u5b9a\u4f4d\u6210\u529f",
    failed: "\u64cd\u4f5c\u5931\u6557",
    routeFailed: "\u8def\u7dda\u898f\u5283\u5931\u6557",
    routeTo: "\u6cbf\u8457\u7bad\u982d\u8def\u7dda\u524d\u5f80",
    goVertical: "\u8acb\u5148\u524d\u5f80\u96fb\u68af / \u6a13\u68af\uff0c\u518d\u79fb\u52d5\u5230",
    switchFloor: "\u6211\u5df2\u5230\u9054\uff0c\u5207\u63db\u6a13\u5c64",
    distance: "\u8ddd\u96e2\u7d04",
    meters: "\u516c\u5c3a",
    futureSteps: "\u5c55\u958b\u4e4b\u5f8c\u6b65\u9a5f",
    currentInstruction: "\u73fe\u5728\u8acb",
    learningUpdated: "\u5df2\u5b78\u7fd2\u9019\u6bb5\u53ef\u901a\u884c\u8def\u5f91",
    path: "\u8def\u5f91",
    confidence: "\u4fe1\u5fc3",
    coordinate: "\u5ea7\u6a19",
    floor: "\u6a13\u5c64",
    board: "\u7246\u9762\u5730\u5716",
    baseMap: "\u76ee\u524d\u5e95\u5716",
    baseMapSwitched: "\u5df2\u5207\u63db\u5230\u5c0d\u61c9\u5e95\u5716",
    apIp: "AP/IP",
    ssid: "SSID",
    noAp: "\u672a\u627e\u5230\u540c\u6a13\u5c64 AP/IP",
    autoUpdated: "\u5df2\u81ea\u52d5\u66f4\u65b0\u5e95\u5716\u8207\u8def\u7dda",
    matchedDestination: "\u5df2\u8fa8\u8b58\u76ee\u7684\u5730",
    noDestinationMatch: "找不到目的地，請試試圖書館、活動中心、商管、工學館、公車站等關鍵字",
    motion: "步數 / 方向",
    motionActive: "手機步數與方向輔助定位中",
    motionUnavailable: "此瀏覽器未提供步數與方向資料",
    locationSource: "\u5b9a\u4f4d\u4f86\u6e90",
    sourceDefault: "\u9810\u8a2d\u4f4d\u7f6e",
    view: "\u8996\u91ce",
    skipToControls: "\u8df3\u5230\u64cd\u4f5c\u5340",
    audioHelp: "\u8a9e\u97f3\u5c0e\u89bd\u5df2\u5c31\u7dd2\u3002\u9078\u64c7\u76ee\u7684\u5730\u5f8c\uff0c\u6309 Wi-Fi \u5b9a\u4f4d\uff0c\u624b\u6a5f\u6b65\u6578\u8207\u65b9\u5411\u6703\u8f14\u52a9\u66f4\u65b0\u8def\u7dda\u3002",
    voiceOn: "\u5c0e\u822a\u8a9e\u97f3\u958b",
    voiceOff: "\u5c0e\u822a\u8a9e\u97f3\u95dc",
    readLocation: "\u6717\u8b80\u4f4d\u7f6e",
    readRoute: "\u6717\u8b80\u8def\u7dda",
    stopVoice: "\u505c\u6b62\u6717\u8b80",
    speakCurrentStep: "\u6717\u8b80\u4e0b\u4e00\u6b65",
    repeatAll: "\u91cd\u8907\u5168\u90e8\u5c0e\u89bd",
    voiceEnabled: "\u8a9e\u97f3\u5c0e\u89bd\u5df2\u958b\u555f",
    voiceDisabled: "\u8a9e\u97f3\u5c0e\u89bd\u5df2\u95dc\u9589",
    voiceQuietHint: "\u5c0e\u822a\u8a9e\u97f3\u53ea\u6703\u5728\u5b9a\u4f4d\u3001\u8def\u7dda\u8b8a\u66f4\u6216\u932f\u8aa4\u6642\u63d0\u793a\uff0c\u4e0d\u6703\u5e72\u64fe\u4e00\u822c\u64cd\u4f5c\u3002\u4e0d\u9700\u8981\u6642\u53ef\u4ee5\u6309\u5c0e\u822a\u8a9e\u97f3\u95dc\u3002",
    voiceUnsupported: "\u9019\u500b\u700f\u89bd\u5668\u4e0d\u652f\u63f4\u8a9e\u97f3\u6717\u8b80",
    mapKeyboardHelp: "\u5730\u5716\u53ef\u4ee5\u7528\u9375\u76e4\u64cd\u4f5c\uff1a\u65b9\u5411\u9375\u79fb\u52d5\uff0c\u52a0\u865f\u653e\u5927\uff0c\u6e1b\u865f\u7e2e\u5c0f\uff0c\u6578\u5b57 0 \u56de\u5230\u76ee\u524d\u4f4d\u7f6e\u3002",
    currentStep: "\u76ee\u524d\u5c0e\u822a",
    noRouteYet: "\u5c1a\u672a\u7522\u751f\u8def\u7dda\u3002\u8acb\u5148\u9078\u64c7\u76ee\u7684\u5730\u4e26\u6309 Wi-Fi \u5b9a\u4f4d\u3002",
    arrivedNear: "\u4f60\u5df2\u63a5\u8fd1\u76ee\u7684\u5730",
    nextToward: "\u8acb\u671d\u4e0b\u4e00\u500b\u7bad\u982d\u65b9\u5411\u524d\u9032\uff0c\u524d\u5f80",
    routeReady: "\u8def\u7dda\u5df2\u66f4\u65b0",
    directionStraight: "\u76f4\u8d70",
    directionSlightRight: "\u5f80\u53f3\u524d\u65b9",
    directionRight: "\u5f80\u53f3\u908a",
    directionBackRight: "\u5f80\u53f3\u5f8c\u65b9",
    directionBack: "\u8acb\u56de\u982d",
    directionBackLeft: "\u5f80\u5de6\u5f8c\u65b9",
    directionLeft: "\u5f80\u5de6\u908a",
    directionSlightLeft: "\u5f80\u5de6\u524d\u65b9",
    nextDirection: "\u4e0b\u4e00\u6b65\u65b9\u5411",
    vibrationReady: "\u624b\u6a5f\u6b65\u6578\u8207\u65b9\u5411\u8f14\u52a9\u5df2\u6e96\u5099",
  },
  en: {
    appTitle: "Tamkang Campus Wi-Fi Navigation Demo",
    waiting: "Waiting for Wi-Fi location",
    photoHelp: "Press Wi-Fi location first. A* will route around obstacles.",
    destinationFloor: "Destination floor",
    destinationCategory: "Destination category",
    destinationSearch: "Search or choose destination",
    destinationSearchPlaceholder: "e.g. library, activity center, business, engineering, bus stop",
    clearDestination: "Clear",
    destination: "Destination",
    wifiScan: "Wi-Fi fingerprints are maintained in admin",
    wifiScanPlaceholder: "",
    locateByWifi: "Locate by Wi-Fi",
    wifiLocated: "Wi-Fi location succeeded",
    objectPhoto: "Image object search demo",
    objectDetected: "Detected image intent",
    saveParking: "Save parking",
    returnStart: "Return to start",
    returnParking: "Return to parking",
    parkingSaved: "Parking location saved",
    historyTitle: "Navigation history",
    noParking: "No parking location saved",
    centerCurrent: "Center current",
    serverDown: "Server is unavailable.",
    located: "Located",
    failed: "Action failed",
    routeFailed: "Route planning failed",
    routeTo: "Follow the arrow route to",
    goVertical: "Go to Elevator / Stairs first, then move to",
    switchFloor: "I arrived. Switch floor",
    distance: "Distance about",
    meters: "m",
    futureSteps: "Show later steps",
    currentInstruction: "Now",
    learningUpdated: "This walkable path was learned",
    path: "Path",
    confidence: "confidence",
    coordinate: "Coordinate",
    floor: "Floor",
    board: "Wall map",
    baseMap: "Current base map",
    baseMapSwitched: "Switched to matched base map",
    apIp: "AP/IP",
    ssid: "SSID",
    noAp: "No AP/IP found on this floor",
    autoUpdated: "Base map and route updated",
    matchedDestination: "Destination recognized",
    noDestinationMatch: "No destination matched. Try library, activity center, business, engineering, or bus stop.",
    motion: "Steps / heading",
    motionActive: "Phone step and heading assistance is active",
    motionUnavailable: "This browser does not provide step or heading data",
    locationSource: "Location source",
    sourceDefault: "Default location",
    view: "View",
    skipToControls: "Skip to controls",
    audioHelp: "Voice guidance is ready. Choose a destination, press Wi-Fi location, and phone steps will assist route updates.",
    voiceOn: "Navigation voice on",
    voiceOff: "Navigation voice off",
    readLocation: "Read location",
    readRoute: "Read route",
    stopVoice: "Stop voice",
    speakCurrentStep: "Speak current step",
    repeatAll: "Repeat all guidance",
    voiceEnabled: "Voice guidance is on",
    voiceDisabled: "Voice guidance is off",
    voiceQuietHint: "Navigation voice only speaks for location, route changes, and errors, so it will not interrupt normal use. Turn it off when it is not needed.",
    voiceUnsupported: "This browser does not support speech output",
    mapKeyboardHelp: "The map supports keyboard controls: arrow keys move the map, plus zooms in, minus zooms out, and zero returns to current position.",
    currentStep: "Current navigation",
    noRouteYet: "No route yet. Choose a destination and press Wi-Fi location first.",
    arrivedNear: "You are near the destination",
    nextToward: "Follow the next arrow toward",
    routeReady: "Route updated",
    directionStraight: "go straight",
    directionSlightRight: "go slightly right",
    directionRight: "turn right",
    directionBackRight: "turn back right",
    directionBack: "turn around",
    directionBackLeft: "turn back left",
    directionLeft: "turn left",
    directionSlightLeft: "go slightly left",
    nextDirection: "Next direction",
    vibrationReady: "Phone step and heading assistance is ready",
  }
};

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const tileLayer = document.getElementById("tileLayer");
const langSelect = document.getElementById("langSelect");
const categorySelect = document.getElementById("categorySelect");
const destinationSearch = document.getElementById("destinationSearch");
const destinationSuggestions = document.getElementById("destinationSuggestions");
const clearDestinationBtn = document.getElementById("clearDestinationBtn");
const destPlace = document.getElementById("destPlace");
const wifiLocateBtn = document.getElementById("wifiLocateBtn");
const objectPhotoInput = document.getElementById("objectPhotoInput");
const saveParkingBtn = document.getElementById("saveParkingBtn");
const returnStartBtn = document.getElementById("returnStartBtn");
const returnParkingBtn = document.getElementById("returnParkingBtn");
const historyBox = document.getElementById("historyBox");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const centerBtn = document.getElementById("centerBtn");
const statusBox = document.getElementById("statusBox");
const locationBox = document.getElementById("locationBox");
const mapBadge = document.getElementById("mapBadge");
const routeHint = document.getElementById("routeHint");
const audioHelp = document.getElementById("audioHelp");
const screenReaderSummary = document.getElementById("screenReaderSummary");
const voiceToggleBtn = document.getElementById("voiceToggleBtn");
const voiceToggleText = document.getElementById("voiceToggleText");
const sessionId = localStorage.getItem("mapSessionId") || crypto.randomUUID();
localStorage.setItem("mapSessionId", sessionId);

let lang = localStorage.getItem("lang") || "zh";
let config = null;
let currentFloor = "campus";
let currentPosition = { x: 440, y: 615 };
let currentBoard = null;
let currentBaseMapId = "M-B1-CENTER-01";
let currentAccessPoint = null;
let startPosition = null;
let routeData = null;
let destinationActive = false;
let currentCategory = "all";
let searchTimer = null;
let locationSource = "default";
let view = { scale: 1, x: 0, y: 0 };
let dragging = false;
let dragStart = { x: 0, y: 0, viewX: 0, viewY: 0 };
let lastTouchDistance = null;
let lastTouchCenter = null;
let voiceEnabled = localStorage.getItem("voiceEnabled") !== "false";
let lastGpsRouteAt = 0;
let lastGpsLearnAt = 0;
let lastSpokenRoute = "";
let lastAutoSpeechAt = 0;
let lastTileSignature = "";
let routeRequestSeq = 0;
let routeAnimationStart = performance.now();
let motionState = {
  enabled: false,
  supported: false,
  steps: 0,
  heading: null,
  lastStepAt: 0,
  lastMagnitude: 0,
  strideMeters: 0.68,
  pendingMeters: 0,
  source: "phone-motion"
};

const floorStyles = {
  B1: { bg: "#edf7f3", band: "#cde7df", label: "#0f766e" },
  B2: { bg: "#eef4ff", band: "#cfdef8", label: "#2f5f9f" },
  B3: { bg: "#fff4e8", band: "#f7d8af", label: "#b45309" }
};

const baseMapProfiles = {
  "M-B1-CENTER-01": {
    id: "M-B1-CENTER-01",
    labelZh: "淡江校園中央底圖",
    labelEn: "Tamkang Campus Center Base Map",
    bg: "#edf7f3",
    band: "#cde7df",
    accent: "#0f766e",
    focus: { x: 470, y: 250, w: 300, h: 250 },
    view: { scale: 1.2, x: 0, y: 0 }
  },
  "M-B1-EAST-01": {
    id: "M-B1-EAST-01",
    labelZh: "淡江校園東側底圖",
    labelEn: "Tamkang Campus East Base Map",
    bg: "#eef7ff",
    band: "#cfe5f7",
    accent: "#2f5f9f",
    focus: { x: 650, y: 280, w: 300, h: 310 },
    view: { scale: 1.35, x: -170, y: -80 }
  },
  "M-B1-SOUTH-01": {
    id: "M-B1-SOUTH-01",
    labelZh: "淡江校園南側底圖",
    labelEn: "Tamkang Campus South Base Map",
    bg: "#fff4e8",
    band: "#f7d8af",
    accent: "#b45309",
    focus: { x: 410, y: 470, w: 360, h: 210 },
    view: { scale: 1.3, x: -80, y: -220 }
  },
  "M-B1-WEST-01": {
    id: "M-B1-WEST-01",
    labelZh: "淡江校園西側底圖",
    labelEn: "Tamkang Campus West Base Map",
    bg: "#f1f5ff",
    band: "#d7defa",
    accent: "#4f46e5",
    focus: { x: 80, y: 250, w: 330, h: 170 },
    view: { scale: 1.45, x: 80, y: -80 }
  }
};

const geoMapBounds = {
  north: 25.0526,
  south: 25.0442,
  west: 121.5106,
  east: 121.5228
};

const campusPlan = {
  roads: [
    { type: "main", labelZh: "\u6821\u5712\u4e3b\u8ef8\u6b65\u9053", labelEn: "Campus Main Walk", points: [[440, 615], [520, 700], [585, 760], [590, 1010], [840, 1010], [1000, 880], [1130, 860]] },
    { type: "main", labelZh: "\u5357\u5074\u6b65\u9053", labelEn: "South Walk", points: [[415, 650], [535, 1125], [765, 1195], [965, 1430]] },
    { type: "main", labelZh: "\u5de5\u5b78\u9662\u6b65\u9053", labelEn: "Engineering Walk", points: [[585, 760], [790, 735], [930, 690], [1120, 700], [1130, 860]] },
    { type: "main", labelZh: "\u5716\u66f8\u9928\u74b0\u9053", labelEn: "Library Loop", points: [[930, 690], [1120, 700], [1120, 880], [995, 940], [925, 950], [840, 1010]] },
    { type: "secondary", labelZh: "\u64cd\u5834\u9023\u7d61\u9053", labelEn: "Stadium Link", points: [[440, 615], [320, 345], [415, 650]] },
    { type: "secondary", labelZh: "\u5b78\u751f\u6d3b\u52d5\u5340\u6b65\u9053", labelEn: "Student Area Walk", points: [[590, 1010], [610, 1060], [620, 1210], [620, 1330], [765, 1360], [940, 1430]] },
    { type: "secondary", labelZh: "\u5df4\u58eb\u7ad9\u9023\u7d61\u9053", labelEn: "Bus Stop Link", points: [[790, 735], [840, 1010], [620, 1210]] },
    { type: "secondary", labelZh: "\u5357\u51fa\u53e3\u9023\u7d61\u9053", labelEn: "South Exit Link", points: [[620, 1210], [765, 1360], [965, 1430], [1165, 1340]] }
  ],
  greens: [
    { x: 70, y: 105, w: 555, h: 520, r: 34, fill: "#d7ead5", stroke: "#a5c9a2", labelZh: "\u64cd\u5834", labelEn: "Sports Field" },
    { x: 405, y: 940, w: 200, h: 260, r: 32, fill: "#cfe8d3", stroke: "#9fc8a6", labelZh: "\u514b\u96e3\u5761", labelEn: "Scenery Slope" },
    { x: 875, y: 565, w: 320, h: 150, r: 30, fill: "#dff0df", stroke: "#b6d7b7", labelZh: "\u6797\u9670\u6b65\u9053", labelEn: "Tree Walk" }
  ],
  buildings: [
    { x: 610, y: 780, w: 165, h: 210, r: 12, fill: "#f3d2a4", stroke: "#c58c4a", labelZh: "\u884c\u653f\u5927\u6a13", labelEn: "Administration" },
    { x: 895, y: 715, w: 210, h: 195, r: 14, fill: "#cbdaf4", stroke: "#7793c8", labelZh: "\u5716\u66f8\u9928", labelEn: "Library" },
    { x: 1050, y: 915, w: 210, h: 235, r: 14, fill: "#f2c7be", stroke: "#c56d62", labelZh: "\u5546\u7ba1\u5927\u6a13", labelEn: "Business" },
    { x: 650, y: 1080, w: 250, h: 240, r: 14, fill: "#e4d7f4", stroke: "#9974bf", labelZh: "\u5b78\u751f\u6d3b\u52d5\u5340", labelEn: "Student Area" },
    { x: 760, y: 610, w: 190, h: 120, r: 12, fill: "#d9e8f1", stroke: "#6e9bb1", labelZh: "\u5de5\u5b78\u9662", labelEn: "Engineering" },
    { x: 635, y: 715, w: 125, h: 70, r: 12, fill: "#f5e6ab", stroke: "#d0aa38", labelZh: "\u570b\u969b\u6703\u8b70\u4e2d\u5fc3", labelEn: "Conference Center" },
    { x: 450, y: 575, w: 115, h: 90, r: 12, fill: "#e7eef8", stroke: "#8ba4c0", labelZh: "\u6821\u9580", labelEn: "Main Gate" },
    { x: 720, y: 1160, w: 155, h: 95, r: 12, fill: "#f6e0bd", stroke: "#c79655", labelZh: "\u6d3b\u52d5\u4e2d\u5fc3", labelEn: "Activity Center" }
  ]
};

langSelect.value = lang;
langSelect.addEventListener("change", () => {
  lang = langSelect.value;
  localStorage.setItem("lang", lang);
  applyI18n();
  updateVoiceButton();
  fillSelects();
  updateLocationText();
  updateRouteText();
  announce(`${t("voiceEnabled")}. ${t("audioHelp")}`, true);
});

function t(key) {
  return i18n[lang][key] || i18n.zh[key] || key;
}

function text(item, key = "label") {
  if (!item) return "";
  if (lang === "en") return item[`${key}En`] || item.nameEn || item[`${key}Zh`] || item.nameZh || item.id || "";
  return item[`${key}Zh`] || item.nameZh || item[`${key}En`] || item.nameEn || item.id || "";
}

function distance(a, b) {
  return Math.hypot(Number(a?.x || 0) - Number(b?.x || 0), Number(a?.y || 0) - Number(b?.y || 0));
}

function applyI18n() {
  document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
  document.querySelectorAll("[data-i18n]").forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(node => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  canvas.setAttribute("aria-label", `${t("appTitle")}. ${t("mapKeyboardHelp")}`);
  objectPhotoInput?.setAttribute("aria-describedby", "audioHelp");
  zoomInBtn.setAttribute("aria-label", lang === "en" ? "Zoom in map" : "\u653e\u5927\u5730\u5716");
  zoomOutBtn.setAttribute("aria-label", lang === "en" ? "Zoom out map" : "\u7e2e\u5c0f\u5730\u5716");
  centerBtn.setAttribute("aria-label", t("centerCurrent"));
  audioHelp.textContent = t("audioHelp");
}

function speechLang() {
  return lang === "en" ? "en-US" : "zh-TW";
}

function updateVoiceButton() {
  voiceToggleText.textContent = voiceEnabled ? t("voiceOn") : t("voiceOff");
  voiceToggleBtn.setAttribute("aria-pressed", String(voiceEnabled));
  voiceToggleBtn.setAttribute("aria-label", voiceEnabled ? t("voiceOn") : t("voiceOff"));
  voiceToggleBtn.classList.toggle("is-on", voiceEnabled);
  voiceToggleBtn.classList.toggle("is-off", !voiceEnabled);
}

function speak(message, interrupt = false) {
  const textValue = String(message || "").replace(/\s+/g, " ").trim();
  if (!textValue || !voiceEnabled) return;
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    screenReaderSummary.textContent = t("voiceUnsupported");
    return;
  }
  if (interrupt) window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(textValue);
  utterance.lang = speechLang();
  utterance.rate = lang === "en" ? 0.95 : 0.9;
  utterance.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(voice => voice.lang === speechLang()) || voices.find(voice => voice.lang.startsWith(lang === "en" ? "en" : "zh"));
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

function announce(message, interrupt = false) {
  const textValue = String(message || "").replace(/\s+/g, " ").trim();
  if (!textValue) return;
  screenReaderSummary.textContent = "";
  setTimeout(() => {
    screenReaderSummary.textContent = textValue;
  }, 20);
  speak(textValue, interrupt);
}

function liveOnly(message) {
  const textValue = String(message || "").replace(/\s+/g, " ").trim();
  if (!textValue) return;
  screenReaderSummary.textContent = "";
  setTimeout(() => {
    screenReaderSummary.textContent = textValue;
  }, 20);
}

function autoNavigateSpeak(message, interrupt = false) {
  const now = Date.now();
  if (!interrupt && now - lastAutoSpeechAt < 5000) {
    liveOnly(message);
    return;
  }
  lastAutoSpeechAt = now;
  announce(message, interrupt);
}

function haptic(pattern = [80]) {
  return;
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
  updateVoiceButton();
  startMotionTracking();
  try {
    const health = await api("/api/health");
    config = await api("/api/config");
    canvas.width = config.canvas.width;
    canvas.height = config.canvas.height;
    fillSelects();
    updateLocationText();
    await refreshHistory();
    statusBox.textContent = `${health.message}\nSession: ${sessionId}`;
    draw();
    liveOnly(`${t("audioHelp")} ${t("voiceQuietHint")} ${t("mapKeyboardHelp")} ${t("vibrationReady")}`);
  } catch (error) {
    statusBox.textContent = `${t("serverDown")}\n${error.message}`;
    announce(`${t("serverDown")} ${error.message}`, true);
  }
}

function fillSelects() {
  if (!config) return;
  if (categorySelect) {
    categorySelect.innerHTML = config.destinationCategories
      .map(category => `<option value="${category.id}" ${category.id === currentCategory ? "selected" : ""}>${lang === "en" ? category.labelEn : category.labelZh}</option>`)
      .join("");
  }
  const places = filteredPlaces();
  const selected = places.some(([id]) => id === destPlace.value) ? destPlace.value : (places[0]?.[0] || "mainGate");
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

function resolveDestinationFloor() {
  const place = config?.places?.[destPlace.value];
  return place?.floor || currentFloor || "campus";
}

function estimatedMeters(px) {
  return Math.max(1, Math.round(Number(px || 0) * 0.6));
}

function routeMeters() {
  return Number.isFinite(Number(routeData?.totalMeters)) ? Math.round(routeData.totalMeters) : estimatedMeters(routeData?.totalDistance);
}

function geoToMap(lat, lon) {
  const x = (lon - geoMapBounds.west) / (geoMapBounds.east - geoMapBounds.west) * canvas.width;
  const y = (geoMapBounds.north - lat) / (geoMapBounds.north - geoMapBounds.south) * canvas.height;
  return { x, y };
}

function mapToGeo(x, y) {
  const lon = geoMapBounds.west + (x / canvas.width) * (geoMapBounds.east - geoMapBounds.west);
  const lat = geoMapBounds.north - (y / canvas.height) * (geoMapBounds.north - geoMapBounds.south);
  return { lat, lon };
}

function lonToTileX(lon, zoom) {
  return Math.floor((lon + 180) / 360 * 2 ** zoom);
}

function latToTileY(lat, zoom) {
  const rad = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * 2 ** zoom);
}

function lonToTileFloatX(lon, zoom) {
  return (lon + 180) / 360 * 2 ** zoom;
}

function latToTileFloatY(lat, zoom) {
  const rad = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * 2 ** zoom;
}

function tileXToLon(x, zoom) {
  return x / 2 ** zoom * 360 - 180;
}

function tileYToLat(y, zoom) {
  const n = Math.PI - 2 * Math.PI * y / 2 ** zoom;
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function geoToScreen(lat, lon, rect) {
  const point = geoToMap(lat, lon);
  return {
    x: (point.x * view.scale + view.x) * rect.width / canvas.width,
    y: (point.y * view.scale + view.y) * rect.height / canvas.height
  };
}

function isMapPointUsable(point) {
  return point && point.x >= -80 && point.x <= canvas.width + 80 && point.y >= -80 && point.y <= canvas.height + 80;
}

function baseMapIdFromPoint(point) {
  if (point.y > 540) return "M-B1-SOUTH-01";
  if (point.x < 390) return "M-B1-WEST-01";
  if (point.x > 650) return "M-B1-EAST-01";
  return "M-B1-CENTER-01";
}

function nearestAccessPointClient(point) {
  if (!config?.accessPoints?.length) return null;
  const sameFloor = config.accessPoints.filter(ap => ap.floor === currentFloor);
  if (!sameFloor.length) return null;
  let best = sameFloor[0];
  let bestDistance = distance(point, best);
  for (const ap of sameFloor.slice(1)) {
    const d = distance(point, ap);
    if (d < bestDistance) {
      best = ap;
      bestDistance = d;
    }
  }
  return { id: best.id, name: best.name, ip: best.ip, ssid: best.ssid, floor: best.floor, x: Number(best.x), y: Number(best.y), distance: Math.round(bestDistance) };
}

async function learnMotionPath(point) {
  try {
    const result = await api("/api/location/motion", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        floor: currentFloor,
        x: point.x,
        y: point.y,
        motion: motionPayload()
      })
    });
    if (result.learned) screenReaderSummary.textContent = t("learningUpdated");
  } catch {
    // Learning is opportunistic; navigation should keep working if logging fails.
  }
}

async function requestMotionPermission() {
  try {
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      await DeviceMotionEvent.requestPermission();
    }
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      await DeviceOrientationEvent.requestPermission();
    }
  } catch {
    // iOS may deny sensor access until a user gesture; Wi-Fi positioning still works.
  }
}

function startMotionTracking() {
  motionState.supported = "DeviceMotionEvent" in window || "DeviceOrientationEvent" in window;
  if (!motionState.supported) return;
  window.addEventListener("deviceorientation", event => {
    const heading = Number.isFinite(event.webkitCompassHeading)
      ? event.webkitCompassHeading
      : Number(event.alpha);
    if (Number.isFinite(heading)) {
      motionState.heading = (360 - heading + 360) % 360;
      motionState.enabled = true;
      updateLocationText();
    }
  }, true);
  window.addEventListener("devicemotion", event => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;
    const magnitude = Math.hypot(Number(acc.x || 0), Number(acc.y || 0), Number(acc.z || 0));
    const now = Date.now();
    const isStep = magnitude > 12.4 && motionState.lastMagnitude <= 11.4 && now - motionState.lastStepAt > 420;
    motionState.lastMagnitude = magnitude;
    if (!isStep) return;
    motionState.enabled = true;
    motionState.steps += 1;
    motionState.lastStepAt = now;
    motionState.pendingMeters += motionState.strideMeters;
    applyMotionStep();
  }, true);
}

function applyMotionStep() {
  if (!config || motionState.heading === null || motionState.pendingMeters < 0.65) {
    updateLocationText();
    return;
  }
  const meters = motionState.pendingMeters;
  motionState.pendingMeters = 0;
  const px = meters / 0.6;
  const rad = (motionState.heading - 90) * Math.PI / 180;
  currentPosition = {
    x: Math.max(0, Math.min(canvas.width, currentPosition.x + Math.cos(rad) * px)),
    y: Math.max(0, Math.min(canvas.height, currentPosition.y + Math.sin(rad) * px))
  };
  locationSource = locationSource === "default" ? "motion" : locationSource;
  currentAccessPoint = nearestAccessPointClient(currentPosition);
  updateLocationText();
  draw();
  const now = Date.now();
  if (destinationActive && now - lastGpsRouteAt > 1800) {
    lastGpsRouteAt = now;
    void requestRoute("motion-step");
  }
  if (now - lastGpsLearnAt > 3000) {
    lastGpsLearnAt = now;
    void learnMotionPath(currentPosition);
  }
}

function motionPayload() {
  return {
    steps: motionState.steps,
    heading: Number.isFinite(motionState.heading) ? Math.round(motionState.heading) : 0,
    strideMeters: motionState.strideMeters,
    source: motionState.source
  };
}

function formatMotion() {
  if (!motionState.supported) return t("motionUnavailable");
  const heading = Number.isFinite(motionState.heading) ? `${Math.round(motionState.heading)}°` : "-";
  return `${t("motionActive")} · ${motionState.steps} steps · ${heading}`;
}

function activeBaseMap() {
  return baseMapProfiles[currentBaseMapId] || baseMapProfiles["M-B1-CENTER-01"];
}

function baseMapName(profile = activeBaseMap()) {
  return lang === "en" ? profile.labelEn : profile.labelZh;
}

function switchBaseMap(boardId) {
  currentBaseMapId = baseMapProfiles[boardId] ? boardId : "M-B1-CENTER-01";
  const profile = activeBaseMap();
  view.scale = profile.view.scale;
  view.x = profile.view.x;
  view.y = profile.view.y;
  centerOnCurrent(false);
}

function updateTileLayer() {
  if (tileLayer) tileLayer.innerHTML = "";
}

function draw() {
  if (!config) return;
  updateTileLayer();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.scale, view.scale);
  drawBaseMap();
  drawRoute();
  drawBoards();
  drawAccessPoints();
  drawDestinationMarker();
  drawPosition();
  ctx.restore();
  requestAnimationFrame(draw);
}

function drawBaseMap() {
  ctx.fillStyle = "#f5f7f1";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCampusPlan();
}

function drawCampusPlan() {
  ctx.save();
  drawMapGrid();
  campusPlan.greens.forEach(area => drawRoundedArea(area));
  campusPlan.roads.forEach(road => drawCampusRoad(road, true));
  campusPlan.roads.forEach(road => drawCampusRoad(road, false));
  campusPlan.buildings.forEach(building => drawRoundedArea(building, true));
  drawCampusCompass();
  ctx.restore();
}

function drawMapGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, .16)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoundedArea(area, isBuilding = false) {
  ctx.save();
  ctx.fillStyle = area.fill;
  ctx.strokeStyle = area.stroke;
  ctx.lineWidth = isBuilding ? 2.5 : 2;
  ctx.beginPath();
  ctx.roundRect(area.x, area.y, area.w, area.h, area.r || 12);
  ctx.fill();
  ctx.stroke();
  const label = lang === "en" ? area.labelEn : area.labelZh;
  if (label) {
    ctx.fillStyle = isBuilding ? "#243145" : "#2f5f46";
    ctx.font = `${isBuilding ? "800" : "700"} ${isBuilding ? 23 : 21}px "Microsoft JhengHei", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    wrapMapText(label, area.x + area.w / 2, area.y + area.h / 2, Math.max(70, area.w - 24), isBuilding ? 25 : 23);
  }
  ctx.restore();
}

function drawCampusRoad(road, casing) {
  const width = road.type === "main" ? 28 : 18;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = casing ? "rgba(30, 64, 175, .18)" : (road.type === "main" ? "#ffffff" : "#f8fafc");
  ctx.lineWidth = casing ? width + 12 : width;
  ctx.beginPath();
  road.points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  if (!casing) {
    ctx.strokeStyle = road.type === "main" ? "#6aa292" : "#9bc4bb";
    ctx.lineWidth = road.type === "main" ? 3 : 2;
    ctx.setLineDash(road.type === "main" ? [] : [12, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function wrapMapText(value, x, y, maxWidth, lineHeight) {
  const chars = String(value || "").split("");
  const lines = [];
  let line = "";
  for (const ch of chars) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const top = y - (lines.length - 1) * lineHeight / 2;
  lines.slice(0, 3).forEach((textLine, index) => ctx.fillText(textLine, x, top + index * lineHeight));
}

function drawCampusCompass() {
  ctx.save();
  ctx.translate(88, 142);
  ctx.fillStyle = "rgba(255,255,255,.88)";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.moveTo(0, -27);
  ctx.lineTo(10, 12);
  ctx.lineTo(0, 6);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.font = "800 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText("N", 0, -47);
  ctx.restore();
}

function drawBaseMapFocus(profile) {
  return;
  if (!profile?.focus) return;
  const { x, y, w, h } = profile.focus;
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, .16)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = profile.accent;
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 10]);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawBoards() {
  if (!currentBoard) return;
  const board = config.mapBoards.find(item => item.id === currentBoard.boardId);
  if (!board || board.floor !== currentFloor) return;
  drawIconMarker(board.x, board.y, "map", "#2f5f9f", lang === "en" ? board.nameEn : board.nameZh);
}

function drawAccessPoints() {
  if (!currentAccessPoint) return;
  drawIconMarker(currentAccessPoint.x, currentAccessPoint.y, "wifi", "#0f766e", currentAccessPoint.ip);
}

function drawDestinationMarker() {
  if (!destinationActive) return;
  const selected = routeData?.destination || config?.places?.[destPlace.value];
  if (!selected || (selected.floor && selected.floor !== currentFloor)) return;
  const label = text(selected);
  drawDestinationPin(selected.x, selected.y, label);
}

function drawDestinationPin(x, y, label) {
  const markerScale = 1 / Math.sqrt(view.scale);
  const s = markerScale;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "rgba(15, 23, 42, .28)";
  ctx.shadowBlur = 8 * s;
  ctx.shadowOffsetY = 3 * s;
  ctx.fillStyle = "#e11d48";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-16 * s, -18 * s, -16 * s, -39 * s, 0, -48 * s);
  ctx.bezierCurveTo(16 * s, -39 * s, 16 * s, -18 * s, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, -30 * s, 8 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e11d48";
  ctx.beginPath();
  ctx.arc(0, -30 * s, 4.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawMarkerLabel(x + 16 * s, y - 42 * s, label, "#e11d48", markerScale);
}

function iconForPlace(place) {
  const label = `${place.id || ""} ${place.nameZh || ""} ${place.nameEn || ""} ${(place.aliases || []).join(" ")}`.toLowerCase();
  if (place.node === "RESTROOM" || label.includes("restroom") || label.includes("toilet") || label.includes("wc") || label.includes("廁所")) return "toilet";
  if (place.node === "ELEVATOR" || label.includes("elevator") || label.includes("電梯")) return "elevator";
  if (place.exitCode || /^出口|exit/.test(label)) return "exit";
  if (place.shopNo || place.category === "shop") return "shop";
  return "pin";
}

function drawIconMarker(x, y, icon, color, label = "", showLabel = false) {
  const markerScale = 1 / Math.sqrt(view.scale);
  const size = 22 * markerScale;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 * markerScale;
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2 * markerScale;
  drawMarkerIcon(icon, markerScale);
  ctx.restore();

  if (showLabel && label) {
    drawMarkerLabel(x, y, label, color, markerScale);
  }
}

function drawMarkerIcon(icon, markerScale) {
  const s = markerScale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (icon === "toilet") {
    ctx.strokeRect(-5 * s, -6 * s, 10 * s, 7 * s);
    ctx.beginPath();
    ctx.moveTo(-3 * s, 1 * s);
    ctx.quadraticCurveTo(0, 7 * s, 6 * s, 3 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6 * s, -8 * s);
    ctx.lineTo(5 * s, -8 * s);
    ctx.stroke();
    return;
  }
  if (icon === "elevator") {
    ctx.strokeRect(-6 * s, -7 * s, 12 * s, 14 * s);
    ctx.beginPath();
    ctx.moveTo(0, -5 * s);
    ctx.lineTo(-3 * s, -2 * s);
    ctx.moveTo(0, -5 * s);
    ctx.lineTo(3 * s, -2 * s);
    ctx.moveTo(0, 5 * s);
    ctx.lineTo(-3 * s, 2 * s);
    ctx.moveTo(0, 5 * s);
    ctx.lineTo(3 * s, 2 * s);
    ctx.stroke();
    return;
  }
  if (icon === "wifi") {
    for (let r = 4; r <= 9; r += 3) {
      ctx.beginPath();
      ctx.arc(0, 5 * s, r * s, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 5 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (icon === "map") {
    ctx.beginPath();
    ctx.moveTo(-7 * s, -6 * s);
    ctx.lineTo(-2 * s, -8 * s);
    ctx.lineTo(3 * s, -6 * s);
    ctx.lineTo(8 * s, -8 * s);
    ctx.lineTo(8 * s, 6 * s);
    ctx.lineTo(3 * s, 8 * s);
    ctx.lineTo(-2 * s, 6 * s);
    ctx.lineTo(-7 * s, 8 * s);
    ctx.closePath();
    ctx.stroke();
    return;
  }
  if (icon === "exit") {
    ctx.strokeRect(-6 * s, -7 * s, 8 * s, 14 * s);
    ctx.beginPath();
    ctx.moveTo(-1 * s, 0);
    ctx.lineTo(8 * s, 0);
    ctx.moveTo(5 * s, -3 * s);
    ctx.lineTo(8 * s, 0);
    ctx.lineTo(5 * s, 3 * s);
    ctx.stroke();
    return;
  }
  if (icon === "shop") {
    ctx.strokeRect(-6 * s, -1 * s, 12 * s, 7 * s);
    ctx.beginPath();
    ctx.moveTo(-7 * s, -2 * s);
    ctx.lineTo(-5 * s, -7 * s);
    ctx.lineTo(5 * s, -7 * s);
    ctx.lineTo(7 * s, -2 * s);
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.arc(0, -2 * s, 4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 8 * s);
  ctx.lineTo(-5 * s, 1 * s);
  ctx.lineTo(5 * s, 1 * s);
  ctx.closePath();
  ctx.fill();
}

function drawMarkerLabel(x, y, label, color, markerScale) {
  const textValue = truncateLabel(label, lang === "en" ? 22 : 14);
  const fontSize = 13 * markerScale;
  ctx.save();
  ctx.font = `700 ${fontSize}px "Microsoft JhengHei", Arial, sans-serif`;
  const paddingX = 8 * markerScale;
  const paddingY = 5 * markerScale;
  const textWidth = ctx.measureText(textValue).width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = fontSize + paddingY * 2;
  const left = x + 16 * markerScale;
  const top = y - boxHeight / 2;
  ctx.fillStyle = "rgba(255, 255, 255, .95)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * markerScale;
  ctx.beginPath();
  ctx.roundRect(left, top, boxWidth, boxHeight, 6 * markerScale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#111827";
  ctx.fillText(textValue, left + paddingX, top + paddingY + fontSize * .78);
  ctx.restore();
}

function truncateLabel(value, maxLength) {
  const textValue = String(value || "");
  return textValue.length > maxLength ? `${textValue.slice(0, maxLength - 1)}...` : textValue;
}

function drawPosition() {
  const radiusScale = 1 / Math.sqrt(view.scale);
  ctx.fillStyle = "rgba(220, 38, 38, .14)";
  ctx.beginPath();
  ctx.arc(currentPosition.x, currentPosition.y, 16 * radiusScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(currentPosition.x, currentPosition.y, 6 * radiusScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.5 * radiusScale;
  ctx.stroke();
}

function drawRoute() {
  if (!routeData?.path?.length) return;
  const path = routeData.path;
  const dashOffset = -((performance.now() - routeAnimationStart) / 55 % 24);
  ctx.save();
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 1.45 / Math.sqrt(view.scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([8, 10]);
  ctx.lineDashOffset = dashOffset;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i += 1) ctx.lineTo(path[i].x, path[i].y);
  ctx.stroke();
  ctx.restore();

  for (let i = 1; i < path.length; i += 1) {
    const from = path[i - 1];
    const to = path[i];
    drawArrow(from, to, "#0f766e");
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
  ctx.moveTo(12, 0);
  ctx.lineTo(-7, -7);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function clampView() {
  const rect = canvas.getBoundingClientRect();
  const minScale = 0.75;
  const maxScale = 8;
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
  view.scale = Math.max(0.75, Math.min(8, view.scale * factor));
  view.x = point.sx - point.x * view.scale;
  view.y = point.sy - point.y * view.scale;
  clampView();
  if (oldScale !== view.scale) updateLocationText();
}

function centerOnCurrent(shouldAnnounce = true) {
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width / 2 * (canvas.width / rect.width);
  const sy = rect.height / 2 * (canvas.height / rect.height);
  view.x = sx - currentPosition.x * view.scale;
  view.y = sy - currentPosition.y * view.scale;
  clampView();
  updateLocationText();
  if (shouldAnnounce) announce(locationSpeech(), true);
}

async function locateFromWifi() {
  await requestMotionPermission();
  statusBox.textContent = lang === "en" ? "Locating from server-side Wi-Fi fingerprint..." : "正在由 server 端 Wi-Fi 指紋定位...";
  try {
    const data = await api("/api/location/wifi", {
      method: "POST",
      body: JSON.stringify({ sessionId, userAgent: navigator.userAgent })
    });
    currentBoard = {
      boardId: data.location.fingerprintId,
      boardNameZh: data.location.fingerprintNameZh,
      boardNameEn: data.location.fingerprintNameEn
    };
    currentFloor = data.location.floor;
    currentPosition = { x: data.location.x, y: data.location.y };
    currentAccessPoint = data.location.accessPoint || null;
    locationSource = "wifi";
    mapBadge.textContent = `${t("wifiLocated")}: ${lang === "en" ? data.location.fingerprintNameEn : data.location.fingerprintNameZh}`;
    statusBox.textContent = `${t("wifiLocated")} / ${t("confidence")}: ${Math.round(data.location.confidence * 100)}%`;
    centerOnCurrent(false);
    updateLocationText();
    if (destinationActive) await requestRoute("wifi-location");
    else updateRouteText();
    autoNavigateSpeak(`${t("wifiLocated")}。${shortLocationSpeech()}`, true);
  } catch (error) {
    statusBox.textContent = `${t("failed")}: ${error.message}`;
    autoNavigateSpeak(`${t("failed")}: ${error.message}`, true);
  }
}

async function requestRoute(reason) {
  if (!destinationActive) {
    routeData = null;
    updateRouteText();
    return;
  }
  const requestSeq = ++routeRequestSeq;
  routeData = null;
  updateRouteText();
  try {
    const nextRoute = await api("/api/route", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        currentFloor,
        destFloor: resolveDestinationFloor(),
        destPlace: destPlace.value,
        destinationPoint: routeTargetPoint(),
        position: currentPosition,
        motion: motionPayload(),
        reason
      })
    });
    if (requestSeq !== routeRequestSeq) return;
    routeData = nextRoute;
    await refreshHistory();
    routeAnimationStart = performance.now();
    updateRouteText();
  } catch (error) {
    if (requestSeq !== routeRequestSeq) return;
    routeData = null;
    routeHint.textContent = `${t("routeFailed")}: ${error.message}`;
    haptic([250, 80, 250]);
    autoNavigateSpeak(`${t("routeFailed")}: ${error.message}`, true);
  }
}

function updateRouteText() {
  if (!routeData || !config) {
    if (!destinationActive) routeHint.textContent = t("photoHelp");
    else routeHint.textContent = lang === "en" ? "Updating route..." : "正在更新路線...";
    return;
  }
  const dest = routeData.destination;
  const finalDest = routeData.customDestination || config.places[routeData.destPlace] || dest;
  const intro = routeData.sameFloor
    ? `${t("routeTo")} ${text(finalDest)}.`
    : verticalRouteInstruction(finalDest);
  const nextNode = routeData.path?.[1] || routeData.path?.[0] || null;
  const direction = nextNode ? directionFromTo(currentPosition, nextNode) : "";
  const current = currentStepSpeech();
  routeHint.innerHTML = `<strong>${t("currentInstruction")}:</strong> ${escapeHtml(current)}<br>${t("distance")} ${routeMeters()} ${t("meters")}${verticalSwitchHtml(finalDest)}${routeStepsHtml(finalDest)}`;
  routeHint.classList.remove("prompt-pulse");
  void routeHint.offsetWidth;
  routeHint.classList.add("prompt-pulse");
  const spoken = routeSpeech();
  if (spoken && spoken !== lastSpokenRoute) {
    lastSpokenRoute = spoken;
    autoNavigateSpeak(`${t("routeReady")}。${currentStepSpeech()}`, false);
  }
}

function routeTargetPoint() {
  const target = window.__temporaryRouteTarget;
  return target ? { ...target } : null;
}

function clearTemporaryTarget() {
  window.__temporaryRouteTarget = null;
}

async function routeToPoint(point, labelZh, labelEn, reason) {
  window.__temporaryRouteTarget = {
    floor: point.floor || currentFloor,
    x: Number(point.x),
    y: Number(point.y),
    labelZh,
    labelEn,
    node: "CUSTOM"
  };
  destinationActive = true;
  routeData = null;
  routeRequestSeq += 1;
  await requestRoute(reason);
}

async function refreshHistory() {
  if (!historyBox) return;
  try {
    const data = await api(`/api/history?sessionId=${encodeURIComponent(sessionId)}`);
    const rows = (data.events || []).slice(0, 3).map(event => {
      const label = event.type === "route" ? (lang === "en" ? "Route" : "路線") : event.type;
      return `<li>${escapeHtml(label)} · ${escapeHtml(new Date(event.at).toLocaleTimeString(lang === "en" ? "en-US" : "zh-TW", { hour: "2-digit", minute: "2-digit" }))}</li>`;
    }).join("");
    historyBox.innerHTML = `<strong>${t("historyTitle")}</strong>${rows ? `<ul>${rows}</ul>` : ""}`;
  } catch {
    historyBox.textContent = "";
  }
}

async function saveParking() {
  try {
    await api("/api/parking/save", {
      method: "POST",
      body: JSON.stringify({ sessionId, floor: currentFloor, x: currentPosition.x, y: currentPosition.y })
    });
    statusBox.textContent = t("parkingSaved");
    await refreshHistory();
    autoNavigateSpeak(t("parkingSaved"), true);
  } catch (error) {
    statusBox.textContent = `${t("failed")}: ${error.message}`;
  }
}

async function returnToParking() {
  try {
    const data = await api(`/api/parking/latest?sessionId=${encodeURIComponent(sessionId)}`);
    await routeToPoint(data.parking, lang === "en" ? "Parking location" : "停車位", "Parking location", "return-parking");
  } catch (error) {
    statusBox.textContent = `${t("noParking")}。${error.message}`;
    autoNavigateSpeak(t("noParking"), true);
  }
}

async function returnToStart() {
  if (!startPosition) {
    statusBox.textContent = lang === "en" ? "No start position yet. Press Wi-Fi location first." : "尚未有起點，請先按 Wi-Fi 定位。";
    return;
  }
  await routeToPoint(startPosition, lang === "en" ? "Start position" : "起點", "Start position", "return-start");
}

async function searchByObjectPhoto() {
  const file = objectPhotoInput?.files?.[0];
  if (!file) return;
  statusBox.textContent = lang === "en" ? "Detecting object intent..." : "正在辨識圖片物品...";
  try {
    const data = await api("/api/image-search", {
      method: "POST",
      body: JSON.stringify({ sessionId, fileName: file.name, hint: file.name })
    });
    const best = data.destination;
    if (!best?.id) throw new Error("No destination");
    destPlace.value = best.id;
    destinationSearch.value = text(best);
    destinationActive = true;
    clearTemporaryTarget();
    statusBox.textContent = `${t("objectDetected")}: ${lang === "en" ? data.detected.labelEn : data.detected.labelZh} → ${text(best)}`;
    await requestRoute("image-search");
  } catch (error) {
    statusBox.textContent = `${t("failed")}: ${error.message}`;
  }
}

function updateLocationText() {
  const floor = config?.floors?.[currentFloor];
  const floorName = floor ? (lang === "en" ? floor.nameEn : floor.nameZh) : currentFloor;
  locationBox.innerHTML = [
    `<strong>${t("locationSource")}:</strong> ${locationSourceText()}`,
    `<strong>${t("floor")}:</strong> ${floorName}`,
    `<strong>${t("baseMap")}:</strong> ${baseMapName()}`,
    `<strong>${t("coordinate")}:</strong> x=${Math.round(currentPosition.x)}, y=${Math.round(currentPosition.y)}`,
    `<strong>${t("motion")}:</strong> ${formatMotion()}`
  ].join("<br>");
}

function locationSpeech() {
  const floor = config?.floors?.[currentFloor];
  const floorName = floor ? (lang === "en" ? floor.nameEn : floor.nameZh) : currentFloor;
  const parts = [
    `${t("locationSource")}: ${locationSourceText()}`,
    `${t("floor")}: ${floorName}`,
    `${t("baseMap")}: ${baseMapName()}`,
    `${t("coordinate")}: X ${Math.round(currentPosition.x)}, Y ${Math.round(currentPosition.y)}`
  ];
  return parts.join("。");
}

function shortLocationSpeech() {
  const floor = config?.floors?.[currentFloor];
  const floorName = floor ? (lang === "en" ? floor.nameEn : floor.nameZh) : currentFloor;
  return `${t("located")}。${t("floor")}: ${floorName}。${t("coordinate")}: X ${Math.round(currentPosition.x)}, Y ${Math.round(currentPosition.y)}`;
}

function locationSourceText() {
  if (locationSource === "wifi") return lang === "en" ? "Server-side Wi-Fi fingerprint" : "Server 端 Wi-Fi 指紋定位";
  if (locationSource === "motion") return t("motion");
  if (locationSource === "floor-switch") return lang === "en" ? "Floor changed at elevator/stairs" : "已在電梯／樓梯切換樓層";
  return t("sourceDefault");
}

function currentStepSpeech() {
  if (!routeData || !config) return t("noRouteYet");
  const dest = routeData.destination;
  const finalDest = routeData.customDestination || config.places[routeData.destPlace] || dest;
  const nextNode = routeData.path?.[1] || routeData.path?.[0] || null;
  if (!routeData.sameFloor && distance(currentPosition, dest) < 35) return verticalArrivalInstruction(finalDest);
  if (distance(currentPosition, dest) < 35) return `${t("arrivedNear")}: ${text(finalDest)}`;
  const direction = nextNode ? directionFromTo(currentPosition, nextNode) : "";
  const meters = nextNode ? estimatedMeters(distance(currentPosition, nextNode)) : routeMeters();
  return lang === "en"
    ? `${t("nextDirection")}: ${direction || t("directionStraight")}. Follow the arrow for about ${meters} ${t("meters")}.`
    : `${t("nextDirection")}: ${direction || t("directionStraight")}。沿著箭頭前進約 ${meters} ${t("meters")}。`;
}

function routeSpeech() {
  if (!routeData || !config) return t("noRouteYet");
  const dest = routeData.destination;
  const finalDest = routeData.customDestination || config.places[routeData.destPlace] || dest;
  const destText = text(finalDest);
  const nextNode = routeData.path?.[1] || routeData.path?.[0] || null;
  const nextText = nextNode ? text(nextNode) : destText;
  const direction = nextNode ? directionFromTo(currentPosition, nextNode) : "";
  const intro = routeData.sameFloor
    ? `${t("routeTo")} ${destText}`
    : verticalRouteInstruction(finalDest);
  const step = distance(currentPosition, dest) < 35 ? t("arrivedNear") : `${t("nextToward")} ${nextText}`;
  const directionText = direction ? `${t("nextDirection")}: ${direction}` : "";
  return `${intro}。${directionText}。${step}。${t("distance")} ${routeMeters()} ${t("meters")}`;
}

function floorText(floorId) {
  const floor = config?.floors?.[floorId];
  if (!floor) return floorId || "";
  return lang === "en" ? floor.nameEn : floor.nameZh;
}

function verticalMoveText() {
  if (lang === "en") {
    if (routeData?.verticalDirection === "down") return "go down";
    if (routeData?.verticalDirection === "up") return "go up";
    return "move";
  }
  if (routeData?.verticalDirection === "down") return "下樓";
  if (routeData?.verticalDirection === "up") return "上樓";
  return "移動";
}

function verticalRouteInstruction(finalDest) {
  const targetFloor = floorText(routeData.destFloor);
  const connector = lang === "en" ? "elevator, escalator, or stairs" : "電梯／手扶梯／樓梯";
  if (lang === "en") {
    return `First follow the arrows to the ${connector}, then ${verticalMoveText()} to ${targetFloor}. After arriving on that floor, continue to ${text(finalDest)}.`;
  }
  return `請先沿著箭頭前往${connector}，再${verticalMoveText()}到${targetFloor}。到達該樓層後，繼續前往${text(finalDest)}。`;
}

function verticalArrivalInstruction(finalDest) {
  const targetFloor = floorText(routeData.destFloor);
  if (lang === "en") {
    return `You have reached the elevator, escalator, or stairs. Please ${verticalMoveText()} to ${targetFloor}, then continue to ${text(finalDest)}.`;
  }
  return `你已到達電梯／手扶梯／樓梯。請${verticalMoveText()}到${targetFloor}，再繼續前往${text(finalDest)}。`;
}

function verticalSwitchHtml(finalDest) {
  if (!routeData || routeData.sameFloor) return "";
  const connector = routeData.destination;
  if (!connector || distance(currentPosition, connector) >= 35) return "";
  const targetFloor = floorText(routeData.destFloor);
  const label = lang === "en"
    ? `${t("switchFloor")} to ${targetFloor}`
    : `${t("switchFloor")}: ${targetFloor}`;
  return `<div class="priority-action"><button class="primary" type="button" data-switch-floor="${escapeHtml(routeData.destFloor)}">${escapeHtml(label)}</button><span>${escapeHtml(text(finalDest))}</span></div>`;
}

function routeStepsHtml(finalDest) {
  if (!routeData?.path?.length) return "";
  const points = routeData.path;
  const steps = [];
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    if (!from || !to) continue;
    const dir = directionFromTo(from, to);
    const meters = estimatedMeters(distance(from, to));
    steps.push(lang === "en" ? `${dir || t("directionStraight")} for about ${meters} ${t("meters")}` : `${dir || t("directionStraight")}約 ${meters} ${t("meters")}`);
  }
  if (!routeData.sameFloor) {
    steps.push(verticalArrivalInstruction(finalDest));
  } else {
    steps.push(lang === "en" ? `Arrive at ${text(finalDest)}.` : `抵達${text(finalDest)}。`);
  }
  if (!steps.length) return "";
  const list = steps.slice(0, 8).map((step, index) => `<li>${index + 1}. ${escapeHtml(step)}</li>`).join("");
  return `<details class="route-details"><summary>${t("futureSteps")}</summary><ol class="route-steps">${list}</ol></details>`;
}

function directionFromTo(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 8) return "";
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const normalized = (angle + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return t("directionRight");
  if (normalized < 67.5) return t("directionBackRight");
  if (normalized < 112.5) return t("directionBack");
  if (normalized < 157.5) return t("directionBackLeft");
  if (normalized < 202.5) return t("directionLeft");
  if (normalized < 247.5) return t("directionSlightLeft");
  if (normalized < 292.5) return t("directionStraight");
  return t("directionSlightRight");
}

wifiLocateBtn?.addEventListener("click", locateFromWifi);
saveParkingBtn?.addEventListener("click", saveParking);
returnStartBtn?.addEventListener("click", returnToStart);
returnParkingBtn?.addEventListener("click", returnToParking);
objectPhotoInput?.addEventListener("change", searchByObjectPhoto);
zoomInBtn.addEventListener("click", () => zoomAt(1.25));
zoomOutBtn.addEventListener("click", () => zoomAt(0.8));
centerBtn.addEventListener("click", centerOnCurrent);
routeHint.addEventListener("click", event => {
  const button = event.target.closest("[data-switch-floor]");
  if (!button || !routeData) return;
  currentFloor = button.dataset.switchFloor;
  currentPosition = { x: routeData.destination.x, y: routeData.destination.y };
  locationSource = "floor-switch";
  routeData = null;
  routeRequestSeq += 1;
  updateLocationText();
  requestRoute("floor-switch");
  announce(lang === "en" ? `Switched to ${floorText(currentFloor)}` : `已切換到 ${floorText(currentFloor)}`, true);
});
voiceToggleBtn.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  localStorage.setItem("voiceEnabled", String(voiceEnabled));
  updateVoiceButton();
  if (voiceEnabled) announce(`${t("voiceEnabled")}。${t("voiceQuietHint")}`, true);
  else {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    screenReaderSummary.textContent = t("voiceDisabled");
  }
});
if (categorySelect) {
  categorySelect.addEventListener("change", () => {
    currentCategory = categorySelect.value;
    fillSelects();
    destinationActive = true;
    routeData = null;
    routeRequestSeq += 1;
    updateRouteText();
    requestRoute("destination-category");
    liveOnly(`${t("destinationCategory")}: ${categorySelect.options[categorySelect.selectedIndex]?.textContent || ""}`);
  });
}
destinationSearch.addEventListener("input", () => {
  void requestMotionPermission();
  clearTimeout(searchTimer);
  routeData = null;
  routeRequestSeq += 1;
  if (destinationSearch.value.trim()) {
    destinationActive = true;
    clearTemporaryTarget();
    updateRouteText();
  } else {
    destinationActive = false;
    updateRouteText();
    return;
  }
  searchTimer = setTimeout(resolveDestinationSearch, 280);
});
destinationSearch.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    clearTimeout(searchTimer);
    resolveDestinationSearch();
  }
});
clearDestinationBtn.addEventListener("click", () => {
  clearTimeout(searchTimer);
  destinationSearch.value = "";
  destinationActive = false;
  routeData = null;
  routeRequestSeq += 1;
  updateRouteText();
  statusBox.textContent = t("photoHelp");
  clearDestinationBtn.classList.remove("button-pulse");
  void clearDestinationBtn.offsetWidth;
  clearDestinationBtn.classList.add("button-pulse");
  liveOnly(t("clearDestination"));
});
destPlace.addEventListener("change", () => {
  destinationActive = true;
  clearTemporaryTarget();
  destinationSearch.value = destPlace.options[destPlace.selectedIndex]?.textContent || "";
  routeData = null;
  routeRequestSeq += 1;
  updateRouteText();
  requestRoute("destination-place");
});
destPlace.addEventListener("change", () => liveOnly(`${t("destination")}: ${destPlace.options[destPlace.selectedIndex]?.textContent || ""}`));
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

canvas.addEventListener("keydown", event => {
  const step = 40;
  if (event.key === "ArrowLeft") view.x += step;
  else if (event.key === "ArrowRight") view.x -= step;
  else if (event.key === "ArrowUp") view.y += step;
  else if (event.key === "ArrowDown") view.y -= step;
  else if (event.key === "+" || event.key === "=") zoomAt(1.2);
  else if (event.key === "-" || event.key === "_") zoomAt(0.85);
  else if (event.key === "0") centerOnCurrent();
  else return;
  event.preventDefault();
  clampView();
  updateLocationText();
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
    destinationActive = true;
    fillSelects();
    destPlace.value = match.id;
    destinationSearch.value = text(match);
    statusBox.textContent = `${t("matchedDestination")}: ${text(match)}`;
    await requestRoute("destination-search");
    liveOnly(`${t("matchedDestination")}: ${text(match)}`);
  } catch {
    statusBox.textContent = t("noDestinationMatch");
    autoNavigateSpeak(t("noDestinationMatch"), true);
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

init();
