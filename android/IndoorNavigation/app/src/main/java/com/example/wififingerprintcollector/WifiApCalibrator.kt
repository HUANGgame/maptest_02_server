package com.example.wififingerprintcollector

import kotlin.math.log10
import kotlin.math.max
import kotlin.math.sqrt

class WifiApCalibrator {
    data class Estimate(
        val x: Float,
        val y: Float,
        val referenceRssi: Float,
        val pathLossExponent: Float,
        val rmse: Float,
        val samplePointCount: Int,
        val observationCount: Int,
        val suggestedPointId: String
    )

    private data class PointSignal(
        val pointId: String,
        val x: Float,
        val y: Float,
        val meanRssi: Float,
        val count: Int
    )

    fun estimate(records: List<WifiScanRecord>, metersPerPixel: Float): Estimate? {
        val points = aggregate(records)
        if (points.size < 4 || metersPerPixel <= 0f) return null

        val minX = points.minOf { it.x }
        val maxX = points.maxOf { it.x }
        val minY = points.minOf { it.y }
        val maxY = points.maxOf { it.y }
        val padding = max(24f, 12f / metersPerPixel)
        var left = minX - padding
        var right = maxX + padding
        var top = minY - padding
        var bottom = maxY + padding
        var best: Estimate? = null

        repeat(3) { pass ->
            val divisions = if (pass == 0) 24 else 18
            val stepX = max(1f, (right - left) / divisions)
            val stepY = max(1f, (bottom - top) / divisions)
            var x = left
            while (x <= right + 0.001f) {
                var y = top
                while (y <= bottom + 0.001f) {
                    val fit = fitAt(points, x, y, metersPerPixel)
                    if (fit != null && (best == null || fit.rmse < best!!.rmse)) best = fit
                    y += stepY
                }
                x += stepX
            }
            val center = best ?: return null
            left = center.x - stepX * 2
            right = center.x + stepX * 2
            top = center.y - stepY * 2
            bottom = center.y + stepY * 2
        }
        return best
    }

    fun fitAtKnownPosition(
        records: List<WifiScanRecord>,
        x: Float,
        y: Float,
        metersPerPixel: Float
    ): Estimate? = fitAt(aggregate(records), x, y, metersPerPixel)

    private fun aggregate(records: List<WifiScanRecord>): List<PointSignal> = records
        .filter { it.rssi in -100..-15 }
        .groupBy { Triple(it.pointId, it.x, it.y) }
        .map { (key, rows) ->
            PointSignal(
                pointId = key.first,
                x = key.second,
                y = key.third,
                meanRssi = rows.map { it.rssi }.average().toFloat(),
                count = rows.size
            )
        }

    private fun fitAt(
        points: List<PointSignal>,
        x: Float,
        y: Float,
        metersPerPixel: Float
    ): Estimate? {
        if (points.size < 4) return null
        val values = points.map { point ->
            val distancePixels = sqrt((point.x - x) * (point.x - x) + (point.y - y) * (point.y - y))
            val distanceMeters = max(1f, distancePixels * metersPerPixel)
            Triple(log10(distanceMeters), point.meanRssi, point.count)
        }
        val totalWeight = values.sumOf { it.third.toDouble() }.coerceAtLeast(1.0)
        val meanLogDistance = values.sumOf { it.first.toDouble() * it.third } / totalWeight
        val meanRssi = values.sumOf { it.second.toDouble() * it.third } / totalWeight
        val variance = values.sumOf { (it.first - meanLogDistance) * (it.first - meanLogDistance) * it.third }
        if (variance < 0.0001) return null
        val covariance = values.sumOf { (it.first - meanLogDistance) * (it.second - meanRssi) * it.third }
        val slope = covariance / variance
        val exponent = (-slope / 10.0).toFloat().coerceIn(1.2f, 5.5f)
        val reference = (meanRssi + 10.0 * exponent * meanLogDistance).toFloat().coerceIn(-85f, -20f)
        val weightedSquaredError = values.sumOf {
            val predicted = reference.toDouble() - 10.0 * exponent.toDouble() * it.first
            val error = it.second.toDouble() - predicted
            error * error * it.third.toDouble()
        }
        val rmse = sqrt(weightedSquaredError / totalWeight).toFloat()
        val strongest = points.maxByOrNull { it.meanRssi } ?: return null
        return Estimate(
            x = x,
            y = y,
            referenceRssi = reference,
            pathLossExponent = exponent,
            rmse = rmse,
            samplePointCount = points.size,
            observationCount = points.sumOf { it.count },
            suggestedPointId = strongest.pointId
        )
    }
}
