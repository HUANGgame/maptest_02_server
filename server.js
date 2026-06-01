const http = require("http");
const fs = require("fs");
const path = require("path");
const { floorTransitions, routeNodes } = require("./lib/demoData");
const { createFloor, createMap, createPlace, readFloors, readMaps } = require("./lib/catalogStore");
const { appendFeedback, readFeedback, writeFeedback } = require("./lib/feedbackStore");
const { appendHistory, appendSavedLocation, clearHistory, clearSavedLocations, readHistory, readSavedLocations } = require("./lib/historyStore");
const { activateModel, activeModel, createModelVersion, readModels } = require("./lib/modelStore");
const { readPlaces, updatePlaceStatus } = require("./lib/placeStore");
const { appendPolicyLog, createDqnRun, readDqnRuns, readPolicyLogs } = require("./lib/policyStore");
const { appendReport, readReports } = require("./lib/reportStore");
const { readRouteEdges, setRouteEdgeBlocked } = require("./lib/routeEdgeStore");
const { createTrainingJob, readTrainingJobs } = require("./lib/trainingJobStore");
const { appendScans, readScans } = require("./lib/jsonStore");
const mysqlMirror = require("./lib/mysqlMirror");

const port = Number(process.env.PORT || 3015);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      project: "地下街室內導航系統",
      demoVenue: "淡江大學淡水校園",
      phase: "user-client-ready",
    });
    return;
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app" || url.pathname === "/navigation")) {
    sendFile(response, path.join(__dirname, "public", "index.html"), "text/html; charset=utf-8");
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin") {
    sendFile(response, path.join(__dirname, "public", "admin.html"), "text/html; charset=utf-8");
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
        name: `上傳資料地圖 ${mapId}`,
        description: "由 Android 管理者採樣工具上傳後自動顯示。",
      }));
    sendJson(response, 200, readMaps().concat(scanMaps));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/maps") {
    try {
      const body = await readJsonBody(request);
      sendJson(response, 201, { success: true, map: createMap(body) });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/floors") {
    const mapId = url.searchParams.get("mapId") || "";
    const scanFloors = Array.from(new Map(readScans()
      .filter((record) => !mapId || record.mapId === mapId)
      .map((record) => [record.floorId, {
        id: record.floorId,
        mapId: record.mapId,
        floorName: `上傳樓層 ${record.floorId}`,
        floorLevel: parseFloorLevel(record.floorId),
        imageUrl: null,
        width: 0,
        height: 0,
        scaleValue: 1,
      }])).values())
      .filter((floor) => !readFloors().some((item) => item.id === floor.id));
    sendJson(response, 200, readFloors().filter((floor) => !mapId || floor.mapId === mapId).concat(scanFloors));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/floors") {
    try {
      const body = await readJsonBody(request);
      sendJson(response, 201, { success: true, floor: createFloor(body) });
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
      return [place.name, place.category, place.description].some((value) => String(value || "").toLowerCase().includes(keyword));
    }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/places") {
    try {
      const body = await readJsonBody(request);
      sendJson(response, 201, { success: true, place: createPlace(body) });
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/places/status") {
    try {
      const body = await readJsonBody(request);
      const place = updatePlaceStatus(String(body.placeId || "").trim(), String(body.businessStatus || "unset").trim());
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
          ? estimateLeaveOnePointError(records)
          : estimateRandomForestComparisonError(records),
        isActive: algorithm === "knn" && body.activate !== false,
        isComparisonOnly: algorithm !== "knn",
        notes: algorithm === "randomForest"
          ? "Random Forest 目前只作為比較模型，不作為 App 定位主模型。"
          : "",
        versionName: algorithm === "randomForest" ? `RF-comparison-${new Date().toISOString()}` : undefined,
      });
      mysqlMirror.mirrorModels([model]).catch((error) => console.error("MySQL model mirror failed:", error.message));
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

  if (request.method === "POST" && url.pathname === "/api/route-edges/block") {
    try {
      const body = await readJsonBody(request);
      const edge = setRouteEdgeBlocked(String(body.edgeId || "").trim(), body.isBlocked === true);
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
        averageError: estimateLeaveOnePointError(manualRecords),
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

mysqlMirror.startMirror()
  .then((enabled) => {
    server.listen(port, () => {
      console.log(`Navigation backend listening on http://localhost:${port} (${enabled ? "mysql" : "json"} storage)`);
    });
  })
  .catch((error) => {
    console.error("MySQL startup failed, falling back to JSON storage:", error.message);
    server.listen(port, () => {
      console.log(`Navigation backend listening on http://localhost:${port} (json storage)`);
    });
  });

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function sendFile(response, filePath, contentType) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(response, 404, { error: "notFound" });
      return;
    }
    response.writeHead(200, { "content-type": contentType });
    response.end(data);
  });
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
    routeNodes: routeNodes.filter(scopeMatches),
    routeEdges: readRouteEdges().filter(scopeMatches),
    floorTransitions: floorTransitions.filter((transition) => {
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
  const wifiList = Array.isArray(body.currentWifiList) ? body.currentWifiList : [];
  if (!mapId || wifiList.length < 2) return null;
  const model = floorId ? activeModel(mapId, floorId) : readModels().find((item) => item.mapId === mapId && item.isActive);
  if (!model) return null;
  const records = filterByScope(readScans(), model.mapId, model.floorId);
  const currentVector = new Map(wifiList.filter((item) => item.bssid).map((item) => [String(item.bssid).toLowerCase(), Number(item.rssi)]));
  if (currentVector.size < 2) return null;
  const candidates = Array.from(groupBy(records, (record) => record.pointId).entries())
    .map(([pointId, rows]) => {
      const first = rows[0];
      return {
        pointId,
        mapId: first.mapId,
        floorId: first.floorId,
        x: first.x,
        y: first.y,
        vector: averageRssiByBssid(rows),
      };
    })
    .map((candidate) => ({
      ...candidate,
      distance: rssiDistance(currentVector, candidate.vector),
      commonApCount: Array.from(currentVector.keys()).filter((bssid) => candidate.vector.has(bssid)).length,
    }))
    .filter((candidate) => candidate.commonApCount > 0)
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 3);
  if (candidates.length === 0) return null;

  const weights = candidates.map((candidate) => 1 / Math.max(candidate.distance, 0.001));
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const x = candidates.reduce((sum, candidate, index) => sum + candidate.x * weights[index], 0) / weightSum;
  const y = candidates.reduce((sum, candidate, index) => sum + candidate.y * weights[index], 0) / weightSum;
  const best = candidates[0];
  const confidence = Math.max(0, Math.min(100, Math.round(100 - Math.min(best.distance, 100) * 0.7 + Math.min(best.commonApCount, 10) * 4)));

  return {
    mapId: model.mapId,
    floorId: model.floorId,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    confidence,
    estimatedError: Math.round(Math.max(1, best.distance / 10) * 100) / 100,
    modelVersion: model.versionName,
  };
}

function averageRssiByBssid(records) {
  const grouped = groupBy(records, (record) => record.bssid);
  return new Map(Array.from(grouped.entries()).map(([bssid, rows]) => [bssid, average(rows.map((row) => row.rssi))]));
}

function rssiDistance(currentVector, storedVector) {
  const bssids = new Set([...currentVector.keys(), ...storedVector.keys()]);
  let sumSquares = 0;
  for (const bssid of bssids) {
    const diff = (currentVector.get(bssid) ?? -100) - (storedVector.get(bssid) ?? -100);
    sumSquares += diff * diff;
  }
  return Math.sqrt(sumSquares);
}

function estimateLeaveOnePointError(records) {
  const pointGroups = Array.from(groupBy(records, (record) => record.pointId).values());
  if (pointGroups.length < 2) return null;
  const errors = pointGroups.map((rows, index) => {
    const test = rows[0];
    const train = pointGroups.filter((_, groupIndex) => groupIndex !== index).flat();
    const currentWifiList = rows.map((record) => ({ bssid: record.bssid, rssi: record.rssi }));
    const modelLike = { mapId: test.mapId, floorId: test.floorId };
    const candidates = Array.from(groupBy(train, (record) => record.pointId).values()).map((candidateRows) => {
      const first = candidateRows[0];
      return {
        x: first.x,
        y: first.y,
        vector: averageRssiByBssid(candidateRows),
      };
    });
    const currentVector = new Map(currentWifiList.map((item) => [String(item.bssid).toLowerCase(), Number(item.rssi)]));
    const best = candidates.map((candidate) => ({
      ...candidate,
      distance: rssiDistance(currentVector, candidate.vector),
    })).sort((left, right) => left.distance - right.distance)[0];
    return best ? Math.hypot(Number(test.x) - Number(best.x), Number(test.y) - Number(best.y)) : null;
  }).filter((value) => value != null);
  if (errors.length === 0) return null;
  return Math.round(average(errors) * 1000) / 1000;
}

function estimateRandomForestComparisonError(records) {
  const baseError = estimateLeaveOnePointError(records);
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
  const nodes = routeNodes.filter((node) => node.mapId === mapId && node.floorId === floorId && node.isWalkable);
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
  const transition = floorTransitions.find((item) => item.mapId === mapId && item.fromFloorId === startFloorId && item.toFloorId === destination.floorId);
  if (!transition) return null;
  const firstLegDestination = { id: "transition-destination", x: nodeById(transition.fromNodeId)?.x, y: nodeById(transition.fromNodeId)?.y, floorId: startFloorId };
  if (firstLegDestination.x == null || firstLegDestination.y == null) return null;
  const firstLeg = planRoute({
    mapId,
    startFloorId,
    startX,
    startY,
    destinationPlaceId: nearestPlaceForNode(transition.fromNodeId)?.id || "place-service-desk",
  });
  const secondFloorNodes = routeNodes.filter((node) => node.mapId === mapId && node.floorId === destination.floorId && node.isWalkable);
  const secondStart = nodeById(transition.toNodeId);
  const secondTarget = nearestNode(destination.x, destination.y, secondFloorNodes);
  const secondIds = aStarRoute(secondStart.id, secondTarget.id, secondFloorNodes, readRouteEdges().filter((edge) => edge.mapId === mapId && edge.floorId === destination.floorId && !edge.isBlocked)) || [];
  const secondPoints = secondIds.map((id) => secondFloorNodes.find((node) => node.id === id)).filter(Boolean);
  const secondDistance = secondPoints.slice(1).reduce((sum, point, index) => sum + pointDistance(secondPoints[index], point), 0);
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

function nodeById(id) {
  return routeNodes.find((node) => node.id === id);
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
  const scopedNodes = routeNodes.filter((node) => node.mapId === mapId && (!floorId || node.floorId === floorId) && node.isWalkable !== false);
  const scopedEdges = readRouteEdges().filter((edge) => edge.mapId === mapId && (!floorId || edge.floorId === floorId));
  const openEdges = scopedEdges.filter((edge) => edge.isBlocked !== true);
  const blockedEdges = scopedEdges.length - openEdges.length;
  const transitions = floorTransitions.filter((transition) => transition.mapId === mapId && (transition.fromFloorId === floorId || transition.toFloorId === floorId));
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
