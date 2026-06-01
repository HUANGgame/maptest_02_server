-- Could Have: simple user reports. Keep it lightweight; no full merchant/admin workflow yet.

CREATE TABLE IF NOT EXISTS user_reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    userId VARCHAR(80) NOT NULL,
    mapId VARCHAR(64) NOT NULL,
    floorId VARCHAR(64) NOT NULL,
    x DECIMAL(10,2) NOT NULL,
    y DECIMAL(10,2) NOT NULL,
    reportType ENUM('blockedRoute', 'closedPlace', 'obstacle', 'wrongPlace') NOT NULL,
    description TEXT,
    status ENUM('pending', 'reviewed', 'resolved', 'rejected') NOT NULL DEFAULT 'pending',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_reports_scope (mapId, floorId),
    INDEX idx_user_reports_status (status)
);
