const fs = require("fs");
const path = require("path");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const reportsPath = path.join(dataDir, "user_reports.json");

function appendReport(report) {
  const reports = readReports();
  const now = new Date().toISOString();
  const next = {
    id: reports.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    ...report,
    status: "pending",
    createdAt: now,
  };
  writeReports(reports.concat(next));
  return next;
}

function readReports(filter = {}) {
  ensureDataDir();
  if (!fs.existsSync(reportsPath)) return [];
  const raw = fs.readFileSync(reportsPath, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  const reports = Array.isArray(parsed) ? parsed : [];
  return reports.filter((report) => {
    if (filter.mapId && report.mapId !== filter.mapId) return false;
    if (filter.floorId && report.floorId !== filter.floorId) return false;
    return true;
  });
}

function writeReports(reports) {
  ensureDataDir();
  fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2), "utf8");
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  appendReport,
  readReports,
};
