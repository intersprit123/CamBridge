# CamBridge delivery plan

## Milestone 1 — Web camera prototype
- [x] Responsive camera-sharing and controller interface.
- [x] WebSocket signaling rooms with host/controller roles.
- [x] WebRTC offer/answer and ICE relay.
- [x] Browser camera-only capture (audio disabled; no screen capture API).
- [x] First-pass remote zoom, torch, exposure and focus requests where supported.
- [ ] Real-device network matrix, reconnection tests and camera-setting verification.
- [ ] HTTPS/WSS deployment with TURN and abuse protection.

## Milestone 2 — Windows desktop
- [x] Electron wrapper for the web client.
- [x] NSIS setup EXE build configuration.
- [ ] Automated Windows packaging and signed installer artifacts.
- [ ] MSI packaging, install/uninstall upgrade testing, camera selection/driver testing.
- [ ] Microsoft Store package preparation, privacy disclosures, review and publication.

## Milestone 3 — Native Android
- [ ] Kotlin/CameraX capture.
- [ ] Visible foreground service for user-started background camera sharing.
- [ ] WebRTC integration and the shared signaling protocol.
- [ ] Camera2 capability discovery and supported remote controls.
- [ ] APK/AAB CI, signing, device matrix, privacy policy and Play Store review.

## Milestone 4 — Release hardening
- [ ] Authentication, secure pairing, TLS/WSS, TURN and rate limiting.
- [ ] Permission review, security review, dependency audit and accessibility checks.
- [ ] Store listing assets and privacy/data safety disclosures.

## Technical constraints
An IP address does not guarantee a connection across the internet. Peer-to-peer video requires WebRTC negotiation and ICE; some networks require TURN relaying. Browsers may require HTTPS before granting camera access. Camera settings vary by hardware, driver, OS and browser; controls must be capability-gated. Store releases require signing, testing and review.
