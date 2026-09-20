package com.example.wififingerprintcollector

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.abs

class CompassManager(
    context: Context,
    private val onCompassChanged: (azimuth: Float, directionText: String, directionCode: String, stable: Boolean, statusText: String) -> Unit
) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val rotationVector = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    private val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

    private val rotationMatrix = FloatArray(9)
    private val orientation = FloatArray(3)
    private var gravityValues: FloatArray? = null
    private var magneticValues: FloatArray? = null
    private val recentAzimuth = ArrayDeque<Float>()
    private var smoothedAzimuth: Float? = null

    val isAvailable: Boolean
        get() = rotationVector != null || (accelerometer != null && magnetometer != null)

    var latestAzimuth: Float? = null
        private set

    var latestDirectionCode: String = "NORTH"
        private set

    var latestStable: Boolean = false
        private set

    fun start() {
        if (rotationVector != null) {
            sensorManager.registerListener(this, rotationVector, SensorManager.SENSOR_DELAY_UI)
        } else if (accelerometer != null && magnetometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI)
            sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_UI)
        } else {
            onCompassChanged(0f, "-", "NORTH", false, "\u65b9\u4f4d\u611f\u6e2c\u5668\u4e0d\u53ef\u7528")
        }
    }

    fun stop() {
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_ROTATION_VECTOR -> {
                SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
                updateAzimuthFromMatrix()
            }
            Sensor.TYPE_ACCELEROMETER -> {
                gravityValues = event.values.clone()
                updateFromFallbackSensors()
            }
            Sensor.TYPE_MAGNETIC_FIELD -> {
                magneticValues = event.values.clone()
                updateFromFallbackSensors()
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun updateFromFallbackSensors() {
        val gravity = gravityValues ?: return
        val magnetic = magneticValues ?: return
        val success = SensorManager.getRotationMatrix(rotationMatrix, null, gravity, magnetic)
        if (success) updateAzimuthFromMatrix()
    }

    private fun updateAzimuthFromMatrix() {
        SensorManager.getOrientation(rotationMatrix, orientation)
        val rawAzimuth = ((Math.toDegrees(orientation[0].toDouble()) + 360.0) % 360.0).toFloat()
        val smoothed = smoothAngle(rawAzimuth)
        latestAzimuth = smoothed
        latestDirectionCode = directionCode(smoothed)
        latestStable = isStable(smoothed)
        onCompassChanged(
            smoothed,
            directionText(smoothed),
            latestDirectionCode,
            latestStable,
            if (latestStable) "\u7a69\u5b9a" else "\u53ef\u80fd\u53d7\u5e72\u64fe"
        )
    }

    private fun smoothAngle(newAngle: Float): Float {
        val previous = smoothedAzimuth
        val result = if (previous == null) {
            newAngle
        } else {
            val diff = shortestAngleDiff(previous, newAngle)
            normalizeAngle(previous + diff * 0.18f)
        }
        smoothedAzimuth = result
        recentAzimuth.addLast(result)
        while (recentAzimuth.size > 10) recentAzimuth.removeFirst()
        return result
    }

    private fun isStable(current: Float): Boolean {
        if (recentAzimuth.size < 6) return false
        val maxSwing = recentAzimuth.maxOf { abs(shortestAngleDiff(current, it)) }
        return maxSwing <= 18f
    }

    private fun normalizeAngle(angle: Float): Float {
        var value = angle % 360f
        if (value < 0f) value += 360f
        return value
    }

    private fun shortestAngleDiff(from: Float, to: Float): Float {
        var diff = (to - from + 540f) % 360f - 180f
        if (diff < -180f) diff += 360f
        return diff
    }

    companion object {
        fun directionCode(azimuth: Float): String = when {
            azimuth >= 337.5f || azimuth < 22.5f -> "NORTH"
            azimuth < 67.5f -> "NORTH_EAST"
            azimuth < 112.5f -> "EAST"
            azimuth < 157.5f -> "SOUTH_EAST"
            azimuth < 202.5f -> "SOUTH"
            azimuth < 247.5f -> "SOUTH_WEST"
            azimuth < 292.5f -> "WEST"
            else -> "NORTH_WEST"
        }

        fun directionText(azimuth: Float): String = when (directionCode(azimuth)) {
            "NORTH" -> "\u5317"
            "NORTH_EAST" -> "\u6771\u5317"
            "EAST" -> "\u6771"
            "SOUTH_EAST" -> "\u6771\u5357"
            "SOUTH" -> "\u5357"
            "SOUTH_WEST" -> "\u897f\u5357"
            "WEST" -> "\u897f"
            "NORTH_WEST" -> "\u897f\u5317"
            else -> "-"
        }
    }
}
