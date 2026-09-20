package com.example.wififingerprintcollector

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface MapMetadataDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<MapMetadataEntity>)

    @Query("SELECT * FROM map_metadata ORDER BY mapId ASC")
    suspend fun getAll(): List<MapMetadataEntity>

    @Query("SELECT * FROM map_metadata WHERE mapId = :mapId LIMIT 1")
    suspend fun getByMapId(mapId: String): MapMetadataEntity?

    @Query("SELECT COUNT(*) FROM map_metadata")
    suspend fun getCount(): Int

    @Query("DELETE FROM map_metadata")
    suspend fun deleteAll()
}
