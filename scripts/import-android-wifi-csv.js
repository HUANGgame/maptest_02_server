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
  const metadataRows = metadataLines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(metadataHeaders.map((header, index) => [header, values[index] ?? ""]));
  });
  const publicMapsDir = path.join(__dirname, "..", "public", "maps");
  fs.mkdirSync(publicMapsDir, { recursive: true });
  const catalogPath = path.join(__dirname, "..", "data", "catalog_records.json");
  const catalog = fs.existsSync(catalogPath)
    ? JSON.parse(fs.readFileSync(catalogPath, "utf8") || "{}")
    : {};
  const maps = Array.isArray(catalog.maps) ? catalog.maps : [];
  const floors = Array.isArray(catalog.floors) ? catalog.floors : [];
  const places = Array.isArray(catalog.places) ? catalog.places : [];
  const now = new Date().toISOString();

  for (const row of metadataRows) {
    const mapId = row.mapId || "android-import";
    const scoped = scans.filter((record) => record.mapId === mapId);
    const floorIds = Array.from(new Set(scoped.map((record) => record.floorId)));
    const defaultImageUrl = copyFloorImage(sourceDir, publicMapsDir, mapId, null, row.exportedMapFile || "");

    upsertById(maps, {
      id: mapId,
      name: row.mapName || mapId,
      description: "Android 匯入的室內定位 Demo 地圖",
      createdAt: now,
      updatedAt: now,
    });

    for (const floorId of floorIds) {
      const floorMetadata = metadataRows.find((item) =>
        (item.mapId || "android-import") === mapId &&
        normalizeFloorId(item.floorId || item.floor || "") === floorId
      ) || row;
      const floorScans = scoped.filter((record) => record.floorId === floorId);
      const xs = floorScans.map((record) => Number(record.x)).filter(Number.isFinite);
      const ys = floorScans.map((record) => Number(record.y)).filter(Number.isFinite);
      const imageUrl =
        copyFloorImage(sourceDir, publicMapsDir, mapId, floorId, floorMetadata.exportedMapFile || "") ||
        findExistingFloorImage(sourceDir, publicMapsDir, mapId, floorId) ||
        defaultImageUrl;
      const scaleValue = Number(floorMetadata.metersPerPixel || row.metersPerPixel || 1);
      const imageSize = imageSizeForUrl(publicMapsDir, imageUrl);
      const imageMetricSize = imageSize && Number.isFinite(scaleValue) && scaleValue > 0
        ? {
            imageNaturalWidth: imageSize.width,
            imageNaturalHeight: imageSize.height,
            imageWidth: imageSize.width * scaleValue,
            imageHeight: imageSize.height * scaleValue,
            coordinateUnit: floorMetadata.coordinateUnit || row.coordinateUnit || "meter",
          }
        : {};

      upsertById(floors, {
        id: floorId,
        mapId,
        floorName: floorMetadata.floorName || floorMetadata.name || floorId,
        floorLevel: parseFloorNumber(floorId),
        imageUrl,
        width: boundedExtent(xs),
        height: boundedExtent(ys),
        scaleValue,
        ...imageMetricSize,
        createdAt: now,
        updatedAt: now,
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

function normalizeFloorId(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";
  return text.startsWith("floor_") ? text : `floor_${text}`;
}

function copyFloorImage(sourceDir, publicMapsDir, mapId, floorId, exportedMapFile) {
  if (!exportedMapFile) return null;
  const sourceImagePath = path.join(sourceDir, exportedMapFile);
  if (!fs.existsSync(sourceImagePath)) return null;
  const extension = path.extname(exportedMapFile) || ".jpg";
  const floorPart = floorId ? `_${safeFileToken(floorId)}` : "";
  const targetName = `${safeFileToken(mapId)}${floorPart}${extension}`;
  fs.copyFileSync(sourceImagePath, path.join(publicMapsDir, targetName));
  return `/maps/${targetName}`;
}

function findExistingFloorImage(sourceDir, publicMapsDir, mapId, floorId) {
  const candidates = fs.readdirSync(sourceDir).filter((name) => {
    const lower = name.toLowerCase();
    if (!/\.(jpg|jpeg|png|webp)$/.test(lower)) return false;
    const scopedToken = `${mapId}_${floorId}`.toLowerCase();
    const floorToken = `imported_floor_map_${floorId}`.toLowerCase();
    return lower.includes(scopedToken) || lower.includes(floorToken);
  });
  if (candidates.length === 0) return null;
  return copyFloorImage(sourceDir, publicMapsDir, mapId, floorId, candidates[0]);
}

function boundedExtent(values) {
  if (values.length === 0) return 0;
  return Math.max(0, Math.max(...values) - Math.min(...values));
}

function imageSizeForUrl(publicMapsDir, imageUrl) {
  if (!imageUrl || !imageUrl.startsWith("/maps/")) return null;
  const imagePath = path.join(publicMapsDir, path.basename(imageUrl));
  if (!fs.existsSync(imagePath)) return null;
  return readImageSize(imagePath);
}

function readImageSize(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  if (buffer.length >= 24 && buffer.slice(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5),
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

function safeFileToken(value) {
  return String(value || "map").replace(/[^a-zA-Z0-9_-]/g, "_");
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
