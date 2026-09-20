package com.example.wififingerprintcollector

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "map_metadata")
data class MapMetadataEntity(
    @PrimaryKey
    val mapId: String,
    val mapMode: String,
    val exportedMapFile: String,
    val metersPerPixel: Float?,
    val coordinateUnit: String,
    val calibrated: Boolean,
    val mapHeadingOffsetDegrees: Float?
)
