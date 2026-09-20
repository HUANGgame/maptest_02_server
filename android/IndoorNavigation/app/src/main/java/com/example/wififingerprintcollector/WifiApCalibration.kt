package com.example.wififingerprintcollector

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "wifi_ap_calibrations")
data class WifiApCalibration(
    @PrimaryKey
    val calibrationId: String,
    val bssid: String,
    val ssid: String,
    val mapId: String,
    val floor: Int,
    val x: Float,
    val y: Float,
    val referenceRssi: Float,
    val pathLossExponent: Float,
    val rmse: Float,
    val samplePointCount: Int,
    val observationCount: Int,
    val suggestedPointId: String,
    val status: String,
    val source: String,
    val updatedAt: Long
)

data class WifiApCandidate(
    val bssid: String,
    val ssid: String,
    val observationCount: Int,
    val samplePointCount: Int,
    val averageRssi: Float,
    val strongestRssi: Int
)
