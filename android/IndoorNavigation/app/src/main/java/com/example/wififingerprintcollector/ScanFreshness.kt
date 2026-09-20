package com.example.wififingerprintcollector

data class ScanFreshness(
    val label: String,
    val updated: Boolean,
    val duplicateScore: Float
) {
    val isFresh: Boolean
        get() = updated && duplicateScore < 0.92f && label == FRESH

    companion object {
        const val FRESH = "FRESH"
        const val POSSIBLE_DUPLICATE = "POSSIBLE_DUPLICATE"
        const val THROTTLED_PREVIOUS_RESULTS = "THROTTLED_PREVIOUS_RESULTS"
        const val UNKNOWN = "UNKNOWN"
    }
}
