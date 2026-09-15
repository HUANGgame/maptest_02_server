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
  return Array.isArray(parsed) ? migrateKnownModelOwnership(parsed) : [];
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

function normalizeKnownModelOwnership(model) {
  if (model.mapId === "F1_M1" && (model.floorId === "floor_1" || model.floorId === "1" || model.floorId === "1F")) {
    model.mapId = "k-area-airport";
    model.floorId = "k-area-airport-1f";
    return true;
  }
  if (model.mapId === "k-area-airport" && (model.floorId === "k-area-airport-b1" || model.floorId === "B1" || model.floorId === "-1")) {
    model.floorId = "k-area-airport-1f";
    return true;
  }
  return false;
}

function migrateKnownModelOwnership(models) {
  let changed = false;
  const migrated = models.map((model) => {
    const next = { ...model };
    if (normalizeKnownModelOwnership(next)) changed = true;
    return next;
  });
  if (changed) writeModels(migrated);
  return migrated;
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
