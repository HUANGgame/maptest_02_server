package com.example.wififingerprintcollector

import kotlin.math.abs

/** Detects sustained vertical movement; positive means one floor up. */
class BarometricFloorDetector {
    private var baselineHpa: Float? = null
    private var filteredHpa: Float? = null
    private var candidateDirection = 0
    private var candidateHits = 0
    private var lastSignalMillis = 0L

    fun reset(pressureHpa: Float? = filteredHpa) {
        baselineHpa = pressureHpa
        candidateDirection = 0
        candidateHits = 0
    }

    fun observe(pressureHpa: Float, timestampMillis: Long): Int {
        if (!pressureHpa.isFinite() || pressureHpa !in 850f..1100f) return 0
        val filtered = filteredHpa?.let { it * 0.88f + pressureHpa * 0.12f } ?: pressureHpa
        filteredHpa = filtered
        val baseline = baselineHpa ?: filtered.also { baselineHpa = it }
        val delta = filtered - baseline
        val direction = when {
            delta <= -0.24f -> 1
            delta >= 0.24f -> -1
            else -> 0
        }
        if (direction == 0) {
            candidateDirection = 0
            candidateHits = 0
            if (abs(delta) < 0.10f) baselineHpa = baseline * 0.995f + filtered * 0.005f
            return 0
        }
        if (direction == candidateDirection) candidateHits++ else {
            candidateDirection = direction
            candidateHits = 1
        }
        if (candidateHits < 6 || timestampMillis - lastSignalMillis < 12_000L) return 0
        lastSignalMillis = timestampMillis
        candidateHits = 0
        return direction
    }
}
