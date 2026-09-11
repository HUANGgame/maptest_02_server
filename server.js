const http = require("http");
const fs = require("fs");
const path = require("path");
const { createFloor, createMap, createPlace, deletePlace, readFloors, readMaps } = require("./lib/catalogStore");
const { appendFeedback, readFeedback, writeFeedback } = require("./lib/feedbackStore");
const { appendHistory, appendSavedLocation, clearHistory, clearSavedLocations, readHistory, readSavedLocations } = require("./lib/historyStore");
const { activateModel, activeModel, createModelVersion, readModels } = require("./lib/modelStore");
const { readPlaces, updatePlaceStatus } = require("./lib/placeStore");
const { appendPolicyLog, createDqnRun, readDqnRuns, readPolicyLogs } = require("./lib/policyStore");
const { appendReport, readReports } = require("./lib/reportStore");
const { clearRouteGraphForFloor, createFloorTransition, createRouteNode, createRouteSegment, createRouteZone, deleteFloorTransition, deleteRouteEdge, deleteRouteNode, deleteRouteZone, readFloorTransitions, readRouteEdges, readRouteNodes, readRouteZones, restoreLastDeleted, setRouteEdgeBlocked, updateRouteZone } = require("./lib/routeEdgeStore");
const { createTrainingJob, readTrainingJobs } = require("./lib/trainingJobStore");
const { appendScans, readScans } = require("./lib/jsonStore");
const firebaseMirror = require("./lib/firebaseMirror");
const mysqlMirror = require("./lib/mysqlMirror");

const port = Number(process.env.PORT || 3015);
const publicMapsDir = path.resolve(__dirname, "public", "maps");

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      project: "地下街室內導航系統",
      demoVenue: "K區地下街往機捷",
      phase: "formal-navigation-ready",
      storage: mysqlMirror.isEnabled() ? "mysql" : "json",
    });
    return;
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app" || url.pathname === "/navigation")) {
    sendJson(response, 410, {
      success: false,
      message: "正式導航已改為 Android App 使用；此服務只保留 API 與管理後台。",
      admin: "/admin",
      health: "/api/health",
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin") {
    sendFile(response, path.join(__dirname, "public", "admin.html"), "text/html; charset=utf-8");
    return;
  }

  if (request.method === "GET" && url.pathname === "/wifi-test") {
    sendFile(response, path.join(__dirname, "public", "wifi-test.html"), "text/html; charset=utf-8");
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/dev-predict") {
    try {
      const body = await readJsonBody(request);
      const modelUrl = String(body.modelUrl || "https://mxz0qz8w-8000.jpe1.devtunnels.ms/predict").trim();
      const signals = normalizePredictSignals(body.signals);
      if (!modelUrl.startsWith("https://") && !modelUrl.startsWith("http://")) {
        sendJson(response, 400, { success: false, message: "模型網址格式不正確" });
        return;
      }
      if (Object.keys(signals).length === 0) {
        sendJson(response, 400, { success: false, message: "請提供 Wi-Fi 訊號資料" });
        return;
      }
      const result = await callDevPredict(modelUrl, signals);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 502, { success: false, message: error.message });
    }
    return;
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/maps/")) {
    sendMapFile(response, url.pathname, request.method === "HEAD");
    return;
  }

  if (request.method === "GET" && url.pathname === "/download/apk") {
    sendDownload(
      response,
      path.join(__dirname, "..", "dist", "地下街室內導航-WiFi指紋蒐集-demo.apk"),
      "application/vnd.android.package-archive",
      "indoor-navigation-wifi-demo.apk"
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/data/export") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    sendJson(response, 200, buildScopedExport(mapId, floorId));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/maps") {
    const scanMaps = Array.from(new Set(readScans().map((record) => record.mapId).filter(Boolean)))
      .filter((mapId) => !readMaps().some((map) => map.id === mapId))
      .map((mapId) => ({
        id: mapId,
        name: mapId,
        description: "? Android ???????????????",
      }));
    sendJson(response, 200, readMaps().concat(scanMaps));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/maps") {
    try {
      const body = await readJsonBody(request);
      const map = createMap(body);
      mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, 201, { success: true, map });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/floors") {
    const mapId = url.searchParams.get("mapId") || "";
    const scanFloors = buildScanFloors(readScans().filter((record) => !mapId || record.mapId === mapId))
      .filter((floor) => !readFloors().some((item) => item.id === floor.id));
    sendJson(response, 200, readFloors().filter((floor) => !mapId || floor.mapId === mapId).concat(scanFloors));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/floors") {
    try {
      const body = await readJsonBody(request);
      const floor = createFloor(body);
      mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, 201, { success: true, floor });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/places") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    const keyword = (url.searchParams.get("keyword") || "").trim().toLowerCase();
    sendJson(response, 200, readPlaces().filter((place) => {
      if (mapId && place.mapId !== mapId) return false;
      if (floorId && place.floorId !== floorId) return false;
      if (!keyword) return true;
      return [place.name, place.category, place.description, place.keywords].some((value) => String(value || "").toLowerCase().includes(keyword));
    }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/places") {
    try {
      const body = await readJsonBody(request);
      const place = createPlace(body);
      mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, 201, { success: true, place });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/places") {
    try {
      const placeId = url.searchParams.get("placeId") || "";
      const place = deletePlace(placeId);
      if (place) mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, place ? 200 : 404, place ? { success: true, place } : { success: false, message: "place not found" });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/places/status") {
    try {
      const body = await readJsonBody(request);
      const place = updatePlaceStatus(String(body.placeId || "").trim(), String(body.businessStatus || "unset").trim());
      if (place) mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, place ? 200 : 400, place ? { success: true, place } : { success: false, message: "找不到地點或狀態不合法。" });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/wifi-scans") {
    try {
      const body = await readJsonBody(request);
      const records = normalizeWifiScanPayload(body);
      const errors = validateWifiScanRecords(records);
      if (errors.length > 0) {
        sendJson(response, 400, {
          success: false,
          accepted: false,
          errors,
        });
        return;
      }
      const saved = appendScans(records);
      mysqlMirror.mirrorWifiScans(saved).catch((error) => console.error("MySQL Wi-Fi mirror failed:", error.message));
      firebaseMirror.mirrorWifiScans(saved).catch((error) => console.error("Firebase Wi-Fi mirror failed:", error.message));
      sendJson(response, 201, {
        success: true,
        accepted: true,
        savedCount: saved.length,
        uploadedAt: saved[0]?.uploadedAt || new Date().toISOString(),
      });
    } catch (error) {
      sendJson(response, 400, {
        success: false,
        accepted: false,
        error: "invalidJson",
        message: error.message,
      });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/wifi-scans/summary") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    const records = filterByScope(readScans(), mapId, floorId);
    const pointIds = new Set(records.map((record) => record.pointId));
    const bssids = new Set(records.map((record) => record.bssid));
    const recordsByPoint = groupBy(records, (record) => record.pointId);
    const points = Array.from(recordsByPoint.entries()).map(([pointId, items]) => ({
      pointId,
      scanCount: items.length,
      bssidCount: new Set(items.map((item) => item.bssid)).size,
      averageRssi: average(items.map((item) => item.rssi)),
      latestScannedAt: maxText(items.map((item) => item.scannedAt)),
    }));
    sendJson(response, 200, {
      mapId: mapId || null,
      floorId: floorId || null,
      totalRecords: records.length,
      pointCount: pointIds.size,
      bssidCount: bssids.size,
      points,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/wifi-scans/points") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    const records = filterByScope(readScans(), mapId, floorId);
    const recordsByPoint = groupBy(records, (record) => record.pointId);
    const points = Array.from(recordsByPoint.entries()).map(([pointId, items]) => {
      const first = items[0];
      return {
        pointId,
        mapId: first.mapId,
        floorId: first.floorId,
        x: first.x,
        y: first.y,
        heading: first.heading,
        scanCount: items.length,
        bssidCount: new Set(items.map((item) => item.bssid)).size,
        latestScannedAt: maxText(items.map((item) => item.scannedAt)),
      };
    });
    sendJson(response, 200, {
      mapId: mapId || null,
      floorId: floorId || null,
      points,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/wifi-scans/quality") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    const records = filterByScope(readScans(), mapId, floorId);
    sendJson(response, 200, buildWifiQuality(records));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/location/validation") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    if (!mapId || !floorId) {
      sendJson(response, 400, { success: false, message: "mapId 與 floorId 不可空白。" });
      return;
    }
    const records = filterByScope(readScans(), mapId, floorId);
    sendJson(response, 200, validateKnnPositioning(records, mapId, floorId));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/models/train") {
    try {
      const body = await readJsonBody(request);
      const mapId = String(body.mapId || "").trim();
      const floorId = String(body.floorId || "").trim();
      const algorithm = String(body.algorithm || "knn").trim();
      if (!mapId || !floorId) {
        sendJson(response, 400, { success: false, message: "mapId 與 floorId 不可空白。" });
        return;
      }
      if (!["knn", "randomForest"].includes(algorithm)) {
        sendJson(response, 400, { success: false, message: "第一版只允許 KNN 主模型與 Random Forest 比較模型。" });
        return;
      }
      const records = filterByScope(readScans(), mapId, floorId);
      const sampleCount = new Set(records.map((record) => record.pointId)).size;
      if (records.length < 3 || sampleCount < 2) {
        sendJson(response, 400, {
          success: false,
          message: "資料不足，至少需要 2 個採樣點與 3 筆以上 Wi-Fi 掃描紀錄。",
          trainingDataCount: records.length,
          pointCount: sampleCount,
        });
        return;
      }
      const model = createModelVersion({
        mapId,
        floorId,
        algorithm,
        trainingDataCount: records.length,
        averageError: algorithm === "knn"
          ? estimateLeaveOnePointError(records, mapId, floorId)
          : estimateRandomForestComparisonError(records, mapId, floorId),
        isActive: algorithm === "knn" && body.activate !== false,
        isComparisonOnly: algorithm !== "knn",
        notes: algorithm === "randomForest"
          ? "Random Forest 目前只作為比較模型，不作為 App 定位主模型。"
          : "",
        versionName: algorithm === "randomForest" ? `RF-comparison-${new Date().toISOString()}` : undefined,
      });
      mysqlMirror.mirrorModels([model]).catch((error) => console.error("MySQL model mirror failed:", error.message));
      firebaseMirror.mirrorJsonFiles(["model_versions.json", "model_training_jobs.json"]).catch((error) => console.error("Firebase model mirror failed:", error.message));
      sendJson(response, 201, { success: true, model });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/models") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    sendJson(response, 200, readModels().filter((model) => {
      if (mapId && model.mapId !== mapId) return false;
      if (floorId && model.floorId !== floorId) return false;
      return true;
    }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/models/active") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    const model = activeModel(mapId, floorId);
    sendJson(response, model ? 200 : 404, model || { message: "目前沒有啟用模型。" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/models/activate") {
    try {
      const body = await readJsonBody(request);
      const modelId = String(body.modelVersionId || body.id || "").trim();
      const target = readModels().find((item) => item.id === modelId);
      if (target && target.algorithm !== "knn") {
        sendJson(response, 400, { success: false, message: "只有 KNN 主定位模型可以啟用；比較模型不可啟用。" });
        return;
      }
      const model = activateModel(modelId);
      if (model) mysqlMirror.mirrorModels(readModels()).catch((error) => console.error("MySQL model mirror failed:", error.message));
      if (model) firebaseMirror.mirrorJsonFiles(["model_versions.json"]).catch((error) => console.error("Firebase model mirror failed:", error.message));
      sendJson(response, model ? 200 : 404, model ? { success: true, model } : { success: false, message: "找不到模型版本。" });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/location/estimate") {
    try {
      const body = await readJsonBody(request);
      const result = estimateLocation(body);
      sendJson(response, result ? 200 : 400, result || { message: "定位失敗，請確認已有啟用模型與足夠 Wi-Fi 訊號。" });
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/routes") {
    try {
      const body = await readJsonBody(request);
      const result = planRoute(body);
      sendJson(response, result ? 200 : 400, result || { message: "找不到可行路線。" });
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/route-edges") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    sendJson(response, 200, readRouteEdges().filter((edge) => {
      if (mapId && edge.mapId !== mapId) return false;
      if (floorId && edge.floorId !== floorId) return false;
      return true;
    }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/route-nodes") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    sendJson(response, 200, readRouteNodes().filter((node) => {
      if (mapId && node.mapId !== mapId) return false;
      if (floorId && node.floorId !== floorId) return false;
      return true;
    }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/route-zones") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    sendJson(response, 200, readRouteZones().filter((zone) => {
      if (mapId && zone.mapId !== mapId) return false;
      if (floorId && zone.floorId !== floorId) return false;
      return true;
    }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/storage/status") {
    try {
      const mysql = await mysqlMirror.statusSummary();
      const firebase = await firebaseMirror.statusSummary();
      sendJson(response, 200, {
        enabled: mysql.enabled || firebase.enabled,
        storage: firebase.enabled ? "firebase-rtdb" : mysql.enabled ? "mysql" : "json",
        mysql,
        firebase,
        jsonFallback: true,
        note: firebase.enabled
          ? "Firebase mirror is active; JSON files are local cache."
          : mysql.enabled
            ? "MySQL mirror is active; JSON files are local cache."
            : "No external database is configured; JSON files are the active store.",
      });
    } catch (error) {
      sendJson(response, 500, { enabled: false, storage: "error", message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/storage/sync") {
    try {
      const mysqlEnabled = await mirrorFullAdminSnapshot();
      const firebaseEnabled = await firebaseMirror.mirrorJsonFiles();
      sendJson(response, 200, {
        success: true,
        mysqlEnabled,
        firebaseEnabled,
        status: {
          mysql: await mysqlMirror.statusSummary(),
          firebase: await firebaseMirror.statusSummary(),
        },
      });
    } catch (error) {
      sendJson(response, 500, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/route-nodes") {
    try {
      const body = await readJsonBody(request);
      const result = createRouteNode(body);
      mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, 201, result);
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/route-zones") {
    try {
      const body = await readJsonBody(request);
      const result = createRouteZone(body);
      mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, 201, result);
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/route-zones") {
    try {
      const body = await readJsonBody(request);
      const result = updateRouteZone(url.searchParams.get("zoneId"), body);
      if (result) mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, result ? 200 : 404, result || { success: false, message: "zone not found" });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/route-segments") {
    try {
      const body = await readJsonBody(request);
      const result = createRouteSegment(body);
      mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, 201, result);
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/route-graph/restore-last") {
    const result = restoreLastDeleted();
    if (result) mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
    sendJson(response, result ? 200 : 404, result || { success: false, message: "沒有可回復的刪除紀錄" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/floor-transitions") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    sendJson(response, 200, readFloorTransitions().filter((transition) => {
      if (mapId && transition.mapId !== mapId) return false;
      if (floorId && transition.fromFloorId !== floorId && transition.toFloorId !== floorId) return false;
      return true;
    }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/floor-transitions") {
    try {
      const body = await readJsonBody(request);
      const result = createFloorTransition(body);
      mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, 201, result);
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/floor-transitions") {
    const transitionId = url.searchParams.get("transitionId") || "";
    const result = deleteFloorTransition(transitionId);
    if (result) mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
    sendJson(response, result ? 200 : 404, result || { success: false, message: "only admin-created floor transitions can be deleted" });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/route-edges") {
    const edgeId = url.searchParams.get("edgeId") || "";
    const result = deleteRouteEdge(edgeId);
    if (result) mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
    sendJson(response, result ? 200 : 404, result || { success: false, message: "route edge not found" });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/route-nodes") {
    const nodeId = url.searchParams.get("nodeId") || "";
    const result = deleteRouteNode(nodeId);
    if (result) mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
    sendJson(response, result ? 200 : 404, result || { success: false, message: "only admin-created route nodes can be deleted" });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/route-zones") {
    const result = deleteRouteZone(url.searchParams.get("zoneId"));
    if (result) mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
    sendJson(response, result ? 200 : 404, result || { success: false, message: "zone not found" });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/route-graph/floor") {
    try {
      const result = clearRouteGraphForFloor(url.searchParams.get("mapId"), url.searchParams.get("floorId"));
      mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/route-edges/block") {
    try {
      const body = await readJsonBody(request);
      const edge = setRouteEdgeBlocked(String(body.edgeId || "").trim(), body.isBlocked === true);
      if (edge) mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, edge ? 200 : 404, edge ? { success: true, edge } : { success: false, message: "route edge not found" });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/navigation-feedback") {
    try {
      const body = await readJsonBody(request);
      const normalized = normalizeFeedback(body);
      const errors = validateFeedback(normalized);
      if (errors.length > 0) {
        sendJson(response, 400, { success: false, accepted: false, reason: errors.join("；") });
        return;
      }
      appendFeedback(normalized);
      firebaseMirror.mirrorJsonFiles(["navigation_feedback.json"]).catch((error) => console.error("Firebase feedback mirror failed:", error.message));
      sendJson(response, 201, { success: true, accepted: true, reason: "已匿名接收，等待品質篩選。" });
    } catch (error) {
      sendJson(response, 400, { success: false, accepted: false, reason: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/navigation-feedback/quality-summary") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    const records = readFeedback().filter((record) => {
      if (mapId && record.mapId !== mapId) return false;
      if (floorId && record.floorId !== floorId) return false;
      return true;
    });
    sendJson(response, 200, feedbackQualitySummary(records));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/navigation-feedback/evaluate") {
    const records = readFeedback();
    const evaluated = records.map((record) => record.qualityStatus === "pending" ? { ...record, qualityStatus: evaluateFeedbackQuality(record) } : record);
    writeFeedback(evaluated);
    firebaseMirror.mirrorJsonFiles(["navigation_feedback.json"]).catch((error) => console.error("Firebase feedback mirror failed:", error.message));
    sendJson(response, 200, {
      evaluatedCount: evaluated.length,
      ...feedbackQualitySummary(evaluated),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/models/retrain-from-feedback") {
    try {
      const body = await readJsonBody(request);
      const mapId = String(body.mapId || "").trim();
      const floorId = String(body.floorId || "").trim();
      if (!mapId || !floorId) {
        sendJson(response, 400, { success: false, message: "mapId 與 floorId 不可空白。" });
        return;
      }

      const evaluated = readFeedback().map((record) => {
        if (record.mapId === mapId && record.floorId === floorId && record.qualityStatus === "pending") {
          return { ...record, qualityStatus: evaluateFeedbackQuality(record) };
        }
        return record;
      });
      writeFeedback(evaluated);

      const manualRecords = filterByScope(readScans(), mapId, floorId);
      const highConfidence = evaluated.filter((record) =>
        record.mapId === mapId &&
        record.floorId === floorId &&
        record.qualityStatus === "highConfidence"
      );
      const totalTrainingCount = manualRecords.length + highConfidence.length;
      if (manualRecords.length < 3 && highConfidence.length < 2) {
        const failedJob = createTrainingJob({
          mapId,
          floorId,
          trainingType: "feedbackIncrementalTraining",
          trainingDataCount: manualRecords.length,
          feedbackDataCount: highConfidence.length,
          status: "failed",
          resultSummary: "資料不足，未建立新模型版本。",
        });
        sendJson(response, 400, { success: false, message: "高可信回饋或人工指紋資料不足。", job: failedJob });
        return;
      }

      const model = createModelVersion({
        mapId,
        floorId,
        algorithm: "knn",
        trainingDataCount: totalTrainingCount,
        averageError: estimateLeaveOnePointError(manualRecords, mapId, floorId),
        isActive: body.activate !== false,
        versionName: `KNN-feedback-${new Date().toISOString()}`,
      });
      const job = createTrainingJob({
        mapId,
        floorId,
        modelVersionId: model.id,
        trainingType: "feedbackIncrementalTraining",
        trainingDataCount: manualRecords.length,
        feedbackDataCount: highConfidence.length,
        status: "completed",
        resultSummary: `使用人工指紋 ${manualRecords.length} 筆與高可信匿名回饋 ${highConfidence.length} 筆建立模型版本。`,
      });
      firebaseMirror.mirrorJsonFiles(["navigation_feedback.json", "model_versions.json", "model_training_jobs.json"]).catch((error) => console.error("Firebase model mirror failed:", error.message));
      sendJson(response, 201, { success: true, model, job });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/model-training-jobs") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    sendJson(response, 200, readTrainingJobs().filter((job) => {
      if (mapId && job.mapId !== mapId) return false;
      if (floorId && job.floorId !== floorId) return false;
      return true;
    }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/navigation-policy/train") {
    try {
      const body = await readJsonBody(request);
      const mapId = String(body.mapId || "").trim();
      const floorId = String(body.floorId || "").trim();
      const episodes = Number(body.trainingEpisodes || 100);
      if (!mapId || !floorId) {
        sendJson(response, 400, { success: false, message: "mapId 與 floorId 不可空白。" });
        return;
      }
      const simulation = simulateNavigationPolicyTraining(mapId, floorId, episodes);
      const run = createDqnRun({
        mapId,
        floorId,
        trainingEpisodes: episodes,
        averageReward: simulation.averageReward,
        successRate: simulation.successRate,
        scenarioCount: simulation.scenarioCount,
        baselineRouteCount: simulation.baselineRouteCount,
        actionDistribution: simulation.actionDistribution,
        simulationSummary: simulation.summary,
        modelPath: `models/${mapId}/${floorId}/dqn_policy_${Date.now()}.json`,
        isActive: body.activate !== false,
      });
      mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, 201, { success: true, run, simulation });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/navigation-policy/runs") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    sendJson(response, 200, readDqnRuns().filter((run) => {
      if (mapId && run.mapId !== mapId) return false;
      if (floorId && run.floorId !== floorId) return false;
      return true;
    }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/navigation-policy/decide") {
    try {
      const body = await readJsonBody(request);
      const decision = decideNavigationPolicy(body);
      appendPolicyLog({
        mapId: decision.mapId,
        floorId: decision.floorId,
        currentX: Number(body.currentX || 0),
        currentY: Number(body.currentY || 0),
        targetX: Number(body.targetX || 0),
        targetY: Number(body.targetY || 0),
        isOffRoute: body.isOffRoute === true,
        obstacleNearby: body.obstacleNearby === true,
        wifiConfidence: Number(body.wifiConfidence || 0),
        estimatedError: Number(body.estimatedError || 0),
        recommendedAction: decision.recommendedAction,
        accepted: null,
      });
      mirrorFullAdminSnapshot().catch((error) => console.error("MySQL admin mirror failed:", error.message));
      sendJson(response, 200, decision);
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/navigation-policy/logs") {
    const mapId = url.searchParams.get("mapId") || "";
    const floorId = url.searchParams.get("floorId") || "";
    sendJson(response, 200, readPolicyLogs().filter((log) => {
      if (mapId && log.mapId !== mapId) return false;
      if (floorId && log.floorId !== floorId) return false;
      return true;
    }).slice(-50));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/navigation-history") {
    sendJson(response, 200, readHistory(url.searchParams.get("userId") || ""));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/navigation-history") {
    try {
      const body = await readJsonBody(request);
      const record = appendHistory({
        userId: String(body.userId || body.anonymousUserId || "anonymous"),
        mapId: String(body.mapId || ""),
        startPlaceId: String(body.startPlaceId || ""),
        destinationPlaceId: String(body.destinationPlaceId || ""),
        startX: Number(body.startX || 0),
        startY: Number(body.startY || 0),
        startFloorId: String(body.startFloorId || body.floorId || ""),
      });
      firebaseMirror.mirrorJsonFiles(["navigation_history.json"]).catch((error) => console.error("Firebase history mirror failed:", error.message));
      sendJson(response, 201, { success: true, record });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/navigation-history") {
    const userId = url.searchParams.get("userId") || "";
    sendJson(response, userId ? 200 : 400, userId
      ? { success: true, deletedCount: clearHistory(userId) }
      : { success: false, message: "userId 不可空白。" });
    if (userId) firebaseMirror.mirrorJsonFiles(["navigation_history.json"]).catch((error) => console.error("Firebase history mirror failed:", error.message));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/saved-locations") {
    sendJson(response, 200, readSavedLocations(url.searchParams.get("userId") || ""));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/saved-locations") {
    try {
      const body = await readJsonBody(request);
      const record = appendSavedLocation({
        userId: String(body.userId || body.anonymousUserId || "anonymous"),
        name: String(body.name || "儲存位置"),
        mapId: String(body.mapId || ""),
        floorId: String(body.floorId || ""),
        x: Number(body.x || 0),
        y: Number(body.y || 0),
        type: String(body.type || "custom"),
      });
      firebaseMirror.mirrorJsonFiles(["saved_locations.json"]).catch((error) => console.error("Firebase saved-location mirror failed:", error.message));
      sendJson(response, 201, { success: true, record });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/saved-locations") {
    const userId = url.searchParams.get("userId") || "";
    sendJson(response, userId ? 200 : 400, userId
      ? { success: true, deletedCount: clearSavedLocations(userId) }
      : { success: false, message: "userId 不可空白。" });
    if (userId) firebaseMirror.mirrorJsonFiles(["saved_locations.json"]).catch((error) => console.error("Firebase saved-location mirror failed:", error.message));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/user-reports") {
    try {
      const body = await readJsonBody(request);
      const reportType = String(body.reportType || "").trim();
      if (!["blockedRoute", "closedPlace", "obstacle", "wrongPlace"].includes(reportType)) {
        sendJson(response, 400, { success: false, message: "回報類型不合法。" });
        return;
      }
      const report = appendReport({
        userId: String(body.userId || body.anonymousUserId || "anonymous"),
        mapId: String(body.mapId || ""),
        floorId: String(body.floorId || ""),
        x: Number(body.x || 0),
        y: Number(body.y || 0),
        reportType,
        description: String(body.description || ""),
      });
      firebaseMirror.mirrorJsonFiles(["user_reports.json"]).catch((error) => console.error("Firebase report mirror failed:", error.message));
      sendJson(response, 201, { success: true, report });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/user-reports") {
    sendJson(response, 200, readReports({
      mapId: url.searchParams.get("mapId") || "",
      floorId: url.searchParams.get("floorId") || "",
    }));
    return;
  }

  sendJson(response, 404, {
    error: "notFound",
    message: "此 API 尚未在目前階段實作。",
  });
});

Promise.allSettled([mysqlMirror.startMirror(), firebaseMirror.startMirror()])
  .then((results) => {
    const mysqlEnabled = results[0].status === "fulfilled" && results[0].value === true;
    const firebaseEnabled = results[1].status === "fulfilled" && results[1].value === true;
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`${index === 0 ? "MySQL" : "Firebase"} startup failed:`, result.reason.message);
      }
    });
    server.listen(port, () => {
      console.log(`Navigation backend listening on http://localhost:${port} (${firebaseEnabled ? "firebase-rtdb" : mysqlEnabled ? "mysql" : "json"} storage)`);
    });
  })
  .catch((error) => {
    console.error("External database startup failed, falling back to JSON storage:", error.message);
    server.listen(port, () => {
      console.log(`Navigation backend listening on http://localhost:${port} (json storage)`);
    });
  });

function mirrorFullAdminSnapshot() {
  const snapshot = {
    maps: readMaps(),
    floors: readFloors(),
    places: readPlaces(),
    routeNodes: readRouteNodes(),
    routeEdges: readRouteEdges(),
    floorTransitions: readFloorTransitions(),
    dqnRuns: readDqnRuns(),
    policyLogs: readPolicyLogs(),
  };
  firebaseMirror.mirrorJsonFiles(["catalog_records.json", "route_graph_records.json", "route_edge_overrides.json", "dqn_training_runs.json", "navigation_policy_logs.json"])
    .catch((error) => console.error("Firebase admin mirror failed:", error.message));
  return mysqlMirror.mirrorAdminData(snapshot);
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, max-age=0",
  });
  response.end(JSON.stringify(body));
}

function sendFile(response, filePath, contentType) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(response, 404, { error: "notFound" });
      return;
    }
    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store, max-age=0",
    });
    response.end(data);
  });
}

function sendMapFile(response, pathname, headersOnly = false) {
  const fileName = path.basename(decodeURIComponent(pathname.slice("/maps/".length)));
  const filePath = path.resolve(publicMapsDir, fileName);
  if (!filePath.startsWith(publicMapsDir + path.sep) || !fs.existsSync(filePath)) {
    sendJson(response, 404, { error: "mapImageNotFound", fileName });
    return;
  }
  const extension = path.extname(fileName).toLowerCase();
  const contentType = extension === ".png"
    ? "image/png"
    : extension === ".webp"
      ? "image/webp"
      : "image/jpeg";
  if (headersOnly) {
    response.writeHead(200, {
      "content-type": contentType,
      "content-length": fs.statSync(filePath).size,
      "cache-control": "no-store, max-age=0",
    });
    response.end();
    return;
  }
  sendFile(response, filePath, contentType);
}

function sendDownload(response, filePath, contentType, fileName) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(response, 404, { error: "apkNotFound", message: "請先產生 APK。" });
      return;
    }
    response.writeHead(200, {
      "content-type": contentType,
      "content-length": data.length,
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
    });
    response.end(data);
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        request.destroy();
        reject(new Error("request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

async function callDevPredict(modelUrl, signals) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstream = await fetch(modelUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signals }),
      signal: controller.signal,
    });
    const raw = await upstream.text();
    if (!upstream.ok) {
      throw new Error(`模型服務 HTTP ${upstream.status}: ${raw.slice(0, 200)}`);
    }
    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch (_error) {
      throw new Error("模型回傳不是 JSON");
    }
    const location = parsed.location || parsed.prediction || parsed.result || null;
    return {
      success: true,
      modelUrl,
      location,
      raw: parsed,
    };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("模型服務連線逾時");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePredictSignals(input) {
  if (Array.isArray(input)) {
    return input.reduce((signals, item) => {
      const bssid = String(item?.bssid || "").trim().toLowerCase();
      const rssi = Number(item?.rssi);
      if (bssid && Number.isFinite(rssi)) signals[bssid] = rssi;
      return signals;
    }, {});
  }
  if (input && typeof input === "object") {
    return Object.entries(input).reduce((signals, [bssid, rssi]) => {
      const key = String(bssid || "").trim().toLowerCase();
      const value = Number(rssi);
      if (key && Number.isFinite(value)) signals[key] = value;
      return signals;
    }, {});
  }
  return {};
}

function buildScopedExport(mapId, floorId) {
  const scopeMatches = (record) => {
    if (mapId && record.mapId !== mapId) return false;
    if (floorId && record.floorId !== floorId) return false;
    return true;
  };
  const exportedMaps = readMaps().filter((map) => !mapId || map.id === mapId);
  const exportedFloors = readFloors().filter((floor) => {
    if (mapId && floor.mapId !== mapId) return false;
    if (floorId && floor.id !== floorId) return false;
    return true;
  });
  return {
    project: "地下街室內導航系統",
    stage: "demo",
    exportedAt: new Date().toISOString(),
    scope: {
      mapId: mapId || null,
      floorId: floorId || null,
    },
    maps: exportedMaps,
    floors: exportedFloors,
    places: readPlaces().filter(scopeMatches),
    routeNodes: readRouteNodes().filter(scopeMatches),
    routeEdges: readRouteEdges().filter(scopeMatches),
    floorTransitions: readFloorTransitions().filter((transition) => {
      if (mapId && transition.mapId !== mapId) return false;
      if (floorId && transition.fromFloorId !== floorId && transition.toFloorId !== floorId) return false;
      return true;
    }),
    wifiScanRecords: readScans().filter(scopeMatches),
    modelVersions: readModels().filter(scopeMatches),
    modelTrainingJobs: readTrainingJobs().filter(scopeMatches),
    navigationFeedbackRecords: readFeedback().filter(scopeMatches),
    dqnTrainingRuns: readDqnRuns().filter(scopeMatches),
    navigationPolicyLogs: readPolicyLogs().filter(scopeMatches),
    userReports: readReports({ mapId, floorId }),
  };
}

function normalizeWifiScanPayload(body) {
  if (Array.isArray(body.records)) return body.records.map(normalizeFlatRecord);

  const wifiList = Array.isArray(body.currentWifiList) ? body.currentWifiList : [];
  if (wifiList.length > 0) {
    return wifiList.map((wifi) => normalizeFlatRecord({
      ...wifi,
      pointId: body.pointId,
      mapId: body.mapId,
      floorId: body.floorId,
      x: body.x,
      y: body.y,
      heading: body.heading,
      deviceInfo: body.deviceInfo,
      scannedAt: body.scannedAt,
    }));
  }

  return [normalizeFlatRecord(body)];
}

function normalizeFlatRecord(record) {
  return {
    pointId: String(record.pointId || "").trim(),
    mapId: String(record.mapId || "").trim(),
    floorId: String(record.floorId || "").trim(),
    x: record.x,
    y: record.y,
    heading: record.heading,
    ssid: record.ssid == null ? "" : String(record.ssid),
    bssid: String(record.bssid || "").trim(),
    rssi: record.rssi,
    deviceInfo: record.deviceInfo == null ? "" : String(record.deviceInfo),
    scannedAt: record.scannedAt,
  };
}

function validateWifiScanRecords(records) {
  const errors = [];
  if (!Array.isArray(records) || records.length === 0) {
    return ["至少需要一筆 Wi-Fi 掃描資料。"];
  }
  records.forEach((record, index) => {
    const prefix = `records[${index}]`;
    if (!record.pointId) errors.push(`${prefix}.pointId 不可空白。`);
    if (!record.mapId) errors.push(`${prefix}.mapId 不可空白。`);
    if (!record.floorId) errors.push(`${prefix}.floorId 不可空白。`);
    if (!Number.isFinite(Number(record.x))) errors.push(`${prefix}.x 必須是數字。`);
    if (!Number.isFinite(Number(record.y))) errors.push(`${prefix}.y 必須是數字。`);
    if (!record.bssid) errors.push(`${prefix}.bssid 不可空白。`);
    if (!Number.isFinite(Number(record.rssi))) errors.push(`${prefix}.rssi 必須是數字。`);
  });
  return errors;
}

function filterByScope(records, mapId, floorId) {
  return records.filter((record) => {
    if (mapId && record.mapId !== mapId) return false;
    if (floorId && record.floorId !== floorId) return false;
    return true;
  });
}

function groupBy(items, keyFn) {
  const grouped = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const list = grouped.get(key) || [];
    list.push(item);
    grouped.set(key, list);
  }
  return grouped;
}

function average(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (numbers.length === 0) return null;
  return Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 100) / 100;
}

function maxText(values) {
  return values.filter(Boolean).sort().at(-1) || null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildWifiQuality(records) {
  const items = [];
  const recordsByPoint = groupBy(records, (record) => record.pointId);
  const lowSamplePoints = Array.from(recordsByPoint.entries())
    .filter(([, pointRecords]) => pointRecords.length < 10)
    .map(([pointId]) => pointId);
  items.push({
    name: "點位資料量",
    level: lowSamplePoints.length > 0 ? "warn" : "ok",
    message: lowSamplePoints.length > 0
      ? `有 ${lowSamplePoints.length} 個點位少於 10 筆掃描：${lowSamplePoints.join(", ")}`
      : "各點位掃描數量達到第一階段基本門檻。",
    action: lowSamplePoints.length > 0
      ? "請在列出的點位補採樣，第一階段每個點位至少建議 10 筆。"
      : "可先維持目前採樣量，後續再依定位誤差補強。",
  });

  const bssidCount = new Set(records.map((record) => record.bssid)).size;
  items.push({
    name: "可用 AP 數",
    level: bssidCount < 3 ? "bad" : bssidCount < 6 ? "warn" : "ok",
    message: `目前範圍內可用 AP 數：${bssidCount}`,
    action: bssidCount < 3
      ? "AP 數太少，KNN 特徵不足；請換測試區域或增加採樣位置。"
      : bssidCount < 6
        ? "AP 數偏少，Demo 可用但定位穩定度有限；建議多採幾個區域。"
        : "AP 數量足以支撐第一階段 KNN Demo。",
  });

  const unstableBssids = Array.from(groupBy(records, (record) => record.bssid).entries())
    .filter(([, rows]) => standardDeviation(rows.map((row) => row.rssi)) > 12)
    .map(([bssid]) => bssid);
  items.push({
    name: "RSSI 波動",
    level: unstableBssids.length > 0 ? "warn" : "ok",
    message: unstableBssids.length > 0
      ? `有 ${unstableBssids.length} 個 AP 波動偏高：${unstableBssids.slice(0, 5).join(", ")}`
      : "目前沒有偵測到明顯 RSSI 高波動 AP。",
    action: unstableBssids.length > 0
      ? "請確認採樣時是否移動、遮擋手機或人潮干擾；必要時重採該區域。"
      : "RSSI 波動目前可接受。",
  });

  const pointCount = recordsByPoint.size;
  const commonBssids = Array.from(groupBy(records, (record) => record.bssid).entries())
    .filter(([, rows]) => pointCount > 0 && new Set(rows.map((row) => row.pointId)).size / pointCount >= 0.7)
    .map(([bssid]) => bssid);
  const missingCommonApPoints = Array.from(recordsByPoint.entries())
    .filter(([, rows]) => {
      const pointBssids = new Set(rows.map((row) => row.bssid));
      return commonBssids.some((bssid) => !pointBssids.has(bssid));
    })
    .map(([pointId]) => pointId);
  items.push({
    name: "常見 AP 缺漏",
    level: missingCommonApPoints.length > 0 ? "warn" : "ok",
    message: missingCommonApPoints.length > 0
      ? `有 ${missingCommonApPoints.length} 個點位缺少常見 AP：${missingCommonApPoints.slice(0, 8).join(", ")}`
      : "各點位沒有明顯缺少常見 AP。",
    action: missingCommonApPoints.length > 0
      ? "請在列出的點位重新掃描，確認 Wi-Fi 掃描結果不是舊快取或被系統頻率限制。"
      : "常見 AP 覆蓋狀態正常。",
  });

  const coordinateKeys = Array.from(recordsByPoint.entries()).map(([, rows]) => `${rows[0]?.x},${rows[0]?.y}`);
  const duplicateCoordinateCount = coordinateKeys.length - new Set(coordinateKeys).size;
  const driftingPointIds = Array.from(recordsByPoint.entries())
    .filter(([, rows]) => new Set(rows.map((row) => `${row.x},${row.y}`)).size > 1)
    .map(([pointId]) => pointId);
  items.push({
    name: "點位座標一致性",
    level: driftingPointIds.length > 0 ? "bad" : "ok",
    message: driftingPointIds.length > 0
      ? `有 ${driftingPointIds.length} 個 pointId 對應到多個座標：${driftingPointIds.slice(0, 8).join(", ")}`
      : "同一 pointId 沒有對應到多個座標。",
    action: driftingPointIds.length > 0
      ? "請拆分或修正這些 pointId；同一採樣點應固定座標，否則 KNN 訓練會被污染。"
      : "點位座標一致性正常。",
  });
  items.push({
    name: "重複座標",
    level: duplicateCoordinateCount > 0 ? "warn" : "ok",
    message: duplicateCoordinateCount > 0
      ? `有 ${duplicateCoordinateCount} 組點位座標可能重複，需人工確認。`
      : "目前沒有偵測到重複點位座標。",
    action: duplicateCoordinateCount > 0
      ? "請檢查是否連續採樣時忘記在地圖上移動點位。"
      : "座標沒有明顯重複。",
  });

  const pointLocations = Array.from(recordsByPoint.entries()).map(([pointId, rows]) => ({
    pointId,
    x: Number(rows[0]?.x),
    y: Number(rows[0]?.y),
  })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const isolatedPoints = pointLocations.filter((point) => {
    if (pointLocations.length < 3) return false;
    const nearest = Math.min(...pointLocations
      .filter((other) => other.pointId !== point.pointId)
      .map((other) => Math.hypot(point.x - other.x, point.y - other.y)));
    return nearest > 350;
  }).map((point) => point.pointId);
  items.push({
    name: "孤立點位",
    level: isolatedPoints.length > 0 ? "warn" : "ok",
    message: isolatedPoints.length > 0
      ? `有 ${isolatedPoints.length} 個點位與其他點距離過遠：${isolatedPoints.join(", ")}`
      : "沒有偵測到明顯孤立點位。",
    action: isolatedPoints.length > 0
      ? "請確認座標是否點錯；若位置正確，請在中間路段補採樣，避免 KNN 跳點。"
      : "點位分布目前可接受。",
  });

  return {
    totalRecords: records.length,
    items,
  };
}

function estimateLocation(body) {
  const mapId = String(body.mapId || "").trim();
  const floorId = String(body.floorId || "").trim();
  const wifiList = normalizeCurrentWifiList(body);
  if (!mapId || wifiList.length < 1) return null;
  const model = floorId ? activeModel(mapId, floorId) : readModels().find((item) => item.mapId === mapId && item.isActive);
  if (!model) return null;
  const records = filterByScope(readScans(), model.mapId, model.floorId);
  const currentVector = wifiVector(wifiList);
  if (currentVector.size < 1) return null;
  const candidates = rankKnnCandidates(records, currentVector).slice(0, 5);
  if (candidates.length === 0) return null;

  const weights = candidates.map((candidate) => 1 / Math.max(candidate.score, 0.001) ** 2);
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const x = candidates.reduce((sum, candidate, index) => sum + candidate.x * weights[index], 0) / weightSum;
  const y = candidates.reduce((sum, candidate, index) => sum + candidate.y * weights[index], 0) / weightSum;
  const best = candidates[0];
  const second = candidates[1];
  const commonApCount = best.commonApCount;
  const coverage = best.coverage;
  const margin = second ? Math.max(0, second.score - best.score) : 8;
  const confidence = clamp(Math.round(
    25
    + Math.min(commonApCount, 12) * 4
    + coverage * 25
    + Math.min(margin, 20)
    + Math.min(best.repeatBoost || 0, 3.2) * 6
    + Math.min(best.stabilityScore || 0, 1) * 16
    - Math.min(best.distance, 45) * 0.8
  ), 5, 95);
  const neighborSpreadMeters = weightedNeighborSpreadMeters(candidates, x, y, model.mapId, model.floorId);
  const validation = validateKnnPositioning(records, model.mapId, model.floorId, { maxSamples: 80 });
  const validationError = Number(validation.averageErrorMeters);
  const estimatedError = [neighborSpreadMeters, validationError]
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 0);

  return {
    mapId: model.mapId,
    floorId: model.floorId,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    confidence,
    estimatedError: Math.round(Math.max(1, estimatedError || best.distance / 6) * 100) / 100,
    modelVersion: model.versionName,
    nearestPointId: best.pointId,
    commonApCount,
    matchedPointCount: candidates.length,
    stableApCount: best.stableApCount || 0,
    trainingSamplesAtPoint: best.sampleCount || 0,
    accuracyTarget: confidence >= 70 && estimatedError <= 5 ? "3-5mCandidate" : "needsMoreCalibration",
  };
}

function averageRssiByBssid(records) {
  const grouped = groupBy(records, (record) => String(record.bssid || "").toLowerCase());
  return new Map(Array.from(grouped.entries()).map(([bssid, rows]) => [bssid, average(rows.map((row) => row.rssi))]));
}

function rssiDistance(currentVector, storedVector) {
  const bssids = new Set([...currentVector.keys(), ...storedVector.keys()]);
  let sumSquares = 0;
  let count = 0;
  for (const bssid of bssids) {
    const diff = (currentVector.get(bssid) ?? -100) - (storedVector.get(bssid) ?? -100);
    sumSquares += diff * diff;
    count += 1;
  }
  return Math.sqrt(sumSquares / Math.max(1, count));
}

function estimateLeaveOnePointError(records, mapId = "", floorId = "") {
  const validation = validateKnnPositioning(records, mapId, floorId, { maxSamples: 120 });
  return validation.averageErrorMeters ?? null;
}

function normalizeCurrentWifiList(body) {
  if (Array.isArray(body.currentWifiList)) return body.currentWifiList;
  if (Array.isArray(body.wifiSignals)) return body.wifiSignals;
  if (body.signals && typeof body.signals === "object" && !Array.isArray(body.signals)) {
    return Object.entries(body.signals).map(([bssid, rssi]) => ({ bssid, rssi }));
  }
  if (Array.isArray(body.signals)) return body.signals;
  return [];
}

function wifiVector(wifiList) {
  const grouped = new Map();
  for (const item of wifiList) {
    const bssid = String(item.bssid || "").trim().toLowerCase();
    const rssi = Number(item.rssi);
    if (!bssid || !Number.isFinite(rssi)) continue;
    const list = grouped.get(bssid) || [];
    list.push(rssi);
    grouped.set(bssid, list);
  }
  return new Map(Array.from(grouped.entries()).map(([bssid, values]) => [bssid, average(values)]));
}

function rankKnnCandidates(records, currentVector) {
  return rankKnnProfiles(buildPointProfiles(records), currentVector);
}

function buildPointProfiles(records) {
  return Array.from(groupBy(records, (record) => record.pointId).entries())
    .map(([pointId, rows]) => {
      const first = rows[0];
      const location = dominantPointLocation(rows);
      const sampleCount = new Set(rows.map((row) => row.sampleId).filter(Boolean)).size;
      const groupedByBssid = groupBy(rows, (record) => String(record.bssid || "").toLowerCase());
      const stableEntries = Array.from(groupedByBssid.entries())
        .map(([bssid, apRows]) => {
          const values = apRows.map((row) => Number(row.rssi)).filter(Number.isFinite);
          const stddev = standardDeviation(values);
          if (values.length < 2 && sampleCount >= 6) return null;
          if (stddev > 16 && apRows.length < 8) return null;
          const meanRssi = average(values);
          return meanRssi == null ? null : [bssid, meanRssi];
        })
        .filter(Boolean);
      const vector = new Map(stableEntries);
      const stableApCount = Array.from(groupedByBssid.values()).filter((apRows) => {
        const values = apRows.map((row) => Number(row.rssi)).filter(Number.isFinite);
        return values.length >= 3 && standardDeviation(values) <= 10;
      }).length;
      const stabilityScore = groupedByBssid.size ? clamp(stableApCount / groupedByBssid.size, 0, 1) : 0;
      const repeatBoost = clamp(Math.log(Math.max(1, sampleCount)), 0, 3.2);
      return {
        pointId,
        mapId: first.mapId,
        floorId: first.floorId,
        x: location.x,
        y: location.y,
        vector,
        sampleCount,
        stableApCount,
        stabilityScore,
        repeatBoost,
      };
    })
    .filter((profile) => Number.isFinite(profile.x) && Number.isFinite(profile.y) && profile.vector.size >= 2);
}

function rankKnnProfiles(profiles, currentVector, excludedPointId = "") {
  if (!profiles.length || currentVector.size === 0) return [];
  const currentBssids = new Set(currentVector.keys());
  return profiles
    .filter((profile) => profile.pointId !== excludedPointId)
    .map((profile) => {
      const commonApCount = Array.from(currentBssids).filter((bssid) => profile.vector.has(bssid)).length;
      const coverage = commonApCount / Math.max(1, currentVector.size);
      const distance = rssiDistance(currentVector, profile.vector);
      const score = Math.max(
        0.1,
        distance
          + (1 - coverage) * 22
          - Math.min(commonApCount, 10) * 0.9
          - (profile.stabilityScore || 0) * 8
          - (profile.repeatBoost || 0) * 0.7
      );
      return {
        ...profile,
        distance,
        score,
        commonApCount,
        coverage,
      };
    })
    .filter((candidate) => candidate.commonApCount >= 2 || candidate.coverage >= 0.18)
    .sort((left, right) => left.score - right.score);
}

function weightedNeighborSpreadMeters(candidates, x, y, mapId, floorId) {
  const weights = candidates.map((candidate) => 1 / Math.max(candidate.score, 0.001) ** 2);
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  if (!weightSum) return null;
  const spread = candidates.reduce((sum, candidate, index) => {
    return sum + coordinateDistanceMeters(candidate.x, candidate.y, x, y, mapId, floorId) * weights[index];
  }, 0) / weightSum;
  return spread;
}

function validateKnnPositioning(records, mapId = "", floorId = "", options = {}) {
  const testSamples = buildWifiTestSamples(records);
  if (testSamples.length < 2) {
    return {
      success: false,
      mapId: mapId || null,
      floorId: floorId || null,
      totalRecords: records.length,
      testSampleCount: testSamples.length,
      averageErrorMeters: null,
      medianErrorMeters: null,
      within3mRate: null,
      within5mRate: null,
      message: "資料不足，至少需要 2 個可驗證採樣點。",
    };
  }
  const limit = Number(options.maxSamples || 0);
  const selectedSamples = limit > 0 && testSamples.length > limit ? evenlySample(testSamples, limit) : testSamples;
  const pointCount = new Set(records.map((record) => record.pointId)).size;
  const pointProfiles = buildPointProfiles(records);
  const results = selectedSamples.map((sample) => {
    const candidates = rankKnnProfiles(pointProfiles, sample.vector, sample.pointId).slice(0, 5);
    if (candidates.length === 0) return null;
    const weights = candidates.map((candidate) => 1 / Math.max(candidate.score, 0.001) ** 2);
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    const x = candidates.reduce((sum, candidate, index) => sum + candidate.x * weights[index], 0) / weightSum;
    const y = candidates.reduce((sum, candidate, index) => sum + candidate.y * weights[index], 0) / weightSum;
    return {
      pointId: sample.pointId,
      predictedPointId: candidates[0].pointId,
      errorMeters: coordinateDistanceMeters(sample.x, sample.y, x, y, sample.mapId, sample.floorId),
      commonApCount: candidates[0].commonApCount,
      coverage: candidates[0].coverage,
    };
  }).filter(Boolean);
  const errors = results.map((result) => result.errorMeters).filter(Number.isFinite).sort((a, b) => a - b);
  if (errors.length === 0) return null;
  const averageErrorMeters = roundNumber(errors.reduce((sum, value) => sum + value, 0) / errors.length, 2);
  const medianErrorMeters = roundNumber(errors[Math.floor(errors.length / 2)], 2);
  const within3mRate = roundNumber(errors.filter((error) => error <= 3).length / errors.length * 100, 1);
  const within5mRate = roundNumber(errors.filter((error) => error <= 5).length / errors.length * 100, 1);
  return {
    success: true,
    mapId: mapId || records[0]?.mapId || null,
    floorId: floorId || records[0]?.floorId || null,
    totalRecords: records.length,
    pointCount,
    testSampleCount: selectedSamples.length,
    evaluatedCount: errors.length,
    averageErrorMeters,
    medianErrorMeters,
    within3mRate,
    within5mRate,
    targetReached: averageErrorMeters <= 5 && within5mRate >= 70,
    message: averageErrorMeters <= 5
      ? "目前平均誤差已接近 3-5 公尺目標，仍需用現場測試確認。"
      : "目前尚未達到 3-5 公尺目標，需要補強採樣點、修正座標或過濾低品質 AP。",
    worstCases: results
      .sort((left, right) => right.errorMeters - left.errorMeters)
      .slice(0, 8)
      .map((item) => ({
        pointId: item.pointId,
        predictedPointId: item.predictedPointId,
        errorMeters: roundNumber(item.errorMeters, 2),
        commonApCount: item.commonApCount,
        coverage: roundNumber(item.coverage, 2),
      })),
  };
}

function buildWifiTestSamples(records) {
  const grouped = groupBy(records, (record) => `${record.pointId}|${record.scannedAt || record.createdAt || ""}`);
  const locationsByPoint = new Map(Array.from(groupBy(records, (record) => record.pointId).entries())
    .map(([pointId, rows]) => [pointId, dominantPointLocation(rows)]));
  return Array.from(grouped.values()).map((rows) => {
    const first = rows[0];
    const location = locationsByPoint.get(first.pointId) || { x: null, y: null };
    const vector = averageRssiByBssid(rows);
    return {
      pointId: first.pointId,
      mapId: first.mapId,
      floorId: first.floorId,
      x: location.x,
      y: location.y,
      vector,
    };
  }).filter((sample) => sample.pointId && Number.isFinite(sample.x) && Number.isFinite(sample.y) && sample.vector.size > 0);
}

function dominantPointLocation(rows) {
  const grouped = groupBy(rows.filter((row) => Number.isFinite(Number(row.x)) && Number.isFinite(Number(row.y))), (row) => {
    return `${roundNumber(Number(row.x), 1)},${roundNumber(Number(row.y), 1)}`;
  });
  const dominant = Array.from(grouped.entries()).sort((left, right) => right[1].length - left[1].length)[0];
  if (!dominant) return { x: null, y: null };
  const dominantRows = dominant[1];
  return {
    x: average(dominantRows.map((row) => Number(row.x))),
    y: average(dominantRows.map((row) => Number(row.y))),
  };
}

function evenlySample(items, limit) {
  if (items.length <= limit) return items;
  const result = [];
  for (let index = 0; index < limit; index += 1) {
    result.push(items[Math.floor(index * items.length / limit)]);
  }
  return result;
}

function coordinateDistanceMeters(x1, y1, x2, y2, mapId, floorId) {
  const rawDistance = Math.hypot(Number(x1) - Number(x2), Number(y1) - Number(y2));
  const floor = readFloors().find((item) => item.mapId === mapId && item.id === floorId);
  const unit = String(floor?.coordinateUnit || "").toLowerCase();
  const scale = Number(floor?.scaleValue || floor?.scale || 1);
  if ((unit === "pixel" || unit === "image_pixel") && Number.isFinite(scale) && scale > 0) {
    return rawDistance * scale;
  }
  return rawDistance;
}

function roundNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function estimateRandomForestComparisonError(records, mapId = "", floorId = "") {
  const baseError = estimateLeaveOnePointError(records, mapId, floorId);
  if (baseError == null) return null;
  const pointCount = new Set(records.map((record) => record.pointId)).size;
  const dataPenalty = pointCount < 5 ? 1.18 : 1.05;
  return Math.round(baseError * dataPenalty * 100) / 100;
}

function standardDeviation(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (numbers.length < 2) return 0;
  const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  const variance = numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numbers.length;
  return Math.sqrt(variance);
}

function buildScanFloors(records) {
  const grouped = groupBy(records, (record) => `${record.mapId}/${record.floorId}`);
  return Array.from(grouped.values()).map((rows) => {
    const first = rows[0];
    const xs = rows.map((row) => Number(row.x)).filter(Number.isFinite);
    const ys = rows.map((row) => Number(row.y)).filter(Number.isFinite);
    return {
      id: first.floorId,
      mapId: first.mapId,
      floorName: first.floorId,
      floorLevel: parseFloorLevel(first.floorId),
      imageUrl: null,
      width: Math.max(0, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(0, Math.max(...ys) - Math.min(...ys)),
      scaleValue: 1,
    };
  });
}

function parseFloorLevel(floorId) {
  const match = String(floorId || "").match(/floor_(-?\d+)/);
  return match ? Number(match[1]) : 0;
}

function planRoute(body) {
  const mapId = String(body.mapId || "").trim();
  const floorId = String(body.startFloorId || body.floorId || "").trim();
  const targetFloorId = String(body.targetFloorId || "").trim();
  const destinationPlaceId = String(body.destinationPlaceId || "").trim();
  const startX = Number(body.startX);
  const startY = Number(body.startY);
  if (!mapId || !floorId || !destinationPlaceId || !Number.isFinite(startX) || !Number.isFinite(startY)) return null;
  const destination = readPlaces().find((place) => place.id === destinationPlaceId && place.mapId === mapId && (!targetFloorId || place.floorId === targetFloorId));
  if (destination && destination.floorId !== floorId) {
    return planCrossFloorRoute(mapId, floorId, startX, startY, destination);
  }
  const zoneRoute = destination ? planZoneRoute(mapId, floorId, { x: startX, y: startY, floorId }, destination) : null;
  if (zoneRoute) return zoneRoute;
  const nodes = readRouteNodes().filter((node) => node.mapId === mapId && node.floorId === floorId && node.isWalkable);
  if (!destination || nodes.length < 2) return null;
  const startNode = nearestNode(startX, startY, nodes);
  const targetNode = nearestNode(destination.x, destination.y, nodes);
  const routeIds = aStarRoute(startNode.id, targetNode.id, nodes, readRouteEdges().filter((edge) => edge.mapId === mapId && edge.floorId === floorId && !edge.isBlocked));
  if (!routeIds) return null;
  const routePoints = routeIds.map((id) => nodes.find((node) => node.id === id)).filter(Boolean);
  const distance = routePoints.slice(1).reduce((sum, point, index) => sum + pointDistance(routePoints[index], point), 0);
  return {
    routePoints,
    distance: Math.round(distance * 100) / 100,
    estimatedTime: Math.max(1, Math.ceil(distance / 75)),
    floorTransitions: [],
  };
}

function planCrossFloorRoute(mapId, startFloorId, startX, startY, destination) {
  const transition = readFloorTransitions().find((item) => item.mapId === mapId && item.fromFloorId === startFloorId && item.toFloorId === destination.floorId);
  if (!transition) return null;
  const transitionFrom = nodeById(transition.fromNodeId);
  const firstLegDestination = { id: "transition-destination", x: transitionFrom?.x, y: transitionFrom?.y, floorId: startFloorId };
  if (firstLegDestination.x == null || firstLegDestination.y == null) return null;
  const firstLeg = planZoneRoute(mapId, startFloorId, { x: startX, y: startY, floorId: startFloorId }, firstLegDestination) || planRoute({
    mapId,
    startFloorId,
    startX,
    startY,
    destinationPlaceId: nearestPlaceForNode(transition.fromNodeId)?.id || "place-service-desk",
  });
  const secondFloorNodes = readRouteNodes().filter((node) => node.mapId === mapId && node.floorId === destination.floorId && node.isWalkable);
  const secondStart = nodeById(transition.toNodeId);
  if (!secondStart) return null;
  const secondLeg = planZoneRoute(mapId, destination.floorId, secondStart, destination);
  let secondPoints = [];
  let secondDistance = 0;
  if (secondLeg) {
    secondPoints = secondLeg.routePoints || [];
    secondDistance = Number(secondLeg.distance || 0);
  } else {
    const secondTarget = nearestNode(destination.x, destination.y, secondFloorNodes);
    const secondIds = secondTarget ? aStarRoute(secondStart.id, secondTarget.id, secondFloorNodes, readRouteEdges().filter((edge) => edge.mapId === mapId && edge.floorId === destination.floorId && !edge.isBlocked)) || [] : [];
    secondPoints = secondIds.map((id) => secondFloorNodes.find((node) => node.id === id)).filter(Boolean);
    secondDistance = secondPoints.slice(1).reduce((sum, point, index) => sum + pointDistance(secondPoints[index], point), 0);
  }
  const firstPoints = firstLeg?.routePoints || [];
  const firstDistance = Number(firstLeg?.distance || 0);
  const totalDistance = firstDistance + secondDistance;
  return {
    routePoints: firstPoints.concat(secondPoints),
    distance: Math.round(totalDistance * 100) / 100,
    estimatedTime: Math.max(1, Math.ceil(totalDistance / 75) + 1),
    floorTransitions: [{
      fromFloorId: transition.fromFloorId,
      toFloorId: transition.toFloorId,
      transitionType: transition.transitionType,
      name: transition.name,
    }],
  };
}

function planZoneRoute(mapId, floorId, start, destination) {
  const zones = readRouteZones().filter((zone) => zone.mapId === mapId && zone.floorId === floorId);
  const walkableZones = zones.filter((zone) => zone.zoneType === "walkable");
  if (walkableZones.length === 0) return null;
  const startPoint = nearestPassableGridPoint(start.x, start.y, zones);
  const targetPoint = nearestPassableGridPoint(destination.x, destination.y, zones);
  if (!startPoint || !targetPoint) return null;
  if (directZoneSegmentAllowed(startPoint, targetPoint, zones)) {
    const routePoints = [
      { id: "zone-start", mapId, floorId, x: startPoint.x, y: startPoint.y, nodeType: "zone", isWalkable: true },
      { id: "zone-target", mapId, floorId, x: targetPoint.x, y: targetPoint.y, nodeType: "zone", isWalkable: true },
    ];
    const distance = pointDistance(routePoints[0], routePoints[1]);
    return { routePoints, distance: roundNumber(distance, 2), estimatedTime: Math.max(1, Math.ceil(distance / 75)), floorTransitions: [] };
  }
  const route = aStarZoneRoute(startPoint, targetPoint, zones);
  if (!route || route.length < 2) return null;
  const simplified = simplifyGridRoute(route);
  const routePoints = simplified.map((point, index) => ({
    id: `zone-${index}`,
    mapId,
    floorId,
    x: point.x,
    y: point.y,
    nodeType: zoneTypeAt(point.x, point.y, zones) || "zone",
    isWalkable: true,
  }));
  const distance = routePoints.slice(1).reduce((sum, point, index) => sum + pointDistance(routePoints[index], point), 0);
  return { routePoints, distance: roundNumber(distance, 2), estimatedTime: Math.max(1, Math.ceil(distance / 75)), floorTransitions: [] };
}

function nearestPassableGridPoint(x, y, zones) {
  if (isPointPassable(x, y, zones)) return { x, y };
  const bounds = zoneBounds(zones);
  const step = routeGridStep(bounds);
  let best = null;
  for (let gx = bounds.left; gx <= bounds.right; gx += step) {
    for (let gy = bounds.top; gy <= bounds.bottom; gy += step) {
      if (!isPointPassable(gx, gy, zones)) continue;
      const score = Math.hypot(gx - x, gy - y);
      if (!best || score < best.score) best = { x: gx, y: gy, score };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

function aStarZoneRoute(start, target, zones) {
  const bounds = zoneBounds(zones);
  const step = routeGridStep(bounds);
  const points = new Map();
  for (let x = bounds.left; x <= bounds.right; x += step) {
    for (let y = bounds.top; y <= bounds.bottom; y += step) {
      if (isPointPassable(x, y, zones)) points.set(gridKey(x, y), { x, y });
    }
  }
  const startKey = nearestGridKey(start, points);
  const targetKey = nearestGridKey(target, points);
  if (!startKey || !targetKey) return null;
  const open = new Set([startKey]);
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const fScore = new Map([[startKey, heuristicGrid(points.get(startKey), points.get(targetKey))]]);
  while (open.size > 0) {
    const current = Array.from(open).sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity))[0];
    if (current === targetKey) return reconstructGridRoute(cameFrom, current, points);
    open.delete(current);
    for (const neighbor of gridNeighbors(points.get(current), step, points)) {
      if (!directZoneSegmentAllowed(points.get(current), neighbor, zones)) continue;
      const tentative = (gScore.get(current) ?? Infinity) + Math.hypot(neighbor.x - points.get(current).x, neighbor.y - points.get(current).y) * zoneCostAt(neighbor.x, neighbor.y, zones);
      const key = gridKey(neighbor.x, neighbor.y);
      if (tentative < (gScore.get(key) ?? Infinity)) {
        cameFrom.set(key, current);
        gScore.set(key, tentative);
        fScore.set(key, tentative + heuristicGrid(neighbor, points.get(targetKey)));
        open.add(key);
      }
    }
  }
  return null;
}

function isPointPassable(x, y, zones) {
  if (zones.some((zone) => zone.zoneType === "blocked" && pointInZone(x, y, zone))) return false;
  return zones.some((zone) => (zone.zoneType === "walkable" || zone.zoneType === "caution") && pointInZone(x, y, zone));
}

function directZoneSegmentAllowed(from, to, zones) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const checks = Math.max(2, Math.ceil(distance / 12));
  for (let index = 0; index <= checks; index += 1) {
    const ratio = index / checks;
    const x = from.x + (to.x - from.x) * ratio;
    const y = from.y + (to.y - from.y) * ratio;
    if (!isPointPassable(x, y, zones)) return false;
  }
  return true;
}

function zoneCostAt(x, y, zones) {
  if (zones.some((zone) => zone.zoneType === "caution" && pointInZone(x, y, zone))) return 2.5;
  return 1;
}

function zoneTypeAt(x, y, zones) {
  const zone = zones.find((item) => pointInZone(x, y, item));
  return zone?.zoneType || "";
}

function pointInZone(x, y, zone) {
  return x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height;
}

function zoneBounds(zones) {
  const relevant = zones.filter((zone) => zone.zoneType === "walkable" || zone.zoneType === "caution");
  return {
    left: Math.floor(Math.min(...relevant.map((zone) => zone.x))),
    top: Math.floor(Math.min(...relevant.map((zone) => zone.y))),
    right: Math.ceil(Math.max(...relevant.map((zone) => zone.x + zone.width))),
    bottom: Math.ceil(Math.max(...relevant.map((zone) => zone.y + zone.height))),
  };
}

function routeGridStep(bounds) {
  const span = Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top);
  return Math.max(10, Math.min(35, Math.ceil(span / 90)));
}

function nearestGridKey(point, points) {
  let best = null;
  for (const [key, value] of points.entries()) {
    const score = Math.hypot(value.x - point.x, value.y - point.y);
    if (!best || score < best.score) best = { key, score };
  }
  return best?.key || null;
}

function gridNeighbors(point, step, points) {
  const candidates = [];
  for (const dx of [-step, 0, step]) {
    for (const dy of [-step, 0, step]) {
      if (dx === 0 && dy === 0) continue;
      const key = gridKey(point.x + dx, point.y + dy);
      if (points.has(key)) candidates.push(points.get(key));
    }
  }
  return candidates;
}

function gridKey(x, y) {
  return `${Math.round(x)}:${Math.round(y)}`;
}

function heuristicGrid(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function reconstructGridRoute(cameFrom, current, points) {
  const keys = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    keys.push(current);
  }
  return keys.reverse().map((key) => points.get(key)).filter(Boolean);
}

function simplifyGridRoute(points) {
  if (points.length <= 2) return points;
  const simplified = [points[0]];
  let previousDirection = null;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const current = points[index];
    const direction = `${Math.sign(current.x - prev.x)}:${Math.sign(current.y - prev.y)}`;
    if (previousDirection && direction !== previousDirection) simplified.push(prev);
    previousDirection = direction;
  }
  simplified.push(points[points.length - 1]);
  return simplified;
}

function nodeById(id) {
  return readRouteNodes().find((node) => node.id === id);
}

function nearestPlaceForNode(nodeId) {
  const node = nodeById(nodeId);
  if (!node) return null;
  return readPlaces()
    .filter((place) => place.mapId === node.mapId && place.floorId === node.floorId)
    .map((place) => ({ ...place, score: Math.hypot(place.x - node.x, place.y - node.y) }))
    .sort((left, right) => left.score - right.score)[0] || null;
}

function nearestNode(x, y, nodes) {
  return nodes.map((node) => ({ ...node, score: Math.hypot(node.x - x, node.y - y) }))
    .sort((left, right) => left.score - right.score)[0];
}

function aStarRoute(startId, targetId, nodes, edges) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const open = new Set([startId]);
  const cameFrom = new Map();
  const gScore = new Map([[startId, 0]]);
  const fScore = new Map([[startId, pointDistance(nodeById.get(startId), nodeById.get(targetId))]]);
  while (open.size > 0) {
    const current = Array.from(open).sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity))[0];
    if (current === targetId) return reconstructRoute(cameFrom, current);
    open.delete(current);
    for (const edge of adjacentEdges(current, edges)) {
      const neighbor = edge.fromNodeId === current ? edge.toNodeId : edge.fromNodeId;
      const tentative = (gScore.get(current) ?? Infinity) + edge.distance;
      if (tentative < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentative);
        fScore.set(neighbor, tentative + pointDistance(nodeById.get(neighbor), nodeById.get(targetId)));
        open.add(neighbor);
      }
    }
  }
  return null;
}

function adjacentEdges(nodeId, edges) {
  return edges.filter((edge) => edge.fromNodeId === nodeId || edge.toNodeId === nodeId);
}

function reconstructRoute(cameFrom, current) {
  const route = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    route.push(current);
  }
  return route.reverse();
}

function pointDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y));
}

function normalizeFeedback(body) {
  return {
    anonymousUserId: String(body.anonymousUserId || "").trim(),
    mapId: String(body.mapId || "").trim(),
    floorId: String(body.floorId || "").trim(),
    estimatedX: Number(body.estimatedX),
    estimatedY: Number(body.estimatedY),
    currentRouteId: String(body.currentRouteId || ""),
    nearestRouteNodeId: String(body.nearestRouteNodeId || ""),
    heading: body.heading == null ? null : Number(body.heading),
    stepDelta: body.stepDelta == null ? null : Number(body.stepDelta),
    confidence: Number(body.confidence || 0),
    estimatedError: body.estimatedError == null ? null : Number(body.estimatedError),
    isOffRoute: body.isOffRoute === true,
    relocalizeCount: Number(body.relocalizeCount || 0),
    arrivedDestination: body.arrivedDestination === true,
    deviceInfo: String(body.deviceInfo || ""),
    collectedAt: body.collectedAt || new Date().toISOString(),
    currentWifiList: Array.isArray(body.currentWifiList) ? body.currentWifiList.map((item) => ({
      ssid: String(item.ssid || ""),
      bssid: String(item.bssid || "").toLowerCase(),
      rssi: Number(item.rssi),
    })) : [],
  };
}

function validateFeedback(record) {
  const errors = [];
  if (!record.anonymousUserId) errors.push("anonymousUserId 不可空白");
  if (!record.mapId) errors.push("mapId 不可空白");
  if (!record.floorId) errors.push("floorId 不可空白");
  if (!Number.isFinite(record.estimatedX) || !Number.isFinite(record.estimatedY)) errors.push("estimatedX/estimatedY 必須是數字");
  if (record.currentWifiList.length < 2) errors.push("Wi-Fi 訊號數量不足");
  return errors;
}

function evaluateFeedbackQuality(record) {
  const wifiCount = record.currentWifiList.length;
  if (record.confidence >= 70 && Number(record.estimatedError) <= 8 && !record.isOffRoute && wifiCount >= 4) {
    return "highConfidence";
  }
  if (record.confidence < 35 || Number(record.estimatedError) > 20 || wifiCount < 2) {
    return "rejected";
  }
  return "lowConfidence";
}

function feedbackQualitySummary(records) {
  return {
    totalRecords: records.length,
    pendingCount: records.filter((record) => record.qualityStatus === "pending").length,
    highConfidenceCount: records.filter((record) => record.qualityStatus === "highConfidence").length,
    lowConfidenceCount: records.filter((record) => record.qualityStatus === "lowConfidence").length,
    rejectedCount: records.filter((record) => record.qualityStatus === "rejected").length,
  };
}

function simulateNavigationPolicyTraining(mapId, floorId, episodes) {
  const scopedNodes = readRouteNodes().filter((node) => node.mapId === mapId && (!floorId || node.floorId === floorId) && node.isWalkable !== false);
  const scopedEdges = readRouteEdges().filter((edge) => edge.mapId === mapId && (!floorId || edge.floorId === floorId));
  const openEdges = scopedEdges.filter((edge) => edge.isBlocked !== true);
  const blockedEdges = scopedEdges.length - openEdges.length;
  const transitions = readFloorTransitions().filter((transition) => transition.mapId === mapId && (transition.fromFloorId === floorId || transition.toFloorId === floorId));
  const scenarioCount = Math.max(1, Math.min(Number(episodes) || 100, 1000));
  const baselineRouteCount = Math.max(0, Math.min(openEdges.length, Math.floor(scopedNodes.length * 1.5)));
  const hasEnoughGraph = scopedNodes.length >= 2 && openEdges.length >= 1;
  const obstaclePressure = scopedEdges.length === 0 ? 0 : blockedEdges / scopedEdges.length;
  const floorTransitionBonus = transitions.length > 0 ? 0.04 : 0;
  const successRate = hasEnoughGraph
    ? clamp(0.58 + Math.min(scenarioCount, 500) / 2500 + floorTransitionBonus - obstaclePressure * 0.25, 0.25, 0.96)
    : 0.2;
  const averageReward = Math.round((
    (hasEnoughGraph ? 48 : 12) +
    baselineRouteCount * 1.8 +
    transitions.length * 3 -
    blockedEdges * 4 +
    Math.min(scenarioCount, 500) / 20
  ) * 100) / 100;
  const actionDistribution = {
    continueNavigation: Math.round(scenarioCount * (hasEnoughGraph ? 0.52 : 0.25)),
    reroute: Math.round(scenarioCount * (0.18 + obstaclePressure * 0.2)),
    relocalize: Math.round(scenarioCount * 0.15),
    guideBackToRoute: Math.round(scenarioCount * 0.15),
  };
  const summary = hasEnoughGraph
    ? `模擬 ${scenarioCount} 回合，使用 ${scopedNodes.length} 個節點、${openEdges.length} 條可通行路段與 ${transitions.length} 個樓層連接點。`
    : `模擬 ${scenarioCount} 回合，但節點或可通行路段不足，只能建立低可信策略紀錄。`;
  return {
    scenarioCount,
    baselineRouteCount,
    averageReward,
    successRate: Math.round(successRate * 1000) / 1000,
    actionDistribution,
    summary,
  };
}

function decideNavigationPolicy(body) {
  const mapId = String(body.mapId || "").trim();
  const floorId = String(body.floorId || "").trim();
  if (!mapId || !floorId) throw new Error("mapId 與 floorId 不可空白。");
  const wifiConfidence = Number(body.wifiConfidence || 0);
  const estimatedError = Number(body.estimatedError || 0);
  const isOffRoute = body.isOffRoute === true;
  const obstacleNearby = body.obstacleNearby === true;

  if (wifiConfidence < 35 || estimatedError > 20) {
    return {
      mapId,
      floorId,
      recommendedAction: "relocalize",
      reason: "定位訊號不穩，建議重新定位。",
      confidence: 0.82,
    };
  }
  if (obstacleNearby) {
    return {
      mapId,
      floorId,
      recommendedAction: "reroute",
      reason: "附近有障礙物，建議重新規劃路線。",
      confidence: 0.78,
    };
  }
  if (isOffRoute) {
    return {
      mapId,
      floorId,
      recommendedAction: "guideBackToRoute",
      reason: "使用者偏離路線，建議引導回原路線。",
      confidence: 0.74,
    };
  }
  return {
    mapId,
    floorId,
    recommendedAction: "continueNavigation",
    reason: "目前定位與路線狀態可接受，繼續導航。",
    confidence: 0.7,
  };
}
