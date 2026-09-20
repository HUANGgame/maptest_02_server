package com.example.wififingerprintcollector

data class WifiScanResultItem(
    val ssid: String,
    val bssid: String,
    val rssi: Int,
    val frequency: Int
)
