const fs = require("fs");
const path = require("path");

const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
const modelsPath = path.join(dataDir, "model_versions.json");

function readModels() {
  ensureDataDir();
  if (!fs.existsSync(modelsPath)) return [];
  const raw = fs.readFileSync(modelsPath, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function createModelVersion(model) {
  ensureDataDir();
  const models = readModels();
  const now = new Date().toISOString();
  const next = {
    id: model.id || `model-${Date.now()}`,
    versionName: model.versionName || `KNN-${now}`,
    mapId: model.mapId,
    floorId: model.floorId,
    algorithm: model.algorithm || "knn",
    trainingDataCount: model.trainingDataCount || 0,
    averageError: model.averageError ?? null,
    isComparisonOnly: model.isComparisonOnly === true,
    notes: model.notes || "",
    modelPath: model.modelPath || "",
    trainedAt: now,
    isActive: model.isActive === true,
    createdAt: now,
    updatedAt: now,
  };
  const updated = next.isActive
    ? models.map((item) => item.mapId === next.mapId && item.floorId === next.floorId ? { ...item, isActive: false, updatedAt: now } : item)
    : models;
  updated.push(next);
  writeModels(updated);
  return next;
}

function activateModel(modelId) {
  const models = readModels();
  const target = models.find((model) => model.id === modelId);
  if (!target) return null;
  const now = new Date().toISOString();
  const updated = models.map((model) => {
    if (model.mapId !== target.mapId || model.floorId !== target.floorId) return model;
    return {
      ...model,
      isActive: model.id === modelId,
      updatedAt: now,
    };
  });
  writeModels(updated);
  return updated.find((model) => model.id === modelId);
}

function activeModel(mapId, floorId) {
  return readModels().find((model) => model.mapId === mapId && model.floorId === floorId && model.isActive) || null;
}

function writeModels(models) {
  ensureDataDir();
  fs.writeFileSync(modelsPath, JSON.stringify(models, null, 2), "utf8");
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = {
  activateModel,
  activeModel,
  createModelVersion,
  readModels,
};
