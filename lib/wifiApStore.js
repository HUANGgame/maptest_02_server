const fs = require("fs");
const path = require("path");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const filePath = path.join(dataDir, "wifi_ap_calibrations.json");
const ALLOWED_CATEGORIES = new Set(["infrastructure", "public", "store", "unknown"]);
const ALLOWED_MANAGEMENT_STATUSES = new Set(["active", "review", "disabled"]);
const PIXELS_PER_METER = 8;

function readWifiAps(filter = {}) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [];
  return items.filter((item) => {
    if (filter.mapId && item.mapId !== filter.mapId) return false;
    if (filter.floorId && item.floorId !== filter.floorId) return false;
    return true;
  });
}

function upsertWifiAps(records) {
  const existing = readWifiAps();
  const byId = new Map(existing.map((item) => [item.calibrationId, item]));
  const now = new Date().toISOString();
  const saved = records.map((record) => {
    const normalized = normalizeWifiAp(record, now);
    const previous = byId.get(normalized.calibrationId) || {};
    const incomingTime = parseTime(normalized.collectorUpdatedAt);
    const incomingIsOlder = incomingTime < parseTime(previous.collectorUpdatedAt);
    const collectorValues = incomingIsOlder ? previous : normalized;
    const collectorPositionIsNewer = !previous.positionManaged || incomingTime > parseTime(previous.positionCorrectedAt);
    const collectorNameIsNewer = !previous.ssidManaged || incomingTime > parseTime(previous.ssidCorrectedAt);
    const next = {
      ...previous,
      ...collectorValues,
      ssid: collectorNameIsNewer ? collectorValues.ssid : previous.ssid,
      ssidManaged: collectorNameIsNewer ? false : previous.ssidManaged,
      x: collectorPositionIsNewer ? collectorValues.x : previous.x,
      y: collectorPositionIsNewer ? collectorValues.y : previous.y,
      positionManaged: collectorPositionIsNewer ? false : previous.positionManaged,
      category: previous.category || normalized.category,
      managementStatus: previous.managementStatus || normalized.managementStatus,
      notes: previous.notes || normalized.notes,
      createdAt: previous.createdAt || now,
      updatedAt: now,
    };
    byId.set(next.calibrationId, next);
    return next;
  });
  writeWifiAps(Array.from(byId.values()));
  return saved;
}

function updateWifiAp(calibrationId, changes = {}) {
  const items = readWifiAps();
  const index = items.findIndex((item) => item.calibrationId === calibrationId);
  if (index < 0) return null;
  const next = { ...items[index] };
  let coordinatesChanged = false;
  if (changes.ssid !== undefined) {
    next.ssid = String(changes.ssid).trim().slice(0, 120);
    next.ssidManaged = true;
    next.ssidCorrectedAt = new Date().toISOString();
  }
  if (changes.category !== undefined) {
    const category = String(changes.category).trim().toLowerCase();
    if (!ALLOWED_CATEGORIES.has(category)) throw new Error("基地台分類不合法。");
    next.category = category;
  }
  if (changes.managementStatus !== undefined) {
    const status = String(changes.managementStatus).trim().toLowerCase();
    if (!ALLOWED_MANAGEMENT_STATUSES.has(status)) throw new Error("基地台管理狀態不合法。");
    next.managementStatus = status;
  }
  for (const field of ["x", "y"]) {
    if (changes[field] === undefined) continue;
    const value = Number(changes[field]);
    if (!Number.isFinite(value)) throw new Error(`${field} 必須是數字。`);
    if (Number(next[field]) !== value) coordinatesChanged = true;
    next[field] = value;
    next.positionManaged = true;
    next.positionCorrectedAt = new Date().toISOString();
  }
  if (changes.physicalConfirmed === true) {
    next.calibrationStatus = "verified";
    next.source = "physical_confirmed";
    next.uncertaintyMeters = 1.5;
  } else if (coordinatesChanged) {
    next.calibrationStatus = "candidate";
    next.source = "manual_position";
    next.managementStatus = "review";
  }
  if (changes.notes !== undefined) next.notes = String(changes.notes).trim().slice(0, 500);
  next.updatedAt = new Date().toISOString();
  items[index] = next;
  writeWifiAps(items);
  return next;
}

function analyzeWifiAps(calibrations, scans, now = Date.now()) {
  const scopeLatestAt = maximumTime(scans.map((scan) => scan.scannedAt));
  const scansByBssid = groupBy(scans, (scan) => String(scan.bssid || "").toLowerCase());
  const items = calibrations.map((calibration) => analyzeWifiAp(
    calibration,
    scansByBssid.get(calibration.bssid) || [],
    scans,
    scopeLatestAt,
    now
  ));
  return {
    items,
    summary: items.reduce((result, item) => {
      result.total += 1;
      result[item.healthStatus] = (result[item.healthStatus] || 0) + 1;
      return result;
    }, { total: 0, candidate: 0, verified: 0, stable: 0, moved_suspected: 0, offline_suspected: 0, disabled: 0 }),
  };
}

function estimateWifiApPosition(calibrations, currentWifiList) {
  const currentByBssid = new Map((currentWifiList || []).map((item) => [String(item.bssid || "").toLowerCase(), Number(item.rssi)]));
  const matches = calibrations
    .filter((item) => item.calibrationStatus === "verified" && item.managementStatus === "active")
    .filter((item) => !["moved_suspected", "offline_suspected", "disabled"].includes(item.healthStatus))
    .map((item) => {
      const rssi = currentByBssid.get(item.bssid);
      const referenceRssi = Number(item.referenceRssi);
      const exponent = Number(item.pathLossExponent);
      if (!Number.isFinite(rssi) || !Number.isFinite(referenceRssi) || !Number.isFinite(exponent) || exponent < 1.2 || exponent > 6) return null;
      const distanceMeters = clamp(10 ** ((referenceRssi - rssi) / (10 * exponent)), 0.5, 35);
      return { ...item, rssi, distancePixels: distanceMeters * PIXELS_PER_METER };
    })
    .filter(Boolean)
    .sort((left, right) => right.rssi - left.rssi)
    .slice(0, 8);
  if (matches.length < 3 || !hasUsableGeometry(matches)) return null;

  const origin = matches[0];
  let aa = 0;
  let ab = 0;
  let bb = 0;
  let ac = 0;
  let bc = 0;
  for (const item of matches.slice(1)) {
    const a = 2 * (item.x - origin.x);
    const b = 2 * (item.y - origin.y);
    const c = origin.distancePixels ** 2 - item.distancePixels ** 2
      + item.x ** 2 - origin.x ** 2 + item.y ** 2 - origin.y ** 2;
    const weight = 1 / Math.max(1, item.distancePixels);
    aa += weight * a * a;
    ab += weight * a * b;
    bb += weight * b * b;
    ac += weight * a * c;
    bc += weight * b * c;
  }
  const determinant = aa * bb - ab * ab;
  if (Math.abs(determinant) < 0.0001) return null;
  const x = (ac * bb - bc * ab) / determinant;
  const y = (aa * bc - ab * ac) / determinant;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const residuals = matches.map((item) => Math.abs(Math.hypot(x - item.x, y - item.y) - item.distancePixels) / PIXELS_PER_METER);
  const rmseMeters = Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / residuals.length);
  if (!Number.isFinite(rmseMeters) || rmseMeters > 15) return null;
  return {
    x,
    y,
    matchedApCount: matches.length,
    estimatedError: Math.max(2, rmseMeters),
    confidence: clamp(Math.round(38 + matches.length * 8 - rmseMeters * 3), 20, 88),
  };
}

function analyzeWifiAp(calibration, apScans, scopeScans, scopeLatestAt, now) {
  if (calibration.managementStatus === "disabled") {
    return healthResult(calibration, "disabled", "已由管理者停用，不參與定位。", apScans, null, scopeLatestAt);
  }
  if (calibration.managementStatus === "review") {
    return healthResult(calibration, "verified", "管理者已標記為待複查。", apScans, null, scopeLatestAt);
  }
  if (calibration.calibrationStatus !== "verified") {
    return healthResult(calibration, "candidate", "尚未在現場確認基地台位置。", apScans, null, scopeLatestAt);
  }

  const lastSeenAt = maximumTime(apScans.map((scan) => scan.scannedAt));
  const latestReference = scopeLatestAt || now;
  const recentCutoff = latestReference - 7 * 24 * 60 * 60 * 1000;
  const recentApScans = apScans.filter((scan) => parseTime(scan.scannedAt) >= recentCutoff);
  const estimate = strongestLocationEstimate(recentApScans.length ? recentApScans : apScans);
  const driftMeters = estimate
    ? Math.hypot(estimate.x - calibration.x, estimate.y - calibration.y) / PIXELS_PER_METER
    : null;
  const observedPoints = new Set(recentApScans.map((scan) => scan.pointId).filter(Boolean)).size;

  if (lastSeenAt) {
    const newerScopeScans = scopeScans.filter((scan) => parseTime(scan.scannedAt) > lastSeenAt + 24 * 60 * 60 * 1000);
    const newerSamples = new Set(newerScopeScans.map(scanSampleKey));
    const newerPoints = new Set(newerScopeScans.map((scan) => scan.pointId).filter(Boolean));
    if (newerSamples.size >= 5 && newerPoints.size >= 3 && latestReference - lastSeenAt >= 24 * 60 * 60 * 1000) {
      return healthResult(calibration, "offline_suspected", "同樓層已有足夠新測量，但這台基地台持續未被掃到。", apScans, driftMeters, scopeLatestAt, estimate);
    }
  }

  if (recentApScans.length >= 24 && observedPoints >= 6 && driftMeters !== null && driftMeters >= 10) {
    return healthResult(calibration, "moved_suspected", `新訊號熱區偏離校正座標約 ${driftMeters.toFixed(1)} 公尺。`, apScans, driftMeters, scopeLatestAt, estimate);
  }
  if (recentApScans.length >= 12 && observedPoints >= 4 && driftMeters !== null && driftMeters <= 5) {
    return healthResult(calibration, "stable", "近期多點測量與校正座標一致。", apScans, driftMeters, scopeLatestAt, estimate);
  }
  return healthResult(calibration, "verified", "位置已確認，但近期覆蓋量不足，暫不判定異常。", apScans, driftMeters, scopeLatestAt, estimate);
}

function normalizeWifiAp(record, now) {
  const mapId = String(record.mapId || "").trim();
  const floorId = String(record.floorId || floorIdFromNumber(record.floor, mapId)).trim();
  const bssid = String(record.bssid || "").trim().toLowerCase();
  if (!mapId || !floorId || !bssid) throw new Error("mapId、floorId 與 bssid 不可空白。");
  const x = Number(record.x);
  const y = Number(record.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("基地台座標必須是數字。");
  const rawStatus = String(record.calibrationStatus || record.status || "candidate").trim().toLowerCase();
  return {
    calibrationId: String(record.calibrationId || `${mapId}|${floorId}|${bssid}`).trim(),
    bssid,
    ssid: String(record.ssid || "").trim(),
    mapId,
    floorId,
    x,
    y,
    referenceRssi: finiteOrNull(record.referenceRssi),
    pathLossExponent: finiteOrNull(record.pathLossExponent),
    rmse: finiteOrNull(record.rmse),
    samplePointCount: integerOrZero(record.samplePointCount),
    observationCount: integerOrZero(record.observationCount),
    surveyPointCount: integerOrZero(record.surveyPointCount),
    uncertaintyMeters: finiteOrNull(record.uncertaintyMeters),
    suggestedPointId: String(record.suggestedPointId || "").trim(),
    calibrationStatus: rawStatus === "verified" ? "verified" : "candidate",
    source: String(record.source || "fingerprint_estimate").trim().toLowerCase(),
    category: ALLOWED_CATEGORIES.has(String(record.category || "").toLowerCase()) ? String(record.category).toLowerCase() : "infrastructure",
    managementStatus: ALLOWED_MANAGEMENT_STATUSES.has(String(record.managementStatus || "").toLowerCase()) ? String(record.managementStatus).toLowerCase() : "active",
    notes: String(record.notes || "").trim().slice(0, 500),
    collectorUpdatedAt: normalizeDate(record.collectorUpdatedAt || record.updatedAt) || now,
  };
}

function healthResult(calibration, healthStatus, healthReason, scans, driftMeters, scopeLatestAt, estimate = null) {
  return {
    ...calibration,
    healthStatus,
    healthReason,
    lastSeenAt: normalizeDate(maximumTime(scans.map((scan) => scan.scannedAt))),
    scopeLatestAt: normalizeDate(scopeLatestAt),
    recentObservationCount: scans.length,
    recentPointCount: new Set(scans.map((scan) => scan.pointId).filter(Boolean)).size,
    driftMeters: driftMeters == null ? null : Math.round(driftMeters * 10) / 10,
    observedX: estimate ? Math.round(estimate.x * 10) / 10 : null,
    observedY: estimate ? Math.round(estimate.y * 10) / 10 : null,
  };
}

function strongestLocationEstimate(scans) {
  const points = Array.from(groupBy(scans.filter((scan) => Number.isFinite(Number(scan.x)) && Number.isFinite(Number(scan.y))), (scan) => `${scan.pointId}|${scan.x}|${scan.y}`).values())
    .map((items) => ({
      x: Number(items[0].x),
      y: Number(items[0].y),
      rssi: items.reduce((sum, item) => sum + Number(item.rssi), 0) / items.length,
    }))
    .sort((left, right) => right.rssi - left.rssi)
    .slice(0, 5);
  if (!points.length) return null;
  const weakest = Math.min(...points.map((point) => point.rssi));
  const weighted = points.map((point) => ({ ...point, weight: Math.max(1, point.rssi - weakest + 1) }));
  const totalWeight = weighted.reduce((sum, point) => sum + point.weight, 0);
  return {
    x: weighted.reduce((sum, point) => sum + point.x * point.weight, 0) / totalWeight,
    y: weighted.reduce((sum, point) => sum + point.y * point.weight, 0) / totalWeight,
  };
}

function hasUsableGeometry(items) {
  let largestArea = 0;
  for (let first = 0; first < items.length - 2; first += 1) {
    for (let second = first + 1; second < items.length - 1; second += 1) {
      for (let third = second + 1; third < items.length; third += 1) {
        const a = items[first];
        const b = items[second];
        const c = items[third];
        largestArea = Math.max(largestArea, Math.abs(a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2);
      }
    }
  }
  return largestArea / (PIXELS_PER_METER ** 2) >= 8;
}

function floorIdFromNumber(floor, mapId) {
  const value = Number(floor);
  if (!Number.isFinite(value)) return "";
  if (mapId === "k-area-airport") return `k-area-airport-${value}f`;
  return String(value);
}

function scanSampleKey(scan) {
  return scan.sampleId || `${scan.pointId}|${String(scan.scannedAt || "").slice(0, 16)}`;
}

function maximumTime(values) {
  const times = values.map(parseTime).filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

function parseTime(value) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeDate(value) {
  const parsed = parseTime(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function groupBy(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
}

function writeWifiAps(items) {
  ensureDataDir();
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(items, null, 2), "utf8");
  fs.renameSync(temporary, filePath);
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  analyzeWifiAps,
  estimateWifiApPosition,
  readWifiAps,
  updateWifiAp,
  upsertWifiAps,
};
