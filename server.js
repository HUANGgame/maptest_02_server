import http from "http";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "state.json");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "TaipeiStationAdmin2026!";
const ADMIN_TOKEN = randomBytes(32).toString("hex");
const CANVAS_WIDTH = 1100;
const CANVAS_HEIGHT = 720;

const floors = {
  B1: { id: "B1", nameZh: "B1 地下街層", nameEn: "B1 Underground Mall", order: 1 },
  B2: { id: "B2", nameZh: "B2 捷運大廳", nameEn: "B2 MRT Concourse", order: 2 },
  B3: { id: "B3", nameZh: "B3 捷運轉乘層", nameEn: "B3 MRT Transfer", order: 3 }
};

const graphNodes = {
  M1: { x: 590, y: 125, labelZh: "M1/M2 北側通道", labelEn: "M1/M2 North Passage" },
  NORTH: { x: 540, y: 220, labelZh: "北側通廊", labelEn: "North Passage" },
  WEST: { x: 245, y: 355, labelZh: "西側通廊", labelEn: "West Passage" },
  CENTER: { x: 545, y: 360, labelZh: "台北車站 M 區中央", labelEn: "Taipei Station M Area Center" },
  EAST: { x: 745, y: 350, labelZh: "東側通廊", labelEn: "East Passage" },
  SOUTH: { x: 555, y: 535, labelZh: "站前地下街連通", labelEn: "Station Front Mall Link" },
  M3: { x: 790, y: 545, labelZh: "M3 出口", labelEn: "Exit M3" },
  M4: { x: 675, y: 585, labelZh: "M4 出口", labelEn: "Exit M4" },
  M5: { x: 430, y: 595, labelZh: "M5 出口", labelEn: "Exit M5" },
  M6: { x: 520, y: 650, labelZh: "M6 出口", labelEn: "Exit M6" },
  M7: { x: 910, y: 565, labelZh: "M7 出口", labelEn: "Exit M7" },
  M8: { x: 680, y: 665, labelZh: "M8 出口", labelEn: "Exit M8" },
  ELEVATOR: { x: 630, y: 505, labelZh: "電梯 / 樓梯", labelEn: "Elevator / Stairs" },
  Y_LINK: { x: 120, y: 355, labelZh: "台北地下街 Y 區方向", labelEn: "Taipei City Mall Y Area" },
  Z_LINK: { x: 560, y: 690, labelZh: "站前地下街 Z 區方向", labelEn: "Station Front Mall Z Area" }
};

const graphEdges = [
  ["M1", "NORTH"], ["NORTH", "CENTER"], ["WEST", "CENTER"], ["CENTER", "EAST"],
  ["CENTER", "SOUTH"], ["SOUTH", "M5"], ["SOUTH", "M6"], ["SOUTH", "M4"],
  ["SOUTH", "ELEVATOR"], ["ELEVATOR", "M3"], ["EAST", "M3"], ["M3", "M7"],
  ["M4", "M8"], ["WEST", "Y_LINK"], ["SOUTH", "Z_LINK"]
];

const places = {
  M1: { x: 590, y: 125, labelZh: "M1 / M2 出口", labelEn: "Exit M1 / M2", node: "M1" },
  M3: { x: 790, y: 545, labelZh: "M3 出口", labelEn: "Exit M3", node: "M3" },
  M4: { x: 675, y: 585, labelZh: "M4 出口", labelEn: "Exit M4", node: "M4" },
  M5: { x: 430, y: 595, labelZh: "M5 出口", labelEn: "Exit M5", node: "M5" },
  M6: { x: 520, y: 650, labelZh: "M6 出口", labelEn: "Exit M6", node: "M6" },
  M7: { x: 910, y: 565, labelZh: "M7 出口", labelEn: "Exit M7", node: "M7" },
  M8: { x: 680, y: 665, labelZh: "M8 出口", labelEn: "Exit M8", node: "M8" },
  elevator: { x: 630, y: 505, labelZh: "電梯 / 樓梯", labelEn: "Elevator / Stairs", node: "ELEVATOR" },
  yMall: { x: 120, y: 355, labelZh: "台北地下街 Y 區方向", labelEn: "Taipei City Mall Y Area", node: "Y_LINK" },
  zMall: { x: 560, y: 690, labelZh: "站前地下街 Z 區方向", labelEn: "Station Front Mall Z Area", node: "Z_LINK" }
};

const mapSources = [
  {
    title: "台北車站地下商場 / M 區說明",
    url: "https://zh.wikipedia.org/wiki/%E5%8F%B0%E5%8C%97%E8%BB%8A%E7%AB%99%E5%9C%B0%E4%B8%8B%E5%95%86%E5%A0%B4",
    noteZh: "公開資料指出台北車站地下商場又稱 M 區，主要連接 M3 至 M8 出入口；M1/M2 主要供捷運台北車站使用。",
    noteEn: "Public references describe the M area and exits M3-M8; M1/M2 mainly serve the MRT station area."
  },
  {
    title: "台北車站地下街配置圖",
    url: "https://commons.wikimedia.org/wiki/File:%E5%8F%B0%E5%8C%97%E8%BB%8A%E7%AB%99%E5%9C%B0%E4%B8%8B%E8%A1%97%E9%85%8D%E7%BD%AE%E5%9C%96.png",
    noteZh: "可作為原型地圖配置參考；正式部署請使用授權明確的站內平面圖或自行繪製圖資。",
    noteEn: "Useful as a prototype reference; production should use properly licensed or self-drawn map assets."
  },
  {
    title: "台北車站 Y/Z/K/M/R 地下街互動地圖",
    url: "https://ju0520.github.io/Taipei_Station/",
    noteZh: "民間整理的互動圖，可輔助確認 Y、Z、K、M、R 區相對關係。",
    noteEn: "Community interactive map for the relative layout of Y, Z, K, M, and R areas."
  }
];

const defaultState = {
  mapBoards: [
    { id: "M-B1-CENTER-01", nameZh: "M 區中央牆面地圖", nameEn: "M Area Center Wall Map", floor: "B1", x: 545, y: 360, heading: 0, referenceHash: "", note: "台北車站地下街 M 區中央" },
    { id: "M-B1-EAST-01", nameZh: "M3/M7 方向牆面地圖", nameEn: "M3/M7 Side Wall Map", floor: "B1", x: 745, y: 350, heading: 270, referenceHash: "", note: "靠近 M3/M7 方向" },
    { id: "M-B1-SOUTH-01", nameZh: "站前地下街連通地圖", nameEn: "Station Front Link Wall Map", floor: "B1", x: 555, y: 535, heading: 180, referenceHash: "", note: "通往 Z 區/站前地下街方向" },
    { id: "M-B1-WEST-01", nameZh: "Y 區方向牆面地圖", nameEn: "Y Area Side Wall Map", floor: "B1", x: 245, y: 355, heading: 90, referenceHash: "", note: "通往台北地下街 Y 區方向" }
  ],
  accessPoints: [
    { id: "AP-M-CENTER", name: "M Area Wi-Fi AP Center", ip: "10.10.20.11", ssid: "TPE-Free", floor: "B1", x: 545, y: 360, note: "示範資料，請用現場 AP/IP 清冊替換" },
    { id: "AP-M-EAST", name: "M Area Wi-Fi AP East", ip: "10.10.20.12", ssid: "TPE-Free", floor: "B1", x: 745, y: 350, note: "示範資料，非公開精確位置" }
  ],
  sessions: {},
  events: []
};

let state = structuredClone(defaultState);

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildAdjacency() {
  const out = Object.fromEntries(Object.keys(graphNodes).map(key => [key, []]));
  for (const [a, b] of graphEdges) {
    const weight = distance(graphNodes[a], graphNodes[b]);
    out[a].push({ node: b, weight });
    out[b].push({ node: a, weight });
  }
  return out;
}

const adjacency = buildAdjacency();

async function loadState() {
  try {
    const saved = JSON.parse(await readFile(dataFile, "utf8"));
    state = {
      ...structuredClone(defaultState),
      ...saved,
      mapBoards: migrateBoards(saved.mapBoards),
      accessPoints: Array.isArray(saved.accessPoints) ? saved.accessPoints : structuredClone(defaultState.accessPoints),
      sessions: saved.sessions && typeof saved.sessions === "object" ? saved.sessions : {},
      events: Array.isArray(saved.events) ? saved.events : []
    };
  } catch {
    await saveState();
  }
}

function migrateBoards(boards) {
  if (!Array.isArray(boards) || boards.length === 0) return structuredClone(defaultState.mapBoards);
  const oldDemoData = boards.some(board => ["B-WEST-01", "B-CENTER-01", "B-EAST-01", "A-CENTER-01", "C-CENTER-01"].includes(board.id));
  if (oldDemoData) return structuredClone(defaultState.mapBoards);
  return boards.map(board => ({
    id: clean(board.id, 80) || randomUUID(),
    nameZh: clean(board.nameZh || board.name, 120) || clean(board.id, 80),
    nameEn: clean(board.nameEn || board.name, 120) || clean(board.id, 80),
    floor: floors[board.floor] ? board.floor : "B1",
    x: clamp(board.x, 0, CANVAS_WIDTH, CANVAS_WIDTH / 2),
    y: clamp(board.y, 0, CANVAS_HEIGHT, CANVAS_HEIGHT / 2),
    heading: clamp(board.heading, 0, 359, 0),
    referenceHash: clean(board.referenceHash, 512),
    note: clean(board.note, 400)
  }));
}

async function saveState() {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify({
    mapBoards: state.mapBoards,
    accessPoints: state.accessPoints,
    sessions: state.sessions,
    events: state.events.slice(-800)
  }, null, 2), "utf8");
}

function nearestNode(point) {
  let bestKey = "CENTER";
  let bestDistance = Infinity;
  for (const [key, node] of Object.entries(graphNodes)) {
    const d = distance(point, node);
    if (d < bestDistance) {
      bestKey = key;
      bestDistance = d;
    }
  }
  return { key: bestKey, distance: bestDistance };
}

function shortestPath(startKey, endKey) {
  const distances = {};
  const previous = {};
  const open = new Set(Object.keys(graphNodes));
  for (const key of open) {
    distances[key] = Infinity;
    previous[key] = null;
  }
  distances[startKey] = 0;
  while (open.size > 0) {
    let current = null;
    for (const key of open) {
      if (current === null || distances[key] < distances[current]) current = key;
    }
    if (!current || distances[current] === Infinity || current === endKey) break;
    open.delete(current);
    for (const edge of adjacency[current]) {
      if (!open.has(edge.node)) continue;
      const alternative = distances[current] + edge.weight;
      if (alternative < distances[edge.node]) {
        distances[edge.node] = alternative;
        previous[edge.node] = current;
      }
    }
  }
  const pathKeys = [];
  let cursor = endKey;
  while (cursor) {
    pathKeys.unshift(cursor);
    cursor = previous[cursor];
  }
  if (pathKeys[0] !== startKey) return { pathKeys: [], totalDistance: Infinity };
  return { pathKeys, totalDistance: distances[endKey] };
}

function hamming(a = "", b = "") {
  const len = Math.min(a.length, b.length);
  if (!len) return Infinity;
  let diff = Math.abs(a.length - b.length);
  for (let i = 0; i < len; i += 1) if (a[i] !== b[i]) diff += 1;
  return diff;
}

function locateByPhoto(body, req) {
  const sessionId = clean(body.sessionId, 80) || randomUUID();
  const photoHash = clean(body.photoHash, 512);
  const hintedFloor = floors[body.floor] ? body.floor : "";
  const candidates = state.mapBoards
    .filter(board => !hintedFloor || board.floor === hintedFloor)
    .map(board => {
      const hasHash = Boolean(board.referenceHash && photoHash);
      const diff = hasHash ? hamming(photoHash, board.referenceHash) : 999;
      const hashScore = hasHash ? Math.max(0, 1 - diff / Math.max(photoHash.length, board.referenceHash.length)) : 0;
      const score = Math.min(1, hashScore + (hintedFloor === board.floor ? 0.08 : 0));
      return { board, diff, score, method: hasHash ? "photo-hash" : "floor-fallback" };
    })
    .sort((a, b) => b.score - a.score || a.diff - b.diff);

  const best = candidates[0];
  if (!best) return jsonError(404, "No registered wall maps.");

  const confidence = Number(best.score.toFixed(3));
  const usable = (best.method === "photo-hash" && confidence >= 0.72) || (best.method === "floor-fallback" && hintedFloor);
  if (!usable) return jsonError(422, "Photo does not match a calibrated wall map. Please calibrate it in admin first.");

  const location = {
    source: best.method,
    confidence,
    boardId: best.board.id,
    boardNameZh: best.board.nameZh,
    boardNameEn: best.board.nameEn,
    floor: best.board.floor,
    x: Number(best.board.x),
    y: Number(best.board.y),
    heading: Number(best.board.heading || 0)
  };
  recordSession(sessionId, "photo-location", {
    location,
    clientIp: clientIp(req),
    userAgent: clean(body.userAgent, 180)
  });
  return jsonOk({
    sessionId,
    location,
    candidates: candidates.slice(0, 5).map(item => ({
      id: item.board.id,
      nameZh: item.board.nameZh,
      nameEn: item.board.nameEn,
      floor: item.board.floor,
      confidence: Number(item.score.toFixed(3)),
      hashDiff: item.diff,
      method: item.method
    }))
  });
}

function route(body, req) {
  const currentFloor = floors[body.currentFloor] ? body.currentFloor : "B1";
  const destFloor = floors[body.destFloor] ? body.destFloor : currentFloor;
  const destPlace = places[body.destPlace] ? body.destPlace : "M3";
  const position = { x: Number(body.position?.x), y: Number(body.position?.y) };
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return jsonError(400, "position.x and position.y must be numbers.");

  const sameFloor = currentFloor === destFloor;
  const routeTarget = sameFloor ? destPlace : "elevator";
  const destination = places[routeTarget];
  const snap = nearestNode(position);
  const result = shortestPath(snap.key, destination.node);
  const path = result.pathKeys.map(key => ({ id: key, ...graphNodes[key] }));
  const verticalDiff = floors[destFloor].order - floors[currentFloor].order;
  const verticalDirection = verticalDiff > 0 ? "down" : verticalDiff < 0 ? "up" : "same";
  const sessionId = clean(body.sessionId, 80);
  if (sessionId) recordSession(sessionId, "route", {
    currentFloor,
    destFloor,
    destPlace,
    position,
    routeTarget,
    totalDistance: Math.round(result.totalDistance),
    clientIp: clientIp(req)
  });

  return jsonOk({
    currentFloor,
    destFloor,
    destPlace,
    routeTarget,
    sameFloor,
    verticalDirection,
    start: { x: position.x, y: position.y, nearestNode: snap.key, snapDistance: Math.round(snap.distance) },
    destination,
    path,
    pathKeys: result.pathKeys,
    totalDistance: Math.round(result.totalDistance)
  });
}

function recordSession(sessionId, type, payload) {
  const at = new Date().toISOString();
  const session = state.sessions[sessionId] || { id: sessionId, firstSeen: at, lastSeen: at, eventCount: 0, current: {} };
  session.lastSeen = at;
  session.eventCount += 1;
  session.current = { ...session.current, ...payload };
  state.sessions[sessionId] = session;
  state.events.push({ id: randomUUID(), sessionId, type, at, payload });
  state.events = state.events.slice(-800);
  void saveState();
}

function adminSummary() {
  return {
    boards: state.mapBoards,
    accessPoints: state.accessPoints,
    sessions: Object.values(state.sessions).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
    events: state.events.slice(-150).reverse(),
    sources: mapSources
  };
}

function updateBoard(body) {
  const id = clean(body.id, 80);
  if (!id) return jsonError(400, "Board id is required.");
  const board = {
    id,
    nameZh: clean(body.nameZh, 120) || id,
    nameEn: clean(body.nameEn, 120) || id,
    floor: floors[body.floor] ? body.floor : "B1",
    x: clamp(body.x, 0, CANVAS_WIDTH, CANVAS_WIDTH / 2),
    y: clamp(body.y, 0, CANVAS_HEIGHT, CANVAS_HEIGHT / 2),
    heading: clamp(body.heading, 0, 359, 0),
    referenceHash: clean(body.referenceHash, 512),
    note: clean(body.note, 400)
  };
  const index = state.mapBoards.findIndex(item => item.id === id);
  if (index >= 0) state.mapBoards[index] = board;
  else state.mapBoards.push(board);
  void saveState();
  return jsonOk({ board, boards: state.mapBoards });
}

function updateAccessPoint(body) {
  const id = clean(body.id, 80);
  if (!id) return jsonError(400, "Access point id is required.");
  const ap = {
    id,
    name: clean(body.name, 120) || id,
    ip: clean(body.ip, 80),
    ssid: clean(body.ssid, 80),
    floor: floors[body.floor] ? body.floor : "B1",
    x: clamp(body.x, 0, CANVAS_WIDTH, CANVAS_WIDTH / 2),
    y: clamp(body.y, 0, CANVAS_HEIGHT, CANVAS_HEIGHT / 2),
    note: clean(body.note, 400)
  };
  const index = state.accessPoints.findIndex(item => item.id === id);
  if (index >= 0) state.accessPoints[index] = ap;
  else state.accessPoints.push(ap);
  void saveState();
  return jsonOk({ accessPoint: ap, accessPoints: state.accessPoints });
}

function config() {
  return {
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    floors,
    places,
    graphNodes,
    graphEdges,
    mapBoards: state.mapBoards,
    accessPoints: state.accessPoints,
    sources: mapSources
  };
}

function login(body) {
  const password = clean(body.password, 200);
  if (!safeEqual(hash(password), hash(ADMIN_PASSWORD))) return jsonError(401, "Invalid password.");
  return jsonOk({ ok: true, token: ADMIN_TOKEN });
}

function isAdmin(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
  if (!match) return false;
  return safeEqual(match[1], ADMIN_TOKEN);
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  sendJson(res, 401, { error: "Admin login required." });
  return false;
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest();
}

function safeEqual(a, b) {
  const left = Buffer.isBuffer(a) ? a : Buffer.from(String(a));
  const right = Buffer.isBuffer(b) ? b : Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function clientIp(req) {
  const forwarded = clean(req.headers["x-forwarded-for"], 160);
  return forwarded.split(",")[0] || req.socket.remoteAddress || "";
}

function clean(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function jsonOk(data) {
  return { status: 200, data };
}

function jsonError(status, message) {
  return { status, data: { error: message } };
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(data, null, 2));
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
  });
}

function typeFor(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function serveStatic(res, pathname) {
  let safePath = pathname;
  if (pathname === "/") safePath = "/index.html";
  if (pathname === "/admin") safePath = "/admin.html";
  const filePath = path.normalize(path.join(publicDir, safePath));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": typeFor(filePath), "Cache-Control": "no-store" });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

await loadState();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, message: "Taipei Station photo navigation server is running.", port: PORT });
    }
    if (req.method === "GET" && url.pathname === "/api/config") return sendJson(res, 200, config());
    if (req.method === "POST" && url.pathname === "/api/location/photo") {
      const result = locateByPhoto(await readJson(req), req);
      return sendJson(res, result.status, result.data);
    }
    if (req.method === "POST" && url.pathname === "/api/route") {
      const result = route(await readJson(req), req);
      return sendJson(res, result.status, result.data);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      const result = login(await readJson(req));
      const headers = result.status === 200
        ? { "Set-Cookie": `admin_token=${ADMIN_TOKEN}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` }
        : {};
      return sendJson(res, result.status, result.data, headers);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      return sendJson(res, 200, { ok: true }, { "Set-Cookie": "admin_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
    }
    if (url.pathname.startsWith("/api/admin/")) {
      if (!requireAdmin(req, res)) return;
      if (req.method === "GET" && url.pathname === "/api/admin/summary") return sendJson(res, 200, adminSummary());
      if (req.method === "POST" && url.pathname === "/api/admin/boards") {
        const result = updateBoard(await readJson(req));
        return sendJson(res, result.status, result.data);
      }
      if (req.method === "POST" && url.pathname === "/api/admin/access-points") {
        const result = updateAccessPoint(await readJson(req));
        return sendJson(res, result.status, result.data);
      }
    }
    if (req.method === "GET") return serveStatic(res, url.pathname);
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

function listen(port, attemptsLeft = 10) {
  server.once("error", error => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });
  server.listen(port, () => {
    const actualPort = server.address().port;
    console.log(`Server running at http://localhost:${actualPort}`);
    console.log(`User app: http://localhost:${actualPort}/`);
    console.log(`Admin app: http://localhost:${actualPort}/admin`);
    if (!process.env.ADMIN_PASSWORD) console.log("Default admin password: TaipeiStationAdmin2026!");
  });
}

listen(PORT);
