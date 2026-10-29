# Windows desktop package

The Electron wrapper bundles the browser client. electron-builder is configured to create both a Windows NSIS setup executable and a Windows Installer MSI package.

## Build on Windows
1. Install Node.js 20 or newer.
2. From the repository root run npm install, then npm run build.
3. Copy the generated root dist folder into desktop/app (desktop/app/index.html must exist).
4. Run npm --prefix desktop install.
5. Run npm --prefix desktop run dist. Artifacts are written into desktop/release.

The GitHub Windows workflow uploads both installer formats as artifacts. These are unsigned preview builds until a publisher signing certificate is configured. Store-ready MSIX packaging, code signing, camera-driver testing and install/uninstall/upgrade verification are separate release tasks. The desktop client does not silently install a camera service.
