package com.example.wififingerprintcollector

import androidx.room.Entity
import androidx.room.Index
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
    val surveyPointCount: Int = 0,
    val uncertaintyMeters: Float = 0f,
    val suggestedPointId: String,
    val status: String,
    val source: String,
    val updatedAt: Long
)

@Entity(
    tableName = "wifi_ap_survey_measurements",
    indices = [Index(value = ["calibrationId"])]
)
data class WifiApSurveyMeasurement(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val calibrationId: String,
    val bssid: String,
    val mapId: String,
    val floor: Int,
    val x: Float,
    val y: Float,
    val rssi: Int,
    val measuredAt: Long
)

data class WifiApCandidate(
    val bssid: String,
    val ssid: String,
    val observationCount: Int,
    val samplePointCount: Int,
    val averageRssi: Float,
    val strongestRssi: Int
)
