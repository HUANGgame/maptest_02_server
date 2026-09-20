package com.example.wififingerprintcollector

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [WifiScanRecord::class, AnchorRecord::class, MapMetadataEntity::class, WifiApCalibration::class],
    version = 9,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun wifiScanDao(): WifiScanDao
    abstract fun anchorDao(): AnchorDao
    abstract fun mapMetadataDao(): MapMetadataDao
    abstract fun wifiApCalibrationDao(): WifiApCalibrationDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "wifi_fingerprint_records.db"
                )
                    .addMigrations(MIGRATION_3_4)
                    .addMigrations(MIGRATION_4_5)
                    .addMigrations(MIGRATION_3_5)
                    .addMigrations(MIGRATION_5_6)
                    .addMigrations(MIGRATION_4_6)
                    .addMigrations(MIGRATION_3_6)
                    .addMigrations(MIGRATION_6_7)
                    .addMigrations(MIGRATION_7_8)
                    .addMigrations(MIGRATION_8_9)
                    .build()
                    .also { INSTANCE = it }
            }
        }

        private val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN transitionGroupId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN transitionRole TEXT NOT NULL DEFAULT 'NONE'")
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN targetFloor INTEGER")
            }
        }

        private val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN mapId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN mapId TEXT NOT NULL DEFAULT ''")
            }
        }

        private val MIGRATION_3_5 = object : Migration(3, 5) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN transitionGroupId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN transitionRole TEXT NOT NULL DEFAULT 'NONE'")
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN targetFloor INTEGER")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN mapId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN mapId TEXT NOT NULL DEFAULT ''")
            }
        }

        private val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN sessionId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN dataSplit TEXT NOT NULL DEFAULT 'TRAIN'")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN deviceModel TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN androidVersion TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN appVersion TEXT NOT NULL DEFAULT ''")
            }
        }

        private val MIGRATION_4_6 = object : Migration(4, 6) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN mapId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN mapId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN sessionId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN dataSplit TEXT NOT NULL DEFAULT 'TRAIN'")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN deviceModel TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN androidVersion TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN appVersion TEXT NOT NULL DEFAULT ''")
            }
        }

        private val MIGRATION_3_6 = object : Migration(3, 6) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN transitionGroupId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN transitionRole TEXT NOT NULL DEFAULT 'NONE'")
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN targetFloor INTEGER")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN mapId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE anchor_records ADD COLUMN mapId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN sessionId TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN dataSplit TEXT NOT NULL DEFAULT 'TRAIN'")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN deviceModel TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN androidVersion TEXT NOT NULL DEFAULT ''")
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN appVersion TEXT NOT NULL DEFAULT ''")
            }
        }

        private val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS map_metadata (
                        mapId TEXT NOT NULL PRIMARY KEY,
                        mapMode TEXT NOT NULL,
                        exportedMapFile TEXT NOT NULL,
                        metersPerPixel REAL,
                        coordinateUnit TEXT NOT NULL,
                        calibrated INTEGER NOT NULL,
                        mapHeadingOffsetDegrees REAL
                    )
                    """.trimIndent()
                )
            }
        }

        private val MIGRATION_7_8 = object : Migration(7, 8) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("ALTER TABLE wifi_scan_records ADD COLUMN uploadedAt INTEGER")
            }
        }

        private val MIGRATION_8_9 = object : Migration(8, 9) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS wifi_ap_calibrations (
                        calibrationId TEXT NOT NULL PRIMARY KEY,
                        bssid TEXT NOT NULL,
                        ssid TEXT NOT NULL,
                        mapId TEXT NOT NULL,
                        floor INTEGER NOT NULL,
                        x REAL NOT NULL,
                        y REAL NOT NULL,
                        referenceRssi REAL NOT NULL,
                        pathLossExponent REAL NOT NULL,
                        rmse REAL NOT NULL,
                        samplePointCount INTEGER NOT NULL,
                        observationCount INTEGER NOT NULL,
                        suggestedPointId TEXT NOT NULL,
                        status TEXT NOT NULL,
                        source TEXT NOT NULL,
                        updatedAt INTEGER NOT NULL
                    )
                    """.trimIndent()
                )
            }
        }
    }
}
