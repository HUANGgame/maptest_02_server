package com.example.wififingerprintcollector

class FingerprintRepository(
    private val wifiDao: WifiScanDao,
    private val anchorDao: AnchorDao,
    private val mapDao: MapMetadataDao
) {
    suspend fun insertFingerprints(records: List<WifiFingerprintEntity>) {
        if (records.isNotEmpty()) wifiDao.insertAll(records)
    }

    suspend fun insertAnchors(anchors: List<WifiAnchorEntity>) {
        if (anchors.isNotEmpty()) anchorDao.insertAll(anchors)
    }

    suspend fun insertMapMetadata(items: List<MapMetadataEntity>) {
        if (items.isNotEmpty()) mapDao.insertAll(items)
    }

    suspend fun trainingFingerprints(): List<WifiFingerprintEntity> =
        wifiDao.getTrainingRecords()

    suspend fun mapMetadata(mapId: String): MapMetadataEntity? =
        mapDao.getByMapId(mapId)

    suspend fun firstMapMetadata(): MapMetadataEntity? =
        mapDao.getAll().firstOrNull()

    suspend fun fingerprintCount(): Int = wifiDao.getRecordCount()

    suspend fun pointCount(): Int = wifiDao.getPointCount()

    suspend fun navigationPoints(mapId: String, floor: Int): List<NavigationPoint> =
        stableNavigationPoints(wifiDao.getRecordsByMapAndFloor(mapId, floor), mapId, floor)

    suspend fun navigationPoints(mapIds: List<String>, floor: Int, displayMapId: String): List<NavigationPoint> =
        stableNavigationPoints(wifiDao.getRecordsByMapIdsAndFloor(mapIds.distinct(), floor), displayMapId, floor)

    suspend fun mapMetadataCount(): Int = mapDao.getCount()

    private fun stableNavigationPoints(records: List<WifiScanRecord>, displayMapId: String, floor: Int): List<NavigationPoint> {
        return records
            .groupBy { it.pointId }
            .mapNotNull { (pointId, rows) ->
                val locationRows = rows
                    .filter { it.x.isFinite() && it.y.isFinite() }
                    .groupBy { "${"%.1f".format(it.x)},${"%.1f".format(it.y)}" }
                    .maxByOrNull { it.value.size }
                    ?.value
                    ?: return@mapNotNull null
                NavigationPoint(
                    pointId = pointId,
                    x = locationRows.map { it.x }.average().toFloat(),
                    y = locationRows.map { it.y }.average().toFloat(),
                    floor = floor,
                    mapId = displayMapId,
                    timestamp = rows.minOf { it.timestamp }
                )
            }
            .sortedWith(compareBy<NavigationPoint> { it.timestamp }.thenBy { it.pointId })
    }
}
