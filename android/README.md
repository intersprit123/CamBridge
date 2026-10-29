# Android APK — implementation status

A production Android APK is **not yet implemented or generated** by this initial commit.

The Android client must be native (Kotlin/CameraX plus WebRTC), not a screen-sharing service or an unbounded WebView workaround. Required work:
- Camera permission and a foreground camera service with a persistent notification, explicit Start/Stop actions, and Android-version-specific service declarations.
- Native camera capture and WebRTC publishing, plus the shared signaling protocol in server/protocol.md.
- Query supported Camera2 characteristics and expose only settings actually supported by the selected camera; route remote requests through a strict allowlist.
- Re-check permission and camera availability on stop, app pause, device lock, incoming calls and camera contention.
- Add notification, privacy policy, signing, Play Console testing, data safety declarations and store review.

The web prototype can demonstrate camera access in a supported secure browser context, but a browser/PWA cannot promise reliable background camera operation. Do not advertise an APK or Play Store release until the native client is built, tested on real hardware, signed and reviewed.
