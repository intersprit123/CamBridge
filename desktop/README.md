# Windows desktop package

The Electron wrapper bundles the browser client and can create a Windows NSIS setup executable.

## Build on Windows
1. Install Node.js 20 or newer.
2. From the repository root run npm install, then npm run build.
3. Copy the generated root dist folder into desktop/app (desktop/app/index.html must exist).
4. Run npm --prefix desktop install.
5. Run npm --prefix desktop run dist. The installer is written into desktop/release.

The current wrapper produces a setup EXE, not an MSI. MSI packaging is a separate release task and should be added with a maintained Windows Installer/WiX pipeline after app signing and install/uninstall testing. The desktop client uses the configured signaling URL and does not silently install a camera service.
