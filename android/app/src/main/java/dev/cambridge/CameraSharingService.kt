package dev.cambridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Visible foreground-service scaffold. CameraX/WebRTC capture must be bound
 * to this service before background camera sharing can be considered complete.
 */
class CameraSharingService : Service() {
    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Camera sharing", NotificationManager.IMPORTANCE_LOW)
        )
        val notification: Notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("CamBridge camera sharing")
            .setContentText("Camera sharing service is active.")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val CHANNEL_ID = "cambridge_camera"
        private const val NOTIFICATION_ID = 7301
    }
}
