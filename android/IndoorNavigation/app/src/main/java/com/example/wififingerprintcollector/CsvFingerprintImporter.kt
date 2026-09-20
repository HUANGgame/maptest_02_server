package com.example.wififingerprintcollector

import android.content.Context
import java.io.File
import java.io.InputStream

class CsvFingerprintImporter(
    private val context: Context,
    private val repository: FingerprintRepository
) {
    data class ImportReport(
        val foundAnyCsv: Boolean,
        val fingerprintRows: Int,
        val anchorRows: Int,
        val mapRows: Int,
        val message: String
    )

    suspend fun importIfAvailable(): ImportReport {
        val fingerprintSource = openCsv("wifi_fingerprint_records.csv")
        val anchorSource = openCsv("wifi_anchor_records.csv")
        val mapSource = openCsv("map_metadata.csv")
        if (fingerprintSource == null && anchorSource == null && mapSource == null) {
            return ImportReport(false, 0, 0, 0, "尚未找到 CSV")
        }

        var fingerprintRows = 0
        var anchorRows = 0
        var mapRows = 0
        try {
            fingerprintSource?.use { source ->
                val rows = parseCsv(source).requireColumns(
                    "sampleId", "pointId", "x", "y", "floor", "mapId",
                    "sessionId", "dataSplit", "deviceModel", "androidVersion", "appVersion",
                    "note", "sourceMode", "moveDirection", "intervalMeters", "azimuth",
                    "ssid", "bssid", "rssi", "frequency", "scanFreshness", "scanUpdated",
                    "duplicateScore", "timestamp"
                )
                val records = rows.mapNotNull { row -> row.toWifiRecordOrNull() }
                repository.insertFingerprints(records)
                fingerprintRows = records.size
            }

            anchorSource?.use { source ->
                val rows = parseCsv(source).requireColumns(
                    "anchorId", "pointId", "x", "y", "floor", "mapId",
                    "anchorType", "note", "transitionGroupId", "transitionRole",
                    "targetFloor", "timestamp"
                )
                val anchors = rows.mapNotNull { row -> row.toAnchorOrNull() }
                repository.insertAnchors(anchors)
                anchorRows = anchors.size
            }

            mapSource?.use { source ->
                val rows = parseCsv(source).requireColumns(
                    "mapId", "mapMode", "exportedMapFile", "metersPerPixel",
                    "coordinateUnit", "calibrated", "mapHeadingOffsetDegrees"
                )
                val metadata = rows.mapNotNull { row -> row.toMapMetadataOrNull() }
                repository.insertMapMetadata(metadata)
                mapRows = metadata.size
            }
        } catch (exception: Exception) {
            return ImportReport(true, fingerprintRows, anchorRows, mapRows, "CSV 匯入失敗：${exception.message}")
        }

        return ImportReport(
            foundAnyCsv = true,
            fingerprintRows = fingerprintRows,
            anchorRows = anchorRows,
            mapRows = mapRows,
            message = "CSV 匯入完成：Wi-Fi $fingerprintRows 筆，錨點 $anchorRows 筆，地圖 $mapRows 筆"
        )
    }

    private fun openCsv(fileName: String): InputStream? {
        runCatching { return context.assets.open(fileName) }
        val candidates = listOfNotNull(
            File(context.filesDir, fileName),
            context.getExternalFilesDir(null)?.let { File(it, fileName) }
        )
        return candidates.firstOrNull { it.exists() && it.isFile }?.inputStream()
    }

    private fun parseCsv(inputStream: InputStream): CsvRows {
        val lines = inputStream.bufferedReader(Charsets.UTF_8).readLines()
            .filter { it.isNotBlank() }
        if (lines.isEmpty()) return CsvRows(emptyList(), emptyList())
        val header = parseCsvLine(lines.first()).map { it.trim() }
        val rows = lines.drop(1).map { line ->
            val values = parseCsvLine(line)
            header.mapIndexed { index, column -> column to values.getOrElse(index) { "" } }.toMap()
        }
        return CsvRows(header, rows)
    }

    private fun parseCsvLine(line: String): List<String> {
        val result = mutableListOf<String>()
        val current = StringBuilder()
        var inQuotes = false
        var index = 0
        while (index < line.length) {
            val char = line[index]
            when {
                char == '"' && inQuotes && index + 1 < line.length && line[index + 1] == '"' -> {
                    current.append('"')
                    index += 1
                }
                char == '"' -> inQuotes = !inQuotes
                char == ',' && !inQuotes -> {
                    result.add(current.toString())
                    current.clear()
                }
                else -> current.append(char)
            }
            index += 1
        }
        result.add(current.toString())
        return result
    }

    private data class CsvRows(
        val header: List<String>,
        val rows: List<Map<String, String>>
    ) {
        fun requireColumns(vararg required: String): List<Map<String, String>> {
            val missing = required.filterNot { it in header }
            require(missing.isEmpty()) { "缺少欄位 ${missing.joinToString()}" }
            return rows
        }
    }

    private fun Map<String, String>.toWifiRecordOrNull(): WifiScanRecord? {
        if (isEmpty()) return null
        return WifiScanRecord(
            id = long("id") ?: 0L,
            sampleId = text("sampleId"),
            pointId = text("pointId"),
            x = float("x") ?: return null,
            y = float("y") ?: return null,
            floor = int("floor") ?: return null,
            mapId = text("mapId"),
            sessionId = text("sessionId"),
            dataSplit = text("dataSplit").ifBlank { "TRAIN" },
            deviceModel = text("deviceModel"),
            androidVersion = text("androidVersion"),
            appVersion = text("appVersion"),
            note = text("note"),
            sourceMode = text("sourceMode"),
            moveDirection = text("moveDirection"),
            intervalMeters = float("intervalMeters") ?: 1.5f,
            azimuth = float("azimuth") ?: Float.NaN,
            ssid = text("ssid"),
            bssid = text("bssid"),
            rssi = int("rssi") ?: return null,
            frequency = int("frequency") ?: 0,
            scanFreshness = text("scanFreshness"),
            scanUpdated = bool("scanUpdated"),
            duplicateScore = float("duplicateScore") ?: 0f,
            timestamp = long("timestamp") ?: 0L
        )
    }

    private fun Map<String, String>.toAnchorOrNull(): AnchorRecord? {
        return AnchorRecord(
            id = long("id") ?: 0L,
            anchorId = text("anchorId"),
            pointId = text("pointId"),
            x = float("x") ?: return null,
            y = float("y") ?: return null,
            floor = int("floor") ?: return null,
            mapId = text("mapId"),
            anchorType = text("anchorType"),
            note = text("note"),
            transitionGroupId = text("transitionGroupId"),
            transitionRole = text("transitionRole").ifBlank { "NONE" },
            targetFloor = int("targetFloor"),
            timestamp = long("timestamp") ?: 0L
        )
    }

    private fun Map<String, String>.toMapMetadataOrNull(): MapMetadataEntity? {
        val mapId = text("mapId")
        if (mapId.isBlank()) return null
        return MapMetadataEntity(
            mapId = mapId,
            mapMode = text("mapMode"),
            exportedMapFile = text("exportedMapFile"),
            metersPerPixel = float("metersPerPixel"),
            coordinateUnit = text("coordinateUnit"),
            calibrated = bool("calibrated"),
            mapHeadingOffsetDegrees = float("mapHeadingOffsetDegrees")
        )
    }

    private fun Map<String, String>.text(key: String): String = get(key).orEmpty()
    private fun Map<String, String>.int(key: String): Int? = text(key).toIntOrNull()
    private fun Map<String, String>.long(key: String): Long? = text(key).toLongOrNull()
    private fun Map<String, String>.float(key: String): Float? = text(key).toFloatOrNull()
    private fun Map<String, String>.bool(key: String): Boolean =
        text(key).equals("true", ignoreCase = true) || text(key) == "1"
}
