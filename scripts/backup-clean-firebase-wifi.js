const fs = require("fs");
const path = require("path");

const { cert, initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

const ROOT_PATH = process.env.FIREBASE_ROOT_PATH || "indoor_navigation";
const APPLY = process.argv.includes("--apply");

function csvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function isLegacy(record) {
  return (
    (record.mapId === "F1_M1" && record.floorId === "floor_1") ||
    /^P\d+$/i.test(String(record.pointId || ""))
  );
}

function summary(records) {
  const scopes = {};
  for (const record of records) {
    const key = `${record.mapId || ""} / ${record.floorId || ""}`;
    const item = scopes[key] || { records: 0, points: new Set(), latest: "" };
    item.records += 1;
    item.points.add(record.pointId || "");
    const scannedAt = String(record.scannedAt || record.timestamp || "");
    if (scannedAt > item.latest) item.latest = scannedAt;
    scopes[key] = item;
  }
  return Object.fromEntries(
    Object.entries(scopes).map(([key, value]) => [key, {
      records: value.records,
      points: value.points.size,
      latest: value.latest,
    }])
  );
}

async function main() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!credentialPath || !databaseURL) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_DATABASE_URL are required");
  }

  initializeApp({
    credential: cert(JSON.parse(fs.readFileSync(credentialPath, "utf8"))),
    databaseURL,
  });
  const root = getDatabase().ref(ROOT_PATH);
  const [scanSnapshot, indexSnapshot] = await Promise.all([
    root.child("wifi_scans").once("value"),
    root.child("wifi_scan_indexes").once("value"),
  ]);
  const scansByKey = scanSnapshot.val() || {};
  const indexes = indexSnapshot.val() || {};
  const entries = Object.entries(scansByKey);
  const retained = entries.filter(([, record]) => !isLegacy(record));
  const legacy = entries.filter(([, record]) => isLegacy(record));

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(__dirname, "..", "backups", stamp);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, "firebase-wifi-scans-before-cleanup.json"), JSON.stringify(scansByKey));
  fs.writeFileSync(path.join(backupDir, "firebase-wifi-indexes-before-cleanup.json"), JSON.stringify(indexes));

  const headers = [
    "id", "sampleId", "pointId", "x", "y", "floor", "mapId", "sessionId",
    "dataSplit", "deviceModel", "androidVersion", "appVersion", "note", "sourceMode",
    "moveDirection", "intervalMeters", "azimuth", "ssid", "bssid", "rssi", "frequency",
    "scanFreshness", "scanUpdated", "duplicateScore", "timestamp",
  ];
  const csvRows = [headers.join(",")];
  for (const [key, record] of retained) {
    const row = {
      ...record,
      id: record.id || key,
      floor: record.floor ?? record.floorLevel ?? "",
      timestamp: record.timestamp || record.scannedAt || "",
    };
    csvRows.push(headers.map((header) => csvValue(row[header])).join(","));
  }
  fs.writeFileSync(
    path.join(backupDir, "wifi_fingerprint_records-latest.csv"),
    `\uFEFF${csvRows.join("\r\n")}\r\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(backupDir, "wifi_scans-latest.json"),
    JSON.stringify(retained.map(([, record]) => record), null, 2)
  );

  if (APPLY) {
    const batchSize = 500;
    for (let index = 0; index < legacy.length; index += batchSize) {
      const updates = {};
      for (const [key] of legacy.slice(index, index + batchSize)) {
        updates[key] = null;
      }
      await root.child("wifi_scans").update(updates);
    }
  }

  console.log(JSON.stringify({
    applied: APPLY,
    backupDir,
    before: summary(entries.map(([, record]) => record)),
    deleted: legacy.length,
    retained: retained.length,
    after: summary(retained.map(([, record]) => record)),
  }, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
