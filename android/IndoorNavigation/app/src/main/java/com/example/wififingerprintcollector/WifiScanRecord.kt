package com.example.wififingerprintcollector

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "wifi_scan_records")
data class WifiScanRecord(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0L,
    val sampleId: String,
    val pointId: String,
    val x: Float,
    val y: Float,
    val floor: Int,
    val mapId: String = "",
    val sessionId: String = "",
    val dataSplit: String = "TRAIN",
    val deviceModel: String = "",
    val androidVersion: String = "",
    val appVersion: String = "",
    val note: String,
    val sourceMode: String,
    val moveDirection: String,
    val intervalMeters: Float,
    val azimuth: Float,
    val ssid: String,
    val bssid: String,
    val rssi: Int,
    val frequency: Int,
    val scanFreshness: String,
    val scanUpdated: Boolean,
    val duplicateScore: Float,
    val timestamp: Long,
    val uploadedAt: Long? = null
)
