package com.example.wififingerprintcollector

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface WifiScanDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAll(records: List<WifiScanRecord>)

    @Query("SELECT * FROM wifi_scan_records ORDER BY timestamp ASC, id ASC")
    suspend fun getAllRecords(): List<WifiScanRecord>

    @Query("SELECT * FROM wifi_scan_records WHERE dataSplit = 'TRAIN' OR dataSplit = '' ORDER BY timestamp ASC, id ASC")
    suspend fun getTrainingRecords(): List<WifiScanRecord>

    @Query("SELECT * FROM wifi_scan_records WHERE uploadedAt IS NULL ORDER BY timestamp ASC, id ASC")
    suspend fun getPendingUploadRecords(): List<WifiScanRecord>

    @Query("SELECT COUNT(*) FROM wifi_scan_records")
    suspend fun getRecordCount(): Int

    @Query("SELECT COUNT(*) FROM wifi_scan_records WHERE mapId = :mapId AND floor = :floor")
    suspend fun getRecordCountByMapAndFloor(mapId: String, floor: Int): Int

    @Query("SELECT COUNT(DISTINCT pointId) FROM wifi_scan_records")
    suspend fun getPointCount(): Int

    @Query(
        """
        SELECT pointId, AVG(x) AS x, AVG(y) AS y, floor, mapId, MIN(timestamp) AS timestamp
        FROM wifi_scan_records
        WHERE mapId = :mapId AND floor = :floor
        GROUP BY pointId, floor, mapId
        ORDER BY timestamp ASC, pointId ASC
        """
    )
    suspend fun getNavigationPoints(mapId: String, floor: Int): List<NavigationPoint>

    @Query("DELETE FROM wifi_scan_records")
    suspend fun deleteAll()

    @Query("SELECT * FROM wifi_scan_records WHERE pointId = :pointId ORDER BY timestamp ASC, id ASC")
    suspend fun getRecordsByPoint(pointId: String): List<WifiScanRecord>

    @Query("SELECT * FROM wifi_scan_records WHERE mapId = :mapId AND floor = :floor ORDER BY timestamp ASC, id ASC")
    suspend fun getRecordsByMapAndFloor(mapId: String, floor: Int): List<WifiScanRecord>

    @Query("SELECT * FROM wifi_scan_records WHERE mapId IN (:mapIds) AND floor = :floor ORDER BY timestamp ASC, id ASC")
    suspend fun getRecordsByMapIdsAndFloor(mapIds: List<String>, floor: Int): List<WifiScanRecord>

    @Query("SELECT COUNT(DISTINCT sampleId) FROM wifi_scan_records WHERE pointId = :pointId")
    suspend fun getSampleCountByPoint(pointId: String): Int

    @Query("SELECT COUNT(DISTINCT sampleId) FROM wifi_scan_records WHERE pointId = :pointId AND mapId IN (:mapIds) AND floor = :floor")
    suspend fun getSampleCountByPointScope(pointId: String, mapIds: List<String>, floor: Int): Int

    @Query("DELETE FROM wifi_scan_records WHERE LOWER(bssid) IN (:bssids)")
    suspend fun deleteRecordsByBssids(bssids: List<String>): Int

    @Query("DELETE FROM wifi_scan_records WHERE scanFreshness IN (:labels)")
    suspend fun deleteRecordsByFreshness(labels: List<String>): Int

    @Query("UPDATE wifi_scan_records SET mapId = :newMapId, uploadedAt = NULL WHERE mapId = :oldMapId AND floor = :floor")
    suspend fun reassignMapForFloor(oldMapId: String, newMapId: String, floor: Int): Int

    @Query("UPDATE wifi_scan_records SET mapId = :newMapId, floor = :newFloor, uploadedAt = NULL WHERE mapId = :oldMapId AND floor = :oldFloor")
    suspend fun reassignMapAndFloor(oldMapId: String, oldFloor: Int, newMapId: String, newFloor: Int): Int

    @Query(
        """
        UPDATE wifi_scan_records
        SET x = :x, y = :y, uploadedAt = NULL
        WHERE pointId = :pointId
          AND mapId IN (:mapIds)
          AND floor = :floor
        """
    )
    suspend fun updatePointCoordinates(pointId: String, mapIds: List<String>, floor: Int, x: Float, y: Float): Int

    @Query(
        """
        SELECT COUNT(*) FROM wifi_scan_records
        WHERE mapId = :mapId
          AND floor = :floor
          AND x BETWEEN :sourceMinX AND :sourceMaxX
          AND y BETWEEN :sourceMinY AND :sourceMaxY
        """
    )
    suspend fun countRecordsInCoordinateRange(
        mapId: String,
        floor: Int,
        sourceMinX: Float,
        sourceMaxX: Float,
        sourceMinY: Float,
        sourceMaxY: Float
    ): Int

    @Query(
        """
        SELECT COUNT(*) FROM wifi_scan_records
        WHERE mapId = :mapId
          AND floor = :floor
          AND (x > :minPixelX OR y > :minPixelY)
        """
    )
    suspend fun countPixelLikeRecords(mapId: String, floor: Int, minPixelX: Float, minPixelY: Float): Int

    @Query(
        """
        UPDATE wifi_scan_records
        SET x = ((x - :sourceMinX) * :scaleX) + :targetMinX,
            y = ((y - :sourceMinY) * :scaleY) + :targetMinY,
            uploadedAt = NULL
        WHERE mapId = :mapId
          AND floor = :floor
          AND x BETWEEN :sourceMinX AND :sourceMaxX
          AND y BETWEEN :sourceMinY AND :sourceMaxY
        """
    )
    suspend fun transformCoordinatesForFloor(
        mapId: String,
        floor: Int,
        sourceMinX: Float,
        sourceMaxX: Float,
        sourceMinY: Float,
        sourceMaxY: Float,
        scaleX: Float,
        scaleY: Float,
        targetMinX: Float,
        targetMinY: Float
    ): Int

    @Query("UPDATE wifi_scan_records SET uploadedAt = :uploadedAt WHERE id IN (:ids)")
    suspend fun markUploaded(ids: List<Long>, uploadedAt: Long): Int

    @Query("UPDATE wifi_scan_records SET uploadedAt = NULL")
    suspend fun resetAllUploadMarks(): Int
}
