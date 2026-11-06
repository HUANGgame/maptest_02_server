-- Should Have: 2D cross-floor transition points.

CREATE TABLE IF NOT EXISTS floor_transitions (
    id VARCHAR(64) PRIMARY KEY,
    mapId VARCHAR(64) NOT NULL,
    fromFloorId VARCHAR(64) NOT NULL,
    toFloorId VARCHAR(64) NOT NULL,
    fromNodeId VARCHAR(64) NOT NULL,
    toNodeId VARCHAR(64) NOT NULL,
    transitionType ENUM('elevator', 'stairs', 'escalator') NOT NULL,
    name VARCHAR(120) NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_floor_transitions_map (mapId),
    INDEX idx_floor_transitions_from (fromFloorId, fromNodeId),
    INDEX idx_floor_transitions_to (toFloorId, toNodeId)
);
