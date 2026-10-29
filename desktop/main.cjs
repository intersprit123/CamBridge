const { app, BrowserWindow, shell, session } = require('electron');
const path = require('node:path');

let signalingServer;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: '#0d1017',
    title: 'CamBridge',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
  const mediaTypes = details && details.mediaTypes ? details.mediaTypes : [];
  const cameraOnly = permission === 'media' && mediaTypes.includes('video') && !mediaTypes.includes('audio');
  callback(Boolean(cameraOnly));
});

app.whenReady().then(() => {
  try {
    const backendPath = path.join(__dirname, 'app', 'backend', 'server.cjs');
    const backend = require(backendPath);
    signalingServer = backend.startServer(Number(process.env.CAMBRIDGE_PORT || 8787), path.join(__dirname, 'app'));
  } catch (error) {
    console.error('CamBridge local signaling service could not start:', error);
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => { if (signalingServer) signalingServer.close(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
