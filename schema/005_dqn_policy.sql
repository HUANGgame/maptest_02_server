-- Should Have: DQN navigation strategy records.
-- DQN is strategy optimization only. It does not replace Wi-Fi KNN positioning or A* routing.

CREATE TABLE IF NOT EXISTS dqn_training_runs (
    id VARCHAR(64) PRIMARY KEY,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    trainingEpisodes INT NOT NULL DEFAULT 0,
    averageReward DECIMAL(10,3),
    successRate DECIMAL(6,3),
    modelPath VARCHAR(500),
    trainedAt DATETIME NOT NULL,
    isActive BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dqn_runs_scope (mapId, floorId),
    INDEX idx_dqn_runs_active (mapId, floorId, isActive)
);

CREATE TABLE IF NOT EXISTS navigation_policy_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    currentX DECIMAL(10,2) NOT NULL,
    currentY DECIMAL(10,2) NOT NULL,
    targetX DECIMAL(10,2) NOT NULL,
    targetY DECIMAL(10,2) NOT NULL,
    isOffRoute BOOLEAN NOT NULL DEFAULT FALSE,
    obstacleNearby BOOLEAN NOT NULL DEFAULT FALSE,
    wifiConfidence INT NOT NULL DEFAULT 0,
    estimatedError DECIMAL(10,2),
    recommendedAction ENUM('continueNavigation', 'reroute', 'relocalize', 'guideBackToRoute', 'useElevator', 'useStairs') NOT NULL,
    accepted BOOLEAN,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_policy_logs_scope (mapId, floorId),
    INDEX idx_policy_logs_action (recommendedAction)
);
