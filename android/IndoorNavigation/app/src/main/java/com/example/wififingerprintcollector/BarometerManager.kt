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

    val isAvailable: Boolean get() = pressureSensor != null

    fun start() {
        pressureSensor?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
    }

    fun stop() = sensorManager.unregisterListener(this)

    fun confirmFloor() = detector.reset()

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type != Sensor.TYPE_PRESSURE) return
        val direction = detector.observe(event.values.firstOrNull() ?: return, SystemClock.elapsedRealtime())
        if (direction != 0) onFloorTrend(direction)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
