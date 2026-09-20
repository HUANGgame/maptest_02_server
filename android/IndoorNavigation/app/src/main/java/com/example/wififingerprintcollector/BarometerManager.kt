package com.example.wififingerprintcollector

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock

class BarometerManager(
    context: Context,
    private val onFloorTrend: (direction: Int) -> Unit
) : SensorEventListener {
    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val pressureSensor = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE)
    private val detector = BarometricFloorDetector()
    private var lastMovementAtMillis = 0L
    private var transitionExpected = false
    private var referencePressureHpa: Float? = null

    val isAvailable: Boolean get() = pressureSensor != null

    fun start() {
        pressureSensor?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
    }

    fun stop() = sensorManager.unregisterListener(this)

    fun confirmFloor() = detector.reset()

    fun recordMovement(distanceMeters: Float) {
        if (distanceMeters >= 0.2f) lastMovementAtMillis = SystemClock.elapsedRealtime()
    }

    fun setTransitionExpected(expected: Boolean) {
        transitionExpected = expected
    }

    /** Accepts a time-aligned pressure value from an optional fixed venue sensor. */
    fun updateReferencePressure(pressureHpa: Float?) {
        referencePressureHpa = pressureHpa?.takeIf { it.isFinite() && it in 850f..1100f }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type != Sensor.TYPE_PRESSURE) return
        val now = SystemClock.elapsedRealtime()
        val movementEvidence = transitionExpected || now - lastMovementAtMillis <= 8_000L
        val direction = detector.observe(
            pressureHpa = event.values.firstOrNull() ?: return,
            timestampMillis = now,
            movementEvidence = movementEvidence,
            referencePressureHpa = referencePressureHpa
        )
        if (direction != 0) onFloorTrend(direction)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
