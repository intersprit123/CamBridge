# Android APK status

The Android workflow creates a Capacitor-wrapped **debug APK preview** from the browser client and uploads the generated Android project as a separate workflow artifact. This is useful for testing camera access and foreground WebRTC behavior on supported devices.

This wrapper is not yet a production Android camera service. Background camera streaming after app minimization or device lock is not guaranteed; a native foreground camera service with a persistent notification and explicit user controls remains required. Camera settings also depend on Android WebView and the physical camera. Do not publish this preview to Google Play as a finished product.

To build it, open the Android APK preview workflow in GitHub Actions and run it manually. The APK is available under Artifacts when the job succeeds. A release APK/AAB requires native service work, testing, signing, privacy declarations, and store review.
