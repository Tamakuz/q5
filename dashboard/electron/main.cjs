// dashboard/electron/main.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// ─── Shared utilities ───────────────────────────────────
const paths = require('./shared/paths.cjs');
const media = require('./shared/media.cjs');
const ffmpeg = require('./shared/ffmpeg.cjs');
const { loadPrompt } = require('./shared/promptLoader.cjs');

// ─── Services ───────────────────────────────────────────
const aiClient = require('./aiClient.cjs');

// ─── Window management ──────────────────────────────────
let mainWindow = null;

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Content Auto',
    backgroundColor: '#030712',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function getMainWindow() {
  return mainWindow;
}

app.whenReady().then(() => {
  media.registerMediaProtocol(require('electron').protocol);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── Shared context for IPC modules ─────────────────────
const shared = { paths, media, ffmpeg, aiClient, loadPrompt, getMainWindow };

// ─── Register all IPC handler groups ────────────────────
require('./ipc/fileHandlers.cjs').register(ipcMain, shared);
require('./ipc/alurfilmHandlers.cjs').register(ipcMain, shared);
require('./ipc/spensiaHandlers.cjs').register(ipcMain, shared);
require('./ipc/renderHandlers.cjs').register(ipcMain, shared);
require('./ipc/projectHandlers.cjs').register(ipcMain, shared);

// ─── Move aiClient.cjs → services/ ──────────────────────
// aiClient is at ./aiClient.cjs (legacy location). When
// ready, move it to ./services/aiClient.cjs and change
// the require above.
