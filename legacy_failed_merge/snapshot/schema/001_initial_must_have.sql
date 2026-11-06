-- Underground indoor navigation system - phase 1 Must Have schema.
-- Demo venue: Tamkang University Tamsui Campus.
-- This schema is MySQL 8 compatible and keeps every core record scoped by mapId/floorId.

CREATE TABLE IF NOT EXISTS maps (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS floors (
    id VARCHAR(64) PRIMARY KEY,
    mapId VARCHAR(64) NOT NULL,
    floorName VARCHAR(80) NOT NULL,
    floorLevel INT NOT NULL,
    imageUrl VARCHAR(500),
    width DECIMAL(10,2) NOT NULL DEFAULT 0,
    height DECIMAL(10,2) NOT NULL DEFAULT 0,
    scaleValue DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_floors_map FOREIGN KEY (mapId) REFERENCES maps(id),
    INDEX idx_floors_map (mapId),
    INDEX idx_floors_map_level (mapId, floorLevel)
);

CREATE TABLE IF NOT EXISTS places (
    id VARCHAR(64) PRIMARY KEY,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(80) NOT NULL,
    x DECIMAL(10,2) NOT NULL,
    y DECIMAL(10,2) NOT NULL,
    description TEXT,
    searchable BOOLEAN NOT NULL DEFAULT TRUE,
    businessStatus ENUM('open', 'closed', 'suspended', 'unset') NOT NULL DEFAULT 'unset',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_places_map FOREIGN KEY (mapId) REFERENCES maps(id),
    CONSTRAINT fk_places_floor FOREIGN KEY (floorId) REFERENCES floors(id),
    INDEX idx_places_map_floor (mapId, floorId),
    INDEX idx_places_search (mapId, floorId, searchable),
    FULLTEXT INDEX ftx_places_keyword (name, category, description)
);

CREATE TABLE IF NOT EXISTS route_nodes (
    id VARCHAR(64) PRIMARY KEY,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    x DECIMAL(10,2) NOT NULL,
    y DECIMAL(10,2) NOT NULL,
    nodeType VARCHAR(40) NOT NULL DEFAULT 'walkway',
    isWalkable BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_route_nodes_map FOREIGN KEY (mapId) REFERENCES maps(id),
    CONSTRAINT fk_route_nodes_floor FOREIGN KEY (floorId) REFERENCES floors(id),
    INDEX idx_route_nodes_map_floor (mapId, floorId),
    INDEX idx_route_nodes_walkable (mapId, floorId, isWalkable)
);

CREATE TABLE IF NOT EXISTS route_edges (
    id VARCHAR(64) PRIMARY KEY,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    fromNodeId VARCHAR(64) NOT NULL,
    toNodeId VARCHAR(64) NOT NULL,
    distance DECIMAL(10,2) NOT NULL,
    isBlocked BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_route_edges_map FOREIGN KEY (mapId) REFERENCES maps(id),
    CONSTRAINT fk_route_edges_floor FOREIGN KEY (floorId) REFERENCES floors(id),
    CONSTRAINT fk_route_edges_from_node FOREIGN KEY (fromNodeId) REFERENCES route_nodes(id),
    CONSTRAINT fk_route_edges_to_node FOREIGN KEY (toNodeId) REFERENCES route_nodes(id),
    INDEX idx_route_edges_map_floor (mapId, floorId),
    INDEX idx_route_edges_from (fromNodeId),
    INDEX idx_route_edges_to (toNodeId),
    INDEX idx_route_edges_blocked (mapId, floorId, isBlocked)
);

CREATE TABLE IF NOT EXISTS wifi_fingerprint_points (
    id VARCHAR(64) PRIMARY KEY,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    pointName VARCHAR(120) NOT NULL,
    x DECIMAL(10,2) NOT NULL,
    y DECIMAL(10,2) NOT NULL,
    heading DECIMAL(6,2),
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_wifi_points_map FOREIGN KEY (mapId) REFERENCES maps(id),
    CONSTRAINT fk_wifi_points_floor FOREIGN KEY (floorId) REFERENCES floors(id),
    INDEX idx_wifi_points_map_floor (mapId, floorId)
);

CREATE TABLE IF NOT EXISTS wifi_scan_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pointId VARCHAR(64) NOT NULL,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    x DECIMAL(10,2) NOT NULL,
    y DECIMAL(10,2) NOT NULL,
    heading DECIMAL(6,2),
    ssid VARCHAR(160),
    bssid VARCHAR(32) NOT NULL,
    rssi INT NOT NULL,
    deviceInfo VARCHAR(255),
    scannedAt DATETIME NOT NULL,
    uploadedAt DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wifi_scans_point FOREIGN KEY (pointId) REFERENCES wifi_fingerprint_points(id),
    CONSTRAINT fk_wifi_scans_map FOREIGN KEY (mapId) REFERENCES maps(id),
    CONSTRAINT fk_wifi_scans_floor FOREIGN KEY (floorId) REFERENCES floors(id),
    INDEX idx_wifi_scans_point (pointId),
    INDEX idx_wifi_scans_map_floor (mapId, floorId),
    INDEX idx_wifi_scans_bssid (mapId, floorId, bssid),
    INDEX idx_wifi_scans_time (scannedAt)
);

CREATE TABLE IF NOT EXISTS model_versions (
    id VARCHAR(64) PRIMARY KEY,
    versionName VARCHAR(120) NOT NULL,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    algorithm ENUM('knn', 'randomForest', 'simpleNeuralNetwork') NOT NULL,
    trainingDataCount INT NOT NULL DEFAULT 0,
    averageError DECIMAL(10,3),
    modelPath VARCHAR(500),
    trainedAt DATETIME,
    isActive BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_model_versions_map FOREIGN KEY (mapId) REFERENCES maps(id),
    CONSTRAINT fk_model_versions_floor FOREIGN KEY (floorId) REFERENCES floors(id),
    INDEX idx_model_versions_scope (mapId, floorId, algorithm),
    INDEX idx_model_versions_active (mapId, floorId, isActive)
);
