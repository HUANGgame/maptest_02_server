const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..", "..");
const inputPath = process.argv[2] || path.join(repoRoot, "app", "src", "main", "assets", "wifi_fingerprint_records.csv");
const outputPath = process.argv[3] || path.join(__dirname, "..", "data", "wifi_scans.json");
const inputDir = path.dirname(inputPath);

const raw = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
const lines = raw.split(/\r?\n/).filter(Boolean);
if (lines.length < 2) {
  throw new Error(`CSV has no records: ${inputPath}`);
}

const headers = parseCsvLine(lines[0]);
const records = [];
for (let index = 1; index < lines.length; index += 1) {
  const values = parseCsvLine(lines[index]);
  const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""]));
  const timestamp = Number(row.timestamp);
  const scannedAt = Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp).toISOString()
    : new Date().toISOString();
  const mapId = row.mapId || "android-import";
  const floorId = row.floor ? `floor_${row.floor}` : (row.floorId || "floor_1");
  records.push({
    id: records.length + 1,
    pointId: row.pointId || row.sampleId || `P${String(records.length + 1).padStart(4, "0")}`,
    mapId,
    floorId,
    x: Number(row.x),
    y: Number(row.y),
    heading: row.azimuth === "" ? null : Number(row.azimuth),
    ssid: row.ssid || "",
    bssid: String(row.bssid || "").toLowerCase(),
    rssi: Number(row.rssi),
    deviceInfo: [row.deviceModel, row.androidVersion ? `Android ${row.androidVersion}` : ""].filter(Boolean).join(" / "),
    scannedAt,
    uploadedAt: scannedAt,
    createdAt: scannedAt,
    source: "android_csv_import",
    sampleId: row.sampleId || "",
    sessionId: row.sessionId || "",
    scanFreshness: row.scanFreshness || "",
  });
}

const validRecords = records.filter((record) =>
  record.mapId &&
  record.floorId &&
  record.pointId &&
  Number.isFinite(record.x) &&
  Number.isFinite(record.y) &&
  record.bssid &&
  Number.isFinite(record.rssi)
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(validRecords, null, 2), "utf8");
syncMapMetadata(inputDir, validRecords);

const pointCount = new Set(validRecords.map((record) => `${record.mapId}/${record.floorId}/${record.pointId}`)).size;
const mapCount = new Set(validRecords.map((record) => record.mapId)).size;
const floorCount = new Set(validRecords.map((record) => `${record.mapId}/${record.floorId}`)).size;
console.log(`Imported ${validRecords.length} Wi-Fi scan rows from ${inputPath}`);
console.log(`Maps: ${mapCount}, floors: ${floorCount}, points: ${pointCount}`);
console.log(`Output: ${outputPath}`);

function syncMapMetadata(sourceDir, scans) {
  const metadataPath = path.join(sourceDir, "map_metadata.csv");
  if (!fs.existsSync(metadataPath)) return;
  const metadataLines = fs.readFileSync(metadataPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (metadataLines.length < 2) return;
  const metadataHeaders = parseCsvLine(metadataLines[0]);
  const metadataRows = metadataLines.slice(1).map((line) => Object.fromEntries(
    metadataHeaders.map((header, index) => [header, parseCsvLine(line)[index] ?? ""])
  ));
  const publicMapsDir = path.join(__dirname, "..", "public", "maps");
  fs.mkdirSync(publicMapsDir, { recursive: true });
  const catalogPath = path.join(__dirname, "..", "data", "catalog_records.json");
  const catalog = fs.existsSync(catalogPath)
    ? JSON.parse(fs.readFileSync(catalogPath, "utf8") || "{}")
    : {};
  const maps = Array.isArray(catalog.maps) ? catalog.maps : [];
  const floors = Array.isArray(catalog.floors) ? catalog.floors : [];
  const places = Array.isArray(catalog.places) ? catalog.places : [];
  for (const row of metadataRows) {
    const mapId = row.mapId || "android-import";
    const scoped = scans.filter((record) => record.mapId === mapId);
    const floorIds = Array.from(new Set(scoped.map((record) => record.floorId)));
    const sourceImageName = row.exportedMapFile || "";
    let imageUrl = null;
    if (sourceImageName) {
      const sourceImagePath = path.join(sourceDir, sourceImageName);
      if (fs.existsSync(sourceImagePath)) {
        const extension = path.extname(sourceImageName) || ".jpg";
        const targetName = `${mapId}${extension}`;
        fs.copyFileSync(sourceImagePath, path.join(publicMapsDir, targetName));
        imageUrl = `/maps/${targetName}`;
      }
    }
    upsertById(maps, {
      id: mapId,
      name: mapId,
      description: "由 Android 管理者採樣工具匯入。",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    for (const floorId of floorIds) {
      const floorScans = scoped.filter((record) => record.floorId === floorId);
      const xs = floorScans.map((record) => Number(record.x)).filter(Number.isFinite);
      const ys = floorScans.map((record) => Number(record.y)).filter(Number.isFinite);
      upsertById(floors, {
        id: floorId,
        mapId,
        floorName: floorId,
        floorLevel: parseFloorNumber(floorId),
        imageUrl,
        width: Math.max(0, Math.max(...xs) - Math.min(...xs)),
        height: Math.max(0, Math.max(...ys) - Math.min(...ys)),
        scaleValue: Number(row.metersPerPixel || 1),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  fs.writeFileSync(catalogPath, JSON.stringify({ maps, floors, places }, null, 2), "utf8");
}

function upsertById(items, next) {
  const index = items.findIndex((item) => item.id === next.id);
  if (index >= 0) items[index] = { ...items[index], ...next };
  else items.push(next);
}

function parseFloorNumber(value) {
  const match = String(value || "").match(/-?\d+/);
  return match ? Number(match[0]) : 1;
}

function parseCsvLine(line) {
  const result = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        value += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      result.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  result.push(value);
  return result;
}
