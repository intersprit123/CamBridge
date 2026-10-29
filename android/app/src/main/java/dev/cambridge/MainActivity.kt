package dev.cambridge

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat

/**
 * Native Android camera starter. This previews the selected camera locally.
 * WebRTC publishing and remote controls are follow-up implementation work;
 * this activity intentionally does not claim that streaming is implemented.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var previewView: PreviewView
    private lateinit var status: TextView
    private var sharingRequested = false

    private val cameraPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startPreview()
        else status.text = "Camera permission is required to preview or share video."
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 24, 24, 24)
            setBackgroundColor(android.graphics.Color.rgb(13, 16, 23))
        }
        val title = TextView(this).apply {
            text = "CamBridge"
            textSize = 28f
            setTextColor(android.graphics.Color.WHITE)
        }
        status = TextView(this).apply {
            text = "Camera sharing is off."
            textSize = 14f
            setTextColor(android.graphics.Color.LTGRAY)
            setPadding(0, 12, 0, 12)
        }
        previewView = PreviewView(this).apply {
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        }
        val start = Button(this).apply {
            text = "Start camera preview"
            setOnClickListener {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA)
                    == PackageManager.PERMISSION_GRANTED) startPreview()
                else cameraPermission.launch(Manifest.permission.CAMERA)
            }
        }
        val stop = Button(this).apply {
            text = "Stop preview"
            setOnClickListener {
                sharingRequested = false
                ProcessCameraProvider.getInstance(this@MainActivity).get().unbindAll()
                stopService(Intent(this@MainActivity, CameraSharingService::class.java))
                previewView.visibility = android.view.View.GONE
                status.text = "Camera preview stopped."
            }
        }
        root.addView(title)
        root.addView(status)
        root.addView(previewView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))
        root.addView(start)
        root.addView(stop)
        root.gravity = Gravity.CENTER_HORIZONTAL
        setContentView(root)
        previewView.visibility = android.view.View.GONE
    }

    private fun startPreview() {
        status.text = "Opening camera…"
        previewView.visibility = android.view.View.VISIBLE
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            try {
                val provider = future.get()
                val preview = androidx.camera.core.Preview.Builder().build().also {
                    it.surfaceProvider = previewView.surfaceProvider
                }
                provider.unbindAll()
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview)
                sharingRequested = true
                status.text = "Local camera preview active. Remote streaming is not yet wired up."
            } catch (error: Exception) {
                status.text = "Could not open camera: ${error.message ?: "unknown error"}"
            }
        }, ContextCompat.getMainExecutor(this))
    }
}
