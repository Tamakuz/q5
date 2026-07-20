// dashboard/electron/main.cjs
const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ─── FFmpeg / FFprobe paths ──────────────────────────
const ffmpegBin = require('@ffmpeg-installer/ffmpeg');
const ffprobeBin = require('@ffprobe-installer/ffprobe');
const ffmpegPath = ffmpegBin.path;
const ffprobePath = ffprobeBin.path;

// ─── Paths ────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const INPUT_ASSETS = path.join(PROJECT_ROOT, 'input', 'assets');
const TMP_DIR = path.join(PROJECT_ROOT, 'input', '.tmp');

// Ensure dirs exist
[INPUT_ASSETS, TMP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Register custom protocol for local files ─────────

const MEDIA_PROTOCOL = 'media';
const MEDIA_BASE = `${MEDIA_PROTOCOL}://content-auto/`;

function mediaUrl(filePath) {
  // Encode the absolute path as URL-safe
  const encoded = encodeURIComponent(filePath);
  return `${MEDIA_BASE}${encoded}`;
}

function decodeMediaUrl(url) {
  const encoded = url.replace(MEDIA_BASE, '');
  return decodeURIComponent(encoded);
}

// ─── Window ───────────────────────────────────────────

let mainWindow = null;

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
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  // Register custom protocol for serving local video files
  // Uses fs.createReadStream for proper range request support (needed by <video>)
  protocol.handle(MEDIA_PROTOCOL, (request) => {
    const filePath = decodeMediaUrl(request.url);

    // Security: prevent path traversal
    if (!path.isAbsolute(filePath) || !filePath.startsWith('/')) {
      return new Response('Invalid path', { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return new Response('File not found', { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const rangeHeader = request.headers.get('range');

    // No range request → serve entire file
    if (!rangeHeader) {
      const body = fs.createReadStream(filePath);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': mimeType(filePath),
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
        },
      });
    }

    // Handle range request (required for <video>/<audio> seeking/playback)
    const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!matches) {
      return new Response('Invalid range', { status: 416 });
    }

    const start = parseInt(matches[1], 10);
    const end = matches[2] ? parseInt(matches[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      return new Response('Range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const body = fs.createReadStream(filePath, { start, end });

    return new Response(body, {
      status: 206,
      headers: {
        'Content-Type': mimeType(filePath),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': String(chunkSize),
        'Accept-Ranges': 'bytes',
      },
    });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ══════════════════════════════════════════════════════
// IPC Handlers
// ══════════════════════════════════════════════════════

// ─── MIME helper ──────────────────────────────────────

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac',
  };
  return map[ext] || 'application/octet-stream';
}

// ─── Select file ──────────────────────────────────────

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Source Video',
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const stat = fs.statSync(filePath);

  return {
    name: path.basename(filePath),
    size: stat.size,
    path: filePath,
  };
});

// ─── Get video metadata via ffprobe ───────────────────

ipcMain.handle('get-video-meta', async (_event, filePath) => {
  return new Promise((resolve) => {
    console.log('[get-video-meta] filePath:', filePath);
    console.log('[get-video-meta] ffprobePath:', ffprobePath);

    if (!fs.existsSync(filePath)) {
      console.log('[get-video-meta] File does not exist');
      return resolve(null);
    }

    const stat = fs.statSync(filePath);
    console.log('[get-video-meta] File size:', stat.size);

    const args = [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    const ffprobe = spawn(ffprobePath, args);

    let stdout = '';
    let stderr = '';
    ffprobe.stdout.on('data', (d) => { stdout += d.toString(); });
    ffprobe.stderr.on('data', (d) => { stderr += d.toString(); });

    ffprobe.on('close', (code) => {
      console.log('[get-video-meta] Exit code:', code);
      if (stderr) console.log('[get-video-meta] stderr:', stderr.substring(0, 200));

      // Fallback: if ffprobe fails, return basic info so the flow doesn't break
      if (code !== 0 || !stdout.trim()) {
        console.log('[get-video-meta] ffprobe failed, using fallback');
        // Return what we have — let the video element figure out dimensions
        return resolve({
          duration: 0,       // unknown
          width: 0,
          height: 0,
          name: path.basename(filePath),
          size: stat.size,
          url: mediaUrl(filePath),
        });
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find((s) => s.codec_type === 'video');
        const duration = parseFloat(data.format?.duration ?? '0');
        const width = videoStream?.width ?? 0;
        const height = videoStream?.height ?? 0;

        console.log('[get-video-meta] Success:', { duration, width, height });

        resolve({
          duration: isNaN(duration) ? 0 : duration,
          width,
          height,
          name: path.basename(filePath),
          size: stat.size,
          url: mediaUrl(filePath),
        });
      } catch (e) {
        console.log('[get-video-meta] Parse error:', e.message);
        // Fallback
        resolve({
          duration: 0,
          width: 0,
          height: 0,
          name: path.basename(filePath),
          size: stat.size,
          url: mediaUrl(filePath),
        });
      }
    });

    ffprobe.on('error', (e) => {
      console.log('[get-video-meta] Spawn error:', e.message);
      resolve(null);
    });
  });
});

// ─── Upload & trim with FFmpeg ────────────────────────

ipcMain.handle('upload-source', async (_event, { filePath, start, end }) => {
  const baseName = path.basename(filePath);
  const shouldTrim = start > 0 || end > 0;

  if (!shouldTrim) {
    const destPath = path.join(INPUT_ASSETS, baseName);
    fs.copyFileSync(filePath, destPath);
    const stat = fs.statSync(destPath);
    return {
      name: baseName,
      size: stat.size,
      url: mediaUrl(destPath),
    };
  }

  return new Promise((resolve, reject) => {
    const outputName = `trimmed_${Date.now()}_${baseName.replace(/\s/g, '_')}`;
    const outputPath = path.join(INPUT_ASSETS, outputName);

    const args = [
      '-i', filePath,
      '-ss', String(start),
      '-t', String(end - start),
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-preset', 'ultrafast',
      '-y',
      outputPath,
    ];

    const ffmpeg = spawn(ffmpegPath, args);
    ffmpeg.stderr.on('data', (_d) => {});

    ffmpeg.on('close', (code) => {
      if (code !== 0) return reject(new Error(`FFmpeg exited with code ${code}`));
      const stat = fs.statSync(outputPath);
      resolve({
        name: outputName,
        size: stat.size,
        url: mediaUrl(outputPath),
      });
    });

    ffmpeg.on('error', (err) => reject(err));
  });
});

// ─── Select audio file ────────────────────────────────

ipcMain.handle('select-audio', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Voice Over Audio',
    filters: [
      { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const stat = fs.statSync(filePath);

  return {
    name: path.basename(filePath),
    size: stat.size,
    path: filePath,
  };
});

// ─── Upload audio ─────────────────────────────────────

ipcMain.handle('upload-audio', async (_event, { filePath }) => {
  const baseName = path.basename(filePath);
  const destPath = path.join(INPUT_ASSETS, baseName);
  fs.copyFileSync(filePath, destPath);
  const stat = fs.statSync(destPath);
  return {
    name: baseName,
    size: stat.size,
    url: mediaUrl(destPath),
  };
});

// ─── List audio files ─────────────────────────────────

ipcMain.handle('list-audio', async () => {
  try {
    const files = fs.readdirSync(INPUT_ASSETS)
      .filter((f) => /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f))
      .map((f) => {
        const fp = path.join(INPUT_ASSETS, f);
        const stat = fs.statSync(fp);
        return {
          name: f,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
          url: mediaUrl(fp),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return files;
  } catch {
    return [];
  }
});

// ─── List uploaded files ──────────────────────────────

ipcMain.handle('list-sources', async () => {
  try {
    const files = fs.readdirSync(INPUT_ASSETS)
      .filter((f) => /\.(mp4|mov|webm|mkv|avi)$/i.test(f))
      .map((f) => {
        const fp = path.join(INPUT_ASSETS, f);
        const stat = fs.statSync(fp);
        return {
          name: f,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
          url: mediaUrl(fp),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return files;
  } catch {
    return [];
  }
});

// ─── Delete source ────────────────────────────────────

ipcMain.handle('delete-source', async (_event, fileName) => {
  const fp = path.join(INPUT_ASSETS, fileName);
  if (!fp.startsWith(INPUT_ASSETS)) throw new Error('Forbidden');
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  return true;
});

// ─── Clipboard ─────────────────────────────────────────

ipcMain.handle('copy-to-clipboard', async (_event, text) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
  return true;
});

// ─── Save file to project ─────────────────────────────

ipcMain.handle('save-to-project', async (_event, { subPath, data }) => {
  const dest = path.join(PROJECT_ROOT, subPath);
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dest, data, 'utf-8');
  return true;
});

// ─── Read file from project ───────────────────────────

ipcMain.handle('read-from-project', async (_event, subPath) => {
  const fp = path.join(PROJECT_ROOT, subPath);
  if (!fp.startsWith(PROJECT_ROOT)) throw new Error('Forbidden');
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp, 'utf-8');
});
