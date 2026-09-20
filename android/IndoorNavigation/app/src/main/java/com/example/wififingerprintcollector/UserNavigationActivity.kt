package com.example.wififingerprintcollector

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.BitmapFactory
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Base64
import android.view.LayoutInflater
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import com.example.wififingerprintcollector.databinding.ActivityUserNavigationBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID
import kotlin.math.abs
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.sin

class UserNavigationActivity : AppCompatActivity() {
    private companion object {
        const val PRIVACY_PREFS = "privacy"
        const val KEY_FEEDBACK_CONSENT_ASKED = "feedback_consent_asked"
        const val KEY_FEEDBACK_CONSENT_GRANTED = "feedback_consent_granted"
        const val KEY_FEEDBACK_SWITCH_ENABLED = "feedback_switch_enabled"
        const val KEY_PENDING_FEEDBACK_QUEUE = "pending_feedback_queue"
        const val KEY_ANONYMOUS_USER_ID = "anonymous_user_id"
        const val KEY_MARKER_STYLE = "marker_style"
        const val KEY_SOS_EMAILS = "sos_emails"
        const val KEY_SOS_REQUESTER_NAME = "sos_requester_name"
        const val CACHE_PREFS = "navigation_cache"
        const val KEY_CACHED_PLACES = "cached_places"
        const val KEY_CACHED_ROUTE_ZONES = "cached_route_zones"
        const val DEFAULT_BACKEND_URL = "https://maptest-02-server.onrender.com"
        const val MAP_ID = "k-area-airport"
        const val GROUND_FLOOR_ID = "k-area-airport-1f"
        const val SECOND_FLOOR_ID = "k-area-airport-2f"
        const val FALLBACK_START_X = 870f
        const val FALLBACK_START_Y = 320f
        const val MAX_PENDING_FEEDBACK = 20
        const val MIN_LOCATION_CONFIDENCE = 20
        const val MAX_LOCATION_ERROR_METERS = 80f
        const val MAX_SNAP_DISTANCE = 80f
        const val LOW_CONFIDENCE_MAX_SNAP_DISTANCE = 180f
        const val DEFAULT_ROUTE_PIXELS_PER_METER = 8f
        const val LOCATION_DEAD_ZONE_PIXELS = 8f
        const val MAX_WALKING_SPEED_METERS_PER_SECOND = 3.0f
        const val FLOOR_SWITCH_REQUIRED_HITS = 3
        const val FLOOR_SWITCH_REQUIRED_CONFIDENCE = 65
        const val FLOOR_SWITCH_BACK_REQUIRED_HITS = 5
        const val FLOOR_SWITCH_BACK_REQUIRED_CONFIDENCE = 75
        const val FLOOR_SWITCH_COOLDOWN_MILLIS = 20000L
        const val MIN_LOCATION_UPDATE_INTERVAL_MILLIS = 1000L
        const val DEFAULT_LOCATION_UPDATE_INTERVAL_MILLIS = 1500L
        const val MAX_LOCATION_UPDATE_INTERVAL_MILLIS = 5000L
        const val BLOCKED_ROUTE_ADVANCE_PIXELS = 10f
        const val MIN_STEP_ADVANCE_METERS = 0.25f
        const val MAX_STEP_ADVANCE_METERS = 1.2f
        const val WIFI_ROUTE_MAX_SNAP_DISTANCE_PIXELS = 95f
        const val WIFI_ROUTE_MAX_PROGRESS_JUMP_METERS = 7f
        const val CONNECTOR_LOCK_DISTANCE_PIXELS = 55f
        const val CONNECTOR_SWITCH_DISTANCE_PIXELS = 20f
        const val WIFI_PERMISSION_REQUEST = 7301
    }

    private lateinit var binding: ActivityUserNavigationBinding
    private lateinit var compassManager: CompassManager
    private lateinit var pdrManager: PdrManager
    private lateinit var barometerManager: BarometerManager
    private lateinit var wifiManager: WifiManager
    private val positionFusionFilter = PositionFusionFilter()

    private var latestHeadingText = "-"
    private var latestHeadingStable = false
    private var latestHeadingAzimuth = Float.NaN
    private var latestStepDistance = 0f
    private var pendingStepDistanceSinceWifi = 0f
    private var barometricSuggestedFloorId = ""
    private var barometricSuggestionAtMillis = 0L
    private var currentX = FALLBACK_START_X
    private var currentY = FALLBACK_START_Y
    private var hasCurrentPosition = true
    private var currentMapId = MAP_ID
    private var currentFloorId = GROUND_FLOOR_ID
    private val availableFloors = mutableListOf(
        DemoFloor(GROUND_FLOOR_ID, "1F"),
        DemoFloor(SECOND_FLOOR_ID, "2F")
    )
    private val floorNames = mutableMapOf(
        GROUND_FLOOR_ID to "1F",
        SECOND_FLOOR_ID to "2F"
    )
    private var activePlaces: List<DemoPlace> = emptyList()
    private var placesSyncJob: Job? = null
    private var businessHoursJob: Job? = null
    private val visiblePlaceMeta = mutableListOf<Pair<TextView, DemoPlace>>()
    private var selectedPlace: DemoPlace? = null
    private var latestRoute: DemoRouteResult? = null
    private var routeZonesByFloor: Map<String, List<DemoRouteZone>> = emptyMap()
    private var navigationActive = false
        set(value) {
            field = value
            if (::binding.isInitialized) binding.navigationMapView.setNavigationActive(value)
        }
    private var reviewNavigationStartedAt = 0L
    private var reviewNavigationPlaceId: String? = null
    private var mapFollowsHeading = false
    private var currentMarkerStyle = DemoNavigationMapView.CurrentMarkerStyle.GREEN_ARROW
    private var continuousLocationJob: Job? = null
    private var estimatingLocation = false
    private var locationUpdateIntervalMillis = DEFAULT_LOCATION_UPDATE_INTERVAL_MILLIS
    private var routeRequestInFlight = false
    private var routeRefreshPending = false
    private var lastAcceptedLocationAtMillis = 0L
    private var candidateFloorId = ""
    private var candidateFloorHits = 0
    private var lastFloorSwitchAtMillis = 0L
    private var lastRouteRefreshAtMillis = 0L
    private var lastBlockedSnapFloorId = ""
    private var lastBlockedSnapProgress = 0f
    private val navigationLocationHistory = mutableListOf<NavigationLocationSample>()

    private val places = listOf(
        DemoPlace("k-area-k12", "K12", "樓梯", GROUND_FLOOR_ID, "1F", 120f, 300f, "unset"),
        DemoPlace("k-area-k7", "K7", "手扶梯", GROUND_FLOOR_ID, "1F", 980f, 145f, "unset"),
        DemoPlace("k-area-k1", "K1", "樓梯", GROUND_FLOOR_ID, "1F", 1580f, 145f, "unset"),
        DemoPlace("k-area-k2", "K2", "樓梯", GROUND_FLOOR_ID, "1F", 1690f, 510f, "unset"),
        DemoPlace("k-area-2f-k12", "2F K12", "樓梯", SECOND_FLOOR_ID, "2F", 90f, 310f, "unset"),
        DemoPlace("k-area-2f-airport", "往桃園機場捷運", "出口", SECOND_FLOOR_ID, "2F", 340f, 70f, "unset"),
        DemoPlace("k-area-2f-escalator", "2F 右側手扶梯", "手扶梯", SECOND_FLOOR_ID, "2F", 880f, 210f, "unset")
    )

    private val routeNodes = listOf(
        DemoRouteNode("node-main-gate", 120f, 680f),
        DemoRouteNode("node-parking-a", 250f, 570f),
        DemoRouteNode("node-cross-a", 390f, 500f),
        DemoRouteNode("node-restroom-a", 430f, 420f),
        DemoRouteNode("node-service-desk", 610f, 500f),
        DemoRouteNode("node-library", 520f, 330f),
        DemoRouteNode("node-engineering", 790f, 360f)
    )

    private val routeEdges = listOf(
        DemoRouteEdge("node-main-gate", "node-parking-a", 170f),
        DemoRouteEdge("node-parking-a", "node-cross-a", 170f),
        DemoRouteEdge("node-cross-a", "node-restroom-a", 90f),
        DemoRouteEdge("node-cross-a", "node-service-desk", 220f),
        DemoRouteEdge("node-restroom-a", "node-library", 130f),
        DemoRouteEdge("node-service-desk", "node-engineering", 230f),
        DemoRouteEdge("node-library", "node-engineering", 280f)
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityUserNavigationBinding.inflate(layoutInflater)
        setContentView(binding.root)
        wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

        loadNavigationScope()
        activePlaces = loadBundledPlaces()
        setupSensorAssist()
        setupFeedbackConsent()
        loadMarkerStyle()
        setupActions()
        updateRecentNavigationText()
        updateFloorButtons()
        refreshMapPlaces()
        setFallbackInitialPosition("預設起點：1F 中間廣場。")
        updateLocationSignalStatus(LocationSignalState.OUTSIDE)
        renderSearchResults(emptyList())
        loadFloorsFromBackend()
        loadRouteZonesFromBackend()
        loadActiveModelStatus()
        ensureWifiLocationPermissions()
    }

    override fun onStart() {
        super.onStart()
        if (!navigationActive) loadPlacesFromBackend()
        loadRouteZonesFromBackend()
        if (::compassManager.isInitialized) compassManager.start()
        if (::pdrManager.isInitialized && pdrManager.isAvailable) {
            latestStepDistance = 0f
            pdrManager.start()
        }
        if (::barometerManager.isInitialized && barometerManager.isAvailable) barometerManager.start()
        flushPendingFeedback()
        reportRetryJob = lifecycleScope.launch {
            while (true) {
                flushUserReports()
                delay(30000)
            }
        }
        estimateCurrentLocation()
        startContinuousLocationUpdates()
        businessHoursJob = lifecycleScope.launch {
            while (true) {
                visiblePlaceMeta.forEach { (view, place) -> view.text = placeMeta(place) }
                delay(15000)
            }
        }
    }

    override fun onStop() {
        businessHoursJob?.cancel()
        businessHoursJob = null
        reportRetryJob?.cancel()
        reportRetryJob = null
        continuousLocationJob?.cancel()
        continuousLocationJob = null
        if (::compassManager.isInitialized) compassManager.stop()
        if (::pdrManager.isInitialized) pdrManager.stop()
        if (::barometerManager.isInitialized) barometerManager.stop()
        super.onStop()
    }

    private fun startContinuousLocationUpdates() {
        if (continuousLocationJob?.isActive == true) return
        continuousLocationJob = lifecycleScope.launch {
            while (true) {
                estimateCurrentLocation()
                delay(locationUpdateIntervalMillis)
            }
        }
    }

    private fun setupActions() {
        binding.editSearch.setOnEditorActionListener { _, _, _ ->
            performSearch()
            loadPlacesFromBackend()
            true
        }
        binding.buttonSearch.setOnClickListener {
            performSearch()
            loadPlacesFromBackend()
        }
        binding.buttonFloorGround.setOnClickListener {
            switchFloor(availableFloors.firstOrNull()?.id ?: GROUND_FLOOR_ID)
        }
        binding.buttonFloorSecond.setOnClickListener {
            if (availableFloors.size == 2) {
                switchFloor(availableFloors[1].id)
            } else {
                showFloorSelector()
            }
        }
        binding.buttonRelocate.setOnClickListener {
            manuallyBrowsingFloor = false
            estimateCurrentLocation()
        }
        binding.buttonMapRotation.setOnClickListener { toggleMapRotationMode() }
        binding.buttonZoomIn.setOnClickListener { binding.navigationMapView.zoomIn() }
        binding.buttonZoomOut.setOnClickListener { binding.navigationMapView.zoomOut() }
        binding.buttonResetMap.setOnClickListener { binding.navigationMapView.resetView() }
        binding.buttonShowRoute.setOnClickListener {
            navigationActive = false
            reviewNavigationStartedAt = 0L
            reviewNavigationPlaceId = null
            showRouteToSelectedPlace(force = true)
        }
        binding.buttonStartNavigation.setOnClickListener {
            val destination = selectedPlace
            if (destination == null) {
                binding.textNextStep.text = "請先選擇目的地。"
                return@setOnClickListener
            }
            if (!hasCurrentPosition) {
                binding.textNextStep.text = "目前不在此區域，無法開始導航。"
                return@setOnClickListener
            }
            submitAnonymousFeedbackIfAllowed(arrivedDestination = false)
            saveRecentNavigation(destination)
            postNavigationHistory(destination)
            navigationActive = true
            if (reviewNavigationPlaceId != destination.id || reviewNavigationStartedAt == 0L) {
                reviewNavigationStartedAt = SystemClock.elapsedRealtime()
                reviewNavigationPlaceId = destination.id
            }
            manuallyBrowsingFloor = false
            binding.textNextStep.text = "正在確認目前位置..."
            estimateCurrentLocation()
        }
        binding.buttonEndNavigation.setOnClickListener {
            val reviewPlace = selectedPlace?.takeIf {
                it.supportsPlaceReviews() && navigationActive && it.id == reviewNavigationPlaceId && reviewNavigationStartedAt > 0L &&
                    SystemClock.elapsedRealtime() - reviewNavigationStartedAt >= 60000L
            }
            navigationActive = false
            reviewNavigationStartedAt = 0L
            reviewNavigationPlaceId = null
            binding.textNextStep.text = "導航已結束。"
            binding.navigationMapView.clearRoute()
            latestRoute = null
            submitAnonymousFeedbackIfAllowed(arrivedDestination = true)
            reviewPlace?.let { PlaceReviewsDialog(this, backendBaseUrl(), currentMapId, it).inviteAfterNavigation() }
        }
        binding.buttonSaveLocation.setOnClickListener { saveCurrentLocation() }
        binding.buttonReturnOrigin.setOnClickListener { returnToOrigin() }
        binding.buttonClearHistory.setOnClickListener { clearLocalHistory() }
        binding.buttonReport.setOnClickListener { showUserReportDialog() }
        binding.buttonAdminMode.setOnClickListener { showSettingsDialog() }
        binding.buttonAdminMode.setOnLongClickListener {
            Toast.makeText(this, "正式版不開啟指紋採集工具", Toast.LENGTH_SHORT).show()
            true
        }
        binding.buttonSos.setOnClickListener { showSosConfirmDialog() }
    }

    private fun setupSensorAssist() {
        compassManager = CompassManager(this) { azimuth, directionText, _, stable, statusText ->
            latestHeadingAzimuth = azimuth
            latestHeadingText = directionText
            latestHeadingStable = stable
            binding.navigationMapView.setHeadingAzimuth(azimuth)
            updateSensorAssistText(statusText)
        }
        pdrManager = PdrManager(this) { _, distanceMeters ->
            val stepDelta = (distanceMeters - latestStepDistance).coerceAtLeast(0f)
            latestStepDistance = distanceMeters
            pendingStepDistanceSinceWifi = (pendingStepDistanceSinceWifi + stepDelta).coerceAtMost(30f)
            if (::barometerManager.isInitialized) {
                barometerManager.recordMovement(stepDelta)
                barometerManager.setTransitionExpected(isNearCurrentRouteConnector())
            }
            advanceCurrentPositionAlongRouteBySteps(stepDelta)
            updateSensorAssistText(if (latestHeadingStable) "穩定" else "方向可能受干擾")
        }
        barometerManager = BarometerManager(this) { direction ->
            val floorIndex = availableFloors.indexOfFirst { it.id == currentFloorId }
            val suggestedIndex = floorIndex + direction
            if (floorIndex >= 0 && suggestedIndex in availableFloors.indices) {
                barometricSuggestedFloorId = availableFloors[suggestedIndex].id
                barometricSuggestionAtMillis = SystemClock.elapsedRealtime()
            }
        }
    }

    private fun updateSensorAssistText(sensorStatus: String) {
        val stabilityHint = if (latestHeadingStable) {
            "方向穩定"
        } else {
            "正在校正位置"
        }
        binding.textSensorAssist.text =
            "目前方向 $latestHeadingText，已步行約 ${latestStepDistance.toInt()} 公尺，$stabilityHint"
    }

    private fun routePixelsPerMeter(): Float {
        val route = latestRoute ?: return DEFAULT_ROUTE_PIXELS_PER_METER
        val pixelLength = route.points.zipWithNext().sumOf { (from, to) ->
            hypot((from.x - to.x).toDouble(), (from.y - to.y).toDouble())
        }.toFloat()
        return if (pixelLength > 0f && route.distanceMeters > 0f) {
            (pixelLength / route.distanceMeters).coerceIn(2f, 20f)
        } else {
            DEFAULT_ROUTE_PIXELS_PER_METER
        }
    }

    private fun routePointsForFloor(floorId: String): List<DemoPoint> =
        latestRoute?.points.orEmpty()
            .filter { it.floorId.isBlank() || it.floorId == floorId }

    private fun projectToNavigationLine(x: Float, y: Float, floorId: String): RouteProjection? {
        val route = routePointsForFloor(floorId)
        if (!navigationActive || route.size < 2) return null

        var bestPoint = DemoPoint(x, y, floorId)
        var bestDistance = Float.MAX_VALUE
        var bestProgress = 0f
        var progressBeforeSegment = 0f
        route.zipWithNext().forEach { (from, to) ->
            val segmentX = to.x - from.x
            val segmentY = to.y - from.y
            val lengthSquared = segmentX * segmentX + segmentY * segmentY
            if (lengthSquared <= 0.001f) return@forEach
            val segmentLength = hypot(segmentX, segmentY)
            val t = (((x - from.x) * segmentX + (y - from.y) * segmentY) / lengthSquared).coerceIn(0f, 1f)
            val projectedX = from.x + segmentX * t
            val projectedY = from.y + segmentY * t
            val projectedDistance = distance(x, y, projectedX, projectedY)
            if (projectedDistance < bestDistance) {
                bestDistance = projectedDistance
                bestPoint = DemoPoint(projectedX, projectedY, floorId)
                bestProgress = progressBeforeSegment + segmentLength * t
            }
            progressBeforeSegment += segmentLength
        }
        return RouteProjection(bestPoint, bestDistance, bestProgress)
    }

    private fun pointAtRouteProgress(floorId: String, targetProgress: Float): DemoPoint? {
        val route = routePointsForFloor(floorId)
        if (route.isEmpty()) return null
        if (route.size == 1) return route.first()
        var consumed = 0f
        route.zipWithNext().forEach { (from, to) ->
            val segmentLength = distance(from.x, from.y, to.x, to.y)
            if (segmentLength <= 0.001f) return@forEach
            if (targetProgress <= consumed + segmentLength) {
                val ratio = ((targetProgress - consumed) / segmentLength).coerceIn(0f, 1f)
                return DemoPoint(
                    x = from.x + (to.x - from.x) * ratio,
                    y = from.y + (to.y - from.y) * ratio,
                    floorId = floorId
                )
            }
            consumed += segmentLength
        }
        return route.last()
    }

    private fun connectorOnCurrentRouteFloor(): Pair<DemoPoint, DemoPoint>? {
        val points = latestRoute?.points.orEmpty()
        if (!navigationActive || points.size < 2) return null
        return points.zipWithNext().firstOrNull { (from, to) ->
            from.floorId == currentFloorId &&
                to.floorId.isNotBlank() &&
                to.floorId != currentFloorId
        }
    }

    private fun constrainWifiLocationToRoute(raw: NavigationLocationSample): NavigationLocationSample {
        if (!navigationActive || latestRoute?.points.orEmpty().size < 2) return raw
        val projection = projectToNavigationLine(raw.x, raw.y, raw.floorId) ?: return raw
        val currentProjection = projectToNavigationLine(currentX, currentY, raw.floorId)
        val pixelsPerMeter = routePixelsPerMeter()
        val maxProgressJump = WIFI_ROUTE_MAX_PROGRESS_JUMP_METERS * pixelsPerMeter

        if (projection.distance > WIFI_ROUTE_MAX_SNAP_DISTANCE_PIXELS && raw.confidence < 90) {
            return currentProjection?.point?.let {
                raw.copy(
                    x = it.x,
                    y = it.y,
                    confidence = (raw.confidence - 15).coerceAtLeast(35)
                )
            } ?: raw
        }

        val connector = connectorOnCurrentRouteFloor()
        if (connector != null && raw.floorId == currentFloorId) {
            val (from, _) = connector
            val rawToConnector = distance(raw.x, raw.y, from.x, from.y)
            val currentToConnector = distance(currentX, currentY, from.x, from.y)
            if (rawToConnector <= CONNECTOR_LOCK_DISTANCE_PIXELS || currentToConnector <= CONNECTOR_LOCK_DISTANCE_PIXELS) {
                return raw.copy(x = from.x, y = from.y)
            }
        }

        if (currentProjection == null) {
            return raw.copy(x = projection.point.x, y = projection.point.y)
        }

        val progressDelta = projection.progress - currentProjection.progress
        if (abs(progressDelta) <= maxProgressJump || raw.confidence >= 88) {
            return raw.copy(x = projection.point.x, y = projection.point.y)
        }

        val limitedProgress = currentProjection.progress + progressDelta.coerceIn(-maxProgressJump, maxProgressJump)
        val limited = pointAtRouteProgress(raw.floorId, limitedProgress) ?: projection.point
        return raw.copy(
            x = limited.x,
            y = limited.y,
            confidence = (raw.confidence - 10).coerceAtLeast(35)
        )
    }

    private fun adjustLocationForBlockedNavigationZone(sample: NavigationLocationSample, floorId: String): DemoPoint {
        if (!navigationActive || !isInBlockedRouteZone(sample.x, sample.y, floorId)) {
            lastBlockedSnapFloorId = ""
            lastBlockedSnapProgress = 0f
            return DemoPoint(sample.x, sample.y, floorId)
        }
        val projection = projectToNavigationLine(sample.x, sample.y, floorId)
            ?: return DemoPoint(sample.x, sample.y, floorId)
        val currentProjection = projectToNavigationLine(currentX, currentY, floorId)
        val baseProgress = max(
            projection.progress,
            when {
                lastBlockedSnapFloorId == floorId -> lastBlockedSnapProgress
                currentProjection != null -> currentProjection.progress
                else -> projection.progress
            }
        )
        val targetProgress = if (shouldAdvanceAlongRouteWhenBlocked(sample)) {
            baseProgress + BLOCKED_ROUTE_ADVANCE_PIXELS
        } else {
            baseProgress
        }
        val snapped = pointAtRouteProgress(floorId, targetProgress) ?: projection.point
        lastBlockedSnapFloorId = floorId
        lastBlockedSnapProgress = targetProgress
        return snapped
    }

    private fun shouldAdvanceAlongRouteWhenBlocked(sample: NavigationLocationSample): Boolean {
        if (pendingStepDistanceSinceWifi >= 0.4f) return true
        if (distance(currentX, currentY, sample.x, sample.y) >= 18f) return true
        val recentMovement = navigationLocationHistory.takeLast(3).zipWithNext().sumOf { (from, to) ->
            distance(from.x, from.y, to.x, to.y).toDouble()
        }.toFloat()
        return recentMovement >= 22f
    }

    private fun advanceCurrentPositionAlongRouteBySteps(stepDeltaMeters: Float) {
        val route = latestRoute?.points.orEmpty()
        if (
            !navigationActive ||
            route.size < 2 ||
            !hasCurrentPosition ||
            stepDeltaMeters < MIN_STEP_ADVANCE_METERS
        ) return
        val projection = projectToNavigationLine(currentX, currentY, currentFloorId) ?: return
        val pixelsPerMeter = routePixelsPerMeter()
        val advancePixels = stepDeltaMeters.coerceAtMost(MAX_STEP_ADVANCE_METERS) * pixelsPerMeter
        val routeDirection = routeTravelDirection(projection.progress)
        val advanced = pointAtRouteProgress(currentFloorId, projection.progress + advancePixels * routeDirection) ?: return
        if (isInBlockedRouteZone(advanced.x, advanced.y, currentFloorId)) return
        val deltaX = advanced.x - currentX
        val deltaY = advanced.y - currentY
        positionFusionFilter.predictByMovement(deltaX, deltaY, stepDeltaMeters, pixelsPerMeter)
        currentX = advanced.x
        currentY = advanced.y
        binding.navigationMapView.setCurrentPosition(currentX, currentY)
        updateRemainingRouteDisplay()
        maybeSwitchFloorAtRouteConnector()
    }

    private fun routeTravelDirection(progress: Float): Float {
        if (!latestHeadingStable || !latestHeadingAzimuth.isFinite()) return 1f
        val before = pointAtRouteProgress(currentFloorId, (progress - 5f).coerceAtLeast(0f)) ?: return 1f
        val after = pointAtRouteProgress(currentFloorId, progress + 5f) ?: return 1f
        val routeDx = after.x - before.x
        val routeDy = after.y - before.y
        val routeLength = hypot(routeDx, routeDy)
        if (routeLength < 0.1f) return 1f
        val radians = latestHeadingAzimuth * PI.toFloat() / 180f
        val headingDx = sin(radians)
        val headingDy = -cos(radians)
        val alignment = (routeDx * headingDx + routeDy * headingDy) / routeLength
        return if (alignment < -0.45f) -1f else 1f
    }

    private fun updateRemainingRouteDisplay() {
        val route = latestRoute ?: return
        val projection = projectToNavigationLine(currentX, currentY, currentFloorId) ?: return
        val floorRoute = routePointsForFloor(currentFloorId)
        val floorPixels = floorRoute.zipWithNext().sumOf { (from, to) ->
            distance(from.x, from.y, to.x, to.y).toDouble()
        }.toFloat()
        val remainingPixels = (floorPixels - projection.progress).coerceAtLeast(0f)
        val remainingMeters = remainingPixels / routePixelsPerMeter()
        binding.textDistance.text = formatDistanceMeters(remainingMeters)
    }

    private fun positionOnRouteForDisplay(x: Float, y: Float, floorId: String): DemoPoint {
        if (!navigationActive || latestRoute?.points.orEmpty().size < 2) return DemoPoint(x, y, floorId)
        return projectToNavigationLine(x, y, floorId)?.point ?: DemoPoint(x, y, floorId)
    }

    private fun isInBlockedRouteZone(x: Float, y: Float, floorId: String): Boolean =
        routeZonesByFloor[floorId].orEmpty().any { zone ->
            zone.zoneType == "blocked" && pointInRouteZone(x, y, zone)
        }

    private fun pointInRouteZone(x: Float, y: Float, zone: DemoRouteZone): Boolean {
        if (zone.points.size >= 3) return pointInPolygon(x, y, zone.points)
        return x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height
    }

    private fun pointInPolygon(x: Float, y: Float, points: List<DemoPoint>): Boolean {
        var inside = false
        var previous = points.lastIndex
        for (index in points.indices) {
            val currentPoint = points[index]
            val previousPoint = points[previous]
            val intersects = ((currentPoint.y > y) != (previousPoint.y > y)) &&
                (x < (previousPoint.x - currentPoint.x) * (y - currentPoint.y) /
                    ((previousPoint.y - currentPoint.y).takeIf { kotlin.math.abs(it) > 0.0001f } ?: 0.0001f) +
                    currentPoint.x)
            if (intersects) inside = !inside
            previous = index
        }
        return inside
    }

    private fun headingPayload(): Any {
        return if (latestHeadingAzimuth.isFinite()) latestHeadingAzimuth.toDouble() else JSONObject.NULL
    }

    private fun setupFeedbackConsent() {
        val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
        val consentAsked = prefs.getBoolean(KEY_FEEDBACK_CONSENT_ASKED, false)
        val consentGranted = prefs.getBoolean(KEY_FEEDBACK_CONSENT_GRANTED, false)
        val switchEnabled = prefs.getBoolean(KEY_FEEDBACK_SWITCH_ENABLED, consentGranted)

        binding.switchImproveLocation.isChecked = consentGranted && switchEnabled
        updateFeedbackConsentStatus()
        binding.switchImproveLocation.setOnCheckedChangeListener { button, isChecked ->
            val latestPrefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
            val granted = latestPrefs.getBoolean(KEY_FEEDBACK_CONSENT_GRANTED, false)
            if (isChecked && !granted) {
                button.isChecked = false
                showFeedbackConsentDialog()
            } else {
                latestPrefs.edit().putBoolean(KEY_FEEDBACK_SWITCH_ENABLED, isChecked).apply()
                updateFeedbackConsentStatus()
            }
        }

        if (!consentAsked) {
            prefs.edit()
                .putBoolean(KEY_FEEDBACK_CONSENT_ASKED, true)
                .putBoolean(KEY_FEEDBACK_CONSENT_GRANTED, false)
                .putBoolean(KEY_FEEDBACK_SWITCH_ENABLED, false)
                .apply()
            binding.switchImproveLocation.isChecked = false
            updateFeedbackConsentStatus()
        }
    }

    private fun showFeedbackConsentDialog() {
        AlertDialog.Builder(this)
            .setTitle("協助改善定位準確度")
            .setMessage("定位時會使用當次 Wi-Fi 掃描估算目前位置。若你同意協助改善定位，系統才會匿名上傳導航過程中的 Wi-Fi 訊號與定位狀態，用來改善 Demo 定位模型。不包含姓名、電話或聯絡資訊，也不會把其他使用者的原始資料同步到手機。你之後可以隨時關閉。")
            .setPositiveButton("同意啟用") { dialog, _ ->
                saveFeedbackConsent(granted = true)
                dialog.dismiss()
            }
            .setNegativeButton("暫不啟用") { dialog, _ ->
                saveFeedbackConsent(granted = false)
                dialog.dismiss()
            }
            .setOnCancelListener { saveFeedbackConsent(granted = false) }
            .show()
    }

    private fun saveFeedbackConsent(granted: Boolean) {
        getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE).edit()
            .putBoolean(KEY_FEEDBACK_CONSENT_ASKED, true)
            .putBoolean(KEY_FEEDBACK_CONSENT_GRANTED, granted)
            .putBoolean(KEY_FEEDBACK_SWITCH_ENABLED, granted)
            .apply()
        binding.switchImproveLocation.isChecked = granted
        updateFeedbackConsentStatus()
    }

    private fun updateFeedbackConsentStatus() {
        val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
        val consentGranted = prefs.getBoolean(KEY_FEEDBACK_CONSENT_GRANTED, false)
        val enabled = binding.switchImproveLocation.isChecked
        binding.switchImproveLocation.text = if (consentGranted && enabled) {
            "協助改善定位：已同意匿名上傳必要定位狀態"
        } else {
            "協助改善定位：未啟用，不會上傳導航回饋"
        }
    }

    private var manuallyBrowsingFloor = false
    private var mapImageJob: Job? = null
    private var requestedMapImageKey: String? = null
    private var loadedMapImageKey: String? = null
    private var loadedBundledMapFloorId: String? = null

    private fun switchFloor(floorId: String) {
        manuallyBrowsingFloor = true
        currentFloorId = floorId
        binding.navigationMapView.setCurrentFloor(floorId, floorNameFromId(floorId))
        loadFloorMapImage()
        refreshMapPlaces()
        performSearch()
        binding.textNextStep.text = "已切換到 ${floorNameFromId(floorId)}。"
        loadActiveModelStatus()
    }

    private fun loadFloorsFromBackend() {
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { getFloorsFromBackend() }
            }.onSuccess { floors ->
                if (floors.isNotEmpty()) {
                    availableFloors.clear()
                    availableFloors.addAll(floors)
                    floors.forEach { floorNames[it.id] = it.name }
                    if (availableFloors.none { it.id == currentFloorId }) {
                        currentFloorId = availableFloors.first().id
                    }
                    updateFloorButtons()
                    loadFloorMapImage()
                    refreshMapPlaces()
                    performSearch()
                }
            }
        }
    }

    private fun getFloorsFromBackend(): List<DemoFloor> {
        val endpoint = "${backendBaseUrl()}/api/floors?mapId=${currentMapId.urlEncode()}"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 4000
            readTimeout = 5000
        }
        return try {
            val code = connection.responseCode
            if (code !in 200..299) throw IllegalStateException("HTTP $code")
            val raw = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val array = JSONArray(raw)
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.getJSONObject(index)
                    val id = item.optString("id")
                    if (id.isNotBlank()) {
                        add(
                            DemoFloor(
                                id = id,
                                name = item.optString("floorName", id),
                                imageUrl = item.optString("imageUrl", "")
                            )
                        )
                    }
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun loadFloorMapImage() {
        val floor = availableFloors.firstOrNull { it.id == currentFloorId }
        val requestedFloorId = floor?.id ?: currentFloorId
        val imageUrl = floor?.imageUrl.orEmpty()
        val key = "$currentMapId|$requestedFloorId|$imageUrl"
        if (key == loadedMapImageKey || (key == requestedMapImageKey && mapImageJob?.isActive == true)) return
        mapImageJob?.cancel()
        requestedMapImageKey = key
        val hasBundledMap = showBundledFloorMapIfAvailable(requestedFloorId)
        if (imageUrl.isBlank()) {
            loadedMapImageKey = if (hasBundledMap) "bundled|$currentMapId|$requestedFloorId" else null
            if (!hasBundledMap) {
                binding.navigationMapView.setFloorMap(null)
            }
            return
        }
        val resolvedUrl = resolveBackendUrl(imageUrl)
        mapImageJob = lifecycleScope.launch {
            val bitmap = runCatching {
                withContext(Dispatchers.IO) { downloadBitmap(resolvedUrl) }
            }.getOrNull()
            if (requestedFloorId == currentFloorId && requestedMapImageKey == key && bitmap != null) {
                binding.navigationMapView.setFloorMap(bitmap)
                loadedMapImageKey = key
            }
        }
    }

    private fun showBundledFloorMapIfAvailable(floorId: String): Boolean {
        val resourceId = bundledFloorMapResource(floorId) ?: return false
        if (loadedBundledMapFloorId == floorId) return true
        val bitmap = BitmapFactory.decodeResource(resources, resourceId) ?: return false
        binding.navigationMapView.setFloorMap(bitmap)
        loadedBundledMapFloorId = floorId
        return true
    }

    private fun bundledFloorMapResource(floorId: String): Int? = when (floorId) {
        GROUND_FLOOR_ID -> R.drawable.k_area_to_airport_1f
        SECOND_FLOOR_ID -> R.drawable.k_area_to_airport_2f
        else -> null
    }

    private fun resolveBackendUrl(pathOrUrl: String): String {
        if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl
        val base = backendBaseUrl().trimEnd('/')
        val path = if (pathOrUrl.startsWith("/")) pathOrUrl else "/$pathOrUrl"
        return "$base$path"
    }

    private fun downloadBitmap(url: String) =
        (URL(url).openConnection() as HttpURLConnection).run {
            requestMethod = "GET"
            connectTimeout = 5000
            readTimeout = 8000
            try {
                BitmapFactory.decodeStream(inputStream)
            } finally {
                disconnect()
            }
        }

    private fun updateFloorButtons() {
        val first = availableFloors.firstOrNull()
        binding.buttonFloorGround.text = first?.shortLabel ?: "1F"
        binding.buttonFloorSecond.text = when {
            availableFloors.size <= 1 -> "樓層"
            availableFloors.size == 2 -> availableFloors[1].shortLabel
            else -> "樓層"
        }
    }

    private fun showFloorSelector() {
        val labels = availableFloors.map { it.label }.toTypedArray()
        if (labels.isEmpty()) return
        AlertDialog.Builder(this)
            .setTitle("選擇樓層")
            .setItems(labels) { dialog, which ->
                availableFloors.getOrNull(which)?.let { switchFloor(it.id) }
                dialog.dismiss()
            }
            .show()
    }

    private fun refreshMapPlaces() {
        binding.navigationMapView.setCurrentFloor(currentFloorId, floorNameFromId(currentFloorId))
        binding.navigationMapView.setPlaces(emptyList())
    }

    private fun visiblePlaces(): List<DemoPlace> = activePlaces.filter { it.floorId == currentFloorId }

    private fun loadPlacesFromBackend() {
        placesSyncJob?.cancel()
        val requestedMap = currentMapId
        placesSyncJob = lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { getPlacesFromBackend(requestedMap) }
            }.onSuccess { backendPlaces ->
                if (requestedMap != currentMapId) return@onSuccess
                run {
                    activePlaces = backendPlaces
                    saveCachedPlaces(backendPlaces)
                    refreshMapPlaces()
                    performSearch()
                    binding.textBackendStatus.text = "資料狀態：已同步後端地點資料"
                    binding.textNextStep.text = "已載入後端地點資料。"
                }
            }.onFailure {
                if (it is kotlinx.coroutines.CancellationException || requestedMap != currentMapId) return@onFailure
                val cachedPlaces = loadCachedPlaces().ifEmpty { loadBundledPlaces() }
                activePlaces = cachedPlaces
                refreshMapPlaces()
                performSearch()
                binding.textBackendStatus.text = if (cachedPlaces.isNotEmpty()) {
                    "資料狀態：暫時無法連線，使用手機內的上次資料"
                } else {
                    "資料狀態：暫時無法連線，手機內沒有可用資料"
                }
                binding.textNextStep.text = if (cachedPlaces.isNotEmpty()) {
                    "暫時無法連線，使用手機內的上次資料搜尋。"
                } else {
                    "暫時無法連線，手機內也還沒有地點資料。"
                }
            }
        }
    }

    private fun loadRouteZonesFromBackend() {
        val requestedMap = currentMapId
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { getRouteZonesFromBackend(requestedMap) }
            }.onSuccess { zones ->
                if (requestedMap != currentMapId) return@onSuccess
                routeZonesByFloor = zones.groupBy { it.floorId }
                saveCachedRouteZones(zones)
            }.onFailure {
                if (it is kotlinx.coroutines.CancellationException || requestedMap != currentMapId) return@onFailure
                routeZonesByFloor = loadCachedRouteZones().groupBy { it.floorId }
            }
        }
    }

    private fun getRouteZonesFromBackend(mapId: String): List<DemoRouteZone> {
        val endpoint = "${backendBaseUrl()}/api/route-zones?mapId=${mapId.urlEncode()}"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 5000
            readTimeout = 10000
            useCaches = false
        }
        return try {
            val code = connection.responseCode
            if (code !in 200..299) throw IllegalStateException("HTTP $code")
            val raw = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            parseRouteZones(JSONArray(raw))
        } finally {
            connection.disconnect()
        }
    }

    private fun parseRouteZones(array: JSONArray): List<DemoRouteZone> = buildList {
        for (index in 0 until array.length()) {
            val item = array.getJSONObject(index)
            val floorId = item.optString("floorId")
            val zoneType = item.optString("zoneType", item.optString("type"))
            if (floorId.isBlank() || zoneType.isBlank()) continue
            val pointsArray = item.optJSONArray("points") ?: JSONArray()
            val points = buildList {
                for (pointIndex in 0 until pointsArray.length()) {
                    val point = pointsArray.getJSONObject(pointIndex)
                    add(
                        DemoPoint(
                            x = point.optDouble("x", 0.0).toFloat(),
                            y = point.optDouble("y", 0.0).toFloat(),
                            floorId = floorId
                        )
                    )
                }
            }
            add(
                DemoRouteZone(
                    id = item.optString("id"),
                    mapId = item.optString("mapId", currentMapId),
                    floorId = floorId,
                    zoneType = zoneType,
                    x = item.optDouble("x", 0.0).toFloat(),
                    y = item.optDouble("y", 0.0).toFloat(),
                    width = kotlin.math.abs(item.optDouble("width", 0.0).toFloat()),
                    height = kotlin.math.abs(item.optDouble("height", 0.0).toFloat()),
                    points = points
                )
            )
        }
    }

    private fun saveCachedRouteZones(items: List<DemoRouteZone>) {
        val array = JSONArray()
        items.forEach { zone ->
            array.put(JSONObject().apply {
                put("id", zone.id)
                put("mapId", zone.mapId)
                put("floorId", zone.floorId)
                put("zoneType", zone.zoneType)
                put("x", zone.x)
                put("y", zone.y)
                put("width", zone.width)
                put("height", zone.height)
                put("points", JSONArray().apply {
                    zone.points.forEach { point ->
                        put(JSONObject().apply {
                            put("x", point.x)
                            put("y", point.y)
                        })
                    }
                })
            })
        }
        getSharedPreferences(CACHE_PREFS, MODE_PRIVATE).edit().putString(cachedRouteZonesKey(), array.toString()).apply()
    }

    private fun loadCachedRouteZones(): List<DemoRouteZone> {
        val raw = getSharedPreferences(CACHE_PREFS, MODE_PRIVATE).getString(cachedRouteZonesKey(), null) ?: return emptyList()
        return runCatching { parseRouteZones(JSONArray(raw)) }.getOrDefault(emptyList())
    }

    private fun getPlacesFromBackend(mapId: String): List<DemoPlace> {
        val connection = (URL("${backendBaseUrl()}/api/places?mapId=$mapId").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10000
            readTimeout = 30000
            useCaches = false
        }
        return try {
            val raw = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            parsePlaces(JSONArray(raw))
        } finally {
            connection.disconnect()
        }
    }

    private fun parsePlaces(array: JSONArray): List<DemoPlace> = buildList {
        for (index in 0 until array.length()) {
            val item = array.getJSONObject(index)
            val floorId = item.optString("floorId", GROUND_FLOOR_ID)
            val floorName = item.optString("floorName", floorNameFromId(floorId))
            if (floorId.isNotBlank() && floorNames[floorId].isNullOrBlank()) {
                floorNames[floorId] = floorName
            }
            add(
                DemoPlace(
                    id = item.optString("id"),
                    name = item.optString("name"),
                    category = item.optString("category"),
                    categories = item.optStringList("categories", item.optString("category")),
                    floorId = floorId,
                    floorName = floorName,
                    x = item.optDouble("x", 0.0).toFloat(),
                    y = item.optDouble("y", 0.0).toFloat(),
                    businessStatus = item.optString("businessStatus", "unset"),
                    keywords = item.optString("keywords"),
                    description = item.optString("description"),
                    openingHours = item.optString("openingHours")
                )
            )
        }
    }

    private fun saveCachedPlaces(items: List<DemoPlace>) {
        val array = JSONArray()
        items.forEach { place ->
            array.put(JSONObject().apply {
                put("id", place.id)
                put("name", place.name)
                put("category", place.category)
                put("categories", JSONArray(place.categories))
                put("floorId", place.floorId)
                put("floorName", place.floorName)
                put("x", place.x)
                put("y", place.y)
                put("businessStatus", place.businessStatus)
                put("keywords", place.keywords)
                put("description", place.description)
                put("openingHours", place.openingHours)
            })
        }
        getSharedPreferences(CACHE_PREFS, MODE_PRIVATE).edit().putString(cachedPlacesKey(), array.toString()).apply()
    }

    private fun loadCachedPlaces(): List<DemoPlace> {
        val raw = getSharedPreferences(CACHE_PREFS, MODE_PRIVATE).getString(cachedPlacesKey(), null) ?: return emptyList()
        return runCatching { parsePlaces(JSONArray(raw)) }.getOrDefault(emptyList())
    }

    private fun loadBundledPlaces(): List<DemoPlace> {
        return runCatching {
            resources.openRawResource(R.raw.bundled_places_k_area_airport)
                .bufferedReader(Charsets.UTF_8)
                .use { parsePlaces(JSONArray(it.readText())) }
        }.getOrDefault(emptyList())
    }

    private fun loadActiveModelStatus() {
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { getActiveModelStatus() }
            }.onSuccess { status ->
                binding.textModelStatus.text = status
            }.onFailure {
                binding.textModelStatus.text = "定位模型：尚未訓練或後端未連線"
            }
        }
    }

    private fun getActiveModelStatus(): String {
        val path = "/api/models/active?mapId=$currentMapId&floorId=$currentFloorId"
        val connection = (URL("${backendBaseUrl()}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 3000
            readTimeout = 4000
        }
        return try {
            val code = connection.responseCode
            if (code !in 200..299) throw IllegalStateException("HTTP $code")
            val raw = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val json = JSONObject(raw)
            val algorithm = json.optString("algorithm", "knn").uppercase()
            val count = json.optInt("trainingDataCount", 0)
            val version = json.optString("versionName", "未命名版本")
            "定位模型：$algorithm 已啟用，訓練資料 $count 筆，$version"
        } finally {
            connection.disconnect()
        }
    }

    private fun performSearch() {
        val keyword = binding.editSearch.text.toString().trim()
        if (keyword.isBlank()) {
            renderSearchResults(emptyList())
            binding.navigationMapView.setDestination(null)
            selectedPlace = null
            binding.textDestination.text = "目的地：尚未選擇"
            binding.textNextStep.text = "請輸入地點、設施或類別。"
            return
        }
        val filtered = activePlaces.map { it to placeSearchScore(it, keyword) }
            .filter { it.second > 0 }
            .sortedByDescending { it.second }
            .map { it.first }
        renderSearchResults(filtered)
        binding.textNextStep.text = if (filtered.isEmpty()) "查無符合地點。" else "請選擇搜尋結果。"
    }

    private fun renderSearchResults(items: List<DemoPlace>) {
        visiblePlaceMeta.clear()
        binding.layoutSearchResults.removeAllViews()
        if (items.isEmpty()) {
            val emptyView = TextView(this).apply {
                text = "沒有搜尋結果"
                setTextColor(getColor(R.color.text_secondary))
                textSize = 14f
                setPadding(0, 8, 0, 8)
            }
            binding.layoutSearchResults.addView(emptyView)
            return
        }

        items.forEach { place ->
            val itemView = LayoutInflater.from(this).inflate(R.layout.item_place_result, binding.layoutSearchResults, false)
            itemView.findViewById<TextView>(R.id.textPlaceName).text = place.name
            itemView.findViewById<TextView>(R.id.textPlaceMeta).also { view ->
                view.text = placeMeta(place)
                visiblePlaceMeta.add(view to place)
            }
            itemView.findViewById<TextView>(R.id.textPlaceDistance).text =
                if (hasCurrentPosition) formatDistanceMeters(estimatedDistance(place)) else "-- 公尺"
            itemView.findViewById<android.widget.Button>(R.id.buttonPlaceReviews).apply {
                visibility = if (place.supportsPlaceReviews()) android.view.View.VISIBLE else android.view.View.GONE
                setOnClickListener {
                    PlaceReviewsDialog(this@UserNavigationActivity, backendBaseUrl(), currentMapId, place) {
                        text = "$it · 評論"
                    }.show()
                }
            }
            itemView.setOnClickListener {
                selectedPlace = place
                refreshMapPlaces()
                binding.navigationMapView.setDestination(place)
                binding.textDestination.text = place.name
                binding.textNextStep.text = "已選擇 ${place.name}，可以顯示路線。"
            }
            binding.layoutSearchResults.addView(itemView)
        }
    }

    private fun showRouteToSelectedPlace(force: Boolean = false) {
        val destination = selectedPlace
        if (destination == null) {
            binding.textNextStep.text = "請先選擇目的地。"
            return
        }
        if (!hasCurrentPosition) {
            binding.textNextStep.text = "目前不在此區域，無法規劃路線。"
            binding.navigationMapView.clearRoute()
            return
        }
        val now = SystemClock.elapsedRealtime()
        if (!force && now - lastRouteRefreshAtMillis < locationUpdateIntervalMillis) return
        lastRouteRefreshAtMillis = now
        if (routeRequestInFlight) {
            routeRefreshPending = true
            return
        }
        routeRequestInFlight = true
        val requestedDestinationId = destination.id
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { getRouteFromBackend(destination) }
            }.onSuccess { route ->
                val activeDestination = selectedPlace
                if (activeDestination?.id != requestedDestinationId) return@onSuccess
                latestRoute = route
                renderRoute(activeDestination, route)
                if (navigationActive) {
                    val displayLocation = positionOnRouteForDisplay(currentX, currentY, currentFloorId)
                    currentX = displayLocation.x
                    currentY = displayLocation.y
                    binding.navigationMapView.setCurrentPosition(currentX, currentY)
                    updateRemainingRouteDisplay()
                }
            }.onFailure {
                if (it is kotlinx.coroutines.CancellationException) return@onFailure
                latestRoute = null
                binding.navigationMapView.clearRoute()
                binding.textNextStep.text = "目前無法產生安全路線，請稍後再試。"
            }.also {
                routeRequestInFlight = false
                if (routeRefreshPending) {
                    routeRefreshPending = false
                    refreshRouteAfterLocationUpdate(force = true)
                }
            }
        }
    }

    private fun refreshRouteAfterLocationUpdate(force: Boolean = false) {
        val shouldRefreshRoute = selectedPlace != null &&
            (navigationActive || latestRoute?.points?.isNotEmpty() == true)
        if (!shouldRefreshRoute) return
        showRouteToSelectedPlace(force)
    }

    private fun renderRoute(destination: DemoPlace, route: DemoRouteResult) {
        if (route.points.isEmpty()) {
            binding.textNextStep.text = "目前找不到可行路線。"
            return
        }
        val distance = route.distanceMeters.takeIf { it > 0 } ?: route.points.zipWithNext().sumOf { (from, to) ->
            hypot((from.x - to.x).toDouble(), (from.y - to.y).toDouble())
        }.toFloat()
        binding.navigationMapView.setRoute(route.points)
        val displayDistance = navigatorRemainingDistance(route.points, distance)
        binding.textDistance.text = formatDistanceMeters(displayDistance)
        binding.textEstimatedTime.text = "${formatMinutes(route.estimatedMinutes)} 分鐘"
        binding.textNextStep.text = nextStepText(destination, route)
    }

    private fun directRouteToDestination(destination: DemoPlace): DemoRouteResult {
        val points = listOf(
            DemoPoint(currentX, currentY, currentFloorId),
            DemoPoint(destination.x, destination.y, destination.floorId)
        )
        val distanceMeters = if (destination.floorId == currentFloorId) {
            distance(currentX, currentY, destination.x, destination.y) / routePixelsPerMeter()
        } else {
            0f
        }
        return DemoRouteResult(
            points = points,
            distanceMeters = distanceMeters,
            estimatedMinutes = if (distanceMeters > 0f) (distanceMeters / 75f).coerceAtLeast(0.5f) else 0.5f
        )
    }

    private fun nextStepText(destination: DemoPlace, route: DemoRouteResult?): String {
        return when {
            route?.points?.isNotEmpty() == true -> "請沿著地圖上的路線前往 ${destination.name}。"
            else -> "請先選擇目的地。"
        }
    }

    private fun updateNavigationAdvice(destination: DemoPlace) {
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { getNavigationAdvice(destination) }
            }.onSuccess { advice ->
                if (advice.isNotBlank()) binding.textNextStep.text = advice
            }
        }
    }

    private fun getNavigationAdvice(destination: DemoPlace): String {
        val body = JSONObject().apply {
            put("mapId", currentMapId)
            put("floorId", currentFloorId)
            put("currentX", currentX)
            put("currentY", currentY)
            put("targetX", destination.x)
            put("targetY", destination.y)
            put("targetFloorId", destination.floorId)
            put("routeProgress", 0)
            put("isOffRoute", false)
            put("obstacleNearby", false)
            put("wifiConfidence", if (latestHeadingStable) 70 else 45)
            put("estimatedError", if (latestHeadingStable) 8 else 18)
            put("heading", headingPayload())
            put("previousAction", "continueNavigation")
        }.toString()
        val connection = (URL("${backendBaseUrl()}/api/navigation-policy/decide").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 4000
            readTimeout = 5000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
        return try {
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            if (code !in 200..299) throw IllegalStateException("HTTP $code")
            val raw = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val action = JSONObject(raw).optString("recommendedAction", "continueNavigation")
            when (action) {
                "reroute" -> "已重新檢查路線，請沿著新的路線前進。"
                "relocalize" -> "正在校正位置，請先停留片刻。"
                "guideBackToRoute" -> "請回到地圖上的路線後繼續。"
                "useElevator" -> "請使用電梯前往下一個樓層。"
                "useStairs" -> "請使用樓梯前往下一個樓層。"
                else -> ""
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun estimateCurrentLocation() {
        if (estimatingLocation) return
        if (!hasWifiLocationPermissions()) {
            ensureWifiLocationPermissions()
            markOutsideCurrentArea("請允許定位/Wi-Fi 權限，App 會自動定位目前位置。")
            updateLocationSignalStatus(LocationSignalState.OUTSIDE)
            return
        }
        binding.textNextStep.text = "正在定位目前位置..."
        updateLocationSignalStatus(LocationSignalState.UNCLEAR)
        val requestedMap = currentMapId
        val requestedFloor = currentFloorId
        val wifiList = currentWifiListForFeedback()
        if (wifiList.length() < 2) {
            locationUpdateIntervalMillis = maxOf(locationUpdateIntervalMillis, 3000L)
            markOutsideCurrentArea("Wi-Fi 掃描資料不足，請確認手機 Wi-Fi 與定位服務已開啟。")
            updateLocationSignalStatus(LocationSignalState.OUTSIDE)
            refreshMapPlaces()
            return
        }

        val requestStartedAtMillis = SystemClock.elapsedRealtime()
        lifecycleScope.launch {
            estimatingLocation = true
            var requestSucceeded = false
            runCatching {
                withContext(Dispatchers.IO) {
                    val estimate = getBestLocationEstimateFromBackend(wifiList)
                    val nearestPoint = getNearestFingerprintPointFromBackend(estimate)
                    estimate to nearestPoint
                }
            }.onSuccess { (estimate, nearestPoint) ->
                requestSucceeded = true
                if (requestedMap != currentMapId || requestedFloor != currentFloorId) return@onSuccess
                if (!isUsableLocationEstimate(estimate, nearestPoint)) {
                    markOutsideCurrentArea("\u76ee\u524d\u4e0d\u5728\u6b64\u5340\u57df\uff0c\u8acb\u78ba\u8a8d\u662f\u5426\u7ad9\u5728\u5df2\u63a1\u6a23\u7bc4\u570d\u5167\u3002")
                    updateLocationSignalStatus(LocationSignalState.OUTSIDE)
                    refreshMapPlaces()
                    return@onSuccess
                }
                val rawLocatedFloor = nearestPoint.floorId.ifBlank { estimate.floorId.ifBlank { currentFloorId } }
                val locatedFloor = stableFloorForEstimate(rawLocatedFloor, estimate)
                if (rawLocatedFloor != locatedFloor) {
                    updateLocationSignalStatus(LocationSignalState.UNCLEAR)
                    binding.textNextStep.text = "正在確認樓層，先維持目前畫面。"
                    return@onSuccess
                }
                if (manuallyBrowsingFloor && locatedFloor != currentFloorId) return@onSuccess
                val floorChanged = locatedFloor != currentFloorId
                if (floorChanged) positionFusionFilter.reset()
                val smoothedLocation = smoothNavigationLocation(estimate, nearestPoint, locatedFloor)
                val displayLocation = positionOnRouteForDisplay(smoothedLocation.x, smoothedLocation.y, locatedFloor)
                currentX = displayLocation.x
                currentY = displayLocation.y
                currentFloorId = locatedFloor
                pendingStepDistanceSinceWifi = 0f
                if (::barometerManager.isInitialized) {
                    barometerManager.setTransitionExpected(isNearCurrentRouteConnector())
                }
                if (floorChanged) {
                    lastFloorSwitchAtMillis = SystemClock.elapsedRealtime()
                    candidateFloorId = ""
                    candidateFloorHits = 0
                    navigationLocationHistory.clear()
                    barometricSuggestedFloorId = ""
                    if (::barometerManager.isInitialized) barometerManager.confirmFloor()
                    loadFloorMapImage()
                    updateFloorButtons()
                }
                hasCurrentPosition = true
                binding.navigationMapView.setCurrentPosition(currentX, currentY)
                refreshMapPlaces()
                maybeSwitchFloorAtRouteConnector()
                val confidenceHint = if (
                    estimate.confidence >= MIN_LOCATION_CONFIDENCE &&
                    estimate.estimatedError <= MAX_LOCATION_ERROR_METERS
                ) {
                    updateLocationSignalStatus(LocationSignalState.CLEAR)
                    "已確認目前位置"
                } else {
                    updateLocationSignalStatus(LocationSignalState.UNCLEAR)
                    "正在校正目前位置"
                }
                binding.textNextStep.text = if (navigationActive && selectedPlace != null) {
                    "$confidenceHint，請沿著地圖上的路線前進。"
                } else {
                    "$confidenceHint。"
                }
                submitAnonymousFeedbackIfAllowed(arrivedDestination = false)
                refreshRouteAfterLocationUpdate()
            }.onFailure {
                if (it is kotlinx.coroutines.CancellationException || requestedMap != currentMapId || requestedFloor != currentFloorId) return@onFailure
                markOutsideCurrentArea("目前無法確認位置，請確認 Wi-Fi 與定位服務已開啟。")
                updateLocationSignalStatus(LocationSignalState.OUTSIDE)
                refreshMapPlaces()
            }.also {
                updateLocationPollingInterval(
                    SystemClock.elapsedRealtime() - requestStartedAtMillis,
                    requestSucceeded
                )
                estimatingLocation = false
            }
        }
    }

    private fun updateLocationPollingInterval(requestDurationMillis: Long, succeeded: Boolean) {
        locationUpdateIntervalMillis = if (!succeeded) {
            (locationUpdateIntervalMillis * 2).coerceAtMost(MAX_LOCATION_UPDATE_INTERVAL_MILLIS)
        } else {
            when {
                requestDurationMillis <= 800L -> MIN_LOCATION_UPDATE_INTERVAL_MILLIS
                requestDurationMillis <= 1800L -> DEFAULT_LOCATION_UPDATE_INTERVAL_MILLIS
                requestDurationMillis <= 3000L -> 2500L
                else -> (requestDurationMillis + 500L).coerceAtMost(MAX_LOCATION_UPDATE_INTERVAL_MILLIS)
            }
        }
    }

    private fun markOutsideCurrentArea(message: String) {
        // The initial fallback is set once on launch, never on recurring scan failure.
        binding.textNextStep.text = message
    }

    private fun setFallbackInitialPosition(message: String) {
        currentFloorId = GROUND_FLOOR_ID
        currentX = FALLBACK_START_X
        currentY = FALLBACK_START_Y
        hasCurrentPosition = true
        binding.navigationMapView.setCurrentFloor(currentFloorId, floorNameFromId(currentFloorId))
        binding.navigationMapView.setCurrentPosition(currentX, currentY)
        loadFloorMapImage()
        updateFloorButtons()
        binding.textNextStep.text = "$message\n目前先放在 1F 中間廣場。"
    }

    private fun toggleMapRotationMode() {
        mapFollowsHeading = !mapFollowsHeading
        binding.navigationMapView.setFollowHeading(mapFollowsHeading)
        binding.buttonMapRotation.text = if (mapFollowsHeading) "跟轉" else "固定"
        binding.textNextStep.text = if (mapFollowsHeading) {
            "地圖會跟著手機方向旋轉。"
        } else {
            "地圖固定不旋轉。"
        }
    }

    private fun updateLocationSignalStatus(state: LocationSignalState) {
        val color = when (state) {
            LocationSignalState.CLEAR -> Color.rgb(22, 163, 74)
            LocationSignalState.UNCLEAR -> Color.rgb(245, 158, 11)
            LocationSignalState.OUTSIDE -> Color.rgb(220, 38, 38)
        }
        binding.textWifiSignalStatus.backgroundTintList = ColorStateList.valueOf(color)
        binding.textWifiSignalStatus.text = when (state) {
            LocationSignalState.CLEAR -> "WiFi"
            LocationSignalState.UNCLEAR -> "WiFi"
            LocationSignalState.OUTSIDE -> "WiFi"
        }
        binding.textWifiSignalStatus.contentDescription = when (state) {
            LocationSignalState.CLEAR -> "定位清楚"
            LocationSignalState.UNCLEAR -> "定位不清楚"
            LocationSignalState.OUTSIDE -> "目前不在此區域或沒有指紋訊號"
        }
        binding.textWifiSignalStatus.setTextColor(Color.WHITE)
    }

    private fun isUsableLocationEstimate(estimate: DemoLocationEstimate, nearestPoint: FingerprintMapPoint): Boolean {
        if (estimate.mapId.isNotBlank() && estimate.mapId != currentMapId) return false
        if (estimate.floorId.isBlank()) return false
        val snapDistance = distance(estimate.x, estimate.y, nearestPoint.x, nearestPoint.y)
        val highConfidence = estimate.confidence >= MIN_LOCATION_CONFIDENCE &&
            estimate.estimatedError <= MAX_LOCATION_ERROR_METERS &&
            snapDistance <= maxOf(MAX_SNAP_DISTANCE, estimate.estimatedError * 3f)
        if (highConfidence) return true

        return nearestPoint.scanCount > 0 && snapDistance <= LOW_CONFIDENCE_MAX_SNAP_DISTANCE
    }

    private fun stableFloorForEstimate(rawFloorId: String, estimate: DemoLocationEstimate): String {
        if (rawFloorId.isBlank() || rawFloorId == currentFloorId) {
            candidateFloorId = ""
            candidateFloorHits = 0
            return currentFloorId
        }
        if (manuallyBrowsingFloor) return currentFloorId
        val switchingSoonAfterLastChange =
            SystemClock.elapsedRealtime() - lastFloorSwitchAtMillis < FLOOR_SWITCH_COOLDOWN_MILLIS
        val pressureSupportsChange = barometricSuggestedFloorId == rawFloorId &&
            SystemClock.elapsedRealtime() - barometricSuggestionAtMillis <= 20_000L
        if (!switchingSoonAfterLastChange && isNearFloorTransitionConnector(rawFloorId) && pressureSupportsChange) {
            return rawFloorId
        }

        if (candidateFloorId == rawFloorId) {
            candidateFloorHits += 1
        } else {
            candidateFloorId = rawFloorId
            candidateFloorHits = 1
        }
        val requiredHits = when {
            switchingSoonAfterLastChange -> FLOOR_SWITCH_BACK_REQUIRED_HITS
            pressureSupportsChange -> 2
            else -> FLOOR_SWITCH_REQUIRED_HITS
        }
        val requiredConfidence = if (switchingSoonAfterLastChange) {
            FLOOR_SWITCH_BACK_REQUIRED_CONFIDENCE
        } else {
            FLOOR_SWITCH_REQUIRED_CONFIDENCE
        }
        val enoughHits = candidateFloorHits >= requiredHits
        val pressureAdjustedConfidence = if (pressureSupportsChange) requiredConfidence - 10 else requiredConfidence
        val enoughConfidence = estimate.confidence >= pressureAdjustedConfidence
        return if (enoughHits && enoughConfidence) {
            candidateFloorId = ""
            candidateFloorHits = 0
            rawFloorId
        } else {
            currentFloorId
        }
    }

    private fun isNearFloorTransitionConnector(targetFloorId: String): Boolean {
        val route = latestRoute ?: return false
        return route.points.zipWithNext().any { (from, to) ->
            from.floorId == currentFloorId &&
                to.floorId == targetFloorId &&
                distance(currentX, currentY, from.x, from.y) <= 70f
        }
    }

    private fun isNearCurrentRouteConnector(): Boolean {
        val connector = connectorOnCurrentRouteFloor() ?: return false
        return distance(currentX, currentY, connector.first.x, connector.first.y) <= CONNECTOR_LOCK_DISTANCE_PIXELS
    }

    private fun smoothNavigationLocation(
        estimate: DemoLocationEstimate,
        nearestPoint: FingerprintMapPoint,
        locatedFloor: String
    ): NavigationLocationSample {
        if (navigationLocationHistory.any { it.mapId != currentMapId || it.floorId != locatedFloor }) {
            navigationLocationHistory.clear()
        }
        val rawEstimate = NavigationLocationSample(
            pointId = nearestPoint.pointId,
            mapId = currentMapId,
            floorId = locatedFloor,
            x = estimate.x,
            y = estimate.y,
            confidence = estimate.confidence.coerceIn(0, 100),
            timestampMillis = SystemClock.elapsedRealtime()
        )
        val routeConstrained = constrainWifiLocationToRoute(rawEstimate)
        val blockedAdjusted = adjustLocationForBlockedNavigationZone(routeConstrained, locatedFloor)
        val raw = routeConstrained.copy(x = blockedAdjusted.x, y = blockedAdjusted.y)
        val previous = navigationLocationHistory.lastOrNull()
        val guarded = if (previous != null) {
            val jumpDistance = distance(previous.x, previous.y, raw.x, raw.y)
            when {
                jumpDistance < LOCATION_DEAD_ZONE_PIXELS && raw.confidence < 85 -> previous.copy(
                    confidence = maxOf(previous.confidence, raw.confidence),
                    timestampMillis = raw.timestampMillis
                )
                exceedsWalkingSpeed(previous, raw, jumpDistance) ->
                    clampByWalkingSpeed(previous, raw, jumpDistance)
                raw.confidence < 45 && jumpDistance > 80f -> previous.copy(
                    confidence = (previous.confidence - 8).coerceAtLeast(35),
                    pointId = previous.pointId
                )
                raw.confidence < 70 && jumpDistance > 160f -> {
                    val ratio = 0.28f
                    raw.copy(
                        x = previous.x + (raw.x - previous.x) * ratio,
                        y = previous.y + (raw.y - previous.y) * ratio,
                        confidence = (raw.confidence - 12).coerceAtLeast(35)
                    )
                }
                else -> raw
            }
        } else {
            raw
        }

        navigationLocationHistory.add(guarded)
        while (navigationLocationHistory.size > 5) navigationLocationHistory.removeAt(0)
        val fused = positionFusionFilter.update(
            measuredX = guarded.x,
            measuredY = guarded.y,
            confidence = guarded.confidence,
            estimatedErrorMeters = estimate.estimatedError,
            pixelsPerMeter = routePixelsPerMeter(),
            timestampMillis = guarded.timestampMillis
        )
        val votedPoint = navigationLocationHistory
            .groupBy { it.pointId }
            .maxByOrNull { it.value.size }
            ?.value
            ?.last()
            ?: guarded
        val averageConfidence = navigationLocationHistory
            .map { it.confidence }
            .average()
            .toInt()
            .coerceIn(0, 100)

        val averaged = guarded.copy(
            pointId = votedPoint.pointId,
            x = fused.x,
            y = fused.y,
            confidence = averageConfidence
        )
        return averaged
    }

    private fun exceedsWalkingSpeed(
        previous: NavigationLocationSample,
        raw: NavigationLocationSample,
        jumpDistance: Float
    ): Boolean {
        if (raw.confidence >= 90) return false
        val elapsedSeconds = ((raw.timestampMillis - previous.timestampMillis).coerceAtLeast(1L) / 1000f)
        val allowedPixels = (MAX_WALKING_SPEED_METERS_PER_SECOND * elapsedSeconds * routePixelsPerMeter() + 25f)
            .coerceAtLeast(40f)
        return jumpDistance > allowedPixels
    }

    private fun clampByWalkingSpeed(
        previous: NavigationLocationSample,
        raw: NavigationLocationSample,
        jumpDistance: Float
    ): NavigationLocationSample {
        val elapsedSeconds = ((raw.timestampMillis - previous.timestampMillis).coerceAtLeast(1L) / 1000f)
        val allowedPixels = (MAX_WALKING_SPEED_METERS_PER_SECOND * elapsedSeconds * routePixelsPerMeter() + 25f)
            .coerceIn(40f, 140f)
        val ratio = (allowedPixels / jumpDistance).coerceIn(0.08f, 0.45f)
        return raw.copy(
            x = previous.x + (raw.x - previous.x) * ratio,
            y = previous.y + (raw.y - previous.y) * ratio,
            confidence = (raw.confidence - 8).coerceAtLeast(35)
        )
    }

    private fun getRouteFromBackend(destination: DemoPlace): DemoRouteResult {
        val body = JSONObject().apply {
            put("mapId", currentMapId)
            put("startFloorId", currentFloorId)
            put("targetFloorId", destination.floorId)
            put("startX", currentX)
            put("startY", currentY)
            put("destinationPlaceId", destination.id)
        }.toString()
        var lastError: Exception? = null
        repeat(3) { attempt ->
            val connection = (URL("${backendBaseUrl()}/api/routes").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 4000
                readTimeout = 7000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
            try {
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val code = connection.responseCode
                if (code !in 200..299) {
                    val error = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                    throw IllegalStateException(error.ifBlank { "HTTP $code" })
                }
                return parseRouteResult(connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() })
            } catch (error: Exception) {
                lastError = error
                if (attempt < 2) Thread.sleep(350L * (attempt + 1))
            } finally {
                connection.disconnect()
            }
        }
        throw lastError ?: IllegalStateException("Route request failed")
    }

    private fun parseRouteResult(raw: String): DemoRouteResult {
        val json = JSONObject(raw)
        val points = json.optJSONArray("routePoints") ?: JSONArray()
        val routePoints = buildList {
            for (index in 0 until points.length()) {
                val point = points.getJSONObject(index)
                add(
                    DemoPoint(
                        point.optDouble("x", 0.0).toFloat(),
                        point.optDouble("y", 0.0).toFloat(),
                        point.optString("floorId", currentFloorId)
                    )
                )
            }
        }
        val transitions = json.optJSONArray("floorTransitions") ?: JSONArray()
        val routeTransitions = buildList {
            for (index in 0 until transitions.length()) {
                val item = transitions.getJSONObject(index)
                add(
                    DemoFloorTransition(
                        fromFloorId = item.optString("fromFloorId"),
                        toFloorId = item.optString("toFloorId"),
                        transitionType = item.optString("transitionType"),
                        name = item.optString("name", "樓層連接點")
                    )
                )
            }
        }
        return DemoRouteResult(
            points = routePoints,
            distanceMeters = json.optDouble("distance", 0.0).toFloat(),
            estimatedMinutes = json.optDouble("estimatedTime", 1.0).toFloat().coerceAtLeast(0.5f),
            floorTransitions = routeTransitions
        )
    }

    private fun getBestLocationEstimateFromBackend(wifiList: JSONArray): DemoLocationEstimate {
        val floorsToTry = (listOf(currentFloorId) + availableFloors.map { it.id })
            .filter { it.isNotBlank() }
            .distinct()
        val estimates = floorsToTry.mapNotNull { floorId ->
            runCatching { getLocationEstimateFromBackend(wifiList, floorId) }.getOrNull()
        }
        return estimates.maxWithOrNull(
            compareBy<DemoLocationEstimate> { it.confidence }
                .thenByDescending { -it.estimatedError }
        ) ?: getLocationEstimateFromBackend(wifiList, currentFloorId)
    }

    private fun getLocationEstimateFromBackend(wifiList: JSONArray, floorId: String): DemoLocationEstimate {
        val body = JSONObject().apply {
            put("mapId", currentMapId)
            put("floorId", floorId)
            put("currentWifiList", wifiList)
            put("heading", JSONObject.NULL)
            put("stepDelta", 0)
            put("currentX", currentX)
            put("currentY", currentY)
            put("hasCurrentPosition", hasCurrentPosition)
            put("deviceInfo", "${Build.MANUFACTURER} ${Build.MODEL} / Android ${Build.VERSION.RELEASE}")
        }.toString()
        val connection = (URL("${backendBaseUrl()}/api/location/estimate").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 4000
            readTimeout = 5000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
        return try {
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            if (code !in 200..299) {
                val error = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                throw IllegalStateException(error.ifBlank { "HTTP $code" })
            }
            val raw = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val json = JSONObject(raw)
            DemoLocationEstimate(
                mapId = json.optString("mapId", currentMapId),
                floorId = json.optString("floorId", floorId),
                x = json.optDouble("x", currentX.toDouble()).toFloat(),
                y = json.optDouble("y", currentY.toDouble()).toFloat(),
                confidence = json.optInt("confidence", 0),
                estimatedError = json.optDouble("estimatedError", 0.0).toFloat(),
                modelVersion = json.optString("modelVersion", "")
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun getNearestFingerprintPointFromBackend(estimate: DemoLocationEstimate): FingerprintMapPoint {
        val floorId = estimate.floorId.ifBlank { currentFloorId }
        val endpoint = "${backendBaseUrl()}/api/wifi-scans/points?mapId=${currentMapId.urlEncode()}&floorId=${floorId.urlEncode()}"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 4000
            readTimeout = 6000
        }
        return try {
            val code = connection.responseCode
            if (code !in 200..299) throw IllegalStateException("HTTP $code")
            val raw = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val json = JSONObject(raw)
            val array = json.optJSONArray("points") ?: JSONArray()
            val points = buildList {
                for (index in 0 until array.length()) {
                    val item = array.getJSONObject(index)
                    val pointId = item.optString("pointId")
                    if (pointId.isBlank()) continue
                    add(
                        FingerprintMapPoint(
                            pointId = pointId,
                            mapId = item.optString("mapId", currentMapId),
                            floorId = item.optString("floorId", floorId),
                            x = item.optDouble("x", 0.0).toFloat(),
                            y = item.optDouble("y", 0.0).toFloat(),
                            scanCount = item.optInt("scanCount", 0)
                        )
                    )
                }
            }
            points
                .filter { it.mapId == currentMapId && it.floorId == floorId && it.scanCount > 0 }
                .minByOrNull { distance(estimate.x, estimate.y, it.x, it.y) }
                ?: throw IllegalStateException("No fingerprint points")
        } finally {
            connection.disconnect()
        }
    }

    private fun planLocalRoute(startX: Float, startY: Float, destination: DemoPlace): DemoRouteResult {
        if (destination.floorId != currentFloorId) {
            val points = listOf(
                DemoPoint(startX, startY, currentFloorId),
                DemoPoint(250f, 570f, currentFloorId),
                DemoPoint(390f, 500f, currentFloorId),
                DemoPoint(610f, 500f, currentFloorId),
                DemoPoint(610f, 500f, destination.floorId),
                DemoPoint(610f, 390f, destination.floorId),
                DemoPoint(destination.x, destination.y, destination.floorId)
            )
            return DemoRouteResult(
                points = points,
                distanceMeters = 0f,
                estimatedMinutes = 5f,
                floorTransitions = listOf(DemoFloorTransition(currentFloorId, destination.floorId, "elevator", "電梯"))
            )
        }
        val startNode = routeNodes.minByOrNull { node -> distance(node.x, node.y, startX, startY) } ?: return DemoRouteResult.EMPTY
        val targetNode = routeNodes.minByOrNull { node -> distance(node.x, node.y, destination.x, destination.y) } ?: return DemoRouteResult.EMPTY
        val routeIds = aStar(startNode.id, targetNode.id) ?: return DemoRouteResult.EMPTY
        val points = listOf(DemoPoint(startX, startY, currentFloorId)) +
            routeIds.mapNotNull { nodeId ->
                routeNodes.firstOrNull { it.id == nodeId }?.let { DemoPoint(it.x, it.y, currentFloorId) }
            } +
            listOf(DemoPoint(destination.x, destination.y, currentFloorId))
        return DemoRouteResult(points = points, distanceMeters = 0f, estimatedMinutes = 0f)
    }

    private fun maybeSwitchFloorAtRouteConnector() {
        if (!navigationActive || !hasCurrentPosition || manuallyBrowsingFloor) return
        val route = latestRoute ?: return
        val points = route.points
        if (points.size < 2) return
        val connectorIndex = points.zipWithNext().indexOfFirst { (from, to) ->
            from.floorId == currentFloorId &&
                to.floorId.isNotBlank() &&
                to.floorId != currentFloorId &&
                distance(currentX, currentY, from.x, from.y) <= CONNECTOR_SWITCH_DISTANCE_PIXELS
        }
        if (connectorIndex < 0) return
        val nextPoint = points[connectorIndex + 1]
        currentFloorId = nextPoint.floorId
        currentX = nextPoint.x
        currentY = nextPoint.y
        hasCurrentPosition = true
        binding.navigationMapView.setCurrentFloor(currentFloorId, floorNameFromId(currentFloorId))
        binding.navigationMapView.setCurrentPosition(currentX, currentY)
        loadFloorMapImage()
        updateFloorButtons()
        refreshMapPlaces()
        binding.textNextStep.text = "已到達連接點，已切換到 ${floorNameFromId(currentFloorId)}。"
    }

    private fun aStar(startId: String, targetId: String): List<String>? {
        val open = mutableSetOf(startId)
        val cameFrom = mutableMapOf<String, String>()
        val gScore = mutableMapOf(startId to 0f)
        val fScore = mutableMapOf(startId to heuristic(startId, targetId))

        while (open.isNotEmpty()) {
            val current = open.minBy { fScore[it] ?: Float.MAX_VALUE }
            if (current == targetId) return reconstructRoute(cameFrom, current)
            open.remove(current)
            routeEdges.filter { it.fromNodeId == current || it.toNodeId == current }.forEach { edge ->
                val neighbor = if (edge.fromNodeId == current) edge.toNodeId else edge.fromNodeId
                val tentative = (gScore[current] ?: Float.MAX_VALUE) + edge.distance
                if (tentative < (gScore[neighbor] ?: Float.MAX_VALUE)) {
                    cameFrom[neighbor] = current
                    gScore[neighbor] = tentative
                    fScore[neighbor] = tentative + heuristic(neighbor, targetId)
                    open.add(neighbor)
                }
            }
        }
        return null
    }

    private fun reconstructRoute(cameFrom: Map<String, String>, endId: String): List<String> {
        val route = mutableListOf(endId)
        var current = endId
        while (cameFrom.containsKey(current)) {
            current = cameFrom.getValue(current)
            route.add(current)
        }
        return route.asReversed()
    }

    private fun heuristic(fromId: String, toId: String): Float {
        val from = routeNodes.firstOrNull { it.id == fromId } ?: return Float.MAX_VALUE
        val to = routeNodes.firstOrNull { it.id == toId } ?: return Float.MAX_VALUE
        return distance(from.x, from.y, to.x, to.y)
    }

    private fun submitAnonymousFeedbackIfAllowed(arrivedDestination: Boolean) {
        val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_FEEDBACK_CONSENT_GRANTED, false) || !binding.switchImproveLocation.isChecked) return
        val destination = selectedPlace ?: return
        val wifiList = currentWifiListForFeedback()
        if (wifiList.length() < 2) {
            binding.textSensorAssist.text = "輔助定位：Wi-Fi 訊號數量不足，本次不會上傳回饋。"
            return
        }
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { postNavigationFeedback(destination, wifiList, arrivedDestination) }
            }.onFailure {
                enqueuePendingFeedback(buildNavigationFeedbackBody(destination, wifiList, arrivedDestination))
                binding.textSensorAssist.text = "輔助定位：匿名回饋已暫存在手機，連線恢復後會再同步。"
            }
        }
    }

    private fun currentWifiListForFeedback(): JSONArray {
        val array = JSONArray()
        if (!hasWifiLocationPermissions()) return array
        runCatching {
            @Suppress("DEPRECATION")
            wifiManager.startScan()
        }
        val results = try {
            @Suppress("DEPRECATION")
            wifiManager.scanResults.orEmpty()
        } catch (_: SecurityException) {
            emptyList()
        }
        results.take(12).forEach { scan ->
            array.put(JSONObject().apply {
                @Suppress("DEPRECATION")
                put("ssid", scan.SSID ?: "")
                put("bssid", scan.BSSID ?: "")
                put("rssi", scan.level)
            })
        }
        return array
    }

    private fun ensureWifiLocationPermissions() {
        val missing = requiredWifiPermissions().filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), WIFI_PERMISSION_REQUEST)
        } else {
            estimateCurrentLocation()
        }
    }

    private fun hasWifiLocationPermissions(): Boolean =
        requiredWifiPermissions().all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }

    private fun requiredWifiPermissions(): List<String> {
        val permissions = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.NEARBY_WIFI_DEVICES)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            permissions.add(Manifest.permission.ACTIVITY_RECOGNITION)
        }
        return permissions
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != WIFI_PERMISSION_REQUEST) return
        if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            estimateCurrentLocation()
        } else {
            markOutsideCurrentArea("未允許定位/Wi-Fi 權限，無法自動定位。")
            updateLocationSignalStatus(LocationSignalState.OUTSIDE)
        }
    }

    private fun postNavigationFeedback(destination: DemoPlace, wifiList: JSONArray, arrivedDestination: Boolean) {
        postJson("/api/navigation-feedback", buildNavigationFeedbackBody(destination, wifiList, arrivedDestination))
    }

    private fun buildNavigationFeedbackBody(destination: DemoPlace, wifiList: JSONArray, arrivedDestination: Boolean): JSONObject {
        return JSONObject().apply {
            put("anonymousUserId", anonymousUserId())
            put("mapId", currentMapId)
            put("floorId", currentFloorId)
            put("estimatedX", currentX)
            put("estimatedY", currentY)
            put("currentRouteId", "demo-route")
            put("nearestRouteNodeId", "node-parking-a")
            put("currentWifiList", wifiList)
            put("heading", headingPayload())
            put("stepDelta", latestStepDistance)
            put("confidence", if (latestHeadingStable) 60 else 40)
            put("estimatedError", if (latestHeadingStable) 10 else 18)
            put("isOffRoute", false)
            put("relocalizeCount", 0)
            put("arrivedDestination", arrivedDestination)
            put("deviceInfo", "${Build.MANUFACTURER} ${Build.MODEL} / Android ${Build.VERSION.RELEASE}")
            put("collectedAt", System.currentTimeMillis())
            put("destinationPlaceId", destination.id)
        }
    }

    private fun postNavigationHistory(destination: DemoPlace) {
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    postJson("/api/navigation-history", JSONObject().apply {
                        put("userId", anonymousUserId())
                        put("mapId", currentMapId)
                        put("startX", currentX)
                        put("startY", currentY)
                        put("startFloorId", currentFloorId)
                        put("destinationPlaceId", destination.id)
                    })
                }
            }
        }
    }

    private fun enqueuePendingFeedback(body: JSONObject) {
        val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
        val existing = JSONArray(prefs.getString(KEY_PENDING_FEEDBACK_QUEUE, "[]") ?: "[]")
        val next = JSONArray()
        val start = maxOf(0, existing.length() - MAX_PENDING_FEEDBACK + 1)
        for (index in start until existing.length()) {
            next.put(existing.getJSONObject(index))
        }
        next.put(body)
        prefs.edit().putString(KEY_PENDING_FEEDBACK_QUEUE, next.toString()).apply()
    }

    private fun flushPendingFeedback() {
        val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
        val consentGranted = prefs.getBoolean(KEY_FEEDBACK_CONSENT_GRANTED, false)
        val switchEnabled = prefs.getBoolean(KEY_FEEDBACK_SWITCH_ENABLED, false)
        if (!consentGranted || !switchEnabled) return

        val queue = JSONArray(prefs.getString(KEY_PENDING_FEEDBACK_QUEUE, "[]") ?: "[]")
        if (queue.length() == 0) return

        lifecycleScope.launch {
            val remaining = withContext(Dispatchers.IO) {
                val failed = JSONArray()
                for (index in 0 until queue.length()) {
                    val item = queue.getJSONObject(index)
                    runCatching { postJson("/api/navigation-feedback", item) }
                        .onFailure { failed.put(item) }
                }
                failed
            }
            prefs.edit().putString(KEY_PENDING_FEEDBACK_QUEUE, remaining.toString()).apply()
            if (remaining.length() == 0) {
                binding.textSensorAssist.text = "輔助定位：已同步先前暫存的匿名回饋。"
            }
        }
    }

    private fun showUserReportDialog() {
        val destination = selectedPlace
        val options = arrayOf("路線不通", "地點錯誤", "障礙物", "店家或設施暫停服務")
        val types = arrayOf("blockedRoute", "wrongPlace", "obstacle", "closedPlace")
        AlertDialog.Builder(this)
            .setTitle("回報問題")
            .setItems(options) { _, which ->
                val input = EditText(this).apply {
                    hint = "補充說明，可留空"
                    setSingleLine(false)
                    minLines = 2
                }
                AlertDialog.Builder(this)
                    .setTitle(options[which])
                    .setView(input)
                    .setPositiveButton("送出") { dialog, _ ->
                        postUserReport(types[which], input.text.toString(), destination)
                        dialog.dismiss()
                    }
                    .setNegativeButton("取消", null)
                    .show()
            }
            .show()
    }

    private var reportRetryJob: Job? = null
    private val reportSendMutex = kotlinx.coroutines.sync.Mutex()
    private fun reportQueueKey() = "pending_user_reports_${backendBaseUrl()}"

    private fun postUserReport(reportType: String, description: String, destination: DemoPlace?) {
        val report = JSONObject().apply {
                        put("clientReportId", java.util.UUID.randomUUID().toString())
                        put("anonymousUserId", anonymousUserId())
                        put("mapId", currentMapId)
                        put("floorId", destination?.floorId ?: currentFloorId)
                        put("x", destination?.x ?: currentX)
                        put("y", destination?.y ?: currentY)
                        put("reportType", reportType)
                        put("description", description)
                    }
        if (!enqueueUserReport(report)) return
        Toast.makeText(this, "回報已暫存，正在傳送", Toast.LENGTH_SHORT).show()
        lifecycleScope.launch { flushUserReports(true) }
    }

    private fun enqueueUserReport(report: JSONObject): Boolean {
        val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
        val key = reportQueueKey()
        val queue = JSONArray(prefs.getString(key, "[]"))
        queue.put(report)
        if (!prefs.edit().putString(key, queue.toString()).commit()) {
            Toast.makeText(this, "手機暫存失敗，請重新回報", Toast.LENGTH_LONG).show()
            return false
        }
        return true
    }

    private suspend fun flushUserReports(notify: Boolean = false) {
        reportSendMutex.lock()
        try {
            val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
            val key = reportQueueKey()
            val base = backendBaseUrl()
            val queue = JSONArray(prefs.getString(key, "[]"))
            for (i in 0 until queue.length()) {
                val item = queue.getJSONObject(i)
                try {
                    withContext(Dispatchers.IO) { postJson("/api/user-reports", item, base) }
                    // Re-read after I/O so reports added during upload are retained.
                    val latest = JSONArray(prefs.getString(key, "[]"))
                    val remaining = JSONArray()
                    for (j in 0 until latest.length()) {
                        val report = latest.getJSONObject(j)
                        if (report.optString("clientReportId") != item.optString("clientReportId")) remaining.put(report)
                    }
                    prefs.edit().putString(key, remaining.toString()).commit()
                } catch (error: Exception) {
                    if (error is kotlinx.coroutines.CancellationException) throw error
                    if (notify) Toast.makeText(this, "回報已保留，開啟 App 時會自動重送", Toast.LENGTH_LONG).show()
                    return
                }
            }
            if (notify) Toast.makeText(this, "回報已儲存至 Firebase", Toast.LENGTH_LONG).show()
        } finally {
            reportSendMutex.unlock()
        }
    }

    private fun showSettingsDialog() {
        val options = arrayOf("回報問題", "SOS 預設人員與姓名", "箭頭與導航線條", "後端連線設定", "定位改善設定", "刪除本機導航紀錄", "更新點位", "重送暫存回報", "操作說明")
        AlertDialog.Builder(this)
            .setTitle("設定")
            .setItems(options) { dialog, which ->
                when (which) {
                    0 -> showUserReportDialog()
                    1 -> showSosRecipientsDialog()
                    2 -> showMarkerStyleDialog()
                    3 -> showBackendUrlDialog()
                    4 -> showFeedbackSettingsDialog()
                    5 -> clearLocalHistory()
                    6 -> loadPlacesFromBackend()
                    7 -> lifecycleScope.launch { flushUserReports(true) }
                    8 -> startActivity(Intent(this, NavigationGuideActivity::class.java).putExtra("replay", true))
                }
                dialog.dismiss()
            }
            .show()
    }

    private fun showSosRecipientsDialog() {
        val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
        val nameInput = EditText(this).apply {
            setText(prefs.getString(KEY_SOS_REQUESTER_NAME, "").orEmpty())
            hint = "我的名字，例如 王小明"
            setSingleLine(true)
        }
        val emailInput = EditText(this).apply {
            setText(prefs.getString(KEY_SOS_EMAILS, "").orEmpty())
            hint = "例如 guard@example.com, manager@example.com"
            setSingleLine(false)
            minLines = 2
        }
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val padding = (20 * resources.displayMetrics.density).toInt()
            setPadding(padding, 0, padding, 0)
            addView(nameInput)
            addView(emailInput)
        }
        AlertDialog.Builder(this)
            .setTitle("SOS 預設人員與姓名")
            .setMessage("請填寫求助者姓名與預設 Email。可輸入多個 Email，用逗號或換行分隔。SOS 會同時存到 Firebase。")
            .setView(container)
            .setPositiveButton("儲存") { dialog, _ ->
                prefs.edit()
                    .putString(KEY_SOS_REQUESTER_NAME, nameInput.text.toString().trim())
                    .putString(KEY_SOS_EMAILS, emailInput.text.toString().trim())
                    .apply()
                Toast.makeText(this, "SOS 預設資料已儲存", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun showSosConfirmDialog() {
        val emails = sosEmailList()
        val requesterName = sosRequesterName()
        val floorName = floorNameFromId(currentFloorId)
        val message = buildString {
            if (requesterName.isNotBlank()) append("求助者：$requesterName\n")
            append("目前位置：$floorName / x=${formatOneDecimal(currentX)}, y=${formatOneDecimal(currentY)}")
            selectedPlace?.let { append("\n目前目的地：${it.name}") }
            if (emails.isEmpty()) append("\n尚未設定 Email，仍會先送到後端 Firebase。")
        }
        AlertDialog.Builder(this)
            .setTitle("SOS 求助")
            .setMessage(message)
            .setPositiveButton("送出 SOS") { dialog, _ ->
                sendSosRequest()
                dialog.dismiss()
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun sendSosRequest() {
        val emails = sosEmailList()
        showBundledFloorMapIfAvailable(currentFloorId)
        binding.navigationMapView.invalidate()
        Toast.makeText(this, "正在產生 SOS 定位圖", Toast.LENGTH_SHORT).show()
        binding.navigationMapView.postDelayed({
            val snapshot = captureSosMapSnapshot()
            val report = buildSosReport(emails, snapshot)
            enqueueUserReport(report)
            Toast.makeText(this, "SOS 已暫存，正在傳送", Toast.LENGTH_LONG).show()
            lifecycleScope.launch { flushUserReports(true) }
            sendSosEmailIntent(emails, report, snapshot)
        }, 350L)
    }

    private fun buildSosReport(emails: List<String>, snapshot: SosMapSnapshot?): JSONObject {
        val destination = selectedPlace
        val mapImage = currentFloorImageUrl()
        val requesterName = sosRequesterName()
        return JSONObject().apply {
            put("clientReportId", UUID.randomUUID().toString())
            put("anonymousUserId", anonymousUserId())
            put("requesterName", requesterName)
            put("mapId", currentMapId)
            put("floorId", currentFloorId)
            put("x", currentX)
            put("y", currentY)
            put("reportType", "sos")
            put("priority", "critical")
            put("description", sosMessageText(mapImage, snapshot, requesterName))
            put("destinationName", destination?.name.orEmpty())
            put("destinationFloorId", destination?.floorId.orEmpty())
            put("destinationX", destination?.x ?: JSONObject.NULL)
            put("destinationY", destination?.y ?: JSONObject.NULL)
            put("mapImageUrl", mapImage)
            put("mapSnapshotBase64", snapshot?.base64 ?: "")
            put("mapSnapshotMimeType", snapshot?.mimeType ?: "")
            put("mapSnapshotFileName", snapshot?.fileName ?: "")
            put("notificationEmails", JSONArray(emails))
        }
    }

    private fun sosMessageText(mapImage: String, snapshot: SosMapSnapshot?, requesterName: String): String = buildString {
        val displayName = requesterName.ifBlank { "使用者" }
        append("這是 $displayName 的求助信。")
        append("\n當你收到這封信，代表 $displayName 可能需要協助；請先確認自身安全，再協助通報、聯絡現場人員或提供可行救助。")
        append("\n場域：台北車站K區地下街 / ${floorNameFromId(currentFloorId)}")
        append("\n位置座標：x=${formatOneDecimal(currentX)}, y=${formatOneDecimal(currentY)}")
        if (snapshot != null) {
            append("\n定位截圖：已附上目前地圖與當前點位")
        }
        if (mapImage.isNotBlank()) {
            append("\n地圖圖片：$mapImage")
        }
        selectedPlace?.let {
            append("\n目前目的地：${it.name} / ${it.floorName}")
        }
        append("\n\n附註：本 SOS 訊息由使用者自行透過手機發出，定位資訊可能受 Wi-Fi 訊號、手機感測器、網路狀態與現場環境影響，僅供協助判斷位置參考。App 製作團隊與系統提供者不構成緊急救援、醫療、保全或官方通報單位，也不保證收件人一定能即時收到或完成救助。若情況緊急，請優先撥打當地緊急電話或通知現場管理單位。")
    }

    private fun captureSosMapSnapshot(): SosMapSnapshot? {
        val mapView = binding.navigationMapView
        if (mapView.width <= 0 || mapView.height <= 0) return null
        return runCatching {
            val bitmap = Bitmap.createBitmap(mapView.width, mapView.height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            mapView.draw(canvas)
            val bytes = ByteArrayOutputStream().use { stream ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 82, stream)
                stream.toByteArray()
            }
            bitmap.recycle()
            val directory = File(cacheDir, "sos").apply { mkdirs() }
            val fileName = "sos_${System.currentTimeMillis()}.jpg"
            val file = File(directory, fileName)
            file.writeBytes(bytes)
            val uri = FileProvider.getUriForFile(this, "${packageName}.fileprovider", file)
            SosMapSnapshot(
                fileName = fileName,
                mimeType = "image/jpeg",
                base64 = Base64.encodeToString(bytes, Base64.NO_WRAP),
                uri = uri
            )
        }.getOrNull()
    }

    private fun sendSosEmailIntent(emails: List<String>, report: JSONObject, snapshot: SosMapSnapshot?) {
        if (emails.isEmpty()) return
        val emailIntents = buildEmailOnlyIntents(emails, report, snapshot)
        if (emailIntents.isEmpty()) {
            runCatching { startActivity(buildFallbackEmailIntent(emails, report, snapshot)) }
                .onFailure { Toast.makeText(this, "找不到 Email App，SOS 已送到後端", Toast.LENGTH_LONG).show() }
            return
        }
        val chooser = Intent.createChooser(emailIntents.first(), "傳送 SOS Email")
        if (emailIntents.size > 1) {
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, emailIntents.drop(1).toTypedArray())
        }
        runCatching { startActivity(chooser) }
            .onFailure { Toast.makeText(this, "找不到 Email App，SOS 已送到後端", Toast.LENGTH_LONG).show() }
    }

    private fun buildEmailOnlyIntents(
        emails: List<String>,
        report: JSONObject,
        snapshot: SosMapSnapshot?
    ): List<Intent> {
        val probe = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:"))
        @Suppress("DEPRECATION")
        val targets = packageManager.queryIntentActivities(probe, PackageManager.MATCH_DEFAULT_ONLY)
        return targets.mapNotNull { resolveInfo ->
            val activityInfo = resolveInfo.activityInfo ?: return@mapNotNull null
            Intent(Intent.ACTION_SEND).apply {
                component = ComponentName(activityInfo.packageName, activityInfo.name)
                type = snapshot?.mimeType ?: "text/plain"
                putExtra(Intent.EXTRA_EMAIL, emails.toTypedArray())
                putExtra(Intent.EXTRA_SUBJECT, sosEmailSubject())
                putExtra(Intent.EXTRA_TEXT, report.optString("description"))
                snapshot?.uri?.let { uri ->
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    grantUriPermission(activityInfo.packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
            }
        }
    }

    private fun buildFallbackEmailIntent(
        emails: List<String>,
        report: JSONObject,
        snapshot: SosMapSnapshot?
    ): Intent {
        val uri = Uri.parse("mailto:${emails.joinToString(",")}")
        return Intent(Intent.ACTION_SENDTO, uri).apply {
            putExtra(Intent.EXTRA_EMAIL, emails.toTypedArray())
            putExtra(Intent.EXTRA_SUBJECT, sosEmailSubject())
            putExtra(Intent.EXTRA_TEXT, report.optString("description"))
        }
    }

    private fun sosEmailSubject(): String {
        val requesterName = sosRequesterName()
        return if (requesterName.isBlank()) {
            "SOS 求助 - ${floorNameFromId(currentFloorId)}"
        } else {
            "SOS 求助 - $requesterName / ${floorNameFromId(currentFloorId)}"
        }
    }

    private data class SosMapSnapshot(
        val fileName: String,
        val mimeType: String,
        val base64: String,
        val uri: Uri
    )

    private fun sosEmailList(): List<String> =
        getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
            .getString(KEY_SOS_EMAILS, "")
            .orEmpty()
            .split(Regex("[,，;；、\\s]+"))
            .map { it.trim() }
            .filter { it.matches(Regex("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) }
            .distinct()

    private fun sosRequesterName(): String =
        getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
            .getString(KEY_SOS_REQUESTER_NAME, "")
            .orEmpty()
            .trim()

    private fun currentFloorImageUrl(): String {
        val imageUrl = availableFloors.firstOrNull { it.id == currentFloorId }?.imageUrl.orEmpty()
        val fallbackUrl = when (currentFloorId) {
            GROUND_FLOOR_ID -> "/maps/k_area_to_airport_1f.jpg"
            SECOND_FLOOR_ID -> "/maps/k_area_to_airport_2f.jpg"
            else -> ""
        }
        return imageUrl.takeIf { it.isNotBlank() }
            ?.let { resolveBackendUrl(it) }
            ?: fallbackUrl.takeIf { it.isNotBlank() }?.let { resolveBackendUrl(it) }
            .orEmpty()
    }

    private fun loadMarkerStyle() {
        val raw = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE).getString(KEY_MARKER_STYLE, "green_arrow")
        currentMarkerStyle = when (raw) {
            "red_arrow" -> DemoNavigationMapView.CurrentMarkerStyle.RED_ARROW
            "blue_arrow" -> DemoNavigationMapView.CurrentMarkerStyle.BLUE_ARROW
            else -> DemoNavigationMapView.CurrentMarkerStyle.GREEN_ARROW
        }
        binding.navigationMapView.setCurrentMarkerStyle(currentMarkerStyle)
        val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
        binding.navigationMapView.setNavigationAppearance(
            prefs.getBoolean("large_arrow", false),
            prefs.getInt("route_color", android.graphics.Color.rgb(20, 108, 99)),
            prefs.getFloat("route_width_dp", 2.5f)
        )
    }

    private fun showMarkerStyleDialog() {
        val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
        val density = resources.displayMetrics.density
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding((20 * density).toInt(), 0, (20 * density).toInt(), 0)
        }
        fun choices(title: String, labels: List<String>, selected: Int, colors: List<Int>? = null): android.widget.RadioGroup {
            content.addView(android.widget.TextView(this).apply { text = title; textSize = 16f })
            val group = android.widget.RadioGroup(this).apply { orientation = LinearLayout.VERTICAL }
            labels.forEachIndexed { index, label ->
                group.addView(android.widget.RadioButton(this).apply {
                    id = android.view.View.generateViewId()
                    text = label
                    minHeight = (48 * density).toInt()
                    if (colors != null) buttonTintList = android.content.res.ColorStateList.valueOf(colors[index])
                    isChecked = index == selected
                })
            }
            content.addView(group)
            return group
        }
        fun selected(group: android.widget.RadioGroup) = group.indexOfChild(group.findViewById<android.view.View>(group.checkedRadioButtonId)).coerceAtLeast(0)
        val names = listOf("紅色", "綠色", "藍色")
        val colors = listOf(android.graphics.Color.rgb(220, 38, 38), android.graphics.Color.rgb(22, 163, 74), android.graphics.Color.rgb(37, 99, 235))
        val keys = listOf("red_arrow", "green_arrow", "blue_arrow")
        val size = choices("箭頭大小", listOf("小箭頭", "大箭頭"), if (prefs.getBoolean("large_arrow", false)) 1 else 0)
        val arrow = choices("箭頭顏色", names, keys.indexOf(prefs.getString(KEY_MARKER_STYLE, "green_arrow")).coerceAtLeast(0), colors)
        val line = choices("導航線條顏色", names, colors.indexOf(prefs.getInt("route_color", colors[1])).coerceAtLeast(0), colors)
        val widthLabel = android.widget.TextView(this)
        content.addView(widthLabel)
        val width = android.widget.SeekBar(this).apply {
            max = 7
            progress = (prefs.getFloat("route_width_dp", 2.5f).toInt() - 1).coerceIn(0, 7)
            widthLabel.text = "線條粗細：${progress + 1}"
            setOnSeekBarChangeListener(object : android.widget.SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(bar: android.widget.SeekBar?, value: Int, user: Boolean) { widthLabel.text = "線條粗細：${value + 1}" }
                override fun onStartTrackingTouch(bar: android.widget.SeekBar?) {}
                override fun onStopTrackingTouch(bar: android.widget.SeekBar?) {}
            })
        }
        content.addView(width)
        AlertDialog.Builder(this)
            .setTitle("箭頭與導航線條")
            .setView(android.widget.ScrollView(this).apply { addView(content) })
            .setPositiveButton("儲存") { _, _ ->
                prefs.edit()
                    .putString(KEY_MARKER_STYLE, keys[selected(arrow)])
                    .putBoolean("large_arrow", selected(size) == 1)
                    .putInt("route_color", colors[selected(line)])
                    .putFloat("route_width_dp", (width.progress + 1).toFloat())
                    .apply()
                loadMarkerStyle()
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun showFeedbackSettingsDialog() {
        val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
        val consentGranted = prefs.getBoolean(KEY_FEEDBACK_CONSENT_GRANTED, false)
        val switchEnabled = prefs.getBoolean(KEY_FEEDBACK_SWITCH_ENABLED, false)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 12, 32, 0)
        }
        val toggle = Switch(this).apply {
            text = "匿名協助改善定位"
            isChecked = consentGranted && switchEnabled
        }
        val status = TextView(this).apply {
            text = if (toggle.isChecked) {
                "已啟用：導航時可匿名送出必要定位狀態。"
            } else {
                "未啟用：不會上傳導航回饋。"
            }
            textSize = 13f
            setTextColor(getColor(R.color.text_secondary))
        }
        container.addView(toggle)
        container.addView(status)
        toggle.setOnCheckedChangeListener { _, isChecked ->
            status.text = if (isChecked) {
                "已啟用：導航時可匿名送出必要定位狀態。"
            } else {
                "未啟用：不會上傳導航回饋。"
            }
        }
        AlertDialog.Builder(this)
            .setTitle("定位改善設定")
            .setView(container)
            .setPositiveButton("儲存") { dialog, _ ->
                saveFeedbackConsent(toggle.isChecked)
                dialog.dismiss()
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun showBackendUrlDialog() {
        val input = EditText(this).apply {
            setText(backendBaseUrl())
            hint = "例如 https://maptest-02-server.onrender.com"
            setSingleLine(true)
        }
        AlertDialog.Builder(this)
            .setTitle("後端連線設定")
            .setMessage("一般使用者不需要調整。長按設定可進入管理者採樣模式。")
            .setView(input)
            .setPositiveButton("儲存") { dialog, _ ->
                val url = input.text.toString().trim().trimEnd('/')
                if (url.isNotBlank()) {
                    getSharedPreferences("backend", MODE_PRIVATE).edit().putString("base_url", url).apply()
                    binding.textBackendStatus.text = "資料狀態：後端網址已更新"
                    loadPlacesFromBackend()
                }
                dialog.dismiss()
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun postJson(path: String, body: JSONObject, baseUrl: String = backendBaseUrl()) {
        val connection = (URL("$baseUrl$path").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 5000
            readTimeout = if (path == "/api/user-reports") 30000 else 5000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            if (code !in 200..299) {
                val error = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                throw IllegalStateException(error.ifBlank { "HTTP $code" })
            }
            val response = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            if (path == "/api/user-reports" && !JSONObject(response).optBoolean("persisted")) {
                throw IllegalStateException("Firebase storage not confirmed")
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun anonymousUserId(): String {
        val prefs = getSharedPreferences(PRIVACY_PREFS, MODE_PRIVATE)
        val existing = prefs.getString(KEY_ANONYMOUS_USER_ID, null)
        if (!existing.isNullOrBlank()) return existing
        val created = "anon-" + UUID.randomUUID().toString()
        prefs.edit().putString(KEY_ANONYMOUS_USER_ID, created).apply()
        return created
    }

    private fun saveRecentNavigation(destination: DemoPlace) {
        getSharedPreferences("navigation_history", MODE_PRIVATE).edit()
            .putString("last_destination_id", destination.id)
            .putString("last_destination_name", destination.name)
            .putFloat("origin_x", currentX)
            .putFloat("origin_y", currentY)
            .apply()
        updateRecentNavigationText()
    }

    private fun updateRecentNavigationText() {
        val name = getSharedPreferences("navigation_history", MODE_PRIVATE).getString("last_destination_name", null)
        binding.textRecentNavigation.text = if (name.isNullOrBlank()) "最近導航：尚無紀錄" else "最近導航：$name"
    }

    private fun saveCurrentLocation() {
        getSharedPreferences("saved_locations", MODE_PRIVATE).edit()
            .putString("saved_name", "目前位置")
            .putFloat("saved_x", currentX)
            .putFloat("saved_y", currentY)
            .apply()
        postSavedLocation()
        binding.textNextStep.text = "已儲存目前位置，可用於回到原位。"
    }

    private fun returnToOrigin() {
        val prefs = getSharedPreferences("navigation_history", MODE_PRIVATE)
        val x = prefs.getFloat("origin_x", 180f)
        val y = prefs.getFloat("origin_y", 620f)
        val origin = DemoPlace("origin", "原位置", "目前位置", currentFloorId, floorNameFromId(currentFloorId), x, y, "unset")
        selectedPlace = origin
        refreshMapPlaces()
        binding.textDestination.text = origin.name
        binding.navigationMapView.setDestination(origin)
        showRouteToSelectedPlace()
        binding.textNextStep.text = "已規劃回到原位置的路線。"
    }

    private fun clearLocalHistory() {
        getSharedPreferences("navigation_history", MODE_PRIVATE).edit().clear().apply()
        getSharedPreferences("saved_locations", MODE_PRIVATE).edit().clear().apply()
        deleteBackendHistoryAndSavedLocations()
        updateRecentNavigationText()
        binding.textNextStep.text = "已刪除本機導航紀錄。"
    }

    private fun postSavedLocation() {
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    postJson("/api/saved-locations", JSONObject().apply {
                        put("userId", anonymousUserId())
                        put("name", "目前位置")
                        put("mapId", currentMapId)
                        put("floorId", currentFloorId)
                        put("x", currentX)
                        put("y", currentY)
                        put("type", "current")
                    })
                }
            }
        }
    }

    private fun deleteBackendHistoryAndSavedLocations() {
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    deleteRequest("/api/navigation-history?userId=${anonymousUserId()}")
                    deleteRequest("/api/saved-locations?userId=${anonymousUserId()}")
                }
            }
        }
    }

    private fun deleteRequest(path: String) {
        val connection = (URL("${backendBaseUrl()}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = "DELETE"
            connectTimeout = 5000
            readTimeout = 5000
        }
        try {
            val code = connection.responseCode
            if (code !in 200..299) {
                val error = connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                throw IllegalStateException(error.ifBlank { "HTTP $code" })
            }
            connection.inputStream.close()
        } finally {
            connection.disconnect()
        }
    }

    private fun backendBaseUrl(): String {
        val prefs = getSharedPreferences("backend", MODE_PRIVATE)
        val savedUrl = prefs.getString("base_url", DEFAULT_BACKEND_URL)?.trim()?.trimEnd('/').orEmpty()
        val normalizedUrl = if (savedUrl.contains("trycloudflare.com") || savedUrl.contains("loca.lt")) {
            DEFAULT_BACKEND_URL
        } else {
            savedUrl.ifBlank { DEFAULT_BACKEND_URL }
        }
        if (normalizedUrl != savedUrl) {
            prefs.edit().putString("base_url", normalizedUrl).apply()
        }
        return normalizedUrl
    }

    private fun loadNavigationScope() {
        val prefs = getSharedPreferences("backend", MODE_PRIVATE)
        currentMapId = prefs.getString("map_id", MAP_ID)?.takeIf { it.isNotBlank() } ?: MAP_ID
        val selectedFloorId = prefs.getString("floor_id", "")?.takeIf { it.isNotBlank() }
        val selectedFloorName = prefs.getString("floor_name", "")?.takeIf { it.isNotBlank() }
        if (selectedFloorId != null) {
            currentFloorId = selectedFloorId
            floorNames[selectedFloorId] = selectedFloorName ?: selectedFloorId
        }
    }

    private fun cachedPlacesKey(): String = "${KEY_CACHED_PLACES}_$currentMapId"

    private fun cachedRouteZonesKey(): String = "${KEY_CACHED_ROUTE_ZONES}_$currentMapId"

    private fun String.urlEncode(): String = URLEncoder.encode(this, Charsets.UTF_8.name())

    private fun floorNameFromId(floorId: String): String = when {
        floorNames.containsKey(floorId) -> floorNames.getValue(floorId)
        floorId == SECOND_FLOOR_ID -> "2F"
        floorId == GROUND_FLOOR_ID -> "1F"
        floorId.contains("second", ignoreCase = true) || floorId.contains("2") -> "二樓"
        else -> "1F"
    }

    private fun placeMeta(place: DemoPlace): String = listOf(
        place.floorName, place.categories.joinToString("、"),
        PlaceBusinessHours.status(place.businessStatus, if (place.supportsPlaceReviews()) place.openingHours else ""),
        place.openingHours
    ).filter { it.isNotBlank() }.joinToString("｜")

    private fun distance(fromX: Float, fromY: Float, toX: Float, toY: Float): Float = hypot(fromX - toX, fromY - toY)

    private fun estimatedDistance(place: DemoPlace): Float {
        val pixelDistance = hypot(place.x - currentX, place.y - currentY)
        return navigatorPixelDistanceToMeters(place.floorId, pixelDistance)
    }

    private fun formatDistanceMeters(value: Float): String {
        if (!value.isFinite() || value <= 0f) return "-- 公尺"
        val safe = value.coerceAtMost(300f)
        return if (safe >= 100f) {
            "${safe.toInt()} 公尺"
        } else {
            String.format(java.util.Locale.TAIWAN, "%.1f 公尺", safe)
        }
    }

    private fun formatOneDecimal(value: Float): String =
        String.format(java.util.Locale.TAIWAN, "%.1f", value)

    private fun formatMinutes(value: Float): String {
        val safe = value.coerceAtLeast(0.5f)
        return if (safe % 1f == 0f) safe.toInt().toString() else String.format(java.util.Locale.TAIWAN, "%.1f", safe)
    }
}

data class DemoPlace(
    val id: String,
    val name: String,
    val category: String,
    val floorId: String,
    val floorName: String,
    val x: Float,
    val y: Float,
    val businessStatus: String = "unset",
    val keywords: String = "",
    val description: String = "",
    val openingHours: String = "",
    val categories: List<String> = listOf(category)
)

internal fun placeSearchScore(place: DemoPlace, query: String): Int {
    val normalized = query.trim().lowercase()
    if (normalized.isEmpty()) return 0
    val fields = listOf(place.name, place.keywords, place.description) + place.categories
    val normalizedFields = fields.map { it.lowercase() }
    val chars = normalized.filterNot { it.isWhitespace() }.toSet()
    val matchingChars = chars.count { c -> normalizedFields.any { c in it } }
    if (matchingChars == 0) return 0
    val phraseMatches = normalizedFields.count { normalized in it }
    val tokenMatches = normalized.split(Regex("\\s+")).count { token -> normalizedFields.any { token in it } }
    return matchingChars * 100 + phraseMatches * 200 + tokenMatches * 50 +
        (if (normalizedFields.first() == normalized) 1000 else 0)
}

private fun JSONObject.optStringList(key: String, fallback: String = ""): List<String> {
    val result = mutableListOf<String>()
    optJSONArray(key)?.let { array ->
        for (index in 0 until array.length()) {
            array.optString(index).trim().takeIf { it.isNotBlank() && it !in result }?.let(result::add)
        }
    }
    fallback.trim().takeIf { result.isEmpty() && it.isNotBlank() }?.let(result::add)
    if (result.isEmpty()) result += "未分類"
    return result
}

data class DemoFloor(
    val id: String,
    val name: String,
    val imageUrl: String = ""
) {
    val label: String get() = if (name == id) id else "$name ($id)"
    val shortLabel: String
        get() = when {
            name.contains("地面") || id.contains("ground", ignoreCase = true) -> "1F"
            name.contains("二") || id.contains("second", ignoreCase = true) || id.contains("2") -> "2F"
            name.length <= 3 -> name
            else -> "樓層"
        }
}

data class DemoPoint(
    val x: Float,
    val y: Float,
    val floorId: String = ""
)

data class RouteProjection(
    val point: DemoPoint,
    val distance: Float,
    val progress: Float
)

data class DemoRouteZone(
    val id: String,
    val mapId: String,
    val floorId: String,
    val zoneType: String,
    val x: Float,
    val y: Float,
    val width: Float,
    val height: Float,
    val points: List<DemoPoint> = emptyList()
)

data class DemoRouteNode(
    val id: String,
    val x: Float,
    val y: Float
)

data class DemoRouteEdge(
    val fromNodeId: String,
    val toNodeId: String,
    val distance: Float
)

data class DemoFloorTransition(
    val fromFloorId: String,
    val toFloorId: String,
    val transitionType: String,
    val name: String
)

data class DemoRouteResult(
    val points: List<DemoPoint>,
    val distanceMeters: Float,
    val estimatedMinutes: Float,
    val floorTransitions: List<DemoFloorTransition> = emptyList()
) {
    companion object {
        val EMPTY = DemoRouteResult(emptyList(), 0f, 0f)
    }
}

data class DemoLocationEstimate(
    val mapId: String,
    val floorId: String,
    val x: Float,
    val y: Float,
    val confidence: Int,
    val estimatedError: Float,
    val modelVersion: String
)

data class NavigationLocationSample(
    val pointId: String,
    val mapId: String,
    val floorId: String,
    val x: Float,
    val y: Float,
    val confidence: Int,
    val timestampMillis: Long = 0L
)

private enum class LocationSignalState {
    OUTSIDE,
    UNCLEAR,
    CLEAR
}

data class FingerprintMapPoint(
    val pointId: String,
    val mapId: String,
    val floorId: String,
    val x: Float,
    val y: Float,
    val scanCount: Int
)
