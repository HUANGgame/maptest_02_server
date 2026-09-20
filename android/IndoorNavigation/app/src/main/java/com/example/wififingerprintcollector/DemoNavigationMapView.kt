package com.example.wififingerprintcollector

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import kotlin.math.cos
import kotlin.math.sin

class DemoNavigationMapView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {
    private val places = mutableListOf<DemoPlace>()
    private val route = mutableListOf<DemoPoint>()
    private var current = DemoPoint(180f, 620f)
    private var hasCurrentPosition = false
    private var destination: DemoPlace? = null
    private var floorLabel = "地面層"
    private var currentFloorId = ""
    private var currentHeadingAzimuth: Float? = null
    private var floorMapBitmap: Bitmap? = null
    private var zoomScale = 1f
    private var panX = 0f
    private var panY = 0f
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var isPanning = false
    private var followHeading = false
    private val world = RectF(0f, 250f, 900f, 730f)
    private val bitmapWorld = RectF()
    private val imageDest = RectF()
    private val minZoom = 0.85f
    private val maxZoom = 2.6f

    private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(250, 251, 252) }
    private val walkwayPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(220, 226, 232)
        strokeWidth = 28f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val routeHaloPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        strokeWidth = 5f
        strokeCap = Paint.Cap.SQUARE
        strokeJoin = Paint.Join.MITER
    }
    private val routePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(20, 108, 99)
        strokeWidth = 2.5f
        strokeCap = Paint.Cap.SQUARE
        strokeJoin = Paint.Join.MITER
    }
    private val placePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(85, 96, 108) }
    private val currentPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(22, 163, 74) }
    private val destinationPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(178, 45, 45) }
    private val currentHaloPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val arrowStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 2f
        strokeJoin = Paint.Join.ROUND
    }
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(31, 41, 51)
        textSize = 28f
    }
    private val smallLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(100, 116, 139)
        textSize = 24f
    }
    private var currentMarkerStyle = CurrentMarkerStyle.GREEN_ARROW
    private var largeArrow = false
    private var navigationActive = false
    private val motionPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }

    fun setNavigationActive(active: Boolean) {
        navigationActive = active
        invalidate()
    }

    fun setNavigationAppearance(large: Boolean, color: Int, widthDp: Float) {
        largeArrow = large
        routePaint.color = color
        routePaint.strokeWidth = widthDp.coerceIn(1f, 8f) * resources.displayMetrics.density
        routeHaloPaint.strokeWidth = routePaint.strokeWidth + resources.displayMetrics.density
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(backgroundPaint.color)
        val azimuth = currentHeadingAzimuth
        if (followHeading && azimuth != null) {
            canvas.save()
            canvas.rotate(-azimuth, width / 2f, height / 2f)
        }
        drawMapImage(canvas)
        if (floorMapBitmap == null) {
            drawWalkways(canvas)
        }
        drawRoute(canvas)
        drawPlaces(canvas)
        drawCurrent(canvas)
        if (followHeading && azimuth != null) {
            canvas.restore()
        }
    }

    fun setPlaces(items: List<DemoPlace>) {
        places.clear()
        places.addAll(items)
        invalidate()
    }

    fun setCurrentPosition(x: Float, y: Float) {
        current = DemoPoint(x, y, currentFloorId)
        hasCurrentPosition = true
        invalidate()
    }

    fun clearCurrentPosition() {
        hasCurrentPosition = false
        invalidate()
    }

    fun setHeadingAzimuth(azimuth: Float?) {
        currentHeadingAzimuth = azimuth?.takeIf { it.isFinite() }
        invalidate()
    }

    fun setDestination(place: DemoPlace?) {
        destination = place
        invalidate()
    }

    fun setRoute(points: List<DemoPoint>) {
        route.clear()
        route.addAll(points)
        invalidate()
    }

    fun setFloorLabel(label: String) {
        floorLabel = label
        invalidate()
    }

    fun setCurrentFloor(floorId: String, label: String) {
        currentFloorId = floorId
        floorLabel = label
        current = current.copy(floorId = floorId)
        invalidate()
    }

    fun setFloorMap(bitmap: Bitmap?) {
        val previous = floorMapBitmap
        val sameMapSize = previous != null &&
            bitmap != null &&
            previous.width == bitmap.width &&
            previous.height == bitmap.height
        floorMapBitmap = bitmap
        if (!sameMapSize) {
            zoomScale = 1f
            panX = 0f
            panY = 0f
        }
        invalidate()
    }

    fun zoomIn() {
        zoomScale = (zoomScale * 1.2f).coerceAtMost(maxZoom)
        clampPan()
        invalidate()
    }

    fun zoomOut() {
        zoomScale = (zoomScale / 1.2f).coerceAtLeast(minZoom)
        clampPan()
        invalidate()
    }

    fun resetView() {
        zoomScale = 1f
        panX = 0f
        panY = 0f
        invalidate()
    }

    fun setFollowHeading(enabled: Boolean) {
        followHeading = enabled
        invalidate()
    }

    fun setCurrentMarkerStyle(style: CurrentMarkerStyle) {
        currentMarkerStyle = style
        invalidate()
    }

    fun clearRoute() {
        route.clear()
        invalidate()
    }

    private fun drawMapImage(canvas: Canvas) {
        val bitmap = floorMapBitmap
        if (bitmap == null) {
            canvas.drawText(floorLabel, 28f, 46f, smallLabelPaint)
            return
        }
        val availableWidth = width.toFloat()
        val availableHeight = height.toFloat()
        if (availableWidth <= 0f || availableHeight <= 0f) return
        val scale = minOf(availableWidth / bitmap.width.toFloat(), availableHeight / bitmap.height.toFloat())
        val drawWidth = bitmap.width * scale * zoomScale
        val drawHeight = bitmap.height * scale * zoomScale
        val left = (availableWidth - drawWidth) / 2f + panX
        val top = (availableHeight - drawHeight) / 2f + panY
        imageDest.set(left, top, left + drawWidth, top + drawHeight)
        bitmapWorld.set(0f, 0f, bitmap.width.toFloat(), bitmap.height.toFloat())
        canvas.drawBitmap(bitmap, null, imageDest, null)
        canvas.drawText(floorLabel, 28f, 46f, smallLabelPaint)
    }

    private fun drawWalkways(canvas: Canvas) {
        if (isSecondFloor()) {
            drawPolyline(
                canvas,
                listOf(
                    DemoPoint(610f, 500f, currentFloorId),
                    DemoPoint(610f, 390f, currentFloorId),
                    DemoPoint(610f, 300f, currentFloorId)
                ),
                walkwayPaint
            )
            drawPolyline(
                canvas,
                listOf(
                    DemoPoint(610f, 390f, currentFloorId),
                    DemoPoint(700f, 390f, currentFloorId)
                ),
                walkwayPaint
            )
        } else {
            drawPolyline(
                canvas,
                listOf(
                    DemoPoint(120f, 680f, currentFloorId),
                    DemoPoint(250f, 570f, currentFloorId),
                    DemoPoint(390f, 500f, currentFloorId),
                    DemoPoint(610f, 500f, currentFloorId),
                    DemoPoint(790f, 360f, currentFloorId)
                ),
                walkwayPaint
            )
            drawPolyline(
                canvas,
                listOf(
                    DemoPoint(390f, 500f, currentFloorId),
                    DemoPoint(430f, 420f, currentFloorId),
                    DemoPoint(520f, 330f, currentFloorId)
                ),
                walkwayPaint
            )
        }
    }

    private fun drawRoute(canvas: Canvas) {
        val path = Path()
        var hasSegment = false
        for (i in 1 until route.size) {
            val a = route[i - 1]
            val b = route[i]
            if ((a.floorId.isNotBlank() && a.floorId != currentFloorId) ||
                (b.floorId.isNotBlank() && b.floorId != currentFloorId)) continue
            if (!hasSegment || (i > 1 && route[i - 2].floorId != a.floorId)) {
                path.moveTo(sx(a.x), sy(a.y))
            }
            path.lineTo(sx(b.x), sy(b.y))
            hasSegment = true
        }
        if (!hasSegment) return
        routeHaloPaint.style = Paint.Style.STROKE
        routePaint.style = Paint.Style.STROKE
        canvas.drawPath(path, routeHaloPaint)
        canvas.drawPath(path, routePaint)
        if (navigationActive && isShown && windowVisibility == VISIBLE) {
            val density = resources.displayMetrics.density
            val spacing = 28f * density
            val phase = (android.os.SystemClock.uptimeMillis() % 1000L) / 1000f * spacing
            val measure = android.graphics.PathMeasure(path, false)
            val pos = FloatArray(2)
            do {
                var distance = phase
                while (distance < measure.length) {
                    measure.getPosTan(distance, pos, null)
                    canvas.drawCircle(pos[0], pos[1], routePaint.strokeWidth * .28f, motionPaint)
                    distance += spacing
                }
            } while (measure.nextContour())
            postInvalidateOnAnimation()
        }
    }

    private fun drawPlaces(canvas: Canvas) {
        places.forEach { place ->
            val x = sx(place.x)
            val y = sy(place.y)
            val selected = destination?.id == place.id
            canvas.drawCircle(x, y, if (selected) 13f else 9f, if (selected) destinationPaint else placePaint)
            canvas.drawText(place.name, x + 14f, y - 10f, labelPaint)
        }
        val dest = destination
        if (dest != null && dest.floorId == currentFloorId && places.none { it.id == dest.id }) {
            val x = sx(dest.x)
            val y = sy(dest.y)
            canvas.drawCircle(x, y, 13f, destinationPaint)
            canvas.drawText(dest.name, x + 14f, y - 10f, labelPaint)
        }
    }

    private fun drawCurrent(canvas: Canvas) {
        if (!hasCurrentPosition) return
        val x = sx(current.x)
        val y = sy(current.y)
        currentPaint.color = when (currentMarkerStyle) {
            CurrentMarkerStyle.RED_ARROW -> Color.rgb(220, 38, 38)
            CurrentMarkerStyle.GREEN_ARROW -> Color.rgb(22, 163, 74)
            CurrentMarkerStyle.BLUE_ARROW -> Color.rgb(37, 99, 235)
        }
        canvas.save()
        val markerScale = resources.displayMetrics.density * if (largeArrow) 1f else .65f
        canvas.scale(markerScale, markerScale, x, y)
        val azimuth = currentHeadingAzimuth ?: 0f
        val radians = Math.toRadians(azimuth.toDouble())
        val tipX = x + sin(radians).toFloat() * 18f
        val tipY = y - cos(radians).toFloat() * 18f
        val leftRadians = radians + Math.toRadians(142.0)
        val rightRadians = radians - Math.toRadians(142.0)
        val leftX = x + sin(leftRadians).toFloat() * 12f
        val leftY = y - cos(leftRadians).toFloat() * 12f
        val rightX = x + sin(rightRadians).toFloat() * 12f
        val rightY = y - cos(rightRadians).toFloat() * 12f
        val arrow = Path().apply {
            moveTo(tipX, tipY)
            lineTo(leftX, leftY)
            lineTo(x, y)
            lineTo(rightX, rightY)
            close()
        }
        canvas.drawPath(arrow, arrowStrokePaint)
        canvas.drawPath(arrow, currentPaint)
        canvas.restore()
    }

    private fun drawPolyline(canvas: Canvas, points: List<DemoPoint>, paint: Paint) {
        if (points.size < 2) return
        for (index in 1 until points.size) {
            val from = points[index - 1]
            val to = points[index]
            canvas.drawLine(sx(from.x), sy(from.y), sx(to.x), sy(to.y), paint)
        }
    }

    enum class CurrentMarkerStyle {
        RED_ARROW,
        GREEN_ARROW,
        BLUE_ARROW
    }

    private fun drawPolylineUnused(canvas: Canvas, points: List<DemoPoint>, paint: Paint) {
        if (points.size < 2) return
        if (points.size == 2) {
            val from = points[0]
            val to = points[1]
            canvas.drawLine(sx(from.x), sy(from.y), sx(to.x), sy(to.y), paint)
            return
        }
        val path = Path().apply {
            moveTo(sx(points.first().x), sy(points.first().y))
            for (index in 1 until points.lastIndex) {
                val current = points[index]
                val next = points[index + 1]
                val midX = (sx(current.x) + sx(next.x)) / 2f
                val midY = (sy(current.y) + sy(next.y)) / 2f
                quadTo(sx(current.x), sy(current.y), midX, midY)
            }
            val last = points.last()
            lineTo(sx(last.x), sy(last.y))
        }
        canvas.drawPath(path, paint)
    }

    private fun sx(x: Float): Float {
        floorMapBitmap?.let {
            val ratio = (x - bitmapWorld.left) / bitmapWorld.width().coerceAtLeast(1f)
            return imageDest.left + ratio * imageDest.width()
        }
        val padding = 28f
        val ratio = (x - world.left) / world.width()
        val base = padding + ratio * (width - padding * 2)
        return width / 2f + (base - width / 2f) * zoomScale
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastTouchX = event.x
                lastTouchY = event.y
                isPanning = true
                parent?.requestDisallowInterceptTouchEvent(true)
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                if (isPanning) {
                    panX += event.x - lastTouchX
                    panY += event.y - lastTouchY
                    lastTouchX = event.x
                    lastTouchY = event.y
                    clampPan()
                    invalidate()
                }
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                isPanning = false
                parent?.requestDisallowInterceptTouchEvent(false)
                performClick()
                return true
            }
        }
        return true
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    private fun clampPan() {
        val extraX = (width * (zoomScale - 1f)).coerceAtLeast(0f) / 2f + width * 0.35f
        val extraY = (height * (zoomScale - 1f)).coerceAtLeast(0f) / 2f + height * 0.35f
        panX = panX.coerceIn(-extraX, extraX)
        panY = panY.coerceIn(-extraY, extraY)
    }

    private fun sy(y: Float): Float {
        floorMapBitmap?.let {
            val ratio = (y - bitmapWorld.top) / bitmapWorld.height().coerceAtLeast(1f)
            return imageDest.top + ratio * imageDest.height()
        }
        val padding = 28f
        val ratio = (y - world.top) / world.height()
        val base = padding + ratio * (height - padding * 2)
        return height / 2f + (base - height / 2f) * zoomScale
    }

    private fun routeForCurrentFloor(): List<DemoPoint> {
        if (route.none { it.floorId.isNotBlank() }) return route
        return route.filter { it.floorId == currentFloorId }
    }

    private fun isSecondFloor(): Boolean {
        return currentFloorId.contains("second", ignoreCase = true) ||
            currentFloorId.contains("2") ||
            floorLabel.contains("2")
    }
}
