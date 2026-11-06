-- Conservative demo seed for phase 1.
-- The official topic remains "地下街室內導航系統"; this campus data is only the first demo venue.

INSERT INTO maps (id, name, description)
VALUES
    ('tkut-demo', '淡江大學淡水校園 Demo', '第一階段以校園模擬地下街找地點、找設施、找路線與回到原位置等情境。')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description);

INSERT INTO floors (id, mapId, floorName, floorLevel, imageUrl, width, height, scaleValue)
VALUES
    ('tkut-demo-ground', 'tkut-demo', '校園平面', 1, NULL, 1200, 800, 1.0000)
ON DUPLICATE KEY UPDATE
    floorName = VALUES(floorName),
    floorLevel = VALUES(floorLevel),
    width = VALUES(width),
    height = VALUES(height),
    scaleValue = VALUES(scaleValue);

INSERT INTO places (id, mapId, floorId, name, category, x, y, description, searchable, businessStatus)
VALUES
    ('place-main-gate', 'tkut-demo', 'tkut-demo-ground', '校門口', '入口', 120, 680, 'Demo 入口與集合點。', TRUE, 'unset'),
    ('place-library', 'tkut-demo', 'tkut-demo-ground', '圖書館', '設施', 520, 330, '可作為大型地標與目的地。', TRUE, 'unset'),
    ('place-engineering', 'tkut-demo', 'tkut-demo-ground', '工學大樓', '建築', 790, 360, 'Demo 建築目的地。', TRUE, 'unset'),
    ('place-restroom-a', 'tkut-demo', 'tkut-demo-ground', '公共廁所 A', '廁所', 430, 420, '模擬地下街設施搜尋。', TRUE, 'unset'),
    ('place-parking-a', 'tkut-demo', 'tkut-demo-ground', '停車區 A', '停車場', 250, 570, '模擬找停車位與回到停車位置。', TRUE, 'unset'),
    ('place-service-desk', 'tkut-demo', 'tkut-demo-ground', '服務台', '服務台', 610, 500, '模擬地下街服務設施。', TRUE, 'unset')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    category = VALUES(category),
    x = VALUES(x),
    y = VALUES(y),
    description = VALUES(description),
    searchable = VALUES(searchable),
    businessStatus = VALUES(businessStatus);

INSERT INTO route_nodes (id, mapId, floorId, x, y, nodeType, isWalkable)
VALUES
    ('node-main-gate', 'tkut-demo', 'tkut-demo-ground', 120, 680, 'entrance', TRUE),
    ('node-parking-a', 'tkut-demo', 'tkut-demo-ground', 250, 570, 'walkway', TRUE),
    ('node-cross-a', 'tkut-demo', 'tkut-demo-ground', 390, 500, 'walkway', TRUE),
    ('node-restroom-a', 'tkut-demo', 'tkut-demo-ground', 430, 420, 'facility', TRUE),
    ('node-service-desk', 'tkut-demo', 'tkut-demo-ground', 610, 500, 'facility', TRUE),
    ('node-library', 'tkut-demo', 'tkut-demo-ground', 520, 330, 'building', TRUE),
    ('node-engineering', 'tkut-demo', 'tkut-demo-ground', 790, 360, 'building', TRUE)
ON DUPLICATE KEY UPDATE
    x = VALUES(x),
    y = VALUES(y),
    nodeType = VALUES(nodeType),
    isWalkable = VALUES(isWalkable);

INSERT INTO route_edges (id, mapId, floorId, fromNodeId, toNodeId, distance, isBlocked)
VALUES
    ('edge-main-parking', 'tkut-demo', 'tkut-demo-ground', 'node-main-gate', 'node-parking-a', 170.00, FALSE),
    ('edge-parking-cross', 'tkut-demo', 'tkut-demo-ground', 'node-parking-a', 'node-cross-a', 170.00, FALSE),
    ('edge-cross-restroom', 'tkut-demo', 'tkut-demo-ground', 'node-cross-a', 'node-restroom-a', 90.00, FALSE),
    ('edge-cross-service', 'tkut-demo', 'tkut-demo-ground', 'node-cross-a', 'node-service-desk', 220.00, FALSE),
    ('edge-restroom-library', 'tkut-demo', 'tkut-demo-ground', 'node-restroom-a', 'node-library', 130.00, FALSE),
    ('edge-service-engineering', 'tkut-demo', 'tkut-demo-ground', 'node-service-desk', 'node-engineering', 230.00, FALSE),
    ('edge-library-engineering', 'tkut-demo', 'tkut-demo-ground', 'node-library', 'node-engineering', 280.00, FALSE)
ON DUPLICATE KEY UPDATE
    distance = VALUES(distance),
    isBlocked = VALUES(isBlocked);

INSERT INTO wifi_fingerprint_points (id, mapId, floorId, pointName, x, y, heading)
VALUES
    ('wifi-point-main-gate', 'tkut-demo', 'tkut-demo-ground', '校門口採樣點', 120, 680, 0),
    ('wifi-point-cross-a', 'tkut-demo', 'tkut-demo-ground', '主要通道採樣點', 390, 500, 0),
    ('wifi-point-library', 'tkut-demo', 'tkut-demo-ground', '圖書館採樣點', 520, 330, 0)
ON DUPLICATE KEY UPDATE
    pointName = VALUES(pointName),
    x = VALUES(x),
    y = VALUES(y),
    heading = VALUES(heading);
