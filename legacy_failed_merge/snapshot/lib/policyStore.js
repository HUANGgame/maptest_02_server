const fs = require("fs");
const path = require("path");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const runsPath = path.join(dataDir, "dqn_training_runs.json");
const logsPath = path.join(dataDir, "navigation_policy_logs.json");

function readDqnRuns() {
  return readArray(runsPath);
}

function createDqnRun(run) {
  const runs = readDqnRuns();
  const now = new Date().toISOString();
  const next = {
    id: run.id || `dqn-${Date.now()}`,
    mapId: run.mapId,
    floorId: run.floorId,
    trainingEpisodes: run.trainingEpisodes || 0,
    averageReward: run.averageReward ?? null,
    successRate: run.successRate ?? null,
    scenarioCount: run.scenarioCount ?? null,
    baselineRouteCount: run.baselineRouteCount ?? null,
    actionDistribution: run.actionDistribution || {},
    simulationSummary: run.simulationSummary || "",
    modelPath: run.modelPath || "",
    trainedAt: now,
    isActive: run.isActive === true,
    createdAt: now,
    updatedAt: now,
  };
  const updated = next.isActive
    ? runs.map((item) => item.mapId === next.mapId && item.floorId === next.floorId ? { ...item, isActive: false, updatedAt: now } : item)
    : runs;
  writeArray(runsPath, updated.concat(next));
  return next;
}

function appendPolicyLog(log) {
  const logs = readPolicyLogs();
  const now = new Date().toISOString();
  const next = {
    id: logs.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    ...log,
    createdAt: now,
  };
  writeArray(logsPath, logs.concat(next));
  return next;
}

function readPolicyLogs() {
  return readArray(logsPath);
}

function readArray(filePath) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writeArray(filePath, items) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  appendPolicyLog,
  createDqnRun,
  readDqnRuns,
  readPolicyLogs,
};
