package com.example.wififingerprintcollector

import kotlin.math.sqrt

class DataQualityAnalyzer {
    data class CleanupPlan(
        val rejectedBssids: Set<String>,
        val rejectedFreshnessLabels: Set<String>,
        val anchorIdsToDelete: Set<Long>,
        val rejectedApSummaries: List<String>,
        val anchorIssueSummaries: List<String>,
        val weakPointSummaries: List<String>
    ) {
        val hasDeletes: Boolean
            get() = rejectedBssids.isNotEmpty() || rejectedFreshnessLabels.isNotEmpty() || anchorIdsToDelete.isNotEmpty()
    }

    data class CleanupResult(
        val deletedWifiRows: Int,
        val deletedAnchors: Int,
        val rejectedApSummaries: List<String>,
        val anchorIssueSummaries: List<String>,
        val weakPointSummaries: List<String>
    )

    private data class ApStats(
        val bssid: String,
        val ssids: Set<String>,
        val sampleIds: Set<String>,
        val pointIds: Set<String>,
        val rssiValues: List<Int>,
        val scanFreshnessLabels: Set<String>
    ) {
        val sampleCount: Int = sampleIds.size
        val pointCount: Int = pointIds.size
        val rssiStdDev: Float = standardDeviation(rssiValues)
    }

    fun buildCleanupPlan(
        trainingRecords: List<WifiScanRecord>,
        anchors: List<AnchorRecord>,
        navigationPoints: List<NavigationPoint>,
        targetSamplesPerPoint: Int
    ): CleanupPlan {
        val records = trainingRecords.filter { it.bssid.isNotBlank() }
        val rejectedBssids = mutableSetOf<String>()
        val rejectedSummaries = mutableListOf<String>()

        records.groupBy { it.bssid.lowercase() }
            .map { (bssid, rows) ->
                ApStats(
                    bssid = bssid,
                    ssids = rows.map { it.ssid }.filter { it.isNotBlank() }.toSet(),
                    sampleIds = rows.map { it.sampleId }.filter { it.isNotBlank() }.toSet(),
                    pointIds = rows.map { it.pointId }.filter { it.isNotBlank() }.toSet(),
                    rssiValues = rows.map { it.rssi },
                    scanFreshnessLabels = rows.map { it.scanFreshness }.filter { it.isNotBlank() }.toSet()
                )
            }
            .forEach { stats ->
                val reasons = rejectedApReasons(stats)
                if (reasons.isNotEmpty()) {
                    rejectedBssids += stats.bssid
                    rejectedSummaries += "${stats.bssid}: ${reasons.joinToString(", ")}"
                }
            }

        val weakPoints = records
            .filter { it.bssid.lowercase() !in rejectedBssids }
            .groupBy { it.pointId }
            .mapNotNull { (pointId, rows) ->
                val sampleCount = rows.map { it.sampleId }.distinct().size
                val trustedApCount = rows.map { it.bssid.lowercase() }.distinct().size
                when {
                    sampleCount < targetSamplesPerPoint -> "$pointId: samples $sampleCount/$targetSamplesPerPoint"
                    trustedApCount < 3 -> "$pointId: trusted AP $trustedApCount"
                    else -> null
                }
            }

        val anchorIssueResult = analyzeAnchors(anchors, navigationPoints)
        return CleanupPlan(
            rejectedBssids = rejectedBssids,
            rejectedFreshnessLabels = setOf("POSSIBLE_DUPLICATE", "THROTTLED_PREVIOUS_RESULTS"),
            anchorIdsToDelete = anchorIssueResult.idsToDelete,
            rejectedApSummaries = rejectedSummaries.take(10),
            anchorIssueSummaries = anchorIssueResult.summaries.take(10),
            weakPointSummaries = weakPoints.take(10)
        )
    }

    private fun rejectedApReasons(stats: ApStats): List<String> {
        val reasons = mutableListOf<String>()
        if (stats.sampleCount < 3) reasons += "too few samples"
        if (stats.rssiStdDev > 18f) reasons += "RSSI std ${stats.rssiStdDev.format1()}dB"
        if (stats.pointCount <= 1 && stats.sampleCount < 5) reasons += "single-point AP"
        if (stats.ssids.any { looksLikeMobileHotspot(it) }) reasons += "mobile hotspot SSID"
        if (isLocallyAdministeredBssid(stats.bssid)) reasons += "locally administered BSSID"
        return reasons
    }

    private data class AnchorIssueResult(
        val idsToDelete: Set<Long>,
        val summaries: List<String>
    )

    private fun analyzeAnchors(
        anchors: List<AnchorRecord>,
        navigationPoints: List<NavigationPoint>
    ): AnchorIssueResult {
        val idsToDelete = mutableSetOf<Long>()
        val summaries = mutableListOf<String>()

        anchors.filter { it.transitionGroupId.isNotBlank() }
            .groupBy { it.transitionGroupId }
            .forEach { (groupId, groupAnchors) ->
                if (groupAnchors.size < 2) {
                    idsToDelete += groupAnchors.map { it.id }
                    summaries += "$groupId: transition group has only ${groupAnchors.size}"
                }
                val roles = groupAnchors.map { it.transitionRole.uppercase() }.toSet()
                if ("START_LINK" in roles && "CONTINUE_LINK" !in roles) {
                    idsToDelete += groupAnchors.map { it.id }
                    summaries += "$groupId: missing CONTINUE_LINK"
                }
            }

        anchors.forEach { anchor ->
            val needsTargetFloor = anchor.anchorType.uppercase() in setOf(
                "ELEVATOR",
                "STAIR",
                "STAIRS",
                "TRANSITION",
                "MAP_LINK"
            )
            if (needsTargetFloor && anchor.targetFloor == null) {
                idsToDelete += anchor.id
                summaries += "${anchor.anchorId}: missing target floor"
            }

            val nearestDistance = navigationPoints
                .filter { it.mapId == anchor.mapId && it.floor == anchor.floor }
                .minOfOrNull { point ->
                    val dx = point.x - anchor.x
                    val dy = point.y - anchor.y
                    sqrt(dx * dx + dy * dy)
                }
            if (nearestDistance != null && nearestDistance > 2.5f) {
                idsToDelete += anchor.id
                summaries += "${anchor.anchorId}: ${nearestDistance.format1()}m from nearest point"
            }
        }

        return AnchorIssueResult(idsToDelete = idsToDelete, summaries = summaries)
    }

    private fun looksLikeMobileHotspot(ssid: String): Boolean {
        val value = ssid.lowercase()
        return listOf(
            "iphone",
            "ipad",
            "android",
            "galaxy",
            "pixel",
            "hotspot",
            "mobile",
            "redmi",
            "oppo",
            "vivo",
            "realme",
            "huawei"
        ).any { value.contains(it) }
    }

    private fun isLocallyAdministeredBssid(bssid: String): Boolean {
        val firstOctet = bssid.split(":").firstOrNull()?.toIntOrNull(16) ?: return false
        return firstOctet and 0x02 != 0
    }

    private fun Float.format1(): String = String.format(java.util.Locale.US, "%.1f", this)

    private companion object {
        fun standardDeviation(values: List<Int>): Float {
            if (values.size < 2) return 0f
            val average = values.average()
            val variance = values.sumOf { value ->
                val diff = value - average
                diff * diff
            } / values.size.toDouble()
            return sqrt(variance).toFloat()
        }
    }
}
