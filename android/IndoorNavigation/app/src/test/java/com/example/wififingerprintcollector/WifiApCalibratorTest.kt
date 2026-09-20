package com.example.wififingerprintcollector

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.hypot
import kotlin.math.log10
import kotlin.math.roundToInt

class WifiApCalibratorTest {
    @Test
    fun estimatesKnownAccessPointFromDistributedFingerprintPoints() {
        val apX = 100f
        val apY = 80f
        val metersPerPixel = 0.125f
        val points = listOf(
            40f to 35f, 75f to 30f, 125f to 30f, 165f to 45f,
            45f to 95f, 80f to 125f, 130f to 120f, 170f to 95f
        )
        val records = points.flatMapIndexed { index, (x, y) ->
            val distanceMeters = hypot(x - apX, y - apY).coerceAtLeast(8f) * metersPerPixel
            val rssi = (-43f - 20f * log10(distanceMeters)).roundToInt()
            List(8) { repeat ->
                WifiScanRecord(
                    sampleId = "s-$index-$repeat",
                    pointId = "P$index",
                    x = x,
                    y = y,
                    floor = 1,
                    mapId = "test-map",
                    note = "",
                    sourceMode = "TEST",
                    moveDirection = "NONE",
                    intervalMeters = 1.5f,
                    azimuth = 0f,
                    ssid = "Test AP",
                    bssid = "aa:bb:cc:dd:ee:ff",
                    rssi = rssi,
                    frequency = 5180,
                    scanFreshness = "FRESH",
                    scanUpdated = true,
                    duplicateScore = 0f,
                    timestamp = repeat.toLong()
                )
            }
        }

        val estimate = WifiApCalibrator().estimate(records, metersPerPixel)

        assertNotNull(estimate)
        assertTrue(hypot(estimate!!.x - apX, estimate.y - apY) * metersPerPixel < 3.5f)
        assertTrue(estimate.pathLossExponent in 1.2f..3.2f)
        assertTrue(estimate.rmse < 3f)
    }
}
