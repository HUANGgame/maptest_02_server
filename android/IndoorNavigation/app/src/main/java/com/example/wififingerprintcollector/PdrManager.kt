package com.example.wififingerprintcollector

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import kotlin.math.sqrt

class PdrManager(
    context: Context,
    private val onStep: (stepCount: Int, distanceMeters: Float) -> Unit
) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val stepDetector: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
    private val accelerometer: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val mainHandler = Handler(Looper.getMainLooper())
    private var activeSensorType = Sensor.TYPE_STEP_DETECTOR
    private var running = false
    private var stepLengthMeters = 0.75f
    private var steps = 0
    private var distanceMeters = 0f
    private var filteredMagnitude = 9.8f
    private var lastStepTimestampNanos = 0L
    private var wasAboveThreshold = false

    val isAvailable: Boolean
        get() = stepDetector != null || accelerometer != null

    val sensorLabel: String
        get() = if (activeSensorType == Sensor.TYPE_STEP_DETECTOR) "步伐感測器" else "加速度計備援"

    fun start(stepLengthMeters: Float = 0.75f) {
        this.stepLengthMeters = stepLengthMeters.coerceIn(0.3f, 1.2f)
        steps = 0
        distanceMeters = 0f
        filteredMagnitude = 9.8f
        lastStepTimestampNanos = 0L
        wasAboveThreshold = false
        running = true

        val sensor = stepDetector ?: accelerometer ?: return
        activeSensorType = sensor.type
        sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME)
    }

    fun stop() {
        if (!running) return
        running = false
        sensorManager.unregisterListener(this)
    }

    fun resetDistance() {
        steps = 0
        distanceMeters = 0f
        lastStepTimestampNanos = 0L
        wasAboveThreshold = false
        mainHandler.post { onStep(steps, distanceMeters) }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (!running || event == null) return
        when (event.sensor.type) {
            Sensor.TYPE_STEP_DETECTOR -> registerStep(event.values.firstOrNull()?.toInt()?.coerceAtLeast(1) ?: 1)
            Sensor.TYPE_ACCELEROMETER -> detectStepFromAccelerometer(event)
        }
    }

    private fun detectStepFromAccelerometer(event: SensorEvent) {
        val x = event.values.getOrNull(0) ?: return
        val y = event.values.getOrNull(1) ?: return
        val z = event.values.getOrNull(2) ?: return
        val magnitude = sqrt(x * x + y * y + z * z)
        filteredMagnitude = filteredMagnitude * 0.85f + magnitude * 0.15f
        val dynamic = magnitude - filteredMagnitude
        val aboveThreshold = dynamic > 1.15f
        val elapsedMs = if (lastStepTimestampNanos == 0L) {
            Long.MAX_VALUE
        } else {
            (event.timestamp - lastStepTimestampNanos) / 1_000_000L
        }
        if (aboveThreshold && !wasAboveThreshold && elapsedMs > 320L) {
            lastStepTimestampNanos = event.timestamp
            registerStep(1)
        }
        wasAboveThreshold = aboveThreshold
    }

    private fun registerStep(count: Int) {
        steps += count
        distanceMeters = steps * stepLengthMeters
        mainHandler.post { onStep(steps, distanceMeters) }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
