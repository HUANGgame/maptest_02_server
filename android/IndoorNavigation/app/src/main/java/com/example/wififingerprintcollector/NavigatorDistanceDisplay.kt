package com.example.wififingerprintcollector

import kotlin.math.hypot

// Fixed 1F reference: the surveyed separation of the two shop points is 8.5 m.
// Display-only calibration; it must not transform stored coordinates or route geometry.
private val firstFloorMetersPerUnit = 8.5 / hypot(
    1154.5441960848293 - 1129.5403499309832,
    440.9769230769231 - 367.85960382314823
)

fun navigatorPixelDistanceToMeters(floorId: String, pixelDistance: Float): Float =
    (pixelDistance * firstFloorMetersPerUnit).toFloat()

fun navigatorRemainingDistance(points: List<DemoPoint>, rawDistance: Float): Float {
    if (rawDistance in 0.1f..300f) return rawDistance
    val routePixels = points.zipWithNext().sumOf { (from, to) ->
        hypot((from.x - to.x).toDouble(), (from.y - to.y).toDouble())
    }.toFloat()
    return navigatorPixelDistanceToMeters(points.firstOrNull()?.floorId.orEmpty(), routePixels)
        .coerceIn(0f, 300f)
}
