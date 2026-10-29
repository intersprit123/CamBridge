# CamBridge

CamBridge is a cross-platform camera-sharing and remote-control project for Android phones and Windows PCs.

## Goals
- Android app distributed as an APK, with a future Google Play release.
- Windows desktop app packaged as an installer and MSI, with a future Microsoft Store release.
- Share a phone or PC camera and control supported camera settings from another authorized device.
- Pair devices with a QR code or pairing code; show connection details when sharing starts.
- Support a foreground camera-sharing service on Android, with a persistent notification and explicit user controls.
- Use WebRTC for low-latency media; use authenticated signaling for pairing and session negotiation.
- Provide a browser/PWA controller where supported.

## Important platform limits
- An IP address alone is not enough for reliable connections across different networks. Internet use requires a signaling service and usually STUN/TURN; LAN-only mode can use local discovery or a local address.
- Android camera access is governed by permissions, foreground-service rules, device capabilities, and OEM restrictions. Background sharing must be visible to the user and cannot bypass OS privacy indicators.
- Camera controls differ by device. Zoom, focus, exposure, torch, white balance, resolution, and frame rate must be queried and only supported controls exposed.
- Windows camera control depends on the selected camera and driver APIs. Some settings may not be available.
- A browser cannot reliably control every native camera setting or guarantee background operation. Native Android and Windows clients are needed for full platform features.
- Play Store and Microsoft Store publication require separate compliance, signing, privacy disclosures, and store review. This repository does not claim store approval.

## Planned structure
- `web/`: browser controller and PWA prototype.
- `android/`: native Android app (Kotlin, CameraX, foreground service, WebRTC).
- `windows/`: Windows desktop client and packaging configuration.
- `server/`: signaling service for authenticated pairing and WebRTC negotiation.
- `.github/workflows/`: build and test automation.

## Development status
Initial project scaffold. Do not treat this as a production-ready camera-sharing product until native clients, authenticated signaling, tests, and security review are complete.

## Security
Use explicit pairing, session authentication, encrypted transport, visible sharing indicators, and a clear stop-sharing action. Never expose an unauthenticated camera feed to the public internet. Do not commit API keys, signing keys, or TURN credentials.
