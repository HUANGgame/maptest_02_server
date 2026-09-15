const fs = require("fs");
const path = require("path");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const feedbackPath = path.join(dataDir, "navigation_feedback.json");

function readFeedback() {
  ensureDataDir();
  if (!fs.existsSync(feedbackPath)) return [];
  const raw = fs.readFileSync(feedbackPath, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function appendFeedback(record) {
  ensureDataDir();
  const existing = readFeedback();
  const now = new Date().toISOString();
  const next = {
    id: existing.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    ...record,
    qualityStatus: "pending",
    createdAt: now,
  };
  fs.writeFileSync(feedbackPath, JSON.stringify(existing.concat(next), null, 2), "utf8");
  return next;
}

function writeFeedback(records) {
  ensureDataDir();
  fs.writeFileSync(feedbackPath, JSON.stringify(records, null, 2), "utf8");
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  appendFeedback,
  readFeedback,
  writeFeedback,
};
