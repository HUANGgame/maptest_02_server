const dict = {
  zh: {
    adminLogin: "管理員登入",
    password: "密碼",
    login: "登入",
    passwordNote: "預設開發密碼請看 README；正式部署請用 ADMIN_PASSWORD 環境變數設定。",
    wallMaps: "固定牆面地圖",
    floor: "樓層",
    heading: "面向角度",
    calibrationPhoto: "校正照片",
    imageHash: "影像指紋",
    note: "備註",
    saveWallMap: "儲存牆面地圖",
    operations: "營運狀態",
    refresh: "更新",
    accessPoints: "IP / Wi-Fi AP 位置",
    saveAp: "儲存 AP/IP 位置",
    loginFailed: "登入失敗",
    saved: "已儲存",
    loadFailed: "讀取失敗",
    noSessions: "尚無使用者活動",
    noEvents: "尚無事件",
    sources: "公開圖資參考",
    calibrated: "已校正",
    notCalibrated: "未校正",
    edit: "編輯"
  },
  en: {
    adminLogin: "Admin Login",
    password: "Password",
    login: "Login",
    passwordNote: "See README for the default development password. Use ADMIN_PASSWORD for production.",
    wallMaps: "Fixed Wall Maps",
    floor: "Floor",
    heading: "Heading",
    calibrationPhoto: "Calibration Photo",
    imageHash: "Image Hash",
    note: "Note",
    saveWallMap: "Save Wall Map",
    operations: "Operations",
    refresh: "Refresh",
    accessPoints: "IP / Wi-Fi AP Locations",
    saveAp: "Save AP/IP Location",
    loginFailed: "Login failed",
    saved: "Saved",
    loadFailed: "Load failed",
    noSessions: "No visitor activity yet",
    noEvents: "No events yet",
    sources: "Public Map References",
    calibrated: "Calibrated",
    notCalibrated: "Not calibrated",
    edit: "Edit"
  }
};

const langSelect = document.getElementById("langSelect");
const loginView = document.getElementById("loginView");
const adminView = document.getElementById("adminView");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginStatus = document.getElementById("loginStatus");
const boardForm = document.getElementById("boardForm");
const calibrationPhoto = document.getElementById("calibrationPhoto");
const referenceHash = document.getElementById("referenceHash");
const refreshBtn = document.getElementById("refreshBtn");
const adminTables = document.getElementById("adminTables");
const apForm = document.getElementById("apForm");

let lang = localStorage.getItem("lang") || "zh";
let config = null;
langSelect.value = lang;

function t(key) {
  return dict[lang][key] || dict.zh[key] || key;
}

function applyI18n() {
  document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
  document.querySelectorAll("[data-i18n]").forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
  logoutBtn.textContent = lang === "en" ? "Logout" : "登出";
}

langSelect.addEventListener("change", () => {
  lang = langSelect.value;
  localStorage.setItem("lang", lang);
  applyI18n();
  fillFloorSelects();
  loadAdmin();
});

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

async function init() {
  applyI18n();
  config = await api("/api/config");
  fillFloorSelects();
  await loadAdmin();
}

function fillFloorSelects() {
  if (!config) return;
  const options = Object.values(config.floors).map(floor =>
    `<option value="${floor.id}">${lang === "en" ? floor.nameEn : floor.nameZh}</option>`
  ).join("");
  document.getElementById("boardFloor").innerHTML = options;
  document.getElementById("apFloor").innerHTML = options;
}

async function login() {
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: passwordInput.value }) });
    await loadAdmin();
  } catch (error) {
    loginStatus.classList.remove("hidden");
    loginStatus.textContent = `${t("loginFailed")}: ${error.message}`;
  }
}

async function logout() {
  await api("/api/admin/logout", { method: "POST", body: "{}" });
  loginView.classList.remove("hidden");
  adminView.classList.add("hidden");
  logoutBtn.classList.add("hidden");
}

loginBtn.addEventListener("click", login);
passwordInput.addEventListener("keydown", event => {
  if (event.key === "Enter") login();
});
logoutBtn.addEventListener("click", logout);
refreshBtn.addEventListener("click", loadAdmin);

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

calibrationPhoto.addEventListener("change", async () => {
  const file = calibrationPhoto.files[0];
  if (file) referenceHash.value = await imageHash(file);
});

boardForm.addEventListener("submit", async event => {
  event.preventDefault();
  const board = {
    id: document.getElementById("boardId").value,
    nameZh: document.getElementById("boardNameZh").value,
    nameEn: document.getElementById("boardNameEn").value,
    floor: document.getElementById("boardFloor").value,
    x: document.getElementById("boardX").value,
    y: document.getElementById("boardY").value,
    heading: document.getElementById("boardHeading").value,
    referenceHash: referenceHash.value,
    note: document.getElementById("boardNote").value
  };
  await api("/api/admin/boards", { method: "POST", body: JSON.stringify(board) });
  config = await api("/api/config");
  await loadAdmin();
  alert(t("saved"));
});

apForm.addEventListener("submit", async event => {
  event.preventDefault();
  const ap = {
    id: document.getElementById("apId").value,
    name: document.getElementById("apName").value,
    ip: document.getElementById("apIp").value,
    ssid: document.getElementById("apSsid").value,
    floor: document.getElementById("apFloor").value,
    x: document.getElementById("apX").value,
    y: document.getElementById("apY").value,
    note: document.getElementById("apNote").value
  };
  await api("/api/admin/access-points", { method: "POST", body: JSON.stringify(ap) });
  config = await api("/api/config");
  await loadAdmin();
  alert(t("saved"));
});

async function loadAdmin() {
  try {
    const data = await api("/api/admin/summary");
    loginView.classList.add("hidden");
    adminView.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    renderTables(data);
  } catch (error) {
    loginView.classList.remove("hidden");
    adminView.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    if (error.message && !error.message.includes("required")) {
      loginStatus.classList.remove("hidden");
      loginStatus.textContent = `${t("loadFailed")}: ${error.message}`;
    }
  }
}

function renderTables(data) {
  adminTables.innerHTML = `
    <h3>${t("wallMaps")}</h3>
    <table><thead><tr><th>ID</th><th>${t("floor")}</th><th>XY</th><th>${t("imageHash")}</th><th></th></tr></thead>
    <tbody>${data.boards.map(board => `
      <tr>
        <td>${escapeHtml(lang === "en" ? board.nameEn : board.nameZh)}<br><span class="muted">${escapeHtml(board.id)}</span></td>
        <td>${escapeHtml(board.floor)}</td>
        <td>${Number(board.x).toFixed(0)}, ${Number(board.y).toFixed(0)}</td>
        <td>${board.referenceHash ? t("calibrated") : t("notCalibrated")}</td>
        <td><button type="button" data-board="${escapeHtml(board.id)}">${t("edit")}</button></td>
      </tr>`).join("")}</tbody></table>

    <h3>${t("accessPoints")}</h3>
    <table><thead><tr><th>ID</th><th>IP / SSID</th><th>${t("floor")}</th><th>XY</th></tr></thead>
    <tbody>${data.accessPoints.map(ap => `
      <tr>
        <td>${escapeHtml(ap.name)}<br><span class="muted">${escapeHtml(ap.id)}</span></td>
        <td>${escapeHtml(ap.ip)}<br><span class="muted">${escapeHtml(ap.ssid)}</span></td>
        <td>${escapeHtml(ap.floor)}</td>
        <td>${Number(ap.x).toFixed(0)}, ${Number(ap.y).toFixed(0)}</td>
      </tr>`).join("")}</tbody></table>

    <h3>Sessions</h3>
    <table><thead><tr><th>Session</th><th>Last seen</th><th>Current</th></tr></thead>
    <tbody>${data.sessions.map(session => `
      <tr>
        <td>${escapeHtml(session.id)}<br><span class="muted">${session.eventCount} events</span></td>
        <td>${escapeHtml(session.lastSeen)}</td>
        <td><pre class="muted">${escapeHtml(JSON.stringify(session.current, null, 2))}</pre></td>
      </tr>`).join("") || `<tr><td colspan="3">${t("noSessions")}</td></tr>`}</tbody></table>

    <h3>${t("sources")}</h3>
    <ul class="source-list">${data.sources.map(source => `
      <li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a><br>
      <span class="muted">${escapeHtml(lang === "en" ? source.noteEn : source.noteZh)}</span></li>`).join("")}</ul>

    <h3>Events</h3>
    <table><thead><tr><th>Time</th><th>Type</th><th>Payload</th></tr></thead>
    <tbody>${data.events.slice(0, 40).map(event => `
      <tr><td>${escapeHtml(event.at)}</td><td>${escapeHtml(event.type)}</td><td><pre class="muted">${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre></td></tr>`).join("") || `<tr><td colspan="3">${t("noEvents")}</td></tr>`}</tbody></table>
  `;
  adminTables.querySelectorAll("[data-board]").forEach(button => {
    button.addEventListener("click", () => editBoard(data.boards.find(board => board.id === button.dataset.board)));
  });
}

function editBoard(board) {
  if (!board) return;
  document.getElementById("boardId").value = board.id;
  document.getElementById("boardNameZh").value = board.nameZh;
  document.getElementById("boardNameEn").value = board.nameEn;
  document.getElementById("boardFloor").value = board.floor;
  document.getElementById("boardX").value = board.x;
  document.getElementById("boardY").value = board.y;
  document.getElementById("boardHeading").value = board.heading || 0;
  referenceHash.value = board.referenceHash || "";
  document.getElementById("boardNote").value = board.note || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

init();
