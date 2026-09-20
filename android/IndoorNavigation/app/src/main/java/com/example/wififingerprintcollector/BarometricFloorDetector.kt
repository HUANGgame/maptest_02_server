package com.example.wififingerprintcollector

import kotlin.math.abs

/** Detects sustained vertical movement; positive means one floor up. */
class BarometricFloorDetector {
    private val pressureWindow = ArrayDeque<Float>()
    private var baselineHpa: Float? = null
    private var previousFilteredHpa: Float? = null
    private var previousTimestampMillis = 0L
    private var candidateDirection = 0
    private var candidateHits = 0
    private var lastSignalMillis = 0L
    private var disturbanceLockUntilMillis = 0L
    private var usingReference = false

    fun reset() {
        pressureWindow.clear()
        baselineHpa = null
        previousFilteredHpa = null
        previousTimestampMillis = 0L
        candidateDirection = 0
        candidateHits = 0
    }

    fun observe(
        pressureHpa: Float,
        timestampMillis: Long,
        movementEvidence: Boolean,
        referencePressureHpa: Float? = null
    ): Int {
        if (!pressureHpa.isFinite() || pressureHpa !in 850f..1100f) return 0
        if (referencePressureHpa != null && (!referencePressureHpa.isFinite() || referencePressureHpa !in 850f..1100f)) return 0
        val hasReference = referencePressureHpa != null
        if (hasReference != usingReference) {
            usingReference = hasReference
            reset()
        }
        val compensatedPressure = pressureHpa - (referencePressureHpa ?: 0f)
        pressureWindow.addLast(compensatedPressure)
        while (pressureWindow.size > 9) pressureWindow.removeFirst()
        val sorted = pressureWindow.sorted()
        val filtered = sorted[sorted.size / 2]
        val previous = previousFilteredHpa
        val elapsedSeconds = ((timestampMillis - previousTimestampMillis).coerceAtLeast(1L) / 1000f)
        previousFilteredHpa = filtered
        previousTimestampMillis = timestampMillis

        val suddenPressureChange = previous != null && abs(filtered - previous) / elapsedSeconds > 0.18f
        if (suddenPressureChange && !movementEvidence) {
            disturbanceLockUntilMillis = timestampMillis + 10_000L
            candidateDirection = 0
            candidateHits = 0
            return 0
        }
        val baseline = baselineHpa ?: filtered.also { baselineHpa = it }
        if (timestampMillis < disturbanceLockUntilMillis || !movementEvidence || pressureWindow.size < 7) {
            if (!movementEvidence && abs(filtered - baseline) < 0.12f) {
                baselineHpa = baseline * 0.998f + filtered * 0.002f
            }
            candidateDirection = 0
            candidateHits = 0
            return 0
        }

        val delta = filtered - baseline
        val direction = when {
            delta <= -0.28f -> 1
            delta >= 0.28f -> -1
            else -> 0
        }
        if (direction == 0) {
            candidateDirection = 0
            candidateHits = 0
            return 0
        }
        if (direction == candidateDirection) candidateHits++ else {
            candidateDirection = direction
            candidateHits = 1
        }
        if (candidateHits < 5 || timestampMillis - lastSignalMillis < 12_000L) return 0
        lastSignalMillis = timestampMillis
        candidateHits = 0
        return direction
    }
}
