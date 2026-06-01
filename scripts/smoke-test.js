const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const smokePort = Number(process.env.SMOKE_PORT || (3100 + Math.floor(Math.random() * 700)));
const baseUrl = process.env.SMOKE_BASE_URL || `http://localhost:${smokePort}`;
const smokeDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "indoor-nav-smoke-"));

async function main() {
  const managedServer = process.env.SMOKE_BASE_URL ? null : await startManagedServer();
  const checks = [];
  try {
    checks.push(assert(await request("GET", "/api/health"), (body) => body.status === "ok", "health"));
    checks.push(assert(await request("POST", "/api/maps", {
      id: "smoke-map",
      name: "Smoke Test Map",
      description: "created by smoke test",
    }), (body) => body.success === true && body.map?.id === "smoke-map", "create map"));
    checks.push(assert(await request("POST", "/api/floors", {
      id: "smoke-floor",
      mapId: "smoke-map",
      floorName: "Smoke Floor",
      floorLevel: 1,
      width: 100,
      height: 100,
      scale: 1,
    }), (body) => body.success === true && body.floor?.mapId === "smoke-map", "create floor"));
    checks.push(assert(await request("POST", "/api/places", {
      id: "smoke-place",
      mapId: "smoke-map",
      floorId: "smoke-floor",
      name: "Smoke Place",
      category: "測試",
      x: 10,
      y: 20,
      description: "created by smoke test",
      searchable: true,
    }), (body) => body.success === true && body.place?.id === "smoke-place", "create place"));
    checks.push(assert(await request("GET", "/api/maps"), (body) => body.some((item) => item.id === "tkut-demo"), "maps"));
    checks.push(assert(await request("GET", "/api/places?mapId=smoke-map&floorId=smoke-floor&keyword=Smoke"), (body) => body.length === 1, "created place search"));
    checks.push(assert(await request("GET", "/api/floors?mapId=tkut-demo"), (body) => body.length >= 2, "floors"));
    checks.push(assert(
      await request("GET", "/api/data/export?mapId=tkut-demo&floorId=tkut-demo-ground"),
      (body) => body.project === "地下街室內導航系統" && Array.isArray(body.maps) && Array.isArray(body.wifiScanRecords),
      "scoped data export"
    ));
    checks.push(assert(
      await request("GET", "/api/places?mapId=tkut-demo&floorId=tkut-demo-ground&keyword=" + encodeURIComponent("廁所")),
      (body) => body.some((item) => item.id === "place-restroom-a"),
      "places search"
    ));

    checks.push(assert(await request("POST", "/api/wifi-scans", {
      records: [
        wifiRecord("P001", 180, 620, "aa:aa:aa:aa:aa:01", -45),
        wifiRecord("P001", 180, 620, "aa:aa:aa:aa:aa:02", -63),
        wifiRecord("P002", 520, 330, "aa:aa:aa:aa:aa:01", -76),
        wifiRecord("P002", 520, 330, "aa:aa:aa:aa:aa:02", -48),
      ],
    }), (body) => body.savedCount === 4, "wifi scans"));
    checks.push(assert(
      await request("GET", "/api/wifi-scans/summary?mapId=tkut-demo&floorId=tkut-demo-ground"),
      (body) => body.totalRecords === 4 && body.pointCount === 2,
      "wifi summary"
    ));
    checks.push(assert(
      await request("GET", "/api/wifi-scans/quality?mapId=tkut-demo&floorId=tkut-demo-ground"),
      (body) => Array.isArray(body.items) && body.items.some((item) => item.name === "常見 AP 缺漏") && body.items.every((item) => typeof item.action === "string"),
      "wifi quality actions"
    ));
    checks.push(assert(await request("POST", "/api/models/train", {
      mapId: "tkut-demo",
      floorId: "tkut-demo-ground",
      algorithm: "knn",
      activate: true,
    }), (body) => body.success === true && body.model?.algorithm === "knn", "model train"));
    const rfComparison = await request("POST", "/api/models/train", {
      mapId: "tkut-demo",
      floorId: "tkut-demo-ground",
      algorithm: "randomForest",
      activate: false,
    });
    checks.push(assert(rfComparison, (body) => body.success === true && body.model?.algorithm === "randomForest" && body.model?.isComparisonOnly === true && body.model?.isActive === false, "random forest comparison"));
    const rfModel = JSON.parse(rfComparison.body).model;
    checks.push(assert(await request("POST", "/api/models/activate", {
      modelVersionId: rfModel.id,
    }), (body, status) => status === 400 && body.success === false, "comparison model cannot activate"));
    checks.push(assert(
      await request("GET", "/api/models/active?mapId=tkut-demo&floorId=tkut-demo-ground"),
      (body) => body.isActive === true && body.algorithm === "knn",
      "active model"
    ));
    checks.push(assert(await request("POST", "/api/location/estimate", {
      mapId: "tkut-demo",
      floorId: "tkut-demo-ground",
      currentWifiList: [
        { bssid: "aa:aa:aa:aa:aa:01", ssid: "Demo AP 1", rssi: -46 },
        { bssid: "aa:aa:aa:aa:aa:02", ssid: "Demo AP 2", rssi: -62 },
      ],
      heading: 0,
      deviceInfo: "smoke-test",
    }), (body) => body.floorId === "tkut-demo-ground" && Number.isFinite(body.x), "location estimate"));

    checks.push(assert(await request("POST", "/api/routes", {
      mapId: "tkut-demo",
      startFloorId: "tkut-demo-ground",
      startX: 180,
      startY: 620,
      destinationPlaceId: "place-library",
    }), (body) => body.routePoints?.length >= 2 && body.distance > 0, "same-floor route"));
    checks.push(assert(await request("POST", "/api/route-edges/block", {
      edgeId: "edge-restroom-library",
      isBlocked: true,
    }), (body) => body.success === true && body.edge?.isBlocked === true, "block route edge"));
    checks.push(assert(
      await request("GET", "/api/route-edges?mapId=tkut-demo&floorId=tkut-demo-ground"),
      (body) => body.some((edge) => edge.id === "edge-restroom-library" && edge.isBlocked === true),
      "route edge list"
    ));
    checks.push(assert(await request("POST", "/api/routes", {
      mapId: "tkut-demo",
      startFloorId: "tkut-demo-ground",
      startX: 180,
      startY: 620,
      destinationPlaceId: "place-library",
    }), (body) => {
      const ids = (body.routePoints || []).map((point) => point.id);
      return ids.length >= 2 && !ids.join(">").includes("node-restroom-a>node-library");
    }, "blocked edge reroute"));
    checks.push(assert(await request("POST", "/api/route-edges/block", {
      edgeId: "edge-restroom-library",
      isBlocked: false,
    }), (body) => body.success === true && body.edge?.isBlocked === false, "unblock route edge"));
    checks.push(assert(await request("POST", "/api/routes", {
      mapId: "tkut-demo",
      startFloorId: "tkut-demo-ground",
      targetFloorId: "tkut-demo-second",
      startX: 180,
      startY: 620,
      destinationPlaceId: "place-second-office",
    }), (body) => body.floorTransitions?.length === 1, "cross-floor route"));
    checks.push(assert(await request("POST", "/api/navigation-policy/decide", {
      mapId: "tkut-demo",
      floorId: "tkut-demo-ground",
      currentX: 180,
      currentY: 620,
      targetX: 520,
      targetY: 330,
      wifiConfidence: 80,
      estimatedError: 5,
      isOffRoute: false,
      obstacleNearby: false,
    }), (body) => body.recommendedAction === "continueNavigation", "policy decide"));
    checks.push(assert(await request("POST", "/api/navigation-policy/train", {
      mapId: "tkut-demo",
      floorId: "tkut-demo-ground",
      trainingEpisodes: 80,
    }), (body) => body.success === true && body.simulation?.scenarioCount === 80 && body.run?.simulationSummary, "policy simulation training"));
    checks.push(assert(await request("POST", "/api/places/status", {
      placeId: "place-library",
      businessStatus: "open",
    }), (body) => body.success === true, "place status"));
    checks.push(assert(await request("POST", "/api/user-reports", {
      anonymousUserId: "smoke-anon",
      mapId: "tkut-demo",
      floorId: "tkut-demo-ground",
      x: 180,
      y: 620,
      reportType: "obstacle",
      description: "smoke-test",
    }), (body) => body.success === true, "user report"));

    checks.push(assert(await request("POST", "/api/navigation-feedback", {
      anonymousUserId: "smoke-anon",
      mapId: "tkut-demo",
      floorId: "tkut-demo-ground",
      estimatedX: 181,
      estimatedY: 619,
      currentRouteId: "smoke-route",
      nearestRouteNodeId: "node-parking-a",
      currentWifiList: [
        { bssid: "aa:aa:aa:aa:aa:01", ssid: "Demo AP 1", rssi: -45 },
        { bssid: "aa:aa:aa:aa:aa:02", ssid: "Demo AP 2", rssi: -63 },
        { bssid: "aa:aa:aa:aa:aa:03", ssid: "Demo AP 3", rssi: -71 },
        { bssid: "aa:aa:aa:aa:aa:04", ssid: "Demo AP 4", rssi: -68 },
      ],
      heading: 0,
      stepDelta: 2,
      confidence: 85,
      estimatedError: 5,
      isOffRoute: false,
      relocalizeCount: 0,
      arrivedDestination: true,
      deviceInfo: "smoke-test",
      collectedAt: Date.now(),
    }), (body) => body.accepted === true, "navigation feedback"));
    checks.push(assert(
      await request("POST", "/api/navigation-feedback/evaluate", {}),
      (body) => body.highConfidenceCount >= 1,
      "feedback evaluate"
    ));
    checks.push(assert(await request("POST", "/api/models/retrain-from-feedback", {
      mapId: "tkut-demo",
      floorId: "tkut-demo-ground",
      activate: true,
    }), (body) => body.success === true && body.job?.status === "completed", "feedback retrain"));

    checks.push(assert(await request("POST", "/api/navigation-history", {
      userId: "smoke-user",
      mapId: "tkut-demo",
      startX: 180,
      startY: 620,
      startFloorId: "tkut-demo-ground",
      destinationPlaceId: "place-library",
    }), (body) => body.success === true, "navigation history"));
    checks.push(assert(await request("POST", "/api/saved-locations", {
      userId: "smoke-user",
      name: "smoke saved",
      mapId: "tkut-demo",
      floorId: "tkut-demo-ground",
      x: 180,
      y: 620,
      type: "origin",
    }), (body) => body.success === true, "saved location"));
    checks.push(assert(
      await request("GET", "/api/saved-locations?userId=smoke-user"),
      (body) => body.length === 1,
      "saved location list"
    ));
    checks.push(assert(await request("DELETE", "/api/navigation-history?userId=smoke-user"), (body) => body.success === true, "delete history"));
    checks.push(assert(await request("DELETE", "/api/saved-locations?userId=smoke-user"), (body) => body.success === true, "delete saved"));
  } finally {
    if (managedServer) managedServer.kill();
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    console.error(JSON.stringify(failed, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(`Smoke test passed: ${checks.length} checks with response assertions`);
  fs.rmSync(smokeDataDir, { recursive: true, force: true });
}

function assert(result, predicate, name) {
  const statusOk = result.statusCode >= 200 && result.statusCode < 300;
  let body = null;
  try {
    body = result.body ? JSON.parse(result.body) : null;
  } catch (error) {
    return { ok: false, name, statusCode: result.statusCode, error: `invalid JSON: ${error.message}`, body: result.body };
  }
  let predicateOk = false;
  try {
    predicateOk = predicate(body, result.statusCode);
  } catch (error) {
    return { ok: false, name, statusCode: result.statusCode, error: error.message, body };
  }
  const acceptsStatus = predicate.length >= 2;
  return {
    ok: (acceptsStatus || statusOk) && predicateOk,
    name,
    statusCode: result.statusCode,
    body: statusOk && predicateOk ? undefined : body,
  };
}

function wifiRecord(pointId, x, y, bssid, rssi) {
  return {
    pointId,
    mapId: "tkut-demo",
    floorId: "tkut-demo-ground",
    x,
    y,
    heading: 0,
    ssid: "Demo AP",
    bssid,
    rssi,
    deviceInfo: "smoke-test",
    scannedAt: new Date().toISOString(),
  };
}

function startManagedServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["server.js"], {
      cwd: process.cwd(),
      env: { ...process.env, NAV_DATA_DIR: smokeDataDir, PORT: String(smokePort) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("server start timeout"));
    }, 5000);
    child.stdout.on("data", () => {
      clearTimeout(timer);
      resolve(child);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.includes("EADDRINUSE")) {
        clearTimeout(timer);
        resolve(null);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function request(method, path, payload) {
  const url = new URL(path, baseUrl);
  const body = payload ? JSON.stringify(payload) : "";
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve({
        method,
        path,
        statusCode: res.statusCode,
        body: data,
      }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
