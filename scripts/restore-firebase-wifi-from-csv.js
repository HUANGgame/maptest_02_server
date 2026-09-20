const fs = require("fs");
const path = require("path");

const { getDatabase } = require("firebase-admin/database");
const firebaseMirror = require("../lib/firebaseMirror");

const inputPath = process.argv[2];
const APPLY = process.argv.includes("--apply");

if (!inputPath || !fs.existsSync(inputPath)) {
  throw new Error("CSV path is required");
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function floorIdFor(row) {
  if (row.floorId) return row.floorId;
  const floor = String(row.floor || "1").trim().toLowerCase().replace(/f$/, "");
  if (row.mapId === "k-area-airport") return `k-area-airport-${floor}f`;
  return `floor_${floor}`;
}

function priorityFor(sourceMode) {
  return ["BACKEND_PLACE", "KEY_POINT", "MANUAL"].includes(sourceMode)
    ? "field_verified"
    : "legacy_low";
}

function readRecords() {
  const raw = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const records = [];
  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index]);
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    if (/^P\d+$/i.test(row.pointId || "")) continue;
    const timestamp = Number(row.timestamp);
    const scannedAt = Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp).toISOString()
      : "";
    const record = {
      id: Number(row.id),
      sampleId: row.sampleId || "",
      pointId: row.pointId || "",
      mapId: row.mapId || "",
      floorId: floorIdFor(row),
      x: Number(row.x),
      y: Number(row.y),
      heading: row.azimuth === "" ? null : Number(row.azimuth),
      ssid: row.ssid || "",
      bssid: String(row.bssid || "").toLowerCase(),
      rssi: Number(row.rssi),
      frequency: Number(row.frequency) || 0,
      deviceInfo: [row.deviceModel, row.androidVersion ? `Android ${row.androidVersion}` : ""].filter(Boolean).join(" / "),
      scannedAt,
      uploadedAt: scannedAt,
      createdAt: scannedAt,
      sourceMode: row.sourceMode || "",
      dataPriority: priorityFor(row.sourceMode || ""),
      sessionId: row.sessionId || "",
      scanFreshness: row.scanFreshness || "",
    };
    if (
      Number.isFinite(record.id) && record.id > 0 && record.pointId && record.mapId &&
      Number.isFinite(record.x) && Number.isFinite(record.y) && record.bssid &&
      Number.isFinite(record.rssi) && record.scannedAt
    ) {
      records.push(record);
    }
  }
  return records;
}

function summarize(records) {
  const scopes = {};
  for (const record of records) {
    const key = `${record.mapId} / ${record.floorId}`;
    const item = scopes[key] || { records: 0, points: new Set(), latest: "" };
    item.records += 1;
    item.points.add(record.pointId);
    if (record.scannedAt > item.latest) item.latest = record.scannedAt;
    scopes[key] = item;
  }
  return Object.fromEntries(Object.entries(scopes).map(([key, item]) => [key, {
    records: item.records,
    points: item.points.size,
    latest: item.latest,
  }]));
}

async function main() {
  const records = readRecords();
  const ids = new Set(records.map((record) => record.id));
  if (records.length !== 56701 || ids.size !== records.length) {
    throw new Error(`Unexpected filtered CSV: records=${records.length}, uniqueIds=${ids.size}`);
  }

  console.log(JSON.stringify({ apply: APPLY, records: records.length, scopes: summarize(records) }, null, 2));
  if (!APPLY) return;

  await firebaseMirror.startMirror({ skipCacheSync: true });
  const root = getDatabase().ref(process.env.FIREBASE_ROOT_PATH || "indoor_navigation");
  await Promise.all([
    root.child("wifi_scans").remove(),
    root.child("wifi_scan_indexes").remove(),
  ]);
  await firebaseMirror.mirrorWifiScans(records);

  const outputPath = path.resolve(__dirname, "..", "data", "wifi_scans.json");
  fs.writeFileSync(outputPath, JSON.stringify(records, null, 2));
  console.log(`Restored ${records.length} records to Firebase and ${outputPath}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
