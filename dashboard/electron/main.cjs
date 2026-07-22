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
    let filePath = decodeMediaUrl(request.url);

    // Resolve relative path against PROJECT_ROOT
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(PROJECT_ROOT, filePath);
    }

    if (!fs.existsSync(filePath)) {
      return new Response('File not found', { status: 404 });
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return new Response('Not a file', { status: 400 });
    }

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

// ─── Content ID Helper ────────────────────────────────

function getOrGenerateContentId(mode = 'shortform') {
  const isLongform = mode === 'longform';
  const fileName = isLongform ? 'longform_mapping.json' : 'mapping.json';
  const mappingFile = path.join(PROJECT_ROOT, 'input', fileName);

  try {
    if (fs.existsSync(mappingFile)) {
      const data = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
      if (data.settings?.content_id) {
        return data.settings.content_id;
      }
    }
  } catch { }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const prefix = isLongform ? 'WV-FILM' : 'WV';
  const newId = `${prefix}-${dateStr}-${randStr}`;

  try {
    let mapping = {
      settings: {
        fps: 30,
        format: isLongform ? "16:9" : "9:16",
        fg_aspect: isLongform ? "16:9" : "4:5",
        bgm: "random",
        content_id: newId
      },
      timeline: []
    };
    if (fs.existsSync(mappingFile)) {
      mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
    }
    mapping.settings = mapping.settings || {};
    mapping.settings.content_id = newId;
    fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2), 'utf-8');
  } catch { }

  return newId;
}

ipcMain.handle('get-content-id', async (_event, mode) => {
  return getOrGenerateContentId(mode);
});

// ─── Upload & trim with FFmpeg ────────────────────────

ipcMain.handle('upload-source', async (_event, { filePath, start, end }) => {
  const contentId = getOrGenerateContentId();
  const ext = path.extname(filePath) || '.mp4';
  const shouldTrim = start > 0 || end > 0;
  const resourceType = shouldTrim ? 'video_trimmed' : 'video_source';
  const outputName = `${contentId}_${resourceType}${ext}`;
  const destPath = path.join(INPUT_ASSETS, outputName);

  if (!shouldTrim) {
    if (filePath !== destPath) {
      await fs.promises.copyFile(filePath, destPath);
    }
    const stat = await fs.promises.stat(destPath);
    return {
      id: contentId,
      name: outputName,
      size: stat.size,
      url: mediaUrl(destPath),
      filePath: destPath,
    };
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-i', filePath,
      '-ss', String(start),
      '-t', String(end - start),
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-preset', 'ultrafast',
      '-y',
      destPath,
    ];

    const ffmpeg = spawn(ffmpegPath, args);
    ffmpeg.stderr.on('data', (_d) => {});

    ffmpeg.on('close', (code) => {
      if (code !== 0) return reject(new Error(`FFmpeg exited with code ${code}`));
      const stat = fs.statSync(destPath);
      resolve({
        id: contentId,
        name: outputName,
        size: stat.size,
        url: mediaUrl(destPath),
        filePath: destPath,
      });
    });

    ffmpeg.on('error', (err) => reject(err));
  });
});

// ─── Alur Film Video Handlers ────────────────────────

const ALURFILM_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm');
const ALURFILM_CHUNKS_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'chunks');

if (!fs.existsSync(ALURFILM_DIR)) {
  fs.mkdirSync(ALURFILM_DIR, { recursive: true });
}
if (!fs.existsSync(ALURFILM_CHUNKS_DIR)) {
  fs.mkdirSync(ALURFILM_CHUNKS_DIR, { recursive: true });
}

ipcMain.handle('upload-alurfilm-source', async (_event, { filePath }) => {
  const contentId = getOrGenerateContentId('longform');
  const stat = await fs.promises.stat(filePath);
  const baseName = path.basename(filePath);

  return {
    id: contentId,
    name: baseName,
    size: stat.size,
    url: mediaUrl(filePath),
    filePath: filePath,
  };
});

ipcMain.handle('split-alurfilm-video', async (_event, { masterPath, startTime, endTime }) => {
  const contentId = getOrGenerateContentId('longform');
  const chunkDuration = 600; // Locked at 10 minutes (600 seconds)

  if (!fs.existsSync(ALURFILM_CHUNKS_DIR)) {
    fs.mkdirSync(ALURFILM_CHUNKS_DIR, { recursive: true });
  }

  function parseTimeToSeconds(val) {
    if (typeof val === 'number') return val;
    if (!val || typeof val !== 'string') return 0;
    const parts = val.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Number(val) || 0;
  }

  const startSec = parseTimeToSeconds(startTime);
  const endSec = parseTimeToSeconds(endTime);

  if (endSec <= startSec) {
    throw new Error('End time must be greater than start time');
  }

  const totalRangeSec = endSec - startSec;
  const numParts = Math.ceil(totalRangeSec / chunkDuration);
  const createdChunks = [];

  for (let i = 0; i < numParts; i++) {
    const partStartSec = startSec + (i * chunkDuration);
    const partDurationSec = Math.min(chunkDuration, endSec - partStartSec);
    const partNumStr = String(i + 1).padStart(2, '0');
    const outputName = `${contentId}_part_${partNumStr}.mp4`;
    const destPath = path.join(ALURFILM_CHUNKS_DIR, outputName);

    await new Promise((resolve, reject) => {
      const args = [
        '-ss', String(partStartSec),
        '-i', masterPath,
        '-t', String(partDurationSec),
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-y',
        destPath
      ];

      const ffmpeg = spawn(ffmpegPath, args);
      let stderr = '';
      ffmpeg.stderr.on('data', (d) => { stderr += d.toString(); });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          const fallbackArgs = [
            '-ss', String(partStartSec),
            '-i', masterPath,
            '-t', String(partDurationSec),
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'ultrafast',
            '-y',
            destPath
          ];
          const fallbackFfmpeg = spawn(ffmpegPath, fallbackArgs);
          fallbackFfmpeg.on('close', (fbCode) => {
            if (fbCode !== 0) return reject(new Error(`FFmpeg split failed code ${fbCode}`));
            resolve();
          });
        } else {
          resolve();
        }
      });
      ffmpeg.on('error', (err) => reject(err));
    });

    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      createdChunks.push({
        part: i + 1,
        name: outputName,
        size: stat.size,
        startSec: partStartSec,
        durationSec: partDurationSec,
        filePath: destPath,
        url: mediaUrl(destPath)
      });
    }
  }

  return createdChunks;
});

ipcMain.handle('list-alurfilm-chunks', async (_event, modeContentId) => {
  const contentId = modeContentId || getOrGenerateContentId('longform');
  if (!fs.existsSync(ALURFILM_CHUNKS_DIR)) return [];

  const files = fs.readdirSync(ALURFILM_CHUNKS_DIR);
  const chunks = files
    .filter(f => f.startsWith(contentId) && f.endsWith('.mp4'))
    .sort()
    .map((f, idx) => {
      const fullPath = path.join(ALURFILM_CHUNKS_DIR, f);
      const stat = fs.statSync(fullPath);
      return {
        part: idx + 1,
        name: f,
        size: stat.size,
        filePath: fullPath,
        url: mediaUrl(fullPath)
      };
    });

  return chunks;
});

ipcMain.handle('analyze-alurfilm-chunk', async (_event) => {
  throw new Error('Panggilan API 9router dinonaktifkan. Gunakan workflow manual Copy Prompt & Import Output JSON.');
});

ipcMain.handle('list-alurfilm-analyses', async (_event, modeContentId) => {
  const contentId = modeContentId || getOrGenerateContentId('longform');
  if (!fs.existsSync(ALURFILM_DIR)) return [];

  const files = fs.readdirSync(ALURFILM_DIR);
  const analyses = files
    .filter(f => f.startsWith(contentId) && f.includes('_analysis_part_') && f.endsWith('.json'))
    .sort()
    .map(f => {
      const fullPath = path.join(ALURFILM_DIR, f);
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        return {
          name: f,
          filePath: fullPath,
          data
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return analyses;
});

ipcMain.handle('get-alurfilm-prompt', async (_event, { chunkPart, totalChunks = 2, previousContext, styleExample }) => {
  const promptFile = path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'alurfilm-singlepass-prompt.md');
  let promptTemplate = '';
  if (fs.existsSync(promptFile)) {
    promptTemplate = fs.readFileSync(promptFile, 'utf-8');
  } else {
    promptTemplate = `Kamu adalah Master Scriptwriter Alur Film. Tulis naskah voiceover recap Macro Storytelling. Output JSON valid.`;
  }

  const totalTargetWords = 2400;
  const computedWordsPerChunk = Math.max(300, Math.round(totalTargetWords / Math.max(1, totalChunks)));

  const prevCtxStr = previousContext ? JSON.stringify(previousContext, null, 2) : 'Tidak ada (Chunk #1 / Awal Film)';
  const isFirstPart = Number(chunkPart) === 1;
  const isFirstPartStr = isFirstPart ? 'YA (Chunk #1 / Part Pembuka Film)' : `TIDAK (Chunk #${chunkPart} / Part Lanjutan)`;
  const styleExampleStr = styleExample ? String(styleExample) : 'Gunakan gaya penceritaan alur film santai, jernih, dan mengalir.';
  const fullPrompt = promptTemplate
    .replace(/{{chunk_part}}/g, String(chunkPart))
    .replace(/{{total_chunks}}/g, String(totalChunks))
    .replace(/{{is_first_part}}/g, isFirstPartStr)
    .replace(/{{target_words_per_chunk}}/g, String(computedWordsPerChunk))
    .replace(/{{previous_context}}/g, prevCtxStr)
    .replace(/{{style_example}}/g, styleExampleStr);

  return fullPrompt;
});

ipcMain.handle('save-alurfilm-analysis', async (_event, { chunkPart, jsonText }) => {
  const contentId = getOrGenerateContentId('longform');
  let raw = (jsonText || '').trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const resultData = JSON.parse(raw);
  const partStr = String(chunkPart).padStart(2, '0');
  const outputName = `${contentId}_analysis_part_${partStr}.json`;
  const destPath = path.join(ALURFILM_DIR, outputName);

  if (!fs.existsSync(ALURFILM_DIR)) {
    fs.mkdirSync(ALURFILM_DIR, { recursive: true });
  }

  fs.writeFileSync(destPath, JSON.stringify(resultData, null, 2), 'utf-8');

  return {
    part: chunkPart,
    name: outputName,
    filePath: destPath,
    data: resultData
  };
});

ipcMain.handle('upload-alurfilm-audio', async (_event, { part, filePath }) => {
  const contentId = getOrGenerateContentId('longform');
  if (!fs.existsSync(ALURFILM_DIR)) {
    fs.mkdirSync(ALURFILM_DIR, { recursive: true });
  }

  const ext = path.extname(filePath) || '.mp3';
  const partStr = String(part).padStart(2, '0');
  const outputName = `${contentId}_audio_part_${partStr}${ext}`;
  const destPath = path.join(ALURFILM_DIR, outputName);

  // Remove existing audio files for this part if any
  const existingFiles = fs.readdirSync(ALURFILM_DIR).filter(f => f.startsWith(`${contentId}_audio_part_${partStr}`));
  for (const f of existingFiles) {
    try { fs.unlinkSync(path.join(ALURFILM_DIR, f)); } catch {}
  }

  fs.copyFileSync(filePath, destPath);
  const stat = fs.statSync(destPath);

  return {
    part,
    name: outputName,
    filePath: destPath,
    url: mediaUrl(destPath),
    size: stat.size
  };
});

ipcMain.handle('list-alurfilm-audios', async (_event, modeContentId) => {
  const contentId = modeContentId || getOrGenerateContentId('longform');
  if (!fs.existsSync(ALURFILM_DIR)) return [];

  const files = fs.readdirSync(ALURFILM_DIR);
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
  const audios = files
    .filter(f => f.startsWith(`${contentId}_audio_part_`) && audioExtensions.includes(path.extname(f).toLowerCase()))
    .map(f => {
      const match = f.match(/_audio_part_(\d+)/);
      const part = match ? parseInt(match[1], 10) : 1;
      const fullPath = path.join(ALURFILM_DIR, f);
      const stat = fs.statSync(fullPath);
      return {
        part,
        name: f,
        filePath: fullPath,
        url: mediaUrl(fullPath),
        size: stat.size
      };
    })
    .sort((a, b) => a.part - b.part);

  return audios;
});

ipcMain.handle('delete-alurfilm-audio', async (_event, { part }) => {
  const contentId = getOrGenerateContentId('longform');
  if (!fs.existsSync(ALURFILM_DIR)) return true;

  const partStr = String(part).padStart(2, '0');
  const existingFiles = fs.readdirSync(ALURFILM_DIR).filter(f => f.startsWith(`${contentId}_audio_part_${partStr}`));
  for (const f of existingFiles) {
    try { fs.unlinkSync(path.join(ALURFILM_DIR, f)); } catch {}
  }

  return true;
});

ipcMain.handle('get-alurfilm-transcript-prompt', async (_event, { chunkPart, totalChunks = 2 }) => {
  const promptFile = path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'alurfilm-transcript-prompt.md');
  let promptTemplate = '';
  if (fs.existsSync(promptFile)) {
    promptTemplate = fs.readFileSync(promptFile, 'utf-8');
  } else {
    promptTemplate = `Kamu adalah AI Audio Transcriber presisi tinggi. Transkrip audio part ${chunkPart} ke JSON array dengan start_seconds, end_seconds, timestamp_minute, text.`;
  }

  const fullPrompt = promptTemplate
    .replace(/{{chunk_part}}/g, String(chunkPart))
    .replace(/{{total_chunks}}/g, String(totalChunks));

  return fullPrompt;
});

ipcMain.handle('save-alurfilm-transcript', async (_event, { chunkPart, jsonText }) => {
  const contentId = getOrGenerateContentId('longform');
  if (!fs.existsSync(ALURFILM_DIR)) {
    fs.mkdirSync(ALURFILM_DIR, { recursive: true });
  }

  let raw = (jsonText || '').trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const parsed = JSON.parse(raw);
  const partStr = String(chunkPart).padStart(2, '0');
  const outputName = `${contentId}_transcript_part_${partStr}.json`;
  const destPath = path.join(ALURFILM_DIR, outputName);

  fs.writeFileSync(destPath, JSON.stringify(parsed, null, 2), 'utf-8');

  return {
    part: chunkPart,
    name: outputName,
    filePath: destPath,
    data: parsed
  };
});

ipcMain.handle('list-alurfilm-transcripts', async (_event, modeContentId) => {
  const contentId = modeContentId || getOrGenerateContentId('longform');
  if (!fs.existsSync(ALURFILM_DIR)) return [];

  const files = fs.readdirSync(ALURFILM_DIR);
  const transcripts = files
    .filter(f => f.startsWith(`${contentId}_transcript_part_`) && f.endsWith('.json'))
    .map(f => {
      const match = f.match(/_transcript_part_(\d+)/);
      const part = match ? parseInt(match[1], 10) : 1;
      const fullPath = path.join(ALURFILM_DIR, f);
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        return {
          part,
          name: f,
          filePath: fullPath,
          data
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.part - b.part);

  return transcripts;
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
  const contentId = getOrGenerateContentId();
  const ext = path.extname(filePath) || '.mp3';
  const outputName = `${contentId}_audio_source${ext}`;
  const destPath = path.join(INPUT_ASSETS, outputName);

  fs.copyFileSync(filePath, destPath);
  const stat = fs.statSync(destPath);

  // Update input/state.json if available
  try {
    const stateFile = path.join(PROJECT_ROOT, 'input', 'state.json');
    if (fs.existsSync(stateFile)) {
      const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      stateData.resources = stateData.resources || {};
      stateData.resources.audio_source = `input/assets/${outputName}`;
      stateData.updated_at = new Date().toISOString();
      fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2), 'utf-8');
    }
  } catch (e) {
    console.warn('[upload-audio] Could not update state.json:', e.message);
  }

  return {
    name: outputName,
    size: stat.size,
    url: mediaUrl(destPath),
    filePath: destPath,
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
          filePath: fp,
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
          filePath: fp,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return files;
  } catch {
    return [];
  }
});

// ─── List rendered outputs ─────────────────────────────

ipcMain.handle('list-renders', async () => {
  const outputDir = path.join(PROJECT_ROOT, 'output');
  try {
    if (!fs.existsSync(outputDir)) return [];
    const files = fs.readdirSync(outputDir)
      .filter((f) => /\.(mp4|webm|mkv|mov)$/i.test(f))
      .map((f) => {
        const fp = path.join(outputDir, f);
        const stat = fs.statSync(fp);
        return {
          name: f,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
          filePath: path.join('output', f),
          fullPath: fp,
          url: mediaUrl(fp),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

// ─── Generate YouTube Shorts Titles via OpenAI API ───

ipcMain.handle('generate-youtube-titles', async (_event, transcriptText) => {
  const promptFile = path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'youtube-shorts-prompt.md');
  let promptTemplate = '';
  if (fs.existsSync(promptFile)) {
    promptTemplate = fs.readFileSync(promptFile, 'utf-8');
  } else {
    promptTemplate = `Kamu adalah YouTube Shorts Algorithm Expert. Buatkan 5 Judul Viral, Deskripsi, dan Hashtag untuk video recap ini: {{transcript_text}}. Output JSON: {"titles": [], "description": "", "hashtags": [], "recommended_title": ""}`;
  }

  const fullPrompt = promptTemplate.replace('{{transcript_text}}', transcriptText || 'Video Recap Anime/Cartoon');

  const response = await fetch('https://9router.riztama.my.id/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk-6b3ac6ef8e3b70c9-eyxuxt-7adfd291',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'cmc/deepseek/deepseek-v4-pro',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'user', content: fullPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content returned from AI API');

  let raw = content.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(raw);
});

// ─── Save file to project ─────────────────────────────

ipcMain.handle('save-to-project', async (_event, { subPath, data }) => {
  const dest = path.join(PROJECT_ROOT, subPath);
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dest, data, 'utf-8');

  // Auto-mirror transcript and analysis files to standardized asset filenames
  try {
    const contentId = getOrGenerateContentId();
    if (subPath === 'input/transcript.json') {
      const assetFileName = `${contentId}_transcript_result.json`;
      const assetFile = path.join(INPUT_ASSETS, assetFileName);
      fs.writeFileSync(assetFile, data, 'utf-8');

      const stateFile = path.join(PROJECT_ROOT, 'input', 'state.json');
      if (fs.existsSync(stateFile)) {
        const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        stateData.resources = stateData.resources || {};
        stateData.resources.transcript_result = `input/assets/${assetFileName}`;
        stateData.updated_at = new Date().toISOString();
        fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2), 'utf-8');
      }
    } else if (subPath === 'input/analysis.json') {
      const assetFileName = `${contentId}_analysis_result.json`;
      const assetFile = path.join(INPUT_ASSETS, assetFileName);
      fs.writeFileSync(assetFile, data, 'utf-8');

      const stateFile = path.join(PROJECT_ROOT, 'input', 'state.json');
      if (fs.existsSync(stateFile)) {
        const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        stateData.resources = stateData.resources || {};
        stateData.resources.analysis_result = `input/assets/${assetFileName}`;
        stateData.updated_at = new Date().toISOString();
        fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2), 'utf-8');
      }
    }
  } catch (e) {
    console.warn('[save-to-project] Auto-mirror error:', e.message);
  }

  return true;
});

// ─── Read file from project ───────────────────────────

ipcMain.handle('read-from-project', async (_event, subPath) => {
  const fp = path.join(PROJECT_ROOT, subPath);
  if (!fp.startsWith(PROJECT_ROOT)) throw new Error('Forbidden');
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp, 'utf-8');
});

// ─── Render video via FFmpeg CLI ──────────────────────

ipcMain.handle('render-video', async (_event, mapping, videoPath, audioPath) => {
  if (!mapping || !videoPath) {
    return { error: 'Missing mapping or video path.' };
  }

  // Resolve paths
  let resolvedVideo = path.isAbsolute(videoPath) ? videoPath : path.join(INPUT_ASSETS, videoPath);
  if (!fs.existsSync(resolvedVideo)) {
    resolvedVideo = path.resolve(videoPath);
  }
  if (!fs.existsSync(resolvedVideo)) {
    return { error: `Video not found: ${resolvedVideo}` };
  }

  let resolvedAudio = null;
  if (audioPath) {
    resolvedAudio = path.isAbsolute(audioPath) ? audioPath : path.join(INPUT_ASSETS, audioPath);
    if (!fs.existsSync(resolvedAudio)) {
      resolvedAudio = path.resolve(audioPath);
    }
    if (!fs.existsSync(resolvedAudio)) {
      console.warn(`⚠️  Audio not found: ${resolvedAudio}, rendering without`);
      resolvedAudio = null;
    }
  }

  // Fallback: auto-detect audio from assets
  if (!resolvedAudio) {
    try {
      const audioFiles = fs.readdirSync(INPUT_ASSETS).filter((f) =>
        /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f)
      );
      if (audioFiles.length > 0) {
        resolvedAudio = path.join(INPUT_ASSETS, audioFiles[0]);
      }
    } catch { }
  }

  // Write mapping to temp file for CLI
  const mappingFile = path.join(TMP_DIR, `mapping_${Date.now()}.json`);
  fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2), 'utf-8');

  const outputDir = path.join(PROJECT_ROOT, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputFileName = `render_${Date.now()}.mp4`;
  const outputPath = path.join(outputDir, outputFileName);

  return new Promise((resolve) => {
    const startTime = Date.now();

    const cliPath = path.join(PROJECT_ROOT, 'cli.ts');
    let cmd = `npx tsx "${cliPath}" render "${mappingFile}" --video "${resolvedVideo}"`;
    if (resolvedAudio) cmd += ` --audio "${resolvedAudio}"`;
    cmd += ` -o "${outputPath}"`;

    const child = spawn('bash', ['-c', cmd], {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
    });

    let fullStdout = '';
    let fullStderr = '';

    child.stdout.on('data', (d) => {
      fullStdout += d.toString();
      const lines = d.toString().trim().split('\n').filter(Boolean);
      for (const line of lines) {
        // CLI outputs progress with %: "   ✂️  Extracting: 5/20 clips (25%)   " or "   🎥 75% (12.3s / 45.0s)"
        const pctMatch = line.match(/(\d+)%/);
        if (pctMatch) {
          const pct = parseInt(pctMatch[1], 10) / 100;
          mainWindow.webContents.send('render-progress', {
            stage: 'render',
            progress: Math.min(0.99, pct),
            message: line.trim(),
          });
        } else {
          // Info/log line
          const trimmed = line.trim();
          if (trimmed) {
            mainWindow.webContents.send('render-progress', {
              stage: 'render',
              progress: 0.05,
              message: trimmed,
            });
          }
        }
      }
    });

    child.stderr.on('data', (d) => {
      fullStderr += d.toString();
    });

    child.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      // Cleanup mapping temp file
      try { fs.unlinkSync(mappingFile); } catch { }
      if (code === 0) {
        mainWindow.webContents.send('render-progress', {
          stage: 'done',
          progress: 1,
          message: `Done in ${elapsed}s`,
        });
        resolve({ outputPath, elapsed });
      } else {
        const errLines = fullStderr.split('\n').filter(Boolean).slice(-15).join('\n');
        const outLines = fullStdout.split('\n').filter(Boolean).slice(-10).join('\n');
        resolve({ error: `CLI exit code ${code}\n\nSTDERR:\n${errLines}\n\nSTDOUT:\n${outLines}` });
      }
    });

    child.on('error', (err) => {
      try { fs.unlinkSync(mappingFile); } catch { }
      resolve({ error: `Failed to launch render CLI: ${err.message}` });
    });
  });
});

// ─── Reset project workspace ───────────────────────────

ipcMain.handle('reset-project', async (_event, mode = 'shortform') => {
  const isLongform = mode === 'longform';
  try {
    const outputDir = path.join(PROJECT_ROOT, 'output');
    const inputDir = path.join(PROJECT_ROOT, 'input');
    const assetsDir = path.join(PROJECT_ROOT, 'input', 'assets');
    const tmpDir = path.join(PROJECT_ROOT, 'input', '.tmp');

    // Generate BRAND NEW Content ID for this mode
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = isLongform ? 'WV-FILM' : 'WV';
    const newId = `${prefix}-${dateStr}-${randStr}`;

    const mappingFileName = isLongform ? 'longform_mapping.json' : 'mapping.json';
    const mappingFile = path.join(inputDir, mappingFileName);
    const defaultMapping = {
      settings: {
        fps: 30,
        format: isLongform ? "16:9" : "9:16",
        fg_aspect: isLongform ? "16:9" : "4:5",
        bgm: "random",
        content_id: newId
      },
      timeline: []
    };
    fs.writeFileSync(mappingFile, JSON.stringify(defaultMapping, null, 2), 'utf-8');

    if (!isLongform) {
      // 1. Clear output directory
      if (fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir);
        for (const f of files) { try { fs.unlinkSync(path.join(outputDir, f)); } catch { } }
      }

      // 2. Clear input/assets directory
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        for (const f of files) { try { fs.unlinkSync(path.join(assetsDir, f)); } catch { } }
      }

      // 3. Clear input/.tmp directory
      if (fs.existsSync(tmpDir)) {
        const files = fs.readdirSync(tmpDir);
        for (const f of files) { try { fs.unlinkSync(path.join(tmpDir, f)); } catch { } }
      }

      // 4. Reset JSON files
      const transcriptFile = path.join(inputDir, 'transcript.json');
      fs.writeFileSync(transcriptFile, '[]', 'utf-8');

      const analysisFile = path.join(inputDir, 'analysis.json');
      if (fs.existsSync(analysisFile)) { try { fs.unlinkSync(analysisFile); } catch { } }

      const voiceoverFile = path.join(inputDir, 'voiceover.json');
      if (fs.existsSync(voiceoverFile)) { try { fs.unlinkSync(voiceoverFile); } catch { } }
    }

    return { success: true, content_id: newId };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
