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

let db = null;
let enabled = false;

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
  await hydrateJsonFromFirebaseIfEmpty();
  return true;
}

async function mirrorWifiScans(records) {
  if (!enabled || !Array.isArray(records) || records.length === 0) return false;
  const updates = {};
  for (const record of records) {
    const id = safeFirebaseKey(record.id || scanIdentityKey(record));
    updates[`wifi_scans/${id}`] = record;
  }
  await root().update(updates);
  await writeMeta();
  return true;
}

async function mirrorJsonFiles(fileNames = DATA_FILES) {
  if (!enabled) return false;
  const updates = {};
  for (const fileName of fileNames) {
    const value = readJsonFile(fileName);
    if (value === undefined) continue;
    const collection = collectionName(fileName);
    if (fileName === "wifi_scans.json" && Array.isArray(value)) {
      value.forEach((record) => {
        const id = safeFirebaseKey(record.id || scanIdentityKey(record));
        updates[`wifi_scans/${id}`] = record;
      });
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
    databaseUrl: process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_RTDB_URL,
    counts,
    updatedAt: value.meta?.updatedAt || null,
  };
}

async function hydrateJsonFromFirebaseIfEmpty() {
  ensureDataDir();
  for (const fileName of DATA_FILES) {
    const filePath = path.join(dataDir, fileName);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 2) continue;
    const snapshot = await root().child(collectionName(fileName)).once("value");
    const value = snapshot.val();
    if (value == null) continue;
    const normalized = fileName === "wifi_scans.json" && !Array.isArray(value)
      ? Object.values(value)
      : value;
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf8");
  }
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

async function writeMeta() {
  await root().child("meta").update({
    updatedAt: new Date().toISOString(),
    source: "maptest-02-server",
  });
}

function readJsonFile(fileName) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) return undefined;
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw);
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
