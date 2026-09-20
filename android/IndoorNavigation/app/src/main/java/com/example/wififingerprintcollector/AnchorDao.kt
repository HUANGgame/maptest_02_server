package com.example.wififingerprintcollector

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface AnchorDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(anchor: AnchorRecord)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAll(anchors: List<AnchorRecord>)

    @Query("SELECT * FROM anchor_records ORDER BY timestamp ASC, id ASC")
    suspend fun getAllAnchors(): List<AnchorRecord>

    @Query("SELECT * FROM anchor_records WHERE mapId = :mapId OR mapId = '' ORDER BY timestamp ASC, id ASC")
    suspend fun getAnchorsByMap(mapId: String): List<AnchorRecord>

    @Query("SELECT * FROM anchor_records WHERE (mapId = :mapId OR mapId = '') AND floor = :floor ORDER BY timestamp ASC, id ASC")
    suspend fun getAnchorsByMapAndFloor(mapId: String, floor: Int): List<AnchorRecord>

    @Query("SELECT COUNT(*) FROM anchor_records")
    suspend fun getAnchorCount(): Int

    @Query("SELECT * FROM anchor_records WHERE transitionGroupId != '' ORDER BY timestamp DESC, id DESC LIMIT 1")
    suspend fun getLatestTransitionAnchor(): AnchorRecord?

    @Query("DELETE FROM anchor_records WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<Long>): Int

    @Query("UPDATE anchor_records SET mapId = :newMapId WHERE mapId = :oldMapId AND floor = :floor")
    suspend fun reassignMapForFloor(oldMapId: String, newMapId: String, floor: Int): Int

    @Query("UPDATE anchor_records SET mapId = :newMapId, floor = :newFloor WHERE mapId = :oldMapId AND floor = :oldFloor")
    suspend fun reassignMapAndFloor(oldMapId: String, oldFloor: Int, newMapId: String, newFloor: Int): Int

    @Query("UPDATE anchor_records SET x = :x, y = :y WHERE pointId = :pointId AND mapId = :mapId AND floor = :floor")
    suspend fun updatePointCoordinates(pointId: String, mapId: String, floor: Int, x: Float, y: Float): Int

    @Query("DELETE FROM anchor_records")
    suspend fun deleteAll()
}
