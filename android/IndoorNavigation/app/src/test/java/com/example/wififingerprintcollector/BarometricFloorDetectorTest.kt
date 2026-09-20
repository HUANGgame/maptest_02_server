package com.example.wififingerprintcollector

import org.junit.Assert.assertEquals
import org.junit.Test

class BarometricFloorDetectorTest {
    @Test fun sustainedPressureDropWithMovementSignalsFloorUp() {
        val detector = BarometricFloorDetector()
        detector.observe(1010f, 0L, movementEvidence = true)
        var detected = 0
        repeat(40) { index ->
            val result = detector.observe(1007f, 1_000L + index * 500L, movementEvidence = true)
            if (result != 0) detected = result
        }
        assertEquals(1, detected)
    }

    @Test fun stationaryPressureSpikeIsIgnored() {
        val detector = BarometricFloorDetector()
        repeat(12) { index -> detector.observe(1010f, index * 500L, movementEvidence = false) }
        var detected = 0
        repeat(20) { index ->
            val result = detector.observe(1012f, 7_000L + index * 500L, movementEvidence = false)
            if (result != 0) detected = result
        }
        assertEquals(0, detected)
    }

    @Test fun referencePressureCancelsVenueWidePressureChange() {
        val detector = BarometricFloorDetector()
        var detected = 0
        repeat(30) { index ->
            val shift = index * 0.05f
            val result = detector.observe(
                pressureHpa = 1010f + shift,
                timestampMillis = index * 500L,
                movementEvidence = true,
                referencePressureHpa = 1000f + shift
            )
            if (result != 0) detected = result
        }
        assertEquals(0, detected)
    }

    @Test fun smallPressureNoiseDoesNotSignalFloorChange() {
        val detector = BarometricFloorDetector()
        var detected = 0
        repeat(40) { index ->
            val noise = if (index % 2 == 0) 0.05f else -0.05f
            val result = detector.observe(1010f + noise, index * 500L, movementEvidence = true)
            if (result != 0) detected = result
        }
        assertEquals(0, detected)
    }
}
