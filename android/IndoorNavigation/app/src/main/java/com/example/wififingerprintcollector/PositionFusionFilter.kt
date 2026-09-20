package com.example.wififingerprintcollector

import kotlin.math.max

data class FusedPosition(val x: Float, val y: Float)

/** Combines short PDR movement with periodic Wi-Fi measurements. */
class PositionFusionFilter {
    private var initialized = false
    private var x = 0f
    private var y = 0f
    private var variance = 0f
    private var lastUpdateMillis = 0L

    fun reset() {
        initialized = false
        variance = 0f
        lastUpdateMillis = 0L
    }

    fun predictByMovement(deltaX: Float, deltaY: Float, distanceMeters: Float, pixelsPerMeter: Float) {
        if (!initialized) return
        x += deltaX
        y += deltaY
        val predictionErrorPixels = max(0.75f, distanceMeters * 0.45f) * pixelsPerMeter
        variance += predictionErrorPixels * predictionErrorPixels
    }

    fun update(
        measuredX: Float,
        measuredY: Float,
        confidence: Int,
        estimatedErrorMeters: Float,
        pixelsPerMeter: Float,
        timestampMillis: Long
    ): FusedPosition {
        if (!initialized) {
            initialized = true
            x = measuredX
            y = measuredY
            val initialError = max(2f, estimatedErrorMeters) * pixelsPerMeter
            variance = initialError * initialError
            lastUpdateMillis = timestampMillis
            return FusedPosition(x, y)
        }

        val elapsedSeconds = ((timestampMillis - lastUpdateMillis).coerceAtLeast(0L) / 1000f).coerceAtMost(10f)
        val processError = (0.65f + elapsedSeconds * 0.55f) * pixelsPerMeter
        variance += processError * processError

        val confidenceRatio = confidence.coerceIn(5, 95) / 100f
        val measurementError = max(1.5f, estimatedErrorMeters) * pixelsPerMeter
        var measurementVariance = measurementError * measurementError * (1.35f - confidenceRatio * 0.75f)
        val innovationX = measuredX - x
        val innovationY = measuredY - y
        val innovationSquared = innovationX * innovationX + innovationY * innovationY
        val gatePixels = max(6f * pixelsPerMeter, measurementError * 2.8f)
        val isImplausibleJump = innovationSquared > gatePixels * gatePixels && confidence < 85
        if (isImplausibleJump) measurementVariance *= 9f

        val rawGain = variance / (variance + measurementVariance.coerceAtLeast(1f))
        val gain = rawGain.coerceIn(if (isImplausibleJump) 0.03f else 0.08f, if (isImplausibleJump) 0.25f else 0.72f)
        x += innovationX * gain
        y += innovationY * gain
        variance = ((1f - gain) * variance).coerceAtLeast(1f)
        lastUpdateMillis = timestampMillis
        return FusedPosition(x, y)
    }
}
