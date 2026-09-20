package com.example.wififingerprintcollector

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import androidx.core.content.ContextCompat
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

class MapSamplingView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    var onMapTapped: ((Float, Float) -> Unit)? = null
    var onMapTappedDetailed: ((mappedX: Float, mappedY: Float, rawImageX: Float, rawImageY: Float) -> Unit)? = null
    var onPointTapped: ((SamplingPoint) -> Unit)? = null
    var onPointDragFinished: ((SamplingPoint) -> Unit)? = null

    private val points = mutableListOf<SamplingPoint>()
    private val anchors = mutableListOf<AnchorRecord>()
    private val wifiApCalibrations = mutableListOf<WifiApCalibration>()
    private val wifiApSurveyMeasurements = mutableListOf<WifiApSurveyMeasurement>()
    private var activeWifiApCalibrationId: String? = null
    private val calibrationPoints = mutableListOf<Pair<Float, Float>>()
    private var currentPointId: String? = null
    private var mapBitmap: Bitmap?
    private var hasBitmapMap = false
    private var metersPerPixel: Float? = null
    private var headingArrowAzimuth: Float? = null
    private var lockedHeadingAzimuth: Float? = null
    private var pointLabelsVisible = false
    private var pointsNeedingReplenishment: Set<String> = emptySet()
    private var weakQualityPoints: Set<String> = emptySet()
    private var realtimeValidationMarker: Pair<Float, Float>? = null
    private var navigationRoute: List<NavigationPoint> = emptyList()
    private var pointDraggingEnabled = false

    private val imageRect = RectF()
    private val contentRect = RectF()
    private val worldRect = RectF()
    private val generatedMapRect = RectF()
    private val scaleDetector = ScaleGestureDetector(context, ScaleListener())
    private var zoomScale = 1f
    private var panX = 0f
    private var panY = 0f
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var isPanning = false
    private var movedDuringGesture = false
    private var draggedPointId: String? = null
    private var dragStartPoint: SamplingPoint? = null
    private var touchedPointId: String? = null
    private val pointPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(37, 99, 235)
        strokeWidth = 2f
        style = Paint.Style.STROKE
    }
    private val navigationRoutePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(14, 116, 144)
        strokeWidth = 9f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        style = Paint.Style.STROKE
    }
    private val navigationRouteHaloPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        strokeWidth = 15f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        style = Paint.Style.STROKE
    }
    private val navigationPointPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(14, 116, 144)
        style = Paint.Style.FILL
    }
    private val measuredAreaFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(44, 20, 184, 166)
        style = Paint.Style.FILL
    }
    private val measuredAreaStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(13, 148, 136)
        strokeWidth = 4f
        strokeJoin = Paint.Join.ROUND
        style = Paint.Style.STROKE
    }
    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(229, 231, 235)
        strokeWidth = 1.5f
        style = Paint.Style.STROKE
    }
    private val axisPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(148, 163, 184)
        strokeWidth = 2f
        style = Paint.Style.STROKE
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(31, 41, 55)
        textSize = 20f
        isFakeBoldText = true
    }
    private val placeholderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(107, 114, 128)
        textSize = 34f
        textAlign = Paint.Align.CENTER
    }
    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(229, 231, 235)
        style = Paint.Style.STROKE
        strokeWidth = 2f
    }
    private val anchorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(245, 158, 11)
        style = Paint.Style.FILL
    }
    private val wifiApRangePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(42, 245, 158, 11)
        style = Paint.Style.FILL
    }
    private val wifiApRangeStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(217, 119, 6)
        strokeWidth = 4f
        style = Paint.Style.STROKE
    }
    private val verifiedWifiApPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(37, 99, 235)
        style = Paint.Style.FILL
    }
    private val wifiApSurveyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(249, 115, 22)
        style = Paint.Style.FILL
    }
    private val calibrationPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(220, 38, 38)
        strokeWidth = 4f
        style = Paint.Style.STROKE
    }
    private val headingArrowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(37, 99, 235)
        strokeWidth = 5f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        style = Paint.Style.STROKE
    }
    private val headingArrowHaloPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        strokeWidth = 9f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        style = Paint.Style.STROKE
    }
    private val lockedHeadingArrowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(120, 37, 99, 235)
        strokeWidth = 7f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        style = Paint.Style.STROKE
    }
    private val smallTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(75, 85, 99)
        textSize = 22f
    }
    private val realtimeValidationPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(219, 39, 119)
        style = Paint.Style.FILL
    }
    private val realtimeValidationRingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(219, 39, 119)
        strokeWidth = 4f
        style = Paint.Style.STROKE
    }

    init {
        val mapId = resources.getIdentifier("map_floor_1", "drawable", context.packageName)
        mapBitmap = if (mapId != 0) BitmapFactory.decodeResource(resources, mapId) else null
        hasBitmapMap = mapBitmap != null
        isClickable = true
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        drawMap(canvas)
        drawPoints(canvas)
    }

    private fun drawMap(canvas: Canvas) {
        imageRect.set(0f, 0f, width.toFloat(), height.toFloat())
        updateContentRect()
        val bitmap = mapBitmap
        if (bitmap == null) {
            canvas.drawColor(ContextCompat.getColor(context, R.color.app_bg))
            drawGeneratedGrid(canvas)
        } else {
            canvas.drawBitmap(bitmap, null, contentRect, null)
        }
        canvas.drawRect(imageRect, borderPaint)
    }

    private fun drawGeneratedGrid(canvas: Canvas) {
        generatedMapRect.set(
            24f + panX,
            24f + panY,
            width - 24f + panX,
            height - 34f + panY
        )
        computeWorldRect()
        val stepMeters = 1.5f
        var x = kotlin.math.floor(worldRect.left / stepMeters) * stepMeters
        while (x <= worldRect.right) {
            val sx = toScreenX(x)
            canvas.drawLine(sx, generatedMapRect.top, sx, generatedMapRect.bottom, gridPaint)
            x += stepMeters
        }
        var y = kotlin.math.floor(worldRect.top / stepMeters) * stepMeters
        while (y <= worldRect.bottom) {
            val sy = toScreenY(y)
            canvas.drawLine(generatedMapRect.left, sy, generatedMapRect.right, sy, gridPaint)
            y += stepMeters
        }
        val axisX = toScreenX(0f)
        val axisY = toScreenY(0f)
        canvas.drawLine(axisX, generatedMapRect.top, axisX, generatedMapRect.bottom, axisPaint)
        canvas.drawLine(generatedMapRect.left, axisY, generatedMapRect.right, axisY, axisPaint)
        canvas.drawText("Auto-generated map: direction + distance, grid = 1.5m", generatedMapRect.left, height - 10f, smallTextPaint)
    }

    private fun drawPoints(canvas: Canvas) {
        drawMeasuredArea(canvas)
        drawNavigationRoute(canvas)
        drawAnchors(canvas)
        drawWifiApCalibrations(canvas)
        drawCalibrationPoints(canvas)
        drawHeadingArrow(canvas)
        drawRealtimeValidationMarker(canvas)
        for (point in points) {
            val screenX = toScreenX(point.x)
            val screenY = toScreenY(point.y)
            pointPaint.style = Paint.Style.FILL
            val needsReplenishment = point.pointId in pointsNeedingReplenishment
            val weakQuality = point.pointId in weakQualityPoints
            pointPaint.color = when {
                point.pointId == currentPointId -> Color.rgb(37, 99, 235)
                weakQuality -> Color.rgb(220, 38, 38)
                needsReplenishment -> Color.rgb(245, 158, 11)
                point.isStart -> Color.rgb(30, 64, 175)
                point.sampled -> Color.rgb(22, 163, 74)
                else -> Color.rgb(100, 116, 139)
            }
            val radius = 7f
            canvas.drawCircle(screenX, screenY, radius, pointPaint)

            pointPaint.style = Paint.Style.STROKE
            pointPaint.strokeWidth = 2f
            pointPaint.color = Color.WHITE
            canvas.drawCircle(screenX, screenY, radius, pointPaint)

            if (needsReplenishment || weakQuality) {
                pointPaint.style = Paint.Style.STROKE
                pointPaint.strokeWidth = 2f
                pointPaint.color = if (weakQuality) Color.rgb(220, 38, 38) else Color.rgb(245, 158, 11)
                canvas.drawCircle(screenX, screenY, 12f, pointPaint)
            }

            if (pointLabelsVisible || point.pointId == currentPointId) {
                textPaint.color = when {
                    point.pointId == currentPointId -> Color.rgb(31, 41, 55)
                    weakQuality -> Color.rgb(185, 28, 28)
                    needsReplenishment -> Color.rgb(180, 83, 9)
                    else -> Color.rgb(31, 41, 55)
                }
                canvas.drawText(point.displayLabel.ifBlank { point.pointId }, screenX + 10f, screenY - 8f, textPaint)
            }
        }
    }

    private fun drawRealtimeValidationMarker(canvas: Canvas) {
        val marker = realtimeValidationMarker ?: return
        val x = toScreenX(marker.first)
        val y = toScreenY(marker.second)
        val radius = 18f
        pointPaint.style = Paint.Style.FILL
        pointPaint.color = Color.WHITE
        canvas.drawCircle(x, y, radius + 7f, pointPaint)
        canvas.drawCircle(x, y, radius + 3f, realtimeValidationRingPaint)
        val diamond = Path().apply {
            moveTo(x, y - radius)
            lineTo(x + radius, y)
            lineTo(x, y + radius)
            lineTo(x - radius, y)
            close()
        }
        canvas.drawPath(diamond, realtimeValidationPaint)
        pointPaint.style = Paint.Style.STROKE
        pointPaint.strokeWidth = 3f
        pointPaint.color = Color.WHITE
        canvas.drawPath(diamond, pointPaint)
        textPaint.color = Color.rgb(157, 23, 77)
        canvas.drawText("\u5373\u6642\u9a57\u8b49", x + 24f, y - 20f, textPaint)
    }

    private fun drawWifiApCalibrations(canvas: Canvas) {
        val activeId = activeWifiApCalibrationId
        wifiApCalibrations.forEach { calibration ->
            val x = toScreenX(calibration.x)
            val y = toScreenY(calibration.y)
            if (calibration.calibrationId == activeId && calibration.status != "VERIFIED") {
                val radiusPixels = calibration.uncertaintyMeters.coerceAtLeast(4f) /
                    (metersPerPixel?.takeIf { it > 0f } ?: 0.125f)
                val screenRadius = kotlin.math.abs(toScreenX(calibration.x + radiusPixels) - x)
                    .coerceAtLeast(28f)
                canvas.drawCircle(x, y, screenRadius, wifiApRangePaint)
                canvas.drawCircle(x, y, screenRadius, wifiApRangeStrokePaint)
            }
            if (calibration.status == "VERIFIED") {
                canvas.drawCircle(x, y, 17f, verifiedWifiApPaint)
                pointPaint.style = Paint.Style.STROKE
                pointPaint.strokeWidth = 3f
                pointPaint.color = Color.WHITE
                canvas.drawCircle(x, y, 17f, pointPaint)
                textPaint.color = Color.rgb(30, 64, 175)
                canvas.drawText(calibration.ssid.ifBlank { "Wi-Fi 基地台" }, x + 22f, y - 14f, textPaint)
            }
        }
        wifiApSurveyMeasurements.forEachIndexed { index, measurement ->
            val x = toScreenX(measurement.x)
            val y = toScreenY(measurement.y)
            canvas.drawCircle(x, y, 12f, wifiApSurveyPaint)
            pointPaint.style = Paint.Style.STROKE
            pointPaint.strokeWidth = 2f
            pointPaint.color = Color.WHITE
            canvas.drawCircle(x, y, 12f, pointPaint)
            smallTextPaint.color = Color.rgb(154, 52, 18)
            canvas.drawText("${index + 1}", x + 15f, y - 10f, smallTextPaint)
        }
    }

    private fun drawNavigationRoute(canvas: Canvas) {
        if (navigationRoute.size < 2) return
        drawSmoothNavigationRoute(canvas, navigationRouteHaloPaint)
        drawSmoothNavigationRoute(canvas, navigationRoutePaint)
        navigationRoute.forEachIndexed { index, point ->
            val x = toScreenX(point.x)
            val y = toScreenY(point.y)
            navigationPointPaint.color = when (index) {
                0 -> Color.rgb(8, 145, 178)
                navigationRoute.lastIndex -> Color.rgb(190, 18, 60)
                else -> Color.rgb(14, 116, 144)
            }
            canvas.drawCircle(x, y, if (index == navigationRoute.lastIndex) 15f else 10f, navigationPointPaint)
        }
    }

    private fun drawSmoothNavigationRoute(canvas: Canvas, paint: Paint) {
        val first = navigationRoute.first()
        val path = Path().apply {
            moveTo(toScreenX(first.x), toScreenY(first.y))
            if (navigationRoute.size == 2) {
                val last = navigationRoute.last()
                lineTo(toScreenX(last.x), toScreenY(last.y))
            } else {
                for (index in 1 until navigationRoute.lastIndex) {
                    val current = navigationRoute[index]
                    val next = navigationRoute[index + 1]
                    val midX = (toScreenX(current.x) + toScreenX(next.x)) / 2f
                    val midY = (toScreenY(current.y) + toScreenY(next.y)) / 2f
                    quadTo(toScreenX(current.x), toScreenY(current.y), midX, midY)
                }
                val last = navigationRoute.last()
                lineTo(toScreenX(last.x), toScreenY(last.y))
            }
        }
        canvas.drawPath(path, paint)
    }

    private fun drawHeadingArrow(canvas: Canvas) {
        val point = points.lastOrNull { it.pointId == currentPointId } ?: return
        val startX = toScreenX(point.x)
        val startY = toScreenY(point.y)
        lockedHeadingAzimuth?.let { locked ->
            drawArrow(canvas, startX, startY, locked, 52f, lockedHeadingArrowPaint, headingArrowHaloPaint)
        }
        val azimuth = headingArrowAzimuth ?: return
        drawArrow(canvas, startX, startY, azimuth, 42f, headingArrowPaint, headingArrowHaloPaint)
    }

    private fun drawArrow(
        canvas: Canvas,
        startX: Float,
        startY: Float,
        azimuth: Float,
        arrowLength: Float,
        arrowPaint: Paint,
        haloPaint: Paint
    ) {
        val radians = Math.toRadians(azimuth.toDouble())
        val directionX = sin(radians).toFloat()
        val directionY = -cos(radians).toFloat()
        val startOffset = 16f
        val endX = startX + directionX * arrowLength
        val endY = startY + directionY * arrowLength
        val baseX = startX + directionX * startOffset
        val baseY = startY + directionY * startOffset

        canvas.drawLine(baseX, baseY, endX, endY, haloPaint)
        canvas.drawLine(baseX, baseY, endX, endY, arrowPaint)

        val headLength = 11f
        val headAngle = Math.toRadians(32.0)
        val leftAngle = radians + Math.PI - headAngle
        val rightAngle = radians + Math.PI + headAngle
        val arrowHead = Path().apply {
            moveTo(endX, endY)
            lineTo(
                endX + sin(leftAngle).toFloat() * headLength,
                endY - cos(leftAngle).toFloat() * headLength
            )
            moveTo(endX, endY)
            lineTo(
                endX + sin(rightAngle).toFloat() * headLength,
                endY - cos(rightAngle).toFloat() * headLength
            )
        }
        canvas.drawPath(arrowHead, haloPaint)
        canvas.drawPath(arrowHead, arrowPaint)
    }

    private fun drawPath(canvas: Canvas) {
        if (points.size < 2) return
        for (index in 1 until points.size) {
            val from = points[index - 1]
            val to = points[index]
            canvas.drawLine(toScreenX(from.x), toScreenY(from.y), toScreenX(to.x), toScreenY(to.y), linePaint)
        }
    }

    private fun drawMeasuredArea(canvas: Canvas) {
        val sampledPoints = points.filter { it.sampled }
        if (sampledPoints.size < 3) return
        val hull = convexHull(sampledPoints.map { it.x to it.y })
        if (hull.size < 3) return
        val path = Path().apply {
            moveTo(toScreenX(hull[0].first), toScreenY(hull[0].second))
            for (index in 1 until hull.size) {
                lineTo(toScreenX(hull[index].first), toScreenY(hull[index].second))
            }
            close()
        }
        canvas.drawPath(path, measuredAreaFillPaint)
    }

    private fun drawAnchors(canvas: Canvas) {
        anchors.forEach { anchor ->
            val x = toScreenX(anchor.x)
            val y = toScreenY(anchor.y)
            anchorPaint.color = Color.rgb(245, 158, 11)
            canvas.drawRect(x - 11f, y - 11f, x + 11f, y + 11f, anchorPaint)
            pointPaint.style = Paint.Style.STROKE
            pointPaint.strokeWidth = 3f
            pointPaint.color = Color.WHITE
            canvas.drawRect(x - 11f, y - 11f, x + 11f, y + 11f, pointPaint)
            canvas.drawText(anchor.anchorType, x + 15f, y + 25f, smallTextPaint)
        }
    }

    private fun drawCalibrationPoints(canvas: Canvas) {
        if (calibrationPoints.isEmpty()) return
        if (calibrationPoints.size >= 2) {
            val first = calibrationPoints[0]
            val second = calibrationPoints[1]
            canvas.drawLine(
                pixelXToScreen(first.first),
                pixelYToScreen(first.second),
                pixelXToScreen(second.first),
                pixelYToScreen(second.second),
                calibrationPaint
            )
        }
        calibrationPoints.forEachIndexed { index, point ->
            val x = pixelXToScreen(point.first)
            val y = pixelYToScreen(point.second)
            pointPaint.style = Paint.Style.FILL
            pointPaint.color = Color.rgb(220, 38, 38)
            canvas.drawCircle(x, y, 14f, pointPaint)
            pointPaint.style = Paint.Style.STROKE
            pointPaint.strokeWidth = 3f
            pointPaint.color = Color.WHITE
            canvas.drawCircle(x, y, 14f, pointPaint)
            canvas.drawText("C${index + 1}", x + 18f, y - 16f, textPaint)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastTouchX = event.x
                lastTouchY = event.y
                val touchedPoint = findPointAt(event.x, event.y)
                touchedPointId = touchedPoint?.pointId
                draggedPointId = if (pointDraggingEnabled && touchedPoint?.sampled != true) touchedPoint?.pointId else null
                dragStartPoint = if (draggedPointId != null) touchedPoint else null
                isPanning = touchedPoint == null
                movedDuringGesture = false
                parent?.requestDisallowInterceptTouchEvent(true)
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val draggedId = draggedPointId
                if (!scaleDetector.isInProgress && draggedId != null && event.pointerCount == 1) {
                    if (hypot(event.x - lastTouchX, event.y - lastTouchY) > 2f) movedDuringGesture = true
                    movePointTo(draggedId, event.x, event.y)
                    lastTouchX = event.x
                    lastTouchY = event.y
                } else if (!scaleDetector.isInProgress && isPanning && event.pointerCount == 1 && zoomScale > 1f) {
                    val dx = event.x - lastTouchX
                    val dy = event.y - lastTouchY
                    if (kotlin.math.abs(dx) > 2f || kotlin.math.abs(dy) > 2f) movedDuringGesture = true
                    panX += dx
                    panY += dy
                    clampPan()
                    lastTouchX = event.x
                    lastTouchY = event.y
                    invalidate()
                }
                return true
            }
            MotionEvent.ACTION_UP -> {
                parent?.requestDisallowInterceptTouchEvent(false)
                isPanning = false
                draggedPointId?.let { pointId ->
                    if (!movedDuringGesture) restoreDraggedPoint()
                    val draggedPoint = points.firstOrNull { it.pointId == pointId }
                    draggedPointId = null
                    dragStartPoint = null
                    touchedPointId = null
                    draggedPoint?.let {
                        if (movedDuringGesture) onPointDragFinished?.invoke(it) else onPointTapped?.invoke(it)
                    }
                    performClick()
                    return true
                }
                if (movedDuringGesture || scaleDetector.isInProgress) {
                    touchedPointId = null
                    return true
                }
                touchedPointId?.let { pointId ->
                    val touchedPoint = points.firstOrNull { it.pointId == pointId }
                    touchedPointId = null
                    touchedPoint?.let { onPointTapped?.invoke(it) }
                    performClick()
                    return true
                }
                val rawX = if (hasBitmapMap) toImageX(event.x) else event.x
                val rawY = if (hasBitmapMap) toImageY(event.y) else event.y
                val x = if (hasBitmapMap) {
                    rawX
                } else {
                    toWorldX(event.x)
                }
                val y = if (hasBitmapMap) {
                    rawY
                } else {
                    toWorldY(event.y)
                }
                onMapTapped?.invoke(x, y)
                onMapTappedDetailed?.invoke(x, y, rawX, rawY)
                performClick()
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                restoreDraggedPoint()
                parent?.requestDisallowInterceptTouchEvent(false)
                isPanning = false
                draggedPointId = null
                touchedPointId = null
                return true
            }
        }
        return true
    }

    private fun findPointAt(screenX: Float, screenY: Float): SamplingPoint? {
        val threshold = 36f
        return points
            .asReversed()
            .map { point ->
                val dx = toScreenX(point.x) - screenX
                val dy = toScreenY(point.y) - screenY
                point to hypot(dx, dy)
            }
            .filter { it.second <= threshold }
            .minByOrNull { it.second }
            ?.first
    }

    private fun restoreDraggedPoint() {
        dragStartPoint?.let { original ->
            val index = points.indexOfLast { it.pointId == original.pointId }
            if (index >= 0) points[index] = original
        }
        dragStartPoint = null
        invalidate()
    }

    private fun movePointTo(pointId: String, screenX: Float, screenY: Float) {
        val index = points.indexOfLast { it.pointId == pointId }
        if (index < 0) return
        val x = if (hasBitmapMap) toImageX(screenX) else toWorldX(screenX)
        val y = if (hasBitmapMap) toImageY(screenY) else toWorldY(screenY)
        points[index] = points[index].copy(x = x, y = y)
        currentPointId = pointId
        invalidate()
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    fun addPoint(point: SamplingPoint) {
        points.add(point)
        currentPointId = point.pointId
        invalidate()
    }

    fun setCurrentPoint(pointId: String?) {
        currentPointId = pointId
        invalidate()
    }

    fun replacePoints(updatedPoints: List<SamplingPoint>, currentId: String?) {
        points.clear()
        points.addAll(updatedPoints)
        currentPointId = currentId ?: updatedPoints.lastOrNull()?.pointId
        invalidate()
    }

    fun setHeadingArrowAzimuth(azimuth: Float?) {
        headingArrowAzimuth = azimuth?.takeIf { !it.isNaN() && it >= 0f }
        invalidate()
    }

    fun setLockedHeadingAzimuth(azimuth: Float?) {
        lockedHeadingAzimuth = azimuth?.takeIf { !it.isNaN() && it >= 0f }
        invalidate()
    }

    fun setCompactDisplay(enabled: Boolean) {
        pointLabelsVisible = !enabled
        invalidate()
    }

    fun setPointDraggingEnabled(enabled: Boolean) {
        pointDraggingEnabled = enabled
        if (!enabled) {
            restoreDraggedPoint()
            draggedPointId = null
        }
    }

    fun setPointsNeedingReplenishment(pointIds: Set<String>) {
        pointsNeedingReplenishment = pointIds
        invalidate()
    }

    fun setWeakQualityPoints(pointIds: Set<String>) {
        weakQualityPoints = pointIds
        invalidate()
    }

    fun setRealtimeValidationMarker(x: Float, y: Float) {
        realtimeValidationMarker = x to y
        invalidate()
    }

    fun clearRealtimeValidationMarker() {
        realtimeValidationMarker = null
        invalidate()
    }

    fun setNavigationRoute(route: List<NavigationPoint>) {
        navigationRoute = route
        invalidate()
    }

    fun clearNavigationRoute() {
        navigationRoute = emptyList()
        invalidate()
    }

    fun undoLastPoint(): SamplingPoint? {
        if (points.isEmpty()) return null
        val removed = points.removeAt(points.lastIndex)
        currentPointId = points.lastOrNull()?.pointId
        invalidate()
        return removed
    }

    fun removePoint(pointId: String): SamplingPoint? {
        val index = points.indexOfLast { it.pointId == pointId }
        if (index < 0) return null
        val removed = points.removeAt(index)
        currentPointId = points.lastOrNull()?.pointId
        invalidate()
        return removed
    }

    fun markPointSampled(pointId: String) {
        val index = points.indexOfLast { it.pointId == pointId }
        if (index >= 0) {
            points[index] = points[index].copy(sampled = true)
            invalidate()
        }
    }

    fun clearPoints() {
        points.clear()
        anchors.clear()
        navigationRoute = emptyList()
        currentPointId = null
        invalidate()
    }

    fun setAnchors(records: List<AnchorRecord>) {
        anchors.clear()
        anchors.addAll(records)
        invalidate()
    }

    fun setWifiApCalibrations(
        records: List<WifiApCalibration>,
        activeCalibrationId: String?,
        surveyMeasurements: List<WifiApSurveyMeasurement>
    ) {
        wifiApCalibrations.clear()
        wifiApCalibrations.addAll(records)
        activeWifiApCalibrationId = activeCalibrationId
        wifiApSurveyMeasurements.clear()
        wifiApSurveyMeasurements.addAll(surveyMeasurements)
        invalidate()
    }

    fun focusOnPoint(point: SamplingPoint, minimumZoom: Float = 2.5f) {
        currentPointId = point.pointId
        if (width <= 0 || height <= 0 || !hasBitmapMap) {
            invalidate()
            return
        }
        zoomScale = maxOf(zoomScale, minimumZoom.coerceIn(1f, 6f))
        panX = 0f
        panY = 0f
        updateContentRect()
        panX = width / 2f - pixelXToScreen(point.x)
        panY = height / 2f - pixelYToScreen(point.y)
        clampPan()
        invalidate()
    }

    fun addAnchor(anchor: AnchorRecord) {
        anchors.add(anchor)
        invalidate()
    }

    fun setImportedMap(path: String?) {
        mapBitmap = if (path.isNullOrBlank()) {
            val mapId = resources.getIdentifier("map_floor_1", "drawable", context.packageName)
            if (mapId != 0) BitmapFactory.decodeResource(resources, mapId) else null
        } else {
            BitmapFactory.decodeFile(path)
        }
        hasBitmapMap = mapBitmap != null
        resetZoom()
        invalidate()
    }

    fun setMetersPerPixel(value: Float?) {
        metersPerPixel = value
        invalidate()
    }

    fun clearCalibrationOverlay() {
        calibrationPoints.clear()
        invalidate()
    }

    fun addCalibrationPoint(rawImageX: Float, rawImageY: Float) {
        if (calibrationPoints.size >= 2) calibrationPoints.clear()
        calibrationPoints.add(rawImageX to rawImageY)
        invalidate()
    }

    fun addCalibrationPointMeters(x: Float, y: Float) {
        addCalibrationPoint(x, y)
    }

    fun getPoints(): List<SamplingPoint> = points.toList()

    private fun computeWorldRect() {
        val allX = points.map { it.x } + anchors.map { it.x } + listOf(0f)
        val allY = points.map { it.y } + anchors.map { it.y } + listOf(0f)
        val minX = allX.minOrNull() ?: -3f
        val maxX = allX.maxOrNull() ?: 3f
        val minY = allY.minOrNull() ?: -3f
        val maxY = allY.maxOrNull() ?: 3f
        val padding = 3f
        worldRect.set(minX - padding, minY - padding, maxX + padding, maxY + padding)
        if (worldRect.width() < 6f) {
            worldRect.left -= 3f
            worldRect.right += 3f
        }
        if (worldRect.height() < 6f) {
            worldRect.top -= 3f
            worldRect.bottom += 3f
        }
    }

    private fun convexHull(source: List<Pair<Float, Float>>): List<Pair<Float, Float>> {
        val sorted = source.distinct().sortedWith(compareBy<Pair<Float, Float>> { it.first }.thenBy { it.second })
        if (sorted.size <= 2) return sorted

        fun cross(origin: Pair<Float, Float>, a: Pair<Float, Float>, b: Pair<Float, Float>): Float {
            return (a.first - origin.first) * (b.second - origin.second) -
                (a.second - origin.second) * (b.first - origin.first)
        }

        val lower = mutableListOf<Pair<Float, Float>>()
        for (point in sorted) {
            while (lower.size >= 2 && cross(lower[lower.lastIndex - 1], lower.last(), point) <= 0f) {
                lower.removeAt(lower.lastIndex)
            }
            lower.add(point)
        }

        val upper = mutableListOf<Pair<Float, Float>>()
        for (point in sorted.asReversed()) {
            while (upper.size >= 2 && cross(upper[upper.lastIndex - 1], upper.last(), point) <= 0f) {
                upper.removeAt(upper.lastIndex)
            }
            upper.add(point)
        }

        return (lower.dropLast(1) + upper.dropLast(1))
    }

    private fun toScreenX(x: Float): Float {
        if (hasBitmapMap) {
            return pixelXToScreen(x)
        }
        if (generatedMapRect.width() <= 0f || generatedMapRect.height() <= 0f) generatedMapRect.set(24f, 24f, width - 24f, height - 34f)
        computeWorldRect()
        val ratio = (x - worldRect.left) / worldRect.width()
        return generatedMapRect.left + ratio * generatedMapRect.width()
    }

    private fun toScreenY(y: Float): Float {
        if (hasBitmapMap) {
            return pixelYToScreen(y)
        }
        if (generatedMapRect.width() <= 0f || generatedMapRect.height() <= 0f) generatedMapRect.set(24f, 24f, width - 24f, height - 34f)
        computeWorldRect()
        val ratio = (y - worldRect.top) / worldRect.height()
        return generatedMapRect.top + ratio * generatedMapRect.height()
    }

    private fun toWorldX(screenX: Float): Float {
        if (generatedMapRect.width() <= 0f || generatedMapRect.height() <= 0f) generatedMapRect.set(24f, 24f, width - 24f, height - 34f)
        computeWorldRect()
        val ratio = ((screenX - generatedMapRect.left) / generatedMapRect.width()).coerceIn(0f, 1f)
        return worldRect.left + ratio * worldRect.width()
    }

    private fun toWorldY(screenY: Float): Float {
        if (generatedMapRect.width() <= 0f || generatedMapRect.height() <= 0f) generatedMapRect.set(24f, 24f, width - 24f, height - 34f)
        computeWorldRect()
        val ratio = ((screenY - generatedMapRect.top) / generatedMapRect.height()).coerceIn(0f, 1f)
        return worldRect.top + ratio * worldRect.height()
    }

    private fun pixelXToScreen(pixelX: Float): Float {
        val bitmapWidth = mapBitmap?.width?.toFloat() ?: width.toFloat()
        val ratio = if (bitmapWidth <= 0f) 0f else pixelX / bitmapWidth
        updateContentRect()
        return contentRect.left + ratio.coerceIn(0f, 1f) * contentRect.width()
    }

    private fun pixelYToScreen(pixelY: Float): Float {
        val bitmapHeight = mapBitmap?.height?.toFloat() ?: height.toFloat()
        val ratio = if (bitmapHeight <= 0f) 0f else pixelY / bitmapHeight
        updateContentRect()
        return contentRect.top + ratio.coerceIn(0f, 1f) * contentRect.height()
    }

    private fun toImageX(screenX: Float): Float {
        val bitmapWidth = mapBitmap?.width?.toFloat() ?: width.toFloat()
        updateContentRect()
        val ratio = ((screenX - contentRect.left) / contentRect.width()).coerceIn(0f, 1f)
        return ratio * bitmapWidth
    }

    private fun toImageY(screenY: Float): Float {
        val bitmapHeight = mapBitmap?.height?.toFloat() ?: height.toFloat()
        updateContentRect()
        val ratio = ((screenY - contentRect.top) / contentRect.height()).coerceIn(0f, 1f)
        return ratio * bitmapHeight
    }

    private fun updateContentRect() {
        val centerX = width / 2f
        val centerY = height / 2f
        val bitmap = mapBitmap
        val baseWidth: Float
        val baseHeight: Float
        if (bitmap != null && bitmap.width > 0 && bitmap.height > 0 && width > 0 && height > 0) {
            val viewAspect = width.toFloat() / height.toFloat()
            val imageAspect = bitmap.width.toFloat() / bitmap.height.toFloat()
            if (viewAspect > imageAspect) {
                baseHeight = height.toFloat()
                baseWidth = baseHeight * imageAspect
            } else {
                baseWidth = width.toFloat()
                baseHeight = baseWidth / imageAspect
            }
        } else {
            baseWidth = width.toFloat()
            baseHeight = height.toFloat()
        }
        val scaledWidth = baseWidth * zoomScale
        val scaledHeight = baseHeight * zoomScale
        contentRect.set(
            centerX - scaledWidth / 2f + panX,
            centerY - scaledHeight / 2f + panY,
            centerX + scaledWidth / 2f + panX,
            centerY + scaledHeight / 2f + panY
        )
    }

    private fun resetZoom() {
        zoomScale = 1f
        panX = 0f
        panY = 0f
    }

    private fun clampPan() {
        if (zoomScale <= 1f) {
            panX = 0f
            panY = 0f
            return
        }
        val maxPanX = (width * (zoomScale - 1f)) / 2f
        val maxPanY = (height * (zoomScale - 1f)) / 2f
        panX = panX.coerceIn(-maxPanX, maxPanX)
        panY = panY.coerceIn(-maxPanY, maxPanY)
    }

    private inner class ScaleListener : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            val previousScale = zoomScale
            zoomScale = (zoomScale * detector.scaleFactor).coerceIn(1f, 6f)
            val scaleChange = zoomScale / previousScale
            panX = (panX - (detector.focusX - width / 2f)) * scaleChange + (detector.focusX - width / 2f)
            panY = (panY - (detector.focusY - height / 2f)) * scaleChange + (detector.focusY - height / 2f)
            clampPan()
            movedDuringGesture = true
            invalidate()
            return true
        }
    }
}
