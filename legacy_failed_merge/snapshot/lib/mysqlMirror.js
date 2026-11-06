const fs = require("fs");
const path = require("path");

let pool = null;
let enabled = false;

function isEnabled() {
  return enabled;
}

async function startMirror() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (!url) return false;
  const mysql = require("mysql2/promise");
  pool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_LIMIT || 5),
    charset: "utf8mb4",
  });
  await ensureSchema();
  await seedMysqlFromJsonIfEmpty();
  await hydrateJsonFromMysql();
  enabled = true;
  return true;
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS maps (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      description TEXT,
      createdAt DATETIME NULL,
      updatedAt DATETIME NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS floors (
      id VARCHAR(64) PRIMARY KEY,
      mapId VARCHAR(64) NOT NULL,
      floorName VARCHAR(120) NOT NULL,
      floorLevel INT NOT NULL DEFAULT 0,
      imageUrl VARCHAR(500),
      width DECIMAL(12,4) NOT NULL DEFAULT 0,
      height DECIMAL(12,4) NOT NULL DEFAULT 0,
      scaleValue DECIMAL(12,6) NOT NULL DEFAULT 1,
      createdAt DATETIME NULL,
      updatedAt DATETIME NULL,
      INDEX idx_floors_map (mapId)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wifi_scan_records (
      id BIGINT PRIMARY KEY,
      pointId VARCHAR(64) NOT NULL,
      mapId VARCHAR(64) NOT NULL,
      floorId VARCHAR(64) NOT NULL,
      x DECIMAL(12,4) NOT NULL,
      y DECIMAL(12,4) NOT NULL,
      heading DECIMAL(8,3) NULL,
      ssid VARCHAR(180),
      bssid VARCHAR(40) NOT NULL,
      rssi INT NOT NULL,
      deviceInfo VARCHAR(255),
      scannedAt DATETIME NULL,
      uploadedAt DATETIME NULL,
      createdAt DATETIME NULL,
      source VARCHAR(60),
      sampleId VARCHAR(80),
      sessionId VARCHAR(80),
      scanFreshness VARCHAR(80),
      INDEX idx_wifi_scope (mapId, floorId),
      INDEX idx_wifi_point (mapId, floorId, pointId),
      INDEX idx_wifi_bssid (mapId, floorId, bssid)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS places (
      id VARCHAR(80) PRIMARY KEY,
      mapId VARCHAR(64) NOT NULL,
      floorId VARCHAR(64) NOT NULL,
      name VARCHAR(160) NOT NULL,
      category VARCHAR(80) NOT NULL,
      x DECIMAL(12,4) NOT NULL,
      y DECIMAL(12,4) NOT NULL,
      description TEXT,
      keywords TEXT,
      searchable BOOLEAN NOT NULL DEFAULT TRUE,
      businessStatus VARCHAR(40) NOT NULL DEFAULT 'unset',
      createdAt DATETIME NULL,
      updatedAt DATETIME NULL,
      INDEX idx_places_scope (mapId, floorId),
      INDEX idx_places_searchable (mapId, floorId, searchable)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS route_nodes (
      id VARCHAR(120) PRIMARY KEY,
      mapId VARCHAR(64) NOT NULL,
      floorId VARCHAR(64) NOT NULL,
      x DECIMAL(12,4) NOT NULL,
      y DECIMAL(12,4) NOT NULL,
      nodeType VARCHAR(60) NOT NULL DEFAULT 'walkway',
      label VARCHAR(160),
      isWalkable BOOLEAN NOT NULL DEFAULT TRUE,
      source VARCHAR(60),
      createdAt DATETIME NULL,
      updatedAt DATETIME NULL,
      INDEX idx_route_nodes_scope (mapId, floorId),
      INDEX idx_route_nodes_type (mapId, floorId, nodeType)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS route_edges (
      id VARCHAR(180) PRIMARY KEY,
      mapId VARCHAR(64) NOT NULL,
      floorId VARCHAR(64) NOT NULL,
      fromNodeId VARCHAR(120) NOT NULL,
      toNodeId VARCHAR(120) NOT NULL,
      distance DECIMAL(12,4) NOT NULL DEFAULT 0,
      isBlocked BOOLEAN NOT NULL DEFAULT FALSE,
      source VARCHAR(60),
      name VARCHAR(160),
      createdAt DATETIME NULL,
      updatedAt DATETIME NULL,
      INDEX idx_route_edges_scope (mapId, floorId),
      INDEX idx_route_edges_from (fromNodeId),
      INDEX idx_route_edges_to (toNodeId),
      INDEX idx_route_edges_blocked (mapId, floorId, isBlocked)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS floor_transitions (
      id VARCHAR(180) PRIMARY KEY,
      mapId VARCHAR(64) NOT NULL,
      fromFloorId VARCHAR(64) NOT NULL,
      toFloorId VARCHAR(64) NOT NULL,
      fromNodeId VARCHAR(120) NOT NULL,
      toNodeId VARCHAR(120) NOT NULL,
      transitionType VARCHAR(60) NOT NULL DEFAULT 'escalator',
      name VARCHAR(160),
      source VARCHAR(60),
      pairedTransitionId VARCHAR(180),
      createdAt DATETIME NULL,
      updatedAt DATETIME NULL,
      INDEX idx_floor_transitions_map (mapId),
      INDEX idx_floor_transitions_from (mapId, fromFloorId),
      INDEX idx_floor_transitions_to (mapId, toFloorId)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS model_versions (
      id VARCHAR(80) PRIMARY KEY,
      versionName VARCHAR(160) NOT NULL,
      mapId VARCHAR(64) NOT NULL,
      floorId VARCHAR(64) NOT NULL,
      algorithm VARCHAR(40) NOT NULL,
      trainingDataCount INT NOT NULL DEFAULT 0,
      averageError DECIMAL(12,4) NULL,
      modelPath VARCHAR(500),
      trainedAt DATETIME NULL,
      isActive BOOLEAN NOT NULL DEFAULT FALSE,
      isComparisonOnly BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      createdAt DATETIME NULL,
      updatedAt DATETIME NULL,
      INDEX idx_models_scope (mapId, floorId),
      INDEX idx_models_active (mapId, floorId, isActive)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dqn_training_runs (
      id VARCHAR(80) PRIMARY KEY,
      mapId VARCHAR(64) NOT NULL,
      floorId VARCHAR(64) NOT NULL,
      trainingEpisodes INT NOT NULL DEFAULT 0,
      averageReward DECIMAL(12,4) NULL,
      successRate DECIMAL(12,6) NULL,
      scenarioCount INT NULL,
      baselineRouteCount INT NULL,
      actionDistribution JSON NULL,
      simulationSummary TEXT,
      modelPath VARCHAR(500),
      trainedAt DATETIME NULL,
      isActive BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt DATETIME NULL,
      updatedAt DATETIME NULL,
      INDEX idx_dqn_scope (mapId, floorId),
      INDEX idx_dqn_active (mapId, floorId, isActive)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS navigation_policy_logs (
      id BIGINT PRIMARY KEY,
      mapId VARCHAR(64) NOT NULL,
      floorId VARCHAR(64) NOT NULL,
      currentX DECIMAL(12,4) NOT NULL DEFAULT 0,
      currentY DECIMAL(12,4) NOT NULL DEFAULT 0,
      targetX DECIMAL(12,4) NOT NULL DEFAULT 0,
      targetY DECIMAL(12,4) NOT NULL DEFAULT 0,
      isOffRoute BOOLEAN NOT NULL DEFAULT FALSE,
      obstacleNearby BOOLEAN NOT NULL DEFAULT FALSE,
      wifiConfidence INT NOT NULL DEFAULT 0,
      estimatedError DECIMAL(12,4) NULL,
      recommendedAction VARCHAR(80) NOT NULL,
      accepted BOOLEAN NULL,
      createdAt DATETIME NULL,
      INDEX idx_policy_logs_scope (mapId, floorId),
      INDEX idx_policy_logs_action (recommendedAction)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

async function seedMysqlFromJsonIfEmpty() {
  const [[scanCount]] = await pool.query("SELECT COUNT(*) AS count FROM wifi_scan_records");
  if (Number(scanCount.count || 0) > 0) return;
  const maps = readJson("catalog_records.json", { maps: [], floors: [] });
  const scans = readJson("wifi_scans.json", []);
  const models = readJson("model_versions.json", []);
  await upsertMaps(maps.maps || []);
  await upsertFloors(maps.floors || []);
  await upsertPlaces(maps.places || []);
  await mirrorRouteGraphFromJson();
  await upsertWifiScans(scans);
  await upsertModels(models);
  await upsertDqnRuns(readJson("dqn_training_runs.json", []));
  await upsertPolicyLogs(readJson("navigation_policy_logs.json", []));
}

async function hydrateJsonFromMysql() {
  const [maps] = await pool.query("SELECT * FROM maps ORDER BY id");
  const [floors] = await pool.query("SELECT * FROM floors ORDER BY mapId, floorLevel, id");
  const [scans] = await pool.query("SELECT * FROM wifi_scan_records ORDER BY id");
  const [models] = await pool.query("SELECT * FROM model_versions ORDER BY trainedAt, id");
  writeJson("catalog_records.json", {
    maps: maps.map(normalizeMap),
    floors: floors.map(normalizeFloor),
    places: readJson("catalog_records.json", { places: [] }).places || [],
  });
  writeJson("wifi_scans.json", scans.map(normalizeScan));
  writeJson("model_versions.json", models.map(normalizeModel));
}

async function mirrorWifiScans(records) {
  if (!enabled || !records.length) return;
  await upsertMaps(mapsFromScans(records));
  await upsertFloors(floorsFromScans(records));
  await upsertWifiScans(records);
}

async function mirrorModels(models) {
  if (!enabled || !models.length) return;
  await upsertModels(models);
}

async function mirrorAdminData(snapshot = {}) {
  if (!enabled) return false;
  if (snapshot.maps) await upsertMaps(snapshot.maps);
  if (snapshot.floors) await upsertFloors(snapshot.floors);
  if (snapshot.places) await upsertPlaces(snapshot.places);
  if (snapshot.routeNodes) await upsertRouteNodes(snapshot.routeNodes);
  if (snapshot.routeEdges) await upsertRouteEdges(snapshot.routeEdges);
  if (snapshot.floorTransitions) await upsertFloorTransitions(snapshot.floorTransitions);
  if (snapshot.dqnRuns) await upsertDqnRuns(snapshot.dqnRuns);
  if (snapshot.policyLogs) await upsertPolicyLogs(snapshot.policyLogs);
  return true;
}

async function mirrorRouteGraphFromJson() {
  const graph = readJson("route_graph_records.json", { nodes: [], edges: [], transitions: [] });
  await upsertRouteNodes(graph.nodes || []);
  await upsertRouteEdges(graph.edges || []);
  await upsertFloorTransitions(graph.transitions || []);
}

async function statusSummary() {
  if (!enabled) return { enabled: false, storage: "json" };
  const tables = [
    "maps",
    "floors",
    "places",
    "route_nodes",
    "route_edges",
    "floor_transitions",
    "wifi_scan_records",
    "model_versions",
    "dqn_training_runs",
    "navigation_policy_logs",
  ];
  const counts = {};
  for (const table of tables) {
    const [[row]] = await pool.query(`SELECT COUNT(*) AS count FROM ${table}`);
    counts[table] = Number(row.count || 0);
  }
  const [scopes] = await pool.query(`
    SELECT mapId, floorId, COUNT(*) AS records, COUNT(DISTINCT pointId) AS points, COUNT(DISTINCT bssid) AS aps
    FROM wifi_scan_records
    GROUP BY mapId, floorId
    ORDER BY mapId, floorId
  `);
  return {
    enabled: true,
    storage: "mysql",
    counts,
    fingerprintScopes: scopes.map((row) => ({
      mapId: row.mapId,
      floorId: row.floorId,
      records: Number(row.records || 0),
      points: Number(row.points || 0),
      aps: Number(row.aps || 0),
    })),
  };
}

async function upsertMaps(maps) {
  for (const map of maps) {
    await pool.query(
      `INSERT INTO maps (id, name, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), updatedAt=VALUES(updatedAt)`,
      [
        map.id,
        map.name || map.id,
        map.description || "",
        toMysqlDate(map.createdAt),
        toMysqlDate(map.updatedAt),
      ]
    );
  }
}

async function upsertFloors(floors) {
  for (const floor of floors) {
    await pool.query(
      `INSERT INTO floors (id, mapId, floorName, floorLevel, imageUrl, width, height, scaleValue, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE floorName=VALUES(floorName), floorLevel=VALUES(floorLevel), imageUrl=VALUES(imageUrl),
       width=VALUES(width), height=VALUES(height), scaleValue=VALUES(scaleValue), updatedAt=VALUES(updatedAt)`,
      [
        floor.id,
        floor.mapId,
        floor.floorName || floor.name || floor.id,
        Number(floor.floorLevel || 0),
        floor.imageUrl || null,
        Number(floor.width || 0),
        Number(floor.height || 0),
        Number(floor.scaleValue || floor.scale || 1),
        toMysqlDate(floor.createdAt),
        toMysqlDate(floor.updatedAt),
      ]
    );
  }
}

async function upsertPlaces(places) {
  for (const place of places) {
    await pool.query(
      `INSERT INTO places
       (id, mapId, floorId, name, category, x, y, description, keywords, searchable, businessStatus, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE mapId=VALUES(mapId), floorId=VALUES(floorId), name=VALUES(name),
       category=VALUES(category), x=VALUES(x), y=VALUES(y), description=VALUES(description), keywords=VALUES(keywords),
       searchable=VALUES(searchable), businessStatus=VALUES(businessStatus), updatedAt=VALUES(updatedAt)`,
      [
        place.id,
        place.mapId,
        place.floorId,
        place.name || place.id,
        place.category || "",
        Number(place.x || 0),
        Number(place.y || 0),
        place.description || "",
        place.keywords || "",
        place.searchable !== false,
        place.businessStatus || "unset",
        toMysqlDate(place.createdAt),
        toMysqlDate(place.updatedAt),
      ]
    );
  }
}

async function upsertRouteNodes(nodes) {
  for (const node of nodes) {
    await pool.query(
      `INSERT INTO route_nodes
       (id, mapId, floorId, x, y, nodeType, label, isWalkable, source, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE mapId=VALUES(mapId), floorId=VALUES(floorId), x=VALUES(x), y=VALUES(y),
       nodeType=VALUES(nodeType), label=VALUES(label), isWalkable=VALUES(isWalkable), source=VALUES(source), updatedAt=VALUES(updatedAt)`,
      [
        node.id,
        node.mapId,
        node.floorId,
        Number(node.x || 0),
        Number(node.y || 0),
        node.nodeType || "walkway",
        node.label || "",
        node.isWalkable !== false,
        node.source || "",
        toMysqlDate(node.createdAt),
        toMysqlDate(node.updatedAt),
      ]
    );
  }
}

async function upsertRouteEdges(edges) {
  for (const edge of edges) {
    await pool.query(
      `INSERT INTO route_edges
       (id, mapId, floorId, fromNodeId, toNodeId, distance, isBlocked, source, name, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE mapId=VALUES(mapId), floorId=VALUES(floorId), fromNodeId=VALUES(fromNodeId),
       toNodeId=VALUES(toNodeId), distance=VALUES(distance), isBlocked=VALUES(isBlocked), source=VALUES(source),
       name=VALUES(name), updatedAt=VALUES(updatedAt)`,
      [
        edge.id,
        edge.mapId,
        edge.floorId,
        edge.fromNodeId,
        edge.toNodeId,
        Number(edge.distance || 0),
        edge.isBlocked === true,
        edge.source || "",
        edge.name || "",
        toMysqlDate(edge.createdAt),
        toMysqlDate(edge.updatedAt),
      ]
    );
  }
}

async function upsertFloorTransitions(transitions) {
  for (const transition of transitions) {
    await pool.query(
      `INSERT INTO floor_transitions
       (id, mapId, fromFloorId, toFloorId, fromNodeId, toNodeId, transitionType, name, source, pairedTransitionId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE mapId=VALUES(mapId), fromFloorId=VALUES(fromFloorId), toFloorId=VALUES(toFloorId),
       fromNodeId=VALUES(fromNodeId), toNodeId=VALUES(toNodeId), transitionType=VALUES(transitionType),
       name=VALUES(name), source=VALUES(source), pairedTransitionId=VALUES(pairedTransitionId), updatedAt=VALUES(updatedAt)`,
      [
        transition.id,
        transition.mapId,
        transition.fromFloorId,
        transition.toFloorId,
        transition.fromNodeId,
        transition.toNodeId,
        transition.transitionType || "escalator",
        transition.name || "",
        transition.source || "",
        transition.pairedTransitionId || "",
        toMysqlDate(transition.createdAt),
        toMysqlDate(transition.updatedAt),
      ]
    );
  }
}

async function upsertWifiScans(records) {
  const chunkSize = 500;
  for (let index = 0; index < records.length; index += chunkSize) {
    const chunk = records.slice(index, index + chunkSize);
    const values = chunk.map((record) => [
      Number(record.id),
      record.pointId,
      record.mapId,
      record.floorId,
      Number(record.x),
      Number(record.y),
      record.heading == null ? null : Number(record.heading),
      record.ssid || "",
      String(record.bssid || "").toLowerCase(),
      Number(record.rssi),
      record.deviceInfo || "",
      toMysqlDate(record.scannedAt),
      toMysqlDate(record.uploadedAt),
      toMysqlDate(record.createdAt),
      record.source || "",
      record.sampleId || "",
      record.sessionId || "",
      record.scanFreshness || "",
    ]);
    await pool.query(
      `INSERT INTO wifi_scan_records
       (id, pointId, mapId, floorId, x, y, heading, ssid, bssid, rssi, deviceInfo, scannedAt, uploadedAt, createdAt, source, sampleId, sessionId, scanFreshness)
       VALUES ?
       ON DUPLICATE KEY UPDATE rssi=VALUES(rssi), uploadedAt=VALUES(uploadedAt), createdAt=VALUES(createdAt)`,
      [values]
    );
  }
}

async function upsertModels(models) {
  for (const model of models) {
    await pool.query(
      `INSERT INTO model_versions
       (id, versionName, mapId, floorId, algorithm, trainingDataCount, averageError, modelPath, trainedAt, isActive, isComparisonOnly, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE versionName=VALUES(versionName), trainingDataCount=VALUES(trainingDataCount),
       averageError=VALUES(averageError), isActive=VALUES(isActive), isComparisonOnly=VALUES(isComparisonOnly), notes=VALUES(notes), updatedAt=VALUES(updatedAt)`,
      [
        model.id,
        model.versionName,
        model.mapId,
        model.floorId,
        model.algorithm,
        Number(model.trainingDataCount || 0),
        model.averageError == null ? null : Number(model.averageError),
        model.modelPath || "",
        toMysqlDate(model.trainedAt),
        model.isActive === true,
        model.isComparisonOnly === true,
        model.notes || "",
        toMysqlDate(model.createdAt),
        toMysqlDate(model.updatedAt),
      ]
    );
  }
}

async function upsertDqnRuns(runs) {
  for (const run of runs) {
    await pool.query(
      `INSERT INTO dqn_training_runs
       (id, mapId, floorId, trainingEpisodes, averageReward, successRate, scenarioCount, baselineRouteCount,
        actionDistribution, simulationSummary, modelPath, trainedAt, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE trainingEpisodes=VALUES(trainingEpisodes), averageReward=VALUES(averageReward),
       successRate=VALUES(successRate), scenarioCount=VALUES(scenarioCount), baselineRouteCount=VALUES(baselineRouteCount),
       actionDistribution=VALUES(actionDistribution), simulationSummary=VALUES(simulationSummary), modelPath=VALUES(modelPath),
       trainedAt=VALUES(trainedAt), isActive=VALUES(isActive), updatedAt=VALUES(updatedAt)`,
      [
        run.id,
        run.mapId,
        run.floorId,
        Number(run.trainingEpisodes || 0),
        run.averageReward == null ? null : Number(run.averageReward),
        run.successRate == null ? null : Number(run.successRate),
        run.scenarioCount == null ? null : Number(run.scenarioCount),
        run.baselineRouteCount == null ? null : Number(run.baselineRouteCount),
        JSON.stringify(run.actionDistribution || {}),
        run.simulationSummary || "",
        run.modelPath || "",
        toMysqlDate(run.trainedAt),
        run.isActive === true,
        toMysqlDate(run.createdAt),
        toMysqlDate(run.updatedAt),
      ]
    );
  }
}

async function upsertPolicyLogs(logs) {
  for (const log of logs) {
    await pool.query(
      `INSERT INTO navigation_policy_logs
       (id, mapId, floorId, currentX, currentY, targetX, targetY, isOffRoute, obstacleNearby,
        wifiConfidence, estimatedError, recommendedAction, accepted, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE wifiConfidence=VALUES(wifiConfidence), estimatedError=VALUES(estimatedError),
       recommendedAction=VALUES(recommendedAction), accepted=VALUES(accepted)`,
      [
        Number(log.id),
        log.mapId,
        log.floorId,
        Number(log.currentX || 0),
        Number(log.currentY || 0),
        Number(log.targetX || 0),
        Number(log.targetY || 0),
        log.isOffRoute === true,
        log.obstacleNearby === true,
        Number(log.wifiConfidence || 0),
        log.estimatedError == null ? null : Number(log.estimatedError),
        log.recommendedAction || "continueNavigation",
        log.accepted == null ? null : log.accepted === true,
        toMysqlDate(log.createdAt),
      ]
    );
  }
}

function mapsFromScans(records) {
  return Array.from(new Set(records.map((record) => record.mapId))).map((mapId) => ({
    id: mapId,
    name: `上傳資料地圖 ${mapId}`,
    description: "由 Android 管理者採樣工具上傳後自動顯示。",
  }));
}

function floorsFromScans(records) {
  const grouped = new Map();
  for (const record of records) {
    const key = `${record.mapId}/${record.floorId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  }
  return Array.from(grouped.values()).map((rows) => {
    const first = rows[0];
    const xs = rows.map((row) => Number(row.x)).filter(Number.isFinite);
    const ys = rows.map((row) => Number(row.y)).filter(Number.isFinite);
    return {
      id: first.floorId,
      mapId: first.mapId,
      floorName: `上傳樓層 ${first.floorId}`,
      floorLevel: parseFloorLevel(first.floorId),
      imageUrl: null,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      scaleValue: 1,
    };
  });
}

function parseFloorLevel(floorId) {
  const match = String(floorId || "").match(/(-?\d+)/);
  return match ? Number(match[1]) : 0;
}

function normalizeMap(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function normalizeFloor(row) {
  return {
    id: row.id,
    mapId: row.mapId,
    floorName: row.floorName,
    floorLevel: Number(row.floorLevel || 0),
    imageUrl: row.imageUrl || null,
    width: Number(row.width || 0),
    height: Number(row.height || 0),
    scaleValue: Number(row.scaleValue || 1),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function normalizeScan(row) {
  return {
    id: Number(row.id),
    pointId: row.pointId,
    mapId: row.mapId,
    floorId: row.floorId,
    x: Number(row.x),
    y: Number(row.y),
    heading: row.heading == null ? null : Number(row.heading),
    ssid: row.ssid || "",
    bssid: String(row.bssid || "").toLowerCase(),
    rssi: Number(row.rssi),
    deviceInfo: row.deviceInfo || "",
    scannedAt: toIso(row.scannedAt),
    uploadedAt: toIso(row.uploadedAt),
    createdAt: toIso(row.createdAt),
    source: row.source || "",
    sampleId: row.sampleId || "",
    sessionId: row.sessionId || "",
    scanFreshness: row.scanFreshness || "",
  };
}

function normalizeModel(row) {
  return {
    id: row.id,
    versionName: row.versionName,
    mapId: row.mapId,
    floorId: row.floorId,
    algorithm: row.algorithm,
    trainingDataCount: Number(row.trainingDataCount || 0),
    averageError: row.averageError == null ? null : Number(row.averageError),
    modelPath: row.modelPath || "",
    trainedAt: toIso(row.trainedAt),
    isActive: row.isActive === true || row.isActive === 1,
    isComparisonOnly: row.isComparisonOnly === true || row.isComparisonOnly === 1,
    notes: row.notes || "",
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function readJson(fileName, fallback) {
  const filePath = path.join(__dirname, "..", "data", fileName);
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf8").trim();
  return raw ? JSON.parse(raw) : fallback;
}

function writeJson(fileName, value) {
  const filePath = path.join(__dirname, "..", "data", fileName);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function toMysqlDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

module.exports = {
  isEnabled,
  mirrorAdminData,
  mirrorModels,
  mirrorWifiScans,
  statusSummary,
  startMirror,
};
