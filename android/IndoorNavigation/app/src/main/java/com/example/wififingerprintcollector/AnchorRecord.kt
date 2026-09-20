package com.example.wififingerprintcollector

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "anchor_records")
data class AnchorRecord(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0L,
    val anchorId: String,
    val pointId: String,
    val x: Float,
    val y: Float,
    val floor: Int,
    val mapId: String = "",
    val anchorType: String,
    val note: String,
    val transitionGroupId: String = "",
    val transitionRole: String = "NONE",
    val targetFloor: Int? = null,
    val timestamp: Long
)
