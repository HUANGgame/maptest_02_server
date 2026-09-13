const fs = require("fs");
const path = require("path");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");

const DATA_FILES = [
  "catalog_records.json",
  "route_graph_records.json",
  "route_edge_overrides.json",
  "wifi_scans.json",
  "model_versions.json",
  "model_training_jobs.json",
  "navigation_feedback.json",
  "navigation_history.json",
  "saved_locations.json",
  "navigation_policy_logs.json",
  "dqn_training_runs.json",
  "user_reports.json",
  "place_overrides.json",
];
const WIFI_SCAN_BATCH_SIZE = Number(process.env.FIREBASE_WIFI_SCAN_BATCH_SIZE || 400);

let db = null;
let enabled = false;
let jsonMirrorQueue = Promise.resolve();
let startupSync = {
  restoredFiles: [],
  seededFiles: [],
  skippedFiles: [],
  syncedAt: null,
};

function isEnabled() {
  return enabled;
}

async function startMirror() {
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_RTDB_URL;
  if (!databaseURL) return false;

  const admin = require("firebase-admin");
  const credential = loadCredential(admin);
  if (!credential) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_BASE64, or GOOGLE_APPLICATION_CREDENTIALS is required");
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential, databaseURL });
  }
  db = admin.database();
  enabled = true;
  startupSync = {
    restoredFiles: [],
    seededFiles: [],
    skippedFiles: [],
    syncedAt: null,
    status: "running",
  };
  await syncJsonCacheWithFirebase()
    .then((result) => {
      startupSync = { ...result, status: "complete" };
    })
    .catch((error) => {
      startupSync = {
        ...startupSync,
        status: "failed",
        error: error.message,
        syncedAt: new Date().toISOString(),
      };
      enabled = false;
      db = null;
      console.error("Firebase startup sync failed:", error.message);
      throw error;
    });
  return true;
}

async function mirrorWifiScans(records) {
  if (!enabled || !Array.isArray(records) || records.length === 0) return false;
  for (let index = 0; index < records.length; index += WIFI_SCAN_BATCH_SIZE) {
    const updates = {};
    for (const record of records.slice(index, index + WIFI_SCAN_BATCH_SIZE)) {
      const id = safeFirebaseKey(record.id || scanIdentityKey(record));
      updates[`wifi_scans/${id}`] = record;
    }
    await root().update(updates);
  }
  await writeMeta();
  return true;
}

async function readWifiScansByScope(mapId, floorId) {
  if (!enabled || !mapId || !floorId) return null;
  const snapshot = await root().child("wifi_scans").orderByChild("floorId").equalTo(floorId).once("value");
  const records = [];
  snapshot.forEach((child) => {
    const record = child.val();
    if (record && record.mapId === mapId && record.floorId === floorId) {
      records.push(record);
    }
  });
  return records;
}

async function readWifiScanSummaryByScope(mapId, floorId) {
  const records = await readWifiScansByScope(mapId, floorId);
  if (!records) return null;
  return {
    records,
    source: "firebase-rtdb",
  };
}

async function readWifiScanIndexSummary(mapId, floorId) {
  if (!enabled || !mapId || !floorId) return null;
  const snapshot = await root().child("wifi_scan_indexes").child(scopeKey(mapId, floorId)).once("value");
  const index = snapshot.val();
  if (!index || !index.summary) return null;
  const points = Object.values(index.points || {})
    .map((point) => ({
      pointId: point.pointId,
      scanCount: Number(point.scanCount || 0),
      bssidCount: countRecords(point.bssids || {}),
      averageRssi: point.scanCount ? Math.round((Number(point.rssiTotal || 0) / Number(point.scanCount || 1)) * 100) / 100 : null,
      latestScannedAt: point.latestScannedAt || "",
    }))
    .sort((left, right) => String(left.pointId || "").localeCompare(String(right.pointId || "")));
  return {
    mapId,
    floorId,
    totalRecords: Number(index.summary.totalRecords || 0),
    pointCount: countRecords(index.points || {}),
    bssidCount: countRecords(index.bssids || {}),
    latestScannedAt: index.summary.latestScannedAt || "",
    points,
    source: "firebase-rtdb-index",
  };
}

async function rebuildWifiScanIndex(mapId, floorId, options = {}) {
  if (!enabled || !mapId || !floorId) throw new Error("Firebase is not enabled");
  const key = scopeKey(mapId, floorId);
  const batchSize = Math.max(100, Math.min(2000, Number(options.batchSize || 700)));
  const maxMillis = Math.max(3000, Math.min(25000, Number(options.maxMillis || 18000)));
  const startedAt = Date.now();
  const indexRef = root().child("wifi_scan_indexes").child(key);
  let cursor = String(options.cursor || "");
  if (options.reset === true && !cursor) {
    await indexRef.remove();
  }
  let index = (await indexRef.once("value")).val() || {};
  index = normalizeWifiScanIndex(index, mapId, floorId);

  let processed = 0;
  let matched = 0;
  let done = false;
  while (Date.now() - startedAt < maxMillis) {
    let query = root().child("wifi_scans").orderByKey();
    query = cursor ? query.startAt(cursor).limitToFirst(batchSize + 1) : query.limitToFirst(batchSize);
    const snapshot = await query.once("value");
    let seen = 0;
    let lastKey = cursor;
    snapshot.forEach((child) => {
      const childKey = child.key || "";
      if (cursor && childKey === cursor) return;
      seen += 1;
      lastKey = childKey;
      const record = child.val();
      if (record && record.mapId === mapId && record.floorId === floorId) {
        addScanToIndex(index, record);
        matched += 1;
      }
    });
    processed += seen;
    cursor = lastKey;
    if (seen < batchSize) {
      done = true;
      break;
    }
  }

  index.summary.updatedAt = new Date().toISOString();
  index.summary.rebuildCursor = done ? "" : cursor;
  index.summary.rebuildComplete = done;
  await indexRef.set(index);
  await writeMeta({ wifiScanIndexUpdatedAt: index.summary.updatedAt });
  return {
    done,
    cursor,
    processed,
    matched,
    summary: {
      mapId,
      floorId,
      totalRecords: Number(index.summary.totalRecords || 0),
      pointCount: countRecords(index.points || {}),
      bssidCount: countRecords(index.bssids || {}),
      latestScannedAt: index.summary.latestScannedAt || "",
    },
  };
}

async function mirrorJsonFiles(fileNames = DATA_FILES) {
  const pending = jsonMirrorQueue.then(() => mirrorJsonFilesNow(fileNames));
  jsonMirrorQueue = pending.catch(() => {});
  return pending;
}

async function mirrorJsonFilesNow(fileNames) {
  if (!enabled) return false;
  const updates = {};
  for (const fileName of fileNames) {
    const value = readJsonFile(fileName);
    if (value === undefined) continue;
    const collection = collectionName(fileName);
    if (fileName === "wifi_scans.json" && Array.isArray(value)) {
      if (Object.keys(updates).length > 0) {
        await root().update(updates);
        Object.keys(updates).forEach((key) => delete updates[key]);
      }
      await mirrorWifiScans(value);
    } else {
      updates[collection] = value;
    }
  }
  await root().update(updates);
  await writeMeta();
  return true;
}

async function statusSummary() {
  if (!enabled) {
    return {
      enabled: false,
      storage: "json",
      databaseUrlConfigured: Boolean(process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_RTDB_URL),
      startupSync,
      note: "Firebase is not configured; JSON files are the active store.",
    };
  }

  const counts = {};
  for (const fileName of DATA_FILES) {
    const name = collectionName(fileName);
    if (fileName === "wifi_scans.json") {
      counts[name] = "large-collection";
      continue;
    }
    const snapshot = await root().child(name).once("value");
    counts[name] = countRecords(snapshot.val());
  }
  const metaSnapshot = await root().child("meta").once("value");
  const meta = metaSnapshot.val() || {};
  return {
    enabled: true,
    storage: "firebase-rtdb",
    sourceOfTruth: true,
    databaseUrl: process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_RTDB_URL,
    counts,
    updatedAt: meta.updatedAt || null,
    startupSync,
    note: "Firebase Realtime Database is the active store; JSON files are only the local runtime cache.",
  };
}

async function syncJsonCacheWithFirebase() {
  ensureDataDir();
  const result = {
    restoredFiles: [],
    seededFiles: [],
    skippedFiles: [],
    syncedAt: new Date().toISOString(),
    status: "running",
  };

  for (const fileName of DATA_FILES) {
    const collection = collectionName(fileName);
    if (fileName === "wifi_scans.json") {
      result.skippedFiles.push(fileName);
      continue;
    }
    const snapshot = await root().child(collection).once("value");
    const remoteValue = snapshot.val();
    if (hasMeaningfulValue(remoteValue)) {
      writeJsonFile(fileName, normalizeRemoteValue(fileName, remoteValue));
      result.restoredFiles.push(fileName);
      continue;
    }

    const localValue = readJsonFile(fileName);
    if (hasMeaningfulValue(localValue)) {
      if (fileName === "wifi_scans.json" && Array.isArray(localValue)) {
        await root().child(collection).remove();
        await mirrorWifiScans(localValue);
      } else {
        await root().child(collection).set(normalizeLocalValueForFirebase(fileName, localValue));
      }
      result.seededFiles.push(fileName);
      continue;
    }

    result.skippedFiles.push(fileName);
  }

  await writeMeta({
    startupSyncAt: result.syncedAt,
    startupRestoredFiles: result.restoredFiles,
    startupSeededFiles: result.seededFiles,
  });
  return { ...result, status: "complete" };
}

function loadCredential(admin) {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return admin.credential.cert(parsed);
  }

  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (rawBase64) {
    const parsed = JSON.parse(Buffer.from(rawBase64, "base64").toString("utf8"));
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return admin.credential.cert(parsed);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }

  return null;
}

function root() {
  if (!db) throw new Error("Firebase mirror is not initialized");
  return db.ref(process.env.FIREBASE_ROOT_PATH || "indoor_navigation");
}

async function writeMeta(extra = {}) {
  await root().child("meta").update({
    updatedAt: new Date().toISOString(),
    source: "maptest-02-server",
    ...extra,
  });
}

function readJsonFile(fileName) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) return undefined;
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw);
}

function writeJsonFile(fileName, value) {
  ensureDataDir();
  fs.writeFileSync(path.join(dataDir, fileName), JSON.stringify(value, null, 2), "utf8");
}

function normalizeRemoteValue(fileName, value) {
  if (fileName === "wifi_scans.json" && value && !Array.isArray(value)) {
    return Object.values(value).sort((left, right) => (Number(left.id) || 0) - (Number(right.id) || 0));
  }
  return value;
}

function normalizeLocalValueForFirebase(fileName, value) {
  if (fileName === "wifi_scans.json" && Array.isArray(value)) {
    const records = {};
    value.forEach((record) => {
      const id = safeFirebaseKey(record.id || scanIdentityKey(record));
      records[id] = record;
    });
    return records;
  }
  return value;
}

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function collectionName(fileName) {
  return fileName.replace(/\.json$/i, "");
}

function countRecords(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    if (Array.isArray(value.maps) || Array.isArray(value.floors) || Array.isArray(value.places)) {
      return {
        maps: value.maps?.length || 0,
        floors: value.floors?.length || 0,
        places: value.places?.length || 0,
      };
    }
    if (Array.isArray(value.nodes) || Array.isArray(value.edges) || Array.isArray(value.transitions)) {
      return {
        nodes: value.nodes?.length || 0,
        edges: value.edges?.length || 0,
        transitions: value.transitions?.length || 0,
      };
    }
    return Object.keys(value).length;
  }
  return value == null ? 0 : 1;
}

function scanIdentityKey(record) {
  return [
    record.mapId || "",
    record.floorId || "",
    record.pointId || "",
    String(record.bssid || "").toLowerCase(),
    record.scannedAt || "",
  ].join("|");
}

function safeFirebaseKey(value) {
  return String(value || "")
    .replace(/[.#$/[\]]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 700);
}

function scopeKey(mapId, floorId) {
  return safeFirebaseKey(`${mapId}__${floorId}`);
}

function normalizeWifiScanIndex(index, mapId, floorId) {
  return {
    summary: {
      mapId,
      floorId,
      totalRecords: Number(index.summary?.totalRecords || 0),
      latestScannedAt: index.summary?.latestScannedAt || "",
      updatedAt: index.summary?.updatedAt || "",
      rebuildCursor: index.summary?.rebuildCursor || "",
      rebuildComplete: index.summary?.rebuildComplete === true,
    },
    points: index.points || {},
    bssids: index.bssids || {},
  };
}

function addScanToIndex(index, record) {
  const pointId = String(record.pointId || "").trim();
  const bssid = String(record.bssid || "").trim().toLowerCase();
  const rssi = Number(record.rssi);
  if (!pointId || !bssid || !Number.isFinite(rssi)) return;
  const pointKey = safeFirebaseKey(pointId);
  const bssidKey = safeFirebaseKey(bssid);
  const point = index.points[pointKey] || {
    pointId,
    scanCount: 0,
    rssiTotal: 0,
    latestScannedAt: "",
    bssids: {},
  };
  point.scanCount = Number(point.scanCount || 0) + 1;
  point.rssiTotal = Number(point.rssiTotal || 0) + rssi;
  point.bssids = point.bssids || {};
  point.bssids[bssidKey] = true;
  if (record.scannedAt && String(record.scannedAt) > String(point.latestScannedAt || "")) {
    point.latestScannedAt = record.scannedAt;
  }
  index.points[pointKey] = point;
  index.bssids[bssidKey] = true;
  index.summary.totalRecords = Number(index.summary.totalRecords || 0) + 1;
  if (record.scannedAt && String(record.scannedAt) > String(index.summary.latestScannedAt || "")) {
    index.summary.latestScannedAt = record.scannedAt;
  }
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  DATA_FILES,
  isEnabled,
  mirrorJsonFiles,
  mirrorWifiScans,
  readWifiScanIndexSummary,
  readWifiScansByScope,
  readWifiScanSummaryByScope,
  rebuildWifiScanIndex,
  startMirror,
  statusSummary,
};
