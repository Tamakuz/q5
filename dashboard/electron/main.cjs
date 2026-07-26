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

function getVideoMetaHelper(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve(null);
    }

    const stat = fs.statSync(filePath);
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
      if (code !== 0 || !stdout.trim()) {
        return resolve({
          duration: 0,
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

        resolve({
          duration: isNaN(duration) ? 0 : duration,
          width,
          height,
          name: path.basename(filePath),
          size: stat.size,
          url: mediaUrl(filePath),
        });
      } catch {
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

    ffprobe.on('error', () => {
      resolve(null);
    });
  });
}

ipcMain.handle('get-video-meta', async (_event, filePath) => {
  return getVideoMetaHelper(filePath);
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

async function splitAlurfilmVideoHelper(masterPath, startTime, endTime) {
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
}

ipcMain.handle('split-alurfilm-video', async (_event, opts) => {
  const masterPath = typeof opts === 'string' ? opts : opts?.masterPath;
  const startTime = opts?.startTime ?? 0;
  const endTime = opts?.endTime ?? 0;
  return splitAlurfilmVideoHelper(masterPath, startTime, endTime);
});

ipcMain.handle('split-alurfilm-master', async (_event, opts) => {
  const masterPath = typeof opts === 'string' ? opts : opts?.masterPath;
  const startTime = opts?.startTime ?? 0;
  let endTime = opts?.endTime ?? 0;

  const contentId = getOrGenerateContentId('longform');
  if (!endTime || endTime === '00:00:00' || endTime === 0) {
    try {
      const meta = await getVideoMetaHelper(masterPath);
      if (meta && meta.duration) endTime = meta.duration;
    } catch {}
  }

  const chunks = await splitAlurfilmVideoHelper(masterPath, startTime, endTime);

  return { chunks: chunks || [], content_id: contentId };
});

ipcMain.handle('split-alurfilm-master-range', async (_event, { masterPath, startSec, durationSec, partNum }) => {
  const contentId = getOrGenerateContentId('longform');
  const partStr = String(partNum).padStart(2, '0');
  const outputName = `${contentId}_part_${partStr}.mp4`;
  const destPath = path.join(ALURFILM_CHUNKS_DIR, outputName);

  if (!fs.existsSync(ALURFILM_CHUNKS_DIR)) {
    fs.mkdirSync(ALURFILM_CHUNKS_DIR, { recursive: true });
  }

  await new Promise((resolve, reject) => {
    const args = [
      '-ss', String(startSec),
      '-i', masterPath,
      '-t', String(durationSec),
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      '-y',
      destPath
    ];
    const ffmpeg = spawn(ffmpegPath, args);
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        const fallbackArgs = [
          '-ss', String(startSec),
          '-i', masterPath,
          '-t', String(durationSec),
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'ultrafast',
          '-y',
          destPath
        ];
        const fallbackFfmpeg = spawn(ffmpegPath, fallbackArgs);
        fallbackFfmpeg.on('close', () => resolve());
      } else {
        resolve();
      }
    });
    ffmpeg.on('error', (err) => reject(err));
  });

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
        url: mediaUrl(fullPath),
        mediaUrl: mediaUrl(fullPath)
      };
    });

  return { chunks: chunks || [], content_id: contentId };
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

ipcMain.handle('delete-alurfilm-chunk', async (_event, opts) => {
  const contentId = getOrGenerateContentId('longform');
  const part = typeof opts === 'object' ? opts.part : opts;
  if (!fs.existsSync(ALURFILM_CHUNKS_DIR)) return true;

  const files = fs.readdirSync(ALURFILM_CHUNKS_DIR);
  const partStr = String(part).padStart(2, '0');
  const targetFiles = files.filter(f => f.startsWith(`${contentId}_part_${partStr}.mp4`));

  for (const f of targetFiles) {
    try {
      fs.unlinkSync(path.join(ALURFILM_CHUNKS_DIR, f));
    } catch (e) {
      console.error('Failed to delete chunk:', e);
    }
  }
  return true;
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
  const possiblePaths = [
    path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'longform', 'script-prompt.md'),
    path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'longform', 'alurfilm-singlepass-prompt.md'),
    path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'alurfilm-singlepass-prompt.md')
  ];
  let promptFile = possiblePaths.find(p => fs.existsSync(p));
  let promptTemplate = '';
  if (promptFile && fs.existsSync(promptFile)) {
    promptTemplate = fs.readFileSync(promptFile, 'utf-8');
  } else {
    promptTemplate = `Kamu adalah Master Scriptwriter Alur Film. Tulis naskah voiceover recap Macro Storytelling. Output JSON valid.`;
  }

  const computedWordsPerChunk = 350;

  const prevCtxStr = previousContext ? JSON.stringify(previousContext, null, 2) : 'Tidak ada (Chunk #1 / Awal Film)';
  const isFirstPart = Number(chunkPart) === 1;
  const isLastPart = Number(chunkPart) === Number(totalChunks);
  const isFirstPartStr = isFirstPart ? 'YA (Chunk #1 / Part Pembuka Film)' : `TIDAK (Chunk #${chunkPart} / Part Lanjutan)`;
  const isLastPartStr = isLastPart ? 'YA (Chunk Terakhir / Part Penutup Film)' : `TIDAK (Part Bukan Penutup)`;
  const styleExampleStr = styleExample ? String(styleExample) : 'Gunakan gaya penceritaan alur film santai, jernih, dan mengalir.';
  const fullPrompt = promptTemplate
    .replace(/{{chunk_part}}/g, String(chunkPart))
    .replace(/{{total_chunks}}/g, String(totalChunks))
    .replace(/{{is_first_part}}/g, isFirstPartStr)
    .replace(/{{is_last_part}}/g, isLastPartStr)
    .replace(/{{target_words_per_chunk}}/g, String(computedWordsPerChunk))
    .replace(/{{previous_context}}/g, prevCtxStr)
    .replace(/{{style_example}}/g, styleExampleStr);

  return fullPrompt;
});

ipcMain.handle('save-alurfilm-analysis', async (_event, { chunkPart, jsonText }) => {
  const contentId = getOrGenerateContentId('longform');
  
  let resultData = null;
  if (typeof jsonText === 'string') {
    let raw = jsonText.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    try {
      resultData = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON syntax: ${err.message}`);
    }
  } else if (typeof jsonText === 'object' && jsonText !== null) {
    resultData = jsonText;
  } else {
    throw new Error(`Invalid JSON input: expected string or object, received ${typeof jsonText}`);
  }

  // Validate basic schema
  if (!resultData || typeof resultData !== 'object' || Array.isArray(resultData)) {
    throw new Error('Script Analysis Error: Root JSON output must be a valid JSON Object.');
  }

  if (!resultData.naskah_voiceover || typeof resultData.naskah_voiceover !== 'object') {
    throw new Error('Script Analysis Error: Missing "naskah_voiceover" object in JSON output.');
  }

  if (!resultData.naskah_voiceover.script_text || typeof resultData.naskah_voiceover.script_text !== 'string') {
    throw new Error('Script Analysis Error: Missing or invalid "naskah_voiceover.script_text" string.');
  }

  // Normalize part and calculate actual word count
  const partNum = Number(resultData.chunk_part || chunkPart) || 1;
  const words = resultData.naskah_voiceover.script_text.trim().split(/\s+/).filter(Boolean);
  resultData.naskah_voiceover.word_count = words.length;
  resultData.chunk_part = partNum;
  resultData.status = resultData.status || 'done';

  const partStr = String(partNum).padStart(2, '0');
  const outputName = `${contentId}_analysis_part_${partStr}.json`;
  const destPath = path.join(ALURFILM_DIR, outputName);

  if (!fs.existsSync(ALURFILM_DIR)) {
    fs.mkdirSync(ALURFILM_DIR, { recursive: true });
  }

  fs.writeFileSync(destPath, JSON.stringify(resultData, null, 2), 'utf-8');

  return {
    part: partNum,
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
  const contentId = getOrGenerateContentId('longform');
  const possiblePaths = [
    path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'longform', 'transcript-prompt.md'),
    path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'longform', 'alurfilm-transcript-prompt.md'),
    path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'alurfilm-transcript-prompt.md')
  ];
  let promptFile = possiblePaths.find(p => fs.existsSync(p));
  let promptTemplate = '';
  if (promptFile && fs.existsSync(promptFile)) {
    promptTemplate = fs.readFileSync(promptFile, 'utf-8');
  } else {
    promptTemplate = `Kamu adalah AI Audio Transcriber presisi tinggi. Transkrip audio part ${chunkPart} ke JSON array dengan start_seconds, end_seconds, timestamp_minute, text. Parameter durasi audio: {{audio_duration}}.`;
  }

  let audioDurationText = `[Sesuai total durasi file audio Part #${chunkPart}]`;
  if (fs.existsSync(ALURFILM_DIR)) {
    const partStr = String(chunkPart).padStart(2, '0');
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
    const files = fs.readdirSync(ALURFILM_DIR);
    const audioFile = files.find(f => f.startsWith(`${contentId}_audio_part_${partStr}`) && audioExtensions.includes(path.extname(f).toLowerCase()));
    if (audioFile) {
      const fullPath = path.join(ALURFILM_DIR, audioFile);
      try {
        const meta = await getVideoMetaHelper(fullPath);
        if (meta && meta.duration && meta.duration > 0) {
          const m = Math.floor(meta.duration / 60);
          const s = Math.floor(meta.duration % 60);
          const minStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          audioDurationText = `${meta.duration.toFixed(1)} Detik (${minStr})`;
        }
      } catch {}
    }
  }

  const fullPrompt = promptTemplate
    .replace(/{{chunk_part}}/g, String(chunkPart))
    .replace(/{{total_chunks}}/g, String(totalChunks))
    .replace(/{{audio_duration}}/g, audioDurationText);

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

ipcMain.handle('get-alurfilm-mapping-prompt', async (_event, { chunkPart, totalChunks = 2 }) => {
  const contentId = getOrGenerateContentId('longform');
  const partStr = String(chunkPart).padStart(2, '0');
  const possiblePaths = [
    path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'longform', 'mapping-prompt.md'),
    path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'longform', 'alurfilm-mapping-prompt.md'),
    path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'alurfilm-mapping-prompt.md')
  ];
  let promptFile = possiblePaths.find(p => fs.existsSync(p));

  let promptTemplate = '';
  if (promptFile && fs.existsSync(promptFile)) {
    promptTemplate = fs.readFileSync(promptFile, 'utf-8');
  } else {
    promptTemplate = `Kamu adalah Editor Video Spesialis FFmpeg Mapping. Output JSON murni.`;
  }

  // Load VO sentences from Step 3 Transcript (or fallback)
  let voSentences = [];
  const transcriptPath = path.join(ALURFILM_DIR, `${contentId}_transcript_part_${partStr}.json`);
  if (fs.existsSync(transcriptPath)) {
    try {
      const rawTranscript = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
      if (Array.isArray(rawTranscript)) {
        voSentences = rawTranscript.map((t, idx) => ({
          sentence_index: idx,
          text: t.text || t.narration || '',
          start: typeof t.start_seconds === 'number' ? t.start_seconds : 0.0,
          end: typeof t.end_seconds === 'number' ? t.end_seconds : 0.0,
          duration: Number(((typeof t.end_seconds === 'number' ? t.end_seconds : 0) - (typeof t.start_seconds === 'number' ? t.start_seconds : 0)).toFixed(2))
        }));
      }
    } catch {}
  }

  const chunkVideoName = `${contentId}_chunk_${partStr}.mp4`;
  const voSentencesJson = JSON.stringify(voSentences, null, 2);

  const fullPrompt = promptTemplate
    .replace(/{{chunk_part}}/g, String(chunkPart))
    .replace(/{{total_chunks}}/g, String(totalChunks))
    .replace(/{{voiceover_sentences}}/g, voSentencesJson)
    .replace(/{{source_video_name}}/g, chunkVideoName)
    .replace(/{{scene_id}}/g, `part_${partStr}`);

  return fullPrompt;
});

ipcMain.handle('save-alurfilm-mapping', async (_event, { chunkPart, jsonText }) => {
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
  const outputName = `${contentId}_mapping_part_${partStr}.json`;
  const destPath = path.join(ALURFILM_DIR, outputName);

  fs.writeFileSync(destPath, JSON.stringify(parsed, null, 2), 'utf-8');

  return {
    part: chunkPart,
    name: outputName,
    filePath: destPath,
    data: parsed
  };
});

ipcMain.handle('list-alurfilm-mappings', async (_event, modeContentId) => {
  const contentId = modeContentId || getOrGenerateContentId('longform');
  if (!fs.existsSync(ALURFILM_DIR)) return [];

  const files = fs.readdirSync(ALURFILM_DIR);
  const mappings = files
    .filter(f => f.startsWith(`${contentId}_mapping_part_`) && f.endsWith('.json'))
    .map(f => {
      const match = f.match(/_mapping_part_(\d+)/);
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

  return mappings;
});

ipcMain.handle('list-alurfilm-renders', async (_event, modeContentId) => {
  const contentId = modeContentId || getOrGenerateContentId('longform');
  const outputDir = path.join(PROJECT_ROOT, 'output');
  if (!fs.existsSync(outputDir)) return [];

  const files = fs.readdirSync(outputDir);
  const partMap = {};

  for (const f of files) {
    if (f.startsWith(`alurfilm_${contentId}_part_`) && f.endsWith('.mp4')) {
      const match = f.match(/_part_(\d+)_/);
      if (match) {
        const part = parseInt(match[1], 10);
        const fullPath = path.join(outputDir, f);
        try {
          const stat = fs.statSync(fullPath);
          if (!partMap[part] || stat.mtimeMs > partMap[part].mtimeMs) {
            partMap[part] = {
              part,
              name: f,
              filePath: fullPath,
              mediaUrl: mediaUrl(fullPath),
              mtimeMs: stat.mtimeMs,
              elapsed: 'Done'
            };
          }
        } catch {}
      }
    }
  }

  return Object.values(partMap).sort((a, b) => a.part - b.part);
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
  const possiblePaths = [
    path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'shortform', 'youtube-shorts-prompt.md'),
    path.join(PROJECT_ROOT, 'dashboard', 'prompts', 'youtube-shorts-prompt.md')
  ];
  let promptFile = possiblePaths.find(p => fs.existsSync(p));
  let promptTemplate = '';
  if (promptFile && fs.existsSync(promptFile)) {
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

  // Convert Alurfilm mapping format (scene_id + mappings) if present
  let renderMapping = mapping;
  if (mapping && mapping.mappings && Array.isArray(mapping.mappings)) {
    const timelineClips = [];
    let clipIdCounter = 1;

    for (const item of mapping.mappings) {
      if (item.visuals && Array.isArray(item.visuals)) {
        for (const vis of item.visuals) {
          const ss = vis.source_start_seconds !== undefined
            ? vis.source_start_seconds
            : (vis.source_timestamp_seconds !== undefined ? vis.source_timestamp_seconds : 0);

          timelineClips.push({
            id: clipIdCounter++,
            text: item.text || '',
            ss: ss,
            t: vis.duration || item.duration || 2.5,
            type: vis.type,
            slow_mo_factor: vis.slow_mo_factor,
            mirror_mode: vis.mirror_mode,
            zoom_speed: vis.zoom_speed,
            color_grading_shift: vis.color_grading_shift,
          });
        }
      } else {
        timelineClips.push({
          id: clipIdCounter++,
          text: item.text || '',
          ss: item.start || 0,
          t: item.duration || 2.5,
        });
      }
    }

    renderMapping = {
      settings: {
        fps: 30,
        format: "16:9",
        captions: false,
      },
      timeline: timelineClips,
    };
  }

  // Write mapping to temp file for CLI
  const mappingFile = path.join(TMP_DIR, `mapping_${Date.now()}.json`);
  fs.writeFileSync(mappingFile, JSON.stringify(renderMapping, null, 2), 'utf-8');

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

ipcMain.handle('list-project-assets', async () => {
  const assetsDir = path.join(PROJECT_ROOT, 'assets');
  if (!fs.existsSync(assetsDir)) return { logos: [], bgms: [] };

  const files = fs.readdirSync(assetsDir);
  const logos = files.filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i)).map(f => ({
    name: f,
    path: path.join(assetsDir, f),
    url: mediaUrl(path.join(assetsDir, f)),
  }));
  const bgms = files.filter(f => f.match(/\.(mp3|wav|m4a|aac|flac)$/i)).map(f => ({
    name: f,
    path: path.join(assetsDir, f),
    url: mediaUrl(path.join(assetsDir, f)),
  }));

  return { logos, bgms };
});

ipcMain.handle('concat-alurfilm-final-video', async (_event, { parts, bgmPath, bgmVolume, logoPath, logoOpacity, logoMargin, logoScale }) => {
  const contentId = getOrGenerateContentId('longform');
  const outputDir = path.join(PROJECT_ROOT, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const files = fs.readdirSync(outputDir);
  const partFiles = [];

  for (const p of parts) {
    const partStr = String(p).padStart(2, '0');
    const matches = files
      .filter((f) => f.startsWith(`alurfilm_${contentId}_part_${partStr}_`) && f.endsWith('.mp4'))
      .sort()
      .reverse();

    if (matches.length > 0) {
      partFiles.push(path.join(outputDir, matches[0]));
    }
  }

  if (partFiles.length === 0) {
    return { error: 'Belum ada video part yang dirender.' };
  }

  const finalOutputName = `WV-FILM-${contentId}-FULL-FINAL.mp4`;
  const finalOutputPath = path.join(outputDir, finalOutputName);

  const listFile = path.join(TMP_DIR, `concat_list_${Date.now()}.txt`);
  fs.writeFileSync(listFile, partFiles.map((f) => `file '${f}'`).join('\n'), 'utf-8');

  // Auto-detect logo if not provided
  let resolvedLogo = logoPath && fs.existsSync(logoPath) ? logoPath : null;
  if (!resolvedLogo) {
    const defaultLogo = path.join(PROJECT_ROOT, 'assets', 'logo.png');
    const transparentLogo = path.join(PROJECT_ROOT, 'assets', 'logo-transparent.png');
    if (fs.existsSync(defaultLogo)) resolvedLogo = defaultLogo;
    else if (fs.existsSync(transparentLogo)) resolvedLogo = transparentLogo;
  }

  // Auto-detect BGM if not provided
  let resolvedBgm = bgmPath && fs.existsSync(bgmPath) ? bgmPath : null;
  if (!resolvedBgm) {
    const assetsDir = path.join(PROJECT_ROOT, 'assets');
    if (fs.existsSync(assetsDir)) {
      const mp3s = fs.readdirSync(assetsDir).filter(f => f.toLowerCase().endsWith('.mp3'));
      const thomasNewman = mp3s.find(f => f.toLowerCase().includes('thomas newman'));
      if (thomasNewman) {
        resolvedBgm = path.join(assetsDir, thomasNewman);
      } else if (mp3s.length > 0) {
        resolvedBgm = path.join(assetsDir, mp3s[0]);
      }
    }
  }

  const vol = bgmVolume ?? 0.10;
  const opacity = logoOpacity ?? 0.6;
  const margin = logoMargin ?? 40;
  const scaleHeight = logoScale ?? 60;

  const args = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile, // Stream 0:v (video) and 0:a (voiceover)
  ];

  let streamIndex = 1;
  let bgmIndex = null;
  let logoIndex = null;

  if (resolvedBgm && fs.existsSync(resolvedBgm)) {
    console.log(`🎵 [Final Render] Injecting BGM: ${path.basename(resolvedBgm)} (Volume: ${vol})`);
    args.push('-i', resolvedBgm);
    bgmIndex = streamIndex++;
  }

  if (resolvedLogo && fs.existsSync(resolvedLogo)) {
    console.log(`🎨 [Final Render] Injecting Logo Watermark: ${path.basename(resolvedLogo)} (Opacity: ${opacity}, Scale: ${scaleHeight}px, Margin: ${margin}px)`);
    args.push('-i', resolvedLogo);
    logoIndex = streamIndex++;
  }

  const filterParts = [];
  let vMap = '0:v';
  let aMap = '0:a';

  // Video filter: overlay logo watermark at top-left
  if (logoIndex !== null) {
    filterParts.push(`[${logoIndex}:v]scale=-1:${scaleHeight},format=rgba,colorchannelmixer=aa=${opacity}[logo_alpha]`);
    filterParts.push(`[0:v][logo_alpha]overlay=${margin}:${margin}[vout]`);
    vMap = '[vout]';
  }

  // Audio filter: mix BGM underneath voiceover
  if (bgmIndex !== null) {
    filterParts.push(`[0:a]volume=1.0[vo]`);
    filterParts.push(`[${bgmIndex}:a]volume=${vol},aloop=loop=-1:size=2e+09[bgm]`);
    filterParts.push(`[vo][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
    aMap = '[aout]';
  }

  if (filterParts.length > 0) {
    args.push('-filter_complex', filterParts.join(';'));
  }

  args.push('-map', vMap);
  args.push('-map', aMap);

  if (logoIndex !== null) {
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p');
  } else {
    args.push('-c:v', 'copy');
  }

  args.push(
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    finalOutputPath
  );

  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, args, { cwd: PROJECT_ROOT });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      try { fs.unlinkSync(listFile); } catch {}
      if (code === 0) {
        resolve({
          filePath: finalOutputPath,
          fileName: finalOutputName,
          mediaUrl: mediaUrl(finalOutputPath),
        });
      } else {
        const lastErr = stderr.split('\n').filter(Boolean).slice(-10).join(' | ');
        resolve({ error: `FFmpeg final render exit ${code}: ${lastErr}` });
      }
    });
    child.on('error', (e) => resolve({ error: e.message }));
  });
});

ipcMain.handle('render-alurfilm-video', async (_event, { part, mapping, videoPath, audioPath, bgmPath, bgmVolume, logoPath, logoOpacity, logoMargin }) => {
  if (!mapping || !videoPath) {
    return { error: 'Missing Alurfilm mapping or video path.' };
  }

  const contentId = getOrGenerateContentId('longform');
  const partStr = String(part).padStart(2, '0');

  let resolvedVideo = path.isAbsolute(videoPath) ? videoPath : path.join(ALURFILM_CHUNKS_DIR, videoPath);
  if (!fs.existsSync(resolvedVideo)) {
    resolvedVideo = path.resolve(videoPath);
  }
  if (!fs.existsSync(resolvedVideo)) {
    return { error: `Alurfilm video chunk not found: ${resolvedVideo}` };
  }

  let resolvedAudio = null;
  if (audioPath) {
    resolvedAudio = path.isAbsolute(audioPath) ? audioPath : path.join(ALURFILM_DIR, audioPath);
    if (!fs.existsSync(resolvedAudio)) {
      resolvedAudio = path.resolve(audioPath);
    }
  }

  // Write mapping to temp file for render-alurfilm CLI
  const mappingFile = path.join(TMP_DIR, `alurfilm_mapping_part_${partStr}_${Date.now()}.json`);
  fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2), 'utf-8');

  const outputDir = path.join(PROJECT_ROOT, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputFileName = `alurfilm_${contentId}_part_${partStr}_${Date.now()}.mp4`;
  const outputPath = path.join(outputDir, outputFileName);

  return new Promise((resolve) => {
    const startTime = Date.now();
    const cliPath = path.join(PROJECT_ROOT, 'render-alurfilm.ts');

    let cmd = `npx tsx "${cliPath}" render "${mappingFile}" --video "${resolvedVideo}"`;
    if (resolvedAudio && fs.existsSync(resolvedAudio)) cmd += ` --audio "${resolvedAudio}"`;
    if (bgmPath && fs.existsSync(bgmPath)) cmd += ` --bgm "${bgmPath}"`;
    if (bgmVolume) cmd += ` --bgm-volume ${bgmVolume}`;
    if (logoPath && fs.existsSync(logoPath)) cmd += ` --logo "${logoPath}"`;
    if (logoOpacity) cmd += ` --logo-opacity ${logoOpacity}`;
    if (logoMargin) cmd += ` --logo-margin ${logoMargin}`;
    cmd += ` -o "${outputPath}"`;

    const child = spawn('bash', ['-c', cmd], {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
    });

    let fullStdout = '';
    let fullStderr = '';
    let currentProgress = 0.05;

    child.stdout.on('data', (d) => {
      const text = d.toString();
      fullStdout += text;

      const lines = text.split(/[\r\n]+/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const pctMatch = line.match(/(\d+)%/);
        if (pctMatch) {
          currentProgress = Math.min(0.99, parseInt(pctMatch[1], 10) / 100);
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('render-progress', {
            stage: 'render',
            progress: currentProgress,
            message: line,
          });
        }
      }
    });

    child.stderr.on('data', (d) => {
      const text = d.toString();
      fullStderr += text;

      const lines = text.split(/[\r\n]+/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('render-progress', {
            stage: 'render',
            progress: currentProgress,
            message: `[STDERR] ${line}`,
          });
        }
      }
    });

    child.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      try { fs.unlinkSync(mappingFile); } catch { }
      if (code === 0) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('render-progress', {
            stage: 'done',
            progress: 1,
            message: `🎉 [Alurfilm Engine] Render Part #${part} Done in ${elapsed}s`,
          });
        }
        resolve({ part, outputPath, elapsed, name: outputFileName, mediaUrl: mediaUrl(outputPath) });
      } else {
        const errLines = (fullStderr || fullStdout).split('\n').filter(Boolean).slice(-20).join('\n');
        const errMsg = `❌ [Alurfilm CLI Exit Code ${code}]\n${errLines}`;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('render-progress', {
            stage: 'error',
            progress: 0,
            message: errMsg,
          });
        }
        resolve({ error: errMsg });
      }
    });

    child.on('error', (err) => {
      try { fs.unlinkSync(mappingFile); } catch { }
      const errMsg = `❌ Failed to launch Alurfilm render CLI: ${err.message}`;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('render-progress', {
          stage: 'error',
          progress: 0,
          message: errMsg,
        });
      }
      resolve({ error: errMsg });
    });
  });
});

// ─── Reset project workspace ───────────────────────────

ipcMain.handle('reset-project', async (_event, mode = 'shortform') => {
  const isLongform = mode === 'longform';
  try {
    const outputDir = path.join(PROJECT_ROOT, 'output');
    const inputDir = path.join(PROJECT_ROOT, 'input');
    const alurfilmDir = path.join(PROJECT_ROOT, 'input', 'alurfilm');
    const alurfilmChunksDir = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'chunks');
    const assetsDir = path.join(PROJECT_ROOT, 'input', 'assets');
    const tmpDir = path.join(PROJECT_ROOT, 'input', '.tmp');

    // Generate BRAND NEW Content ID for this mode
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = isLongform ? 'WV-FILM' : 'WV';
    const newId = `${prefix}-${dateStr}-${randStr}`;

    if (isLongform) {
      console.log(`🧹 [Reset Longform] Clearing all longform files and setting new Content ID: ${newId}`);

      // 1. Clear input/alurfilm/chunks directory (cut video chunks)
      if (fs.existsSync(alurfilmChunksDir)) {
        const files = fs.readdirSync(alurfilmChunksDir);
        for (const f of files) {
          try { fs.unlinkSync(path.join(alurfilmChunksDir, f)); } catch { }
        }
      }

      // 2. Clear input/alurfilm directory (files only, preserve chunks subfolder)
      if (fs.existsSync(alurfilmDir)) {
        const files = fs.readdirSync(alurfilmDir);
        for (const f of files) {
          const fullPath = path.join(alurfilmDir, f);
          try {
            if (fs.statSync(fullPath).isFile()) {
              fs.unlinkSync(fullPath);
            }
          } catch { }
        }
      }

      // 3. Clear output directory (all rendered part MP4s and final MP4s)
      if (fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir);
        for (const f of files) {
          try { fs.unlinkSync(path.join(outputDir, f)); } catch { }
        }
      }

      // 4. Save new default longform mapping
      const mappingFile = path.join(inputDir, 'longform_mapping.json');
      const defaultMapping = {
        settings: {
          fps: 30,
          format: "16:9",
          fg_aspect: "16:9",
          bgm: "random",
          content_id: newId
        },
        timeline: []
      };
      fs.writeFileSync(mappingFile, JSON.stringify(defaultMapping, null, 2), 'utf-8');

      // 5. Store current content ID in alurfilm folder for auto-detection
      if (!fs.existsSync(alurfilmDir)) fs.mkdirSync(alurfilmDir, { recursive: true });
      fs.writeFileSync(path.join(alurfilmDir, '.current_content_id'), newId, 'utf-8');

    } else {
      console.log(`🧹 [Reset Shortform] Clearing all shortform files and setting new Content ID: ${newId}`);

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

      // 4. Reset JSON files & save default mapping
      const mappingFile = path.join(inputDir, 'mapping.json');
      const defaultMapping = {
        settings: {
          fps: 30,
          format: "9:16",
          fg_aspect: "4:5",
          bgm: "random",
          content_id: newId
        },
        timeline: []
      };
      fs.writeFileSync(mappingFile, JSON.stringify(defaultMapping, null, 2), 'utf-8');

      const transcriptFile = path.join(inputDir, 'transcript.json');
      fs.writeFileSync(transcriptFile, '[]', 'utf-8');

      const analysisFile = path.join(inputDir, 'analysis.json');
      if (fs.existsSync(analysisFile)) { try { fs.unlinkSync(analysisFile); } catch { } }

      const voiceoverFile = path.join(inputDir, 'voiceover.json');
      if (fs.existsSync(voiceoverFile)) { try { fs.unlinkSync(voiceoverFile); } catch { } }
    }

    return { success: true, content_id: newId };
  } catch (err) {
    console.error('Reset project error:', err);
    return { success: false, error: err.message };
  }
});
