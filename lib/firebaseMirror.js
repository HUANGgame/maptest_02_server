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
      note: "Firebase is not configured; JSON files are the active store.",
    };
  }

  const snapshot = await root().once("value");
  const value = snapshot.val() || {};
  const counts = {};
  for (const fileName of DATA_FILES) {
    const name = collectionName(fileName);
    counts[name] = countRecords(value[name]);
  }
  return {
    enabled: true,
    storage: "firebase-rtdb",
    sourceOfTruth: true,
    databaseUrl: process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_RTDB_URL,
    counts,
    updatedAt: value.meta?.updatedAt || null,
    startupSync,
    note: "Firebase Realtime Database is the active store; JSON files are only the local runtime cache.",
  };
}

async function syncJsonCacheWithFirebase() {
  ensureDataDir();
  const snapshot = await root().once("value");
  const remote = snapshot.val() || {};
  const result = {
    restoredFiles: [],
    seededFiles: [],
    skippedFiles: [],
    syncedAt: new Date().toISOString(),
    status: "running",
  };

  for (const fileName of DATA_FILES) {
    const collection = collectionName(fileName);
    const remoteValue = remote[collection];
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

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  DATA_FILES,
  isEnabled,
  mirrorJsonFiles,
  mirrorWifiScans,
  startMirror,
  statusSummary,
};
