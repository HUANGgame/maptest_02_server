-- Should Have: anonymous navigation feedback.
-- Raw user identity is not stored here. Only anonymous navigation state and Wi-Fi observations are accepted.

CREATE TABLE IF NOT EXISTS navigation_feedback_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    anonymousUserId VARCHAR(80) NOT NULL,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    estimatedX DECIMAL(10,2) NOT NULL,
    estimatedY DECIMAL(10,2) NOT NULL,
    currentRouteId VARCHAR(80),
    nearestRouteNodeId VARCHAR(64),
    heading DECIMAL(6,2),
    stepDelta DECIMAL(10,2),
    confidence INT NOT NULL DEFAULT 0,
    estimatedError DECIMAL(10,2),
    isOffRoute BOOLEAN NOT NULL DEFAULT FALSE,
    relocalizeCount INT NOT NULL DEFAULT 0,
    arrivedDestination BOOLEAN NOT NULL DEFAULT FALSE,
    deviceInfo VARCHAR(255),
    collectedAt DATETIME NOT NULL,
    qualityStatus ENUM('pending', 'highConfidence', 'lowConfidence', 'rejected') NOT NULL DEFAULT 'pending',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_feedback_scope (mapId, floorId),
    INDEX idx_feedback_quality (qualityStatus),
    INDEX idx_feedback_time (collectedAt)
);

CREATE TABLE IF NOT EXISTS navigation_feedback_wifi_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    feedbackRecordId BIGINT NOT NULL,
    ssid VARCHAR(160),
    bssid VARCHAR(32) NOT NULL,
    rssi INT NOT NULL,
    CONSTRAINT fk_feedback_wifi_record FOREIGN KEY (feedbackRecordId) REFERENCES navigation_feedback_records(id),
    INDEX idx_feedback_wifi_parent (feedbackRecordId),
    INDEX idx_feedback_wifi_bssid (bssid)
);
