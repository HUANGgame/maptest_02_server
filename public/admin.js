const dict = {
  zh: {
    title: "台北車站地下街定位後台",
    subtitle: "維護牆面地圖、IP/AP 點位與目的地資料",
    openUser: "開啟使用者頁",
    logout: "登出",
    adminLogin: "管理員登入",
    loginHint: "請輸入管理員密碼後再維護資料。",
    password: "密碼",
    login: "登入",
    dashboard: "總覽",
    wallMaps: "牆面地圖",
    network: "IP / AP 點位",
    destinations: "目的地分類",
    activity: "使用者紀錄",
    refresh: "重新整理",
    quickActions: "快速維護",
    addWallMap: "新增或校正牆面地圖",
    addWallMapHint: "現場拍一張牆上地圖，填入位置後儲存。",
    addNetwork: "維護 IP / AP 點位",
    addNetworkHint: "更新每個區域的 IP、SSID 與地圖座標。",
    checkDestinations: "查看目的地分類",
    checkDestinationsHint: "確認使用者搜尋能對到正確區域。",
    wallMapHelp: "每一張固定牆面地圖都要先在這裡存座標與校正照片。使用者拍照後會自動切換底圖、更新位置與 IP。",
    newWallMap: "新增牆面地圖",
    basicInfo: "基本資料",
    nameZh: "中文名稱",
    nameEn: "英文名稱",
    floor: "樓層",
    heading: "地圖面向",
    locationOnMap: "地圖座標",
    note: "備註",
    photoCalibration: "拍照校正",
    photoHelp: "現場對著牆面地圖拍照，系統會產生影像指紋。之後使用者拍到同一張地圖，就能自動定位。",
    calibrationPhoto: "校正照片",
    imageHash: "影像指紋",
    saveWallMap: "儲存牆面地圖",
    networkHelp: "把現場網路設備的位置記在這裡，使用者定位後會顯示最近的 IP/AP。",
    newAp: "新增 AP/IP",
    apName: "設備名稱",
    saveAp: "儲存 AP/IP",
    destinationHelp: "這裡列出目前使用者可以搜尋的地點與分類，方便你確認中英文辨識結果。",
    searchDestination: "搜尋目的地",
    loginFailed: "登入失敗",
    saved: "已儲存",
    loadFailed: "讀取失敗",
    noSessions: "還沒有使用者紀錄",
    noEvents: "還沒有事件",
    noData: "目前沒有資料",
    calibrated: "已校正",
    notCalibrated: "未校正",
    edit: "編輯",
    recentUsers: "近期使用者",
    recentEvents: "近期事件",
    publicSources: "公開地圖來源",
    boardsStat: "牆面地圖",
    calibratedStat: "已校正",
    apsStat: "AP/IP 點位",
    usersStat: "使用者",
    category: "分類",
    aliases: "可辨識關鍵字",
    lastSeen: "最後活動",
    currentLocation: "目前位置"
  },
  en: {
    title: "Taipei Station Photo Navigation Admin",
    subtitle: "Maintain wall maps, IP/AP locations, and destination data",
    openUser: "Open User Page",
    logout: "Logout",
    adminLogin: "Admin Login",
    loginHint: "Enter the admin password before editing data.",
    password: "Password",
    login: "Login",
    dashboard: "Dashboard",
    wallMaps: "Wall Maps",
    network: "IP / AP Locations",
    destinations: "Destination Categories",
    activity: "User Activity",
    refresh: "Refresh",
    quickActions: "Quick Maintenance",
    addWallMap: "Add or Calibrate Wall Map",
    addWallMapHint: "Take a wall-map photo on site, enter its position, and save.",
    addNetwork: "Maintain IP / AP Locations",
    addNetworkHint: "Update each area IP, SSID, and map coordinate.",
    checkDestinations: "Review Destination Categories",
    checkDestinationsHint: "Confirm search terms resolve to the right area.",
    wallMapHelp: "Save each fixed wall-map coordinate and calibration photo here. After a user takes a photo, the app switches the base map and updates position and IP.",
    newWallMap: "New Wall Map",
    basicInfo: "Basic Info",
    nameZh: "Chinese Name",
    nameEn: "English Name",
    floor: "Floor",
    heading: "Heading",
    locationOnMap: "Map Coordinate",
    note: "Note",
    photoCalibration: "Photo Calibration",
    photoHelp: "Take a photo of the fixed wall map. The system creates an image fingerprint so future user photos can match it.",
    calibrationPhoto: "Calibration Photo",
    imageHash: "Image Fingerprint",
    saveWallMap: "Save Wall Map",
    networkHelp: "Register network-device locations here. After positioning, users see the nearest IP/AP.",
    newAp: "New AP/IP",
    apName: "Device Name",
    saveAp: "Save AP/IP",
    destinationHelp: "Current searchable destinations and categories are listed here for Chinese/English recognition checks.",
    searchDestination: "Search Destination",
    loginFailed: "Login failed",
    saved: "Saved",
    loadFailed: "Load failed",
    noSessions: "No user activity yet",
    noEvents: "No events yet",
    noData: "No data",
    calibrated: "Calibrated",
    notCalibrated: "Not calibrated",
    edit: "Edit",
    recentUsers: "Recent Users",
    recentEvents: "Recent Events",
    publicSources: "Public Map Sources",
    boardsStat: "Wall Maps",
    calibratedStat: "Calibrated",
    apsStat: "AP/IP Points",
    usersStat: "Users",
    category: "Category",
    aliases: "Recognized Keywords",
    lastSeen: "Last seen",
    currentLocation: "Current location"
  }
};

const elements = {
  langSelect: document.getElementById("langSelect"),
  loginView: document.getElementById("loginView"),
  adminView: document.getElementById("adminView"),
  passwordInput: document.getElementById("passwordInput"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginStatus: document.getElementById("loginStatus"),
  refreshBtn: document.getElementById("refreshBtn"),
  statCards: document.getElementById("statCards"),
  dashboardLists: document.getElementById("dashboardLists"),
  boardForm: document.getElementById("boardForm"),
  calibrationPhoto: document.getElementById("calibrationPhoto"),
  referenceHash: document.getElementById("referenceHash"),
  boardList: document.getElementById("boardList"),
  apForm: document.getElementById("apForm"),
  apList: document.getElementById("apList"),
  wifiFingerprintPanel: document.getElementById("wifiFingerprintPanel"),
  destinationFilter: document.getElementById("destinationFilter"),
  destinationEditor: document.getElementById("destinationEditor"),
  destinationList: document.getElementById("destinationList"),
  activityPanel: document.getElementById("activityPanel"),
  newBoardBtn: document.getElementById("newBoardBtn"),
  newApBtn: document.getElementById("newApBtn")
};

let lang = localStorage.getItem("lang") || "zh";
let config = null;
let summary = null;
let activeTab = "dashboard";
let selectedDestinationId = "";
let adminBaseMapImage = null;

elements.langSelect.value = lang;

function t(key) {
  return dict[lang][key] || dict.zh[key] || key;
}

function applyI18n() {
  document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
  document.querySelectorAll("[data-i18n]").forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
}

function setTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll(".nav-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  document.querySelectorAll(".admin-tab").forEach(section => section.classList.add("hidden"));
  document.getElementById(`${tabName}Tab`).classList.remove("hidden");
}

async function api(url, options = {}) {
  const headers = options.body instanceof FormData ? options.headers : { "Content-Type": "application/json", ...(options.headers || {}) };
  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

async function init() {
  applyI18n();
  bindEvents();
  config = await api("/api/config");
  fillFloorSelects();
  await loadAdmin();
}

function bindEvents() {
  elements.langSelect.addEventListener("change", async () => {
    lang = elements.langSelect.value;
    localStorage.setItem("lang", lang);
    applyI18n();
    fillFloorSelects();
    renderAll();
  });
  elements.loginBtn.addEventListener("click", login);
  elements.passwordInput.addEventListener("keydown", event => {
    if (event.key === "Enter") login();
  });
  elements.logoutBtn.addEventListener("click", logout);
  elements.refreshBtn.addEventListener("click", loadAdmin);
  document.querySelectorAll(".nav-tab").forEach(button => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  document.querySelectorAll("[data-jump]").forEach(button => {
    button.addEventListener("click", () => setTab(button.dataset.jump));
  });
  elements.calibrationPhoto.addEventListener("change", handleCalibrationPhoto);
  elements.boardForm.addEventListener("submit", saveBoard);
  elements.apForm.addEventListener("submit", saveAp);
  elements.destinationFilter.addEventListener("input", renderDestinations);
  elements.newBoardBtn.addEventListener("click", resetBoardForm);
  elements.newApBtn.addEventListener("click", resetApForm);
}

function fillFloorSelects() {
  if (!config) return;
  const options = Object.values(config.floors).map(floor =>
    `<option value="${floor.id}">${escapeHtml(lang === "en" ? floor.nameEn : floor.nameZh)}</option>`
  ).join("");
  document.getElementById("boardFloor").innerHTML = options;
  document.getElementById("apFloor").innerHTML = options;
}

async function login() {
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: elements.passwordInput.value }) });
    elements.loginStatus.classList.add("hidden");
    await loadAdmin();
  } catch (error) {
    elements.loginStatus.classList.remove("hidden");
    elements.loginStatus.textContent = `${t("loginFailed")}: ${error.message}`;
  }
}

async function logout() {
  await api("/api/admin/logout", { method: "POST", body: "{}" });
  elements.loginView.classList.remove("hidden");
  elements.adminView.classList.add("hidden");
  elements.logoutBtn.classList.add("hidden");
}

async function loadAdmin() {
  try {
    summary = await api("/api/admin/summary");
    config = await api("/api/config");
    if (config.baseMap?.image && !adminBaseMapImage) {
      adminBaseMapImage = new Image();
      adminBaseMapImage.src = config.baseMap.image;
      adminBaseMapImage.onload = () => drawAdminMap();
    }
    fillFloorSelects();
    elements.loginView.classList.add("hidden");
    elements.adminView.classList.remove("hidden");
    elements.logoutBtn.classList.remove("hidden");
    renderAll();
  } catch (error) {
    elements.loginView.classList.remove("hidden");
    elements.adminView.classList.add("hidden");
    elements.logoutBtn.classList.add("hidden");
    if (error.message && !error.message.includes("required")) {
      elements.loginStatus.classList.remove("hidden");
      elements.loginStatus.textContent = `${t("loadFailed")}: ${error.message}`;
    }
  }
}

function renderAll() {
  if (!summary || !config) return;
  renderDashboard();
  renderBoards();
  renderAccessPoints();
  renderWifiFingerprintsV2();
  renderDestinations();
  renderActivity();
  setTab(activeTab);
}

function renderDashboard() {
  const calibrated = summary.boards.filter(board => board.referenceHash).length;
  const sessions = summary.sessions.length;
  elements.statCards.innerHTML = [
    statCard(t("boardsStat"), summary.boards.length),
    statCard(t("calibratedStat"), `${calibrated}/${summary.boards.length}`),
    statCard(t("apsStat"), summary.accessPoints.length),
    statCard(t("usersStat"), sessions)
  ].join("");

  elements.dashboardLists.innerHTML = `
    <div class="panel">
      <h2>${t("wallMaps")}</h2>
      ${compactList(summary.boards.slice(0, 5).map(board => ({
        title: localName(board),
        detail: `${board.floor} · X ${Math.round(board.x)}, Y ${Math.round(board.y)} · ${board.referenceHash ? t("calibrated") : t("notCalibrated")}`
      })))}
    </div>
    <div class="panel">
      <h2>${t("recentUsers")}</h2>
      ${compactList(summary.sessions.slice(0, 5).map(session => ({
        title: session.id,
        detail: `${t("lastSeen")}: ${formatTime(session.lastSeen)} · ${session.eventCount} events`
      })), t("noSessions"))}
    </div>
  `;
}

function renderBoards() {
  elements.boardList.innerHTML = `
    <div class="section-head">
      <h2>${t("wallMaps")}</h2>
      <span class="muted">${summary.boards.length} items</span>
    </div>
    <div class="data-list">
      ${summary.boards.map(board => `
        <article class="data-row">
          <div>
            <strong>${escapeHtml(localName(board))}</strong>
            <div class="muted">${escapeHtml(board.id)} · ${escapeHtml(board.floor)} · X ${Math.round(board.x)}, Y ${Math.round(board.y)}</div>
            <div class="small ${board.referenceHash ? "ok-text" : "warn-text"}">${board.referenceHash ? t("calibrated") : t("notCalibrated")}</div>
          </div>
          <button type="button" data-edit-board="${escapeHtml(board.id)}">${t("edit")}</button>
        </article>
      `).join("") || `<p class="muted">${t("noData")}</p>`}
    </div>
  `;
  elements.boardList.querySelectorAll("[data-edit-board]").forEach(button => {
    button.addEventListener("click", () => {
      editBoard(summary.boards.find(board => board.id === button.dataset.editBoard));
      setTab("boards");
    });
  });
}

function renderAccessPoints() {
  elements.apList.innerHTML = `
    <div class="section-head">
      <h2>${t("network")}</h2>
      <span class="muted">${summary.accessPoints.length} items</span>
    </div>
    <div class="data-list">
      ${summary.accessPoints.map(ap => `
        <article class="data-row">
          <div>
            <strong>${escapeHtml(ap.name)}</strong>
            <div class="muted">${escapeHtml(ap.id)} · ${escapeHtml(ap.ip)} · ${escapeHtml(ap.ssid)}</div>
            <div class="small">${escapeHtml(ap.floor)} · X ${Math.round(ap.x)}, Y ${Math.round(ap.y)}</div>
          </div>
          <button type="button" data-edit-ap="${escapeHtml(ap.id)}">${t("edit")}</button>
        </article>
      `).join("") || `<p class="muted">${t("noData")}</p>`}
    </div>
  `;
  elements.apList.querySelectorAll("[data-edit-ap]").forEach(button => {
    button.addEventListener("click", () => editAp(summary.accessPoints.find(ap => ap.id === button.dataset.editAp)));
  });
}

function renderWifiFingerprintsV2() {
  if (!elements.wifiFingerprintPanel) return;
  const fingerprints = summary.wifiFingerprints || config.wifiFingerprints || [];
  const floorOptions = Object.values(config.floors).map(floor =>
    `<option value="${floor.id}">${escapeHtml(lang === "en" ? floor.nameEn : floor.nameZh)}</option>`
  ).join("");
  elements.wifiFingerprintPanel.innerHTML = `
    <div class="section-head">
      <div>
        <h2>${lang === "en" ? "Wi-Fi fingerprint demo" : "Wi-Fi 指紋定位 demo"}</h2>
        <p class="muted">${lang === "en" ? "Paste scan samples for each known campus point. User-side Wi-Fi location compares against these fingerprints." : "每個已知校園點位貼上 Wi-Fi 掃描樣本，使用者端會用這些指紋比對定位。"}</p>
      </div>
    </div>
    <form id="wifiFingerprintForm" class="easy-form">
      <div class="form-card">
        <h3>${lang === "en" ? "Point" : "點位"}</h3>
        <div class="field"><label for="wifiId">ID</label><input id="wifiId" value="WF-TKU-DEMO"></div>
        <div class="field"><label for="wifiLabelZh">中文名稱</label><input id="wifiLabelZh" value="淡江 Wi-Fi 指紋點"></div>
        <div class="field"><label for="wifiLabelEn">English name</label><input id="wifiLabelEn" value="Tamkang Wi-Fi Fingerprint"></div>
        <div class="row">
          <div class="field"><label for="wifiFloor">${t("floor")}</label><select id="wifiFloor">${floorOptions}</select></div>
          <div class="field"><label for="wifiX">X</label><input id="wifiX" type="number" value="440"></div>
          <div class="field"><label for="wifiY">Y</label><input id="wifiY" type="number" value="615"></div>
        </div>
      </div>
      <div class="form-card">
        <h3>${lang === "en" ? "Scan samples" : "掃描樣本"}</h3>
        <div class="field">
          <label for="wifiSamples">${lang === "en" ? "JSON or one line each: bssid,ssid,rssi" : "JSON 或每行一筆：bssid,ssid,rssi"}</label>
          <textarea id="wifiSamples" rows="7">aa:aa:aa:00:02,TKU-Library,-48
aa:aa:aa:00:03,TKU-Student,-72</textarea>
        </div>
        <div class="field"><label for="wifiNote">${t("note")}</label><textarea id="wifiNote"></textarea></div>
        <button class="primary" type="submit">${lang === "en" ? "Save Wi-Fi fingerprint" : "儲存 Wi-Fi 指紋"}</button>
      </div>
    </form>
    <div class="data-list">
      ${fingerprints.map(item => `
        <article class="data-row">
          <div>
            <strong>${escapeHtml(lang === "en" ? item.labelEn : item.labelZh)}</strong>
            <div class="muted">${escapeHtml(item.id)} · ${escapeHtml(item.floor)} · X ${Math.round(item.x)}, Y ${Math.round(item.y)}</div>
            <div class="small">${(item.samples || []).length} AP samples</div>
          </div>
          <button type="button" data-edit-wifi="${escapeHtml(item.id)}">${t("edit")}</button>
        </article>
      `).join("") || `<p class="muted">${t("noData")}</p>`}
    </div>
  `;
  document.getElementById("wifiFingerprintForm").addEventListener("submit", saveWifiFingerprint);
  elements.wifiFingerprintPanel.querySelectorAll("[data-edit-wifi]").forEach(button => {
    button.addEventListener("click", () => editWifiFingerprint(fingerprints.find(item => item.id === button.dataset.editWifi)));
  });
}

function renderDestinations() {
  const keyword = normalize(elements.destinationFilter.value);
  const places = Object.entries(config.places).map(([id, place]) => ({ id, ...place }));
  const filtered = places.filter(place => {
    const haystack = normalize([place.id, place.labelZh, place.labelEn, place.category, ...(place.aliases || [])].join(" "));
    return !keyword || haystack.includes(keyword);
  });
  const categories = Object.fromEntries(config.destinationCategories.map(category => [category.id, category]));
  const storeCount = (config.storeDirectory || []).length;
  const exitCount = (config.areaExitDirectory || []).length;
  renderDestinationEditor(places, categories);
  elements.destinationList.innerHTML = `
    <p class="muted">${lang === "en" ? "Shop directory" : "\u5e97\u92ea\u76ee\u9304"}: ${storeCount} ${lang === "en" ? "shops" : "\u7b46"}</p>
    <p class="muted">${lang === "en" ? "Exit directory" : "\u51fa\u53e3\u76ee\u9304"}: ${exitCount} ${lang === "en" ? "exits / area points" : "\u7b46"}</p>
    <div class="destination-chips">
      ${config.destinationCategories.map(category => `<span>${escapeHtml(localCategory(category))}</span>`).join("")}
    </div>
    <div class="data-list">
      ${filtered.map(place => `
        <article class="data-row destination-row">
          <div>
            <strong>${escapeHtml(lang === "en" ? place.labelEn : place.labelZh)}</strong>
            <div class="muted">${t("category")}: ${escapeHtml(localCategory(categories[place.category]) || place.category)}</div>
            ${place.shopNo ? `<div class="small">${lang === "en" ? "Shop No." : "\u5e97\u865f"}: ${escapeHtml(place.shopNo)} · ${lang === "en" ? "Area" : "\u5340\u57df"}: ${escapeHtml(place.area || "-")}</div>` : ""}
            ${place.exitCode ? `<div class="small">${lang === "en" ? "Exit" : "\u51fa\u53e3"}: ${escapeHtml(place.exitCode)} · ${lang === "en" ? "Area" : "\u5340\u57df"}: ${escapeHtml(place.area || "-")}</div>` : ""}
            <div class="small">${t("aliases")}: ${escapeHtml((place.aliases || []).join(", ") || "-")}</div>
          </div>
          <div class="row narrow-actions">
            <span class="pill">${escapeHtml(place.id)}</span>
            <button type="button" class="secondary" data-edit-destination="${escapeHtml(place.id)}">${lang === "en" ? "Edit on map" : "地圖校正"}</button>
          </div>
        </article>
      `).join("") || `<p class="muted">${t("noData")}</p>`}
    </div>
  `;
  elements.destinationList.querySelectorAll("[data-edit-destination]").forEach(button => {
    button.addEventListener("click", () => {
      selectedDestinationId = button.dataset.editDestination;
      renderDestinations();
      document.getElementById("destinationEditor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderDestinationEditor(places, categories) {
  if (!places.length || !elements.destinationEditor) return;
  if (!selectedDestinationId || !config.places[selectedDestinationId]) selectedDestinationId = places[0].id;
  const place = config.places[selectedDestinationId] || places[0];
  const floorOptions = Object.values(config.floors).map(floor =>
    `<option value="${floor.id}" ${floor.id === (place.floor || "B1") ? "selected" : ""}>${escapeHtml(lang === "en" ? floor.nameEn : floor.nameZh)}</option>`
  ).join("");
  const categoryOptions = config.destinationCategories.map(category =>
    `<option value="${category.id}" ${category.id === place.category ? "selected" : ""}>${escapeHtml(localCategory(category))}</option>`
  ).join("");
  elements.destinationEditor.innerHTML = `
    <div class="destination-editor">
      <div class="section-head">
        <div>
          <h3>${lang === "en" ? "Precise destination position" : "目的地精準位置"}</h3>
          <p class="muted">${lang === "en" ? "Click the map to move this destination. Save after checking the floor and coordinates." : "直接點地圖移動目的地位置，確認樓層與座標後儲存。"}</p>
        </div>
        <span class="pill">${escapeHtml(selectedDestinationId)}</span>
      </div>
      <div class="easy-form destination-edit-form">
        <div class="field">
          <label for="destinationEditorSelect">${lang === "en" ? "Destination" : "目的地"}</label>
          <select id="destinationEditorSelect">
            ${places.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selectedDestinationId ? "selected" : ""}>${escapeHtml(lang === "en" ? item.labelEn : item.labelZh)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label for="destinationEditZh">中文名稱</label><input id="destinationEditZh" value="${escapeHtml(place.labelZh || "")}"></div>
        <div class="field"><label for="destinationEditEn">English name</label><input id="destinationEditEn" value="${escapeHtml(place.labelEn || "")}"></div>
        <div class="field"><label for="destinationEditCategory">${t("category")}</label><select id="destinationEditCategory">${categoryOptions}</select></div>
        <div class="field"><label for="destinationEditFloor">${t("floor")}</label><select id="destinationEditFloor">${floorOptions}</select></div>
        <div class="field"><label for="destinationEditX">X</label><input id="destinationEditX" type="number" value="${Math.round(place.x)}"></div>
        <div class="field"><label for="destinationEditY">Y</label><input id="destinationEditY" type="number" value="${Math.round(place.y)}"></div>
        <div class="field wide"><label for="destinationEditAliases">${t("aliases")}</label><input id="destinationEditAliases" value="${escapeHtml((place.aliases || []).join(", "))}"></div>
        <div class="actions wide">
          <button id="saveDestinationBtn" class="primary" type="button">${lang === "en" ? "Save destination" : "儲存目的地"}</button>
          <button id="centerDestinationBtn" class="secondary" type="button">${lang === "en" ? "Center marker" : "回到標記"}</button>
        </div>
      </div>
      <div class="admin-map-shell">
        <canvas id="adminMapCanvas" width="${config.canvas.width}" height="${config.canvas.height}" aria-label="destination map editor"></canvas>
      </div>
    </div>
  `;
  document.getElementById("destinationEditorSelect").addEventListener("change", event => {
    selectedDestinationId = event.target.value;
    renderDestinations();
  });
  document.getElementById("saveDestinationBtn").addEventListener("click", saveDestination);
  document.getElementById("centerDestinationBtn").addEventListener("click", () => drawAdminMap());
  const canvas = document.getElementById("adminMapCanvas");
  canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((event.clientY - rect.top) * (canvas.height / rect.height));
    document.getElementById("destinationEditX").value = x;
    document.getElementById("destinationEditY").value = y;
    drawAdminMap();
  });
  drawAdminMap();
}

function drawAdminMap() {
  const canvas = document.getElementById("adminMapCanvas");
  if (!canvas || !config) return;
  const ctx = canvas.getContext("2d");
  const selected = {
    x: Number(document.getElementById("destinationEditX")?.value || 0),
    y: Number(document.getElementById("destinationEditY")?.value || 0)
  };
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (adminBaseMapImage?.complete) {
    ctx.drawImage(adminBaseMapImage, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, .22)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.strokeStyle = "#dbe3ec";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  ctx.strokeStyle = "#7aa39c";
  ctx.lineWidth = 2;
  for (const edge of config.graphEdges) {
    const a = config.graphNodes[edge[0]];
    const b = config.graphNodes[edge[1]];
    if (!a || !b) continue;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const [id, place] of Object.entries(config.places)) {
    ctx.fillStyle = id === selectedDestinationId ? "#e11d48" : "rgba(30, 41, 59, .36)";
    ctx.beginPath();
    ctx.arc(place.x, place.y, id === selectedDestinationId ? 5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(selected.x, selected.y);
  ctx.fillStyle = "#e11d48";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-14, -16, -14, -38, 0, -48);
  ctx.bezierCurveTo(14, -38, 14, -16, 0, 0);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(0, -29, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

async function saveDestination() {
  const id = selectedDestinationId;
  const payload = {
    id,
    labelZh: document.getElementById("destinationEditZh").value.trim(),
    labelEn: document.getElementById("destinationEditEn").value.trim(),
    category: document.getElementById("destinationEditCategory").value,
    floor: document.getElementById("destinationEditFloor").value,
    x: document.getElementById("destinationEditX").value,
    y: document.getElementById("destinationEditY").value,
    aliases: document.getElementById("destinationEditAliases").value.split(",").map(item => item.trim()).filter(Boolean)
  };
  await api("/api/admin/destinations", { method: "POST", body: JSON.stringify(payload) });
  await loadAdmin();
  alert(t("saved"));
}

function renderActivity() {
  elements.activityPanel.innerHTML = `
    <h2>${t("activity")}</h2>
    <h3>${t("recentUsers")}</h3>
    <div class="data-list">
      ${summary.sessions.slice(0, 20).map(session => `
        <article class="data-row">
          <div>
            <strong>${escapeHtml(session.id)}</strong>
            <div class="muted">${t("lastSeen")}: ${formatTime(session.lastSeen)} · ${session.eventCount} events</div>
            <pre class="muted">${escapeHtml(JSON.stringify(session.current || {}, null, 2))}</pre>
          </div>
        </article>
      `).join("") || `<p class="muted">${t("noSessions")}</p>`}
    </div>
    <h3>${t("recentEvents")}</h3>
    <div class="data-list">
      ${summary.events.slice(0, 30).map(event => `
        <article class="data-row">
          <div>
            <strong>${escapeHtml(event.type)}</strong>
            <div class="muted">${formatTime(event.at)}</div>
            <pre class="muted">${escapeHtml(JSON.stringify(event.payload || {}, null, 2))}</pre>
          </div>
        </article>
      `).join("") || `<p class="muted">${t("noEvents")}</p>`}
    </div>
    <h3>${t("publicSources")}</h3>
    <ul class="source-list">${summary.sources.map(source => `
      <li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a><br>
      <span class="muted">${escapeHtml(lang === "en" ? source.noteEn : source.noteZh)}</span></li>`).join("")}</ul>
  `;
}

async function handleCalibrationPhoto() {
  const file = elements.calibrationPhoto.files[0];
  if (file) elements.referenceHash.value = await imageHash(file);
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

async function saveBoard(event) {
  event.preventDefault();
  const board = {
    id: value("boardId"),
    nameZh: value("boardNameZh"),
    nameEn: value("boardNameEn"),
    floor: value("boardFloor"),
    x: value("boardX"),
    y: value("boardY"),
    heading: value("boardHeading"),
    referenceHash: elements.referenceHash.value,
    note: value("boardNote")
  };
  await api("/api/admin/boards", { method: "POST", body: JSON.stringify(board) });
  await loadAdmin();
  alert(t("saved"));
}

async function saveAp(event) {
  event.preventDefault();
  const ap = {
    id: value("apId"),
    name: value("apName"),
    ip: value("apIp"),
    ssid: value("apSsid"),
    floor: value("apFloor"),
    x: value("apX"),
    y: value("apY"),
    note: value("apNote")
  };
  await api("/api/admin/access-points", { method: "POST", body: JSON.stringify(ap) });
  await loadAdmin();
  alert(t("saved"));
}

async function saveWifiFingerprint(event) {
  event.preventDefault();
  const fingerprint = {
    id: value("wifiId"),
    labelZh: value("wifiLabelZh"),
    labelEn: value("wifiLabelEn"),
    floor: value("wifiFloor"),
    x: value("wifiX"),
    y: value("wifiY"),
    samples: value("wifiSamples"),
    note: value("wifiNote")
  };
  await api("/api/admin/wifi-fingerprints", { method: "POST", body: JSON.stringify(fingerprint) });
  await loadAdmin();
  alert(t("saved"));
}

function editWifiFingerprint(item) {
  if (!item) return;
  setValue("wifiId", item.id);
  setValue("wifiLabelZh", item.labelZh);
  setValue("wifiLabelEn", item.labelEn);
  setValue("wifiFloor", item.floor);
  setValue("wifiX", item.x);
  setValue("wifiY", item.y);
  setValue("wifiSamples", JSON.stringify(item.samples || [], null, 2));
  setValue("wifiNote", item.note || "");
  document.getElementById("wifiFingerprintForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editBoard(board) {
  if (!board) return;
  setValue("boardId", board.id);
  setValue("boardNameZh", board.nameZh);
  setValue("boardNameEn", board.nameEn);
  setValue("boardFloor", board.floor);
  setValue("boardX", board.x);
  setValue("boardY", board.y);
  setValue("boardHeading", board.heading || 0);
  elements.referenceHash.value = board.referenceHash || "";
  setValue("boardNote", board.note || "");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function editAp(ap) {
  if (!ap) return;
  setValue("apId", ap.id);
  setValue("apName", ap.name);
  setValue("apIp", ap.ip);
  setValue("apSsid", ap.ssid);
  setValue("apFloor", ap.floor);
  setValue("apX", ap.x);
  setValue("apY", ap.y);
  setValue("apNote", ap.note || "");
  setTab("network");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetBoardForm() {
  const id = `MAP-${Date.now().toString().slice(-6)}`;
  elements.boardForm.reset();
  setValue("boardId", id);
  setValue("boardNameZh", "新牆面地圖");
  setValue("boardNameEn", "New Wall Map");
  setValue("boardFloor", "campus");
  setValue("boardX", 440);
  setValue("boardY", 615);
  setValue("boardHeading", 0);
  elements.referenceHash.value = "";
}

function resetApForm() {
  const id = `AP-${Date.now().toString().slice(-6)}`;
  elements.apForm.reset();
  setValue("apId", id);
  setValue("apName", "New AP");
  setValue("apIp", "");
  setValue("apSsid", "");
  setValue("apFloor", "campus");
  setValue("apX", 440);
  setValue("apY", 615);
}

function statCard(label, valueText) {
  return `<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(valueText)}</strong></article>`;
}

function compactList(items, emptyText = t("noData")) {
  if (!items.length) return `<p class="muted">${emptyText}</p>`;
  return `<div class="compact-list">${items.map(item => `
    <div>
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.detail)}</span>
    </div>
  `).join("")}</div>`;
}

function localName(board) {
  return lang === "en" ? board.nameEn : board.nameZh;
}

function localCategory(category) {
  if (!category) return "";
  return lang === "en" ? category.labelEn : category.labelZh;
}

function value(id) {
  return document.getElementById(id).value.trim();
}

function setValue(id, nextValue) {
  document.getElementById(id).value = nextValue ?? "";
}

function normalize(valueText) {
  return String(valueText || "").trim().toLowerCase();
}

function formatTime(valueText) {
  if (!valueText) return "-";
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-TW", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(valueText));
}

function escapeHtml(valueText) {
  return String(valueText ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function renderWifiFingerprints() {
  if (!elements.wifiFingerprintPanel) return;
  const fingerprints = summary.wifiFingerprints || config.wifiFingerprints || [];
  const floorOptions = Object.values(config.floors).map(floor =>
    `<option value="${floor.id}">${escapeHtml(lang === "en" ? floor.nameEn : floor.nameZh)}</option>`
  ).join("");
  elements.wifiFingerprintPanel.innerHTML = `
    <div class="admin-guide">
      <h2>${lang === "en" ? "How to make a Wi-Fi demo point" : "Wi-Fi demo 點位怎麼做"}</h2>
      <ol>
        <li>${lang === "en" ? "Click one fixed position on the campus map below." : "在下面校園地圖上點一下固定位置。"}</li>
        <li>${lang === "en" ? "The system fills X/Y, name, ID, and demo Wi-Fi samples automatically." : "系統會自動填 X/Y、名稱、ID、demo Wi-Fi 指紋。"}</li>
        <li>${lang === "en" ? "Press Save. User-side Wi-Fi location can immediately match this point." : "按儲存。使用者端 Wi-Fi 定位就能立刻比對這個點。"}</li>
      </ol>
      <p class="muted">${lang === "en" ? "A normal mobile browser cannot directly scan Wi-Fi BSSID/RSSI. This demo generates samples first; later an Android scanner can send real samples to the same API." : "一般手機瀏覽器不能直接掃 Wi-Fi BSSID/RSSI。這個 demo 先用自動產生的樣本；之後接 Android 掃描器時可沿用同一個 API。"}</p>
    </div>
    <div class="reference-grid">
      <a href="/assets/tamkang-walk-route-map.png" target="_blank" rel="noreferrer">
        <img src="/assets/tamkang-walk-route-map.png" alt="walk route map">
        <span>${lang === "en" ? "Walking route reference" : "人行路線輔助圖"}</span>
      </a>
      <a href="/assets/tamkang-parking-map.png" target="_blank" rel="noreferrer">
        <img src="/assets/tamkang-parking-map.png" alt="parking map">
        <span>${lang === "en" ? "Parking reference" : "停車場輔助圖"}</span>
      </a>
    </div>
    <div class="admin-map-shell wifi-map-shell">
      <canvas id="wifiMapCanvas" width="${config.canvas.width}" height="${config.canvas.height}" aria-label="Wi-Fi fingerprint map"></canvas>
      <div class="map-instruction">${lang === "en" ? "Click the map to auto-fill a Wi-Fi demo point" : "點地圖即可自動填好 Wi-Fi demo 點位資料"}</div>
    </div>
    <div class="section-head">
      <div>
        <h2>${lang === "en" ? "Wi-Fi fingerprint demo" : "Wi-Fi 指紋定位 demo"}</h2>
        <p class="muted">${lang === "en" ? "For the experiment, click the map and save. Edit details only when real data is available." : "實驗版只要點地圖再儲存；需要真實資料時才手動改樣本。"}</p>
      </div>
    </div>
    <form id="wifiFingerprintForm" class="easy-form">
      <div class="form-card">
        <h3>${lang === "en" ? "Point" : "點位"}</h3>
        <div class="field"><label for="wifiId">ID</label><input id="wifiId" value="WF-TKU-DEMO"></div>
        <div class="field"><label for="wifiLabelZh">中文名稱</label><input id="wifiLabelZh" value="淡江 Wi-Fi 指紋點"></div>
        <div class="field"><label for="wifiLabelEn">English name</label><input id="wifiLabelEn" value="Tamkang Wi-Fi Fingerprint"></div>
        <div class="row">
          <div class="field"><label for="wifiFloor">${t("floor")}</label><select id="wifiFloor">${floorOptions}</select></div>
          <div class="field"><label for="wifiX">X</label><input id="wifiX" type="number" value="440"></div>
          <div class="field"><label for="wifiY">Y</label><input id="wifiY" type="number" value="615"></div>
        </div>
      </div>
      <div class="form-card">
        <h3>${lang === "en" ? "Scan samples" : "掃描樣本"}</h3>
        <div class="field">
          <label for="wifiSamples">${lang === "en" ? "Auto-generated demo samples, or real lines: bssid,ssid,rssi" : "自動產生 demo 樣本，也可改成真實資料：bssid,ssid,rssi"}</label>
          <textarea id="wifiSamples" rows="7">aa:aa:aa:00:02,TKU-Library,-48
aa:aa:aa:00:03,TKU-Student,-72</textarea>
        </div>
        <div class="field"><label for="wifiNote">${t("note")}</label><textarea id="wifiNote"></textarea></div>
        <button class="primary" type="submit">${lang === "en" ? "Save Wi-Fi fingerprint" : "儲存 Wi-Fi 指紋"}</button>
      </div>
    </form>
    <div class="data-list">
      ${fingerprints.map(item => `
        <article class="data-row">
          <div>
            <strong>${escapeHtml(lang === "en" ? item.labelEn : item.labelZh)}</strong>
            <div class="muted">${escapeHtml(item.id)} · ${escapeHtml(item.floor)} · X ${Math.round(item.x)}, Y ${Math.round(item.y)}</div>
            <div class="small">${(item.samples || []).length} AP samples</div>
          </div>
          <button type="button" data-edit-wifi="${escapeHtml(item.id)}">${t("edit")}</button>
        </article>
      `).join("") || `<p class="muted">${t("noData")}</p>`}
    </div>
  `;
  document.getElementById("wifiFingerprintForm").addEventListener("submit", saveWifiFingerprint);
  document.getElementById("wifiMapCanvas")?.addEventListener("click", fillWifiPointFromMap);
  elements.wifiFingerprintPanel.querySelectorAll("[data-edit-wifi]").forEach(button => {
    button.addEventListener("click", () => editWifiFingerprint(fingerprints.find(item => item.id === button.dataset.editWifi)));
  });
  drawWifiMap();
}

function fillWifiPointFromMap(event) {
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const x = Math.round((event.clientX - rect.left) * (canvas.width / rect.width));
  const y = Math.round((event.clientY - rect.top) * (canvas.height / rect.height));
  const serial = `${String(Math.round(x)).padStart(4, "0")}${String(Math.round(y)).padStart(4, "0")}`;
  setValue("wifiId", `WF-TKU-${serial}`);
  setValue("wifiLabelZh", `淡江 Wi-Fi 點 X${x} Y${y}`);
  setValue("wifiLabelEn", `Tamkang Wi-Fi Point X${x} Y${y}`);
  setValue("wifiFloor", "campus");
  setValue("wifiX", x);
  setValue("wifiY", y);
  setValue("wifiSamples", generateDemoWifiSamples(x, y));
  setValue("wifiNote", lang === "en" ? "Auto-generated by clicking the map. Replace with real scan later." : "點地圖自動產生，之後可替換成真實掃描資料。");
  drawWifiMap({ x, y });
}

function generateDemoWifiSamples(x, y) {
  const seedA = Math.abs(Math.round(x * 13 + y * 7));
  const seedB = Math.abs(Math.round(x * 5 + y * 17));
  const mac1 = `02:tk:${(seedA % 256).toString(16).padStart(2, "0")}:${(seedB % 256).toString(16).padStart(2, "0")}:01`;
  const mac2 = `02:tk:${((seedA + 37) % 256).toString(16).padStart(2, "0")}:${((seedB + 83) % 256).toString(16).padStart(2, "0")}:02`;
  const rssi1 = -42 - Math.round((x + y) % 18);
  const rssi2 = -62 - Math.round((x * 2 + y) % 20);
  return `${mac1},TKU-Demo-${Math.round(x)},${rssi1}\n${mac2},TKU-Backup-${Math.round(y)},${rssi2}`;
}

function drawWifiMap(selectedPoint = null) {
  const canvas = document.getElementById("wifiMapCanvas");
  if (!canvas || !config) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (adminBaseMapImage?.complete) ctx.drawImage(adminBaseMapImage, 0, 0, canvas.width, canvas.height);
  else {
    ctx.fillStyle = "#d9c6ae";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const item of summary.wifiFingerprints || config.wifiFingerprints || []) {
    ctx.fillStyle = "#0f766e";
    ctx.beginPath();
    ctx.arc(Number(item.x), Number(item.y), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.fillRect(Number(item.x) + 10, Number(item.y) - 13, 92, 22);
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 12px sans-serif";
    ctx.fillText(String(item.id).slice(0, 12), Number(item.x) + 14, Number(item.y) + 2);
  }
  const x = selectedPoint?.x ?? Number(document.getElementById("wifiX")?.value || 0);
  const y = selectedPoint?.y ?? Number(document.getElementById("wifiY")?.value || 0);
  if (Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0) {
    ctx.strokeStyle = "#e11d48";
    ctx.fillStyle = "#e11d48";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  }
}

init();
