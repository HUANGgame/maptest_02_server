const fs = require("fs");
const path = require("path");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const jobsPath = path.join(dataDir, "model_training_jobs.json");

function readTrainingJobs() {
  ensureDataDir();
  if (!fs.existsSync(jobsPath)) return [];
  const raw = fs.readFileSync(jobsPath, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function createTrainingJob(job) {
  ensureDataDir();
  const jobs = readTrainingJobs();
  const now = new Date().toISOString();
  const next = {
    id: job.id || `job-${Date.now()}`,
    mapId: job.mapId,
    floorId: job.floorId,
    modelVersionId: job.modelVersionId || "",
    trainingType: job.trainingType,
    trainingDataCount: job.trainingDataCount || 0,
    feedbackDataCount: job.feedbackDataCount || 0,
    status: job.status || "completed",
    startedAt: job.startedAt || now,
    finishedAt: job.finishedAt || now,
    resultSummary: job.resultSummary || "",
    createdAt: now,
    updatedAt: now,
  };
  fs.writeFileSync(jobsPath, JSON.stringify(jobs.concat(next), null, 2), "utf8");
  return next;
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  createTrainingJob,
  readTrainingJobs,
};
