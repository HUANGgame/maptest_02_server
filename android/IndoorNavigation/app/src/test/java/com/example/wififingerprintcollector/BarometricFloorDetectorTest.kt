package com.example.wififingerprintcollector

import org.junit.Assert.assertEquals
import org.junit.Test

class BarometricFloorDetectorTest {
    @Test fun sustainedPressureDropSignalsFloorUp() {
        val detector = BarometricFloorDetector()
        detector.observe(1010f, 0L)
        var detected = 0
        repeat(30) { index ->
            val result = detector.observe(1007f, 1_000L + index * 500L)
            if (result != 0) detected = result
        }
        assertEquals(1, detected)
    }

    @Test fun smallPressureNoiseDoesNotSignalFloorChange() {
        val detector = BarometricFloorDetector()
        var result = 0
        repeat(40) { index ->
            val noise = if (index % 2 == 0) 0.05f else -0.05f
            result = detector.observe(1010f + noise, index * 500L)
        }
        assertEquals(0, result)
    }
}
