package com.example.wififingerprintcollector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PositionFusionFilterTest {
    @Test fun pdrPredictionMovesStateBeforeWifiCorrection() {
        val filter = PositionFusionFilter()
        filter.update(100f, 100f, 80, 3f, 8f, 1_000L)
        filter.predictByMovement(8f, 0f, 1f, 8f)
        val result = filter.update(108f, 100f, 80, 3f, 8f, 2_500L)
        assertEquals(108f, result.x, 0.5f)
    }

    @Test fun lowConfidenceLargeJumpIsStronglyReduced() {
        val filter = PositionFusionFilter()
        filter.update(100f, 100f, 85, 2f, 8f, 1_000L)
        val result = filter.update(500f, 500f, 35, 20f, 8f, 2_500L)
        assertTrue(result.x < 210f)
        assertTrue(result.y < 210f)
    }
}
