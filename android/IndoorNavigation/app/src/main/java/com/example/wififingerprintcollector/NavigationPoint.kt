package com.example.wififingerprintcollector

data class NavigationPoint(
    val pointId: String,
    val x: Float,
    val y: Float,
    val floor: Int,
    val mapId: String,
    val timestamp: Long
)
