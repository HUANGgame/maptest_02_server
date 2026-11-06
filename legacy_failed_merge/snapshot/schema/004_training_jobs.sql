-- Should Have: model retraining job records.

CREATE TABLE IF NOT EXISTS model_training_jobs (
    id VARCHAR(64) PRIMARY KEY,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    modelVersionId VARCHAR(64),
    trainingType ENUM('initialManualFingerprint', 'feedbackIncrementalTraining', 'fullRetraining') NOT NULL,
    trainingDataCount INT NOT NULL DEFAULT 0,
    feedbackDataCount INT NOT NULL DEFAULT 0,
    status ENUM('pending', 'running', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    startedAt DATETIME,
    finishedAt DATETIME,
    resultSummary TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_training_jobs_scope (mapId, floorId),
    INDEX idx_training_jobs_status (status)
);
