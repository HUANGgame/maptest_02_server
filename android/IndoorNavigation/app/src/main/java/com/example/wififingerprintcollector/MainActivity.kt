package com.example.wififingerprintcollector

import android.Manifest
import android.app.AlertDialog
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.location.LocationManager
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.DividerItemDecoration
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.wififingerprintcollector.databinding.ActivityMainBinding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.coroutines.resume
import kotlin.math.atan2
import kotlin.math.sqrt

class MainActivity : AppCompatActivity() {

    private val WIFI_UPLOAD_BATCH_SIZE = 200

    private lateinit var binding: ActivityMainBinding
    private lateinit var wifiManager: WifiManager
    private lateinit var database: AppDatabase
    private lateinit var dao: WifiScanDao
    private lateinit var anchorDao: AnchorDao
    private lateinit var mapMetadataDao: MapMetadataDao
    private lateinit var wifiApCalibrationDao: WifiApCalibrationDao
    private lateinit var fingerprintRepository: FingerprintRepository
    private lateinit var csvImporter: CsvFingerprintImporter
    private val positioningEngine = FingerprintPositioningEngine()
    private val dataQualityAnalyzer = DataQualityAnalyzer()
    private val positioningHistory = ArrayDeque<FingerprintPositioningEngine.PositionResult>()
    private val navigationEngine = NavigationEngine()
    private var latestPositioningResult: FingerprintPositioningEngine.PositionResult? = null
    private lateinit var adapter: WifiResultAdapter
    private lateinit var compassManager: CompassManager
    private lateinit var pdrManager: PdrManager

    private var receiverRegistered = false
    private var scanInProgress = false
    private var startupPointsLoaded = false
    private var pendingScanCallback: ((List<WifiScanResultItem>, ScanFreshness) -> Unit)? = null
    private var lastScanResults: List<WifiScanResultItem> = emptyList()
    private var lastSavedScanSignature: Map<String, Int> = emptyMap()
    private var latestScanFreshness = ScanFreshness(ScanFreshness.UNKNOWN, false, 0f)
    private var currentPoint: SamplingPoint? = null
    private var pointIndex = 0
    private var recordCount = 0
    private var anchorCount = 0
    private var pendingTransitionGroupId: String? = null
    private var pendingTransitionSourceMapId: String = ""
    private var pendingTransitionSourcePointId: String = ""
    private var pendingTransitionSourceType: String = ""
    private var pendingTransitionSourceNote: String = ""
    private var currentSessionId: String = ""
    private var dataSplit: String = "TRAIN"
    private var currentMode = SamplingMode.COMPASS_FORWARD
    private var pointEditMode: String? = null
    private var backendPlacesByPoint: Map<String, BackendPlace> = emptyMap()
    private var advancedOperationsExpanded = false
    private var autoScanJob: Job? = null
    private var walkAutoScanJob: Job? = null
    private var realtimeValidationClearJob: Job? = null
    private var pendingRealtimeFeedback: PendingRealtimeFeedback? = null
    private var realtimeFeedbackMode = false
    private var autoScanTargetCount = 10
    private var autoScanProgressCount = 0
    private var isAutoSampling = false
    private var isAutoForwardSampling = false
    private var isWalkAutoSampling = false
    private var walkDistanceMeters = 0f
    private var walkSteps = 0
    private var walkSavedAtPoint = 0
    private var latestSampleId = "-"
    private var latestSavedTime = "-"
    private var latestExportPath = "-"
    private var latestError = "-"
    private var permissionStatus = "Unknown"
    private var wifiStatus = "Unknown"
    private var compassStatus = "Waiting"
    private var currentAzimuth = Float.NaN
    private var currentDirectionCode = "NORTH"
    private var currentDirectionText = "\u5317"
    private var compassStable = false
    private var headingLocked = false
    private var lockedAzimuth = Float.NaN
    private var importedMapPath: String? = null
    private var currentMapId: String = "F1_M1"
    private var metersPerPixel: Float? = null
    private var mapHeadingOffsetDegrees: Float? = null
    private var compactMapDisplay = true
    private var backendMapId: String = ""
    private var backendFloorId: String = ""
    private var backendMapName: String = ""
    private var backendFloorName: String = ""
    private var suppressMapSelectionApply = false
    private var replenishmentPointIds: Set<String> = emptySet()
    private val calibrationRawPoints = mutableListOf<Pair<Float, Float>>()
    private var waitingForCalibrationPoints = false
    private var calibrationMode: String? = null
    private val headingCalibrationPoints = mutableListOf<Pair<Float, Float>>()
    private var waitingForHeadingCalibration = false
    private var headingCalibrationAzimuth = Float.NaN

    private val mapImportLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) importMapFromUri(uri)
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val granted = result.values.all { it }
        permissionStatus = if (granted) "權限已允許" else "缺少 Wi-Fi / 位置權限"
        updateStatus(if (granted) "權限已允許，可以開始掃描" else "缺少 Wi-Fi / 位置權限")
    }

    private val wifiScanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != WifiManager.SCAN_RESULTS_AVAILABLE_ACTION) return
            scanInProgress = false
            val results = readWifiResults()
            val scanSucceeded = intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false)
            val freshness = evaluateScanFreshness(results, scanSucceeded)
            latestScanFreshness = freshness
            lastScanResults = results
            adapter.submitResults(results)
            val message = if (scanSucceeded) {
                "掃描完成，AP 數量：${results.size}，${freshnessText(freshness)}"
            } else {
                "系統可能限制掃描頻率，已讀取上一次結果，AP 數量：${results.size}"
            }
            updateStatus(message, apCount = results.size)
            pendingScanCallback?.invoke(results, freshness)
            pendingScanCallback = null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        database = AppDatabase.getInstance(this)
        dao = database.wifiScanDao()
        anchorDao = database.anchorDao()
        mapMetadataDao = database.mapMetadataDao()
        wifiApCalibrationDao = database.wifiApCalibrationDao()
        fingerprintRepository = FingerprintRepository(dao, anchorDao, mapMetadataDao)
        csvImporter = CsvFingerprintImporter(this, fingerprintRepository)
        adapter = WifiResultAdapter()
        loadMapSettings()
        loadSamplingMetadata()
        loadBackendScope()
        loadMapSettings()

        setupRecyclerView()
        setupCompass()
        setupPdr()
        setupMap()
        setupActions()
        updateSessionPanel()
        updateWalkAutoProgressLabel(false)
        registerWifiReceiver()
        requestRequiredPermissions()
        lifecycleScope.launch {
            refreshRecordCount()
            refreshAnchors()
            importCsvIfAvailableOnStartup()
            migrateKnownWrongMapOwnership()
            loadMapMetadataFromDatabase()
            restoreCurrentMapPoints()
            performStrictDataCleanup("啟動清理")
            updatePointPanel()
            refreshReplenishmentPanel()
            updateStatus("請先在地圖上建立起點")
            startupPointsLoaded = true
        }
    }

    override fun onResume() {
        super.onResume()
        if (::compassManager.isInitialized) compassManager.start()
        if (startupPointsLoaded && backendFloorId.isNotBlank() && !scanInProgress &&
            autoScanJob?.isActive != true && walkAutoScanJob?.isActive != true) {
            lifecycleScope.launch { restoreCurrentMapPoints() }
        }
    }

    override fun onPause() {
        setPointEditMode(null)
        if (::compassManager.isInitialized) compassManager.stop()
        super.onPause()
    }

    override fun onDestroy() {
        autoScanJob?.cancel()
        walkAutoScanJob?.cancel()
        realtimeValidationClearJob?.cancel()
        if (::pdrManager.isInitialized) pdrManager.stop()
        if (receiverRegistered) {
            try {
                unregisterReceiver(wifiScanReceiver)
            } catch (_: IllegalArgumentException) {
                // Receiver may already be unregistered during lifecycle recovery.
            }
            receiverRegistered = false
        }
        super.onDestroy()
    }

    private suspend fun importCsvIfAvailableOnStartup() {
        val prefs = getSharedPreferences("csv_import", Context.MODE_PRIVATE)
        val alreadyImported = prefs.getBoolean("initial_import_done", false)
        val hasDatabaseRows = fingerprintRepository.fingerprintCount() > 0
        if (alreadyImported && hasDatabaseRows) {
            binding.textRealtimeValidationResult.text =
                "CSV 匯入狀態：已匯入，Wi-Fi 指紋 ${fingerprintRepository.fingerprintCount()} 筆"
            return
        }

        val report = csvImporter.importIfAvailable()
        if (report.foundAnyCsv && !report.message.startsWith("CSV 匯入失敗")) {
            prefs.edit().putBoolean("initial_import_done", true).apply()
            refreshRecordCount()
            refreshAnchors()
        }
        binding.textRealtimeValidationResult.text = buildString {
            append("CSV 匯入狀態：${report.message}")
            append("\n資料庫 Wi-Fi 指紋：${fingerprintRepository.fingerprintCount()} 筆")
            append("\n定位點數：${fingerprintRepository.pointCount()}")
        }
    }

    private suspend fun migrateKnownWrongMapOwnership() {
        val legacyMapId = "F1_M1"
        val targetMapId = "k-area-airport"
        val targetFloor = 1
        val legacyCount = dao.getRecordCountByMapAndFloor(legacyMapId, targetFloor)
        val legacyBasementCount = dao.getRecordCountByMapAndFloor(targetMapId, -1)
        var movedRecords = 0
        var movedAnchors = 0
        if (legacyCount > 0) {
            movedRecords = dao.reassignMapForFloor(legacyMapId, targetMapId, targetFloor)
            movedAnchors = anchorDao.reassignMapForFloor(legacyMapId, targetMapId, targetFloor)
            val targetMetadata = fingerprintRepository.mapMetadata(targetMapId)
            val legacyMetadata = fingerprintRepository.mapMetadata(legacyMapId)
            if (legacyMetadata != null && targetMetadata == null) {
                mapMetadataDao.insertAll(listOf(legacyMetadata.copy(mapId = targetMapId)))
            }
        }
        if (legacyBasementCount > 0) {
            movedRecords += dao.reassignMapAndFloor(targetMapId, -1, targetMapId, targetFloor)
            movedAnchors += anchorDao.reassignMapAndFloor(targetMapId, -1, targetMapId, targetFloor)
        }
        val transformedRecords = migrateCompactKAreaAirportF1Coordinates(targetMapId, targetFloor)
        val seededRecords = applyInitialPointLayout(targetMapId, targetFloor, force = false)
        if (transformedRecords > 0) {
            mapMetadataDao.insertAll(
                listOf(
                    MapMetadataEntity(
                        mapId = targetMapId,
                        mapMode = "MIGRATED_IMAGE_PIXELS",
                        exportedMapFile = "",
                        metersPerPixel = null,
                        coordinateUnit = "image_pixel",
                        calibrated = true,
                        mapHeadingOffsetDegrees = null
                    )
                )
            )
            if (backendMapId == targetMapId && activeSamplingFloor() == targetFloor) {
                metersPerPixel = null
                mapHeadingOffsetDegrees = null
                saveMapSettings()
            }
        }
        if (backendMapId == targetMapId && backendFloorId.isBlank()) {
            getSharedPreferences("backend", Context.MODE_PRIVATE).edit()
                .putString("floor_id", "k-area-airport-1f")
                .putString("floor_name", "1F")
                .apply()
            loadBackendScope()
        }
        if (movedRecords > 0 || movedAnchors > 0 || transformedRecords > 0 || seededRecords > 0) {
            refreshRecordCount()
            refreshAnchors()
            binding.textSyncStatus.text = "同步狀態：已修正舊資料歸屬，$targetMapId / 1F 指紋 $movedRecords 筆，座標 ${transformedRecords + seededRecords} 筆。"
        }
    }

    private fun confirmApplyPointLayout() {
        val mapId = activeSamplingMapId()
        val floor = activeSamplingFloor() ?: readFloorCodeOrNull() ?: 1
        val layout = initialPointLayoutFor(mapId, floor)
        if (layout.isEmpty()) {
            updateStatus("目前地圖沒有內建基準點：$mapId / ${floorCode(floor)}")
            showMessage("目前地圖沒有內建基準點")
            return
        }
        AlertDialog.Builder(this)
            .setTitle("套用基準點")
            .setMessage("會把目前地圖 / 樓層的同名指紋點更新到內建基準位置，不會刪除 Wi-Fi 指紋。\n\n目前範圍：$mapId / ${floorCode(floor)}")
            .setPositiveButton("套用") { _, _ ->
                lifecycleScope.launch {
                    val updated = applyInitialPointLayout(mapId, floor, force = true)
                    loadMapSettings()
                    restoreCurrentMapPoints()
                    refreshAnchors()
                    refreshReplenishmentPanel()
                    updateStatus("已套用基準點：$mapId / ${floorCode(floor)}，更新指紋 $updated 筆。可再按住點位微調。")
                }
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private suspend fun applyInitialPointLayout(mapId: String, floor: Int, force: Boolean): Int {
        val layout = initialPointLayoutFor(mapId, floor)
        if (layout.isEmpty()) return 0
        val prefs = getSharedPreferences("point_layout_migrations", Context.MODE_PRIVATE)
        val migrationKey = "initial_point_layout_${mapId}_${floorCode(floor)}_20260908_v2"
        if (!force && prefs.getBoolean(migrationKey, false)) return 0

        val recordCount = dao.getRecordCountByMapAndFloor(mapId, floor)
        if (recordCount <= 0) return 0
        var updatedRecords = 0
        var updatedAnchors = 0
        val mapIds = listOf(mapId)
        for ((pointId, xy) in layout) {
            updatedRecords += dao.updatePointCoordinates(pointId, mapIds, floor, xy.first, xy.second)
            updatedAnchors += anchorDao.updatePointCoordinates(pointId, mapId, floor, xy.first, xy.second)
        }
        if (updatedRecords > 0 || updatedAnchors > 0) {
            mapMetadataDao.insertAll(
                listOf(
                    MapMetadataEntity(
                        mapId = mapId,
                        mapMode = "SEEDED_IMAGE_PIXELS",
                        exportedMapFile = "",
                        metersPerPixel = null,
                        coordinateUnit = "image_pixel",
                        calibrated = true,
                        mapHeadingOffsetDegrees = null
                    )
                )
            )
            if (backendMapId == mapId && activeSamplingFloor() == floor) {
                metersPerPixel = null
                mapHeadingOffsetDegrees = null
                saveMapSettings()
            }
        }
        prefs.edit().putBoolean(migrationKey, true).apply()
        return updatedRecords
    }

    private fun initialPointLayoutFor(mapId: String, floor: Int): Map<String, Pair<Float, Float>> =
        when {
            mapId == "k-area-airport" && floor == 1 -> kAreaAirportFloorOnePointLayout()
            else -> emptyMap()
        }

    private fun kAreaAirportFloorOnePointLayout(): Map<String, Pair<Float, Float>> =
        mapOf(
            "P001" to (1010.0f to 430.0f),
            "P002" to (1015.0f to 548.0f),
            "P003" to (1160.0f to 455.0f),
            "P004" to (1275.0f to 455.0f),
            "P005" to (1390.0f to 455.0f),
            "P006" to (1500.0f to 455.0f),
            "P007" to (1495.0f to 548.0f),
            "P008" to (1620.0f to 455.0f),
            "P009" to (1700.0f to 455.0f),
            "P010" to (1700.0f to 350.0f),
            "P011" to (1690.0f to 250.0f),
            "P012" to (1580.0f to 205.0f),
            "P013" to (1540.0f to 170.0f),
            "P014" to (1470.0f to 170.0f),
            "P015" to (1370.0f to 170.0f),
            "P016" to (1280.0f to 170.0f),
            "P017" to (1180.0f to 170.0f),
            "P018" to (1080.0f to 170.0f),
            "P019" to (1025.0f to 145.0f),
            "P020" to (950.0f to 155.0f),
            "P021" to (875.0f to 165.0f),
            "P022" to (805.0f to 175.0f),
            "P023" to (735.0f to 185.0f),
            "P024" to (665.0f to 190.0f),
            "P025" to (590.0f to 195.0f),
            "P026" to (520.0f to 205.0f),
            "P027" to (455.0f to 220.0f),
            "P028" to (380.0f to 235.0f),
            "P029" to (295.0f to 250.0f),
            "P030" to (145.0f to 295.0f),
            "P031" to (80.0f to 325.0f),
            "P032" to (92.0f to 500.0f),
            "P033" to (300.0f to 405.0f),
            "P034" to (405.0f to 455.0f),
            "P035" to (470.0f to 460.0f),
            "P036" to (560.0f to 505.0f),
            "P037" to (595.0f to 545.0f),
            "P038" to (720.0f to 455.0f),
            "P039" to (850.0f to 380.0f),
            "P040" to (900.0f to 455.0f),
            "P041" to (980.0f to 535.0f),
            "P042" to (1120.0f to 535.0f),
            "P043" to (1280.0f to 570.0f),
            "P044" to (1120.0f to 390.0f),
            "P045" to (1220.0f to 455.0f),
            "P046" to (1345.0f to 540.0f),
            "P047" to (1450.0f to 540.0f),
            "P048" to (1030.0f to 335.0f),
            "P049" to (1180.0f to 410.0f),
            "P050" to (1280.0f to 410.0f),
            "P051" to (1340.0f to 320.0f),
            "P052" to (1540.0f to 150.0f),
            "P053" to (1510.0f to 340.0f),
            "P054" to (500.0f to 360.0f),
            "P055" to (1120.0f to 425.0f),
            "P056" to (1220.0f to 520.0f),
            "P057" to (1550.0f to 360.0f),
            "P058" to (1540.0f to 320.0f),
            "P059" to (1500.0f to 300.0f),
            "P060" to (1450.0f to 290.0f),
            "P061" to (1400.0f to 280.0f),
            "P062" to (1350.0f to 260.0f),
            "P063" to (1300.0f to 240.0f),
            "P064" to (1250.0f to 220.0f),
            "P065" to (1200.0f to 220.0f),
            "P066" to (1150.0f to 220.0f),
            "P067" to (1100.0f to 220.0f),
            "P068" to (1040.0f to 330.0f),
            "P069" to (950.0f to 210.0f),
            "P070" to (880.0f to 200.0f),
            "P071" to (820.0f to 190.0f),
            "P072" to (760.0f to 190.0f),
            "P074" to (700.0f to 190.0f),
            "P076" to (640.0f to 190.0f)
        )

    private suspend fun migrateCompactKAreaAirportF1Coordinates(mapId: String, floor: Int): Int {
        if (mapId != "k-area-airport" || floor != 1) return 0
        val sourceMinX = 178.8f
        val sourceMaxX = 217.6f
        val sourceMinY = 147.4f
        val sourceMaxY = 171.5f
        val compactRecords = dao.countRecordsInCoordinateRange(
            mapId,
            floor,
            sourceMinX,
            sourceMaxX,
            sourceMinY,
            sourceMaxY
        )
        val pixelLikeRecords = dao.countPixelLikeRecords(mapId, floor, minPixelX = 400f, minPixelY = 230f)
        if (compactRecords < 1000 || pixelLikeRecords > 0) return 0

        val targetMinX = 85f
        val targetMaxX = 1670f
        val targetMinY = 130f
        val targetMaxY = 510f
        return dao.transformCoordinatesForFloor(
            mapId = mapId,
            floor = floor,
            sourceMinX = sourceMinX,
            sourceMaxX = sourceMaxX,
            sourceMinY = sourceMinY,
            sourceMaxY = sourceMaxY,
            scaleX = (targetMaxX - targetMinX) / (sourceMaxX - sourceMinX),
            scaleY = (targetMaxY - targetMinY) / (sourceMaxY - sourceMinY),
            targetMinX = targetMinX,
            targetMinY = targetMinY
        )
    }

    private suspend fun loadMapMetadataFromDatabase() {
        val activeMapId = activeSamplingMapId()
        val activeFloor = activeSamplingFloor() ?: readFloorCodeOrNull() ?: 1
        val scopedMetadata = localMapScopeIdsFor(activeMapId, activeFloor)
            .firstNotNullOfOrNull { fingerprintRepository.mapMetadata(it) }
        if (!importedMapPath.isNullOrBlank() && File(importedMapPath!!).exists()) {
            if (scopedMetadata != null) {
                metersPerPixel = metersPerPixel ?: scopedMetadata.metersPerPixel
                mapHeadingOffsetDegrees = mapHeadingOffsetDegrees ?: scopedMetadata.mapHeadingOffsetDegrees
            }
            binding.mapSamplingView.setImportedMap(importedMapPath)
            binding.mapSamplingView.setMetersPerPixel(metersPerPixel)
            updateMapCalibrationStatus()
            return
        }
        val metadata = scopedMetadata ?: fingerprintRepository.mapMetadata(currentMapId)
            ?: return
        currentMapId = metadata.mapId
        metersPerPixel = metadata.metersPerPixel
        mapHeadingOffsetDegrees = metadata.mapHeadingOffsetDegrees
        val outputDir = getExternalFilesDir(null) ?: filesDir
        val mapFile = metadata.exportedMapFile.takeIf { it.isNotBlank() }?.let { File(outputDir, it) }
        if (mapFile != null && mapFile.exists()) {
            importedMapPath = mapFile.absolutePath
            binding.mapSamplingView.setImportedMap(importedMapPath)
        }
        binding.mapSamplingView.setMetersPerPixel(metersPerPixel)
        updateMapCalibrationStatus()
    }

    private fun setupRecyclerView() {
        binding.recyclerWifiResults.layoutManager = LinearLayoutManager(this)
        binding.recyclerWifiResults.adapter = adapter
        binding.recyclerWifiResults.addItemDecoration(
            DividerItemDecoration(this, DividerItemDecoration.VERTICAL)
        )
    }

    private fun setupCompass() {
        compassManager = CompassManager(this) { azimuth, directionText, directionCode, stable, statusText ->
            currentAzimuth = azimuth
            currentDirectionText = directionText
            currentDirectionCode = directionCode
            compassStable = stable
            compassStatus = statusText
            binding.mapSamplingView.setHeadingArrowAzimuth(mapAzimuth(azimuth))
            binding.textCompass.text = buildString {
                append("\u76ee\u524d\u65b9\u4f4d\uff1a${azimuth.toInt()}\u00b0\n")
                append("\u5224\u5b9a\u65b9\u5411\uff1a$directionText\n")
                append("\u6307\u5317\u91dd\u72c0\u614b\uff1a$statusText\n")
                append("\u9396\u5b9a\u65b9\u5411\uff1a${if (headingLocked) "\u5df2\u9396\u5b9a" else "\u672a\u9396\u5b9a"}")
            }
        }
        if (!compassManager.isAvailable) {
            compassStatus = "Sensor unavailable"
            binding.textCompass.text = "\u65b9\u4f4d\u611f\u6e2c\u5668\u4e0d\u53ef\u7528"
        }
    }

    private fun setupPdr() {
        pdrManager = PdrManager(this) { steps, distance ->
            if (!isWalkAutoSampling) return@PdrManager
            walkSteps = steps
            walkDistanceMeters = distance
            val interval = readIntervalMeters() ?: 1.5f
            updateWalkAutoProgressLabel(true)
            updateSamplingRunState(true, "步行自動採集中：${distance.format1()} / ${interval.format1()}m，步數 $steps")
            if (distance >= interval) {
                advancePointFromWalk(interval)
            }
        }
    }

    private fun setupMap() {
        binding.mapSamplingView.setPointDraggingEnabled(false)
        binding.mapSamplingView.setImportedMap(importedMapPath)
        binding.mapSamplingView.setMetersPerPixel(metersPerPixel)
        binding.mapSamplingView.setCompactDisplay(compactMapDisplay)
        updateMapCalibrationStatus()
        binding.mapSamplingView.onPointDragFinished = { point ->
            handlePointDragFinished(point)
        }
        binding.mapSamplingView.onPointTapped = { point ->
            handlePointTapped(point)
        }
        binding.mapSamplingView.onMapTappedDetailed = { x, y, rawX, rawY ->
            if (waitingForCalibrationPoints) {
                handleCalibrationTap(rawX, rawY)
            } else if (waitingForHeadingCalibration) {
                handleHeadingCalibrationTap(x, y)
            } else if (pointEditMode == "add") {
                setPointEditMode(null)
                showKeyPointDialog(x, y)
            }
        }
    }

    private fun handlePointDragFinished(point: SamplingPoint) {
        if (pointEditMode != "move") return
        setPointEditMode(null)
        currentPoint = point
        binding.mapSamplingView.setCurrentPoint(point.pointId)
        updatePointPanel()
        lifecycleScope.launch {
            val mapId = activeSamplingMapId()
            val mapIds = localMapScopeIdsFor(mapId, point.floor)
            val sampleCount = dao.getSampleCountByPointScope(point.pointId, mapIds, point.floor)
            if (point.sampled || sampleCount > 0) {
                updateStatus("${point.pointId} 已有採樣資料，座標已鎖定；只能刪除，不能移動")
                return@launch
            }
            val updatedRecords = dao.updatePointCoordinates(point.pointId, mapIds, point.floor, point.x, point.y)
            val updatedAnchors = anchorDao.updatePointCoordinates(point.pointId, mapId, point.floor, point.x, point.y)
            refreshAnchors()
            refreshReplenishmentPanel()
            updateStatus(
                "已移動 ${point.pointId} 到 x=${point.x.format1()}, y=${point.y.format1()}\n" +
                    "已更新指紋 $updatedRecords 筆、錨點 $updatedAnchors 筆"
            )
            val original = backendPlacesByPoint[point.pointId]
            syncBackendPlace(point, original?.categories ?: categoriesFromPointNote(point), point.displayLabel.ifBlank { point.pointId }, original?.keywords.orEmpty(), original?.description ?: point.note)
            syncDraggedBackendNode(point)
        }
    }

    private fun handlePointTapped(point: SamplingPoint) {
        currentPoint = point
        binding.mapSamplingView.setCurrentPoint(point.pointId)
        updatePointPanel()
        lifecycleScope.launch {
            val mapId = activeSamplingMapId()
            val sampleCount = dao.getSampleCountByPointScope(
                point.pointId,
                localMapScopeIdsFor(mapId, point.floor),
                point.floor
            )
            if (point.sampled || sampleCount > 0) {
                updateStatus("${point.displayLabel.ifBlank { point.pointId }} 已選取，座標已鎖定，可繼續採集")
            } else {
                updateStatus("${point.displayLabel.ifBlank { point.pointId }} 已選取；需要調整時請按移動點位")
            }
        }
    }

    private fun setupActions() {
        binding.buttonAddMapPoint.setOnClickListener { togglePointEditMode("add") }
        binding.buttonMoveMapPoint.setOnClickListener { togglePointEditMode("move") }
        binding.radioSamplingMode.setOnCheckedChangeListener { _, checkedId ->
            currentMode = when (checkedId) {
                R.id.radioMapMode -> SamplingMode.MAP_TAP
                R.id.radioManualMode -> SamplingMode.MANUAL
                else -> SamplingMode.COMPASS_FORWARD
            }
            updateModeVisibility()
            updateStatus("已切換採樣模式：${modeLabel(currentMode)}")
        }
        updateModeVisibility()

        binding.buttonAddByCompass.setOnClickListener { togglePointEditMode("add") }
        binding.buttonAutoUniformForward.setOnClickListener { startAutoScan() }
        binding.buttonAutoScan.setOnClickListener { startAutoScan() }
        binding.buttonStopAutoScan.setOnClickListener { stopAutoScan() }
        binding.buttonFieldReadinessCheck.setOnClickListener { runFieldReadinessCheck() }
        binding.buttonWalkAutoSample.setOnClickListener { startAutoScan() }
        binding.buttonStopWalkAuto.setOnClickListener { stopWalkAutoSampling() }
        binding.buttonLockHeading.setOnClickListener { toggleHeadingLock() }
        binding.buttonUndoPoint.text = "刪除目前點位"
        binding.buttonUndoPoint.setOnClickListener { confirmDeleteCurrentPoint() }
        binding.buttonToggleAdvancedOperations.setOnClickListener { toggleAdvancedOperations() }
        binding.buttonExportCsv.setOnClickListener { exportCsv() }
        binding.buttonShareCsv.setOnClickListener { shareCsvFiles() }
        binding.buttonSelectBackendScope.setOnClickListener { showBackendScopeDialog() }
        binding.buttonUploadWifiScans.setOnClickListener { uploadPendingWifiScans() }
        binding.buttonResetUploadMarks.setOnClickListener { confirmResetUploadMarks() }
        binding.buttonAddAnchor.setOnClickListener { showAddAnchorDialog() }
        binding.buttonApCalibration.setOnClickListener { showApCalibrationMenu() }
        binding.buttonClearDatabase.setOnClickListener { confirmClearDatabase() }
        binding.buttonImportMap.setOnClickListener { mapImportLauncher.launch("image/*") }
        binding.buttonApplyPointLayout.setOnClickListener { confirmApplyPointLayout() }
        binding.buttonCalibrateMap.setOnClickListener { startMapCalibration() }
        binding.buttonCalibrateMapBoth.setOnClickListener { startCombinedMapCalibration() }
        binding.buttonCalibrateMapHeading.setOnClickListener { startHeadingCalibration() }
        binding.buttonToggleMapCompactDisplay.setOnClickListener { toggleMapCompactDisplay() }
        applyMapCompactDisplay(showStatus = false)
        binding.buttonStartPositioning.setOnClickListener {
            if (realtimeFeedbackMode) {
                showRealtimePositioningErrorDialog()
            } else {
                startPositioning()
            }
        }
        binding.buttonPlanNavigation.setOnClickListener { showNavigationDestinationDialog() }
        binding.buttonOpenUserNavigation.setOnClickListener {
            startActivity(Intent(this, UserNavigationActivity::class.java))
        }
        binding.buttonRealtimeKnnValidate.setOnClickListener { runRealtimeKnnValidation() }
        binding.radioSplitTest.isChecked = dataSplit == "TEST"
        binding.radioSplitTrain.isChecked = dataSplit != "TEST"
        binding.radioDataSplit.setOnCheckedChangeListener { _, checkedId ->
            dataSplit = if (checkedId == R.id.radioSplitTest) "TEST" else "TRAIN"
            saveSamplingMetadata()
            updateSessionPanel()
            updateStatus("資料用途已切換：$dataSplit")
        }
        binding.buttonNewSession.setOnClickListener { startNewSession() }
        binding.editFloor.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                if (suppressMapSelectionApply) return
                applyMapSelection()
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })
        binding.editMapNumber.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                if (suppressMapSelectionApply) return
                applyMapSelection()
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })

        binding.buttonMoveUp.setOnClickListener { addPointByManualDirection("UP") }
        binding.buttonMoveDown.setOnClickListener { addPointByManualDirection("DOWN") }
        binding.buttonMoveLeft.setOnClickListener { addPointByManualDirection("LEFT") }
        binding.buttonMoveRight.setOnClickListener { addPointByManualDirection("RIGHT") }

        binding.radioSamplingQuality.setOnCheckedChangeListener { _, checkedId ->
            val (count, label) = when (checkedId) {
                R.id.radioQualityFast -> 3 to "\u5feb\u901f\u63a1\u96c6"
                R.id.radioQualityPrecise -> 30 to "\u7cbe\u5bc6\u63a1\u96c6"
                else -> 10 to "\u6a19\u6e96\u63a1\u6a23"
            }
            autoScanTargetCount = count
            binding.editAutoScanCount.setText(count.toString())
            updateSamplingRunState(false, "$label\uff0c\u76ee\u6a19 $count \u6b21")
            updatePointPanel()
            lifecycleScope.launch { refreshReplenishmentPanel() }
        }
        updateSamplingRunState(false, "\u63a1\u6a23\u72c0\u614b\uff1a\u5f85\u547d\uff0c\u6a19\u6e96\u63a1\u6a23 10 \u6b21")

        binding.buttonScanOnly.setOnClickListener {
            lifecycleScope.launch {
                val (results, freshness) = scanWifiOnce()
                latestScanFreshness = freshness
                updateStatus("掃描完成，AP 數量：${results.size}", apCount = results.size)
            }
        }
        binding.buttonSaveCurrentScan.setOnClickListener { saveCurrentScanFromManualInput() }
        binding.buttonScanAndSave.setOnClickListener {
            lifecycleScope.launch {
                val point = manualPointFromInput() ?: return@launch
                val (results, freshness) = scanWifiOnce()
                if (results.isNotEmpty()) saveScanResults(point, results, freshness)
            }
        }
    }

    private fun updateModeVisibility() {
        val isCompassMode = currentMode == SamplingMode.COMPASS_FORWARD
        val isMapMode = currentMode == SamplingMode.MAP_TAP
        val isManualMode = currentMode == SamplingMode.MANUAL

        binding.mapPanel.isVisible = isCompassMode || isMapMode
        binding.mainOperationPanel.isVisible = isCompassMode || isMapMode
        binding.currentPointPanel.isVisible = isCompassMode || isMapMode
        binding.compassPanel.isVisible = advancedOperationsExpanded && isCompassMode
        binding.advancedCorrectionPanel.isVisible = false
        binding.manualInputPanel.isVisible = isManualMode

        binding.buttonAddByCompass.isVisible = false
        binding.buttonAutoUniformForward.isVisible = false
        binding.buttonWalkAutoSample.isVisible = false
        binding.textWalkAutoProgress.isVisible = true
        binding.buttonStopWalkAuto.isVisible = true
        binding.buttonLockHeading.isVisible = true
        binding.buttonUndoPoint.isVisible = isCompassMode || isMapMode
        binding.buttonAddAnchor.isVisible = isCompassMode || isMapMode
        binding.buttonApCalibration.isVisible = isCompassMode || isMapMode
        updateAdvancedOperationsVisibility()
    }

    private fun toggleAdvancedOperations() {
        advancedOperationsExpanded = !advancedOperationsExpanded
        updateAdvancedOperationsVisibility()
    }

    private fun updateAdvancedOperationsVisibility() {
        binding.layoutAdvancedOperationInlineRow.isVisible =
            advancedOperationsExpanded && currentMode == SamplingMode.COMPASS_FORWARD
        binding.layoutAdvancedOperations.isVisible = advancedOperationsExpanded
        binding.buttonImportMap.isVisible = advancedOperationsExpanded
        binding.buttonCalibrateMapBoth.isVisible = advancedOperationsExpanded
        binding.buttonToggleMapCompactDisplay.isVisible = advancedOperationsExpanded
        binding.compassPanel.isVisible = advancedOperationsExpanded && currentMode == SamplingMode.COMPASS_FORWARD
        binding.samplingModePanel.isVisible = advancedOperationsExpanded
        binding.destructiveActionsPanel.isVisible = advancedOperationsExpanded
        binding.buttonResetUploadMarks.isVisible = advancedOperationsExpanded
        binding.buttonToggleAdvancedOperations.text = if (advancedOperationsExpanded) "收起操作" else "更多操作"
    }

    private fun runFieldReadinessCheck() {
        lifecycleScope.launch {
            val issues = mutableListOf<String>()
            if (!hasRequiredPermissions()) issues += "Wi-Fi、定位或活動辨識權限尚未完成"
            if (!wifiManager.isWifiEnabled) issues += "Wi-Fi 尚未開啟"
            if (backendMapId.isBlank() || backendFloorId.isBlank()) issues += "尚未選擇後端地圖與樓層"
            if (binding.mapSamplingView.width <= 0 || binding.mapSamplingView.height <= 0) issues += "地圖尚未完成載入"
            if (currentPoint == null) issues += "尚未選擇要測量的點位"

            val pendingCount = withContext(Dispatchers.IO) { dao.getPendingUploadRecords().size }
            val title = if (issues.isEmpty()) "可以開始測量" else "尚有 ${issues.size} 項需要處理"
            val message = buildString {
                append("範圍：")
                append(backendMapName.ifBlank { backendMapId.ifBlank { "未選擇" } })
                append(" / ")
                append(backendFloorName.ifBlank { backendFloorId.ifBlank { "未選擇" } })
                append("\n目前點位：")
                append(currentPoint?.displayLabel?.ifBlank { currentPoint?.pointId.orEmpty() } ?: "未選擇")
                append("\n待上傳：${pendingCount} 筆")
                if (issues.isNotEmpty()) {
                    append("\n\n")
                    append(issues.joinToString("\n") { "- $it" })
                }
            }
            AlertDialog.Builder(this@MainActivity)
                .setTitle(title)
                .setMessage(message)
                .setPositiveButton("確定", null)
                .show()
        }
    }

    private fun togglePointEditMode(mode: String) {
        if (scanInProgress || autoScanJob?.isActive == true || walkAutoScanJob?.isActive == true) {
            updateStatus("請先停止採集再編輯點位")
            return
        }
        waitingForCalibrationPoints = false
        waitingForHeadingCalibration = false
        binding.mapSamplingView.clearCalibrationOverlay()
        setPointEditMode(if (pointEditMode == mode) null else mode)
        updateStatus(when (pointEditMode) {
            "add" -> "請點選新點位置"
            "move" -> "請拖曳未採集點位；已採集點座標鎖定"
            else -> "已退出點位編輯"
        })
    }

    private fun setPointEditMode(mode: String?) {
        pointEditMode = mode
        binding.mapSamplingView.setPointDraggingEnabled(mode == "move")
        binding.buttonAddMapPoint.text = if (mode == "add") "取消新增" else "新增點位"
        binding.buttonMoveMapPoint.text = if (mode == "move") "取消移動" else "移動點位"
    }

    private fun showKeyPointDialog(x: Float, y: Float) {
        val floor = activeSamplingFloor() ?: return
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 8, 32, 0)
        }
        val isNodeCheck = CheckBox(this).apply {
            text = "作為導航節點"
            isChecked = false
        }
        val nameInput = EditText(this).apply {
            hint = "名稱，例如 K6 手扶梯、Joyfull"
            setSingleLine(true)
        }
        val keywordInput = EditText(this).apply {
            hint = "關鍵字，例如 手扶梯,K6,出口"
            setSingleLine(true)
        }
        val noteInput = EditText(this).apply {
            hint = "備註，例如 靠近東廣場"
            minLines = 2
        }
        val categoryNames = listOf("商家", "電梯", "手扶梯", "樓梯", "出口", "廁所", "販賣機", "置物櫃", "地下停車場", "服務台", "其他")
        val categoryChecks = categoryNames.map { category ->
            CheckBox(this).apply {
                text = category
                isChecked = category == "其他"
            }
        }
        val customCategoryInput = EditText(this).apply {
            hint = "新增分類，可用逗號分隔"
            setSingleLine(true)
        }
        container.addView(isNodeCheck)
        container.addView(TextView(this).apply { text = "分類設施（可複選）" })
        categoryChecks.forEach(container::addView)
        container.addView(customCategoryInput)
        container.addView(TextView(this).apply { text = "點位名稱" })
        container.addView(nameInput)
        container.addView(TextView(this).apply { text = "關鍵字" })
        container.addView(keywordInput)
        container.addView(TextView(this).apply { text = "備註" })
        container.addView(noteInput)

        val dialog = AlertDialog.Builder(this)
            .setTitle("新增重點點位")
            .setView(container)
            .setPositiveButton("建立", null)
            .setNegativeButton("取消", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val label = nameInput.text.toString().trim()
                if (label.isBlank()) {
                    nameInput.error = "請輸入點位名稱"
                    return@setOnClickListener
                }
                val categories = buildList {
                    categoryChecks.filter { it.isChecked }.mapTo(this) { it.text.toString() }
                    customCategoryInput.text.toString()
                        .split(',', '，', '、', '\n')
                        .map(String::trim)
                        .filter(String::isNotBlank)
                        .forEach { if (it !in this) add(it) }
                }.let { selected ->
                    val meaningful = selected.filter { it != "其他" }
                    meaningful.ifEmpty { listOf("其他") }
                }
                val keywords = keywordInput.text.toString().trim()
                val note = noteInput.text.toString().trim()
                addKeyPoint(x, y, floor, categories, label, keywords, note, isNodeCheck.isChecked)
                dialog.dismiss()
            }
        }
        dialog.show()
    }

    private fun addKeyPoint(x: Float, y: Float, floor: Int, categories: List<String>, label: String, keywords: String, note: String, isNode: Boolean) {
        val localId = nextKeyPointId()
        val backendNodeId = if (isNode) formalNodeIdFor(localId) else ""
        val displayName = label.ifBlank { localId }
        val pointNote = buildList {
            if (categories.isNotEmpty()) add(categories.joinToString("、"))
            if (displayName.isNotBlank()) add(displayName)
            if (keywords.isNotBlank()) add("關鍵字=$keywords")
            if (note.isNotBlank()) add("備註=$note")
            add("節點=${if (isNode) "是" else "否"}")
        }.joinToString("；")
        val point = SamplingPoint(
            pointId = localId,
            x = x,
            y = y,
            floor = floor,
            note = pointNote,
            sourceMode = "KEY_POINT",
            moveDirection = "KEY_POINT",
            intervalMeters = 0f,
            azimuth = safeAzimuth(),
            isStart = binding.mapSamplingView.getPoints().isEmpty(),
            displayLabel = displayName,
            backendNodeId = backendNodeId
        )
        addPoint(point, explicitlyCreated = true)
        syncBackendPlace(point, categories, displayName, keywords, note)
        if (isNode) syncDraggedBackendNode(point)
        autoScanTargetCount = 3
        binding.editAutoScanCount.setText("3")
        updateSamplingRunState(false, "${point.pointId} 已建立，請站在該位置後按「自動採樣」")
        updateStatus("${point.pointId} $pointNote\n座標：x=${point.x.format1()}, y=${point.y.format1()}, z=${activeSamplingMapId()} / ${backendFloorId.ifBlank { floorCode(floor) }}\n建議每點採樣 3 次")
    }

    private fun nextKeyPointId(): String {
        val maxNumber = binding.mapSamplingView.getPoints()
            .mapNotNull { point ->
                Regex("^K(\\d+)$").find(point.pointId)?.groupValues?.getOrNull(1)?.toIntOrNull()
            }
            .maxOrNull() ?: 0
        return "K%03d".format(maxNumber + 1)
    }

    private fun toggleMapCompactDisplay() {
        compactMapDisplay = !compactMapDisplay
        applyMapCompactDisplay(showStatus = true)
    }

    private fun applyMapCompactDisplay(showStatus: Boolean) {
        binding.mapSamplingView.setCompactDisplay(compactMapDisplay)
        binding.buttonToggleMapCompactDisplay.text = if (compactMapDisplay) {
            "點位文字：隱藏中"
        } else {
            "點位文字：顯示中"
        }
        binding.buttonToggleMapCompactDisplay.setBackgroundResource(
            if (compactMapDisplay) R.drawable.bg_button_secondary else R.drawable.bg_button_outline
        )
        binding.buttonToggleMapCompactDisplay.setTextColor(
            ContextCompat.getColor(this, if (compactMapDisplay) R.color.primary_blue_dark else R.color.text_primary)
        )
        if (!showStatus) return
        updateStatus(
            if (compactMapDisplay) {
                "\u9ede\u4f4d\u6587\u5b57\u5df2\u96b1\u85cf\uff0c\u76ee\u524d\u9ede\u4f4d\u4ecd\u6703\u986f\u793a"
            } else {
                "\u9ede\u4f4d\u6587\u5b57\u5df2\u986f\u793a"
            }
        )
    }

    private fun loadMapSettings() {
        val prefs = getSharedPreferences("map_settings", Context.MODE_PRIVATE)
        val mapId = activeSamplingMapId()
        val floor = activeSamplingFloor() ?: readFloorCodeOrNull() ?: 1
        val scopeKey = mapSettingsScopeKey(mapId, floor)
        currentMapId = mapId
        val allowLegacyFallback = backendMapId.isBlank() || backendFloorId.isBlank()
        importedMapPath = (
            prefs.getString("${scopeKey}_importedMapPath", null)
                ?: if (allowLegacyFallback) prefs.getString("${currentMapId}_importedMapPath", null) else null
                ?: if (allowLegacyFallback) prefs.getString("importedMapPath", null) else null
            )?.takeIf { File(it).exists() }
        metersPerPixel = prefs.getFloat("${scopeKey}_metersPerPixel", -1f)
            .takeIf { it > 0f }
            ?: if (allowLegacyFallback) prefs.getFloat("${currentMapId}_metersPerPixel", -1f).takeIf { it > 0f } else null
            ?: if (allowLegacyFallback) prefs.getFloat("metersPerPixel", -1f).takeIf { it > 0f } else null
        mapHeadingOffsetDegrees = prefs.getFloat("${scopeKey}_mapHeadingOffsetDegrees", Float.NaN)
            .takeIf { !it.isNaN() }
            ?: if (allowLegacyFallback) prefs.getFloat("${currentMapId}_mapHeadingOffsetDegrees", Float.NaN).takeIf { !it.isNaN() } else null
            ?: if (allowLegacyFallback) prefs.getFloat("mapHeadingOffsetDegrees", Float.NaN).takeIf { !it.isNaN() } else null
    }

    private fun saveMapSettings() {
        val mapId = activeSamplingMapId()
        val floor = activeSamplingFloor() ?: readFloorCodeOrNull() ?: 1
        val scopeKey = mapSettingsScopeKey(mapId, floor)
        getSharedPreferences("map_settings", Context.MODE_PRIVATE)
            .edit()
            .putString("${scopeKey}_importedMapPath", importedMapPath)
            .putFloat("${scopeKey}_metersPerPixel", metersPerPixel ?: -1f)
            .putFloat("${scopeKey}_mapHeadingOffsetDegrees", mapHeadingOffsetDegrees ?: Float.NaN)
            .apply()
    }

    private fun loadSamplingMetadata() {
        val prefs = getSharedPreferences("sampling_metadata", Context.MODE_PRIVATE)
        currentSessionId = prefs.getString("sessionId", null)
            ?: newSessionId().also { prefs.edit().putString("sessionId", it).apply() }
        dataSplit = prefs.getString("dataSplit", "TRAIN") ?: "TRAIN"
        pendingTransitionGroupId = prefs.getString("pendingTransitionGroupId", null)?.takeIf { it.isNotBlank() }
        pendingTransitionSourceMapId = prefs.getString("pendingTransitionSourceMapId", "") ?: ""
        pendingTransitionSourcePointId = prefs.getString("pendingTransitionSourcePointId", "") ?: ""
        pendingTransitionSourceType = prefs.getString("pendingTransitionSourceType", "") ?: ""
        pendingTransitionSourceNote = prefs.getString("pendingTransitionSourceNote", "") ?: ""
    }

    private fun saveSamplingMetadata() {
        getSharedPreferences("sampling_metadata", Context.MODE_PRIVATE)
            .edit()
            .putString("sessionId", currentSessionId)
            .putString("dataSplit", dataSplit)
            .putString("pendingTransitionGroupId", pendingTransitionGroupId.orEmpty())
            .putString("pendingTransitionSourceMapId", pendingTransitionSourceMapId)
            .putString("pendingTransitionSourcePointId", pendingTransitionSourcePointId)
            .putString("pendingTransitionSourceType", pendingTransitionSourceType)
            .putString("pendingTransitionSourceNote", pendingTransitionSourceNote)
            .apply()
    }

    private fun loadBackendScope() {
        val prefs = getSharedPreferences("backend", MODE_PRIVATE)
        val defaultBackendUrl = "https://maptest-02-server.onrender.com"
        val savedBackendUrl = prefs.getString("base_url", defaultBackendUrl).orEmpty()
        val normalizedBackendUrl = if (savedBackendUrl.contains("trycloudflare.com") || savedBackendUrl.contains("loca.lt")) {
            defaultBackendUrl
        } else {
            savedBackendUrl.ifBlank { defaultBackendUrl }
        }
        if (normalizedBackendUrl != savedBackendUrl) {
            prefs.edit().putString("base_url", normalizedBackendUrl).apply()
        }
        binding.editBackendUrl.setText(normalizedBackendUrl)
        backendMapId = prefs.getString("map_id", "") ?: ""
        backendFloorId = prefs.getString("floor_id", "") ?: ""
        backendMapName = prefs.getString("map_name", "") ?: ""
        backendFloorName = prefs.getString("floor_name", "") ?: ""
        migrateLegacyBackendScopeIfNeeded(prefs)
        syncFloorInputToBackendScope()
        updateBackendScopeText()
    }

    private fun migrateLegacyBackendScopeIfNeeded(prefs: SharedPreferences) {
        if (backendMapId == "F1_M1" && backendFloorId == "coordinate-demo-f1") {
            backendMapId = "k-area-airport"
            backendFloorId = "k-area-airport-1f"
            backendMapName = "K區地下街往機捷"
            backendFloorName = "1F"
            prefs.edit()
                .putString("map_id", backendMapId)
                .putString("floor_id", backendFloorId)
                .putString("map_name", backendMapName)
                .putString("floor_name", backendFloorName)
                .apply()
        }
        if (backendMapId == "k-area-airport" && backendFloorId in setOf("k-area-airport-f1", "k-area-airport-b1", "floor_1", "1", "1F", "B1", "-1")) {
            backendFloorId = "k-area-airport-1f"
            backendFloorName = "1F"
            prefs.edit()
                .putString("floor_id", backendFloorId)
                .putString("floor_name", backendFloorName)
                .apply()
        }
    }

    private fun saveBackendScope(map: BackendMap, floor: BackendFloor): Boolean {
        if (floor.mapId != map.id) {
            binding.textSyncStatus.text = "同步狀態：地圖與樓層不一致，請重新選擇。"
            showMessage("請重新選擇同一張地圖底下的樓層")
            return false
        }
        backendMapId = map.id
        backendFloorId = floor.id
        backendMapName = map.name
        backendFloorName = floor.name
        getSharedPreferences("backend", MODE_PRIVATE)
            .edit()
            .putString("map_id", backendMapId)
            .putString("floor_id", backendFloorId)
            .putString("map_name", backendMapName)
            .putString("floor_name", backendFloorName)
            .apply()
        syncFloorInputToBackendScope()
        updateBackendScopeText()
        return true
    }

    private fun backendSelectedFloorCode(): Int? {
        if (backendFloorId.isBlank()) return null
        return backendFloorCodeOrNull(
            BackendFloor(
                id = backendFloorId,
                mapId = backendMapId,
                name = backendFloorName,
                imageUrl = "",
                scaleValue = null,
                coordinateUnit = "",
                mapHeadingOffsetDegrees = null
            )
        )
    }

    private fun syncFloorInputToBackendScope() {
        val floor = backendSelectedFloorCode() ?: return
        val label = backendFloorName.takeIf { parseFloorCode(it) != null } ?: floorCode(floor)
        if (binding.editFloor.text.toString().trim().equals(label, ignoreCase = true)) return
        suppressMapSelectionApply = true
        binding.editFloor.setText(label)
        suppressMapSelectionApply = false
    }

    private fun updateBackendScopeText() {
        binding.textBackendScope.text = if (backendMapId.isBlank() || backendFloorId.isBlank()) {
            "後端範圍：尚未選擇，將使用本機 mapId / floor"
        } else {
            "後端範圍：${backendMapName.ifBlank { backendMapId }} / ${backendFloorName.ifBlank { backendFloorId }}\nmapId：$backendMapId\nfloorId：$backendFloorId"
        }
    }

    private fun showBackendScopeDialog() {
        val backendUrl = binding.editBackendUrl.text.toString().trim().trimEnd('/')
        if (backendUrl.isBlank()) {
            showMessage("請先輸入後端網址")
            binding.textSyncStatus.text = "同步狀態：請先輸入後端網址。"
            return
        }
        getSharedPreferences("backend", MODE_PRIVATE).edit()
            .putString("base_url", backendUrl)
            .apply()
        binding.textSyncStatus.text = "同步狀態：正在讀取後端地圖與樓層..."

        lifecycleScope.launch {
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    val maps = getBackendMaps(backendUrl)
                    val selectedMap = maps.firstOrNull { it.id == backendMapId } ?: maps.firstOrNull()
                    val floors = selectedMap?.let { getBackendFloors(backendUrl, it.id) }.orEmpty()
                    Triple(maps, selectedMap, floors)
                }
            }

            result.onSuccess { (maps, selectedMap, floors) ->
                if (maps.isEmpty() || selectedMap == null) {
                    binding.textSyncStatus.text = "同步狀態：後端目前沒有可選擇的地圖。"
                    showMessage("後端目前沒有地圖資料")
                    return@onSuccess
                }
                if (floors.isEmpty()) {
                    binding.textSyncStatus.text = "同步狀態：${selectedMap.name} 尚未建立樓層。"
                    showMessage("此地圖尚未建立樓層")
                    return@onSuccess
                }
                showBackendScopePicker(backendUrl, maps, selectedMap, floors)
            }.onFailure { error ->
                binding.textSyncStatus.text = "同步狀態：讀取後端範圍失敗\n${error.message ?: error.javaClass.simpleName}"
            }
        }
    }

    private fun showBackendScopePicker(
        backendUrl: String,
        maps: List<BackendMap>,
        initialMap: BackendMap,
        initialFloors: List<BackendFloor>
    ) {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 16, 32, 0)
        }
        val mapSpinner = Spinner(this)
        val floorSpinner = Spinner(this)
        container.addView(TextView(this).apply { text = "地圖" })
        container.addView(mapSpinner)
        container.addView(TextView(this).apply { text = "樓層" })
        container.addView(floorSpinner)

        var currentFloors = initialFloors.filter { it.mapId == initialMap.id }
        val mapAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, maps.map { it.label })
            .also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
        val floorAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, currentFloors.map { it.label })
            .also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
        mapSpinner.adapter = mapAdapter
        floorSpinner.adapter = floorAdapter
        val initialIndex = maps.indexOfFirst { it.id == initialMap.id }.coerceAtLeast(0)
        mapSpinner.setSelection(initialIndex)
        floorSpinner.setSelection(currentFloors.indexOfFirst { it.id == backendFloorId && it.mapId == initialMap.id }.coerceAtLeast(0))

        mapSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                val map = maps.getOrNull(position) ?: return
                lifecycleScope.launch {
                    val floors = runCatching {
                        withContext(Dispatchers.IO) { getBackendFloors(backendUrl, map.id) }
                    }.getOrDefault(emptyList())
                    val validFloors = floors.filter { it.mapId == map.id }
                    if (validFloors.isNotEmpty()) {
                        val previousSelectedFloorId = currentFloors.getOrNull(floorSpinner.selectedItemPosition)?.id
                        currentFloors = validFloors
                        floorAdapter.clear()
                        floorAdapter.addAll(validFloors.map { it.label })
                        floorAdapter.notifyDataSetChanged()
                        val selectedFloorIndex = validFloors.indexOfFirst {
                            it.id == previousSelectedFloorId ||
                                (map.id == backendMapId && it.id == backendFloorId)
                        }.coerceAtLeast(0)
                        floorSpinner.setSelection(selectedFloorIndex)
                    }
                }
            }

            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
        }

        AlertDialog.Builder(this)
            .setTitle("選擇後端地圖 / 樓層")
            .setView(container)
            .setNegativeButton("取消", null)
            .setPositiveButton("套用") { _, _ ->
                val map = maps.getOrNull(mapSpinner.selectedItemPosition) ?: return@setPositiveButton
                val floor = currentFloors.getOrNull(floorSpinner.selectedItemPosition) ?: return@setPositiveButton
                if (saveBackendScope(map, floor)) {
                    binding.textSyncStatus.text = "同步狀態：已選擇後端範圍 ${map.name} / ${floor.name}"
                    syncBackendFloorMap(backendUrl, map, floor)
                }
            }
            .show()
    }

    private fun syncBackendFloorMap(backendUrl: String, map: BackendMap, floor: BackendFloor) {
        if (floor.imageUrl.isBlank()) {
            binding.mapSamplingView.clearPoints()
            binding.mapSamplingView.clearNavigationRoute()
            clearRealtimeValidationMarkerNow()
            currentPoint = null
            pointIndex = 0
            lifecycleScope.launch { restoreCurrentMapPoints() }
            updateStatus("後端樓層尚未提供地圖圖片，已只載入目前樓層節點")
            return
        }

        lifecycleScope.launch {
            binding.textSyncStatus.text = "同步狀態：正在同步後端地圖..."
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    val localFloor = readFloorCodeOrNull() ?: readFloor() ?: 1
                    val targetFloor = backendFloorCodeOrNull(floor) ?: localFloor
                    val sameLocalScope = currentMapId == map.id && localFloor == targetFloor
                    val outputDir = getExternalFilesDir(null) ?: filesDir
                    val target = File(outputDir, backendFloorMapFileName(map.id, floor.id, floor.imageUrl))
                    val sameCachedImage = importedMapPath?.let { File(it).name == target.name && File(it).exists() } == true
                    val localRecordCount = dao.getRecordCountByMapAndFloor(map.id, targetFloor)
                    if (sameLocalScope && sameCachedImage && localRecordCount > 0) {
                        return@withContext BackendMapSyncResult(
                            target = File(importedMapPath!!),
                            skipped = true,
                            reason = "手機已有 $localRecordCount 筆本機採樣資料，已保留原本採樣底圖，避免點位偏移。"
                        )
                    }
                    downloadBackendFloorImage(backendUrl, floor.imageUrl, target)
                    BackendMapSyncResult(target = target, skipped = false, reason = "")
                }
            }

            result.onSuccess { syncResult ->
                if (syncResult.skipped) {
                    binding.mapSamplingView.setImportedMap(importedMapPath)
                    binding.mapSamplingView.setMetersPerPixel(metersPerPixel)
                    updateMapCalibrationStatus()
                    lifecycleScope.launch {
                        restoreCurrentMapPoints()
                        refreshAnchors()
                    }
                    binding.textSyncStatus.text = "同步狀態：${syncResult.reason}"
                    updateStatus(syncResult.reason)
                    return@onSuccess
                }
                val target = syncResult.target
                val existingPoints = binding.mapSamplingView.getPoints()
                val oldImageSize = importedMapPath?.let { readImageSize(File(it)) }
                val newImageSize = readImageSize(target)
                val targetFloor = backendFloorCodeOrNull(floor) ?: readFloorCodeOrNull() ?: 1
                val sameLocalScope = currentMapId == map.id && (readFloorCodeOrNull() ?: targetFloor) == targetFloor
                val sameCachedImage = importedMapPath?.let { File(it).name == target.name && File(it).exists() } == true
                if (sameLocalScope && sameCachedImage && existingPoints.isNotEmpty() && oldImageSize != null && newImageSize != null && oldImageSize.aspectDiff(newImageSize) > 0.01f) {
                    binding.textSyncStatus.text = "同步狀態：後端地圖比例不同，已保留手機目前地圖，避免點位偏移。"
                    updateStatus("後端地圖比例與手機目前地圖不同，未替換底圖。請先確認地圖版本。")
                    return@onSuccess
                }
                if (!sameLocalScope || !sameCachedImage) {
                    binding.mapSamplingView.clearPoints()
                    binding.mapSamplingView.clearNavigationRoute()
                    currentPoint = null
                    pointIndex = 0
                    positioningHistory.clear()
                    latestPositioningResult = null
                }

                currentMapId = map.id
                importedMapPath = target.absolutePath
                val backendScale = floor.scaleValue?.takeIf {
                    it > 0f && !floor.coordinateUnit.equals("pixel", ignoreCase = true)
                }
                val nextScale = if (sameLocalScope && sameCachedImage && existingPoints.isNotEmpty()) {
                    metersPerPixel ?: backendScale
                } else {
                    backendScale ?: metersPerPixel
                }
                metersPerPixel = nextScale
                mapHeadingOffsetDegrees = floor.mapHeadingOffsetDegrees ?: mapHeadingOffsetDegrees
                saveMapSettings()

                lifecycleScope.launch(Dispatchers.IO) {
                    mapMetadataDao.insertAll(
                        listOf(
                            MapMetadataEntity(
                                mapId = map.id,
                                mapMode = "BACKEND_SYNC",
                                exportedMapFile = target.name,
                                metersPerPixel = metersPerPixel,
                                coordinateUnit = "image_pixel",
                                calibrated = metersPerPixel != null || mapHeadingOffsetDegrees != null,
                                mapHeadingOffsetDegrees = mapHeadingOffsetDegrees
                            )
                        )
                    )
                }

                binding.mapSamplingView.setImportedMap(importedMapPath)
                binding.mapSamplingView.setMetersPerPixel(metersPerPixel)
                updateMapCalibrationStatus()
                lifecycleScope.launch {
                    restoreCurrentMapPoints()
                    refreshAnchors()
                }
                binding.textSyncStatus.text = buildString {
                    append("同步狀態：後端地圖已同步\n")
                    append("${map.name} / ${floor.name}\n")
                    append("點位座標：已載入目前範圍")
                }
                updateStatus("後端地圖已同步，已切換到 ${map.name} / ${floor.name}。")
            }.onFailure { error ->
                binding.textSyncStatus.text = "同步狀態：同步地圖失敗\n${error.message ?: error.javaClass.simpleName}"
            }
        }
    }

    private fun getBackendMaps(baseUrl: String): List<BackendMap> {
        val json = getJsonArray("$baseUrl/api/maps")
        return (0 until json.length()).mapNotNull { index ->
            val item = json.optJSONObject(index) ?: return@mapNotNull null
            val id = item.optString("id")
            if (id.isBlank()) null else BackendMap(id, item.optString("name", id))
        }
    }

    private fun getBackendFloors(baseUrl: String, mapId: String): List<BackendFloor> {
        val json = getJsonArray("$baseUrl/api/floors?mapId=${mapId.urlEncode()}")
        return (0 until json.length()).mapNotNull { index ->
            val item = json.optJSONObject(index) ?: return@mapNotNull null
            val id = item.optString("id")
            if (id.isBlank()) null else BackendFloor(
                id = id,
                mapId = item.optString("mapId", mapId).ifBlank { mapId },
                name = item.optString("floorName", id),
                imageUrl = item.optString("imageUrl"),
                scaleValue = item.optNullableFloat("scaleValue"),
                coordinateUnit = item.optString("coordinateUnit"),
                mapHeadingOffsetDegrees = item.optNullableFloat("mapHeadingOffsetDegrees")
            )
        }
    }

    private fun getBackendRouteNodes(baseUrl: String, mapId: String, floorId: String): List<BackendRouteNode> {
        val json = getJsonArray("$baseUrl/api/route-nodes?mapId=${mapId.urlEncode()}&floorId=${floorId.urlEncode()}")
        return (0 until json.length()).mapNotNull { index ->
            val item = json.optJSONObject(index) ?: return@mapNotNull null
            val id = item.optString("id")
            val x = item.optDouble("x", Double.NaN)
            val y = item.optDouble("y", Double.NaN)
            if (id.isBlank() || x.isNaN() || y.isNaN()) return@mapNotNull null
            BackendRouteNode(
                id = id,
                mapId = item.optString("mapId", mapId).ifBlank { mapId },
                floorId = item.optString("floorId", floorId).ifBlank { floorId },
                x = x.toFloat(),
                y = y.toFloat(),
                nodeType = item.optString("nodeType", "walkway"),
                label = item.optString("label", id),
                isWalkable = item.optBoolean("isWalkable", true)
            )
        }
    }

    private fun getBackendPlaces(baseUrl: String, mapId: String, floorId: String): List<BackendPlace> {
        val json = getJsonArray("$baseUrl/api/places?mapId=${mapId.urlEncode()}&floorId=${floorId.urlEncode()}")
        return (0 until json.length()).mapNotNull { index ->
            val item = json.optJSONObject(index) ?: return@mapNotNull null
            val id = item.optString("id")
            val x = item.optDouble("x", Double.NaN)
            val y = item.optDouble("y", Double.NaN)
            if (id.isBlank() || x.isNaN() || y.isNaN()) return@mapNotNull null
            BackendPlace(
                id = id,
                mapId = item.optString("mapId", mapId).ifBlank { mapId },
                floorId = item.optString("floorId", floorId).ifBlank { floorId },
                name = item.optString("name", id),
                category = item.optString("category", "其他"),
                categories = jsonCategories(item),
                description = item.optString("description"),
                keywords = item.optString("keywords"),
                routeNodeId = item.optString("routeNodeId"),
                x = x.toFloat(),
                y = y.toFloat()
            )
        }
    }

    private fun getBackendFingerprintPoints(baseUrl: String, mapId: String, floorId: String): List<BackendFingerprintPoint> {
        val endpoint = "$baseUrl/api/wifi-scans/points?mapId=${mapId.urlEncode()}&floorId=${floorId.urlEncode()}"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8000
            readTimeout = 12000
        }
        return try {
            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (statusCode !in 200..299) throw IOException(raw.ifBlank { "HTTP $statusCode" })
            val items = JSONObject(raw).optJSONArray("points") ?: JSONArray()
            (0 until items.length()).mapNotNull { index ->
                val item = items.optJSONObject(index) ?: return@mapNotNull null
                val pointId = item.optString("pointId").trim()
                val x = item.optDouble("x", Double.NaN)
                val y = item.optDouble("y", Double.NaN)
                if (pointId.isBlank() || x.isNaN() || y.isNaN()) return@mapNotNull null
                BackendFingerprintPoint(
                    pointId = pointId,
                    x = x.toFloat(),
                    y = y.toFloat(),
                    scanCount = item.optInt("scanCount", 0)
                )
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun postBackendRouteNode(baseUrl: String, node: BackendRouteNode) {
        val body = JSONObject()
            .put("id", node.id)
            .put("mapId", node.mapId)
            .put("floorId", node.floorId)
            .put("x", node.x)
            .put("y", node.y)
            .put("nodeType", node.nodeType.ifBlank { "poi" })
            .put("label", node.label.ifBlank { node.id })
            .toString()
        val connection = (URL("$baseUrl/api/route-nodes").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8000
            readTimeout = 12000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
        try {
            connection.outputStream.use { stream -> stream.write(body.toByteArray(Charsets.UTF_8)) }
            val statusCode = connection.responseCode
            if (statusCode !in 200..299) {
                val raw = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                throw IOException(raw.ifBlank { "HTTP $statusCode" })
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun syncBackendPlace(point: SamplingPoint, categories: List<String>, label: String, keywords: String, note: String) {
        val mapId = activeSamplingMapId().ifBlank { return }
        val floorId = backendFloorId.ifBlank { floorCode(point.floor) }
        val backendUrl = binding.editBackendUrl.text.toString().trim().trimEnd('/').ifBlank {
            "https://maptest-02-server.onrender.com"
        }
        lifecycleScope.launch {
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    postBackendPlace(
                        backendUrl = backendUrl,
                        point = point,
                        mapId = mapId,
                        floorId = floorId,
                        categories = categories.ifEmpty { listOf("其他") },
                        label = label.ifBlank { point.pointId },
                        keywords = keywords,
                        note = note
                    )
                }
            }
            result.onSuccess {
                binding.textSyncStatus.text = "同步狀態：點位 ${point.pointId} 已同步到後端"
            }.onFailure { error ->
                binding.textSyncStatus.text = "同步狀態：點位暫時未同步到後端\n${error.message ?: error.javaClass.simpleName}"
            }
        }
    }

    private fun postBackendPlace(
        backendUrl: String,
        point: SamplingPoint,
        mapId: String,
        floorId: String,
        categories: List<String>,
        label: String,
        keywords: String,
        note: String
    ) {
        val placeId = backendPlaceIdFor(mapId, floorId, point.pointId)
        val body = JSONObject()
            .put("id", placeId)
            .put("mapId", mapId)
            .put("floorId", floorId)
            .put("name", label)
            .put("category", categories.firstOrNull() ?: "其他")
            .put("categories", JSONArray(categories))
            .put("x", point.x)
            .put("y", point.y)
            .put("description", note.ifBlank { point.note })
            .put("keywords", keywords)
            .put("searchable", true)
            .toString()
        val connection = (URL("$backendUrl/api/places").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8000
            readTimeout = 12000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
        try {
            connection.outputStream.use { stream -> stream.write(body.toByteArray(Charsets.UTF_8)) }
            val statusCode = connection.responseCode
            if (statusCode !in 200..299) {
                val raw = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                throw IOException(raw.ifBlank { "HTTP $statusCode" })
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun backendPlaceIdFor(mapId: String, floorId: String, pointId: String): String {
        backendPlacesByPoint[pointId]?.takeIf { it.mapId == mapId && it.floorId == floorId }?.let { return it.id }
        return "mobile-place-${mapId.sanitizeFileToken()}-${floorId.sanitizeFileToken()}-${pointId.sanitizeFileToken()}"
    }

    private fun backendPlacePointId(place: BackendPlace, index: Int): String {
        Regex("""(?:^|-)K(\d{3,})(?:$|-)""", RegexOption.IGNORE_CASE)
            .find(place.id)
            ?.groupValues
            ?.getOrNull(1)
            ?.let { return "K$it" }
        Regex("""(?:^|-)P(\d{3,})(?:$|-)""", RegexOption.IGNORE_CASE)
            .find(place.id)
            ?.groupValues
            ?.getOrNull(1)
            ?.let { return "P$it" }
        val token = place.id
            .replace(Regex("[^A-Za-z0-9]+"), "_")
            .trim('_')
            .uppercase(Locale.US)
            .ifBlank { "PLACE_%03d".format(index + 1) }
        return "PL_$token"
    }

    private fun deleteBackendPlace(point: SamplingPoint) {
        val mapId = activeSamplingMapId().ifBlank { return }
        val floorId = backendFloorId.ifBlank { floorCode(point.floor) }
        val placeId = backendPlaceIdFor(mapId, floorId, point.pointId)
        val backendUrl = binding.editBackendUrl.text.toString().trim().trimEnd('/').ifBlank {
            "https://maptest-02-server.onrender.com"
        }
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val endpoint = "$backendUrl/api/places?placeId=${placeId.urlEncode()}"
                    val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                        requestMethod = "DELETE"
                        connectTimeout = 8000
                        readTimeout = 12000
                    }
                    try {
                        val statusCode = connection.responseCode
                        if (statusCode !in 200..299 && statusCode != 404) {
                            val raw = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                            throw IOException(raw.ifBlank { "HTTP $statusCode" })
                        }
                    } finally {
                        connection.disconnect()
                    }
                }
            }.onFailure { error ->
                binding.textSyncStatus.text = "同步狀態：後端地點暫時未刪除\n${error.message ?: error.javaClass.simpleName}"
            }
        }
    }

    private fun deleteBackendRouteNode(point: SamplingPoint) {
        val nodeId = point.backendNodeId.ifBlank { return }
        val backendUrl = binding.editBackendUrl.text.toString().trim().trimEnd('/').ifBlank {
            "https://maptest-02-server.onrender.com"
        }
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val endpoint = "$backendUrl/api/route-nodes?nodeId=${nodeId.urlEncode()}"
                    val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                        requestMethod = "DELETE"
                        connectTimeout = 8000
                        readTimeout = 12000
                    }
                    try {
                        val statusCode = connection.responseCode
                        if (statusCode !in 200..299 && statusCode != 404) {
                            val raw = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                            throw IOException(raw.ifBlank { "HTTP $statusCode" })
                        }
                    } finally {
                        connection.disconnect()
                    }
                }
            }.onFailure { error ->
                binding.textSyncStatus.text = "同步狀態：後端節點暫時未刪除\n${error.message ?: error.javaClass.simpleName}"
            }
        }
    }

    private fun categoriesFromPointNote(point: SamplingPoint): List<String> {
        val first = point.note.substringBefore("；").substringBefore("：").trim()
        return first.split('、', ',', '，').map(String::trim).filter(String::isNotBlank).ifEmpty { listOf("其他") }
    }

    private fun jsonCategories(item: JSONObject): List<String> {
        val values = mutableListOf<String>()
        item.optJSONArray("categories")?.let { array ->
            for (index in 0 until array.length()) {
                array.optString(index).trim().takeIf { it.isNotBlank() && it !in values }?.let(values::add)
            }
        }
        item.optString("category", "其他").trim().takeIf { values.isEmpty() && it.isNotBlank() }?.let(values::add)
        return values.ifEmpty { listOf("其他") }
    }

    private fun backendFloorMapFileName(mapId: String, floorId: String, imageUrl: String): String {
        val cleanMapId = mapId.sanitizeFileToken()
        val cleanFloorId = floorId.sanitizeFileToken()
        val extension = imageUrl.substringAfterLast('.', "png")
            .substringBefore('?')
            .lowercase(Locale.US)
            .takeIf { it in setOf("png", "jpg", "jpeg", "webp") }
            ?: "png"
        return "backend_floor_map_${cleanMapId}_${cleanFloorId}.$extension"
    }

    private fun downloadBackendFloorImage(baseUrl: String, imageUrl: String, target: File) {
        val resolvedUrl = if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
            imageUrl
        } else {
            "${baseUrl.trimEnd('/')}/${imageUrl.trimStart('/')}"
        }
        val connection = (URL(resolvedUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10000
            readTimeout = 20000
        }
        try {
            val statusCode = connection.responseCode
            if (statusCode !in 200..299) {
                val raw = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                throw IOException(raw.ifBlank { "HTTP $statusCode" })
            }
            target.parentFile?.mkdirs()
            connection.inputStream.use { input ->
                target.outputStream().use { output -> input.copyTo(output) }
            }
            if (BitmapFactory.decodeFile(target.absolutePath) == null) {
                target.delete()
                throw IOException("後端地圖圖片無法讀取")
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun readImageSize(file: File): ImageSize? {
        if (!file.exists() || file.length() <= 0L) return null
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, options)
        return if (options.outWidth > 0 && options.outHeight > 0) {
            ImageSize(options.outWidth, options.outHeight)
        } else {
            null
        }
    }

    private fun getJsonArray(endpoint: String): JSONArray {
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8000
            readTimeout = 10000
        }
        return try {
            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (statusCode !in 200..299) throw IOException(raw.ifBlank { "HTTP $statusCode" })
            JSONArray(raw)
        } finally {
            connection.disconnect()
        }
    }

    private fun startNewSession() {
        currentSessionId = newSessionId()
        dataSplit = "TRAIN"
        saveSamplingMetadata()
        binding.radioSplitTrain.isChecked = true
        updateSessionPanel()
        updateStatus("新採集場次：$currentSessionId")
    }

    private fun updateSessionPanel() {
        val splitText = if (dataSplit == "TEST") "測試資料" else "訓練資料"
        val pending = pendingLinkText()
        binding.textSessionInfo.text = "採集場次：$currentSessionId\n資料用途：$splitText\n裝置：${deviceModelText()} / Android ${Build.VERSION.RELEASE}$pending"
    }

    private fun pendingLinkText(): String {
        val group = pendingTransitionGroupId ?: return ""
        if (group.isBlank()) return ""
        return "\n\u5f85\u63a5\u7e8c\u9023\u63a5\uff1a$group\uff0c\u4f86\u6e90 ${pendingTransitionSourceMapId.ifBlank { "-" }} / ${pendingTransitionSourcePointId.ifBlank { "-" }}"
    }

    private fun applyMapSelection() {
        if (backendMapId.isNotBlank() && backendFloorId.isNotBlank()) {
            val requestedFloor = readFloorCodeOrNull()
            val backendFloor = backendFloorCodeOrNull(
                BackendFloor(
                    id = backendFloorId,
                    mapId = backendMapId,
                    name = backendFloorName,
                    imageUrl = "",
                    scaleValue = null,
                    coordinateUnit = "",
                    mapHeadingOffsetDegrees = null
                )
            )
            if (requestedFloor != null && backendFloor != null && requestedFloor != backendFloor) {
                switchBackendFloorByCode(requestedFloor)
                return
            }
            currentMapId = backendMapId
            loadMapSettings()
            binding.mapSamplingView.setImportedMap(importedMapPath)
            binding.mapSamplingView.setMetersPerPixel(metersPerPixel)
            binding.mapSamplingView.clearPoints()
            binding.mapSamplingView.clearNavigationRoute()
            clearRealtimeValidationMarkerNow()
            currentPoint = null
            pointIndex = 0
            positioningHistory.clear()
            latestPositioningResult = null
            lifecycleScope.launch {
                refreshAnchors()
                restoreCurrentMapPoints()
            }
            return
        }
        val newMapId = currentMapIdFromInputs()
        if (newMapId == currentMapId) return
        currentMapId = newMapId
        loadMapSettings()
        binding.mapSamplingView.setImportedMap(importedMapPath)
        binding.mapSamplingView.setMetersPerPixel(metersPerPixel)
        binding.mapSamplingView.clearPoints()
        binding.mapSamplingView.clearNavigationRoute()
        clearRealtimeValidationMarkerNow()
        currentPoint = null
        pointIndex = 0
        positioningHistory.clear()
        latestPositioningResult = null
        updateMapCalibrationStatus()
        lifecycleScope.launch {
            refreshAnchors()
            restoreCurrentMapPoints()
        }
        updatePointPanel()
        updateStatus("\u5df2\u5207\u63db\u5230\u5730\u5716 $currentMapId\uff0c\u5df2\u5617\u8a66\u8f09\u5165\u65e2\u6709\u63a1\u6a23\u9ede")
    }

    private fun switchBackendFloorByCode(floor: Int) {
        val mapId = backendMapId.takeIf { it.isNotBlank() } ?: return
        val backendUrl = binding.editBackendUrl.text.toString().trim().trimEnd('/').ifBlank {
            "https://maptest-02-server.onrender.com"
        }
        lifecycleScope.launch {
            binding.textSyncStatus.text = "同步狀態：正在切換到 ${floorDisplayName(floor)}..."
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    getBackendFloors(backendUrl, mapId)
                }
            }
            result.onSuccess { floors ->
                val targetFloor = floors.firstOrNull { it.mapId == mapId && backendFloorCodeOrNull(it) == floor }
                if (targetFloor == null) {
                    binding.mapSamplingView.clearPoints()
                    binding.mapSamplingView.clearNavigationRoute()
                    clearRealtimeValidationMarkerNow()
                    currentPoint = null
                    pointIndex = 0
                    updatePointPanel()
                    binding.textSyncStatus.text = "同步狀態：後端沒有 ${floorDisplayName(floor)}，未載入舊點。"
                    updateStatus("後端沒有 ${floorDisplayName(floor)}，請先在後端建立樓層或選擇正確範圍。")
                    return@onSuccess
                }
                val map = BackendMap(mapId, backendMapName.ifBlank { mapId })
                if (saveBackendScope(map, targetFloor)) {
                    currentMapId = map.id
                    loadMapSettings()
                    binding.mapSamplingView.clearPoints()
                    binding.mapSamplingView.clearNavigationRoute()
                    clearRealtimeValidationMarkerNow()
                    currentPoint = null
                    pointIndex = 0
                    positioningHistory.clear()
                    latestPositioningResult = null
                    syncBackendFloorMap(backendUrl, map, targetFloor)
                }
            }.onFailure { error ->
                binding.textSyncStatus.text = "同步狀態：切換樓層失敗\n${error.message ?: error.javaClass.simpleName}"
            }
        }
    }

    private suspend fun restoreCurrentMapPoints() {
        setPointEditMode(null)
        currentMapId = activeSamplingMapId()
        val backendUrl = binding.editBackendUrl.text.toString().trim().trimEnd('/').ifBlank {
            "https://maptest-02-server.onrender.com"
        }
        val mapId = backendMapId.ifBlank { currentMapId }
        val floorId = backendFloorId
        val floor = activeSamplingFloor() ?: readFloorCodeOrNull() ?: 1
        val restoredPlaces = mutableMapOf<String, BackendPlace>()
        val backendPoints = if (mapId.isNotBlank() && floorId.isNotBlank()) {
            runCatching {
                withContext(Dispatchers.IO) {
                    val placePoints = getBackendPlaces(backendUrl, mapId, floorId).mapIndexed { index, place ->
                        val pointId = backendPlacePointId(place, index)
                        restoredPlaces[pointId] = place
                        val sampleCount = dao.getSampleCountByPointScope(pointId, listOf(mapId), floor)
                        SamplingPoint(
                            pointId = pointId,
                            x = place.x,
                            y = place.y,
                            floor = floor,
                            note = listOf(place.category, place.keywords, place.description)
                                .filter { it.isNotBlank() }
                                .joinToString("；"),
                            sourceMode = "BACKEND_PLACE",
                            moveDirection = "BACKEND_PLACE",
                            intervalMeters = 0f,
                            azimuth = safeAzimuth(),
                            isStart = index == 0,
                            sampled = sampleCount > 0,
                            displayLabel = place.name.ifBlank { pointId },
                            backendNodeId = place.routeNodeId
                        )
                    }
                    val existingIds = placePoints.map { it.pointId }.toSet()
                    val missingFingerprintPoints = getBackendFingerprintPoints(backendUrl, mapId, floorId)
                        .filter { fingerprint ->
                            fingerprint.pointId !in existingIds && placePoints.none { place ->
                                kotlin.math.abs(place.x - fingerprint.x) <= 3f &&
                                    kotlin.math.abs(place.y - fingerprint.y) <= 3f
                            }
                        }
                        .mapIndexed { index, fingerprint ->
                            SamplingPoint(
                                pointId = fingerprint.pointId,
                                x = fingerprint.x,
                                y = fingerprint.y,
                                floor = floor,
                                note = "既有指紋點；${fingerprint.scanCount} 筆掃描",
                                sourceMode = "BACKEND_FINGERPRINT",
                                moveDirection = "BACKEND_FINGERPRINT",
                                intervalMeters = 0f,
                                azimuth = safeAzimuth(),
                                isStart = placePoints.isEmpty() && index == 0,
                                sampled = fingerprint.scanCount > 0,
                                displayLabel = fingerprint.pointId
                            )
                        }
                    placePoints + missingFingerprintPoints
                }
            }.getOrElse {
                updateStatus("點位同步失敗：${it.message}，請重新整理地圖後再採集。")
                return
            }
        } else {
            emptyList()
        }
        if (backendMapId.ifBlank { activeSamplingMapId() } != mapId || backendFloorId != floorId ||
            scanInProgress || autoScanJob?.isActive == true || walkAutoScanJob?.isActive == true) return
        currentPoint = null
        backendPlacesByPoint = restoredPlaces
        binding.mapSamplingView.replacePoints(backendPoints, null)
        pointIndex = backendPoints
            .mapNotNull { point -> Regex("^(?:K|P)(\\d+)$").find(point.pointId)?.groupValues?.getOrNull(1)?.toIntOrNull() }
            .maxOrNull() ?: backendPoints.size
        updatePointPanel()
        refreshReplenishmentPanel()
    }

    private fun importMapFromUri(uri: Uri) {
        lifecycleScope.launch {
            try {
                val extension = when (contentResolver.getType(uri)) {
                    "image/png" -> "png"
                    "image/jpeg" -> "jpg"
                    else -> "map"
                }
                currentMapId = currentMapIdFromInputs()
                val floor = readFloorCodeOrNull() ?: 1
                val existingRecordCount = dao.getRecordCountByMapAndFloor(currentMapId, floor)
                val oldImageSize = importedMapPath?.let { readImageSize(File(it)) }
                val target = File(filesDir, "imported_floor_map_${currentMapId}.$extension")
                val tempTarget = File(filesDir, "pending_imported_floor_map_${currentMapId}.$extension")
                contentResolver.openInputStream(uri)?.use { input ->
                    tempTarget.outputStream().use { output -> input.copyTo(output) }
                } ?: throw IOException("Cannot open selected map")
                val newImageSize = readImageSize(tempTarget)
                if (existingRecordCount > 0 && oldImageSize != null && newImageSize != null && oldImageSize.aspectDiff(newImageSize) > 0.01f) {
                    tempTarget.delete()
                    updateStatus("匯入地圖已停止：這個地圖 / 樓層已有 $existingRecordCount 筆指紋，新圖比例不同。請改樓層或地圖編號建立新的 z 範圍。")
                    showMessage("新圖比例不同，未覆蓋舊地圖")
                    return@launch
                }
                tempTarget.copyTo(target, overwrite = true)
                tempTarget.delete()
                importedMapPath = target.absolutePath
                metersPerPixel = null
                saveMapSettings()
                binding.mapSamplingView.setImportedMap(importedMapPath)
                binding.mapSamplingView.setMetersPerPixel(null)
                updateMapCalibrationStatus()
                updateStatus("已匯入地圖：座標使用圖片像素 x/y，z=${currentMapId}/${floorCode(floor)}。請校正比例與方向。")
            } catch (exception: Exception) {
                latestError = "匯入地圖失敗：${exception.message}"
                updateStatus(latestError)
            }
        }
    }

    private fun startMapCalibration() {
        if (importedMapPath == null) {
            updateStatus("請先匯入地圖")
            showMessage("請先匯入地圖")
            return
        }
        waitingForHeadingCalibration = false
        headingCalibrationPoints.clear()
        calibrationRawPoints.clear()
        binding.mapSamplingView.clearCalibrationOverlay()
        binding.mapSamplingView.setPointDraggingEnabled(false)
        waitingForCalibrationPoints = true
        calibrationMode = "SCALE"
        setCalibrationButtonState("SCALE")
        updateStatus("比例校正：請在地圖上依序點選 C1、C2")
        binding.textMapCalibrationStatus.text = "\u8acb\u5728\u5730\u5716\u4e0a\u9ede\u9078 C1 \u8207 C2"
        binding.textMapCalibrationGuide.text = "\u5169\u9ede\u6821\u6b63\uff1a\u7ad9\u5728 C1\uff0c\u624b\u6a5f\u9802\u7aef\u671d\u5411 C2\uff0c\u4f9d\u5e8f\u9ede\u9078 C1\u3001C2\u5f8c\u8f38\u5165\u5be6\u969b\u8ddd\u96e2\u3002"
        showMessage("請在地圖上點選 C1，再點選 C2")
    }

    private fun startCombinedMapCalibration() {
        if (importedMapPath == null) {
            updateStatus("請先匯入地圖")
            showMessage("請先匯入地圖")
            return
        }
        if (currentAzimuth.isNaN()) {
            updateStatus("目前無法取得方位角，不能進行方向校正")
            showMessage("\u76ee\u524d\u7121\u6cd5\u53d6\u5f97\u65b9\u4f4d\u89d2")
            return
        }
        waitingForHeadingCalibration = false
        headingCalibrationPoints.clear()
        calibrationRawPoints.clear()
        binding.mapSamplingView.clearCalibrationOverlay()
        binding.mapSamplingView.setPointDraggingEnabled(false)
        waitingForCalibrationPoints = true
        calibrationMode = "BOTH"
        headingCalibrationAzimuth = currentAzimuth
        setCalibrationButtonState("BOTH")
        updateStatus("兩點校正：先點 C1，再走向 C2 並點選 C2")
        binding.textMapCalibrationStatus.text = "兩點校正：請點選 C1"
        binding.textMapCalibrationGuide.text = "\u5169\u9ede\u6821\u6b63\uff1a\u7ad9\u5728 C1\uff0c\u624b\u6a5f\u9802\u7aef\u671d\u5411 C2\uff0c\u4f9d\u5e8f\u9ede\u9078 C1\u3001C2\u5f8c\u8f38\u5165\u5be6\u969b\u8ddd\u96e2\u3002"
        showMessage("請點選 C1，再點選 C2")
    }

    private fun startHeadingCalibration() {
        if (currentAzimuth.isNaN()) {
            updateStatus("目前無法取得方位角，不能進行方向校正")
            showMessage("\u76ee\u524d\u7121\u6cd5\u53d6\u5f97\u65b9\u4f4d\u89d2")
            return
        }
        calibrationRawPoints.clear()
        headingCalibrationPoints.clear()
        binding.mapSamplingView.clearCalibrationOverlay()
        binding.mapSamplingView.setPointDraggingEnabled(false)
        waitingForCalibrationPoints = false
        calibrationMode = "HEADING"
        waitingForHeadingCalibration = true
        headingCalibrationAzimuth = currentAzimuth
        setCalibrationButtonState("HEADING")
        updateStatus("\u65b9\u5411\u6821\u6b63\uff1a\u8acb\u4f9d\u5e8f\u9ede\u9078\u7dda\u6bb5\u8d77\u9ede\u8207\u7d42\u9ede")
        binding.textMapCalibrationStatus.text = "\u65b9\u5411\u6821\u6b63\uff1a\u8acb\u9ede\u9078\u7b2c\u4e00\u9ede"
        binding.textMapCalibrationGuide.text = "\u8acb\u6cbf\u8457\u73fe\u5834\u524d\u9032\u65b9\u5411\u5728\u5730\u5716\u4e0a\u9ede\u5169\u9ede\uff0cApp \u6703\u6821\u6b63\u5730\u5716\u65b9\u5411\u3002"
        showMessage("請在地圖上點選方向線的第一點")
    }

    private fun handleHeadingCalibrationTap(x: Float, y: Float) {
        headingCalibrationPoints.add(x to y)
        binding.mapSamplingView.addCalibrationPointMeters(x, y)
        if (headingCalibrationPoints.size == 1) {
            updateStatus("方向校正：已選 C1，請點選 C2")
            binding.textMapCalibrationStatus.text = "\u65b9\u5411\u6821\u6b63\uff1a\u8acb\u9ede\u9078\u7b2c\u4e8c\u9ede"
            showMessage("已選 C1，請點選 C2")
            return
        }
        waitingForHeadingCalibration = false
        val first = headingCalibrationPoints[0]
        val second = headingCalibrationPoints[1]
        val mapAngle = normalizeDegrees(
            Math.toDegrees(
                atan2(
                    (second.first - first.first).toDouble(),
                    (first.second - second.second).toDouble()
                )
            ).toFloat()
        )
        mapHeadingOffsetDegrees = normalizeDegrees(mapAngle - headingCalibrationAzimuth)
        currentDirectionCode = mapDirectionCode(currentAzimuth)
        currentDirectionText = directionTextFromCode(currentDirectionCode)
        headingCalibrationPoints.clear()
        binding.mapSamplingView.clearCalibrationOverlay()
        setPointEditMode(null)
        saveMapSettings()
        updateMapCalibrationStatus()
        setCalibrationButtonState(null)
        updateStatus("方向校正完成：偏移 ${mapHeadingOffsetDegrees!!.format1()}°，目前方向 $currentDirectionText")
        showMessage("方向校正完成")
    }

    private fun handleCalibrationTap(rawX: Float, rawY: Float) {
        calibrationRawPoints.add(rawX to rawY)
        binding.mapSamplingView.addCalibrationPoint(rawX, rawY)
        if (calibrationRawPoints.size == 1) {
            binding.textMapCalibrationStatus.text = "\u6bd4\u4f8b\u6821\u6b63\uff1a\u8acb\u9ede\u9078 C2"
            updateStatus("比例校正：已選 C1，請點選 C2")
            showMessage("已選 C1，請點選 C2")
            return
        }
        waitingForCalibrationPoints = false
        showCalibrationDistanceDialog()
    }

    private fun showCalibrationDistanceDialog() {
        val input = EditText(this).apply {
            hint = "實際距離，例如 10.0"
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
            minHeight = 48
        }
        AlertDialog.Builder(this)
            .setTitle("\u8f38\u5165\u5be6\u969b\u8ddd\u96e2")
            .setMessage("\u8acb\u8f38\u5165\u5169\u9ede\u4e4b\u9593\u7684\u5be6\u969b\u8ddd\u96e2\uff08\u516c\u5c3a\uff09")
            .setView(input)
            .setPositiveButton("\u78ba\u5b9a") { _, _ ->
                val meters = input.text.toString().toFloatOrNull()
                if (meters == null || meters <= 0f) {
                    setPointEditMode(null)
                    updateStatus("\u6821\u6b63\u5931\u6557\uff1a\u8ddd\u96e2\u5fc5\u9808\u5927\u65bc 0")
                    return@setPositiveButton
                }
                val first = calibrationRawPoints.getOrNull(0)
                val second = calibrationRawPoints.getOrNull(1)
                if (first == null || second == null) {
                    setPointEditMode(null)
                    updateStatus("\u6821\u6b63\u5931\u6557\uff1a\u7f3a\u5c11\u5169\u500b\u9ede")
                    return@setPositiveButton
                }
                val pixelDistance = kotlin.math.hypot(
                    (second.first - first.first).toDouble(),
                    (second.second - first.second).toDouble()
                ).toFloat()
                if (pixelDistance <= 0f) {
                    setPointEditMode(null)
                    updateStatus("\u6821\u6b63\u5931\u6557\uff1a\u5169\u9ede\u592a\u63a5\u8fd1")
                    return@setPositiveButton
                }
                metersPerPixel = meters / pixelDistance
                if (calibrationMode == "BOTH") {
                    val mapAngle = normalizeDegrees(
                        Math.toDegrees(
                            atan2(
                                (second.first - first.first).toDouble(),
                                (first.second - second.second).toDouble()
                            )
                        ).toFloat()
                    )
                    mapHeadingOffsetDegrees = normalizeDegrees(mapAngle - headingCalibrationAzimuth)
                    currentDirectionCode = mapDirectionCode(currentAzimuth)
                    currentDirectionText = directionTextFromCode(currentDirectionCode)
                }
                saveMapSettings()
                binding.mapSamplingView.setMetersPerPixel(metersPerPixel)
                updateMapCalibrationStatus()
                setCalibrationButtonState(null)
                val doneMessage = if (calibrationMode == "BOTH") {
                    "\u5df2\u6821\u6b63\u6bd4\u4f8b\uff1a1 px = ${metersPerPixel!!.format3()} m\uff0c\u65b9\u5411\u504f\u79fb ${mapHeadingOffsetDegrees!!.format1()}\u00b0"
                } else {
                    "\u5df2\u6821\u6b63\u6bd4\u4f8b\uff1a1 px = ${metersPerPixel!!.format3()} m"
                }
                calibrationMode = null
                calibrationRawPoints.clear()
                headingCalibrationPoints.clear()
                binding.mapSamplingView.clearCalibrationOverlay()
                setPointEditMode(null)
                updateStatus(doneMessage)
                showMessage(if (mapHeadingOffsetDegrees != null) "地圖校正完成" else "比例校正完成")
            }
            .setNegativeButton("\u53d6\u6d88") { _, _ ->
                calibrationRawPoints.clear()
                binding.mapSamplingView.clearCalibrationOverlay()
                setPointEditMode(null)
                waitingForCalibrationPoints = false
                calibrationMode = null
                setCalibrationButtonState(null)
                updateMapCalibrationStatus()
            }
            .show()
    }

    private fun convertExistingPointsAfterScaleChange(oldScale: Float?, newScale: Float) {
        if (newScale <= 0f) return
        val points = binding.mapSamplingView.getPoints()
        if (points.isEmpty()) return
        val factor = if (oldScale != null && oldScale > 0f) {
            newScale / oldScale
        } else {
            newScale
        }
        if (factor <= 0f || kotlin.math.abs(factor - 1f) < 0.0001f) return
        val currentId = currentPoint?.pointId
        val converted = points.map { point ->
            point.copy(
                x = point.x * factor,
                y = point.y * factor
            )
        }
        currentPoint = converted.firstOrNull { it.pointId == currentId } ?: converted.lastOrNull()
        pointIndex = converted.size
        binding.mapSamplingView.replacePoints(converted, currentPoint?.pointId)
        updatePointPanel()
    }

    private fun setCalibrationButtonState(activeMode: String?) {
        val scaleActive = activeMode == "SCALE"
        val headingActive = activeMode == "HEADING"
        val bothActive = activeMode == "BOTH"
        binding.buttonCalibrateMap.text = if (scaleActive) "比例校正中：點 C1/C2" else "校正比例"
        binding.buttonCalibrateMapHeading.text = if (headingActive) "方向校正中：點 C1/C2" else "校正地圖方向"
        binding.buttonCalibrateMapBoth.text = if (bothActive) "兩點校正中：點 C1/C2" else "兩點校正地圖"
        binding.buttonCalibrateMap.setBackgroundResource(
            if (scaleActive) R.drawable.bg_button_secondary else R.drawable.bg_button_outline
        )
        binding.buttonCalibrateMapHeading.setBackgroundResource(
            if (headingActive) R.drawable.bg_button_secondary else R.drawable.bg_button_outline
        )
        binding.buttonCalibrateMapBoth.setBackgroundResource(
            if (bothActive) R.drawable.bg_button_secondary else R.drawable.bg_button_secondary
        )
        binding.buttonCalibrateMap.setTextColor(
            ContextCompat.getColor(this, if (scaleActive) R.color.primary_blue_dark else R.color.text_primary)
        )
        binding.buttonCalibrateMapHeading.setTextColor(
            ContextCompat.getColor(this, if (headingActive) R.color.primary_blue_dark else R.color.text_primary)
        )
        binding.buttonCalibrateMapBoth.setTextColor(
            ContextCompat.getColor(this, R.color.primary_blue_dark)
        )
    }

    private fun updateMapCalibrationStatus() {
        val path = importedMapPath
        val scale = metersPerPixel
        binding.textMapCalibrationStatus.text = when {
            path == null -> "\u5c1a\u672a\u532f\u5165\u5730\u5716\uff1b\u76ee\u524d\u4f7f\u7528\u81ea\u52d5\u7e6a\u88fd\u5e73\u9762\u5716"
            scale == null -> "\u5df2\u532f\u5165\u5730\u5716\uff0c\u5c1a\u672a\u6821\u6b63\u6bd4\u4f8b"
            else -> {
                val heading = mapHeadingOffsetDegrees?.let { "\uff0c\u65b9\u5411\u504f\u79fb ${it.format1()}\u00b0" }.orEmpty()
                "已校正比例：1 px = ${scale.format3()} m，CSV x/y 會以真實公尺輸出$heading"
            }
        }
    }

    private fun registerWifiReceiver() {
        if (receiverRegistered) return
        val filter = IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(wifiScanReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(wifiScanReceiver, filter)
        }
        receiverRegistered = true
    }

    private fun requestRequiredPermissions() {
        val permissions = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.NEARBY_WIFI_DEVICES)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            permissions.add(Manifest.permission.ACTIVITY_RECOGNITION)
        }
        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            permissionStatus = "Permission granted"
            updateStatus("Permission granted")
        } else {
            permissionStatus = "缺少 Wi-Fi / 位置權限"
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun hasRequiredPermissions(): Boolean {
        val fineLocation = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val nearbyWifi = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.NEARBY_WIFI_DEVICES
            ) == PackageManager.PERMISSION_GRANTED
        val activityRecognition = hasActivityRecognitionPermission()
        val granted = fineLocation && nearbyWifi
        permissionStatus = when {
            !granted -> "Missing Wi-Fi / location permission"
            !activityRecognition -> "缺少身體活動權限"
            else -> "Permission granted"
        }
        return granted
    }

    private fun hasActivityRecognitionPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACTIVITY_RECOGNITION
            ) == PackageManager.PERMISSION_GRANTED

    private fun addPointByCompass() {
        val basePoint = currentPoint
        if (basePoint == null) {
            updateStatus("請先在地圖上建立起點")
            showMessage("請先在地圖上建立起點")
            return
        }
        val effectiveAzimuth = effectiveForwardAzimuth()
        if ((!headingLocked && !compassManager.isAvailable) || effectiveAzimuth.isNaN()) {
            showMessage("\u76ee\u524d\u7121\u6cd5\u53d6\u5f97\u65b9\u4f4d\u89d2")
            return
        }
        if (!headingLocked && !compassStable) {
            updateStatus("\u65b9\u4f4d\u4e0d\u7a69\uff0c\u8acb\u7a0d\u5019\u6216\u9396\u5b9a\u65b9\u5411")
            showMessage("\u65b9\u4f4d\u4e0d\u7a69\uff0c\u8acb\u7a0d\u5019\u6216\u9396\u5b9a\u65b9\u5411")
            return
        }
        val interval = readIntervalMeters() ?: return
        val mapDirectionCode = mapDirectionCode(effectiveAzimuth)
        val mapDirectionText = directionTextFromCode(mapDirectionCode)
        val next = nextPointFromDirection(
            basePoint = basePoint,
            direction = mapDirectionCode,
            sourceMode = "COMPASS_FORWARD",
            moveDirection = mapDirectionCode,
            interval = interval,
            azimuth = effectiveAzimuth
        )
        addPoint(next)
        updateStatus("由 ${basePoint.pointId} 依目前朝向 ${mapDirectionText} 前進 ${interval.format1()}m，建立 ${next.pointId}")
    }

    private fun addPointByManualDirection(direction: String) {
        val basePoint = currentPoint
        if (basePoint == null) {
            updateStatus("請先在地圖上建立起點")
            showMessage("請先在地圖上建立起點")
            return
        }
        val interval = readIntervalMeters() ?: return
        val next = nextPointFromDirection(
            basePoint = basePoint,
            direction = direction,
            sourceMode = "DIRECTION_BUTTON",
            moveDirection = direction,
            interval = interval,
            azimuth = safeAzimuth()
        )
        addPoint(next)
        updateStatus("由 ${basePoint.pointId} 手動往 $direction ${interval.format1()}m，建立 ${next.pointId}")
    }

    private fun nextPointFromDirection(
        basePoint: SamplingPoint,
        direction: String,
        sourceMode: String,
        moveDirection: String,
        interval: Float,
        azimuth: Float
    ): SamplingPoint {
        val diagonal = interval / sqrt(2f)
        val (nextX, nextY) = when (direction) {
            "NORTH", "UP" -> basePoint.x to basePoint.y - interval
            "NORTH_EAST" -> basePoint.x + diagonal to basePoint.y - diagonal
            "EAST", "RIGHT" -> basePoint.x + interval to basePoint.y
            "SOUTH_EAST" -> basePoint.x + diagonal to basePoint.y + diagonal
            "SOUTH", "DOWN" -> basePoint.x to basePoint.y + interval
            "SOUTH_WEST" -> basePoint.x - diagonal to basePoint.y + diagonal
            "WEST", "LEFT" -> basePoint.x - interval to basePoint.y
            "NORTH_WEST" -> basePoint.x - diagonal to basePoint.y - diagonal
            else -> basePoint.x to basePoint.y
        }
        return createPoint(
            x = nextX,
            y = nextY,
            floor = activeSamplingFloor() ?: basePoint.floor,
            note = "",
            sourceMode = sourceMode,
            moveDirection = moveDirection,
            intervalMeters = interval,
            azimuth = azimuth,
            isStart = false
        )
    }

    private fun createPoint(
        x: Float,
        y: Float,
        floor: Int,
        note: String,
        sourceMode: String,
        moveDirection: String,
        intervalMeters: Float = readIntervalMeters() ?: 1.5f,
        azimuth: Float,
        isStart: Boolean
    ): SamplingPoint {
        pointIndex += 1
        return SamplingPoint(
            pointId = "P%03d".format(pointIndex),
            x = x,
            y = y,
            floor = floor,
            note = note,
            sourceMode = sourceMode,
            moveDirection = moveDirection,
            intervalMeters = intervalMeters,
            azimuth = azimuth,
            isStart = isStart
        )
    }

    private fun addPoint(point: SamplingPoint, explicitlyCreated: Boolean = false) {
        if (!explicitlyCreated) {
            updateStatus("點位已鎖定，新增請使用新增點位按鈕")
            return
        }
        currentPoint = point
        binding.mapSamplingView.addPoint(point)
        binding.mapSamplingView.setCurrentPoint(point.pointId)
        updatePointPanel()
        lifecycleScope.launch { refreshReplenishmentPanel() }
    }

    private fun undoLastPoint() {
        val removed = binding.mapSamplingView.getPoints().lastOrNull()
        if (removed == null) {
            updateStatus("目前沒有可復原的點位")
            return
        }
        lifecycleScope.launch {
            val sampleCount = dao.getSampleCountByPoint(removed.pointId)
            if (sampleCount > 0) {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage("\u6b64\u9ede\u5df2\u6709\u63a1\u6a23\u8cc7\u6599\uff0c\u5fa9\u539f\u53ea\u6703\u79fb\u9664\u756b\u9762\u9ede\u4f4d\uff0c\u4e0d\u6703\u522a\u9664\u8cc7\u6599\u5eab\u7d00\u9304\u3002")
                    .setPositiveButton("繼續") { _, _ -> removeLastPointFromView() }
                    .setNegativeButton("取消", null)
                    .show()
            } else {
                removeLastPointFromView()
            }
        }
    }

    private fun removeLastPointFromView() {
        val removed = binding.mapSamplingView.undoLastPoint() ?: return
        pointIndex = binding.mapSamplingView.getPoints().size
        currentPoint = binding.mapSamplingView.getPoints().lastOrNull()
        updatePointPanel()
        updateStatus("已復原 ${removed.pointId}，資料庫紀錄不會刪除")
    }

    private fun confirmDeleteCurrentPoint() {
        val point = currentPoint ?: binding.mapSamplingView.getPoints().lastOrNull()
        if (point == null) {
            updateStatus("目前沒有可刪除的點位")
            return
        }
        lifecycleScope.launch {
            val sampleCount = dao.getSampleCountByPointScope(
                point.pointId,
                localMapScopeIdsFor(activeSamplingMapId(), point.floor),
                point.floor
            )
            confirmDeletePoint(point, sampleCount)
        }
    }

    private fun confirmDeletePoint(point: SamplingPoint, sampleCount: Int) {
        val message = if (sampleCount > 0 || point.sampled) {
            "${point.pointId} 已有 $sampleCount 筆採樣，座標已鎖定不能移動。\n\n確定刪除這個點位？刪除會移除畫面點位、後端地點與後端節點，但不會刪除已採集的 Wi-Fi 指紋。"
        } else {
            "確定刪除 ${point.pointId}？"
        }
        AlertDialog.Builder(this@MainActivity)
            .setTitle("刪除點位")
            .setMessage(message)
            .setPositiveButton("刪除") { _, _ -> deleteCurrentPointFromView(point) }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun deleteCurrentPointFromView(point: SamplingPoint) {
        val removed = binding.mapSamplingView.removePoint(point.pointId)
        if (removed == null) {
            updateStatus("找不到要刪除的點位：${point.pointId}")
            return
        }
        currentPoint = binding.mapSamplingView.getPoints().lastOrNull()
        pointIndex = binding.mapSamplingView.getPoints().size
        updatePointPanel()
        deleteBackendPlace(point)
        deleteBackendRouteNode(point)
        updateStatus("已刪除畫面點位 ${point.pointId}；後端地點與節點會同步刪除，既有 Wi-Fi 指紋資料保留")
    }

    private fun startAutoScan() {
        if (autoScanJob?.isActive == true) {
            updateStatus("\u81ea\u52d5\u63a1\u6a23\u6b63\u5728\u9032\u884c")
            return
        }
        if (isAutoForwardSampling) {
            updateStatus("自動均速前進正在執行")
            return
        }
        val point = currentPoint
        if (point == null) {
            updateStatus("請先在地圖上建立起點")
            showMessage("請先在地圖上建立起點")
            return
        }
        val count = readAutoScanCount() ?: return
        autoScanTargetCount = count
        autoScanProgressCount = 0
        val intervalSeconds = readAutoScanIntervalSeconds() ?: return
        autoScanJob = lifecycleScope.launch {
            isAutoSampling = true
            binding.buttonAutoScan.isEnabled = false
            binding.buttonStopAutoScan.isEnabled = true
            updateSamplingRunState(true, "自動採樣中：0 / $count")
            try {
                for (index in 1..count) {
                    autoScanProgressCount = index
                    updatePointPanel()
                    updateSamplingRunState(true, "自動採樣中：$index / $count")
                    updateStatus("自動採樣 $index / $count", autoProgress = "$index / $count")
                    val (results, freshness) = scanWifiOnce()
                    if (results.isEmpty()) {
                        latestError = "本次沒有掃到 AP，未儲存"
                        updateStatus("本次沒有掃到 AP，未儲存", autoProgress = "$index / $count")
                    } else {
                        saveScanResults(point, results, freshness)
                        val validText = freshnessText(freshness)
                        updateStatus("${point.pointId} 已儲存，AP 數量：${results.size}，$validText", apCount = results.size, autoProgress = "$index / $count")
                    }
                    if (index < count) delay(intervalSeconds * 1000L)
                }
                binding.mapSamplingView.markPointSampled(point.pointId)
                currentPoint = point.copy(sampled = true)
                updatePointPanel()
                updateSamplingRunState(false, "\u63a1\u6a23\u5b8c\u6210\uff1a$count / $count\uff0c\u8acb\u79fb\u52d5\u5230\u4e0b\u4e00\u9ede")
                updateStatus("${point.pointId} \u5df2\u5b8c\u6210\u63a1\u6a23\uff0c\u5171 $count \u6b21")
                vibrateSamplingComplete()
            } catch (_: CancellationException) {
                updateSamplingRunState(false, "自動採樣已停止：$autoScanProgressCount / $count")
                updateStatus("\u81ea\u52d5\u63a1\u6a23\u5df2\u505c\u6b62\uff0c\u5df2\u4fdd\u7559\u5b8c\u6210\u7684\u8cc7\u6599")
            } finally {
                isAutoSampling = false
                binding.buttonAutoScan.isEnabled = true
                binding.buttonStopAutoScan.isEnabled = false
            }
        }
    }

    private fun stopAutoScan() {
        isAutoForwardSampling = false
        autoScanJob?.cancel()
        autoScanJob = null
        isAutoSampling = false
        binding.buttonAutoUniformForward.isEnabled = true
        binding.buttonAddByCompass.isEnabled = true
        updateSamplingRunState(false, "自動採樣已停止：$autoScanProgressCount / $autoScanTargetCount")
        updateStatus("\u81ea\u52d5\u63a1\u6a23\u5df2\u505c\u6b62\uff0c\u5df2\u4fdd\u7559\u5b8c\u6210\u7684\u8cc7\u6599")
    }

    private fun startAutoUniformForward() {
        if (autoScanJob?.isActive == true || isAutoForwardSampling) {
            updateStatus("自動採樣正在進行")
            return
        }
        val startPoint = currentPoint
        if (startPoint == null) {
            updateStatus("請先在地圖上建立起點")
            showMessage("請先在地圖上建立起點")
            return
        }
        val effectiveAzimuth = effectiveForwardAzimuth()
        if ((!headingLocked && !compassManager.isAvailable) || effectiveAzimuth.isNaN()) {
            updateStatus("目前無法取得方位角")
            showMessage("目前無法取得方位角")
            return
        }
        if (!headingLocked && !compassStable) {
            updateStatus("方位不穩，建議先鎖定方向再使用自動均速前進")
            showMessage("方位不穩，請先鎖定方向")
            return
        }
        val count = readAutoScanCount() ?: return
        val intervalSeconds = readAutoScanIntervalSeconds() ?: return
        autoScanTargetCount = count
        autoScanProgressCount = 0
        isAutoForwardSampling = true
        autoScanJob = lifecycleScope.launch {
            isAutoSampling = true
            binding.buttonAutoScan.isEnabled = false
            binding.buttonAutoUniformForward.isEnabled = false
            binding.buttonAddByCompass.isEnabled = false
            binding.buttonStopAutoScan.isEnabled = true
            updateSamplingRunState(true, "自動均速前進中：目前點 0 / $count")
            try {
                while (isAutoForwardSampling) {
                    val point = currentPoint ?: break
                    for (index in 1..count) {
                        if (!isAutoForwardSampling) break
                        autoScanProgressCount = index
                        updatePointPanel()
                        updateSamplingRunState(true, "自動均速前進：${point.pointId} $index / $count")
                        updateStatus("自動均速前進：${point.pointId} 採樣 $index / $count", autoProgress = "$index / $count")
                        val (results, freshness) = scanWifiOnce()
                        if (results.isEmpty()) {
                            latestError = "本次沒有掃到 AP，未儲存"
                            updateStatus("本次沒有掃到 AP，未儲存", autoProgress = "$index / $count")
                        } else {
                            saveScanResults(point, results, freshness)
                            updateStatus("${point.pointId} 已儲存，AP 數量：${results.size}", apCount = results.size, autoProgress = "$index / $count")
                        }
                        if (index < count) delay(intervalSeconds * 1000L)
                    }
                    if (!isAutoForwardSampling) break
                    binding.mapSamplingView.markPointSampled(point.pointId)
                    currentPoint = point.copy(sampled = true)
                    updatePointPanel()
                    vibrateSamplingComplete()
                    val next = createNextPointForAutoUniform(point) ?: break
                    addPoint(next)
                    updateStatus("已完成 ${point.pointId}，自動前進到 ${next.pointId}，繼續採樣")
                    delay(500L)
                }
            } catch (_: CancellationException) {
                updateStatus("自動均速前進已停止，已保留完成的資料")
            } finally {
                isAutoForwardSampling = false
                isAutoSampling = false
                binding.buttonAutoScan.isEnabled = true
                binding.buttonAutoUniformForward.isEnabled = true
                binding.buttonAddByCompass.isEnabled = true
                binding.buttonStopAutoScan.isEnabled = false
                updateSamplingRunState(false, "自動均速前進已停止")
            }
        }
    }

    private fun createNextPointForAutoUniform(basePoint: SamplingPoint): SamplingPoint? {
        val effectiveAzimuth = effectiveForwardAzimuth()
        if ((!headingLocked && !compassManager.isAvailable) || effectiveAzimuth.isNaN()) {
            latestError = "目前無法取得方位角"
            updateStatus("目前無法取得方位角，自動均速前進已停止")
            isAutoForwardSampling = false
            return null
        }
        val interval = readIntervalMeters() ?: return null
        val direction = mapDirectionCode(effectiveAzimuth)
        return nextPointFromDirection(
            basePoint = basePoint,
            direction = direction,
            sourceMode = "AUTO_UNIFORM_FORWARD",
            moveDirection = direction,
            interval = interval,
            azimuth = effectiveAzimuth
        )
    }


    private fun startWalkAutoSampling() {
        if (isWalkAutoSampling) {
            updateStatus("步行自動採集已在執行")
            return
        }
        if (!pdrManager.isAvailable) {
            updateStatus("此裝置不支援步伐偵測")
            showMessage("此裝置不支援步伐偵測")
            return
        }
        if (!hasActivityRecognitionPermission()) {
            updateStatus("缺少身體活動權限，步行距離可能無法更新")
            showMessage("請允許身體活動權限，步行距離才會更新")
            requestRequiredPermissions()
            return
        }
        if (currentPoint == null) {
            updateStatus("請先在地圖上建立起點")
            showMessage("請先建立起點")
            return
        }
        if (!compassManager.isAvailable || currentAzimuth.isNaN()) {
            updateStatus("目前無法取得方位角")
            showMessage("目前無法取得方位角")
            return
        }
        val scanIntervalSeconds = readAutoScanIntervalSeconds() ?: return
        isWalkAutoSampling = true
        walkSavedAtPoint = 0
        walkSteps = 0
        walkDistanceMeters = 0f
        updateWalkAutoProgressLabel(true)
        pdrManager.start(stepLengthMeters = 0.75f)
        binding.buttonWalkAutoSample.isEnabled = false
        binding.buttonStopWalkAuto.isEnabled = true
        updateSamplingRunState(true, "步行自動採集中：${pdrManager.sensorLabel}")
        walkAutoScanJob = lifecycleScope.launch {
            while (isWalkAutoSampling) {
                val point = currentPoint
                if (point != null) {
                    val (results, freshness) = scanWifiOnce()
                    if (results.isNotEmpty()) {
                        saveScanResults(point, results, freshness)
                        walkSavedAtPoint += 1
                        updateWalkAutoProgressLabel(true)
                        updateStatus("${point.pointId} 已儲存第 $walkSavedAtPoint 次，已走 ${walkDistanceMeters.format1()}m", apCount = results.size)
                    } else {
                        updateStatus("本次沒有掃到 AP，未儲存")
                    }
                }
                delay(scanIntervalSeconds * 1000L)
            }
        }
    }

    private fun stopWalkAutoSampling() {
        isWalkAutoSampling = false
        walkAutoScanJob?.cancel()
        walkAutoScanJob = null
        if (::pdrManager.isInitialized) pdrManager.stop()
        binding.buttonWalkAutoSample.isEnabled = true
        binding.buttonStopWalkAuto.isEnabled = false
        updateWalkAutoProgressLabel(false)
        updateSamplingRunState(false, "步行自動採集已停止")
        updateStatus("步行自動採集已停止，已儲存 $walkSavedAtPoint 次")
    }

    private fun advancePointFromWalk(interval: Float) {
        val basePoint = currentPoint ?: return
        val effectiveAzimuth = effectiveForwardAzimuth()
        if (!headingLocked && !compassStable) {
            updateStatus("已走滿 ${interval.format1()}m，但目前無法取得方位角")
            pdrManager.resetDistance()
            return
        }
        if (walkSavedAtPoint > 0) {
            binding.mapSamplingView.markPointSampled(basePoint.pointId)
        }
        val mapDirectionCode = mapDirectionCode(effectiveAzimuth)
        val next = nextPointFromDirection(
            basePoint = basePoint,
            direction = mapDirectionCode,
            sourceMode = "PDR_AUTO",
            moveDirection = mapDirectionCode,
            interval = interval,
            azimuth = effectiveAzimuth
        )
        addPoint(next)
        walkSavedAtPoint = 0
        pdrManager.resetDistance()
        walkDistanceMeters = 0f
        walkSteps = 0
        updateWalkAutoProgressLabel(true)
        vibrateSamplingComplete()
        updateStatus("已走滿 ${interval.format1()}m，由 ${basePoint.pointId} 建立 ${next.pointId}")
    }

    private fun updateWalkAutoProgressLabel(active: Boolean = isWalkAutoSampling) {
        val interval = binding.editIntervalMeters.text.toString().toFloatOrNull() ?: 1.5f
        binding.textWalkAutoProgress.text = "已採 $walkSavedAtPoint 次\n${walkDistanceMeters.format1()}/${interval.format1()}m"
        binding.textWalkAutoProgress.setBackgroundResource(
            if (active) R.drawable.bg_sampling_active else R.drawable.bg_sampling_stopped
        )
        binding.textWalkAutoProgress.setTextColor(
            ContextCompat.getColor(this, if (active) R.color.primary_blue_dark else R.color.text_primary)
        )
    }

    private data class NavigationDestination(
        val category: String,
        val label: String,
        val point: NavigationPoint
    )

    private data class PendingRealtimeFeedback(
        val result: FingerprintPositioningEngine.PositionResult,
        val wifiResults: List<WifiScanResultItem>,
        val freshness: ScanFreshness,
        val mapId: String,
        val floor: Int
    )

    private fun startPositioning() {
        if (autoScanJob?.isActive == true || walkAutoScanJob?.isActive == true || scanInProgress) {
            updateStatus("自動採樣中，請完成後再開始定位")
            return
        }
        val requestedMapId = activeSamplingMapId()
        val requestedFloor = activeSamplingFloor()
        if (requestedMapId.isBlank() || requestedFloor == null) {
            updateStatus("請先選擇要定位的地圖與樓層")
            return
        }
        binding.buttonStartPositioning.isEnabled = false
        exitRealtimeFeedbackMode(clearMarker = true)
        lifecycleScope.launch {
          try {
            binding.textRealtimeValidationResult.text = "開始定位：掃描中..."
            val trainingRecords = fingerprintRepository.trainingFingerprints()
            if (trainingRecords.isEmpty()) {
                binding.textRealtimeValidationResult.text = "開始定位：資料庫沒有 TRAIN 指紋資料，請先匯入 CSV"
                updateStatus("定位失敗：沒有 TRAIN 指紋資料")
                return@launch
            }
            val (results, freshness) = scanWifiOnce()
            if (activeSamplingMapId() != requestedMapId || activeSamplingFloor() != requestedFloor) return@launch
            if (results.isEmpty()) {
                binding.textRealtimeValidationResult.text = "開始定位：本次沒有掃到 AP"
                updateStatus("定位失敗：沒有掃到 AP")
                return@launch
            }
            val selectedMapId = activeSamplingMapId()
            val selectedFloor = activeSamplingFloor()
            val selectedMapScopeIds = selectedFloor?.let { localMapScopeIdsFor(selectedMapId, it).toSet() }
            val rawResult = positioningEngine.locate(
                currentResults = results,
                trainingRecords = trainingRecords,
                k = 3,
                restrictMapId = selectedMapId,
                restrictMapIds = selectedMapScopeIds,
                restrictFloor = selectedFloor
            )
            if (rawResult == null) {
                binding.textRealtimeValidationResult.text =
                    "開始定位：目前地圖 / 樓層找不到穩定比對\n限制範圍：$selectedMapId / ${selectedFloor?.let { floorDisplayName(it) } ?: "-"}\n掃描 AP 數量：${results.size}"
                updateStatus("定位不穩，請確認目前地圖 / 樓層或重新掃描", apCount = results.size)
                return@launch
            }
            val result = smoothPositioningResult(rawResult)
            latestPositioningResult = result
            binding.mapSamplingView.setRealtimeValidationMarker(result.x, result.y)
            enterRealtimeFeedbackMode(
                PendingRealtimeFeedback(
                    result = result,
                    wifiResults = results,
                    freshness = freshness,
                    mapId = selectedMapId,
                    floor = selectedFloor ?: requestedFloor ?: result.floor
                )
            )
            val metadata = fingerprintRepository.mapMetadata(result.mapId)
            val meterText = if (metadata?.metersPerPixel != null && metadata.coordinateUnit == "image_pixel") {
                val mx = result.x * metadata.metersPerPixel
                val my = result.y * metadata.metersPerPixel
                "\n公尺座標：約 x=${mx.format1()}m, y=${my.format1()}m"
            } else {
                "\n公尺座標：x=${result.x.format1()}m, y=${result.y.format1()}m"
            }
            binding.textRealtimeValidationResult.text = buildString {
                append("開始定位：${if (result.stable) "成功" else "定位不穩，請重新掃描"}")
                append("\n定位品質：${result.qualityLabel}")
                append("\npointId：${result.pointId}")
                append("\nmapId：${result.mapId.ifBlank { "-" }}")
                append("\nfloor：${result.floor}")
                append("\n限制範圍：$currentMapId / ${selectedFloor?.let { "${it}F" } ?: "-"}")
                append("\nx=${result.x.format1()}, y=${result.y.format1()}")
                append(meterText)
                append("\n掃描 AP 數量：${results.size}")
                append("\n定位信心分數：${result.confidence}")
                append("\n平滑處理：最近 ${positioningHistory.size} 次定位")
                append("\n最近鄰：${result.neighborText}")
                append("\n掃描有效性：${freshnessText(freshness)}")
                append("\n資料庫 Wi-Fi 指紋：${fingerprintRepository.fingerprintCount()} 筆")
            }
            updateStatus(
                "定位完成：${result.pointId}，品質 ${result.qualityLabel}，信心 ${result.confidence}",
                apCount = results.size
            )
          } catch (error: Exception) {
            binding.textRealtimeValidationResult.text = "即時定位失敗：${error.message}"
          } finally {
            binding.buttonStartPositioning.isEnabled = true
          }
        }
    }

    private fun smoothPositioningResult(
        newResult: FingerprintPositioningEngine.PositionResult
    ): FingerprintPositioningEngine.PositionResult {
        if (positioningHistory.any { it.mapId != newResult.mapId || it.floor != newResult.floor }) {
            positioningHistory.clear()
        }
        val previous = positioningHistory.lastOrNull()
        val guardedResult = if (previous != null) {
            val jumpDistance = pointDistance(previous.x, previous.y, newResult.x, newResult.y)
            when {
                newResult.confidence < 45 && jumpDistance > 8f -> {
                    previous.copy(
                        confidence = (previous.confidence - 8).coerceAtLeast(35),
                        qualityLabel = "普通",
                        neighborText = "${newResult.neighborText} / 已擋下低信心跳點 ${jumpDistance.format1()}m",
                        stable = previous.confidence >= 55
                    )
                }
                newResult.confidence < 70 && jumpDistance > 18f -> {
                    val ratio = 0.28f
                    newResult.copy(
                        x = previous.x + (newResult.x - previous.x) * ratio,
                        y = previous.y + (newResult.y - previous.y) * ratio,
                        confidence = (newResult.confidence - 12).coerceAtLeast(35),
                        qualityLabel = "普通",
                        neighborText = "${newResult.neighborText} / 已平滑跳點 ${jumpDistance.format1()}m",
                        stable = false
                    )
                }
                else -> newResult
            }
        } else {
            newResult
        }
        positioningHistory.addLast(guardedResult)
        while (positioningHistory.size > 5) positioningHistory.removeFirst()

        val weightedResults = positioningHistory.mapIndexed { index, result ->
            result to ((index + 1).toFloat() * result.confidence.coerceAtLeast(1))
        }
        val weightSum = weightedResults.sumOf { it.second.toDouble() }.toFloat().coerceAtLeast(1f)
        val smoothedX = weightedResults.sumOf { (result, weight) ->
            (result.x * weight).toDouble()
        }.toFloat() / weightSum
        val smoothedY = weightedResults.sumOf { (result, weight) ->
            (result.y * weight).toDouble()
        }.toFloat() / weightSum
        val votedPoint = positioningHistory
            .groupBy { it.pointId }
            .maxByOrNull { entry -> entry.value.size }
            ?.value
            ?.last()
            ?: newResult
        val averageConfidence = positioningHistory
            .map { it.confidence }
            .average()
            .toInt()
            .coerceIn(0, 100)
        val qualityLabel = when {
            averageConfidence >= 70 && positioningHistory.size >= 2 -> "穩定"
            averageConfidence >= 45 -> "普通"
            else -> "不穩"
        }

        return guardedResult.copy(
            pointId = votedPoint.pointId,
            x = smoothedX,
            y = smoothedY,
            floor = votedPoint.floor,
            mapId = votedPoint.mapId,
            confidence = averageConfidence,
            qualityLabel = qualityLabel,
            stable = qualityLabel != "不穩"
        )
    }

    private fun pointDistance(x1: Float, y1: Float, x2: Float, y2: Float): Float {
        return sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2))
    }

    private fun showNavigationDestinationDialog() {
        val mapId = activeSamplingMapId()
        val floor = activeSamplingFloor()
        if (floor == null) {
            updateStatus("請先確認樓層，才能開始導航")
            showMessage("請先確認樓層")
            return
        }
        lifecycleScope.launch {
            val points = fingerprintRepository.navigationPoints(localMapScopeIdsFor(mapId, floor), floor, mapId)
            if (points.size < 2) {
                updateStatus("導航失敗：目前地圖 / 樓層的採樣點不足")
                binding.textRealtimeValidationResult.text =
                    "導航：目前 $mapId / ${floorDisplayName(floor)} 只有 ${points.size} 個點，至少需要 2 個點"
                return@launch
            }
            val destinations = buildNavigationDestinations(points, currentMapId, floor)
            if (destinations.isEmpty()) {
                updateStatus("導航失敗：目前沒有可選目的地")
                return@launch
            }
            showDestinationPicker(destinations)
        }
    }

    private suspend fun buildNavigationDestinations(
        points: List<NavigationPoint>,
        mapId: String,
        floor: Int
    ): List<NavigationDestination> {
        val anchorDestinations = anchorDao.getAnchorsByMap(mapId)
            .filter { it.floor == floor }
            .mapNotNull { anchor ->
                val targetPoint = points.firstOrNull { it.pointId == anchor.pointId }
                    ?: navigationEngine.nearestPoint(anchor.x, anchor.y, points)
                    ?: return@mapNotNull null
                NavigationDestination(
                    category = anchorCategoryLabel(anchor.anchorType),
                    label = anchorDestinationLabel(anchor),
                    point = targetPoint
                )
            }
            .distinctBy { "${it.category}:${it.label}:${it.point.pointId}" }

        val pointDestinations = points.map { point ->
            NavigationDestination(
                category = "採樣點",
                label = point.pointId,
                point = point
            )
        }
        return (anchorDestinations + pointDestinations)
            .sortedWith(compareBy<NavigationDestination> { it.category }.thenBy { it.label })
    }

    private fun showDestinationPicker(destinations: List<NavigationDestination>) {
        val categories = destinations.map { it.category }.distinct().toMutableList()
        if (categories.size > 1) categories.add(0, "全部")

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(36, 8, 36, 0)
        }
        val categoryLabel = TextView(this).apply {
            text = "目的地分類"
            setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_secondary))
            textSize = 13f
        }
        val categorySpinner = Spinner(this)
        val searchLabel = TextView(this).apply {
            text = "輸入名稱篩選"
            setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_secondary))
            textSize = 13f
        }
        val searchEdit = EditText(this).apply {
            hint = "例如 電梯、出口、P072"
            setSingleLine(true)
        }
        val destinationLabel = TextView(this).apply {
            text = "目的地"
            setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_secondary))
            textSize = 13f
        }
        val destinationSpinner = Spinner(this)

        val categoryAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, categories).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        categorySpinner.adapter = categoryAdapter

        var visibleDestinations = destinations
        val destinationAdapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            visibleDestinations.map { destinationDisplayText(it) }.toMutableList()
        ).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        destinationSpinner.adapter = destinationAdapter

        fun refreshDestinationList() {
            val selectedCategory = categorySpinner.selectedItem?.toString().orEmpty()
            val keyword = searchEdit.text.toString().trim()
            visibleDestinations = destinations.filter { destination ->
                (selectedCategory == "全部" || selectedCategory.isBlank() || destination.category == selectedCategory) &&
                    (keyword.isBlank() || destination.label.contains(keyword, ignoreCase = true) || destination.point.pointId.contains(keyword, ignoreCase = true))
            }
            destinationAdapter.clear()
            destinationAdapter.addAll(visibleDestinations.map { destinationDisplayText(it) })
            destinationAdapter.notifyDataSetChanged()
        }

        categorySpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                refreshDestinationList()
            }

            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
        }
        searchEdit.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                refreshDestinationList()
            }

            override fun afterTextChanged(s: Editable?) = Unit
        })

        container.addView(categoryLabel)
        container.addView(categorySpinner)
        container.addView(searchLabel)
        container.addView(searchEdit)
        container.addView(destinationLabel)
        container.addView(destinationSpinner)

        val dialog = AlertDialog.Builder(this)
            .setTitle("選擇目的地")
            .setView(container)
            .setPositiveButton("開始導航", null)
            .setNegativeButton("取消", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val selected = visibleDestinations.getOrNull(destinationSpinner.selectedItemPosition)
                if (selected == null) {
                    showMessage("找不到符合的目的地")
                    return@setOnClickListener
                }
                dialog.dismiss()
                planNavigationTo(selected.point, selected.label)
            }
        }
        dialog.show()
    }

    private fun destinationDisplayText(destination: NavigationDestination): String {
        return "${destination.category}：${destination.label}"
    }

    private fun anchorCategoryLabel(anchorType: String): String = when (anchorType.uppercase(Locale.US)) {
        "ELEVATOR" -> "電梯"
        "STAIR", "STAIRS" -> "樓梯"
        "EXIT", "ENTRANCE" -> "出入口"
        "RESTROOM", "TOILET" -> "廁所"
        "PARKING" -> "停車"
        "QR", "QRCODE", "QR_CODE" -> "QR 定位點"
        "TRANSITION", "MAP_LINK" -> "連接點"
        "LANDMARK" -> "地標"
        else -> anchorType.ifBlank { "地標" }
    }

    private fun anchorDestinationLabel(anchor: AnchorRecord): String {
        return anchor.note
            .ifBlank { anchor.anchorId }
            .ifBlank { anchor.pointId }
            .ifBlank { anchorCategoryLabel(anchor.anchorType) }
    }

    private fun planNavigationTo(destination: NavigationPoint, destinationName: String = destination.pointId) {
        lifecycleScope.launch {
            val floor = destination.floor
            val points = fingerprintRepository.navigationPoints(destination.mapId, floor)
            val source = latestPositioningResult?.takeIf {
                it.mapId == destination.mapId && it.floor == floor
            }?.let { result ->
                navigationEngine.nearestPoint(result.x, result.y, points)
            } ?: currentPoint?.takeIf {
                it.floor == floor && currentMapId == destination.mapId
            }?.let { point ->
                navigationEngine.nearestPoint(point.x, point.y, points)
            }

            if (source == null) {
                binding.mapSamplingView.clearNavigationRoute()
                binding.textRealtimeValidationResult.text =
                    "導航：請先按「開始定位」，讓 App 知道目前位置，再選目的地"
                updateStatus("導航需要先取得目前位置")
                return@launch
            }
            if (source.pointId == destination.pointId) {
                binding.mapSamplingView.clearNavigationRoute()
                binding.textRealtimeValidationResult.text = "導航：你已經在目的地 $destinationName 附近"
                updateStatus("已在目的地附近")
                return@launch
            }

            val interval = readIntervalMeters() ?: 1.5f
            val maxEdgeMeters = maxOf(interval * 1.6f, 2.2f)
            val route = navigationEngine.planRoute(
                start = source,
                destination = destination,
                allPoints = points,
                maxEdgeMeters = maxEdgeMeters
            )

            if (route == null) {
                binding.mapSamplingView.clearNavigationRoute()
                binding.textRealtimeValidationResult.text = buildString {
                    append("導航：找不到可走路線")
                    append("\n起點：${source.pointId}")
                    append("\n目的地：$destinationName")
                    append("\n原因：點位之間可能間距過大，或中間缺少採樣點")
                }
                updateStatus("導航失敗：找不到可走路線")
                return@launch
            }

            binding.mapSamplingView.setNavigationRoute(route.points)
            val nextPoint = route.points.drop(1).firstOrNull()
            binding.textRealtimeValidationResult.text = buildString {
                append("導航路線已建立")
                append("\n起點：${source.pointId}")
                append("\n目的地：$destinationName")
                append("\n下一點：${nextPoint?.pointId ?: destination.pointId}")
                append("\n路線點數：${route.points.size}")
                append("\n預估距離：${route.totalDistanceMeters.format1()}m")
                append("\n限制範圍：${destination.mapId} / ${floor}F")
                append("\n提示：沿藍綠色路線前進，移動後可再按「開始定位」更新目前位置")
            }
            updateStatus(
                "導航路線：${source.pointId} → $destinationName，${route.totalDistanceMeters.format1()}m"
            )
        }
    }

    private fun runRealtimeKnnValidation() {
        if (autoScanJob?.isActive == true) {
            updateStatus("自動採樣中，請完成後再執行即時驗證")
            return
        }
        lifecycleScope.launch {
            binding.textRealtimeValidationResult.text = "即時驗證：掃描中..."
            clearRealtimeValidationMarkerNow()
            val selectedMapId = activeSamplingMapId()
            val selectedFloor = activeSamplingFloor()
            if (selectedFloor == null) {
                binding.textRealtimeValidationResult.text = "即時驗證：請先確認目前樓層"
                updateStatus("即時驗證需要目前樓層")
                return@launch
            }
            performStrictDataCleanup("即時驗證前清理")
            val trainingRecords = fingerprintRepository.trainingFingerprints()
            if (trainingRecords.isEmpty()) {
                binding.textRealtimeValidationResult.text = "即時驗證：資料庫沒有 TRAIN 指紋資料"
                updateStatus("即時驗證需要先有 TRAIN 指紋資料")
                return@launch
            }
            val (results, freshness) = scanWifiOnce()
            if (results.isEmpty()) {
                binding.textRealtimeValidationResult.text = "即時驗證：本次沒有掃到 AP"
                updateStatus("即時驗證沒有掃到 AP")
                return@launch
            }
            val result = positioningEngine.locate(
                currentResults = results,
                trainingRecords = trainingRecords,
                k = 3,
                restrictMapId = selectedMapId,
                restrictMapIds = localMapScopeIdsFor(selectedMapId, selectedFloor).toSet(),
                restrictFloor = selectedFloor
            )
            if (result == null) {
                binding.textRealtimeValidationResult.text = buildString {
                    append("即時驗證：找不到穩定比對")
                    append("\n限制範圍：$currentMapId / ${floorDisplayName(selectedFloor)}")
                    append("\n掃描 AP 數量：${results.size}")
                    append("\n資料有效性：${freshnessText(freshness)}")
                }
                updateStatus("即時驗證找不到穩定比對", apCount = results.size)
                return@launch
            }

            binding.mapSamplingView.setRealtimeValidationMarker(result.x, result.y)
            val reinforcementCount = saveRealtimeValidationAsTraining(result, results, freshness, selectedMapId, selectedFloor)
            val errorText = currentPoint?.let { point ->
                val error = sqrt((result.x - point.x) * (result.x - point.x) + (result.y - point.y) * (result.y - point.y))
                "，與目前點誤差 ${error.format1()}m"
            }.orEmpty()
            binding.textRealtimeValidationResult.text = buildString {
                append("即時驗證：預測 ${result.pointId}")
                append(errorText)
                append("\n定位品質：${result.qualityLabel}")
                append("\n限制範圍：$currentMapId / ${floorDisplayName(selectedFloor)}")
                append("\n掃描 AP 數量：${results.size}")
                append("\n定位信心分數：${result.confidence}")
                append("\n最近鄰：${result.neighborText}")
                append("\n資料有效性：${freshnessText(freshness)}")
                if (reinforcementCount > 0) append("\n已補強 ${result.pointId}：$reinforcementCount 筆")
            }
            updateStatus("即時驗證完成：預測 ${result.pointId}，${result.qualityLabel}$errorText", apCount = results.size)
        }
    }

    private suspend fun saveRealtimeValidationAsTraining(
        result: FingerprintPositioningEngine.PositionResult,
        results: List<WifiScanResultItem>,
        freshness: ScanFreshness,
        mapId: String,
        floor: Int
    ): Int {
        if (!result.stable || result.confidence < 70 || results.isEmpty()) return 0
        if (result.mapId !in localMapScopeIdsFor(mapId, floor) || result.floor != floor) return 0
        val stablePoint = binding.mapSamplingView.getPoints().firstOrNull {
            it.pointId == result.pointId && it.floor == floor
        } ?: SamplingPoint(
            pointId = result.pointId,
            x = result.x,
            y = result.y,
            floor = floor,
            note = "即時驗證補強",
            sourceMode = "REALTIME_VALIDATION",
            moveDirection = "VERIFY",
            intervalMeters = 0f,
            azimuth = safeAzimuth(),
            sampled = true
        )
        val before = recordCount
        saveScanResults(
            stablePoint.copy(
                sourceMode = "REALTIME_VALIDATION",
                moveDirection = "VERIFY",
                sampled = true
            ),
            results,
            freshness
        )
        binding.mapSamplingView.markPointSampled(result.pointId)
        uploadPendingWifiScans()
        return (recordCount - before).coerceAtLeast(0)
    }

    private fun scheduleRealtimeValidationMarkerClear() {
        realtimeValidationClearJob?.cancel()
        realtimeValidationClearJob = lifecycleScope.launch {
            delay(5_000L)
            val feedback = pendingRealtimeFeedback
            if (feedback != null) {
                val reinforced = saveRealtimeValidationAsTraining(
                    feedback.result.copy(
                        confidence = (feedback.result.confidence + 8).coerceAtMost(100),
                        qualityLabel = if (feedback.result.confidence >= 62) "穩定" else feedback.result.qualityLabel,
                        stable = feedback.result.stable || feedback.result.confidence >= 62
                    ),
                    feedback.wifiResults,
                    feedback.freshness,
                    feedback.mapId,
                    feedback.floor
                )
                val boostText = if (reinforced > 0) "，已補強 $reinforced 筆" else ""
                updateStatus("即時定位未回報錯誤，判定為準確$boostText")
                binding.textRealtimeValidationResult.append("\n5 秒內未回報錯誤：信心度已提升$boostText")
            }
            pendingRealtimeFeedback = null
            updateRealtimePositioningButton(false)
            binding.mapSamplingView.clearRealtimeValidationMarker()
        }
    }

    private fun clearRealtimeValidationMarkerNow() {
        realtimeValidationClearJob?.cancel()
        realtimeValidationClearJob = null
        pendingRealtimeFeedback = null
        updateRealtimePositioningButton(false)
        binding.mapSamplingView.clearRealtimeValidationMarker()
    }

    private fun enterRealtimeFeedbackMode(feedback: PendingRealtimeFeedback) {
        pendingRealtimeFeedback = feedback
        updateRealtimePositioningButton(true)
        scheduleRealtimeValidationMarkerClear()
    }

    private fun exitRealtimeFeedbackMode(clearMarker: Boolean) {
        realtimeValidationClearJob?.cancel()
        realtimeValidationClearJob = null
        pendingRealtimeFeedback = null
        updateRealtimePositioningButton(false)
        if (clearMarker) binding.mapSamplingView.clearRealtimeValidationMarker()
    }

    private fun updateRealtimePositioningButton(feedbackMode: Boolean) {
        realtimeFeedbackMode = feedbackMode
        if (!::binding.isInitialized) return
        binding.buttonStartPositioning.text = if (feedbackMode) "錯誤回報" else "即時定位"
        binding.buttonStartPositioning.setBackgroundResource(
            if (feedbackMode) R.drawable.bg_button_danger_outline else R.drawable.bg_button_secondary
        )
        binding.buttonStartPositioning.setTextColor(
            ContextCompat.getColor(this, if (feedbackMode) R.color.danger_red else R.color.primary_blue_dark)
        )
    }

    private fun showRealtimePositioningErrorDialog() {
        val feedback = pendingRealtimeFeedback ?: run {
            exitRealtimeFeedbackMode(clearMarker = true)
            return
        }
        realtimeValidationClearJob?.cancel()
        realtimeValidationClearJob = null
        binding.mapSamplingView.clearRealtimeValidationMarker()
        pendingRealtimeFeedback = null
        updateRealtimePositioningButton(false)
        binding.textRealtimeValidationResult.append(
            "\n錯誤回報：${feedback.result.pointId} 已標記錯誤，本次不補強"
        )
        updateStatus("已標記即時定位錯誤，本次不補強")
    }

    private suspend fun performStrictDataCleanup(source: String): DataQualityAnalyzer.CleanupResult {
        val mapId = activeSamplingMapId()
        val floor = activeSamplingFloor() ?: 1
        val trainingRecords = fingerprintRepository.trainingFingerprints()
        if (trainingRecords.isEmpty()) {
            binding.textDataQualityStatus.text = "資料品質：沒有 TRAIN 資料可清理"
            return DataQualityAnalyzer.CleanupResult(
                deletedWifiRows = 0,
                deletedAnchors = 0,
                rejectedApSummaries = emptyList(),
                anchorIssueSummaries = emptyList(),
                weakPointSummaries = emptyList()
            )
        }

        val navigationPoints = fingerprintRepository.navigationPoints(localMapScopeIdsFor(mapId, floor), floor, mapId)
        val anchors = anchorDao.getAnchorsByMap(mapId)
        val targetSamples = (binding.editAutoScanCount.text.toString().trim().toIntOrNull() ?: autoScanTargetCount)
            .coerceAtLeast(3)
        val plan = dataQualityAnalyzer.buildCleanupPlan(
            trainingRecords = trainingRecords,
            anchors = anchors,
            navigationPoints = navigationPoints,
            targetSamplesPerPoint = targetSamples
        )

        var deletedWifiRows = 0
        var deletedAnchors = 0
        if (plan.anchorIdsToDelete.isNotEmpty()) {
            deletedAnchors += anchorDao.deleteByIds(plan.anchorIdsToDelete.toList())
        }
        if (deletedWifiRows > 0 || deletedAnchors > 0) {
            refreshRecordCount()
            refreshAnchors()
        }

        val result = DataQualityAnalyzer.CleanupResult(
            deletedWifiRows = deletedWifiRows,
            deletedAnchors = deletedAnchors,
            rejectedApSummaries = plan.rejectedApSummaries,
            anchorIssueSummaries = plan.anchorIssueSummaries,
            weakPointSummaries = plan.weakPointSummaries
        )
        binding.textDataQualityStatus.text = strictCleanupText(source, result)
        return result
    }

    private fun strictCleanupText(
        source: String,
        result: DataQualityAnalyzer.CleanupResult
    ): String = buildString {
        append("嚴格清理：$source")
        append("\n已刪除雜訊 Wi-Fi 紀錄：${result.deletedWifiRows}（定位會降權雜訊，不自動刪除指紋）")
        append("\n已刪除錯誤錨點：${result.deletedAnchors}")
        if (result.rejectedApSummaries.isNotEmpty()) {
            append("\n雜訊 AP：")
            append(result.rejectedApSummaries.joinToString(" / "))
        }
        if (result.anchorIssueSummaries.isNotEmpty()) {
            append("\n錨點問題：")
            append(result.anchorIssueSummaries.joinToString(" / "))
        }
        if (result.weakPointSummaries.isNotEmpty()) {
            append("\n仍需補強點位：")
            append(result.weakPointSummaries.joinToString(" / "))
        }
    }

    private suspend fun scanWifiOnce(): Pair<List<WifiScanResultItem>, ScanFreshness> {
        if (!hasRequiredPermissions()) {
            latestError = "缺少 Wi-Fi / 位置權限"
            updateStatus("缺少 Wi-Fi / 位置權限")
            requestRequiredPermissions()
            return emptyList<WifiScanResultItem>() to ScanFreshness(ScanFreshness.UNKNOWN, false, 0f)
        }
        wifiStatus = if (wifiManager.isWifiEnabled) "Wi-Fi enabled" else "Wi-Fi disabled"
        if (!wifiManager.isWifiEnabled) {
            latestError = "Wi-Fi 尚未開啟"
            updateStatus("Wi-Fi 尚未開啟，請先開啟 Wi-Fi")
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startActivity(Intent(Settings.Panel.ACTION_WIFI))
                } else {
                    startActivity(Intent(Settings.ACTION_WIFI_SETTINGS))
                }
            } catch (_: Exception) {
                startActivity(Intent(Settings.ACTION_WIFI_SETTINGS))
            }
            return emptyList<WifiScanResultItem>() to ScanFreshness(ScanFreshness.UNKNOWN, false, 0f)
        }
        if (!isLocationEnabled()) {
            updateStatus("定位服務可能未開啟；部分 Android 版本需要定位服務才會回傳 Wi-Fi 掃描結果")
        }
        if (scanInProgress) {
            return lastScanResults to latestScanFreshness
        }
        return suspendCancellableCoroutine { continuation ->
            pendingScanCallback = { results, freshness ->
                if (continuation.isActive) continuation.resume(results to freshness)
            }
            scanInProgress = true
            updateStatus("\u6383\u63cf\u4e2d")
            val started = try {
                @Suppress("DEPRECATION")
                wifiManager.startScan()
            } catch (securityException: SecurityException) {
                scanInProgress = false
                latestError = "掃描權限錯誤：${securityException.message}"
                updateStatus("掃描權限錯誤，請確認 Wi-Fi 權限")
                pendingScanCallback = null
                if (continuation.isActive) continuation.resume(emptyList<WifiScanResultItem>() to ScanFreshness(ScanFreshness.UNKNOWN, false, 0f))
                return@suspendCancellableCoroutine
            }
            if (!started) {
                scanInProgress = false
                val fallback = readWifiResults()
                val freshness = evaluateScanFreshness(fallback, false)
                latestScanFreshness = freshness
                lastScanResults = fallback
                adapter.submitResults(fallback)
                updateStatus("系統限制掃描頻率，已讀取上一次結果：${freshnessText(freshness)}", apCount = fallback.size)
                pendingScanCallback = null
                if (continuation.isActive) continuation.resume(fallback to freshness)
            }
            continuation.invokeOnCancellation {
                pendingScanCallback = null
                scanInProgress = false
            }
        }
    }

    private fun readWifiResults(): List<WifiScanResultItem> {
        return try {
            @Suppress("MissingPermission")
            wifiManager.scanResults
                .map {
                    WifiScanResultItem(
                        ssid = it.SSID.orEmpty().ifBlank { "Hidden SSID" },
                        bssid = it.BSSID.orEmpty(),
                        rssi = it.level,
                        frequency = it.frequency
                    )
                }
                .filter { it.bssid.isNotBlank() }
                .sortedByDescending { it.rssi }
        } catch (securityException: SecurityException) {
            latestError = "讀取 Wi-Fi 結果失敗：${securityException.message}"
            updateStatus("讀取 Wi-Fi 結果失敗，請確認 Wi-Fi 權限")
            emptyList()
        }
    }

    private fun evaluateScanFreshness(
        results: List<WifiScanResultItem>,
        scanUpdated: Boolean
    ): ScanFreshness {
        val duplicateScore = duplicateScore(lastSavedScanSignature, scanSignature(results))
        val label = when {
            !scanUpdated -> ScanFreshness.THROTTLED_PREVIOUS_RESULTS
            duplicateScore >= 0.92f && results.isNotEmpty() -> ScanFreshness.POSSIBLE_DUPLICATE
            else -> ScanFreshness.FRESH
        }
        return ScanFreshness(label, scanUpdated, duplicateScore)
    }

    private fun scanSignature(results: List<WifiScanResultItem>): Map<String, Int> {
        return results
            .filter { it.bssid.isNotBlank() }
            .associate { it.bssid to it.rssi }
    }

    private fun duplicateScore(
        previous: Map<String, Int>,
        current: Map<String, Int>
    ): Float {
        if (previous.isEmpty() || current.isEmpty()) return 0f
        val sharedBssids = previous.keys.intersect(current.keys)
        if (sharedBssids.isEmpty()) return 0f
        val similarCount = sharedBssids.count { bssid ->
            kotlin.math.abs((previous[bssid] ?: -100) - (current[bssid] ?: 0)) <= 2
        }
        val unionCount = previous.keys.union(current.keys).size
        return if (unionCount == 0) 0f else similarCount.toFloat() / unionCount.toFloat()
    }

    private fun freshnessText(freshness: ScanFreshness): String = when (freshness.label) {
        ScanFreshness.FRESH -> "\u6709\u6548\u65b0\u6383\u63cf"
        ScanFreshness.POSSIBLE_DUPLICATE -> "可能重複掃描 ${(freshness.duplicateScore * 100f).toInt()}%"
        ScanFreshness.THROTTLED_PREVIOUS_RESULTS -> "系統限制，沿用上次結果"
        else -> "未知"
    }

    private fun saveCurrentScanFromManualInput() {
        lifecycleScope.launch {
            val point = manualPointFromInput() ?: return@launch
            if (lastScanResults.isEmpty()) {
                updateStatus("本次沒有掃到 AP，未儲存")
                showMessage("本次沒有掃到 AP，未儲存")
                return@launch
            }
            saveScanResults(point, lastScanResults, latestScanFreshness)
        }
    }

    private suspend fun saveScanResults(
        point: SamplingPoint,
        results: List<WifiScanResultItem>,
        freshness: ScanFreshness = latestScanFreshness
    ) {
        if (results.isEmpty()) {
            updateStatus("本次沒有掃到 AP，未儲存")
            return
        }
        val sampleId = sampleId()
        val timestamp = System.currentTimeMillis()
        /*
         * This app collects Wi-Fi fingerprint records for later modeling; it does not
         * directly complete indoor navigation. SSID is not unique; BSSID is the main
         * Wi-Fi AP identifier for AP-RSSI vectors. RSSI is affected by people, walls,
         * distance, and device differences, so each point should collect multiple samples.
         * Android limits Wi-Fi scan frequency, so do not assume one scan per second.
         * The exported CSV can later be transformed into AP-RSSI vectors for deep
         * learning localization, then combined with IMU/PDR or DQN navigation decisions.
         */
        val records = results.map {
            WifiScanRecord(
                sampleId = sampleId,
                pointId = point.pointId,
                x = point.x,
                y = point.y,
                floor = activeSamplingFloor() ?: point.floor,
                mapId = activeSamplingMapId(),
                sessionId = currentSessionId,
                dataSplit = dataSplit,
                deviceModel = deviceModelText(),
                androidVersion = Build.VERSION.RELEASE,
                appVersion = appVersionText(),
                note = point.note,
                sourceMode = point.sourceMode,
                moveDirection = point.moveDirection,
                intervalMeters = point.intervalMeters,
                azimuth = point.azimuth,
                ssid = it.ssid,
                bssid = it.bssid,
                rssi = it.rssi,
                frequency = it.frequency,
                scanFreshness = freshness.label,
                scanUpdated = freshness.updated,
                duplicateScore = freshness.duplicateScore,
                timestamp = timestamp
            )
        }
        dao.insertAll(records)
        lastSavedScanSignature = scanSignature(results)
        latestScanFreshness = freshness
        latestSampleId = sampleId
        latestSavedTime = dateTime(timestamp)
        refreshRecordCount()
        updatePointPanel()
        refreshReplenishmentPanel()
    }

    private fun uploadPendingWifiScans() {
        lifecycleScope.launch {
            val pendingRecords = dao.getPendingUploadRecords()
            val calibrationFloor = activeSamplingFloor()
            val apCalibrations = if (calibrationFloor == null) {
                emptyList()
            } else {
                wifiApCalibrationDao.getForScope(activeSamplingMapId(), calibrationFloor)
            }
            if (pendingRecords.isEmpty() && apCalibrations.isEmpty()) {
                binding.textSyncStatus.text = "同步狀態：目前沒有待上傳的指紋或基地台資料。"
                showMessage("目前沒有待上傳資料")
                return@launch
            }

            val backendUrl = binding.editBackendUrl.text.toString().trim().trimEnd('/')
            if (backendUrl.isBlank()) {
                binding.textSyncStatus.text = "同步狀態：請先輸入後端網址。"
                showMessage("請先輸入後端網址")
                return@launch
            }
            getSharedPreferences("backend", MODE_PRIVATE).edit()
                .putString("base_url", backendUrl)
                .apply()

            val recordsByScope = pendingRecords.groupBy { uploadScopeFor(it) }
                .toSortedMap(compareBy<UploadScope> { it.mapId }.thenBy { it.floorId })
            val summaryBeforeByScope = withContext(Dispatchers.IO) {
                recordsByScope.keys.associateWith { scope ->
                    runCatching { getWifiScanSummary(backendUrl, scope.mapId, scope.floorId) }.getOrNull()
                }
            }
            val batches = recordsByScope.flatMap { (scope, records) ->
                records.chunked(WIFI_UPLOAD_BATCH_SIZE).map { scope to it }
            }
            binding.textSyncStatus.text = "同步狀態：準備上傳 ${pendingRecords.size} 筆指紋、${apCalibrations.size} 台基地台..."

            var uploadedCount = 0
            var acceptedCount = 0
            var retainedPendingCount = 0
            val uploadedScopes = linkedSetOf<Pair<String, String>>()
            for ((index, scopedBatch) in batches.withIndex()) {
                val (scope, batch) = scopedBatch
                binding.textSyncStatus.text = buildString {
                    append("同步狀態：分批上傳中\n")
                    append("範圍：${scope.mapId} / ${scope.floorId}\n")
                    append("批次：${index + 1} / ${batches.size}\n")
                    append("已上傳：$uploadedCount / ${pendingRecords.size} 筆")
                }
                val result = runCatching {
                    withContext(Dispatchers.IO) {
                        postWifiScanRecords("$backendUrl/api/wifi-scans", batch)
                    }
                }

                val response = result.getOrElse { error ->
                    binding.textSyncStatus.text = buildString {
                        append("同步狀態：上傳失敗\n")
                        append("批次：${index + 1} / ${batches.size}\n")
                        append(error.message ?: error.javaClass.simpleName)
                    }
                    return@launch
                }

                if (response.statusCode !in 200..299 || !response.accepted) {
                    binding.textSyncStatus.text = buildString {
                        append("同步狀態：未確認雲端儲存，手機資料已保留，請重傳\n")
                        append("批次：${index + 1} / ${batches.size}\n")
                        append("HTTP：${response.statusCode}\n")
                        append(response.message.ifBlank { response.rawBody.take(180) })
                    }
                    return@launch
                }

                acceptedCount += response.savedCount
                val shouldMarkUploaded = response.accepted
                if (!shouldMarkUploaded) {
                    retainedPendingCount += batch.size
                    binding.textSyncStatus.text = buildString {
                        append("同步狀態：後端沒有新增資料，已保留本批待重傳\n")
                        append("範圍：${scope.mapId} / ${scope.floorId}\n")
                        append("批次：${index + 1} / ${batches.size}\n")
                        append("HTTP：${response.statusCode}\n")
                        append("後端接受：${response.savedCount} 筆")
                    }
                    return@launch
                }

                val uploadedAt = System.currentTimeMillis()
                dao.markUploaded(batch.map { it.id }, uploadedAt)
                uploadedScopes.add(scope.mapId to scope.floorId)
                uploadedCount += batch.size
            }

            var uploadedApCount = 0
            if (apCalibrations.isNotEmpty()) {
                val response = runCatching {
                    withContext(Dispatchers.IO) {
                        postWifiApCalibrations("$backendUrl/api/wifi-aps/bulk", apCalibrations)
                    }
                }.getOrElse { error ->
                    binding.textSyncStatus.text = "同步狀態：指紋已處理，但基地台資料上傳失敗\n${error.message ?: error.javaClass.simpleName}"
                    return@launch
                }
                if (response.statusCode !in 200..299 || !response.accepted) {
                    binding.textSyncStatus.text = "同步狀態：基地台資料未確認儲存\nHTTP：${response.statusCode}\n${response.message.ifBlank { response.rawBody.take(180) }}"
                    return@launch
                }
                uploadedApCount = response.savedCount
            }

            var retrainedCount = 0
            if (acceptedCount > 0) {
                uploadedScopes.forEach { (mapId, floorId) ->
                    runCatching {
                        withContext(Dispatchers.IO) { trainBackendKnnModel(backendUrl, mapId, floorId) }
                    }.onSuccess { retrainedCount += 1 }
                }
            }

            val summaryAfterByScope = withContext(Dispatchers.IO) {
                recordsByScope.keys.associateWith { scope ->
                    runCatching { getWifiScanSummary(backendUrl, scope.mapId, scope.floorId) }.getOrNull()
                }
            }
            binding.textSyncStatus.text = buildString {
                append("同步狀態：上傳完成\n")
                append("本次上傳：$uploadedCount 筆\n")
                append("後端接受：$acceptedCount 筆\n")
                append("基地台同步：$uploadedApCount 台\n")
                if (retainedPendingCount > 0) {
                    append("保留待重傳：$retainedPendingCount 筆\n")
                }
                summaryAfterByScope.forEach { (scope, summaryAfter) ->
                    if (summaryAfter != null) {
                        val summaryBefore = summaryBeforeByScope[scope]
                        val increase = summaryBefore?.let { summaryAfter.totalRecords - it.totalRecords }
                        append("${scope.mapId} / ${scope.floorId}：後端 ${summaryAfter.totalRecords} 筆")
                        if (increase != null) append("，本次增加 $increase")
                        append("\n")
                    }
                }
                if (retrainedCount > 0) {
                    append("已重新訓練模型：$retrainedCount 個範圍\n")
                }
                append("時間：${dateTime(System.currentTimeMillis())}")
            }
        }
    }

    private fun confirmResetUploadMarks() {
        AlertDialog.Builder(this)
            .setTitle("重傳本機資料")
            .setMessage("這會把手機本機已儲存的 Wi-Fi 指紋重新標成待上傳，不會刪除資料。後端會略過已存在的相同紀錄。")
            .setPositiveButton("重傳") { _, _ ->
                lifecycleScope.launch {
                    val count = dao.resetAllUploadMarks()
                    binding.textSyncStatus.text = "同步狀態：已將 $count 筆本機資料排入重傳，請再按「上傳 Wi-Fi 指紋」。"
                }
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun getWifiScanSummary(baseUrl: String, mapId: String, floorId: String): WifiScanSummary {
        val endpoint = "$baseUrl/api/wifi-scans/summary?mapId=${mapId.urlEncode()}&floorId=${floorId.urlEncode()}"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8000
            readTimeout = 12000
        }
        return try {
            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (statusCode !in 200..299) throw IOException(raw.ifBlank { "HTTP $statusCode" })
            val json = JSONObject(raw)
            WifiScanSummary(
                totalRecords = json.optInt("totalRecords", 0),
                pointCount = json.optInt("pointCount", 0),
                bssidCount = json.optInt("bssidCount", 0)
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun postWifiScanRecords(endpoint: String, records: List<WifiScanRecord>): UploadResponse {
        val body = JSONObject()
            .put("records", JSONArray().apply {
                records.forEach { record ->
                    put(JSONObject().apply {
                        put("sampleId", record.sampleId)
                        put("pointId", record.pointId)
                        put("mapId", mapIdForUpload(record))
                        put("floorId", floorIdForUpload(record))
                        put("x", record.x)
                        put("y", record.y)
                        put("heading", record.azimuth)
                        put("ssid", record.ssid)
                        put("bssid", record.bssid)
                        put("rssi", record.rssi)
                        put("deviceInfo", listOf(record.deviceModel, record.androidVersion).filter { it.isNotBlank() }.joinToString(" / "))
                        put("sourceMode", record.sourceMode)
                        put("dataPriority", if (record.sourceMode in setOf("BACKEND_PLACE", "KEY_POINT", "MANUAL")) "field_verified" else "legacy_low")
                        put("scannedAt", isoDateTime(record.timestamp))
                    })
                }
            })
            .toString()

        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8000
            readTimeout = 60000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }

        return try {
            connection.outputStream.use { stream ->
                stream.write(body.toByteArray(Charsets.UTF_8))
            }
            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = raw.takeIf { it.isNotBlank() }?.let { JSONObject(it) }
            UploadResponse(
                statusCode = statusCode,
                accepted = json?.optBoolean("accepted", false) == true &&
                    json.optBoolean("persisted", false) &&
                    json.optInt("persistedCount", -1) == records.size,
                savedCount = json?.optInt("savedCount", 0) ?: 0,
                message = json?.optString("message").orEmpty(),
                rawBody = raw
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun postWifiApCalibrations(endpoint: String, calibrations: List<WifiApCalibration>): UploadResponse {
        val body = JSONObject().put("calibrations", JSONArray().apply {
            calibrations.forEach { item ->
                put(JSONObject().apply {
                    put("calibrationId", item.calibrationId)
                    put("bssid", item.bssid)
                    put("ssid", item.ssid)
                    put("mapId", item.mapId)
                    put("floorId", floorIdForApCalibration(item))
                    put("x", item.x)
                    put("y", item.y)
                    put("referenceRssi", item.referenceRssi)
                    put("pathLossExponent", item.pathLossExponent)
                    put("rmse", item.rmse)
                    put("samplePointCount", item.samplePointCount)
                    put("observationCount", item.observationCount)
                    put("suggestedPointId", item.suggestedPointId)
                    put("calibrationStatus", item.status)
                    put("source", item.source)
                    put("collectorUpdatedAt", isoDateTime(item.updatedAt))
                })
            }
        }).toString()
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8000
            readTimeout = 30000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
        return try {
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = raw.takeIf { it.isNotBlank() }?.let { JSONObject(it) }
            UploadResponse(
                statusCode = statusCode,
                accepted = json?.optBoolean("accepted", false) == true && json.optBoolean("persisted", false),
                savedCount = json?.optInt("savedCount", 0) ?: 0,
                message = json?.optString("message").orEmpty(),
                rawBody = raw
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun floorIdForApCalibration(calibration: WifiApCalibration): String {
        if (calibration.mapId == backendMapId && calibration.floor == activeSamplingFloor() && backendFloorId.isNotBlank()) {
            return backendFloorId
        }
        return if (calibration.mapId == "k-area-airport") {
            "k-area-airport-${calibration.floor}f"
        } else {
            calibration.floor.toString()
        }
    }

    private fun trainBackendKnnModel(baseUrl: String, mapId: String, floorId: String) {
        val body = JSONObject()
            .put("mapId", mapId)
            .put("floorId", floorId)
            .put("algorithm", "knn")
            .put("activate", true)
            .toString()
        val connection = (URL("$baseUrl/api/models/train").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8000
            readTimeout = 30000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
        try {
            connection.outputStream.use { stream ->
                stream.write(body.toByteArray(Charsets.UTF_8))
            }
            val statusCode = connection.responseCode
            if (statusCode !in 200..299) {
                val raw = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                throw IOException(raw.ifBlank { "HTTP $statusCode" })
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun uploadScopeFor(record: WifiScanRecord): UploadScope =
        UploadScope(mapIdForUpload(record), floorIdForUpload(record))

    private fun floorIdForUpload(record: WifiScanRecord): String {
        val mapId = mapIdForUpload(record)
        val backendFloor = backendFloorId.takeIf {
            backendMapId == mapId && backendFloorCodeOrNull(
                BackendFloor(
                    id = backendFloorId,
                    mapId = backendMapId,
                    name = backendFloorName,
                    imageUrl = "",
                    scaleValue = null,
                    coordinateUnit = "",
                    mapHeadingOffsetDegrees = null
                )
            ) == record.floor
        }
        val selectedFloor = normalizeBackendFloorId(mapId, backendFloor.orEmpty(), record.floor)
        if (selectedFloor.isNotBlank()) return selectedFloor
        if (mapId == "F1_M1" && record.floor == 1) return "k-area-airport-1f"
        if (mapId == "k-area-airport") return normalizeBackendFloorId(mapId, "k-area-airport-${floorCode(record.floor).lowercase(Locale.US)}", record.floor)
        return "${mapId}_floor_${floorCode(record.floor).lowercase(Locale.US)}"
    }

    private fun mapIdForUpload(record: WifiScanRecord): String {
        if (record.mapId == "F1_M1" && record.floor == 1) return "k-area-airport"
        if (backendMapId.isNotBlank() && record.mapId in localMapScopeIdsFor(backendMapId, record.floor)) {
            return backendMapId
        }
        return record.mapId.ifBlank { currentMapId.ifBlank { backendMapId.ifBlank { "default-map" } } }
    }

    private fun normalizeBackendFloorId(mapId: String, floorId: String, floor: Int): String {
        if (mapId == "k-area-airport" && floor == 1 && floorId in setOf("k-area-airport-f1", "k-area-airport-b1", "floor_1", "1", "1F", "B1", "-1")) {
            return "k-area-airport-1f"
        }
        if (mapId == "k-area-airport" && floor == 2 && floorId in setOf("k-area-airport-f2", "floor_2", "2", "2F")) {
            return "k-area-airport-2f"
        }
        return floorId
    }

    private fun isoDateTime(timestamp: Long): String {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date(timestamp))
    }

    private data class UploadResponse(
        val statusCode: Int,
        val accepted: Boolean,
        val savedCount: Int,
        val message: String,
        val rawBody: String
    )

    private data class UploadScope(
        val mapId: String,
        val floorId: String
    )

    private data class WifiScanSummary(
        val totalRecords: Int,
        val pointCount: Int,
        val bssidCount: Int
    )

    private data class BackendMapSyncResult(
        val target: File,
        val skipped: Boolean,
        val reason: String
    )

    private data class BackendMap(val id: String, val name: String) {
        val label: String get() = if (name == id) id else "$name ($id)"
    }

    private data class BackendFloor(
        val id: String,
        val mapId: String,
        val name: String,
        val imageUrl: String,
        val scaleValue: Float?,
        val coordinateUnit: String,
        val mapHeadingOffsetDegrees: Float?
    ) {
        val label: String get() = if (name == id) id else "$name ($id)"
    }

    private data class BackendRouteNode(
        val id: String,
        val mapId: String,
        val floorId: String,
        val x: Float,
        val y: Float,
        val nodeType: String,
        val label: String,
        val isWalkable: Boolean
    )

    private data class BackendPlace(
        val id: String,
        val mapId: String,
        val floorId: String,
        val name: String,
        val category: String,
        val description: String,
        val keywords: String,
        val routeNodeId: String = "",
        val x: Float,
        val y: Float,
        val categories: List<String> = listOf(category)
    )

    private data class BackendFingerprintPoint(
        val pointId: String,
        val x: Float,
        val y: Float,
        val scanCount: Int
    )

    private data class ImageSize(val width: Int, val height: Int) {
        private val aspect: Float get() = width.toFloat() / height.toFloat()
        fun aspectDiff(other: ImageSize): Float {
            val larger = maxOf(aspect, other.aspect)
            val smaller = minOf(aspect, other.aspect)
            return if (smaller <= 0f) Float.MAX_VALUE else kotlin.math.abs(larger / smaller - 1f)
        }
    }

    private fun exportCsv() {
        lifecycleScope.launch {
            val records = dao.getAllRecords()
            if (records.isEmpty()) {
                updateStatus("\u76ee\u524d\u6c92\u6709\u8cc7\u6599\u53ef\u532f\u51fa")
                showMessage("\u76ee\u524d\u6c92\u6709\u8cc7\u6599\u53ef\u532f\u51fa")
                return@launch
            }
            val outputDir = getExternalFilesDir(null) ?: filesDir
            val file = File(outputDir, "wifi_fingerprint_records.csv")
            try {
                file.bufferedWriter(Charsets.UTF_8).use { writer ->
                    writer.appendLine("id,sampleId,pointId,x,y,floor,mapId,sessionId,dataSplit,deviceModel,androidVersion,appVersion,note,sourceMode,moveDirection,intervalMeters,azimuth,ssid,bssid,rssi,frequency,scanFreshness,scanUpdated,duplicateScore,timestamp")
                    records.forEach { record ->
                        writer.appendLine(
                            listOf(
                                record.id,
                                record.sampleId,
                                record.pointId,
                                record.x,
                                record.y,
                                record.floor,
                                record.mapId.csvEscape(),
                                record.sessionId.csvEscape(),
                                record.dataSplit.csvEscape(),
                                record.deviceModel.csvEscape(),
                                record.androidVersion.csvEscape(),
                                record.appVersion.csvEscape(),
                                record.note.csvEscape(),
                                record.sourceMode,
                                record.moveDirection,
                                record.intervalMeters,
                                record.azimuth,
                                record.ssid.csvEscape(),
                                record.bssid,
                                record.rssi,
                                record.frequency,
                                record.scanFreshness,
                                record.scanUpdated,
                                record.duplicateScore,
                                record.timestamp
                            ).joinToString(",")
                        )
                    }
                }
                exportAnchorsCsv()
                exportApCalibrationsCsv()
                exportMapMetadata()
                latestExportPath = file.absolutePath
                updateStatus("\u532f\u51fa\u6210\u529f\uff1a${file.absolutePath}\n\u9328\u9ede CSV\uff1a${File(outputDir, "wifi_anchor_records.csv").absolutePath}\nAP \u6821\u6b63 CSV\uff1a${File(outputDir, "wifi_ap_calibrations.csv").absolutePath}\n\u5730\u5716\u8cc7\u8a0a CSV\uff1a${File(outputDir, "map_metadata.csv").absolutePath}")
                showMessage("\u532f\u51fa\u6210\u529f\uff1a${file.absolutePath}")
            } catch (ioException: IOException) {
                latestError = "CSV 寫入失敗：${ioException.message}"
                updateStatus("CSV 寫入失敗：${ioException.message}")
            }
        }
    }

    private fun shareCsvFiles() {
        lifecycleScope.launch {
            val outputDir = getExternalFilesDir(null) ?: filesDir
            val files = csvExportFiles(outputDir)
            if (!files.first().exists()) {
                val records = dao.getAllRecords()
                if (records.isEmpty()) {
                    updateStatus("目前沒有資料可分享")
                    showMessage("目前沒有資料可分享")
                    return@launch
                }
                exportCsv()
                delay(500L)
            }
            val existingFiles = files.filter { it.exists() && it.length() > 0L }
            if (existingFiles.isEmpty()) {
                updateStatus("找不到 CSV 檔案，請先匯出 CSV")
                showMessage("找不到 CSV 檔案，請先匯出 CSV")
                return@launch
            }
            val uris = ArrayList<Uri>(
                existingFiles.map { file ->
                    FileProvider.getUriForFile(
                        this@MainActivity,
                        "${packageName}.fileprovider",
                        file
                    )
                }
            )
            val shareIntent = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                type = "*/*"
                putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                putExtra(Intent.EXTRA_SUBJECT, "Wi-Fi 指紋採樣資料")
                putExtra(Intent.EXTRA_TEXT, "Wi-Fi 指紋資料、錨點、地圖資訊與匯入地圖圖片")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(shareIntent, "分享採樣資料"))
            updateStatus("已開啟採樣資料分享：${existingFiles.joinToString { it.name }}")
        }
    }

    private fun csvExportFiles(outputDir: File): List<File> {
        val baseFiles = listOf(
            File(outputDir, "wifi_fingerprint_records.csv"),
            File(outputDir, "wifi_anchor_records.csv"),
            File(outputDir, "wifi_ap_calibrations.csv"),
            File(outputDir, "map_metadata.csv")
        )
        val mapImages = outputDir.listFiles { file ->
            file.isFile && file.name.startsWith("imported_floor_map.") && file.length() > 0L
        }?.toList().orEmpty()
        return baseFiles + mapImages
    }

    private fun exportMapMetadata() {
        val outputDir = getExternalFilesDir(null) ?: filesDir
        val metadataFile = File(outputDir, "map_metadata.csv")
        val exportedMapName = importedMapPath?.let { path ->
            val source = File(path)
            if (source.exists()) {
                val target = File(outputDir, "imported_floor_map.${source.extension.ifBlank { "image" }}")
                source.copyTo(target, overwrite = true)
                target.name
            } else {
                ""
            }
        }.orEmpty()
        metadataFile.bufferedWriter(Charsets.UTF_8).use { writer ->
            writer.appendLine("mapId,mapMode,exportedMapFile,metersPerPixel,coordinateUnit,calibrated,mapHeadingOffsetDegrees")
            val calibrated = metersPerPixel != null
            val mapMode = if (importedMapPath == null) "AUTO_GENERATED" else "IMPORTED_IMAGE"
            val unit = if (importedMapPath == null) "meter" else "image_pixel"
            writer.appendLine(
                listOf(
                    currentMapId.csvEscape(),
                    mapMode,
                    exportedMapName.csvEscape(),
                    metersPerPixel?.toString().orEmpty(),
                    unit,
                    calibrated,
                    mapHeadingOffsetDegrees?.toString().orEmpty()
                ).joinToString(",")
            )
        }
    }

    private suspend fun exportAnchorsCsv() {
        val anchors = anchorDao.getAllAnchors()
        val outputDir = getExternalFilesDir(null) ?: filesDir
        val file = File(outputDir, "wifi_anchor_records.csv")
        file.bufferedWriter(Charsets.UTF_8).use { writer ->
            writer.appendLine("id,anchorId,pointId,x,y,floor,mapId,anchorType,note,transitionGroupId,transitionRole,targetFloor,timestamp")
            anchors.forEach { anchor ->
                writer.appendLine(
                    listOf(
                        anchor.id,
                        anchor.anchorId,
                        anchor.pointId,
                        anchor.x,
                        anchor.y,
                        anchor.floor,
                        anchor.mapId.csvEscape(),
                        anchor.anchorType.csvEscape(),
                        anchor.note.csvEscape(),
                        anchor.transitionGroupId.csvEscape(),
                        anchor.transitionRole.csvEscape(),
                        anchor.targetFloor ?: "",
                        anchor.timestamp
                    ).joinToString(",")
                )
            }
        }
    }

    private fun showApCalibrationMenu() {
        AlertDialog.Builder(this)
            .setTitle("AP 三邊定位校正")
            .setItems(
                arrayOf(
                    "操作步驟",
                    "1. 自動建立候選基地台",
                    "2. 在目前點位確認基地台",
                    "3. 查看校正結果",
                    "4. 匯出基地台 CSV",
                    "5. 上傳基地台資料"
                )
            ) { _, index ->
                when (index) {
                    0 -> showApCalibrationInstructions()
                    1 -> buildApCalibrationCandidates()
                    2 -> confirmApAtCurrentPoint()
                    3 -> showApCalibrationSummary()
                    4 -> lifecycleScope.launch {
                        val file = exportApCalibrationsCsv()
                        updateStatus("基地台資料已匯出：${file.absolutePath}")
                        showMessage("已匯出 ${file.name}")
                    }
                    5 -> uploadPendingWifiScans()
                }
            }
            .setMessage(
                "先用現有指紋推算候選位置，再到候選位置附近掃描並確認。" +
                    "完成一台後可用相同步驟確認下一台；至少三台已確認且位置不共線，才可供三邊定位使用。"
            )
            .setNegativeButton("關閉", null)
            .show()
    }

    private fun showApCalibrationInstructions() {
        AlertDialog.Builder(this)
            .setTitle("AP 校正操作步驟")
            .setMessage(
                "1. 選好地圖與樓層，先執行「自動建立候選基地台」。\n\n" +
                    "2. 查看結果中的建議點位，走到該點附近。\n\n" +
                    "3. 在地圖選取你實際站立的點位，按「掃描不儲存」。手機保持胸前直立。\n\n" +
                    "4. 回到 AP 三邊定位校正，選「在目前點位確認基地台」。只有 -72 dBm 以上且符合歷史訊號的 AP 才能確認。\n\n" +
                    "5. 對下一台重複第 2 至第 4 步。至少確認 3 台且位置不可排成一直線。\n\n" +
                    "6. 查看結果顯示「可用」後匯出 CSV。每個樓層要分開完成。"
            )
            .setPositiveButton("知道了", null)
            .show()
    }

    private fun buildApCalibrationCandidates() {
        val mapId = activeSamplingMapId()
        val floor = activeSamplingFloor()
        if (mapId.isBlank() || floor == null) {
            showMessage("請先選擇後端地圖與樓層")
            return
        }
        val scale = effectiveMetersPerPixel()
        updateStatus("正在分析 $mapId / ${floorCode(floor)} 的穩定基地台...")
        lifecycleScope.launch {
            val candidates = wifiApCalibrationDao.getCandidates(mapId, floor)
            if (candidates.isEmpty()) {
                showMessage("目前沒有符合條件的基地台。每台至少需要 6 個不同點位與 24 筆訊號資料。")
                return@launch
            }
            val calibrator = WifiApCalibrator()
            var saved = 0
            candidates.forEach { candidate ->
                val records = wifiApCalibrationDao.getObservations(mapId, floor, candidate.bssid)
                val estimate = calibrator.estimate(records, scale) ?: return@forEach
                if (estimate.rmse > 12f) return@forEach
                wifiApCalibrationDao.upsert(
                    WifiApCalibration(
                        calibrationId = apCalibrationId(mapId, floor, candidate.bssid),
                        bssid = candidate.bssid,
                        ssid = candidate.ssid,
                        mapId = mapId,
                        floor = floor,
                        x = estimate.x,
                        y = estimate.y,
                        referenceRssi = estimate.referenceRssi,
                        pathLossExponent = estimate.pathLossExponent,
                        rmse = estimate.rmse,
                        samplePointCount = estimate.samplePointCount,
                        observationCount = estimate.observationCount,
                        suggestedPointId = estimate.suggestedPointId,
                        status = "CANDIDATE",
                        source = "FINGERPRINT_ESTIMATE",
                        updatedAt = System.currentTimeMillis()
                    )
                )
                saved += 1
            }
            if (saved == 0) {
                showMessage("候選訊號波動過大，尚未產生可確認的基地台。請先補測不同方向的點位。")
            } else {
                updateStatus("已建立 $saved 台候選基地台。請到建議點位附近，掃描後按 AP 三邊定位校正，再選第 2 步確認。")
                showApCalibrationSummary()
            }
        }
    }

    private fun confirmApAtCurrentPoint() {
        val point = currentPoint
        if (point == null) {
            showMessage("請先在地圖上選取目前所在的已知點位")
            return
        }
        if (lastScanResults.isEmpty()) {
            showMessage("請先按掃描不儲存，取得目前 Wi-Fi 訊號")
            return
        }
        val mapId = activeSamplingMapId()
        val floor = activeSamplingFloor() ?: point.floor
        lifecycleScope.launch {
            val calibrations = wifiApCalibrationDao.getForScope(mapId, floor)
                .filter { it.status != "VERIFIED" }
                .sortedByDescending { calibration ->
                    lastScanResults.firstOrNull { it.bssid.equals(calibration.bssid, true) }?.rssi ?: -120
                }
            if (calibrations.isEmpty()) {
                showMessage("尚無待確認基地台，請先執行第 1 步建立候選基地台")
                return@launch
            }
            val labels = calibrations.map { calibration ->
                val liveRssi = lastScanResults.firstOrNull { it.bssid.equals(calibration.bssid, true) }?.rssi
                val signal = liveRssi?.let { "$it dBm" } ?: "目前未掃到"
                "${calibration.ssid.ifBlank { "隱藏 SSID" }}\n${calibration.bssid}｜$signal｜建議 ${calibration.suggestedPointId}"
            }.toTypedArray()
            AlertDialog.Builder(this@MainActivity)
                .setTitle("確認目前位置的基地台")
                .setSingleChoiceItems(labels, 0, null)
                .setMessage("請站在基地台正下方或最近可到達位置，手機保持胸前直立。訊號必須達 -72 dBm 以上。")
                .setPositiveButton("確認此基地台") { dialog, _ ->
                    val selected = (dialog as AlertDialog).listView.checkedItemPosition.coerceAtLeast(0)
                    verifyApCalibration(calibrations[selected], point)
                }
                .setNegativeButton("取消", null)
                .show()
        }
    }

    private fun verifyApCalibration(calibration: WifiApCalibration, point: SamplingPoint) {
        val liveSignal = lastScanResults.firstOrNull { it.bssid.equals(calibration.bssid, true) }
        if (liveSignal == null || liveSignal.rssi < -72) {
            showMessage("目前訊號不足，請靠近建議點位 ${calibration.suggestedPointId} 後重新掃描。需要 -72 dBm 以上。")
            return
        }
        lifecycleScope.launch {
            val observations = wifiApCalibrationDao.getObservations(calibration.mapId, calibration.floor, calibration.bssid)
            val estimate = WifiApCalibrator().fitAtKnownPosition(
                observations,
                point.x,
                point.y,
                effectiveMetersPerPixel()
            )
            if (estimate == null || estimate.rmse > 14f) {
                showMessage("這個位置與歷史訊號不一致，請從另一方向靠近後再確認。")
                return@launch
            }
            wifiApCalibrationDao.upsert(
                calibration.copy(
                    x = point.x,
                    y = point.y,
                    referenceRssi = estimate.referenceRssi,
                    pathLossExponent = estimate.pathLossExponent,
                    rmse = estimate.rmse,
                    samplePointCount = estimate.samplePointCount,
                    observationCount = estimate.observationCount,
                    suggestedPointId = point.pointId,
                    status = "VERIFIED",
                    source = "FIELD_CONFIRMED",
                    updatedAt = System.currentTimeMillis()
                )
            )
            val remaining = wifiApCalibrationDao.getForScope(calibration.mapId, calibration.floor)
                .count { it.status != "VERIFIED" }
            updateStatus("已確認 ${calibration.bssid}，目前點位 ${point.pointId}。尚有 $remaining 台候選基地台可套用相同步驟。")
            showApCalibrationSummary()
        }
    }

    private fun showApCalibrationSummary() {
        val mapId = activeSamplingMapId()
        val floor = activeSamplingFloor()
        if (floor == null) {
            showMessage("請先選擇樓層")
            return
        }
        lifecycleScope.launch {
            val calibrations = wifiApCalibrationDao.getForScope(mapId, floor)
            if (calibrations.isEmpty()) {
                showMessage("目前沒有基地台校正資料")
                return@launch
            }
            val verified = calibrations.filter { it.status == "VERIFIED" }
            val ready = trilaterationGeometryReady(verified, effectiveMetersPerPixel())
            val text = buildString {
                append("地圖：$mapId / ${floorCode(floor)}\n")
                append("已確認：${verified.size} 台，候選：${calibrations.size - verified.size} 台\n")
                append(if (ready) "三邊定位資料條件：可用" else "三邊定位資料條件：尚未完成（需至少 3 台已確認且不可共線）")
                calibrations.forEach { item ->
                    append("\n\n${if (item.status == "VERIFIED") "已確認" else "候選"}｜${item.ssid.ifBlank { "隱藏 SSID" }}")
                    append("\n${item.bssid}")
                    append("\n座標 ${item.x.format1()}, ${item.y.format1()}｜建議點 ${item.suggestedPointId}")
                    append("\nn=${item.pathLossExponent.format1()}｜誤差 ${item.rmse.format1()} dB｜${item.samplePointCount} 點")
                }
            }
            AlertDialog.Builder(this@MainActivity)
                .setTitle("AP 校正結果")
                .setMessage(text)
                .setPositiveButton("確定", null)
                .show()
        }
    }

    private fun trilaterationGeometryReady(calibrations: List<WifiApCalibration>, scale: Float): Boolean {
        if (calibrations.size < 3) return false
        var largestAreaSquareMeters = 0f
        for (a in 0 until calibrations.size - 2) {
            for (b in a + 1 until calibrations.size - 1) {
                for (c in b + 1 until calibrations.size) {
                    val first = calibrations[a]
                    val second = calibrations[b]
                    val third = calibrations[c]
                    val twiceAreaPixels = kotlin.math.abs(
                        first.x * (second.y - third.y) + second.x * (third.y - first.y) + third.x * (first.y - second.y)
                    )
                    largestAreaSquareMeters = maxOf(largestAreaSquareMeters, twiceAreaPixels * scale * scale / 2f)
                }
            }
        }
        return largestAreaSquareMeters >= 8f
    }

    private fun effectiveMetersPerPixel(): Float = metersPerPixel?.takeIf { it > 0f } ?: 0.125f

    private fun apCalibrationId(mapId: String, floor: Int, bssid: String): String =
        "$mapId|$floor|${bssid.lowercase(Locale.US)}"

    private suspend fun exportApCalibrationsCsv(): File {
        val outputDir = getExternalFilesDir(null) ?: filesDir
        val file = File(outputDir, "wifi_ap_calibrations.csv")
        val calibrations = wifiApCalibrationDao.getAll()
        file.bufferedWriter(Charsets.UTF_8).use { writer ->
            writer.appendLine("calibrationId,bssid,ssid,mapId,floor,x,y,referenceRssi,pathLossExponent,rmse,samplePointCount,observationCount,suggestedPointId,status,source,updatedAt")
            calibrations.forEach { item ->
                writer.appendLine(
                    listOf(
                        item.calibrationId.csvEscape(), item.bssid.csvEscape(), item.ssid.csvEscape(),
                        item.mapId.csvEscape(), item.floor, item.x, item.y, item.referenceRssi,
                        item.pathLossExponent, item.rmse, item.samplePointCount, item.observationCount,
                        item.suggestedPointId.csvEscape(), item.status, item.source, item.updatedAt
                    ).joinToString(",")
                )
            }
        }
        return file
    }

    private fun showAddAnchorDialog() {
        val point = currentPoint
        if (point == null) {
            updateStatus("請先建立目前點位")
            showMessage("請先建立目前點位")
            return
        }

        lifecycleScope.launch {
            val linkSources = anchorDao.getAllAnchors()
                .filter { it.transitionRole == "START" && it.transitionGroupId.isNotBlank() }
                .sortedByDescending { it.timestamp }
            showAddAnchorDialog(point, linkSources)
        }
    }

    private fun showAddAnchorDialog(point: SamplingPoint, linkSources: List<AnchorRecord>) {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 16, 40, 0)
        }
        val typeSpinner = Spinner(this)
        val anchorTypeLabels = listOf("地標", "電梯", "樓梯", "手扶梯", "出入口", "教室", "廁所", "其他")
        val anchorTypeCodes = listOf("LANDMARK", "ELEVATOR", "STAIR", "ESCALATOR", "EXIT", "CORNER", "JUNCTION", "OTHER")
        typeSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, anchorTypeLabels)

        val transitionSpinner = Spinner(this)
        val transitionLabels = listOf("一般錨點", "開始連接點", "接續連接點")
        val transitionModes = listOf("NORMAL", "START_LINK", "CONTINUE_LINK")
        transitionSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, transitionLabels)

        val sourceSpinner = Spinner(this)
        val sourceLabels = if (linkSources.isEmpty()) {
            listOf("目前沒有可接續的連接點")
        } else {
            linkSources.map { source -> anchorLinkLabel(source) }
        }
        sourceSpinner.adapter = object : ArrayAdapter<String>(this, android.R.layout.simple_spinner_dropdown_item, sourceLabels) {
            override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
                return sourceTextView(getItem(position).orEmpty(), compact = true)
            }

            override fun getDropDownView(position: Int, convertView: View?, parent: ViewGroup): View {
                return sourceTextView(getItem(position).orEmpty(), compact = false)
            }
        }

        val targetFloorInput = EditText(this).apply {
            hint = "目標樓層，例如 2、F2 或 B1"
            inputType = android.text.InputType.TYPE_CLASS_TEXT
        }
        val noteInput = EditText(this).apply {
            hint = "備註，例如 A 出口或同一座電梯"
            minLines = 2
        }
        container.addView(typeSpinner)
        container.addView(transitionSpinner)
        container.addView(sourceSpinner)
        container.addView(targetFloorInput)
        container.addView(noteInput)

        val pendingHint = pendingTransitionGroupId?.takeIf { it.isNotBlank() }?.let { group ->
            "\n\n待接續連接：" + group +
                "\n來源：" + pendingTransitionSourceMapId.ifBlank { "-" } + " / " + pendingTransitionSourcePointId.ifBlank { "-" } +
                "\n類型：" + pendingTransitionSourceType.ifBlank { "-" } +
                "\n備註：" + pendingTransitionSourceNote.ifBlank { "-" }
        }.orEmpty()

        AlertDialog.Builder(this)
            .setTitle("新增錨點 / 地圖連接")
            .setMessage("同樓層多張地圖或跨樓層電梯、樓梯，請用開始連接點與接續連接點建立關係。" + pendingHint)
            .setView(container)
            .setPositiveButton("儲存") { _, _ ->
                val anchorType = anchorTypeCodes.getOrElse(typeSpinner.selectedItemPosition) { "LANDMARK" }
                val transitionMode = transitionModes.getOrElse(transitionSpinner.selectedItemPosition) { "NORMAL" }
                val selectedSource = if (transitionMode == "CONTINUE_LINK") linkSources.getOrNull(sourceSpinner.selectedItemPosition) else null
                val targetFloor = parseFloorCode(targetFloorInput.text.toString())
                val note = noteInput.text.toString().trim().ifBlank { point.note }
                saveAnchor(point, anchorType, note, transitionMode, targetFloor, selectedSource)
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun sourceTextView(label: String, compact: Boolean): TextView {
        return TextView(this).apply {
            text = label
            textSize = if (compact) 14f else 15f
            maxLines = if (compact) 3 else 6
            setSingleLine(false)
            setPadding(16, 12, 16, 12)
            setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_primary))
        }
    }

    private fun anchorLinkLabel(source: AnchorRecord): String {
        val floorText = floorDisplayName(source.floor)
        val noteText = source.note.ifBlank { "無備註" }
        return "${source.transitionGroupId}，$floorText，${source.pointId}\n${anchorCategoryLabel(source.anchorType)}，$noteText"
    }

    private fun saveAnchor(
        point: SamplingPoint,
        anchorType: String,
        note: String,
        transitionMode: String,
        targetFloor: Int?,
        selectedSource: AnchorRecord? = null
    ) {
        lifecycleScope.launch {
            val timestamp = System.currentTimeMillis()
            val nextIndex = anchorDao.getAnchorCount() + 1
            val transitionRole: String
            val transitionGroupId: String

            when (transitionMode) {
                "START_LINK" -> {
                    transitionRole = "START"
                    transitionGroupId = "${anchorType.transitionPrefix()}_%03d".format(nextIndex)
                    pendingTransitionGroupId = transitionGroupId
                    pendingTransitionSourceMapId = activeSamplingMapId()
                    pendingTransitionSourcePointId = point.pointId
                    pendingTransitionSourceType = anchorType
                    pendingTransitionSourceNote = note
                }
                "CONTINUE_LINK" -> {
                    val source = selectedSource
                    val previousGroup = source?.transitionGroupId
                        ?: pendingTransitionGroupId
                        ?: anchorDao.getLatestTransitionAnchor()?.transitionGroupId
                    if (previousGroup.isNullOrBlank()) {
                        updateStatus("找不到可接續的連接點，請先建立開始連接點")
                        showMessage("請先建立開始連接點")
                        return@launch
                    }
                    transitionRole = "CONNECTED"
                    transitionGroupId = previousGroup
                    pendingTransitionGroupId = previousGroup
                    pendingTransitionSourceMapId = source?.mapId ?: pendingTransitionSourceMapId
                    pendingTransitionSourcePointId = source?.pointId ?: pendingTransitionSourcePointId
                    pendingTransitionSourceType = source?.anchorType ?: pendingTransitionSourceType
                    pendingTransitionSourceNote = source?.note ?: pendingTransitionSourceNote
                }
                else -> {
                    transitionRole = "NONE"
                    transitionGroupId = ""
                }
            }

            val anchor = AnchorRecord(
                anchorId = "A%03d".format(nextIndex),
                pointId = point.pointId,
                x = point.x,
                y = point.y,
                floor = point.floor,
                mapId = activeSamplingMapId(),
                anchorType = anchorType,
                note = note,
                transitionGroupId = transitionGroupId,
                transitionRole = transitionRole,
                targetFloor = targetFloor ?: selectedSource?.floor,
                timestamp = timestamp
            )
            anchorDao.insert(anchor)
            anchorCount = nextIndex
            binding.mapSamplingView.addAnchor(anchor)
            saveSamplingMetadata()
            updatePointPanel()
            updateSessionPanel()
            val transitionText = if (transitionGroupId.isBlank()) "" else "\n連接群組：$transitionGroupId ($transitionRole)"
            updateStatus("已新增 ${anchor.anchorId}: $anchorType (${point.pointId}) on ${activeSamplingMapId()} / ${floorDisplayName(anchor.floor)}$transitionText")
        }
    }

    private fun confirmClearDatabase() {
        AlertDialog.Builder(this)
            .setMessage("\u78ba\u5b9a\u8981\u6e05\u7a7a\u6240\u6709 Wi-Fi \u63a1\u6a23\u8cc7\u6599\u55ce\uff1f\u6b64\u52d5\u4f5c\u7121\u6cd5\u5fa9\u539f\u3002")
            .setPositiveButton("\u78ba\u5b9a") { _, _ ->
                lifecycleScope.launch {
                    dao.deleteAll()
                    anchorDao.deleteAll()
                    refreshRecordCount()
                    refreshAnchors()
                    refreshReplenishmentPanel()
                    updateStatus("\u8cc7\u6599\u5eab\u5df2\u6e05\u7a7a")
                }
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun manualPointFromInput(): SamplingPoint? {
        return currentPoint.also {
            if (it == null) updateStatus("請先點選地圖上的既有點位；新增請按新增點位")
        }
    }

    private fun legacyManualPointFromInput(): SamplingPoint? {
        val pointIdText = binding.editManualPointId.text.toString().trim()
        val x = binding.editManualX.text.toString().toFloatOrNull()
        val y = binding.editManualY.text.toString().toFloatOrNull()
        val floor = parseFloorCode(binding.editManualFloor.text.toString())
            ?: readFloor()
        if (pointIdText.isBlank() || x == null || y == null || floor == null) {
            updateStatus("手動採樣需要填寫 pointId、x、y、floor")
            showMessage("請填寫 pointId、x、y、floor")
            return null
        }
        return SamplingPoint(
            pointId = pointIdText,
            x = x,
            y = y,
            floor = floor,
            note = "",
            sourceMode = "MANUAL",
            moveDirection = "START",
            intervalMeters = readIntervalMeters() ?: 1.5f,
            azimuth = safeAzimuth()
        )
    }

    private suspend fun refreshRecordCount() {
        recordCount = dao.getRecordCount()
        binding.textRecordCount.text = "Records: $recordCount"
    }

    private data class PointQuality(
        val point: SamplingPoint,
        val sampleCount: Int,
        val medianApCount: Int,
        val freshRatio: Float,
        val unstableApCount: Int,
        val severity: Int,
        val reasons: List<String>
    )

    private suspend fun refreshReplenishmentPanel() {
        val points = binding.mapSamplingView.getPoints()
        val targetSamples = binding.editAutoScanCount.text.toString().toIntOrNull()
            ?: autoScanTargetCount
        if (points.isEmpty()) {
            replenishmentPointIds = emptySet()
            binding.mapSamplingView.setPointsNeedingReplenishment(emptySet())
            binding.mapSamplingView.setWeakQualityPoints(emptySet())
            binding.textReplenishmentStatus.text = "目前沒有點位可檢查"
            binding.layoutReplenishmentChips.removeAllViews()
            binding.scrollReplenishmentChips.isVisible = false
            return
        }

        val qualityItems = points.map { evaluatePointQuality(it, targetSamples) }
        val needsReplenishment = qualityItems.filter { it.severity > 0 }
        val weakPointIds = needsReplenishment.filter { it.severity >= 2 }.map { it.point.pointId }.toSet()
        val warningPointIds = needsReplenishment.filter { it.severity == 1 }.map { it.point.pointId }.toSet()

        replenishmentPointIds = needsReplenishment.map { it.point.pointId }.toSet()
        binding.mapSamplingView.setPointsNeedingReplenishment(warningPointIds)
        binding.mapSamplingView.setWeakQualityPoints(weakPointIds)
        binding.layoutReplenishmentChips.removeAllViews()
        binding.scrollReplenishmentChips.isVisible = needsReplenishment.isNotEmpty()

        if (needsReplenishment.isEmpty()) {
            binding.textReplenishmentStatus.text = "目前沒有需要補採的點位"
            return
        }

        binding.textReplenishmentStatus.text =
            "\u4ee5\u4e0b\u9ede\u4f4d\u5efa\u8b70\u88dc\u63a1\uff0c\u9ede\u9078\u5f8c\u53ef\u56de\u5230\u8a72\u9ede\u7e7c\u7e8c\u6383\u63cf"

        needsReplenishment.forEach { item ->
            val chip = TextView(this).apply {
                text = buildString {
                    append(item.point.pointId)
                    append(" ")
                    append(item.sampleCount)
                    append("/")
                    append(targetSamples)
                    append("，AP ")
                    append(item.medianApCount)
                    append(" AP\uff1a")
                    append(item.reasons.firstOrNull().orEmpty())
                }
                textSize = 12f
                setTextColor(
                    ContextCompat.getColor(
                        this@MainActivity,
                        if (item.severity >= 2) R.color.danger_red else R.color.warning_amber
                    )
                )
                setBackgroundResource(if (item.severity >= 2) R.drawable.bg_button_danger_outline else R.drawable.bg_button_secondary)
                setPadding(dp(10), dp(7), dp(10), dp(7))
                setOnClickListener { goToReplenishmentPoint(item.point, item) }
            }
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                marginEnd = dp(8)
            }
            binding.layoutReplenishmentChips.addView(chip, params)
        }
    }

    private suspend fun evaluatePointQuality(point: SamplingPoint, targetSamples: Int): PointQuality {
        val activeMapId = activeSamplingMapId()
        val allowedMapIds = localMapScopeIdsFor(activeMapId, point.floor).toSet()
        val records = dao.getRecordsByPoint(point.pointId)
            .filter { it.mapId in allowedMapIds && it.floor == point.floor }
        val samples = records.groupBy { it.sampleId }
        val sampleCount = samples.size
        val apCounts = samples.values.map { rows -> rows.map { it.bssid }.distinct().size }.sorted()
        val medianApCount = medianInt(apCounts)
        val freshCount = samples.values.count { rows ->
            rows.firstOrNull()?.scanFreshness.orEmpty() in setOf(ScanFreshness.FRESH, "")
        }
        val freshRatio = if (sampleCount == 0) 0f else freshCount.toFloat() / sampleCount
        val unstableApCount = records.groupBy { it.bssid }.values.count { rows ->
            rows.size >= 3 && populationStd(rows.map { it.rssi }) > 12f
        }

        val reasons = mutableListOf<String>()
        var severity = 0
        val minimumUsefulSamples = maxOf(3, targetSamples / 2)
        if (sampleCount >= targetSamples && medianApCount >= 6 && freshRatio >= 0.65f && unstableApCount <= 1) {
            return PointQuality(point, sampleCount, medianApCount, freshRatio, unstableApCount, 0, emptyList())
        }

        if (sampleCount == 0) {
            reasons.add("尚未採樣")
            severity = maxOf(severity, 2)
        } else if (sampleCount < minimumUsefulSamples) {
            reasons.add("樣本不足")
            severity = maxOf(severity, 2)
        } else if (sampleCount < targetSamples) {
            reasons.add("\u6a23\u672c\u7565\u5c11")
            severity = maxOf(severity, 1)
        }
        if (medianApCount in 1..3) {
            reasons.add("AP \u6578\u91cf\u904e\u5c11")
            severity = maxOf(severity, 2)
        } else if (medianApCount in 4..5) {
            reasons.add("AP \u6578\u91cf\u504f\u5c11")
            severity = maxOf(severity, 1)
        }
        if (sampleCount > 0 && freshRatio < 0.35f && sampleCount < targetSamples) {
            reasons.add("\u53ef\u80fd\u91cd\u8907\u6383\u63cf")
            severity = maxOf(severity, 2)
        } else if (sampleCount > 0 && freshRatio < 0.65f) {
            reasons.add("\u6709\u4e9b\u6383\u63cf\u53ef\u80fd\u91cd\u8907")
            severity = maxOf(severity, 1)
        }
        if (unstableApCount >= 6 && sampleCount < targetSamples) {
            reasons.add("RSSI 變動過大")
            severity = maxOf(severity, 2)
        } else if (unstableApCount >= 3) {
            reasons.add("RSSI \u8b8a\u52d5\u504f\u5927")
            severity = maxOf(severity, 1)
        }
        return PointQuality(point, sampleCount, medianApCount, freshRatio, unstableApCount, severity, reasons)
    }

    private fun goToReplenishmentPoint(point: SamplingPoint, quality: PointQuality) {
        currentPoint = point
        binding.mapSamplingView.setCurrentPoint(point.pointId)
        updatePointPanel()
        updateStatus(
            "\u5df2\u56de\u5230 ${point.pointId}\uff0c\u53ef\u7e7c\u7e8c\u88dc\u63a1\u3002\n\u539f\u56e0\uff1a${quality.reasons.joinToString("\u3001")}"
        )
    }

    private fun medianInt(values: List<Int>): Int {
        if (values.isEmpty()) return 0
        return values[values.size / 2]
    }

    private fun populationStd(values: List<Int>): Float {
        if (values.size <= 1) return 0f
        val mean = values.sum().toFloat() / values.size
        val variance = values.sumOf { value ->
            val diff = value - mean
            (diff * diff).toDouble()
        } / values.size
        return kotlin.math.sqrt(variance).toFloat()
    }

    private suspend fun refreshAnchors() {
        anchorCount = anchorDao.getAnchorCount()
        binding.mapSamplingView.setAnchors(emptyList())
    }

    private fun updatePointPanel() {
        lifecycleScope.launch {
            val point = currentPoint
            if (point == null) {
                binding.textCurrentPoint.text = "尚未建立目前點位"
                return@launch
            }
            val samplesAtPoint = dao.getSampleCountByPointScope(
                point.pointId,
                localMapScopeIdsFor(activeSamplingMapId(), point.floor),
                point.floor
            )
            binding.textCurrentPoint.text = buildString {
                append("\u76ee\u524d\u9ede\u4f4d\uff1a${point.pointId}\n")
                append("\u5ea7\u6a19\uff1ax=${point.x.format1()}, y=${point.y.format1()}\n")
                append("\u6a13\u5c64\uff1a${floorCode(point.floor)}\n")
                append("\u8ddd\u96e2\uff1a${point.intervalMeters.format1()}m \u6a19\u6e96\u63a1\u6a23\n")
                append("\u5730\u6a19\uff1a${point.note.ifBlank { "\u8acb\u7528\u9328\u9ede\u7d00\u9304" }}\n")
                append("sourceMode\uff1a${point.sourceMode}\n")
                append("\u5df2\u63a1\u6a23\u6b21\u6578\uff1a$samplesAtPoint / $autoScanTargetCount")
                if (isAutoSampling) append("\uff0c\u81ea\u52d5\u63a1\u6a23 $autoScanProgressCount / $autoScanTargetCount")
                append("\n")
                append("資料庫 records 數：$recordCount\n")
                append("錨點數：$anchorCount")
            }
        }
    }

    private fun updateSamplingRunState(active: Boolean, message: String) {
        if (active) setPointEditMode(null)
        binding.textSamplingRunState.text = message
        binding.buttonStopAutoScan.isEnabled = active
        binding.textSamplingRunState.setBackgroundResource(
            if (active) R.drawable.bg_sampling_active else R.drawable.bg_sampling_stopped
        )
        binding.buttonAutoScan.text = if (active) "\u63a1\u6a23\u4e2d..." else "\u81ea\u52d5\u63a1\u6a23"
        binding.buttonStopAutoScan.setBackgroundResource(
            if (active) R.drawable.bg_button_stop_active else R.drawable.bg_button_outline
        )
        binding.buttonStopAutoScan.setTextColor(
            ContextCompat.getColor(this, if (active) R.color.danger_red else R.color.text_primary)
        )
    }

    private fun toggleHeadingLock() {
        if (headingLocked) {
            headingLocked = false
            lockedAzimuth = Float.NaN
            binding.mapSamplingView.setLockedHeadingAzimuth(null)
            binding.buttonLockHeading.text = "\u9396\u5b9a\u65b9\u5411"
            binding.buttonLockHeading.setBackgroundResource(R.drawable.bg_button_outline)
            binding.buttonLockHeading.setTextColor(ContextCompat.getColor(this, R.color.text_primary))
            updateStatus("\u5df2\u89e3\u9396\u65b9\u5411\uff1a\u5be6\u5fc3\u7bad\u982d\u5c07\u8ddf\u8457\u624b\u6a5f\u65b9\u5411\u79fb\u52d5")
            return
        }
        if (currentAzimuth.isNaN()) {
            updateStatus("目前無法取得方位角，不能鎖定方向")
            showMessage("\u76ee\u524d\u7121\u6cd5\u53d6\u5f97\u65b9\u4f4d\u89d2")
            return
        }
        headingLocked = true
        lockedAzimuth = currentAzimuth
        binding.mapSamplingView.setLockedHeadingAzimuth(mapAzimuth(lockedAzimuth))
        binding.buttonLockHeading.text = "\u89e3\u9396\u65b9\u5411"
        binding.buttonLockHeading.setBackgroundResource(R.drawable.bg_button_secondary)
        binding.buttonLockHeading.setTextColor(ContextCompat.getColor(this, R.color.primary_blue_dark))
        updateStatus("\u5df2\u9396\u5b9a\u65b9\u5411\uff1a${directionTextFromCode(mapDirectionCode(lockedAzimuth))}\u3002\u6de1\u8272\u7bad\u982d\u662f\u9396\u5b9a\u65b9\u5411\uff0c\u5be6\u5fc3\u7bad\u982d\u662f\u624b\u6a5f\u5373\u6642\u65b9\u5411")
    }

    private fun effectiveForwardAzimuth(): Float =
        if (headingLocked && !lockedAzimuth.isNaN()) lockedAzimuth else currentAzimuth

    private fun vibrateSamplingComplete() {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                manager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(350L, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(350L)
            }
        } catch (_: Exception) {
            // Vibration is a field cue only; sampling data has already been stored.
        }
    }

    private fun updateStatus(
        main: String,
        apCount: Int = lastScanResults.size,
        autoProgress: String = "-"
    ) {
        wifiStatus = if (::wifiManager.isInitialized && wifiManager.isWifiEnabled) "Wi-Fi enabled" else "Wi-Fi disabled"
        binding.textStatus.text = buildString {
            append("掃描狀態：$main\n")
            append("本次 sampleId：$latestSampleId\n")
            append("本次掃到 AP 數量：$apCount\n")
            append("掃描有效性：${freshnessText(latestScanFreshness)}\n")
            append("自動採樣進度：$autoProgress\n")
            append("最新儲存時間：$latestSavedTime\n")
            append("CSV 匯出路徑：$latestExportPath\n")
            append("錯誤訊息：$latestError\n")
            append("權限狀態：$permissionStatus\n")
            append("Wi-Fi 狀態：$wifiStatus\n")
            append("指北針狀態：$compassStatus")
        }
    }

    private fun readIntervalMeters(): Float? {
        val value = binding.editIntervalMeters.text.toString().toFloatOrNull()
        if (value == null || value < 0.5f) {
            updateStatus("intervalMeters 不可小於 0.5")
            showMessage("intervalMeters 不可小於 0.5")
            return null
        }
        return value
    }

    private fun readAutoScanCount(): Int? {
        val value = binding.editAutoScanCount.text.toString().toIntOrNull()
        if (value == null || value <= 0) {
            updateStatus("autoScanCount 必須大於 0")
            showMessage("autoScanCount 必須大於 0")
            return null
        }
        return value
    }

    private fun readAutoScanIntervalSeconds(): Int? {
        val value = binding.editAutoScanInterval.text.toString().toIntOrNull()
        if (value == null || value <= 0) {
            updateStatus("autoScanIntervalSeconds 必須大於 0")
            showMessage("autoScanIntervalSeconds 必須大於 0")
            return null
        }
        if (value < 5) {
            updateStatus("autoScanIntervalSeconds 建議至少 5 秒，Android 可能限制 Wi-Fi 掃描頻率")
            showMessage("Android \u53ef\u80fd\u9650\u5236 Wi-Fi \u6383\u63cf\u983b\u7387\uff0c\u5efa\u8b70\u81f3\u5c11 5 \u79d2")
        }
        return value
    }

    private fun readFloor(): Int? {
        val floor = readFloorCodeOrNull()
        if (floor == null) {
            updateStatus("樓層格式錯誤，請輸入 1、2 或 B1")
            showMessage("請輸入樓層，例如 1 或 B1")
            return null
        }
        return floor
    }

    private fun readFloorCodeOrNull(): Int? =
        parseFloorCode(binding.editFloor.text.toString())

    private fun isLocationEnabled(): Boolean {
        val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return try {
            locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        } catch (_: Exception) {
            false
        }
    }

    private fun sampleId(): String =
        SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())

    private fun newSessionId(): String =
        "S_" + SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())

    private fun deviceModelText(): String =
        "${Build.MANUFACTURER} ${Build.MODEL}".trim()

    private fun appVersionText(): String = try {
        val info = packageManager.getPackageInfo(packageName, 0)
        info.versionName ?: if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode.toString()
        } else {
            @Suppress("DEPRECATION")
            info.versionCode.toString()
        }
    } catch (_: Exception) {
        "debug"
    }

    private fun dateTime(timestamp: Long): String =
        SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(timestamp))

    private fun safeAzimuth(): Float = if (currentAzimuth.isNaN()) -1f else currentAzimuth

    private fun mapAzimuth(rawAzimuth: Float): Float {
        if (rawAzimuth.isNaN()) return rawAzimuth
        return normalizeDegrees(rawAzimuth + (mapHeadingOffsetDegrees ?: 0f))
    }

    private fun mapDirectionCode(rawAzimuth: Float): String {
        if (rawAzimuth.isNaN()) return currentDirectionCode
        return CompassManager.directionCode(mapAzimuth(rawAzimuth))
    }

    private fun directionTextFromCode(code: String): String = when (code) {
        "NORTH" -> "\u5317"
        "NORTH_EAST" -> "東北"
        "EAST" -> "\u6771"
        "SOUTH_EAST" -> "東南"
        "SOUTH" -> "\u5357"
        "SOUTH_WEST" -> "西南"
        "WEST" -> "\u897f"
        "NORTH_WEST" -> "西北"
        else -> code
    }

    private fun normalizeDegrees(value: Float): Float {
        var normalized = value % 360f
        if (normalized < 0f) normalized += 360f
        return normalized
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private fun showMessage(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun modeLabel(mode: SamplingMode): String = when (mode) {
        SamplingMode.COMPASS_FORWARD -> "\u6307\u5317\u91dd\u524d\u9032\u63a1\u6a23"
        SamplingMode.MAP_TAP -> "\u9ede\u5730\u5716\u63a1\u6a23"
        SamplingMode.MANUAL -> "單點手動採樣"
    }

    private fun Float.format1(): String = String.format(Locale.US, "%.1f", this)

    private fun Float.format3(): String = String.format(Locale.US, "%.3f", this)

    private fun currentMapIdFromInputs(): String {
        val floor = readFloorCodeOrNull() ?: 1
        val mapNumber = binding.editMapNumber.text.toString().toIntOrNull()?.coerceAtLeast(1) ?: 1
        return mapIdFor(floor, mapNumber)
    }

    private fun activeSamplingMapId(): String =
        backendMapId.ifBlank { currentMapId.ifBlank { currentMapIdFromInputs() } }

    private fun localMapScopeIdsFor(mapId: String, floor: Int): List<String> {
        return listOf(mapId).filter { it.isNotBlank() }.distinct()
    }

    private fun formalNodeIdFor(localId: String): String {
        val mapId = activeSamplingMapId().sanitizeFileToken()
        val floorId = backendFloorId.ifBlank { floorCode(activeSamplingFloor() ?: 1) }.sanitizeFileToken()
        val id = localId.sanitizeFileToken()
        return "mobile-node-$mapId-$floorId-$id"
    }

    private fun syncDraggedBackendNode(point: SamplingPoint) {
        val nodeId = point.backendNodeId.ifBlank { return }
        val mapId = activeSamplingMapId().ifBlank { return }
        val floorId = backendFloorId.ifBlank { return }
        val backendUrl = binding.editBackendUrl.text.toString().trim().trimEnd('/').ifBlank {
            "https://maptest-02-server.onrender.com"
        }
        val type = when {
            point.note.contains("電梯") -> "elevator"
            point.note.contains("手扶梯") || point.note.contains("樓梯") -> "stair"
            point.note.contains("出口") -> "exit"
            point.note.contains("商家") -> "store"
            else -> "poi"
        }
        lifecycleScope.launch {
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    postBackendRouteNode(
                        backendUrl,
                        BackendRouteNode(
                            id = nodeId,
                            mapId = mapId,
                            floorId = floorId,
                            x = point.x,
                            y = point.y,
                            nodeType = type,
                            label = point.displayLabel.ifBlank { point.pointId },
                            isWalkable = true
                        )
                    )
                }
            }
            result.onFailure { error ->
                binding.textSyncStatus.text = "同步狀態：節點位置暫時未同步到後端\n${error.message ?: error.javaClass.simpleName}"
            }
        }
    }

    private fun backendNodePointId(node: BackendRouteNode, index: Int): String {
        val suffix = node.id
            .removePrefix("k-node-")
            .removePrefix("node-")
            .replace(Regex("[^A-Za-z0-9]+"), "_")
            .trim('_')
            .uppercase(Locale.US)
            .ifBlank { "N%02d".format(index + 1) }
        return if (node.floorId.contains("2f", ignoreCase = true) && !suffix.startsWith("F2_")) {
            "F2_$suffix"
        } else {
            suffix
        }
    }

    private fun activeSamplingFloor(): Int? {
        if (backendMapId.isNotBlank() && backendFloorId.isNotBlank()) {
            backendSelectedFloorCode()?.let { return it }
        }
        return readFloorCodeOrNull()
    }

    private fun mapSettingsScopeKey(mapId: String, floor: Int): String =
        "${mapId}_${floorCode(floor)}"

    private fun mapIdFor(floor: Int, mapNumber: Int): String = "${floorCode(floor)}_M$mapNumber"

    private fun parseFloorCode(raw: String): Int? {
        val value = raw.trim().uppercase(Locale.US)
        if (value.isBlank()) return null
        value.toIntOrNull()?.let { return it }
        if (value.startsWith("B")) {
            val basement = value.removePrefix("B").toIntOrNull() ?: return null
            if (basement <= 0) return null
            return -basement
        }
        if (value.startsWith("F")) {
            val floor = value.removePrefix("F").toIntOrNull() ?: return null
            if (floor <= 0) return null
            return floor
        }
        return null
    }

    private fun backendFloorCodeOrNull(floor: BackendFloor): Int? {
        parseFloorCode(floor.name)?.let { return it }
        parseFloorCode(floor.id)?.let { return it }
        Regex("""(?:^|[^A-Z0-9])B(\d+)(?:[^A-Z0-9]|$)""")
            .find(floor.id.uppercase(Locale.US))
            ?.groupValues
            ?.getOrNull(1)
            ?.toIntOrNull()
            ?.let { return -it }
        Regex("""(?:^|[^A-Z0-9])(\d+)F(?:[^A-Z0-9]|$)""")
            .find(floor.id.uppercase(Locale.US))
            ?.groupValues
            ?.getOrNull(1)
            ?.toIntOrNull()
            ?.let { return it }
        Regex("""FLOOR[_-]?(-?\d+)""")
            .find(floor.id.uppercase(Locale.US))
            ?.groupValues
            ?.getOrNull(1)
            ?.toIntOrNull()
            ?.let { return it }
        return null
    }

    private fun floorCode(floor: Int): String =
        if (floor < 0) "B${kotlin.math.abs(floor)}" else "F${floor.coerceAtLeast(1)}"

    private fun floorDisplayName(floor: Int): String {
        val raw = binding.editFloor.text.toString().trim().uppercase(Locale.US)
        return when {
            raw.startsWith("B") || raw.startsWith("F") -> raw
            floor < 0 -> "B${kotlin.math.abs(floor)}"
            else -> "${floor}F"
        }
    }

    private fun String.urlEncode(): String = URLEncoder.encode(this, Charsets.UTF_8.name())

    private fun String.sanitizeFileToken(): String =
        replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "map" }

    private fun JSONObject.optNullableFloat(key: String): Float? {
        if (!has(key) || isNull(key)) return null
        val value = optDouble(key, Double.NaN)
        return if (value.isNaN()) null else value.toFloat()
    }

    private fun String.transitionPrefix(): String = when {
        contains("ELEVATOR") || contains("LIFT") -> "ELEV"
        contains("ELEVATOR") || contains("LIFT") -> "ELEVATOR"
        contains("STAIR") || contains("ESCALATOR") -> "STAIR"
        contains("EXIT") || contains("DOOR") -> "EXIT"
        else -> "TRANS"
    }

    private fun String.csvEscape(): String {
        val needsEscape = contains(",") || contains("\"") || contains("\n") || contains("\r")
        val escaped = replace("\"", "\"\"")
        return if (needsEscape) "\"$escaped\"" else escaped
    }
}
