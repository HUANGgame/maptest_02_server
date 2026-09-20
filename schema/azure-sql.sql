IF OBJECT_ID(N'dbo.system_documents', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.system_documents (
    document_name NVARCHAR(160) NOT NULL PRIMARY KEY,
    body NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.wifi_scan_records', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.wifi_scan_records (
    record_key CHAR(64) NOT NULL PRIMARY KEY,
    source_id BIGINT NULL,
    sample_id NVARCHAR(100) NULL,
    point_id NVARCHAR(100) NOT NULL,
    map_id NVARCHAR(100) NOT NULL,
    floor_id NVARCHAR(100) NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    heading FLOAT NULL,
    ssid NVARCHAR(256) NULL,
    bssid NVARCHAR(64) NOT NULL,
    rssi INT NOT NULL,
    device_info NVARCHAR(320) NULL,
    source_mode NVARCHAR(80) NULL,
    data_priority NVARCHAR(40) NULL,
    session_id NVARCHAR(100) NULL,
    scan_freshness NVARCHAR(80) NULL,
    scanned_at DATETIME2(3) NULL,
    uploaded_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NULL
  );
  CREATE INDEX ix_wifi_scope ON dbo.wifi_scan_records(map_id, floor_id);
  CREATE INDEX ix_wifi_point ON dbo.wifi_scan_records(map_id, floor_id, point_id);
  CREATE INDEX ix_wifi_bssid ON dbo.wifi_scan_records(map_id, floor_id, bssid);
  CREATE INDEX ix_wifi_scanned_at ON dbo.wifi_scan_records(scanned_at);
END;
