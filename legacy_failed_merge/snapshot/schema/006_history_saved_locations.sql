-- Should Have: local/anonymous navigation history and saved locations.

CREATE TABLE IF NOT EXISTS navigation_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    userId VARCHAR(80) NOT NULL,
    mapId VARCHAR(64) NOT NULL,
    startPlaceId VARCHAR(64),
    destinationPlaceId VARCHAR(64),
    startX DECIMAL(10,2) NOT NULL,
    startY DECIMAL(10,2) NOT NULL,
    startFloorId VARCHAR(64) NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_navigation_history_user (userId),
    INDEX idx_navigation_history_scope (mapId, startFloorId)
);

CREATE TABLE IF NOT EXISTS saved_locations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    userId VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    x DECIMAL(10,2) NOT NULL,
    y DECIMAL(10,2) NOT NULL,
    type VARCHAR(40) NOT NULL DEFAULT 'custom',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_saved_locations_user (userId),
    INDEX idx_saved_locations_scope (mapId, floorId)
);
