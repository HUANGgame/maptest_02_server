package com.example.wififingerprintcollector

data class SamplingPoint(
    val pointId: String,
    val x: Float,
    val y: Float,
    val floor: Int,
    val note: String,
    val sourceMode: String,
    val moveDirection: String,
    val intervalMeters: Float,
    val azimuth: Float,
    val isStart: Boolean = false,
    val sampled: Boolean = false,
    val displayLabel: String = pointId,
    val backendNodeId: String = ""
)
