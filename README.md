# CamBridge

CamBridge is a cross-platform camera-sharing project for Android phones and Windows PCs. It shares camera video only — not a device screen — and lets a paired controller request camera settings supported by the sending device.

## What is in this repository now

- Responsive React web client for sharing a browser-accessible camera or joining as a controller.
- Node.js/WebSocket signaling service with pairing rooms and host/controller roles.
- WebRTC camera video plus first-pass remote zoom, torch, exposure-compensation and focus-mode requests when the browser/device exposes those controls.
- Electron wrapper and GitHub Actions workflow for a Windows setup EXE.
- Android implementation plan and Windows/MSI/store release checklist.

**This is an early prototype, not a finished release.** The native Android APK, reliable background camera service, Windows MSI, production security hardening, signing, and Play Store/Microsoft Store submissions remain unfinished. No store approval is implied.

## Requirements

- Node.js 20+ (CI uses Node 22).
- A supported modern browser, or Windows for the Electron wrapper.
- Browser camera access generally requires HTTPS or localhost.
- Peers need a reachable signaling endpoint; restrictive networks may require a TURN server.

## Run the web prototype

1. Clone this repository and install dependencies with npm install.
2. Start the web client and signaling server with npm run dev.
3. Open the client at http://localhost:5173. The signaling server listens on port 8787 and logs local IPv4 addresses.
4. On the camera device choose **Share this camera**, allow camera permission, and send the generated code to the controller.
5. On the other device choose **Control another device** and enter that code.

For use from another device, the web page must be reachable and served from a secure origin for camera access. Configure a reachable WebSocket signaling URL in Connection settings. A raw IP address cannot bypass NAT, firewall or browser security restrictions.

## Signaling configuration

Set VITE_SIGNAL_URL before building, or edit the WebSocket address in the app's Connection settings. Local prototype default: ws://127.0.0.1:8787. Health and LAN address endpoints are available at /api/health and /api/info.

The current signaling server is a development prototype. Do not expose it to the public internet without TLS/WSS, authentication, rate limits, room expiry, origin controls, abuse protection, secure TURN configuration and a security review. Room codes are not a complete authentication system.

## Camera settings and background use

Camera features differ by model and driver. The browser interface only shows settings reported by the current media track. The current web prototype cannot guarantee sharing while the browser is backgrounded or the device is locked. Reliable Android background sharing requires a native foreground service, visible notification and explicit user permission.

## Windows build

The GitHub Actions workflow can build a Windows NSIS setup EXE on a tag or manual run. The desktop wrapper expects the root web build copied into desktop/app. Follow desktop/README.md for a local build. MSI and Microsoft Store packaging are separate milestones.

## Android and store releases

See android/README.md and docs/ROADMAP.md. An APK/AAB must be built from a native Android client, signed, tested on physical devices and reviewed. Store publication also requires developer accounts, privacy disclosures, signing material and store review; repository code alone does not publish an app.

## Privacy and safety

- No screen-capture API is used by the web prototype.
- Camera capture starts only after a user action and a permission prompt.
- A user should be able to see when sharing is active and stop it immediately.
- Only explicitly paired controllers should be allowed to request supported camera controls.
- Never commit API keys, signing keys, private certificates or TURN secrets.

## License

Apache-2.0 is the intended license; add the full license text before distributing builds.
