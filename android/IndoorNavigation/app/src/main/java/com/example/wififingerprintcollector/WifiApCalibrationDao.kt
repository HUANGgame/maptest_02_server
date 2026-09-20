package com.example.wififingerprintcollector

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface WifiApCalibrationDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(calibration: WifiApCalibration)

    @Query("SELECT * FROM wifi_ap_calibrations WHERE mapId = :mapId AND floor = :floor ORDER BY status DESC, rmse ASC")
    suspend fun getForScope(mapId: String, floor: Int): List<WifiApCalibration>

    @Query("SELECT * FROM wifi_ap_calibrations ORDER BY mapId, floor, status DESC, rmse ASC")
    suspend fun getAll(): List<WifiApCalibration>

    @Query(
        """
        SELECT LOWER(bssid) AS bssid,
               MAX(ssid) AS ssid,
               COUNT(*) AS observationCount,
               COUNT(DISTINCT pointId) AS samplePointCount,
               AVG(CAST(rssi AS REAL)) AS averageRssi,
               MAX(rssi) AS strongestRssi
        FROM wifi_scan_records
        WHERE mapId = :mapId AND floor = :floor AND bssid <> ''
        GROUP BY LOWER(bssid)
        HAVING COUNT(DISTINCT pointId) >= :minimumPoints
           AND COUNT(*) >= :minimumObservations
           AND MAX(rssi) >= -72
        ORDER BY samplePointCount DESC, observationCount DESC, strongestRssi DESC
        LIMIT :limit
        """
    )
    suspend fun getCandidates(
        mapId: String,
        floor: Int,
        minimumPoints: Int = 6,
        minimumObservations: Int = 24,
        limit: Int = 12
    ): List<WifiApCandidate>

    @Query("SELECT * FROM wifi_scan_records WHERE mapId = :mapId AND floor = :floor AND LOWER(bssid) = LOWER(:bssid) ORDER BY timestamp")
    suspend fun getObservations(mapId: String, floor: Int, bssid: String): List<WifiScanRecord>
}
