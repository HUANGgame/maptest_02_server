package com.example.wififingerprintcollector

import kotlin.math.sqrt
import kotlin.math.ln

class FingerprintPositioningEngine {
    data class PositionResult(
        val pointId: String,
        val x: Float,
        val y: Float,
        val floor: Int,
        val mapId: String,
        val confidence: Int,
        val qualityLabel: String,
        val neighborText: String,
        val stable: Boolean
    )

    private data class Neighbor(
        val pointId: String,
        val x: Float,
        val y: Float,
        val floor: Int,
        val mapId: String,
        val distance: Float,
        val score: Float,
        val commonApCount: Int,
        val coverage: Float,
        val sampleCount: Int,
        val stableApCount: Int,
        val stabilityScore: Float,
        val repeatBoost: Float
    )

    private data class PointProfile(
        val pointId: String,
        val x: Float,
        val y: Float,
        val floor: Int,
        val mapId: String,
        val vector: Map<String, Float>,
        val sampleCount: Int,
        val stableApCount: Int,
        val stabilityScore: Float,
        val repeatBoost: Float
    )

    fun locate(
        currentResults: List<WifiScanResultItem>,
        trainingRecords: List<WifiFingerprintEntity>,
        k: Int = 3,
        restrictMapId: String? = null,
        restrictMapIds: Set<String>? = null,
        restrictFloor: Int? = null
    ): PositionResult? {
        val currentVector = currentResults
            .filter { it.bssid.isNotBlank() }
            .associate { it.bssid to it.rssi }
        if (currentVector.size < 2) return null

        val profiles = buildPointProfiles(
            trainingRecords
            .filter { it.dataSplit.equals("TRAIN", ignoreCase = true) || it.dataSplit.isBlank() }
            .filter {
                val scopedMapIds = restrictMapIds?.filter { mapId -> mapId.isNotBlank() }?.toSet().orEmpty()
                when {
                    scopedMapIds.isNotEmpty() -> it.mapId in scopedMapIds
                    !restrictMapId.isNullOrBlank() -> it.mapId == restrictMapId
                    else -> true
                }
            }
            .filter { restrictFloor == null || it.floor == restrictFloor }
        )

        val neighbors = profiles
            .mapNotNull { profile ->
                val commonApCount = currentVector.keys.intersect(profile.vector.keys).size
                if (commonApCount == 0) return@mapNotNull null
                val coverage = commonApCount.toFloat() / currentVector.size.coerceAtLeast(1)
                val distance = rssiVectorDistance(currentVector, profile.vector)
                val score = (
                    distance +
                        (1f - coverage) * 22f -
                        commonApCount.coerceAtMost(10) * 0.9f -
                        profile.stabilityScore * 8f -
                        profile.repeatBoost * 0.7f
                    ).coerceAtLeast(0.1f)
                Neighbor(
                    pointId = profile.pointId,
                    x = profile.x,
                    y = profile.y,
                    floor = profile.floor,
                    mapId = profile.mapId,
                    distance = distance,
                    score = score,
                    commonApCount = commonApCount,
                    coverage = coverage,
                    sampleCount = profile.sampleCount,
                    stableApCount = profile.stableApCount,
                    stabilityScore = profile.stabilityScore,
                    repeatBoost = profile.repeatBoost
                )
            }
            .filter { it.commonApCount >= 2 || it.coverage >= 0.18f }
            .sortedBy { it.score }
            .take(maxOf(k, 5))

        if (neighbors.isEmpty()) return null

        val weights = neighbors.map { 1f / (maxOf(it.score, 0.001f) * maxOf(it.score, 0.001f)) }
        val weightSum = weights.sum().coerceAtLeast(0.001f)
        val predX = neighbors.zip(weights).sumOf { (neighbor, weight) ->
            (neighbor.x * weight).toDouble()
        }.toFloat() / weightSum
        val predY = neighbors.zip(weights).sumOf { (neighbor, weight) ->
            (neighbor.y * weight).toDouble()
        }.toFloat() / weightSum
        val votedPoint = neighbors
            .groupBy { it.pointId }
            .maxByOrNull { entry -> entry.value.sumOf { (1f / maxOf(it.score, 0.001f)).toDouble() } }
            ?.value
            ?.first()
            ?: neighbors.first()
        val best = neighbors.first()
        val second = neighbors.getOrNull(1)
        val avgCommonAp = neighbors.map { it.commonApCount }.average().toFloat()
        val marginBonus = ((second?.score ?: (best.score + 12f)) - best.score).coerceIn(0f, 18f)
        val spreadPenalty = neighborSpread(neighbors, predX, predY).coerceIn(0f, 35f)
        val confidence = (
            28f +
                avgCommonAp.coerceAtMost(12f) * 3.5f +
                best.coverage * 24f +
                marginBonus +
                best.repeatBoost * 1.8f +
                best.stabilityScore * 18f -
                best.distance.coerceIn(0f, 65f) * 0.72f -
                spreadPenalty * 0.6f
            ).toInt().coerceIn(0, 100)
        val qualityLabel = when {
            confidence >= 70 && best.commonApCount >= 3 && best.stableApCount >= 3 -> "\u7a69\u5b9a"
            confidence >= 45 && best.commonApCount >= 2 -> "\u666e\u901a"
            else -> "\u4e0d\u7a69"
        }
        return PositionResult(
            pointId = votedPoint.pointId,
            x = predX,
            y = predY,
            floor = votedPoint.floor,
            mapId = votedPoint.mapId,
            confidence = confidence,
            qualityLabel = qualityLabel,
            neighborText = neighbors.joinToString(" / ") {
                "${it.pointId}:${it.distance.format1()}(${it.commonApCount}AP)"
            },
            stable = qualityLabel != "\u4e0d\u7a69"
        )
    }

    private fun buildPointProfiles(records: List<WifiFingerprintEntity>): List<PointProfile> {
        return records
            .filter { it.pointId.isNotBlank() && it.bssid.isNotBlank() }
            .groupBy { "${it.mapId}|${it.floor}|${it.pointId}" }
            .mapNotNull { (_, rows) ->
                val first = rows.firstOrNull() ?: return@mapNotNull null
                val samples = rows.map { it.sampleId }.filter { it.isNotBlank() }.toSet()
                val bssidGroups = rows.groupBy { it.bssid }
                val stableEntries = bssidGroups.mapNotNull { (bssid, apRows) ->
                    val values = apRows.map { it.rssi }
                    if (values.size < 2 && samples.size >= 6) return@mapNotNull null
                    val std = populationStd(values)
                    if (std > 16f && apRows.size < 8) return@mapNotNull null
                    bssid to values.average().toFloat()
                }
                val vector = stableEntries.toMap()
                if (vector.size < 2) return@mapNotNull null
                val stableApCount = bssidGroups.values.count { apRows ->
                    apRows.size >= 3 && populationStd(apRows.map { it.rssi }) <= 10f
                }
                val stableRatio = stableApCount.toFloat() / bssidGroups.size.coerceAtLeast(1)
                val repeatBoost = ln(samples.size.coerceAtLeast(1).toDouble()).toFloat().coerceIn(0f, 3.2f)
                PointProfile(
                    pointId = first.pointId,
                    x = rows.map { it.x }.average().toFloat(),
                    y = rows.map { it.y }.average().toFloat(),
                    floor = first.floor,
                    mapId = first.mapId,
                    vector = vector,
                    sampleCount = samples.size,
                    stableApCount = stableApCount,
                    stabilityScore = stableRatio.coerceIn(0f, 1f),
                    repeatBoost = repeatBoost
                )
            }
    }

    private fun rssiVectorDistance(current: Map<String, Int>, stored: Map<String, Float>): Float {
        val allBssids = current.keys + stored.keys
        val sumSquares = allBssids.sumOf { bssid ->
            val diff = (current[bssid]?.toFloat() ?: -100f) - (stored[bssid] ?: -100f)
            (diff * diff).toDouble()
        }
        return sqrt(sumSquares / allBssids.size.coerceAtLeast(1)).toFloat()
    }

    private fun neighborSpread(neighbors: List<Neighbor>, x: Float, y: Float): Float {
        if (neighbors.isEmpty()) return 0f
        return neighbors.map { neighbor ->
            sqrt((neighbor.x - x) * (neighbor.x - x) + (neighbor.y - y) * (neighbor.y - y))
        }.average().toFloat()
    }

    private fun populationStd(values: List<Int>): Float {
        if (values.size < 2) return 0f
        val avg = values.average()
        val variance = values.sumOf { value ->
            val diff = value - avg
            diff * diff
        } / values.size
        return sqrt(variance).toFloat()
    }

    private fun Float.format1(): String = String.format(java.util.Locale.US, "%.1f", this)
}
