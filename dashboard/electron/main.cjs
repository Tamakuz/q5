// dashboard/electron/main.cjs
const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');
const aiClient = require('./aiClient.cjs');
const { loadPrompt } = require('./prompts/promptLoader.cjs');

// ─── FFmpeg / FFprobe paths ──────────────────────────
const ffmpegBin = require('@ffmpeg-installer/ffmpeg');
const ffprobeBin = require('@ffprobe-installer/ffprobe');
const ffmpegPath = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : ffmpegBin.path;
const ffprobePath = fs.existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : ffprobeBin.path;

// ─── Paths ────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const INPUT_ASSETS = path.join(PROJECT_ROOT, 'input', 'assets');
const TMP_DIR = path.join(PROJECT_ROOT, 'input', '.tmp');
const SPENSIA_INPUT_DIR = path.join(PROJECT_ROOT, 'input', 'spensia');
const SPENSIA_OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'spensia');

// Ensure dirs exist
[INPUT_ASSETS, TMP_DIR, SPENSIA_INPUT_DIR, SPENSIA_OUTPUT_DIR].forEach((dir) => {
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
  const cleanUrl = url.split('?')[0];
  const encoded = cleanUrl.replace(MEDIA_BASE, '');
  return decodeURIComponent(encoded);
}

// ─── Window ───────────────────────────────────────────

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
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif',
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
  const isSpensia = mode === 'spensia';
  const mappingFile = isSpensia
    ? path.join(PROJECT_ROOT, 'input', 'spensia', 'spensia_mapping.json')
    : isLongform
      ? path.join(PROJECT_ROOT, 'input', 'longform_mapping.json')
      : path.join(PROJECT_ROOT, 'input', 'mapping.json');

  const dir = path.dirname(mappingFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

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
  const prefix = isSpensia ? 'WV-SPENSIA' : isLongform ? 'WV-FILM' : 'WV';
  const newId = `${prefix}-${dateStr}-${randStr}`;

  try {
    let mapping = {
      settings: {
        fps: 30,
        format: isSpensia ? "16:9" : isLongform ? "16:9" : "9:16",
        fg_aspect: isSpensia ? "16:9" : isLongform ? "16:9" : "4:5",
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
    ffmpeg.stderr.on('data', (_d) => { });

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
    } catch { }
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
    try { fs.unlinkSync(path.join(ALURFILM_DIR, f)); } catch { }
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
    try { fs.unlinkSync(path.join(ALURFILM_DIR, f)); } catch { }
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
      } catch { }
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
    } catch { }
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
        } catch { }
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

// ─── Generate YouTube Shorts Titles via AI ───

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
  return aiClient.generateYoutubeTitles({ fullPrompt });
});

// ─── Generate Spensia Topics & Script via Streaming AI ───

ipcMain.handle('generate-spensia-topics', async (event, { promptText, model }) => {
  return aiClient.generateSpensiaTopics({
    promptText,
    model,
    onChunk: (chunk, fullText) => {
      try {
        event.sender.send('spensia-topics-chunk', { chunk, fullText });
      } catch (err) { }
    },
  });
});

ipcMain.handle('generate-spensia-script', async (event, { promptText, model }) => {
  return aiClient.generateSpensiaScript({
    promptText,
    model,
    onChunk: (chunk, fullText) => {
      try {
        event.sender.send('spensia-script-chunk', { chunk, fullText });
      } catch (err) { }
    },
  });
});

ipcMain.handle('generate-spensia-breakdown', async (event, { promptText, model }) => {
  return aiClient.generateSpensiaBreakdown({
    promptText,
    model,
    onChunk: (chunk, fullText) => {
      try {
        event.sender.send('spensia-breakdown-chunk', { chunk, fullText });
      } catch (err) { }
    },
  });
});

ipcMain.handle('generate-spensia-image-prompts', async (event, { promptText, model }) => {
  return aiClient.generateSpensiaImagePrompts({
    promptText,
    model,
    onChunk: (chunk, fullText) => {
      try {
        event.sender.send('spensia-image-prompts-chunk', { chunk, fullText });
      } catch (err) { }
    },
  });
});

const SPENSIA_IMAGES_DIR = path.join(PROJECT_ROOT, 'input', 'spensia', 'images');
if (!fs.existsSync(SPENSIA_IMAGES_DIR)) fs.mkdirSync(SPENSIA_IMAGES_DIR, { recursive: true });

const tsxBinPath = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'tsx');

function spawnTsxProcess(cliArgs, options = {}) {
  if (fs.existsSync(tsxBinPath)) {
    return spawn(tsxBinPath, cliArgs, options);
  }
  return spawn('npx', ['--no-install', 'tsx', ...cliArgs], options);
}

async function persistSpensiaImageToDisk(segmentId, savedObj, topicId) {
  try {
    const topId = topicId || 1;
    const jsonPaths = [
      path.join(PROJECT_ROOT, 'input', 'spensia', 'images', `generated_images_topic_${topId}.json`),
    ];
    if (topId === 1) {
      jsonPaths.push(path.join(PROJECT_ROOT, 'input', 'spensia', 'generated_images.json'));
    }

    for (const jsonPath of jsonPaths) {
      let existingData = { total_images: 0, images: [] };
      if (fs.existsSync(jsonPath)) {
        try {
          const raw = fs.readFileSync(jsonPath, 'utf8');
          existingData = JSON.parse(raw);
        } catch (e) { }
      }

      if (!Array.isArray(existingData.images)) {
        existingData.images = [];
      }

      const idx = existingData.images.findIndex((img) => Number(img.segment_id) === Number(segmentId));
      if (idx >= 0) {
        existingData.images[idx] = {
          ...existingData.images[idx],
          status: 'success',
          url: savedObj.url,
          filePath: savedObj.filePath,
          error: undefined,
        };
      } else {
        existingData.images.push({
          segment_id: Number(segmentId),
          status: 'success',
          url: savedObj.url,
          filePath: savedObj.filePath,
        });
      }

      existingData.total_images = existingData.images.length;
      await fs.promises.mkdir(path.dirname(jsonPath), { recursive: true });
      await fs.promises.writeFile(jsonPath, JSON.stringify(existingData, null, 2), 'utf8');
    }
    console.log(`[main.cjs] Persisted generated image to JSON on disk for segment #${segmentId} (Topic #${topicId})`);
  } catch (err) {
    console.warn(`[main.cjs] Warning persisting image JSON for segment #${segmentId}:`, err.message);
  }
}

async function saveSpensiaImageFile(segmentId, res, topicId) {
  // CRITICAL: Ensure folder exists before writing to prevent ENOENT and wasted tokens!
  const targetDir = topicId
    ? path.join(PROJECT_ROOT, 'input', 'spensia', 'images', `topic_${topicId}`)
    : SPENSIA_IMAGES_DIR;
  await fs.promises.mkdir(targetDir, { recursive: true });

  const destPath = path.join(targetDir, `segment_${segmentId}.png`);
  let resultObj;

  if (res.b64_json) {
    const buffer = Buffer.from(res.b64_json, 'base64');
    await fs.promises.writeFile(destPath, buffer);
    resultObj = {
      segmentId,
      topicId: topicId || null,
      filePath: destPath,
      url: mediaUrl(destPath),
      originalUrl: null,
    };
  } else if (res.url) {
    let imgRes;
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        imgRes = await fetch(res.url);
        if (imgRes.ok) break;
        lastErr = new Error(`HTTP ${imgRes.status} ${imgRes.statusText}`);
      } catch (e) {
        lastErr = e;
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }

    if (imgRes && imgRes.ok) {
      const arrayBuffer = await imgRes.arrayBuffer();
      await fs.promises.writeFile(destPath, Buffer.from(arrayBuffer));
      resultObj = {
        segmentId,
        topicId: topicId || null,
        filePath: destPath,
        url: mediaUrl(destPath),
        originalUrl: res.url || null,
      };
    } else {
      console.warn(`[saveSpensiaImageFile] Failed to download image to local disk (${res.url}):`, lastErr?.message);
      // Fallback: Return remote URL so generated image is NOT lost after spending tokens
      resultObj = {
        segmentId,
        topicId: topicId || null,
        filePath: destPath,
        url: res.url,
        originalUrl: res.url,
      };
    }
  } else {
    resultObj = {
      segmentId,
      topicId: topicId || null,
      filePath: destPath,
      url: mediaUrl(destPath),
      originalUrl: null,
    };
  }

  await persistSpensiaImageToDisk(segmentId, resultObj, topicId);
  return resultObj;
}

/**
 * Helper: Calls Google Flow Playwright Service to generate an image & returns { url: fifeUrl }
 */
async function generateGoogleFlowImageDirect({ prompt, projectId, segmentId, workerId, onLog }) {
  const targetProject = projectId || process.env.GOOGLE_FLOW_PROJECT_ID || '5aec769c-e1c8-4741-a8db-99546809c8db';
  const cliPath = path.join(__dirname, '../../playwright/cli.ts');
  const projectRoot = path.join(__dirname, '../../');

  let lastErr = null;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Google Flow Service] (Attempt ${attempt}/${maxAttempts}) Generating image for prompt: "${(prompt || '').substring(0, 60)}..."`);
      if (onLog && segmentId) {
        onLog({ segmentId, workerId, text: attempt > 1 ? `🔄 Attempt #${attempt}: Connecting to Playwright...` : '🚀 Opening Chromium Browser...' });
      }

      const res = await new Promise((resolve, reject) => {


        const child = spawnTsxProcess([cliPath, 'generate-images', '-p', targetProject, '-t', prompt, '--headed', '--close', '--json'], {
          cwd: projectRoot,
          env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          const str = data.toString();
          stdout += str;

          if (onLog && segmentId) {
            if (str.includes('Launching browser')) {
              onLog({ segmentId, workerId, text: '🚀 Opening Chromium Browser...' });
            } else if (str.includes('Navigating to')) {
              onLog({ segmentId, workerId, text: '🌐 Connecting to Google Flow Project...' });
            } else if (str.includes('Typing prompt text')) {
              onLog({ segmentId, workerId, text: '✍️ Typing prompt into Slate.js editor...' });
            } else if (str.includes('Clicking Submit Arrow Button')) {
              onLog({ segmentId, workerId, text: '📩 Submitting prompt to Google AI...' });
            } else if (str.includes('Intercepted 200 OK')) {
              onLog({ segmentId, workerId, text: '🎉 Intercepted 200 OK Response!' });
            } else if (str.includes('Successfully extracted')) {
              onLog({ segmentId, workerId, text: '💾 Downloading Image to Harddisk...' });
            }
          }
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (code !== 0 && !stdout.trim()) {
            return reject(new Error(`Google Flow process failed (exit code ${code}): ${stderr || 'Unknown error'}`));
          }

          try {
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              return reject(new Error(`Failed to parse JSON output from Google Flow CLI. Raw output: ${stdout}`));
            }

            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.success || !parsed.images || parsed.images.length === 0) {
              return reject(new Error(parsed.error || 'Google Flow returned no generated images.'));
            }

            const imageUrl = parsed.images[0].url;
            if (!imageUrl) {
              return reject(new Error('Google Flow image URL (fifeUrl) is missing in response.'));
            }

            resolve({ url: imageUrl });
          } catch (err) {
            reject(new Error(`Failed parsing Google Flow response: ${err.message}`));
          }
        });
      });

      return res;
    } catch (err) {
      lastErr = err;
      console.warn(`[Google Flow Service] Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (onLog && segmentId) {
        onLog({ segmentId, workerId, text: `⚠️ Attempt #${attempt} warning: ${err.message}` });
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  throw lastErr;
}

ipcMain.handle('generate-spensia-single-image', async (event, { segmentId, prompt, model, size, quality, image_detail, topicId }) => {
  const res = await generateGoogleFlowImageDirect({
    prompt,
    segmentId,
    workerId: 1,
    onLog: (logData) => {
      try {
        event.sender.send('spensia-image-log', logData);
      } catch { }
    },
  });
  return saveSpensiaImageFile(segmentId, res, topicId);
});

ipcMain.handle('generate-spensia-batch-images', async (event, { items, model, size, quality, image_detail, topicId, concurrency }) => {
  const results = [];
  const total = items.length;
  let completedCount = 0;

  const targetProject = process.env.GOOGLE_FLOW_PROJECT_ID || '5aec769c-e1c8-4741-a8db-99546809c8db';
  const cliPath = path.join(__dirname, '../../playwright/cli.ts');
  const projectRoot = path.join(__dirname, '../../');

  console.log(`[main.cjs] Starting SINGLE-BROWSER rapid queue injection for ${total} items in topic ${topicId || 'default'}...`);

  // Emit immediate chunk start for initial concurrency batch items (e.g. 5 items)
  try {
    const conc = concurrency || 5;
    const initialBatch = items.slice(0, conc).map((i) => i.segment_id);
    event.sender.send('spensia-image-chunk-start', {
      segmentIds: initialBatch,
      topicId: topicId || null,
    });
  } catch { }

  await new Promise((resolve) => {
    const itemsJsonStr = JSON.stringify(items.map((i) => ({ segment_id: i.segment_id, prompt: i.prompt })));
    const child = spawnTsxProcess([cliPath, 'batch-runner', '-p', targetProject, '-j', itemsJsonStr, '--headed'], {
      cwd: projectRoot,
      env: { ...process.env },
    });

    let buffer = '';

    child.stdout.on('data', (data) => {
      const str = data.toString();
      buffer += str;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep last incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.includes('[ITEM_START]')) {
          const segId = Number(line.split('[ITEM_START]')[1].trim());
          try {
            event.sender.send('spensia-image-chunk-start', {
              segmentIds: [segId],
              topicId: topicId || null,
            });
          } catch { }
        } else if (line.includes('[ITEM_LOG]')) {
          const parts = line.split('[ITEM_LOG]')[1].split('|');
          const segId = Number(parts[0].trim());
          const text = parts.slice(1).join('|').trim();
          try {
            event.sender.send('spensia-image-log', { segmentId: segId, workerId: 1, text });
          } catch { }
        } else if (line.includes('[ITEM_SUCCESS]')) {
          const parts = line.split('[ITEM_SUCCESS]')[1].split('|');
          const segId = Number(parts[0].trim());
          const jsonStr = parts.slice(1).join('|').trim();
          try {
            const imgObj = JSON.parse(jsonStr);
            saveSpensiaImageFile(segId, imgObj, topicId).then((saved) => {
              completedCount++;
              const resultObj = { ...saved, status: 'success', topicId: topicId || null };
              results.push(resultObj);
              event.sender.send('spensia-image-progress', {
                current: completedCount,
                total,
                segmentId: segId,
                topicId: topicId || null,
                saved,
                status: 'success',
              });
            });
          } catch (e) {
            console.warn('[main.cjs] Error parsing ITEM_SUCCESS JSON:', e);
          }
        } else if (line.includes('[ITEM_ERROR]')) {
          const parts = line.split('[ITEM_ERROR]')[1].split('|');
          const segId = Number(parts[0].trim());
          const errorMsg = parts.slice(1).join('|').trim();
          completedCount++;
          const resultObj = { segmentId: segId, topicId: topicId || null, error: errorMsg, status: 'error' };
          results.push(resultObj);
          try {
            event.sender.send('spensia-image-progress', {
              current: completedCount,
              total,
              segmentId: segId,
              topicId: topicId || null,
              error: errorMsg,
              status: 'error',
            });
          } catch { }
        }
      }
    });

    child.stderr.on('data', (data) => {
      console.warn('[batch-runner stderr]', data.toString());
    });

    child.on('close', () => {
      resolve();
    });
  });

  return results;
});

// ─── Spensia Thumbnail Studio ─────────────────────────

const SPENSIA_THUMBNAILS_DIR = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails');
if (!fs.existsSync(SPENSIA_THUMBNAILS_DIR)) fs.mkdirSync(SPENSIA_THUMBNAILS_DIR, { recursive: true });

ipcMain.handle('generate-spensia-thumbnail-prompts', async (event, { scriptContent, topicTitle, selectedTitle, metadata, model, topicId }) => {
  const topId = topicId || 1;
  let contextText = scriptContent || '';
  if (!contextText) {
    const scriptPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'scripts', `full_script_topic_${topId}.txt`);
    if (fs.existsSync(scriptPath)) {
      contextText = fs.readFileSync(scriptPath, 'utf-8');
    } else {
      const fallbackPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'full_script.txt');
      if (fs.existsSync(fallbackPath)) contextText = fs.readFileSync(fallbackPath, 'utf-8');
    }
  }

  // Load decided upload metadata if not explicitly provided
  let activeMetadata = metadata;
  if (!activeMetadata) {
    const metaPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'metadata', `upload_metadata_topic_${topId}.json`);
    if (fs.existsSync(metaPath)) {
      try {
        activeMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch {}
    }
  }

  const systemPrompt = loadPrompt('thumbnail_prompts_system.txt');

  const decidedTitle = selectedTitle || activeMetadata?.analysis?.superior_title || activeMetadata?.recommended_title || topicTitle || 'Fakta Spensia';
  
  const prompt = `JUDUL UTAMA VIDEO TERPILIH & SUDAH DIANALISA (TARGET UTAMA VISUAL & TEKS):
"${decidedTitle}"

METADATA LENGKAP HASIL KEPUTUSAN ANALISIS AI:
- Superior Title: ${activeMetadata?.analysis?.superior_title || decidedTitle}
- Alasan Keunggulan: ${activeMetadata?.analysis?.superior_reason || 'Kuriositas tinggi penonton Indonesia.'}
- Analisis Psikologis: ${activeMetadata?.analysis?.psychological_analysis || 'Memicu curiosity gap kognitif.'}
- Dampak Doom Scrolling: ${activeMetadata?.analysis?.doom_scroll_impact || 'Thumb-stopping effect <0.5 detik.'}
- Hook Deskripsi: ${activeMetadata?.description ? activeMetadata.description.slice(0, 200) + '...' : ''}
- Top Tags: ${activeMetadata?.tags ? activeMetadata.tags.slice(0, 10).join(', ') : ''}

Naskah / Detail Konten Video:
${contextText || 'Fakta unik dan kontraintuitif tentang kehidupan purba vs modern.'}

INSTRUKSI UTAMA:
Hasilkan 3 konsep thumbnail visual (beserta prompt bahasa Inggris untuk image generator) yang 100% selaras dengan JUDUL TERPILIH DI ATAS ("${decidedTitle}"). Terapkan 4 Core Triggers (Kontras, Emosi Ekstrem, Hal Aneh, Pemicu Curiosity) dan 4 Pola Visual dari Blueprint Mentor!`;

  const rawJson = await aiClient.streamChatCompletion({
    systemPrompt,
    prompt,
    model: model || 'ag/gemini-3-flash-agent',
    jsonMode: true,
    temperature: 0.8,
    onChunk: (chunk, fullText) => {
      try {
        event.sender.send('spensia-thumbnail-prompts-chunk', { chunk, fullText });
      } catch { }
    },
  });

  const cleanJsonStr = aiClient.extractCleanJsonObject(rawJson);
  const parsed = JSON.parse(cleanJsonStr);
  const savePath = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_prompts_topic_${topId}.json`);
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(savePath, JSON.stringify(parsed, null, 2), 'utf-8');

  return parsed;
});

ipcMain.handle('generate-spensia-thumbnail-images', async (event, { concepts, model, size = '1280x720', topicId }) => {
  if (!Array.isArray(concepts) || concepts.length === 0) {
    throw new Error('Concepts list is empty.');
  }

  const topId = topicId || 1;
  const targetThumbDir = path.join(SPENSIA_THUMBNAILS_DIR, `topic_${topId}`);
  
  // Clean up previous files for this topic only
  if (fs.existsSync(targetThumbDir)) {
    try {
      const files = fs.readdirSync(targetThumbDir);
      for (const file of files) {
        fs.unlinkSync(path.join(targetThumbDir, file));
      }
    } catch { }
  } else {
    fs.mkdirSync(targetThumbDir, { recursive: true });
  }

  const prevFiles = [
    path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnails_rendered_topic_${topId}.json`),
    path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_selected_topic_${topId}.json`),
    path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_topic_${topId}.png`),
  ];
  for (const fp of prevFiles) {
    if (fs.existsSync(fp)) {
      try { fs.unlinkSync(fp); } catch { }
    }
  }

  const results = [];
  const total = concepts.length;
  let completedCount = 0;

  const targetProject = process.env.GOOGLE_FLOW_PROJECT_ID || '5aec769c-e1c8-4741-a8db-99546809c8db';
  const cliPath = path.join(__dirname, '../../playwright/cli.ts');
  const projectRoot = path.join(__dirname, '../../');

  console.log(`[main.cjs] Starting SINGLE-BROWSER rapid queue injection for ${total} thumbnails in topic ${topId}...`);

  const batchItems = concepts.map((c, idx) => ({
    segment_id: c.id || (idx + 1),
    prompt: c.prompt,
  }));

  await new Promise((resolve) => {
    const itemsJsonStr = JSON.stringify(batchItems);
    const child = spawnTsxProcess([cliPath, 'batch-runner', '-p', targetProject, '-j', itemsJsonStr, '--headed'], {
      cwd: projectRoot,
      env: { ...process.env },
    });

    let buffer = '';

    child.stdout.on('data', async (data) => {
      const str = data.toString();
      buffer += str;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep last incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.includes('[ITEM_START]')) {
          const segId = Number(line.split('[ITEM_START]')[1].trim());
          const conceptObj = concepts.find((c, idx) => (c.id || (idx + 1)) === segId) || {};
          try {
            event.sender.send('spensia-thumbnail-image-progress', {
              current: results.length + 1,
              total,
              conceptId: segId,
              title: conceptObj.title || `Thumbnail #${segId}`,
              message: `🎨 Generating Thumbnail ${results.length + 1}/${total} ("${conceptObj.title || segId}")...`,
              status: 'generating',
            });
          } catch { }
        } else if (line.includes('[ITEM_SUCCESS]')) {
          const parts = line.split('[ITEM_SUCCESS]')[1].split('|');
          const segId = Number(parts[0].trim());
          const jsonStr = parts.slice(1).join('|').trim();
          const conceptObj = concepts.find((c, idx) => (c.id || (idx + 1)) === segId) || {};
          const destPath = path.join(targetThumbDir, `thumbnail_${segId}.png`);

          try {
            const res = JSON.parse(jsonStr);
            let localUrl = null;

            if (res.b64_json) {
              fs.writeFileSync(destPath, Buffer.from(res.b64_json, 'base64'));
              localUrl = `${mediaUrl(destPath)}?t=${Date.now()}`;
            } else if (res.url) {
              try {
                const imgRes = await fetch(res.url);
                if (imgRes.ok) {
                  const ab = await imgRes.arrayBuffer();
                  fs.writeFileSync(destPath, Buffer.from(ab));
                }
              } catch (e) {
                console.warn('[main.cjs] Failed to fetch thumbnail image:', e);
              }
              localUrl = `${mediaUrl(destPath)}?t=${Date.now()}`;
            }

            completedCount++;
            const item = {
              id: segId,
              title: conceptObj.title || `Thumbnail #${segId}`,
              text_overlay: conceptObj.text_overlay,
              badge_text: conceptObj.badge_text,
              viral_score: conceptObj.viral_score,
              viral_reason: conceptObj.viral_reason,
              prompt: conceptObj.prompt,
              filePath: destPath,
              url: localUrl || `${mediaUrl(destPath)}?t=${Date.now()}`,
              generatedAt: new Date().toISOString(),
            };
            results.push(item);

            event.sender.send('spensia-thumbnail-image-progress', {
              current: completedCount,
              total,
              conceptId: segId,
              title: item.title,
              item,
              message: `✓ Thumbnail ${completedCount}/${total} ("${item.title}") selesai di-render!`,
              status: 'success',
            });
          } catch (e) {
            console.warn('[main.cjs] Error parsing thumbnail ITEM_SUCCESS JSON:', e);
          }
        } else if (line.includes('[ITEM_ERROR]')) {
          const parts = line.split('[ITEM_ERROR]')[1].split('|');
          const segId = Number(parts[0].trim());
          const errorMsg = parts.slice(1).join('|').trim();
          const conceptObj = concepts.find((c, idx) => (c.id || (idx + 1)) === segId) || {};
          completedCount++;
          const errItem = {
            id: segId,
            title: conceptObj.title || `Thumbnail #${segId}`,
            text_overlay: conceptObj.text_overlay,
            badge_text: conceptObj.badge_text,
            viral_score: conceptObj.viral_score,
            viral_reason: conceptObj.viral_reason,
            prompt: conceptObj.prompt,
            error: errorMsg,
          };
          results.push(errItem);
          try {
            event.sender.send('spensia-thumbnail-image-progress', {
              current: completedCount,
              total,
              conceptId: segId,
              title: errItem.title,
              error: errorMsg,
              message: `❌ Thumbnail ${completedCount}/${total} error: ${errorMsg}`,
              status: 'error',
            });
          } catch { }
        }
      }
    });

    child.stderr.on('data', (data) => {
      console.warn('[thumbnail batch-runner stderr]', data.toString());
    });

    child.on('close', () => {
      resolve();
    });
  });

  const savePath = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnails_rendered_topic_${topId}.json`);
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(savePath, JSON.stringify(results, null, 2), 'utf-8');

  return results;
});

ipcMain.handle('analyze-spensia-thumbnail-images', async (event, { topicTitle, selectedTitle, thumbnails, model, topicId }) => {
  const topId = topicId || 1;
  const targetThumbDir = path.join(SPENSIA_THUMBNAILS_DIR, `topic_${topId}`);

  const images = [];
  let sharp = null;
  try {
    sharp = require('sharp');
  } catch { }

  if (Array.isArray(thumbnails)) {
    for (const thumb of thumbnails) {
      const conceptId = thumb.id;
      let fp = thumb.filePath;
      if (!fp || !fs.existsSync(fp)) {
        fp = path.join(targetThumbDir, `thumbnail_${conceptId}.png`);
      }
      if (fs.existsSync(fp)) {
        let buf = fs.readFileSync(fp);
        if (sharp) {
          try {
            buf = await sharp(fp).resize(640, 360, { fit: 'inside' }).jpeg({ quality: 75 }).toBuffer();
          } catch { }
        }
        const b64 = buf.toString('base64');
        images.push(`data:image/jpeg;base64,${b64}`);
      }
    }
  }

  if (images.length === 0) {
    throw new Error('Tidak ada file gambar thumbnail PNG yang dapat ditemukan untuk dianalisis oleh AI Vision.');
  }

  const systemPrompt = loadPrompt('analyze_thumbnails_vision_system.txt');

  const prompt = `Target Video Title: "${selectedTitle || topicTitle || 'Fakta Spensia'}"

Attached Files: ${images.length} rendered thumbnails (Thumbnail #1, Thumbnail #2, Thumbnail #3).

Perform a ruthless human eye-tracking & thumb-stopping behavioral audit of these attached images for an Indonesian mobile viewer scrolling YouTube home feed in <0.5 seconds. Pick the winner_id (1, 2, or 3) and provide detailed objective evaluations.`;

  const rawJson = await aiClient.visionChatCompletion({
    systemPrompt,
    prompt,
    images,
    model: model || 'ag/gemini-3-flash-agent',
    jsonMode: true,
    temperature: 0.7,
  });

  const cleanJsonStr = aiClient.extractCleanJsonObject(rawJson);
  const analysisResult = JSON.parse(cleanJsonStr);

  const savePath = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnails_vision_analysis_topic_${topId}.json`);
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(savePath, JSON.stringify(analysisResult, null, 2), 'utf-8');

  if (analysisResult?.winner_id && Array.isArray(thumbnails)) {
    const winnerThumb = thumbnails.find((t) => t.id === analysisResult.winner_id);
    if (winnerThumb) {
      const selPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_selected_topic_${topId}.json`);
      fs.writeFileSync(selPath, JSON.stringify({ selectedId: winnerThumb.id, concept: winnerThumb, topicId: topId }, null, 2), 'utf-8');
    }
  }

  return analysisResult;
});

ipcMain.handle('get-spensia-thumbnails', async (_event, args) => {
  const topicId = (typeof args === 'number' ? args : args?.topicId) || 1;
  const savePath = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnails_rendered_topic_${topicId}.json`);
  const promptsPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_prompts_topic_${topicId}.json`);

  let finalSavePath = savePath;
  let finalPromptsPath = promptsPath;
  if (topicId === 1 && !fs.existsSync(savePath)) {
    const legacySave = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails_rendered.json');
    if (fs.existsSync(legacySave)) finalSavePath = legacySave;
  }
  if (topicId === 1 && !fs.existsSync(promptsPath)) {
    const legacyPrompts = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnail_prompts.json');
    if (fs.existsSync(legacyPrompts)) finalPromptsPath = legacyPrompts;
  }

  let concepts = [];
  if (fs.existsSync(finalPromptsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(finalPromptsPath, 'utf-8'));
      concepts = data.concepts || [];
    } catch { }
  }

  let rendered = [];
  if (fs.existsSync(finalSavePath)) {
    try {
      rendered = JSON.parse(fs.readFileSync(finalSavePath, 'utf-8'));
      rendered = rendered.map((r) => {
        if (r.filePath && fs.existsSync(r.filePath)) {
          return { ...r, url: `${mediaUrl(r.filePath)}?t=${Date.now()}` };
        }
        return r;
      });
    } catch { }
  }

  let selected = null;
  const selPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_selected_topic_${topicId}.json`);
  let finalSelPath = selPath;
  if (topicId === 1 && !fs.existsSync(selPath)) {
    const legacySel = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnail_selected.json');
    if (fs.existsSync(legacySel)) finalSelPath = legacySel;
  }

  if (fs.existsSync(finalSelPath)) {
    try {
      selected = JSON.parse(fs.readFileSync(finalSelPath, 'utf-8'));
    } catch { }
  }

  return { concepts, rendered, selected };
});

ipcMain.handle('save-spensia-thumbnail-selection', async (_event, { selectedId, concept, topicId }) => {
  const topId = topicId || 1;
  const selPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_selected_topic_${topId}.json`);
  const sdir = path.dirname(selPath);
  if (!fs.existsSync(sdir)) fs.mkdirSync(sdir, { recursive: true });

  const data = { selectedId, concept, updatedAt: new Date().toISOString() };
  fs.writeFileSync(selPath, JSON.stringify(data, null, 2), 'utf-8');

  // Copy selected thumbnail as main thumbnail_topic_${topicId}.png
  if (concept?.filePath && fs.existsSync(concept.filePath)) {
    const mainThumbPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_topic_${topId}.png`);
    const tdir = path.dirname(mainThumbPath);
    if (!fs.existsSync(tdir)) fs.mkdirSync(tdir, { recursive: true });
    try { fs.copyFileSync(concept.filePath, mainThumbPath); } catch { }
  }

  return data;
});

// ─── Spensia Upload Materials Generator (SEO Titles, Description, Tags) ───

ipcMain.handle('generate-spensia-upload-metadata', async (event, { scriptContent, topicTitle, model, topicId }) => {
  const topId = topicId || 1;
  let contextText = scriptContent || '';
  if (!contextText) {
    const scriptPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'scripts', `full_script_topic_${topId}.txt`);
    if (fs.existsSync(scriptPath)) {
      contextText = fs.readFileSync(scriptPath, 'utf-8');
    } else {
      const fallbackPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'full_script.txt');
      if (fs.existsSync(fallbackPath)) contextText = fs.readFileSync(fallbackPath, 'utf-8');
    }
  }

  let chaptersText = '';
  const mappingPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'mappings', `spensia_mapping_topic_${topId}.json`);
  let finalMapPath = mappingPath;
  if (!fs.existsSync(mappingPath)) {
    const fallbackMap = path.join(PROJECT_ROOT, 'input', 'spensia', 'spensia_mapping.json');
    if (fs.existsSync(fallbackMap)) finalMapPath = fallbackMap;
  }

  if (fs.existsSync(finalMapPath)) {
    try {
      const mapping = JSON.parse(fs.readFileSync(finalMapPath, 'utf-8'));
      const timeline = mapping.timeline || [];
      if (timeline.length > 0) {
        let accSec = 0;
        const chapterLines = [];
        chapterLines.push('00:00 Intro & Fakta Utama');
        for (let i = 0; i < timeline.length; i++) {
          const seg = timeline[i];
          accSec += (seg.duration_sec || 5);
          if (i === Math.floor(timeline.length * 0.25) || i === Math.floor(timeline.length * 0.5) || i === Math.floor(timeline.length * 0.75)) {
            const mm = String(Math.floor(accSec / 60)).padStart(2, '0');
            const ss = String(Math.floor(accSec % 60)).padStart(2, '0');
            const label = seg.quote ? (seg.quote.slice(0, 30) + '...') : `Segmen #${seg.segment_id || (i + 1)}`;
            chapterLines.push(`${mm}:${ss} ${label}`);
          }
        }
        chaptersText = chapterLines.join('\n');
      }
    } catch { }
  }

  const systemPrompt = loadPrompt('upload_metadata_system.txt');

  const prompt = `Judul Topik / Konten: "${topicTitle || 'Fakta Spensia'}"\n\nNaskah / Detail Konten:\n${contextText || 'Fakta unik dan kontraintuitif tentang kehidupan purba vs modern.'}\n\n${chaptersText ? `Catatan Timestamps Rencana:\n${chaptersText}` : ''}`;

  const rawJson = await aiClient.streamChatCompletion({
    systemPrompt,
    prompt,
    model: model || 'ag/gemini-3-flash-agent',
    jsonMode: true,
    temperature: 0.7,
    onChunk: (chunk, fullText) => {
      try {
        event.sender.send('spensia-upload-metadata-chunk', { chunk, fullText });
      } catch { }
    },
  });

  const parsed = JSON.parse(rawJson);
  const savePath = path.join(PROJECT_ROOT, 'input', 'spensia', 'metadata', `upload_metadata_topic_${topId}.json`);
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(savePath, JSON.stringify(parsed, null, 2), 'utf-8');

  return parsed;
});

ipcMain.handle('get-spensia-upload-metadata', async (_event, args) => {
  const topicId = (typeof args === 'number' ? args : args?.topicId) || 1;
  const savePath = path.join(PROJECT_ROOT, 'input', 'spensia', 'metadata', `upload_metadata_topic_${topicId}.json`);
  if (fs.existsSync(savePath)) {
    try {
      return JSON.parse(fs.readFileSync(savePath, 'utf-8'));
    } catch { }
  } else if (topicId === 1) {
    const legacyPath = path.join(PROJECT_ROOT, 'input', 'spensia', 'upload_metadata.json');
    if (fs.existsSync(legacyPath)) {
      try {
        return JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
      } catch { }
    }
  }
  return null;
});

ipcMain.handle('analyze-spensia-metadata', async (event, { topicTitle, metadata, model, topicId }) => {
  const topId = topicId || 1;
  const systemPrompt = loadPrompt('analyze_metadata_system.txt');

  const prompt = `Topic Title: "${topicTitle || 'Spensia Educational Facts'}"
  
Generated Metadata to Analyze:
${JSON.stringify(metadata, null, 2)}`;

  const rawJson = await aiClient.streamChatCompletion({
    systemPrompt,
    prompt,
    model: model || 'ag/gemini-3-flash-agent',
    jsonMode: true,
    temperature: 0.7,
  });

  const analysis = JSON.parse(rawJson);

  const savePath = path.join(PROJECT_ROOT, 'input', 'spensia', 'metadata', `upload_metadata_topic_${topId}.json`);
  if (fs.existsSync(savePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(savePath, 'utf-8'));
      existing.analysis = analysis;
      if (analysis.superior_title) existing.recommended_title = analysis.superior_title;
      fs.writeFileSync(savePath, JSON.stringify(existing, null, 2), 'utf-8');
    } catch {}
  }

  return analysis;
});

ipcMain.handle('fix-spensia-metadata', async (event, { topicTitle, metadata, analysis, model, topicId }) => {
  const topId = topicId || 1;
  const systemPrompt = loadPrompt('fix_metadata_system.txt');

  const prompt = `Topic Title: "${topicTitle || 'Spensia Educational Facts'}"

Current Metadata:
${JSON.stringify(metadata, null, 2)}

AI Analysis & Areas to Fix:
${JSON.stringify(analysis || {}, null, 2)}`;

  const rawJson = await aiClient.streamChatCompletion({
    systemPrompt,
    prompt,
    model: model || 'ag/gemini-3-flash-agent',
    jsonMode: true,
    temperature: 0.7,
  });

  const fixedMetadata = JSON.parse(rawJson);
  if (analysis) fixedMetadata.analysis = analysis;

  const savePath = path.join(PROJECT_ROOT, 'input', 'spensia', 'metadata', `upload_metadata_topic_${topId}.json`);
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(savePath, JSON.stringify(fixedMetadata, null, 2), 'utf-8');

  return fixedMetadata;
});

const SPENSIA_AUDIO_DIR = path.join(PROJECT_ROOT, 'input', 'spensia', 'audio');
if (!fs.existsSync(SPENSIA_AUDIO_DIR)) fs.mkdirSync(SPENSIA_AUDIO_DIR, { recursive: true });

ipcMain.handle('upload-spensia-vo-audio', async (_event, { segmentId, sourcePath, bufferArray, topicId }) => {
  const targetAudioDir = topicId ? path.join(PROJECT_ROOT, 'input', 'spensia', 'audio', `topic_${topicId}`) : SPENSIA_AUDIO_DIR;
  await fs.promises.mkdir(targetAudioDir, { recursive: true });

  const ext = sourcePath ? path.extname(sourcePath) || '.mp3' : '.mp3';
  const filename = topicId
    ? `full_narration_topic_${topicId}${ext}`
    : (segmentId !== undefined ? `segment_${segmentId}${ext}` : `full_narration${ext}`);
  const destPath = path.join(targetAudioDir, filename);

  if (bufferArray) {
    const buffer = Buffer.from(bufferArray);
    await fs.promises.writeFile(destPath, buffer);
  } else if (sourcePath && fs.existsSync(sourcePath)) {
    await fs.promises.copyFile(sourcePath, destPath);
  } else {
    throw new Error('File audio source atau buffer tidak valid.');
  }

  const duration = await getAudioDurationHelper(destPath);

  return {
    segmentId,
    filename,
    filePath: destPath,
    url: mediaUrl(destPath),
    duration,
  };
});

function getAudioDurationHelper(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) return resolve(0);
    const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath];
    const child = spawn(ffprobePath, args);
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('close', () => {
      const dur = parseFloat(out.trim());
      resolve(isNaN(dur) ? 0 : dur);
    });
    child.on('error', () => resolve(0));
  });
}

ipcMain.handle('merge-spensia-vo-audio', async (_event, { audioPaths, topicId }) => {
  if (!Array.isArray(audioPaths) || audioPaths.length === 0) {
    throw new Error('Daftar file audio tidak boleh kosong.');
  }

  const validPaths = audioPaths.filter((p) => p && fs.existsSync(p));
  if (validPaths.length === 0) {
    throw new Error('Tidak ada file audio valid yang ditemukan untuk digabungkan.');
  }

  const targetAudioDir = topicId ? path.join(PROJECT_ROOT, 'input', 'spensia', 'audio', `topic_${topicId}`) : SPENSIA_AUDIO_DIR;
  await fs.promises.mkdir(targetAudioDir, { recursive: true });

  const destPath = path.join(targetAudioDir, 'merged_narration.mp3');

  if (validPaths.length === 1) {
    await fs.promises.copyFile(validPaths[0], destPath);
    const duration = await getAudioDurationHelper(destPath);
    return {
      filename: 'merged_narration.mp3',
      filePath: destPath,
      url: mediaUrl(destPath),
      duration,
    };
  }

  const listFilePath = path.join(TMP_DIR, `spensia_vo_concat_${Date.now()}.txt`);
  const fileContent = validPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.promises.writeFile(listFilePath, fileContent, 'utf-8');

  const allMp3 = validPaths.every((p) => p.toLowerCase().endsWith('.mp3'));
  let streamCopySuccess = false;

  if (allMp3) {
    try {
      const concatArgs = [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listFilePath,
        '-c', 'copy',
        destPath,
      ];

      await new Promise((resolve, reject) => {
        const child = spawn(ffmpegPath, concatArgs, { cwd: PROJECT_ROOT });
        let stderr = '';
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.on('close', (code) => {
          if (code === 0 && fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
            resolve();
          } else {
            reject(new Error(`Concat stream copy failed (code ${code}): ${stderr}`));
          }
        });
        child.on('error', reject);
      });
      streamCopySuccess = true;
    } catch (err) {
      console.warn(`[Merge VO] Stream copy failed (${err.message}), using filter re-encoding...`);
    }
  }

  if (!streamCopySuccess) {
    const filterArgs = ['-y'];
    validPaths.forEach((p) => {
      filterArgs.push('-i', p);
    });
    const inputCount = validPaths.length;
    const filterStr = `${validPaths.map((_, i) => `[${i}:a]`).join('')}concat=n=${inputCount}:v=0:a=1[aout]`;
    filterArgs.push('-filter_complex', filterStr, '-map', '[aout]', '-c:a', 'libmp3lame', '-b:a', '192k', destPath);

    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, filterArgs, { cwd: PROJECT_ROOT });
      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
          resolve();
        } else {
          reject(new Error(`Concat filter encoding failed (code ${code}): ${stderr}`));
        }
      });
      child.on('error', reject);
    });
  }

  if (fs.existsSync(listFilePath)) {
    try { fs.unlinkSync(listFilePath); } catch (_) { }
  }

  const duration = await getAudioDurationHelper(destPath);

  return {
    filename: 'merged_narration.mp3',
    filePath: destPath,
    url: mediaUrl(destPath),
    duration,
  };
});


ipcMain.handle('run-whisperx-transcribe', async (event, { audioPath, model = 'small', language = 'id', device = 'auto', computeType }) => {
  const whisperxDir = path.join(PROJECT_ROOT, 'whisperx');
  const pythonVenvPath = path.join(whisperxDir, 'venv', 'bin', 'python');
  const pythonBin = fs.existsSync(pythonVenvPath) ? pythonVenvPath : 'python3';
  const scriptPath = path.join(whisperxDir, 'transcribe_cli.py');

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`WhisperX script tidak ditemukan di: ${scriptPath}`);
  }
  if (!audioPath || !fs.existsSync(audioPath)) {
    throw new Error(`File audio tidak ditemukan di: ${audioPath}`);
  }

  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    const args = [
      scriptPath,
      '--audio', audioPath,
      '--model', model,
      '--language', language,
      '--device', device || 'auto'
    ];
    if (computeType) {
      args.push('--compute_type', computeType);
    }

    console.log(`[WhisperX] Running command: ${pythonBin} ${args.join(' ')}`);

    const child = spawn(pythonBin, args, { cwd: PROJECT_ROOT });
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderrData += text;
      console.log(`[WhisperX log] ${text}`);
      if (event && event.sender && !event.sender.isDestroyed()) {
        event.sender.send('whisperx-progress', { audioPath, logText: text.trim() });
      }
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`WhisperX gagal (code ${code}): ${stderrData || stdoutData}`));
      }

      try {
        const jsonMatch = stdoutData.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Tidak ditemukan JSON valid pada output WhisperX.');
        }
        const parsedJson = JSON.parse(jsonMatch[0]);
        resolve({ success: true, transcriptData: parsedJson });
      } catch (err) {
        reject(new Error(`Parse output JSON gagal: ${err.message}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Gagal memanggil Python WhisperX engine: ${err.message}`));
    });
  });
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
      try { fs.unlinkSync(listFile); } catch { }
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
  const isSpensia = mode === 'spensia';
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
    const prefix = isSpensia ? 'WV-SPENSIA' : isLongform ? 'WV-FILM' : 'WV';
    const newId = `${prefix}-${dateStr}-${randStr}`;

    if (isSpensia) {
      console.log(`🧹 [Reset Spensia] Clearing spensia workspace (inputs, outputs, images, audio, thumbnails, timelines) and setting new Content ID: ${newId}`);
      const spensiaInputDir = path.join(inputDir, 'spensia');
      const spensiaOutputDir = path.join(outputDir, 'spensia');

      // Clear all items inside input/spensia (sub-folders like audio, images, thumbnails, transcripts, & files)
      if (fs.existsSync(spensiaInputDir)) {
        try {
          const items = fs.readdirSync(spensiaInputDir);
          for (const item of items) {
            try {
              fs.rmSync(path.join(spensiaInputDir, item), { recursive: true, force: true });
            } catch (err) {
              console.error(`[Reset Spensia] Failed to delete ${item}:`, err);
            }
          }
        } catch (e) {
          console.error('[Reset Spensia] Error reading input/spensia:', e);
        }
      } else {
        fs.mkdirSync(spensiaInputDir, { recursive: true });
      }

      // Clear all items inside output/spensia
      if (fs.existsSync(spensiaOutputDir)) {
        try {
          const items = fs.readdirSync(spensiaOutputDir);
          for (const item of items) {
            try {
              fs.rmSync(path.join(spensiaOutputDir, item), { recursive: true, force: true });
            } catch (err) {
              console.error(`[Reset Spensia] Failed to delete output item ${item}:`, err);
            }
          }
        } catch (e) {
          console.error('[Reset Spensia] Error reading output/spensia:', e);
        }
      } else {
        fs.mkdirSync(spensiaOutputDir, { recursive: true });
      }

      const mappingFile = path.join(spensiaInputDir, 'spensia_mapping.json');
      let mapping = {
        settings: {
          fps: 30,
          format: "16:9",
          fg_aspect: "16:9",
          bgm: "random",
          content_id: newId
        },
        timeline: []
      };
      fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2), 'utf-8');
      fs.writeFileSync(path.join(spensiaInputDir, '.current_content_id'), newId, 'utf-8');
      return { success: true, content_id: newId };
    }

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

// ══════════════════════════════════════════════════════
// Spensia Render Engine IPC Handlers (16:9 1920×1080)
// ══════════════════════════════════════════════════════

ipcMain.handle('get-spensia-render-result', async (_event, args) => {
  const topId = (typeof args === 'number' ? args : args?.topicId) || 1;
  const topicFolder = path.join(SPENSIA_OUTPUT_DIR, `topic_${topId}`);
  const topicMp4InFolder = path.join(topicFolder, `spensia_topic_${topId}.mp4`);
  if (fs.existsSync(topicMp4InFolder)) {
    return {
      outputPath: topicMp4InFolder,
      mediaUrl: mediaUrl(topicMp4InFolder),
      fileName: `spensia_topic_${topId}.mp4`,
    };
  }

  const topicMp4Root = path.join(SPENSIA_OUTPUT_DIR, `spensia_topic_${topId}.mp4`);
  if (fs.existsSync(topicMp4Root)) {
    return {
      outputPath: topicMp4Root,
      mediaUrl: mediaUrl(topicMp4Root),
      fileName: `spensia_topic_${topId}.mp4`,
    };
  }

  const infoPath = path.join(PROJECT_ROOT, 'input', 'spensia', `last_render_topic_${topId}.json`);
  if (fs.existsSync(infoPath)) {
    try {
      const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      if (info?.outputPath && fs.existsSync(info.outputPath)) {
        return {
          outputPath: info.outputPath,
          mediaUrl: mediaUrl(info.outputPath),
          fileName: info.fileName || path.basename(info.outputPath),
          renderedAt: info.renderedAt,
        };
      }
    } catch { }
  }

  return null;
});

ipcMain.handle('render-spensia-video', async (event, { config, timeline, outputPath, topicId }) => {
  const topId = topicId || timeline?.topic_id || 1;
  const targetTopicFolder = path.join(SPENSIA_OUTPUT_DIR, `topic_${topId}`);
  if (!fs.existsSync(targetTopicFolder)) fs.mkdirSync(targetTopicFolder, { recursive: true });

  const destFileName = `spensia_topic_${topId}.mp4`;
  const defaultOutputPath = path.join(targetTopicFolder, destFileName);

  const resolvedOutput = outputPath
    ? (path.isAbsolute(outputPath) ? outputPath : path.join(PROJECT_ROOT, outputPath))
    : defaultOutputPath;

  // Clean up ONLY previous MP4 render for THIS specific topic
  if (fs.existsSync(resolvedOutput)) {
    try { fs.unlinkSync(resolvedOutput); } catch { }
  }

  const rootTopicOutput = path.join(SPENSIA_OUTPUT_DIR, destFileName);
  if (fs.existsSync(rootTopicOutput)) {
    try { fs.unlinkSync(rootTopicOutput); } catch { }
  }

  const outDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const tmpDir = path.join(TMP_DIR, `spensia-render-topic_${topId}-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const send = (stage, progress, message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('render-progress', { stage, progress, message, topicId: topId });
    }
  };

  try {
    const w = config?.resolution?.width || 1920;
    const h = config?.resolution?.height || 1080;
    const fps = config?.fps || 30;

    send('init', 0, `Initializing Spensia Render Engine for Topic #${topId}...`);

    // ── Validate clips ──
    const clips = timeline?.video_clips || [];
    if (clips.length === 0) {
      send('error', 0, `No video clips in timeline for Topic #${topId}.`);
      return { error: `No video clips in timeline for Topic #${topId}.` };
    }

    const audioTracks = timeline?.audio_tracks || [];
    const validAudioTracks = audioTracks.filter((t) => t.filePath && fs.existsSync(t.filePath));

    // ── Load per-topic mapping JSON for exact segment durations ──
    let mappingSegments = [];
    const spensiaMappingPaths = [
      path.join(PROJECT_ROOT, 'input', 'spensia', `spensia_mapping_topic_${topId}.json`),
      path.join(PROJECT_ROOT, 'input', 'spensia', 'transcripts', `merged_transcript_topic_${topId}.json`),
    ];
    if (topId === 1) {
      spensiaMappingPaths.push(path.join(PROJECT_ROOT, 'input', 'spensia', 'spensia_mapping.json'));
    }

    for (const smp of spensiaMappingPaths) {
      if (fs.existsSync(smp)) {
        try {
          const raw = JSON.parse(fs.readFileSync(smp, 'utf-8'));
          mappingSegments = raw.segments || [];
          if (mappingSegments.length > 0) break;
        } catch { }
      }
    }

    // Calculate exact duration for every single visual segment clip
    const clipDurations = clips.map((clip, i) => {
      const matched = mappingSegments.find((s) => s.segment_id === clip.segment_id) || mappingSegments[i];
      if (matched && typeof matched.duration_sec === 'number' && matched.duration_sec > 0) {
        return matched.duration_sec;
      }
      if (typeof clip.duration_sec === 'number' && clip.duration_sec > 0) {
        return clip.duration_sec;
      }
      if (typeof clip.end_sec === 'number' && typeof clip.start_sec === 'number' && clip.end_sec > clip.start_sec) {
        return clip.end_sec - clip.start_sec;
      }
      return 3.0;
    });

    // ── Helper to probe real audio duration from disk using ffprobe ──
    const { execSync } = require('child_process');
    const getAudioDurSec = (fp) => {
      try {
        const out = execSync(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fp}"`, { encoding: 'utf-8' });
        const d = parseFloat(out.trim());
        return isNaN(d) ? 0 : d;
      } catch { return 0; }
    };

    let audioMaxDur = 0;
    for (const a of validAudioTracks) {
      const realDur = getAudioDurSec(a.filePath);
      const trackDur = realDur > 0 ? realDur : (a.duration_sec || (a.end_sec - a.start_sec) || 0);
      const end = (a.start_sec || 0) + trackDur;
      if (end > audioMaxDur) audioMaxDur = end;
    }

    // Calculate total visual sum
    let visualSum = clipDurations.reduce((a, b) => a + b, 0);

    // If audio is slightly longer than visual sum, extend the last clip to match audio
    if (audioMaxDur > visualSum && clips.length > 0) {
      const extra = audioMaxDur - visualSum;
      clipDurations[clipDurations.length - 1] += extra;
      visualSum += extra;
    }

    const totalDur = Math.max(visualSum, audioMaxDur, 1);

    send('clips', 0.05, `🖼️ Memulai pre-rendering ${clips.length} segmen gambar dengan zoom-in presisi (${totalDur.toFixed(1)}s)...`);

    // ── PASS 1: Pre-render individual image segment clips to MPEG-TS with per-clip ZOOM-IN ──
    const cpuCores = os.cpus().length || 4;
    const CONCURRENCY = 1; // Strictly sequential to prevent high CPU load and laptop freezing
    const clipFiles = new Array(clips.length);
    let completedClips = 0;

    for (let batch = 0; batch < clips.length; batch += CONCURRENCY) {
      const batchEnd = Math.min(batch + CONCURRENCY, clips.length);
      const batchClips = clips.slice(batch, batchEnd);

      const tasks = batchClips.map((clip, bi) => {
        const i = batch + bi;
        const outFile = path.join(tmpDir, `seg_${String(i).padStart(4, '0')}.ts`);
        clipFiles[i] = outFile;

        const dur = clipDurations[i];
        let imgPath = clip.image_path || '';
        if (!imgPath || !fs.existsSync(imgPath)) {
          const found = clips.find((c) => c.image_path && fs.existsSync(c.image_path));
          if (found) imgPath = found.image_path;
        }

        if (!imgPath || !fs.existsSync(imgPath)) {
          throw new Error(`Klip #${i + 1} (segment_id: ${clip.segment_id}) tidak memiliki file gambar valid.`);
        }

        const clipFrames = Math.max(1, Math.round(dur * fps));
        // Per-segment Zoom-In effect from 1.00x to 1.08x for the EXACT duration of this image
        const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='1+0.08*(on/${clipFrames})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${w}x${h}:fps=${fps},format=yuv420p`;

        const args = [
          '-y',
          '-loop', '1',
          '-r', String(fps),
          '-t', String(dur.toFixed(3)),
          '-i', imgPath,
          '-vf', vf,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '18',
          '-threads', '2',
          '-an',
          '-pix_fmt', 'yuv420p',
          outFile
        ];

        return new Promise((resolve, reject) => {
          const child = spawn(ffmpegPath, args, { cwd: PROJECT_ROOT });
          let stderr = '';
          child.stderr.on('data', (d) => { stderr += d.toString(); });
          child.on('close', (code) => {
            if (code === 0) {
              completedClips++;
              const pct = 0.05 + ((completedClips / clips.length) * 0.60); // 5% -> 65%
              send('clips', pct, `🖼️ Segmen ${completedClips}/${clips.length} (${dur.toFixed(1)}s zoom-in) — ${path.basename(imgPath)}`);
              resolve();
            } else {
              reject(new Error(`FFmpeg segment #${i + 1} exit ${code}: ${stderr.slice(-200)}`));
            }
          });
          child.on('error', reject);
        });
      });

      await Promise.all(tasks);
    }

    // Write concat file list
    const listFile = path.join(tmpDir, 'concat_list.txt');
    fs.writeFileSync(listFile, clipFiles.map((f) => `file '${f}'`).join('\n'), 'utf-8');

    send('overlay', 0.67, '🔗 Menggabungkan segmen visual & mempersiapkan audio VO + BGM...');

    // ── PASS 2: Concat & Final Overlay Pass ──
    const finalArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile];
    let streamIdx = 1;

    // Add VO Audio inputs
    const voCount = validAudioTracks.length;
    const voStartIdx = streamIdx;

    validAudioTracks.forEach((t) => {
      finalArgs.push('-i', t.filePath);
      streamIdx++;
    });

    // Add BGM input if enabled
    const bgmCfg = config?.bgm || {};
    let bgmInputIdx = null;
    if (bgmCfg.enabled !== false && bgmCfg.path) {
      const resolved = path.isAbsolute(bgmCfg.path) ? bgmCfg.path : path.join(PROJECT_ROOT, bgmCfg.path);
      if (fs.existsSync(resolved)) {
        finalArgs.push('-i', resolved);
        bgmInputIdx = streamIdx++;
      }
    }

    // Generate ASS subtitles file if enabled
    let assFilePath = null;
    const capCfg = config?.caption || {};
    if (capCfg.enabled !== false && (timeline?.captions || []).length > 0) {
      assFilePath = path.join(tmpDir, 'subtitles.ass');
      fs.writeFileSync(assFilePath, buildAssSubtitleFile(timeline.captions, capCfg, w, h), 'utf-8');
    }

    // Build video filter chain on [0:v]
    const filterParts = [];
    const vFilters = [];

    // Vignette
    const vigCfg = config?.vignette || {};
    if (vigCfg.enabled !== false) {
      const intensity = typeof vigCfg.intensity === 'number' ? vigCfg.intensity : 0.75;
      const angleRad = (Math.PI / 10) + (intensity * (Math.PI / 6));
      vFilters.push(`vignette=${angleRad.toFixed(3)}`);
    }

    // ASS Subtitles
    if (assFilePath) {
      const escapedAss = assFilePath.replace(/\\/g, '/').replace(/:/g, '\\:');
      vFilters.push(`ass='${escapedAss}'`);
    }

    // Watermark text
    const wmCfg = config?.watermark || {};
    if (wmCfg.enabled !== false && wmCfg.text) {
      const escaped = wmCfg.text.replace(/'/g, "'\\\\\\''");
      const cHex = wmCfg.colorHex || '#FFFFFF';
      const opacity = typeof wmCfg.opacity === 'number' ? wmCfg.opacity : 0.8;
      const fc = `${cHex}@${opacity}`;
      const pos = wmCfg.position || 'top-left';
      const ox = typeof wmCfg.offsetX === 'number' ? wmCfg.offsetX : 0;
      const oy = typeof wmCfg.offsetY === 'number' ? wmCfg.offsetY : 0;
      const fontSize = wmCfg.fontSize || 52;

      let xExpr, yExpr;
      const margin = 40;

      if (pos === 'top-left') { xExpr = `${margin + ox}`; yExpr = `${margin + oy}`; }
      else if (pos === 'top-center') { xExpr = `(w-text_w)/2+${ox}`; yExpr = `${margin + oy}`; }
      else if (pos === 'top-right') { xExpr = `w-text_w-${margin - ox}`; yExpr = `${margin + oy}`; }
      else if (pos === 'bottom-left') { xExpr = `${margin + ox}`; yExpr = `h-text_h-${margin + oy}`; }
      else if (pos === 'bottom-center') { xExpr = `(w-text_w)/2+${ox}`; yExpr = `h-text_h-${margin + oy}`; }
      else if (pos === 'bottom-right') { xExpr = `w-text_w-${margin - ox}`; yExpr = `h-text_h-${margin + oy}`; }
      else { xExpr = `(w-text_w)/2+${ox}`; yExpr = `h-text_h-${margin + oy}`; }

      let fontFile = '';
      const fontCandidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
        '/usr/share/fonts/TTF/DejaVuSans.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
      ];
      for (const fp of fontCandidates) {
        if (fs.existsSync(fp)) { fontFile = `:fontfile='${fp}'`; break; }
      }

      vFilters.push(`drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=${fc}:x=${xExpr}:y=${yExpr}:shadowcolor=black@0.6:shadowx=2:shadowy=2${fontFile}`);
    }

    if (vFilters.length > 0) {
      filterParts.push(`[0:v]${vFilters.join(',')}[vout]`);
    }

    // Audio mixing (VO tracks + BGM)
    let aMap = null;
    if (voCount > 0 || bgmInputIdx !== null) {
      const voLabels = [];
      let currentAudioStreamIdx = voStartIdx;

      for (let ai = 0; ai < validAudioTracks.length; ai++) {
        const t = validAudioTracks[ai];
        const delayMs = Math.round((t.start_sec || 0) * 1000);
        const label = `vo${ai}`;
        filterParts.push(`[${currentAudioStreamIdx}:a]adelay=${delayMs}|${delayMs}[${label}]`);
        voLabels.push(`[${label}]`);
        currentAudioStreamIdx++;
      }

      const voCfg = config?.voiceOver || {};
      const voEnabled = voCfg.enabled !== false;
      const voVol = typeof voCfg.volume === 'number' ? voCfg.volume : 1.0;
      const activeVoLabels = voEnabled ? voLabels : [];

      if (bgmInputIdx !== null) {
        const bgmIdx = bgmInputIdx;
        const bgmVol = bgmCfg.volume || 0.15;
        const fadeIn = bgmCfg.fadeInSec || 1.0;
        const fadeOut = bgmCfg.fadeOutSec || 2.0;
        const fos = Math.max(0, totalDur - fadeOut);

        if (activeVoLabels.length > 1) {
          filterParts.push(`${activeVoLabels.join('')}amix=inputs=${activeVoLabels.length}:duration=longest:dropout_transition=0.5[vomix]`);
          filterParts.push(`[vomix]volume=${voVol.toFixed(2)}[vonorm]`);
          filterParts.push(`[${bgmIdx}:a]aloop=loop=-1:size=2e+09,volume=${bgmVol},afade=t=in:d=${fadeIn},afade=t=out:st=${fos.toFixed(1)}:d=${fadeOut}[bgmproc]`);
          filterParts.push(`[vonorm][bgmproc]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
        } else if (activeVoLabels.length === 1) {
          filterParts.push(`${activeVoLabels[0]}volume=${voVol.toFixed(2)}[vonorm]`);
          filterParts.push(`[${bgmIdx}:a]aloop=loop=-1:size=2e+09,volume=${bgmVol},afade=t=in:d=${fadeIn},afade=t=out:st=${fos.toFixed(1)}:d=${fadeOut}[bgmproc]`);
          filterParts.push(`[vonorm][bgmproc]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
        } else {
          filterParts.push(`[${bgmIdx}:a]aloop=loop=-1:size=2e+09,volume=${bgmVol},afade=t=in:d=${fadeIn},afade=t=out:st=${fos.toFixed(1)}:d=${fadeOut}[aout]`);
        }
      } else if (activeVoLabels.length > 1) {
        filterParts.push(`${activeVoLabels.join('')}amix=inputs=${activeVoLabels.length}:duration=longest:dropout_transition=0.5[vomix]`);
        filterParts.push(`[vomix]volume=${voVol.toFixed(2)}[aout]`);
      } else if (activeVoLabels.length === 1) {
        filterParts.push(`${activeVoLabels[0]}volume=${voVol.toFixed(2)}[aout]`);
      }

      aMap = '[aout]';
    }

    if (filterParts.length > 0) {
      finalArgs.push('-filter_complex', filterParts.join(';'));
    }

    if (vFilters.length > 0) {
      finalArgs.push('-map', '[vout]');
    } else {
      finalArgs.push('-map', '0:v');
    }

    if (aMap) finalArgs.push('-map', aMap);

    // Quality settings
    const q = config?.outputQuality || 'balanced';
    const qMap = { fast: ['-preset', 'ultrafast', '-crf', '22'], balanced: ['-preset', 'ultrafast', '-crf', '18'], high: ['-preset', 'fast', '-crf', '16'] };
    const encThreads = Math.min(4, Math.max(2, Math.floor(cpuCores / 2)));
    finalArgs.push('-c:v', 'libx264', ...qMap[q] || qMap.balanced, '-threads', String(encThreads), '-pix_fmt', 'yuv420p');

    if (aMap) finalArgs.push('-c:a', 'aac', '-b:a', '192k');
    finalArgs.push('-movflags', '+faststart', '-t', String(totalDur.toFixed(2)), resolvedOutput);

    send('final', 0.75, `⚡ Memulai encoding ekspor MP4 1080p (${totalDur.toFixed(1)}s)...`);

    await new Promise((resolve, reject) => {
      let stderr = '';
      const child = spawn(ffmpegPath, finalArgs, { cwd: PROJECT_ROOT });

      child.stderr.on('data', (d) => {
        const text = d.toString();
        stderr += text;
        const tm = text.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
        if (tm) {
          const sec = parseInt(tm[1]) * 3600 + parseInt(tm[2]) * 60 + parseInt(tm[3]);
          const fpct = Math.min(1.0, sec / totalDur);
          const mappedPct = Math.min(0.99, 0.75 + (fpct * 0.24)); // 75% -> 99%
          send('final', mappedPct, `⚡ Encoding MP4 1080p: ${sec}s / ${totalDur.toFixed(0)}s (${Math.round(fpct * 100)}%)...`);
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          send('done', 1.0, '🎉 Render Video 1080p Selesai dituntaskan!');
          resolve();
        } else {
          const last = stderr.trim().split('\n').filter(Boolean).slice(-10).join('\n');
          reject(new Error(`FFmpeg exit ${code}: ${last}`));
        }
      });

      child.on('error', (err) => reject(err));
    });

    // Cleanup temp dir
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }

    // Disabled copying to root output folder to prevent duplicate output files

    const resultObj = {
      outputPath: resolvedOutput,
      mediaUrl: mediaUrl(resolvedOutput),
      fileName: path.basename(resolvedOutput),
      topicId: topId,
      renderedAt: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(path.join(PROJECT_ROOT, 'input', 'spensia', `last_render_topic_${topId}.json`), JSON.stringify(resultObj, null, 2), 'utf-8');
      if (topId === 1) {
        fs.writeFileSync(path.join(PROJECT_ROOT, 'input', 'spensia', 'last_render.json'), JSON.stringify(resultObj, null, 2), 'utf-8');
      }
    } catch { }

    return resultObj;

  } catch (err) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
    send('error', 0, `❌ Spensia Render Error: ${err.message}`);
    return { error: err.message };
  }
});

ipcMain.handle('render-spensia-preview-frame', async (_event, { config, imagePath }) => {
  if (!imagePath || !fs.existsSync(imagePath)) {
    return { error: 'Preview image not found.' };
  }

  const w = config?.resolution?.width || 1920;
  const h = config?.resolution?.height || 1080;
  const previewPath = path.join(TMP_DIR, `spensia_preview_${Date.now()}.png`);

  try {
    let vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;

    // Vignette (matching PreviewCanvas.tsx)
    const vigCfg = config?.vignette || {};
    if (vigCfg.enabled !== false) {
      const intensity = typeof vigCfg.intensity === 'number' ? vigCfg.intensity : 0.75;
      const angleRad = (Math.PI / 10) + (intensity * (Math.PI / 6));
      vf += `,vignette=${angleRad.toFixed(3)}`;
    }

    // Watermark (matching render_config.json & PreviewCanvas.tsx)
    const wmCfg = config?.watermark || {};
    if (wmCfg.enabled !== false && wmCfg.text) {
      const escaped = wmCfg.text.replace(/'/g, "'\\\\\\''");
      const cHex = wmCfg.colorHex || '#FFFFFF';
      const opacity = typeof wmCfg.opacity === 'number' ? wmCfg.opacity : 0.8;
      const fc = `${cHex}@${opacity}`;
      const pos = wmCfg.position || 'top-left';
      const ox = typeof wmCfg.offsetX === 'number' ? wmCfg.offsetX : 0;
      const oy = typeof wmCfg.offsetY || 0;
      const fontSize = wmCfg.fontSize || 52;
      const margin = 40;

      let xExpr, yExpr;
      if (pos === 'top-left') { xExpr = `${margin + ox}`; yExpr = `${margin + oy}`; }
      else if (pos === 'top-center') { xExpr = `(w-text_w)/2+${ox}`; yExpr = `${margin + oy}`; }
      else if (pos === 'top-right') { xExpr = `w-text_w-${margin - ox}`; yExpr = `${margin + oy}`; }
      else if (pos === 'bottom-left') { xExpr = `${margin + ox}`; yExpr = `h-text_h-${margin + oy}`; }
      else if (pos === 'bottom-center') { xExpr = `(w-text_w)/2+${ox}`; yExpr = `h-text_h-${margin + oy}`; }
      else if (pos === 'bottom-right') { xExpr = `w-text_w-${margin - ox}`; yExpr = `h-text_h-${margin + oy}`; }
      else { xExpr = `(w-text_w)/2+${ox}`; yExpr = `h-text_h-${margin + oy}`; }

      let fontFile = '';
      const fontCandidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
        '/usr/share/fonts/TTF/DejaVuSans.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
      ];
      for (const fp of fontCandidates) {
        if (fs.existsSync(fp)) { fontFile = `:fontfile='${fp}'`; break; }
      }

      vf += `,drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=${fc}:x=${xExpr}:y=${yExpr}:shadowcolor=black@0.6:shadowx=2:shadowy=2${fontFile}`;
    }

    vf += `,format=yuv420p`;

    await new Promise((resolve, reject) => {
      const args = ['-y', '-i', imagePath, '-vf', vf, '-vframes', '1', '-c:v', 'png', previewPath];
      const ff = spawn(ffmpegPath, args, { cwd: PROJECT_ROOT });
      ff.stderr.on('data', () => { });
      ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Preview render exit ${code}`)));
      ff.on('error', reject);
    });

    return { filePath: previewPath, url: mediaUrl(previewPath) };
  } catch (err) {
    return { error: err.message };
  }
});

// ─── ASS Subtitle file builder for Spensia Render ─────

function hexToAssColor(hexStr, alphaHex = '00') {
  let clean = hexStr.replace('#', '').trim();
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  if (clean.length !== 6) clean = 'FFFFFF';
  const rr = clean.substring(0, 2);
  const gg = clean.substring(2, 4);
  const bb = clean.substring(4, 6);
  return `&H${alphaHex}${bb}${gg}${rr}&`;
}

function assTime(sec) {
  const safe = Math.max(0, sec);
  const ms = Math.floor(safe * 1000);
  const hh = Math.floor(ms / 3600000);
  const mm = Math.floor((ms % 3600000) / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  const p = (n, l) => String(n).padStart(l || 2, '0');
  return `${hh}:${p(mm)}:${p(ss)}.${p(cs)}`;
}

function cleanPunct(word) {
  if (!word) return '';
  return word.replace(/[.,:;!?\-"""''`()[\]{}]/g, '').trim();
}

function buildAssSubtitleFile(captions, capCfg, width, height) {
  const fn = capCfg.fontName || 'Montserrat';
  const fs = capCfg.fontSize || 48;
  const activeColor = hexToAssColor(capCfg.activeColorHex || '#FDE047');
  const inactiveColor = hexToAssColor(capCfg.inactiveColorHex || '#FFFFFF');
  const outlineColor = hexToAssColor(capCfg.outlineColorHex || '#000000');
  const ow = capCfg.outlineWidth || 3;
  const sd = capCfg.shadowDistance || 2;
  const posY = capCfg.positionY || 160;
  const posX = capCfg.positionX || 40;
  const align = capCfg.alignment || 2;
  const displayMode = capCfg.displayMode || 'single-word';

  const lines = [];
  lines.push('[Script Info]');
  lines.push('Title: Spensia CapCut Word-Level Sync Subtitles');
  lines.push('ScriptType: v4.00+');
  lines.push('WrapStyle: 2');
  lines.push('ScaledBorderAndShadow: yes');
lines.push(`Style: Default,${fn},${fs},${activeColor},${inactiveColor},${outlineColor},&H80000000,-1,0,0,0,100,100,1,0,1,${ow},${sd},${align},${posX},${posX},${posY},1`);
  lines.push('');
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

  if (!captions || captions.length === 0) return lines.join('\n');

  const clean = captions
    .map((c) => ({ ...c, word: cleanPunct(c.word) }))
    .filter((c) => c.word);
  const sorted = [...clean].sort((a, b) => a.start_sec - b.start_sec);

  if (displayMode === 'single-word') {
    sorted.forEach((w, idx) => {
      const nextW = sorted[idx + 1];
      const startSec = Math.max(0, w.start_sec);
      let endSec = w.end_sec;
      if (nextW) {
        const ns = Math.max(0, nextW.start_sec);
        if (ns > startSec && ns <= endSec + 0.2) endSec = ns;
      }
      if (endSec <= startSec) endSec = startSec + 0.25;
      const wordText = `{\\c${activeColor}\\fscx115\\fscy115\\b1}${w.word}`;
      lines.push(`Dialogue: 0,${assTime(startSec)},${assTime(endSec)},Default,,0,0,0,,${wordText}`);
    });
  } else {
    // phrase mode: 3 words per group
    const MAX = 3;
    const groups = [];
    for (let i = 0; i < sorted.length; i += MAX) groups.push(sorted.slice(i, i + MAX));
    groups.forEach((group, gIdx) => {
      const nextGroup = groups[gIdx + 1];
      group.forEach((tw, idx) => {
        const ws = Math.max(0, tw.start_sec);
        let we = tw.end_sec;
        if (idx < group.length - 1) we = Math.max(ws + 0.15, group[idx + 1].start_sec);
        else if (nextGroup && nextGroup.length > 0) we = Math.max(ws + 0.15, nextGroup[0].start_sec);
        else we = ws + 0.5;
        if (we <= ws) we = ws + 0.25;
        const phrase = group.map((w) => w === tw
          ? `{\\c${activeColor}\\fscx112\\fscy112\\b1}${w.word}{\\r}`
          : w.word).join(' ');
        lines.push(`Dialogue: 0,${assTime(ws)},${assTime(we)},Default,,0,0,0,,${phrase}`);
      });
    });
  }

  return lines.join('\n');
}

// ══════════════════════════════════════════════════════
// Spensia Timeline Generator (from existing data files)
// ══════════════════════════════════════════════════════

ipcMain.handle('generate-spensia-timeline', async (_event, args) => {
  try {
    const topicId = (typeof args === 'number' ? args : args?.topicId) || 1;
    const spensiaDir = path.join(PROJECT_ROOT, 'input', 'spensia');
    const imagesDir = path.join(spensiaDir, 'images', `topic_${topicId}`);
    const fallbackImagesDir = path.join(spensiaDir, 'images');
    const transcriptsDir = path.join(spensiaDir, 'transcripts');
    const audioDir = path.join(spensiaDir, 'audio', `topic_${topicId}`);
    const fallbackAudioDir = path.join(spensiaDir, 'audio');

    // 1. Read breakdown segments for topic
    let segments = [];
    const breakdownPaths = topicId === 1
      ? [
          path.join(spensiaDir, 'breakdowns', `breakdown_topic_1.json`),
          path.join(spensiaDir, `breakdown_topic_1.json`),
          path.join(spensiaDir, 'breakdown.json'),
        ]
      : [
          path.join(spensiaDir, 'breakdowns', `breakdown_topic_${topicId}.json`),
          path.join(spensiaDir, `breakdown_topic_${topicId}.json`),
        ];

    for (const bp of breakdownPaths) {
      if (fs.existsSync(bp)) {
        try {
          const raw = JSON.parse(fs.readFileSync(bp, 'utf-8'));
          const segs = Array.isArray(raw) ? raw : (raw.segments || raw.breakdown || []);
          if (segs.length > 0) {
            segments = segs;
            break;
          }
        } catch { }
      }
    }
    if (segments.length === 0) {
      return { error: `No breakdown data found for Topic #${topicId}. Jalankan step Scene Splitter dulu.` };
    }

    // 2. Read images for topic (strictly isolated per topic)
    const images = [];

    // Check generated_images_topic_${topicId}.json first
    const genImgJsonPath = path.join(spensiaDir, 'images', `generated_images_topic_${topicId}.json`);
    if (fs.existsSync(genImgJsonPath)) {
      try {
        const genData = JSON.parse(fs.readFileSync(genImgJsonPath, 'utf-8'));
        const genSegs = Array.isArray(genData) ? genData : (genData.segments || genData.images || []);
        genSegs.forEach((s) => {
          const segId = Number(s.segment_id || s.id);
          const topicSubfile = path.join(spensiaDir, 'images', `topic_${topicId}`, `segment_${segId}.png`);
          if (fs.existsSync(topicSubfile)) {
            images.push({ segment_id: segId, filePath: topicSubfile, url: mediaUrl(topicSubfile) });
          } else if (s.filePath && s.filePath.includes(`topic_${topicId}`) && fs.existsSync(s.filePath)) {
            images.push({ segment_id: segId, filePath: s.filePath, url: mediaUrl(s.filePath) });
          } else if (topicId === 1 && s.filePath && !s.filePath.includes('topic_') && fs.existsSync(s.filePath)) {
            images.push({ segment_id: segId, filePath: s.filePath, url: mediaUrl(s.filePath) });
          }
        });
      } catch { }
    }

    // Scan topic directory input/spensia/images/topic_${topicId}
    const topicImgDir = path.join(spensiaDir, 'images', `topic_${topicId}`);
    const searchImgDirs = [topicImgDir];
    if (topicId === 1) {
      searchImgDirs.push(path.join(spensiaDir, 'images', 'topic_1'));
    }

    for (const d of searchImgDirs) {
      if (fs.existsSync(d)) {
        const files = fs.readdirSync(d).filter(f => /^segment_\d+\.(png|jpg|jpeg|webp)$/i.test(f));
        for (const f of files) {
          const m = f.match(/segment_(\d+)/);
          if (m) {
            const segId = parseInt(m[1], 10);
            const filePath = path.join(d, f);
            if (!images.some((i) => i.segment_id === segId)) {
              images.push({ segment_id: segId, filePath, url: mediaUrl(filePath) });
            }
          }
        }
      }
    }

    // 3. Read audio files for topic (strictly isolated)
    let singleAudio = null;
    let part1Audio = null;
    let part2Audio = null;

    const topicAudDir = path.join(spensiaDir, 'audio', `topic_${topicId}`);
    const searchAudDirs = topicId === 1 ? [topicAudDir, fallbackAudioDir] : [topicAudDir];

    for (const d of searchAudDirs) {
      if (fs.existsSync(d)) {
        const audioFiles = fs.readdirSync(d).filter(f => /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(f));
        for (const f of audioFiles) {
          const fp = path.join(d, f);
          let dur = 30;
          try {
            const probeOut = require('child_process').execSync(
              `"${ffmpegPath.replace('ffmpeg', 'ffprobe')}" -v error -show_entries format=duration -of csv=p=0 "${fp}"`,
              { encoding: 'utf-8', timeout: 5000 }
            );
            dur = parseFloat(probeOut) || 30;
          } catch { }

          if (f.includes('full') || f.includes('merged') || f.includes('single') || f.includes(`topic_${topicId}`)) {
            singleAudio = { filePath: fp, url: mediaUrl(fp), duration: dur };
          } else if (f.includes('part_1') || f.includes('part1') || f.includes('segment_1')) {
            part1Audio = { filePath: fp, url: mediaUrl(fp), duration: dur };
          } else if (f.includes('part_2') || f.includes('part2') || f.includes('segment_2')) {
            part2Audio = { filePath: fp, url: mediaUrl(fp), duration: dur };
          }
        }
        if (!singleAudio && audioFiles.length > 0) {
          const fp = path.join(d, audioFiles[0]);
          let dur = 30;
          try {
            const probeOut = require('child_process').execSync(
              `"${ffmpegPath.replace('ffmpeg', 'ffprobe')}" -v error -show_entries format=duration -of csv=p=0 "${fp}"`,
              { encoding: 'utf-8', timeout: 5000 }
            );
            dur = parseFloat(probeOut) || 30;
          } catch { }
          singleAudio = { filePath: fp, url: mediaUrl(fp), duration: dur };
        }
      }
    }

    // 4. Read transcripts & mapping files for topic (strictly isolated)
    let mergedTranscript = null;
    let part1Transcript = null;
    let part2Transcript = null;

    const spensiaMappingPaths = topicId === 1
      ? [
          path.join(spensiaDir, 'mappings', `spensia_mapping_topic_1.json`),
          path.join(spensiaDir, `spensia_mapping_topic_1.json`),
          path.join(transcriptsDir, `merged_transcript_topic_1.json`),
          path.join(spensiaDir, 'mappings', 'spensia_mapping.json'),
          path.join(spensiaDir, 'spensia_mapping.json'),
        ]
      : [
          path.join(spensiaDir, 'mappings', `spensia_mapping_topic_${topicId}.json`),
          path.join(spensiaDir, `spensia_mapping_topic_${topicId}.json`),
          path.join(transcriptsDir, `merged_transcript_topic_${topicId}.json`),
        ];

    for (const smp of spensiaMappingPaths) {
      if (fs.existsSync(smp)) {
        try {
          const rawMap = JSON.parse(fs.readFileSync(smp, 'utf-8'));
          const words = rawMap.words || [];
          const segs = rawMap.segments || [];
          if (words.length > 0 || segs.length > 0) {
            mergedTranscript = {
              words,
              segments: segs,
              transcript_full: rawMap.transcript_full || '',
            };
            break;
          }
        } catch { }
      }
    }

    // 5. Build timeline
    const fps = 30;
    const width = 1920;
    const height = 1080;

    const cleanWordForMatch = (str) => {
      if (!str) return '';
      return str.toLowerCase().replace(/[.,:;!?\-"“”'’`()[\]{}]/g, '').trim();
    };

    const videoClips = [];
    let clipId = 1;

    const buildClips = (segs, partId, partStartOffset, partDuration, transcriptData) => {
      const transcriptWords = transcriptData?.words || [];

      let wordSearchIdx = 0;
      let currentOffset = partStartOffset;

      const totalChars = segs.reduce((acc, s) => acc + (s.text || s.quote || '').length, 0);

      segs.forEach((seg, idx) => {
        const img = images.find((i) => i.segment_id === (seg.segment_id || seg.id || idx + 1));

        let segStartSec = -1;
        let segEndSec = -1;

        if (transcriptWords.length > 0) {
          const rawSegText = (seg.text || seg.quote || '').trim();
          const segWords = rawSegText.split(/\s+/).map(cleanWordForMatch).filter(Boolean);

          if (segWords.length > 0) {
            const firstTargetWord = segWords[0];
            const lastTargetWord = segWords[segWords.length - 1];

            let matchStartIdx = -1;
            for (let i = wordSearchIdx; i < transcriptWords.length; i++) {
              const tw = cleanWordForMatch(transcriptWords[i].word || transcriptWords[i].text);
              if (tw === firstTargetWord || tw.includes(firstTargetWord) || firstTargetWord.includes(tw)) {
                matchStartIdx = i;
                break;
              }
            }

            if (matchStartIdx >= 0) {
              let matchEndIdx = -1;
              for (let j = Math.min(transcriptWords.length - 1, matchStartIdx + segWords.length + 5); j >= matchStartIdx; j--) {
                const tw = cleanWordForMatch(transcriptWords[j].word || transcriptWords[j].text);
                if (tw === lastTargetWord || tw.includes(lastTargetWord) || lastTargetWord.includes(tw)) {
                  matchEndIdx = j;
                  break;
                }
              }

              const parseN = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, '')));
              const startVal = parseN(transcriptWords[matchStartIdx].start);
              const endVal = matchEndIdx >= 0
                ? parseN(transcriptWords[matchEndIdx].end)
                : parseN(transcriptWords[matchStartIdx].end) + 2.0;

              if (!isNaN(startVal) && !isNaN(endVal) && endVal > startVal) {
                segStartSec = partStartOffset + startVal;
                segEndSec = partStartOffset + endVal;
                wordSearchIdx = (matchEndIdx >= 0 ? matchEndIdx : matchStartIdx) + 1;
              }
            }
          }
        }

        let segDurationSec = 0;
        if (segStartSec >= 0 && segEndSec > segStartSec) {
          segDurationSec = segEndSec - segStartSec;
          currentOffset = segStartSec;
        } else {
          const textLen = (seg.text || seg.quote || '').length || 10;
          const ratio = textLen / Math.max(1, totalChars);
          segDurationSec = ratio * partDuration;
        }

        if (idx === segs.length - 1) {
          segDurationSec = Math.max(1.0, partStartOffset + partDuration - currentOffset);
        } else {
          segDurationSec = Math.max(1.0, segDurationSec);
        }

        const startSec = currentOffset;
        const endSec = startSec + segDurationSec;
        currentOffset = endSec;

        videoClips.push({
          clip_id: clipId++,
          segment_id: seg.segment_id || seg.id || idx + 1,
          part_id: partId,
          quote: seg.text || seg.quote || '',
          image_path: img?.filePath || '',
          image_url: img?.url || '',
          start_sec: Number(startSec.toFixed(2)),
          end_sec: Number(endSec.toFixed(2)),
          duration_sec: Number(segDurationSec.toFixed(2)),
          start_frame: Math.round(startSec * fps),
          end_frame: Math.round(endSec * fps),
          transition: 'crossfade',
        });
      });
    };

    const captions = [];
    const addCaptions = (transcript, partId, timeOffset) => {
      const words = Array.isArray(transcript) ? transcript : transcript?.words;
      if (!words) return;
      words.forEach((w) => {
        const word = (w.word || w.text || '').replace(/[.,:;!?\-"“”'’`()[\]{}]/g, '').trim();
        if (!word) return;
        captions.push({
          part_id: partId,
          word,
          start_sec: (w.start || 0) + timeOffset,
          end_sec: (w.end || (w.start + 0.5) || 0) + timeOffset,
        });
      });
    };

    const audioTracks = [];
    const isSingleAudio = Boolean(singleAudio) || (!part2Audio && (part1Audio || singleAudio));
    let totalDur = 0;

    if (isSingleAudio) {
      const activeAudio = singleAudio || part1Audio;
      totalDur = activeAudio?.duration || (segments.length * 4);
      if (activeAudio) {
        audioTracks.push({
          track: 'A1',
          part_id: 1,
          filePath: activeAudio.filePath,
          url: activeAudio.url,
          start_sec: 0,
          end_sec: totalDur,
          duration_sec: totalDur,
        });
      }

      const activeTranscript = mergedTranscript || part1Transcript;
      buildClips(segments, 1, 0, totalDur, activeTranscript);
      addCaptions(activeTranscript, 1, 0);
    } else {
      const mid = Math.ceil(segments.length / 2);
      const p1Segs = segments.slice(0, mid);
      const p2Segs = segments.slice(mid);

      const p1Dur = part1Audio?.duration || (p1Segs.length * 4);
      const p2Dur = part2Audio?.duration || (p2Segs.length * 4);
      totalDur = p1Dur + p2Dur;

      if (part1Audio) {
        audioTracks.push({ track: 'A1', part_id: 1, filePath: part1Audio.filePath, url: part1Audio.url, start_sec: 0, end_sec: p1Dur, duration_sec: p1Dur });
      }
      if (part2Audio) {
        audioTracks.push({ track: 'A2', part_id: 2, filePath: part2Audio.filePath, url: part2Audio.url, start_sec: p1Dur, end_sec: totalDur, duration_sec: p2Dur });
      }

      buildClips(p1Segs, 1, 0, p1Dur, part1Transcript);
      buildClips(p2Segs, 2, p1Dur, p2Dur, part2Transcript);
      addCaptions(part1Transcript, 1, 0);
      addCaptions(part2Transcript, 2, p1Dur);
    }

    const timeline = {
      title: `Spensia Timeline Topic #${topicId}`,
      topic_id: topicId,
      fps,
      resolution: { width, height, aspect_ratio: '16:9' },
      total_duration_sec: Math.round(totalDur * 100) / 100,
      total_frames: Math.round(totalDur * fps),
      audio_tracks: audioTracks,
      video_clips: videoClips,
      captions,
      generated_at: new Date().toISOString(),
    };

    // Save per-topic timeline JSON into input/spensia/timelines/ folder
    const timelinesDir = path.join(spensiaDir, 'timelines');
    if (!fs.existsSync(timelinesDir)) fs.mkdirSync(timelinesDir, { recursive: true });

    const timelineFolderFile = path.join(timelinesDir, `timeline_topic_${topicId}.json`);
    fs.writeFileSync(timelineFolderFile, JSON.stringify(timeline, null, 2), 'utf-8');

    const topicTimelinePath = path.join(spensiaDir, `spensia_timeline_topic_${topicId}.json`);
    fs.writeFileSync(topicTimelinePath, JSON.stringify(timeline, null, 2), 'utf-8');

    if (topicId === 1) {
      const globalTimelinePath = path.join(spensiaDir, 'spensia_timeline.json');
      fs.writeFileSync(globalTimelinePath, JSON.stringify(timeline, null, 2), 'utf-8');
    }

    return { timeline, saved: true };

    return { timeline, saved: true };
  } catch (err) {
    return { error: err.message };
  }
});

