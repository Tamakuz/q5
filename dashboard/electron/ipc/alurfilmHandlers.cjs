// dashboard/electron/ipc/alurfilmHandlers.cjs
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { parseSrtToEntries } = require('../shared/subtitle-utils.cjs');

function register(ipcMain, { paths: p, media, ffmpeg, aiClient, loadPrompt }) {
  // Ensure alurfilm dirs exist
  if (!fs.existsSync(p.ALURFILM_DIR)) fs.mkdirSync(p.ALURFILM_DIR, { recursive: true });
  if (!fs.existsSync(p.ALURFILM_CHUNKS_DIR)) fs.mkdirSync(p.ALURFILM_CHUNKS_DIR, { recursive: true });
  if (!fs.existsSync(p.ALURFILM_COMPRESS_DIR)) fs.mkdirSync(p.ALURFILM_COMPRESS_DIR, { recursive: true });

  function calculateVideoMaxrateKbps(durationSec) {
    const safeMegabytes = 380;
    const totalBits = safeMegabytes * 8 * 1024 * 1024;
    const duration = Math.max(1, durationSec);
    const totalKbps = Math.floor(totalBits / (1024 * duration));
    const audioKbps = 128;
    return Math.max(500, totalKbps - audioKbps);
  }

  async function encodeAndCompressChunk(ffmpegPath, masterPath, startSec, durationSec, destPath) {
    const maxrateKbps = calculateVideoMaxrateKbps(durationSec);
    const bufsizeKbps = maxrateKbps * 2;

    const runFfmpeg = (args) => new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args);
      proc.stderr.on('data', () => { });
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exit code ${code}`)));
      proc.on('error', reject);
    });

    // 1. Try GPU Hardware Acceleration (NVIDIA NVENC)
    const nvencArgs = [
      '-ss', String(startSec),
      '-i', masterPath,
      '-t', String(durationSec),
      '-c:v', 'h264_nvenc',
      '-preset', 'p4',
      '-rc', 'vbr',
      '-cq', '20',
      '-maxrate', `${maxrateKbps}k`,
      '-bufsize', `${bufsizeKbps}k`,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-avoid_negative_ts', 'make_zero',
      '-y',
      destPath
    ];

    try {
      await runFfmpeg(nvencArgs);
    } catch (gpuErr) {
      // 2. Fallback to Ultra-Fast CPU multi-threaded x264
      const cpuFastArgs = [
        '-ss', String(startSec),
        '-i', masterPath,
        '-t', String(durationSec),
        '-c:v', 'libx264',
        '-preset', 'superfast',
        '-crf', '20',
        '-threads', '0',
        '-maxrate', `${maxrateKbps}k`,
        '-bufsize', `${bufsizeKbps}k`,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-avoid_negative_ts', 'make_zero',
        '-y',
        destPath
      ];
      try {
        await runFfmpeg(cpuFastArgs);
      } catch (cpuErr) {
        // 3. Fallback to ultrafast
        const ultraFastArgs = [
          '-ss', String(startSec),
          '-i', masterPath,
          '-t', String(durationSec),
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '22',
          '-threads', '0',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-avoid_negative_ts', 'make_zero',
          '-y',
          destPath
        ];
        await runFfmpeg(ultraFastArgs);
      }
    }

    // Enforce 400 MB maximum size cap
    const maxSizeBytes = 400 * 1024 * 1024;
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size > maxSizeBytes) {
        const reducedMaxrate = Math.floor(maxrateKbps * 0.8);
        const pass2Args = [
          '-ss', String(startSec),
          '-i', masterPath,
          '-t', String(durationSec),
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '24',
          '-threads', '0',
          '-maxrate', `${reducedMaxrate}k`,
          '-bufsize', `${reducedMaxrate * 2}k`,
          '-c:a', 'aac',
          '-b:a', '128k',
          '-avoid_negative_ts', 'make_zero',
          '-y',
          destPath
        ];
        await runFfmpeg(pass2Args);
      }
    }
  }

  // ─── Upload Alurfilm Source ────────────────────────────
  ipcMain.handle('upload-alurfilm-source', async (_event, { filePath }) => {
    const contentId = p.getOrGenerateContentId('longform');
    const stat = await fs.promises.stat(filePath);
    const baseName = path.basename(filePath);

    return {
      id: contentId,
      name: baseName,
      size: stat.size,
      url: media.mediaUrl(filePath),
      filePath: filePath,
    };
  });

  // ─── Split Alurfilm Video Helper ──────────────────────
  async function splitAlurfilmVideoHelper(event, masterPath, startTime, endTime) {
    const contentId = p.getOrGenerateContentId('longform');
    const chunkDuration = 1200; // Locked at 20 minutes (1200 seconds)

    if (!fs.existsSync(p.ALURFILM_CHUNKS_DIR)) {
      fs.mkdirSync(p.ALURFILM_CHUNKS_DIR, { recursive: true });
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

    if (event && event.sender) {
      event.sender.send('alurfilm-split-progress', {
        status: 'start',
        currentPart: 0,
        totalParts: numParts
      });
    }

    for (let i = 0; i < numParts; i++) {
      const partStartSec = startSec + (i * chunkDuration);
      const partDurationSec = Math.min(chunkDuration, endSec - partStartSec);
      const partNumStr = String(i + 1).padStart(2, '0');
      const outputName = `${contentId}_part_${partNumStr}.mp4`;
      const destPath = path.join(p.ALURFILM_CHUNKS_DIR, outputName);

      if (event && event.sender) {
        event.sender.send('alurfilm-split-progress', {
          status: 'splitting',
          currentPart: i + 1,
          totalParts: numParts
        });
      }

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
        const ffmpegProc = spawn(ffmpeg.ffmpegPath, args);
        ffmpegProc.on('close', (code) => {
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
            const fallbackFfmpeg = spawn(ffmpeg.ffmpegPath, fallbackArgs);
            fallbackFfmpeg.on('close', (fbCode) => {
              if (fbCode !== 0) return reject(new Error(`FFmpeg split failed code ${fbCode}`));
              resolve();
            });
            fallbackFfmpeg.on('error', reject);
          } else {
            resolve();
          }
        });
        ffmpegProc.on('error', (err) => reject(err));
      });

      if (fs.existsSync(destPath)) {
        const stat = fs.statSync(destPath);
        const chunkObj = {
          part: i + 1,
          name: outputName,
          size: stat.size,
          startSec: partStartSec,
          durationSec: partDurationSec,
          filePath: destPath,
          url: media.mediaUrl(destPath),
          isCompressed: false
        };
        createdChunks.push(chunkObj);

        if (event && event.sender) {
          event.sender.send('alurfilm-split-progress', {
            status: 'chunk_completed',
            currentPart: i + 1,
            totalParts: numParts,
            chunk: chunkObj
          });
        }
      }
    }

    if (event && event.sender) {
      event.sender.send('alurfilm-split-progress', {
        status: 'done',
        currentPart: numParts,
        totalParts: numParts,
        chunks: createdChunks
      });
    }

    return createdChunks;
  }

  // ─── IPC: split-alurfilm-video ─────────────────────────
  ipcMain.handle('split-alurfilm-video', async (event, opts) => {
    const masterPath = typeof opts === 'string' ? opts : opts?.masterPath;
    const startTime = opts?.startTime ?? 0;
    const endTime = opts?.endTime ?? 0;
    return splitAlurfilmVideoHelper(event, masterPath, startTime, endTime);
  });

  // ─── IPC: split-alurfilm-master ────────────────────────
  ipcMain.handle('split-alurfilm-master', async (event, opts) => {
    const masterPath = typeof opts === 'string' ? opts : opts?.masterPath;
    const startTime = opts?.startTime ?? 0;
    let endTime = opts?.endTime ?? 0;

    const contentId = p.getOrGenerateContentId('longform');
    if (!endTime || endTime === '00:00:00' || endTime === 0) {
      try {
        const meta = await ffmpeg.getVideoMetaHelper(masterPath);
        if (meta && meta.duration) endTime = meta.duration;
      } catch { }
    }

    const chunks = await splitAlurfilmVideoHelper(event, masterPath, startTime, endTime);
    return { chunks: chunks || [], content_id: contentId };
  });

  // ─── IPC: split-alurfilm-master-range ──────────────────
  ipcMain.handle('split-alurfilm-master-range', async (_event, { masterPath, startSec, durationSec, partNum }) => {
    const contentId = p.getOrGenerateContentId('longform');
    const partStr = String(partNum).padStart(2, '0');
    const outputName = `${contentId}_part_${partStr}.mp4`;
    const destPath = path.join(p.ALURFILM_CHUNKS_DIR, outputName);

    if (!fs.existsSync(p.ALURFILM_CHUNKS_DIR)) {
      fs.mkdirSync(p.ALURFILM_CHUNKS_DIR, { recursive: true });
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
      const ffmpegProc = spawn(ffmpeg.ffmpegPath, args);
      ffmpegProc.on('close', (code) => {
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
          const fallbackFfmpeg = spawn(ffmpeg.ffmpegPath, fallbackArgs);
          fallbackFfmpeg.on('close', () => resolve());
        } else { resolve(); }
      });
      ffmpegProc.on('error', (err) => reject(err));
    });

    const searchDirs = [p.ALURFILM_COMPRESS_DIR, p.ALURFILM_CHUNKS_DIR].filter(d => d && fs.existsSync(d));
    const foundFilesMap = new Map();
    for (const dir of searchDirs) {
      const files = fs.readdirSync(dir);
      files
        .filter(f => f.startsWith(contentId) && f.endsWith('.mp4'))
        .forEach(f => {
          if (!foundFilesMap.has(f)) {
            foundFilesMap.set(f, path.join(dir, f));
          }
        });
    }

    const sortedNames = Array.from(foundFilesMap.keys()).sort();
    const chunks = sortedNames.map((f, idx) => {
      const fullPath = foundFilesMap.get(f);
      const stat = fs.statSync(fullPath);
      return {
        part: idx + 1,
        name: f,
        size: stat.size,
        filePath: fullPath,
        url: media.mediaUrl(fullPath),
        mediaUrl: media.mediaUrl(fullPath),
        isCompressed: fullPath.includes('/compress/')
      };
    });

    return { chunks: chunks || [], content_id: contentId };
  });

  // ─── IPC: compress-alurfilm-chunk ──────────────────────
  ipcMain.handle('compress-alurfilm-chunk', async (_event, opts) => {
    const contentId = p.getOrGenerateContentId('longform');
    const part = typeof opts === 'object' ? opts.part : opts;
    const inputFilePath = opts?.filePath;
    const partStr = String(part).padStart(2, '0');
    const outputName = `${contentId}_part_${partStr}.mp4`;
    const destPath = path.join(p.ALURFILM_COMPRESS_DIR, outputName);

    if (!fs.existsSync(p.ALURFILM_COMPRESS_DIR)) {
      fs.mkdirSync(p.ALURFILM_COMPRESS_DIR, { recursive: true });
    }

    let srcFile = inputFilePath;
    if (!srcFile || !fs.existsSync(srcFile)) {
      srcFile = path.join(p.ALURFILM_CHUNKS_DIR, outputName);
    }

    if (!fs.existsSync(srcFile)) {
      throw new Error(`File part #${part} tidak ditemukan`);
    }

    let durationSec = 1200;
    try {
      const meta = await ffmpeg.getVideoMetaHelper(srcFile);
      if (meta && meta.duration) durationSec = meta.duration;
    } catch { }

    await encodeAndCompressChunk(ffmpeg.ffmpegPath, srcFile, 0, durationSec, destPath);

    const stat = fs.statSync(destPath);
    return {
      part: Number(part),
      name: outputName,
      size: stat.size,
      durationSec: durationSec,
      filePath: destPath,
      url: media.mediaUrl(destPath),
      mediaUrl: media.mediaUrl(destPath),
      isCompressed: true
    };
  });

  // ─── List Alurfilm Chunks ──────────────────────────────
  ipcMain.handle('list-alurfilm-chunks', async (_event, modeContentId) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    const searchDirs = [p.ALURFILM_COMPRESS_DIR, p.ALURFILM_CHUNKS_DIR].filter(d => d && fs.existsSync(d));
    if (searchDirs.length === 0) return [];

    const foundFilesMap = new Map();
    for (const dir of searchDirs) {
      const files = fs.readdirSync(dir);
      files
        .filter(f => f.startsWith(contentId) && f.endsWith('.mp4'))
        .forEach(f => {
          if (!foundFilesMap.has(f)) {
            foundFilesMap.set(f, path.join(dir, f));
          }
        });
    }

    const sortedNames = Array.from(foundFilesMap.keys()).sort();
    const chunks = sortedNames.map((f, idx) => {
      const fullPath = foundFilesMap.get(f);
      const stat = fs.statSync(fullPath);
      return {
        part: idx + 1,
        name: f,
        size: stat.size,
        filePath: fullPath,
        url: media.mediaUrl(fullPath),
        isCompressed: fullPath.includes('/compress/')
      };
    });

    return chunks;
  });

  // ─── Delete Alurfilm Chunk ─────────────────────────────
  ipcMain.handle('delete-alurfilm-chunk', async (_event, opts) => {
    const contentId = p.getOrGenerateContentId('longform');
    const part = typeof opts === 'object' ? opts.part : opts;
    const partStr = String(part).padStart(2, '0');
    const searchDirs = [p.ALURFILM_COMPRESS_DIR, p.ALURFILM_CHUNKS_DIR].filter(d => d && fs.existsSync(d));

    for (const dir of searchDirs) {
      const files = fs.readdirSync(dir);
      const targetFiles = files.filter(f => f.startsWith(`${contentId}_part_${partStr}.mp4`));
      for (const f of targetFiles) {
        try { fs.unlinkSync(path.join(dir, f)); } catch (e) {
          console.error('Failed to delete chunk:', e);
        }
      }
    }
    return true;
  });

  // ─── Analyze Alurfilm Chunk (disabled) ─────────────────
  ipcMain.handle('analyze-alurfilm-chunk', async () => {
    throw new Error('Panggilan API 9router dinonaktifkan. Gunakan workflow manual Copy Prompt & Import Output JSON.');
  });

  // ─── List Alurfilm Analyses ────────────────────────────
  ipcMain.handle('list-alurfilm-analyses', async (_event, modeContentId) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_DIR)) return [];

    const files = fs.readdirSync(p.ALURFILM_DIR);
    const analyses = files
      .filter(f => f.startsWith(contentId) && f.includes('_analysis_part_') && f.endsWith('.json'))
      .sort()
      .map(f => {
        const fullPath = path.join(p.ALURFILM_DIR, f);
        try {
          const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          return { name: f, filePath: fullPath, data };
        } catch { return null; }
      })
      .filter(Boolean);

    return analyses;
  });

  // ─── Get Alurfilm Prompt ───────────────────────────────
  ipcMain.handle('get-alurfilm-prompt', async (_event, { chunkPart, totalChunks = 2, previousContext, styleExample }) => {
    const promptFileName = 'alurfilm-singlepass-prompt.md';
    const promptFile = path.join(p.PROMPTS_DIR, 'longform', promptFileName);
    let promptTemplate = '';
    if (fs.existsSync(promptFile)) {
      promptTemplate = fs.readFileSync(promptFile, 'utf-8');
    } else {
      promptTemplate = `Kamu adalah Master Scriptwriter Alur Film. Tulis naskah voiceover recap Macro Storytelling. Output JSON valid.`;
    }

    const computedWordsPerChunk = 300;
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

  // ─── Save Alurfilm Analysis ────────────────────────────
  ipcMain.handle('save-alurfilm-analysis', async (_event, { chunkPart, jsonText }) => {
    const contentId = p.getOrGenerateContentId('longform');

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

    if (!resultData || typeof resultData !== 'object' || Array.isArray(resultData)) {
      throw new Error('Script Analysis Error: Root JSON output must be a valid JSON Object.');
    }
    if (!resultData.naskah_voiceover || typeof resultData.naskah_voiceover !== 'object') {
      throw new Error('Script Analysis Error: Missing "naskah_voiceover" object in JSON output.');
    }
    if (!resultData.naskah_voiceover.script_text || typeof resultData.naskah_voiceover.script_text !== 'string') {
      throw new Error('Script Analysis Error: Missing or invalid "naskah_voiceover.script_text" string.');
    }

    const partNum = Number(resultData.chunk_part || chunkPart) || 1;
    const words = resultData.naskah_voiceover.script_text.trim().split(/\s+/).filter(Boolean);
    resultData.naskah_voiceover.word_count = words.length;
    resultData.chunk_part = partNum;
    resultData.status = resultData.status || 'done';

    const partStr = String(partNum).padStart(2, '0');
    const outputName = `${contentId}_analysis_part_${partStr}.json`;
    const destPath = path.join(p.ALURFILM_DIR, outputName);

    if (!fs.existsSync(p.ALURFILM_DIR)) {
      fs.mkdirSync(p.ALURFILM_DIR, { recursive: true });
    }

    fs.writeFileSync(destPath, JSON.stringify(resultData, null, 2), 'utf-8');

    return { part: partNum, name: outputName, filePath: destPath, data: resultData };
  });

  // ─── Upload Alurfilm Audio ─────────────────────────────
  ipcMain.handle('upload-alurfilm-audio', async (_event, { parts, filePath }) => {
    const contentId = p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_AUDIO_DIR)) fs.mkdirSync(p.ALURFILM_AUDIO_DIR, { recursive: true });

    const sortedParts = Array.isArray(parts) && parts.length > 0 ? parts.sort((a, b) => a - b) : [1];
    const minPart = String(sortedParts[0]).padStart(2, '0');
    const maxPart = String(sortedParts[sortedParts.length - 1]).padStart(2, '0');
    const partsRange = sortedParts.length === 1 ? minPart : `${minPart}-${maxPart}`;

    const timestamp = Date.now();
    const outputName = `${contentId}_audio_parts_${partsRange}_${timestamp}.wav`;
    const destPath = path.join(p.ALURFILM_AUDIO_DIR, outputName);

    // Re-encode audio to clean 16kHz Mono PCM WAV to guarantee sample accuracy for WhisperX
    await new Promise((resolve, reject) => {
      const args = [
        '-i', filePath,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        '-y',
        destPath
      ];
      const ffmpegProc = spawn(ffmpeg.ffmpegPath, args);
      ffmpegProc.on('close', (code) => {
        if (code === 0 && fs.existsSync(destPath)) {
          resolve();
        } else {
          try {
            fs.copyFileSync(filePath, destPath);
            resolve();
          } catch (err) {
            reject(new Error(`Failed to process audio file: ${err.message}`));
          }
        }
      });
      ffmpegProc.on('error', (err) => {
        try {
          fs.copyFileSync(filePath, destPath);
          resolve();
        } catch (copyErr) {
          reject(err);
        }
      });
    });

    const stat = fs.statSync(destPath);

    const mappingFile = path.join(p.ALURFILM_AUDIO_DIR, `${contentId}_audio_mappings.json`);
    let mappingData = { contentId, audios: [] };
    if (fs.existsSync(mappingFile)) {
      try {
        mappingData = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
      } catch { }
    }

    // Remove overlapping parts from previous audios if needed
    mappingData.audios = (mappingData.audios || []).filter(item => {
      const hasOverlap = item.parts && item.parts.some(pt => sortedParts.includes(pt));
      if (hasOverlap && item.filePath && fs.existsSync(item.filePath)) {
        try { fs.unlinkSync(item.filePath); } catch { }
      }
      return !hasOverlap;
    });

    const audioId = `audio_${timestamp}`;
    const newEntry = {
      id: audioId,
      name: outputName,
      parts: sortedParts,
      filePath: destPath,
      url: media.mediaUrl(destPath),
      size: stat.size,
      createdAt: new Date().toISOString()
    };

    mappingData.audios.push(newEntry);
    fs.writeFileSync(mappingFile, JSON.stringify(mappingData, null, 2), 'utf-8');

    return newEntry;
  });

  // ─── List Alurfilm Audios ──────────────────────────────
  ipcMain.handle('list-alurfilm-audios', async (_event, modeContentId) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_AUDIO_DIR)) return [];

    const mappingFile = path.join(p.ALURFILM_AUDIO_DIR, `${contentId}_audio_mappings.json`);
    if (!fs.existsSync(mappingFile)) return [];

    try {
      const data = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
      const validAudios = (data.audios || []).filter(item => fs.existsSync(item.filePath));
      return validAudios;
    } catch {
      return [];
    }
  });

  // ─── Delete Alurfilm Audio ─────────────────────────────
  ipcMain.handle('delete-alurfilm-audio', async (_event, { id }) => {
    const contentId = p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_AUDIO_DIR)) return true;

    const mappingFile = path.join(p.ALURFILM_AUDIO_DIR, `${contentId}_audio_mappings.json`);
    if (!fs.existsSync(mappingFile)) return true;

    try {
      const data = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
      const targetItem = (data.audios || []).find(item => item.id === id);
      if (targetItem && fs.existsSync(targetItem.filePath)) {
        try { fs.unlinkSync(targetItem.filePath); } catch { }
      }
      data.audios = (data.audios || []).filter(item => item.id !== id);
      fs.writeFileSync(mappingFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch { }
    return true;
  });

  // ─── Get Alurfilm Transcript Prompt ────────────────────
  ipcMain.handle('get-alurfilm-transcript-prompt', async (_event, { chunkPart, totalChunks = 2 }) => {
    const contentId = p.getOrGenerateContentId('longform');
    const promptFileName = 'alurfilm-transcript-prompt.md';
    const promptFile = path.join(p.PROMPTS_DIR, 'longform', promptFileName);
    let promptTemplate = '';
    if (fs.existsSync(promptFile)) {
      promptTemplate = fs.readFileSync(promptFile, 'utf-8');
    } else {
      promptTemplate = `Kamu adalah AI Audio Transcriber presisi tinggi. Transkrip audio part ${chunkPart} ke SRT dengan timecode. Durasi: {{audio_duration}}.`;
    }

    let audioDurationText = `[Sesuai total durasi file audio Part #${chunkPart}]`;
    let audioFileSizeText = `[File audio Part #${chunkPart}]`;
    let audioWordEstimateText = `[Estimasi ~2500 kata per 20 menit]`;
    let audioEtaText = `[Estimasi sesuai durasi audio]`;
    let targetParts = [Number(chunkPart)];

    if (fs.existsSync(p.ALURFILM_AUDIO_DIR)) {
      const mappingFile = path.join(p.ALURFILM_AUDIO_DIR, `${contentId}_audio_mappings.json`);
      if (fs.existsSync(mappingFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
          const audioEntry = (data.audios || []).find(item => item.parts && item.parts.includes(Number(chunkPart)));
          if (audioEntry) {
            if (Array.isArray(audioEntry.parts) && audioEntry.parts.length > 0) {
              targetParts = audioEntry.parts;
            }
            if (audioEntry.filePath && fs.existsSync(audioEntry.filePath)) {
              const stat = fs.statSync(audioEntry.filePath);
              const mb = (stat.size / (1024 * 1024)).toFixed(1);
              audioFileSizeText = `${mb} MB (${path.basename(audioEntry.filePath)})`;

              const meta = await ffmpeg.getVideoMetaHelper(audioEntry.filePath);
              if (meta && meta.duration && meta.duration > 0) {
                const dur = meta.duration;
                const m = Math.floor(dur / 60);
                const s = Math.floor(dur % 60);
                const minStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                audioDurationText = `${dur.toFixed(1)} Detik (${minStr})`;
                audioEtaText = `${minStr} (Waktu playback audio penuh)`;

                const estWords = Math.round(dur * 2.5);
                audioWordEstimateText = `~${estWords} Kata (Estimasi kecepatan 2.5 kata/detik)`;
              }
            }
          }
        } catch { }
      }
    }

    const targetPartsText = targetParts.map(pt => `Part #${pt}`).join(', ');

    // Fetch reference scripts from Step 2 Script Analysis for all target parts
    const referenceScriptSections = [];
    for (const pt of targetParts) {
      const ptStr = String(pt).padStart(2, '0');
      const analysisPath = path.join(p.ALURFILM_DIR, `${contentId}_analysis_part_${ptStr}.json`);
      if (fs.existsSync(analysisPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
          const scriptText = data.naskah_voiceover?.script_text || data.script_text || '';
          if (scriptText) {
            referenceScriptSections.push(`--- NASKAH ACUAN PART #${pt} ---\n${scriptText.trim()}`);
          }
        } catch { }
      }
    }

    const referenceScriptText = referenceScriptSections.length > 0
      ? referenceScriptSections.join('\n\n')
      : '[Naskah acuan tidak ditemukan di Step 2, mohon transkrip berdasarkan pendengaran audio riil]';

    const isMultiPart = targetParts.length > 1;
    const outputFormatInstruction = isMultiPart
      ? `Keluarkan HANYA SRT Subtitle untuk seluruh bagian audio.`
      : `Keluarkan HANYA SRT Subtitle murni.`;

    const fullPrompt = promptTemplate
      .replace(/{{chunk_part}}/g, String(chunkPart))
      .replace(/{{total_chunks}}/g, String(totalChunks))
      .replace(/{{target_parts_text}}/g, targetPartsText)
      .replace(/{{audio_duration}}/g, audioDurationText)
      .replace(/{{audio_file_size}}/g, audioFileSizeText)
      .replace(/{{audio_word_estimate}}/g, audioWordEstimateText)
      .replace(/{{audio_eta}}/g, audioEtaText)
      .replace(/{{reference_script}}/g, referenceScriptText)
      .replace(/{{output_format_instruction}}/g, outputFormatInstruction);

    return fullPrompt;
  });

  function parseTranscriptPayload(parsed) {
    if (!parsed) return { isMultiPart: false, multiPartMap: null, entries: [] };

    let current = parsed;
    // Step 1: Unwrap single-element arrays if the element is an object that wraps parts/data/result
    while (Array.isArray(current) && current.length === 1 && (Array.isArray(current[0]) || (typeof current[0] === 'object' && current[0] !== null))) {
      const item = current[0];
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        if (item.text || item.narration || item.speech || item.content || item.start_seconds !== undefined || item.start !== undefined) {
          break;
        }
      }
      current = current[0];
    }

    // Step 2: Unwrap single wrapper objects like { "data": [...] } or { "result": { "1": [...] } }
    if (!Array.isArray(current) && typeof current === 'object' && current !== null) {
      for (const wrapperKey of ['data', 'transcript', 'transcripts', 'items', 'result', 'sentences', 'dialogue', 'response']) {
        if (current[wrapperKey] && (Array.isArray(current[wrapperKey]) || typeof current[wrapperKey] === 'object')) {
          current = current[wrapperKey];
          break;
        }
      }
    }

    const multiPartMap = {};
    let foundMultiPart = false;

    // Case A: Object with part keys: { "1": [...], "2": [...] } or { "part_1": [...] }
    if (!Array.isArray(current) && typeof current === 'object' && current !== null) {
      const keys = Object.keys(current);
      for (const k of keys) {
        const match = k.match(/\d+/);
        if (match) {
          const pt = parseInt(match[0], 10);
          const val = current[k];
          let rawEntries = [];
          if (Array.isArray(val)) {
            rawEntries = val;
          } else if (typeof val === 'object' && val !== null) {
            rawEntries = val.entries || val.data || val.transcript || val.sentences || [val];
          } else if (typeof val === 'string') {
            rawEntries = [val];
          }

          if (rawEntries.length > 0) {
            multiPartMap[pt] = rawEntries;
            foundMultiPart = true;
          }
        }
      }
    }

    // Case B: Array of items. Could be array of Part objects like [ { "part": 1, "entries": [...] } ]
    if (Array.isArray(current)) {
      let isArrayOfPartObjects = false;
      for (const item of current) {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const hasPartNum = item.part !== undefined || item.part_number !== undefined || item.partNum !== undefined || item.part_id !== undefined;
          const hasDigitKeys = Object.keys(item).some(k => /\d+/.test(k) && (Array.isArray(item[k]) || typeof item[k] === 'object'));
          if (hasPartNum || hasDigitKeys) {
            isArrayOfPartObjects = true;
            break;
          }
        }
      }

      if (isArrayOfPartObjects) {
        for (let i = 0; i < current.length; i++) {
          const item = current[i];
          if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
            const ptNum = item.part ?? item.part_number ?? item.partNum ?? item.part_id;
            const rawEntries = item.entries || item.data || item.transcript || item.sentences;

            if (ptNum !== undefined && Array.isArray(rawEntries) && rawEntries.length > 0) {
              multiPartMap[Number(ptNum)] = rawEntries;
              foundMultiPart = true;
            } else {
              for (const k of Object.keys(item)) {
                const match = k.match(/\d+/);
                if (match) {
                  const pt = parseInt(match[0], 10);
                  const val = item[k];
                  const subEntries = Array.isArray(val) ? val : (typeof val === 'object' && val !== null ? (val.entries || [val]) : [val]);
                  if (subEntries.length > 0) {
                    multiPartMap[pt] = subEntries;
                    foundMultiPart = true;
                  }
                }
              }
            }
          } else if (Array.isArray(item)) {
            multiPartMap[i + 1] = item;
            foundMultiPart = true;
          }
        }
      }
    }

    if (foundMultiPart && Object.keys(multiPartMap).length > 0) {
      return {
        isMultiPart: true,
        multiPartMap,
        entries: null
      };
    }

    const rawArray = Array.isArray(current) ? current : [current];
    return {
      isMultiPart: false,
      multiPartMap: null,
      entries: rawArray
    };
  }

  function normalizeBackendEntry(entry, idx, prevEndSec = 0) {
    if (!entry || typeof entry !== 'object') {
      const strVal = String(entry || '').trim();
      const startSec = prevEndSec;
      const endSec = startSec + 3;
      const m1 = Math.floor(startSec / 60); const s1 = Math.floor(startSec % 60);
      const m2 = Math.floor(endSec / 60); const s2 = Math.floor(endSec % 60);
      const defaultTs = `${String(m1).padStart(2, '0')}:${String(s1).padStart(2, '0')} - ${String(m2).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;

      return {
        id: idx + 1,
        start_seconds: Number(startSec.toFixed(1)),
        end_seconds: Number(endSec.toFixed(1)),
        timestamp_minute: defaultTs,
        text: strVal,
        speaker: 'Narator',
      };
    }

    let textStr = entry.text || entry.narration || entry.speech || entry.content ||
      entry.dialogue || entry.sentence || entry.line || entry.naskah ||
      entry.script || entry.kalimat || entry.transcript || '';

    if (!textStr && typeof entry === 'object') {
      for (const [k, v] of Object.entries(entry)) {
        if (['id', 'start', 'end', 'start_seconds', 'end_seconds', 'timestamp', 'timestamp_minute', 'speaker', 'part', 'part_number'].includes(k.toLowerCase())) {
          continue;
        }
        if (typeof v === 'string' && v.trim().length > 0) {
          textStr = v;
          break;
        }
      }
    }

    let rawStart = entry.start_seconds !== undefined ? entry.start_seconds : (entry.start !== undefined ? entry.start : (entry.startTime !== undefined ? entry.startTime : entry.from));
    let rawEnd = entry.end_seconds !== undefined ? entry.end_seconds : (entry.end !== undefined ? entry.end : (entry.endTime !== undefined ? entry.endTime : entry.to));

    const timeStr = entry.timestamp_minute || entry.timestamp || entry.time || entry.time_range || entry.timeframe;
    if ((rawStart === undefined || rawEnd === undefined) && typeof timeStr === 'string') {
      const matches = timeStr.match(/(\d+:\d+(?::\d+)?|\d+(?:\.\d+)?)/g);
      if (matches && matches.length >= 2) {
        const parseSec = (s) => {
          if (s.includes(':')) {
            const parts = s.split(':').map(Number);
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return parts[0] * 60 + parts[1];
          }
          return parseFloat(s) || 0;
        };
        if (rawStart === undefined) rawStart = parseSec(matches[0]);
        if (rawEnd === undefined) rawEnd = parseSec(matches[1]);
      }
    }

    const startSec = typeof rawStart === 'number' && !isNaN(rawStart)
      ? rawStart
      : (parseFloat(String(rawStart)) || prevEndSec);

    const endSec = typeof rawEnd === 'number' && !isNaN(rawEnd)
      ? rawEnd
      : (parseFloat(String(rawEnd)) || (startSec + 3));

    const m1 = Math.floor(startSec / 60); const s1 = Math.floor(startSec % 60);
    const m2 = Math.floor(endSec / 60); const s2 = Math.floor(endSec % 60);
    const defaultTs = `${String(m1).padStart(2, '0')}:${String(s1).padStart(2, '0')} - ${String(m2).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;

    return {
      id: typeof entry.id === 'number' ? entry.id : (idx + 1),
      start_seconds: Number(startSec.toFixed(1)),
      end_seconds: Number(endSec.toFixed(1)),
      timestamp_minute: String(timeStr || defaultTs),
      text: String(textStr || ''),
      type: entry.type || (String(textStr || '').includes('VISUAL_ONLY') ? 'visual_only' : 'narration'),
      speaker: entry.speaker || (entry.type === 'visual_only' || String(textStr || '').includes('VISUAL_ONLY') ? 'Visual' : 'Narator'),
    };
  }

  // ─── Save Alurfilm Transcript ──────────────────────────
  ipcMain.handle('save-alurfilm-transcript', async (_event, arg1, arg2, arg3) => {
    const contentId = p.getOrGenerateContentId('longform');
    const targetDir = p.ALURFILM_TRANSCRIPTS_DIR || path.join(p.ALURFILM_DIR, 'transcripts');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    let chunkPart = 1;
    let jsonText = null;

    if (typeof arg1 === 'object' && arg1 !== null && !Array.isArray(arg1)) {
      if ('chunkPart' in arg1 || 'jsonText' in arg1) {
        chunkPart = Number(arg1.chunkPart) || 1;
        jsonText = arg1.jsonText;
      } else {
        jsonText = arg1;
      }
    } else if (typeof arg1 === 'string' && (typeof arg2 === 'number' || !isNaN(Number(arg2)))) {
      chunkPart = Number(arg2);
      jsonText = arg3;
    } else if (typeof arg1 === 'number' || !isNaN(Number(arg1))) {
      chunkPart = Number(arg1);
      jsonText = arg2;
    }

    if (!jsonText) {
      throw new Error('Transcript payload is empty or invalid.');
    }

    let raw = (typeof jsonText === 'string' ? jsonText : JSON.stringify(jsonText)).trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json|srt)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
    }

    let parsed = null;
    let srtEntries = [];

    if (raw.includes('-->') || (!raw.startsWith('{') && !raw.startsWith('['))) {
      srtEntries = parseSrtToEntries(raw);
    } else {
      try {
        parsed = JSON.parse(raw);
      } catch {
        srtEntries = parseSrtToEntries(raw);
      }
    }

    let parsedInfo = { isMultiPart: false, multiPartMap: null, entries: [] };
    if (parsed) {
      parsedInfo = parseTranscriptPayload(parsed);
    } else if (srtEntries.length > 0) {
      parsedInfo = { isMultiPart: false, multiPartMap: null, entries: srtEntries };
    }
    const savedResults = [];

    if (parsedInfo.isMultiPart && parsedInfo.multiPartMap) {
      const keys = Object.keys(parsedInfo.multiPartMap);
      for (const k of keys) {
        const pt = parseInt(k, 10);
        const entries = parsedInfo.multiPartMap[pt];
        if (Array.isArray(entries) && entries.length > 0) {
          const partStr = String(pt).padStart(2, '0');
          const outputName = `${contentId}_transcript_part_${partStr}.json`;
          const destPath = path.join(targetDir, outputName);

          let prevEnd = 0;
          const normEntries = entries.map((e, idx) => {
            const res = normalizeBackendEntry(e, idx, prevEnd);
            prevEnd = res.end_seconds;
            return res;
          });
          fs.writeFileSync(destPath, JSON.stringify(normEntries, null, 2), 'utf-8');

          const rootLegacyPath = path.join(p.ALURFILM_DIR, outputName);
          if (fs.existsSync(rootLegacyPath)) {
            try { fs.unlinkSync(rootLegacyPath); } catch { }
          }

          savedResults.push({ part: pt, name: outputName, filePath: destPath, data: normEntries, entries: normEntries });
        }
      }
    }

    if (savedResults.length > 0) {
      return { multiPart: true, savedResults, part: chunkPart };
    }

    // Fallback: single part array save
    const partStr = String(chunkPart).padStart(2, '0');
    const outputName = `${contentId}_transcript_part_${partStr}.json`;
    const destPath = path.join(targetDir, outputName);

    const rawEntries = parsedInfo.entries && parsedInfo.entries.length > 0 ? parsedInfo.entries : (Array.isArray(parsed) ? parsed : [parsed]);
    let prevEnd = 0;
    const entriesArray = rawEntries.map((e, idx) => {
      const res = normalizeBackendEntry(e, idx, prevEnd);
      prevEnd = res.end_seconds;
      return res;
    });

    fs.writeFileSync(destPath, JSON.stringify(entriesArray, null, 2), 'utf-8');

    const rootLegacyPath = path.join(p.ALURFILM_DIR, outputName);
    if (fs.existsSync(rootLegacyPath)) {
      try { fs.unlinkSync(rootLegacyPath); } catch { }
    }

    return { part: chunkPart, name: outputName, filePath: destPath, data: entriesArray, entries: entriesArray };
  });

  // ─── Run WhisperX Alignment ─────────────────────────────
  ipcMain.handle('run-alurfilm-whisperx-alignment', async (event, { parts, audioPath }) => {
    const contentId = p.getOrGenerateContentId('longform');
    const sortedParts = Array.isArray(parts) && parts.length > 0 ? [...parts].sort((a, b) => a - b) : [1];

    function sendProgress(stage, progress, log) {
      if (event && event.sender) {
        event.sender.send('alurfilm-alignment-progress', { stage, progress, log });
      }
    }

    sendProgress('preparing', 5, `Starting Faster-Whisper & Silence Gap Alignment for Parts #${sortedParts.join(', #')}...`);

    // Resolve target audio path
    let targetAudioPath = audioPath;
    if (!targetAudioPath || !fs.existsSync(targetAudioPath)) {
      const mappingFile = path.join(p.ALURFILM_AUDIO_DIR, `${contentId}_audio_mappings.json`);
      if (fs.existsSync(mappingFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
          const audioEntry = (data.audios || []).find(item => item.parts && item.parts.some(pt => sortedParts.includes(pt)));
          if (audioEntry && audioEntry.filePath && fs.existsSync(audioEntry.filePath)) {
            targetAudioPath = audioEntry.filePath;
          }
        } catch { }
      }
    }

    if (!targetAudioPath || !fs.existsSync(targetAudioPath)) {
      throw new Error(`Voiceover audio file not found for Parts #${sortedParts.join(', #')}. Please upload audio first.`);
    }

    const savedResults = [];
    const multiPartMap = {};
    const projectRoot = p.PROJECT_ROOT || path.resolve(__dirname, '..', '..', '..');
    const pythonBin = path.join(projectRoot, 'whisperx', 'venv', 'bin', 'python3');
    const alignCli = path.join(projectRoot, 'whisperx', 'align_cli.py');
    const targetDir = p.ALURFILM_TRANSCRIPTS_DIR || path.join(p.ALURFILM_DIR, 'transcripts');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    for (const pt of sortedParts) {
      const partStr = String(pt).padStart(2, '0');
      const analysisPath = path.join(p.ALURFILM_DIR, `${contentId}_analysis_part_${partStr}.json`);
      let scriptText = '';
      if (fs.existsSync(analysisPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
          scriptText = data.naskah_voiceover?.script_text || data.script_text || '';
        } catch { }
      }

      if (!scriptText) {
        throw new Error(`Script analysis file not found for Part #${pt}. Please generate script first.`);
      }

      // Step 1: Parse raw script into narration and visual_only elements
      const tagRegex = /\[VISUAL_ONLY:\s*([\d.]+)\s*s?\s*(?:\|\s*([^\]]+))?\]/gi;
      const scriptElements = [];
      let lastIndex = 0;
      let match;

      while ((match = tagRegex.exec(scriptText)) !== null) {
        const textBefore = scriptText.slice(lastIndex, match.index).trim();
        if (textBefore) {
          const sents = textBefore.split(/(?<=[.!?])\s+/).filter(Boolean);
          for (const st of sents) {
            scriptElements.push({ type: 'narration', text: st });
          }
        }

        const silenceDur = Math.max(1.0, parseFloat(match[1]) || 5.0);
        const desc = (match[2] || 'Adegan Visual Murni Action').trim();
        scriptElements.push({
          type: 'visual_only',
          text: `[VISUAL_ONLY: ${desc}]`,
          description: desc,
          duration: silenceDur
        });

        lastIndex = tagRegex.lastIndex;
      }

      const textAfter = scriptText.slice(lastIndex).trim();
      if (textAfter) {
        const sents = textAfter.split(/(?<=[.!?])\s+/).filter(Boolean);
        for (const st of sents) {
          scriptElements.push({ type: 'narration', text: st });
        }
      }

      // Step 2: Extract CLEAN narration sentences ONLY for Faster-Whisper
      const narrationSentencesOnly = scriptElements
        .filter(el => el.type === 'narration')
        .map(el => el.text)
        .join('\n');

      const timestamp = Date.now();
      const tempNarasiPath = path.join(p.TMP_DIR, `${contentId}_narasi_part_${partStr}_${timestamp}.txt`);
      const tempOutputPath = path.join(p.TMP_DIR, `${contentId}_alignment_part_${partStr}_${timestamp}.json`);
      fs.writeFileSync(tempNarasiPath, narrationSentencesOnly || 'Naskah alur film.', 'utf-8');

      let whisperSentences = [];
      let isFasterWhisperUsed = false;

      if (fs.existsSync(pythonBin) && fs.existsSync(alignCli)) {
        try {
          sendProgress('transcribing', 30, `Part #${pt}: Running Faster-Whisper alignment on narration text...`);
          await new Promise((resolve, reject) => {
            const proc = spawn(pythonBin, [alignCli, '--audio', targetAudioPath, '--text', tempNarasiPath, '--output', tempOutputPath, '--model', 'medium', '--device', 'cpu'], {
              cwd: projectRoot,
              env: { ...process.env, PYTHONSAFEPATH: '1' }
            });
            proc.on('close', (code) => code === 0 && fs.existsSync(tempOutputPath) ? resolve() : reject(new Error(`Faster-Whisper exit code ${code}`)));
            proc.on('error', reject);
          });

          if (fs.existsSync(tempOutputPath)) {
            const data = JSON.parse(fs.readFileSync(tempOutputPath, 'utf-8'));
            const parsedData = Array.isArray(data) ? data : (data.transcript || data.sentences || []);
            whisperSentences = parsedData.map((item, idx) => {
              let rawSpeechEnd = item.end_seconds !== undefined ? item.end_seconds : (item.end || 0);
              let firstWordStart = item.start_seconds !== undefined ? item.start_seconds : (item.start || 0);
              if (Array.isArray(item.words) && item.words.length > 0) {
                const firstWord = item.words[0];
                const lastWord = item.words[item.words.length - 1];
                if (firstWord && firstWord.start !== undefined) firstWordStart = firstWord.start;
                if (lastWord && lastWord.end !== undefined) rawSpeechEnd = lastWord.end;
              }
              return {
                sentence_index: idx,
                text: item.text || item.kalimat || item.narration || '',
                start: Number((item.start_seconds !== undefined ? item.start_seconds : (item.start || 0)).toFixed(3)),
                end: Number((item.end_seconds !== undefined ? item.end_seconds : (item.end || 0)).toFixed(3)),
                firstWordStart: Number(Number(firstWordStart).toFixed(3)),
                lastWordEnd: Number(Number(rawSpeechEnd).toFixed(3))
              };
            });
            isFasterWhisperUsed = true;
          }
        } catch (err) {
          console.warn(`Part #${pt}: Faster-Whisper alignment failed, falling back to script estimation:`, err.message);
        }
      }

      // Clean temp script/output
      try { fs.unlinkSync(tempNarasiPath); } catch { }
      try { fs.unlinkSync(tempOutputPath); } catch { }

      // Step 3: Map aligned sentences to scriptElements
      let whisperIdx = 0;
      let simClock = 0;

      const alignedElements = scriptElements.map((el, idx) => {
        if (el.type === 'narration') {
          const nextEl = idx < scriptElements.length - 1 ? scriptElements[idx + 1] : null;
          const isFollowedByVisualOnly = nextEl && nextEl.type === 'visual_only';

          if (isFasterWhisperUsed && whisperIdx < whisperSentences.length) {
            const w = whisperSentences[whisperIdx++];
            const lastWordEnd = w.lastWordEnd || w.end;
            const firstWordStart = w.firstWordStart || w.start;
            const actualEnd = isFollowedByVisualOnly ? lastWordEnd : w.end;
            simClock = actualEnd;
            return {
              ...el,
              start: w.start,
              end: actualEnd,
              firstWordStart,
              lastWordEnd
            };
          } else {
            const words = (el.text || '').split(/\s+/).filter(Boolean);
            const dur = Math.max(2.5, Number((words.length / 3.0).toFixed(3)));
            const start = Number(simClock.toFixed(3));
            simClock += dur;
            const end = Number(simClock.toFixed(3));
            return { ...el, start, end };
          }
        }
        return el;
      });

      // Step 4: Check if FFmpeg audio splicing with silence buffer is needed
      const hasVisualOnly = scriptElements.some(el => el.type === 'visual_only');
      let finalPartAudioPath = targetAudioPath;
      const audioSplits = [];

      if (hasVisualOnly && fs.existsSync(targetAudioPath)) {
        try {
          const audioMeta = await ffmpeg.getVideoMetaHelper(targetAudioPath);
          const totalRawAudioDur = (audioMeta && audioMeta.duration) ? audioMeta.duration : 0.0;
          let lastCutTime = 0.0;

          for (let i = 0; i < alignedElements.length; i++) {
            const current = alignedElements[i];
            if (current.type === 'visual_only') {
              let prevNarr = null;
              for (let k = i - 1; k >= 0; k--) {
                if (alignedElements[k].type === 'narration') {
                  prevNarr = alignedElements[k];
                  break;
                }
              }

              let nextNarr = null;
              for (let k = i + 1; k < alignedElements.length; k++) {
                if (alignedElements[k].type === 'narration') {
                  nextNarr = alignedElements[k];
                  break;
                }
              }

              if (prevNarr && prevNarr.end !== undefined) {
                const cutEnd = Math.min(totalRawAudioDur, Number(prevNarr.end.toFixed(3)));
                if (cutEnd > lastCutTime) {
                  audioSplits.push({
                    type: 'audio_chunk',
                    startSec: Number(lastCutTime.toFixed(3)),
                    endSec: Number(cutEnd.toFixed(3))
                  });
                }

                if (nextNarr && nextNarr.firstWordStart !== undefined) {
                  lastCutTime = Math.max(cutEnd, Number(nextNarr.firstWordStart.toFixed(3)));
                } else {
                  lastCutTime = cutEnd;
                }
              }

              audioSplits.push({
                type: 'silence_buffer',
                durationSec: Number((current.duration || 5.0).toFixed(3)),
                element: current
              });
            }
          }

          if (totalRawAudioDur > lastCutTime + 0.05) {
            audioSplits.push({
              type: 'audio_chunk',
              startSec: Number(lastCutTime.toFixed(3)),
              endSec: Number(totalRawAudioDur.toFixed(3))
            });
            lastCutTime = totalRawAudioDur;
          }

          // Calculate cumulative splicedStart & splicedEnd for precise timestamp mapping
          let currentSplicedClock = 0.0;
          for (let j = 0; j < audioSplits.length; j++) {
            const item = audioSplits[j];
            if (item.type === 'audio_chunk') {
              item.splicedStart = Number(currentSplicedClock.toFixed(3));
              item.splicedEnd = Number((currentSplicedClock + (item.endSec - item.startSec)).toFixed(3));
              currentSplicedClock = item.splicedEnd;
            } else {
              item.splicedStart = Number(currentSplicedClock.toFixed(3));
              item.splicedEnd = Number((currentSplicedClock + item.durationSec).toFixed(3));
              currentSplicedClock = item.splicedEnd;
            }
          }

          if (audioSplits.length > 0) {
            sendProgress('splicing_audio', 85, `Part #${pt}: Splicing audio and inserting ${audioSplits.filter(s => s.type === 'silence_buffer').length} silence gaps via FFmpeg...`);
            const tempFiles = [];
            for (let i = 0; i < audioSplits.length; i++) {
              const item = audioSplits[i];
              const tempChunkPath = path.join(p.ALURFILM_AUDIO_DIR, `temp_part_${pt}_chunk_${timestamp}_${i}.wav`);
              tempFiles.push(tempChunkPath);

              if (item.type === 'audio_chunk') {
                const ss = Math.max(0, item.startSec);
                const to = Math.max(ss + 0.01, item.endSec);
                const dur = Number((to - ss).toFixed(3));
                await new Promise((res, rej) => {
                  const proc = spawn(ffmpeg.ffmpegPath, ['-i', targetAudioPath, '-ss', String(ss), '-t', String(dur), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', tempChunkPath]);
                  proc.on('close', (c) => c === 0 && fs.existsSync(tempChunkPath) ? res() : rej(new Error(`Slice error ${c}`)));
                  proc.on('error', rej);
                });
              } else {
                const silenceDur = Number((item.durationSec || 5.0).toFixed(3));
                await new Promise((res, rej) => {
                  const proc = spawn(ffmpeg.ffmpegPath, ['-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', String(silenceDur), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', tempChunkPath]);
                  proc.on('close', (c) => c === 0 && fs.existsSync(tempChunkPath) ? res() : rej(new Error(`Silence error ${c}`)));
                  proc.on('error', rej);
                });
              }
            }

            const listFilePath = path.join(p.ALURFILM_AUDIO_DIR, `concat_list_part_${pt}_${timestamp}.txt`);
            const listContent = tempFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
            fs.writeFileSync(listFilePath, listContent, 'utf-8');

            const outputSplicedName = `${contentId}_audio_part_${partStr}_spliced_${timestamp}.wav`;
            const splicedOutPath = path.join(p.ALURFILM_AUDIO_DIR, outputSplicedName);

            await new Promise((res, rej) => {
              const proc = spawn(ffmpeg.ffmpegPath, ['-f', 'concat', '-safe', '0', '-i', listFilePath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', splicedOutPath]);
              proc.on('close', (c) => c === 0 && fs.existsSync(splicedOutPath) ? res() : rej(new Error(`Concat error ${c}`)));
              proc.on('error', rej);
            });

            try { fs.unlinkSync(listFilePath); } catch { }
            for (const f of tempFiles) { try { fs.unlinkSync(f); } catch { } }

            finalPartAudioPath = splicedOutPath;

            // Update audio mappings json file with the new spliced audio path
            const mappingFile = path.join(p.ALURFILM_AUDIO_DIR, `${contentId}_audio_mappings.json`);
            if (fs.existsSync(mappingFile)) {
              try {
                const mapData = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
                if (Array.isArray(mapData.audios)) {
                  const targetAudioEntry = mapData.audios.find(item => item.parts && item.parts.includes(pt));
                  if (targetAudioEntry) {
                    const splicedStat = fs.statSync(splicedOutPath);
                    targetAudioEntry.filePath = splicedOutPath;
                    targetAudioEntry.name = outputSplicedName;
                    targetAudioEntry.url = media.mediaUrl(splicedOutPath);
                    targetAudioEntry.size = splicedStat.size;
                    targetAudioEntry.isSpliced = true;
                    targetAudioEntry.splicedAt = new Date().toISOString();
                    fs.writeFileSync(mappingFile, JSON.stringify(mapData, null, 2), 'utf-8');
                  }
                }
              } catch (mapErr) {
                console.warn(`Part #${pt}: Failed to update audio mapping with spliced file:`, mapErr.message);
              }
            }
          }
        } catch (err) {
          console.warn(`Part #${pt}: FFmpeg audio splicing failed, keeping original audio:`, err.message);
        }
      }

      // Step 5: Construct distinct transcript entries for narration vs visual_only
      const partEntries = [];
      let itemCounter = 1;
      let clockSec = 0.0;
      const audioSpliced = hasVisualOnly && audioSplits.length > 0;

      for (let i = 0; i < alignedElements.length; i++) {
        const current = alignedElements[i];
        if (current.type === 'visual_only') {
          const silenceItem = audioSplits.find(s => s.type === 'silence_buffer' && s.element === current);
          const start = (audioSpliced && silenceItem)
            ? silenceItem.splicedStart
            : Number(clockSec.toFixed(3));
          const duration = (audioSpliced && silenceItem)
            ? Number((silenceItem.splicedEnd - silenceItem.splicedStart).toFixed(3))
            : Number((current.duration || 5.0).toFixed(3));
          const end = (audioSpliced && silenceItem)
            ? silenceItem.splicedEnd
            : Number((start + duration).toFixed(3));

          clockSec = end;

          const m1 = Math.floor(start / 60); const s1 = Math.floor(start % 60);
          const m2 = Math.floor(end / 60); const s2 = Math.floor(end % 60);
          const tsMin = `${String(m1).padStart(2, '0')}:${String(s1).padStart(2, '0')} - ${String(m2).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;

          partEntries.push({
            id: itemCounter++,
            start_seconds: start,
            end_seconds: end,
            timestamp_minute: tsMin,
            text: current.text,
            type: 'visual_only',
            speaker: 'Visual'
          });
        } else {
          const origStart = current.start !== undefined ? current.start : 0;
          const origEnd = current.end !== undefined ? current.end : (origStart + 3.0);
          const rawDuration = Math.max(0.5, Number((origEnd - origStart).toFixed(3)));

          let start = 0.0;
          let end = 0.0;

          if (audioSpliced && audioSplits.length > 0) {
            let matchingChunk = audioSplits.find(item => item.type === 'audio_chunk' && origStart >= item.startSec && origStart <= item.endSec);
            if (!matchingChunk) {
              matchingChunk = audioSplits.filter(item => item.type === 'audio_chunk').find(item => origStart <= item.endSec) || audioSplits.filter(item => item.type === 'audio_chunk').pop();
            }

            if (matchingChunk) {
              const offset = Math.max(0, origStart - matchingChunk.startSec);
              start = Number((matchingChunk.splicedStart + offset).toFixed(3));
              end = Number((start + rawDuration).toFixed(3));
            } else {
              start = Number(clockSec.toFixed(3));
              end = Number((start + rawDuration).toFixed(3));
            }
          } else {
            start = Number((current.start !== undefined ? current.start : clockSec).toFixed(3));
            end = Number((current.end !== undefined ? current.end : (start + rawDuration)).toFixed(3));
          }

          clockSec = Math.max(clockSec, end);

          const m1 = Math.floor(start / 60); const s1 = Math.floor(start % 60);
          const m2 = Math.floor(end / 60); const s2 = Math.floor(end % 60);
          const tsMin = `${String(m1).padStart(2, '0')}:${String(s1).padStart(2, '0')} - ${String(m2).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;

          partEntries.push({
            id: itemCounter++,
            start_seconds: start,
            end_seconds: end,
            timestamp_minute: tsMin,
            text: current.text,
            type: 'narration',
            speaker: 'Narator'
          });
        }
      }

      // Save Part Transcript
      const outputName = `${contentId}_transcript_part_${partStr}.json`;
      const destPath = path.join(targetDir, outputName);
      fs.writeFileSync(destPath, JSON.stringify(partEntries, null, 2), 'utf-8');

      multiPartMap[pt] = partEntries;
      savedResults.push({ part: pt, name: outputName, filePath: destPath, data: partEntries, entries: partEntries });

      sendProgress('mapping', 95, `Part #${pt}: Created ${partEntries.length} transcript entries (${partEntries.filter(e => e.type === 'visual_only').length} Visual-Only gaps).`);
    }

    sendProgress('done', 100, `Successfully aligned & spliced audio with Visual-Only gaps for Parts #${sortedParts.join(', #')}!`);
    return { success: true, savedResults, multiPartMap };
  });

  // ─── List Alurfilm Transcripts ─────────────────────────
  ipcMain.handle('list-alurfilm-transcripts', async (_event, modeContentId) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    const targetDir = p.ALURFILM_TRANSCRIPTS_DIR || path.join(p.ALURFILM_DIR, 'transcripts');

    const searchDirs = [targetDir, p.ALURFILM_DIR].filter(d => fs.existsSync(d));
    const transcriptMap = new Map();

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.endsWith('.json') && f.includes('_transcript_part_')) {
          const isExactContentId = f.startsWith(`${contentId}_transcript_part_`);
          const match = f.match(/_transcript_part_(\d+)/);
          if (match) {
            const part = parseInt(match[1], 10);
            const fullPath = path.join(dir, f);
            try {
              const stat = fs.statSync(fullPath);
              if (stat.size > 0) {
                if (!transcriptMap.has(part) || isExactContentId) {
                  const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
                  if (Array.isArray(data) && data.length > 0) {
                    transcriptMap.set(part, { part, name: f, filePath: fullPath, data, entries: data });
                  }
                }
              }
            } catch { }
          }
        }
      }
    }

    return Array.from(transcriptMap.values()).sort((a, b) => a.part - b.part);
  });

  // ─── Get Alurfilm Mapping Prompt ───────────────────────
  ipcMain.handle('get-alurfilm-mapping-prompt', async (_event, { chunkPart, totalChunks = 2 }) => {
    const contentId = p.getOrGenerateContentId('longform');
    const partStr = String(chunkPart).padStart(2, '0');
    const promptFileName = 'alurfilm-mapping-prompt.md';
    const promptFile = path.join(p.PROMPTS_DIR, 'longform', promptFileName);

    let promptTemplate = '';
    if (fs.existsSync(promptFile)) {
      promptTemplate = fs.readFileSync(promptFile, 'utf-8');
    } else {
      promptTemplate = `Kamu adalah Editor Video Spesialis FFmpeg Mapping. Output JSON murni.`;
    }

    let voSentences = [];
    const targetTransDir = p.ALURFILM_TRANSCRIPTS_DIR || path.join(p.ALURFILM_DIR, 'transcripts');
    const transcriptPathJson = path.join(targetTransDir, `${contentId}_transcript_part_${partStr}.json`);
    const transcriptPathSrt = path.join(targetTransDir, `${contentId}_transcript_part_${partStr}.srt`);

    if (fs.existsSync(transcriptPathJson)) {
      try {
        const rawTranscript = JSON.parse(fs.readFileSync(transcriptPathJson, 'utf-8'));
        if (Array.isArray(rawTranscript)) {
          voSentences = rawTranscript.map((t, idx) => {
            const st = typeof t.start_seconds === 'number' ? t.start_seconds : 0.0;
            const ed = typeof t.end_seconds === 'number' ? t.end_seconds : 0.0;
            const dur = Number(Math.max(0.1, ed - st).toFixed(2));
            return {
              sentence_index: idx,
              text: t.text || t.narration || '',
              start: Number(st.toFixed(2)),
              end: Number(ed.toFixed(2)),
              duration: dur
            };
          });
        }
      } catch { }
    } else if (fs.existsSync(transcriptPathSrt)) {
      try {
        const srtContent = fs.readFileSync(transcriptPathSrt, 'utf-8');
        const srtEntries = parseSrtToEntries(srtContent);
        voSentences = srtEntries.map((t, idx) => {
          const st = t.start_seconds || 0.0;
          const ed = t.end_seconds || 0.0;
          const dur = Number(Math.max(0.1, ed - st).toFixed(2));
          return {
            sentence_index: idx,
            text: t.text || '',
            start: Number(st.toFixed(2)),
            end: Number(ed.toFixed(2)),
            duration: dur
          };
        });
      } catch { }
    }

    // Fetch Step 2 Script Analysis for Context
    let sceneBreakdownText = '[Acuan adegan dari Step 2 Script Generator]';
    const analysisPath = path.join(p.ALURFILM_DIR, `${contentId}_analysis_part_${partStr}.json`);
    if (fs.existsSync(analysisPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
        const summary = data.naskah_voiceover?.macro_summary || '';
        const timeline = data.timeline_edits || [];
        const timelineText = timeline.map((tl, i) => `${i + 1}. [${tl.start_time} - ${tl.end_time}] ${tl.scene_label}: ${tl.narrative_focus}`).join('\n');
        sceneBreakdownText = `Ringkasan: ${summary}\nTimeline Scenery:\n${timelineText}`;
      } catch { }
    }

    // Fetch Audio VO Metadata for this part
    let audioVoFileName = `${contentId}_audio_part_${partStr}.wav`;
    let totalAudioDurSec = voSentences.length > 0 ? (voSentences[voSentences.length - 1].end || 0) : 0;

    const audioSearchDirs = [p.ALURFILM_AUDIO_DIR, p.ALURFILM_DIR].filter(d => d && fs.existsSync(d));
    for (const dir of audioSearchDirs) {
      try {
        const files = fs.readdirSync(dir);
        const matched = files.find(f => f.includes(`part_${partStr}`) || f.includes(`parts_${partStr}`));
        if (matched) {
          audioVoFileName = matched;
          const fullAudioPath = path.join(dir, matched);
          try {
            const meta = await ffmpeg.getVideoMetaHelper(fullAudioPath);
            if (meta && meta.duration) {
              totalAudioDurSec = meta.duration;
            }
          } catch { }
          break;
        }
      } catch { }
    }

    const totalAudioDurSecNum = Number(totalAudioDurSec.toFixed(2));
    const mins = Math.floor(totalAudioDurSecNum / 60);
    const secs = (totalAudioDurSecNum % 60).toFixed(1);
    const totalAudioDurFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
    const audioStartTimestamp = voSentences.length > 0 ? `${voSentences[0].start.toFixed(1)}s` : '0.0s';
    const audioEndTimestamp = voSentences.length > 0 ? `${voSentences[voSentences.length - 1].end.toFixed(1)}s` : `${totalAudioDurSecNum}s`;
    const totalSentencesCount = voSentences.length;

    const chunkVideoName = `${contentId}_part_${partStr}.mp4`;
    const voSentencesJson = JSON.stringify(voSentences, null, 2);

    const fullPrompt = promptTemplate
      .replace(/{{chunk_part}}/g, String(chunkPart))
      .replace(/{{total_chunks}}/g, String(totalChunks))
      .replace(/{{voiceover_sentences}}/g, voSentencesJson)
      .replace(/{{source_video_name}}/g, chunkVideoName)
      .replace(/{{scene_id}}/g, `part_${partStr}`)
      .replace(/{{scene_breakdown}}/g, sceneBreakdownText)
      .replace(/{{audio_vo_file_name}}/g, audioVoFileName)
      .replace(/{{total_audio_duration_sec}}/g, String(totalAudioDurSecNum))
      .replace(/{{total_audio_duration_formatted}}/g, totalAudioDurFormatted)
      .replace(/{{total_sentences_count}}/g, String(totalSentencesCount))
      .replace(/{{audio_start_timestamp}}/g, audioStartTimestamp)
      .replace(/{{audio_end_timestamp}}/g, audioEndTimestamp);

    return fullPrompt;
  });

  function normalizeMappingObj(obj, defaultPart = 1) {
    if (!obj) return null;
    if (Array.isArray(obj)) {
      if (obj.length === 1) {
        return normalizeMappingObj(obj[0], defaultPart);
      }
      const match = obj.find(item => item && (item.mappings || item.scene_id));
      if (match) return normalizeMappingObj(match, defaultPart);
      return null;
    }
    if (typeof obj === 'object') {
      if (obj.data) return normalizeMappingObj(obj.data, defaultPart);
      if (Array.isArray(obj.mappings)) return obj;
      if (Array.isArray(obj.timeline)) return { scene_id: obj.scene_id || `part_${defaultPart}`, mappings: obj.timeline };
    }
    return obj;
  }

  // ─── Save Alurfilm Mapping ─────────────────────────────
  ipcMain.handle('save-alurfilm-mapping', async (_event, arg1, arg2, arg3) => {
    const contentId = p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_DIR)) fs.mkdirSync(p.ALURFILM_DIR, { recursive: true });

    let chunkPart = 1;
    let jsonText = null;

    if (typeof arg1 === 'object' && arg1 !== null && !Array.isArray(arg1)) {
      if ('chunkPart' in arg1 || 'jsonText' in arg1) {
        chunkPart = Number(arg1.chunkPart) || 1;
        jsonText = arg1.jsonText;
      } else {
        jsonText = arg1;
      }
    } else if (typeof arg1 === 'string' && (typeof arg2 === 'number' || !isNaN(Number(arg2)))) {
      chunkPart = Number(arg2);
      jsonText = arg3;
    } else if (typeof arg1 === 'number' || !isNaN(Number(arg1))) {
      chunkPart = Number(arg1);
      jsonText = arg2;
    }

    if (!jsonText) {
      throw new Error('Mapping JSON payload is empty or invalid.');
    }

    let raw = (typeof jsonText === 'string' ? jsonText : JSON.stringify(jsonText)).trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = typeof jsonText === 'object' && jsonText !== null ? jsonText : JSON.parse(raw);

    let targetResult = null;

    if (Array.isArray(parsed) && parsed.length > 1) {
      for (const item of parsed) {
        let pNum = chunkPart;
        if (item.chunk_part || item.part) {
          pNum = Number(item.chunk_part || item.part);
        } else if (item.scene_id) {
          const match = String(item.scene_id).match(/(\d+)/);
          if (match) pNum = parseInt(match[1], 10);
        }
        const normalizedItem = normalizeMappingObj(item, pNum);
        if (normalizedItem) {
          const partStr = String(pNum).padStart(2, '0');
          const outputName = `${contentId}_mapping_part_${partStr}.json`;
          const destPath = path.join(p.ALURFILM_DIR, outputName);
          fs.writeFileSync(destPath, JSON.stringify(normalizedItem, null, 2), 'utf-8');
          if (pNum === chunkPart || !targetResult) {
            targetResult = { part: pNum, name: outputName, filePath: destPath, data: normalizedItem };
          }
        }
      }
    }

    if (!targetResult) {
      const normalizedData = normalizeMappingObj(parsed, chunkPart) || parsed;
      const partStr = String(chunkPart).padStart(2, '0');
      const outputName = `${contentId}_mapping_part_${partStr}.json`;
      const destPath = path.join(p.ALURFILM_DIR, outputName);
      fs.writeFileSync(destPath, JSON.stringify(normalizedData, null, 2), 'utf-8');
      targetResult = { part: chunkPart, name: outputName, filePath: destPath, data: normalizedData };
    }

    return targetResult;
  });

  // ─── List Alurfilm Mappings ────────────────────────────
  ipcMain.handle('list-alurfilm-mappings', async (_event, modeContentId) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_DIR)) return [];

    const files = fs.readdirSync(p.ALURFILM_DIR);
    const mappings = files
      .filter(f => f.startsWith(`${contentId}_mapping_part_`) && f.endsWith('.json'))
      .map(f => {
        const match = f.match(/_mapping_part_(\d+)/);
        const part = match ? parseInt(match[1], 10) : 1;
        const fullPath = path.join(p.ALURFILM_DIR, f);
        try {
          let data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          data = normalizeMappingObj(data, part) || data;
          return { part, name: f, filePath: fullPath, data };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => a.part - b.part);

    return mappings;
  });

  // ─── Generate Alurfilm Metadata ───────────────────
  ipcMain.handle('generate-alurfilm-metadata', async (_event, { contentId, model, customNotes }) => {
    // Collect all script text, character registry, and macro summaries from available analysis files
    const allFiles = fs.existsSync(p.ALURFILM_DIR) ? fs.readdirSync(p.ALURFILM_DIR) : [];
    const analysisFiles = allFiles
      .filter(f => (
        f.endsWith('.json') &&
        (f.startsWith(`${contentId}_analysis_part_`) || f.startsWith(`alurfilm_${contentId}_analysis_part_`) || f.includes('_analysis_part_'))
      ))
      .sort((a, b) => {
        const numA = parseInt(a.match(/_part_(\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/_part_(\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });

    let combinedScript = '';
    let movieTitle = '';
    const characterRegistryList = [];
    const macroSummariesList = [];
    const timelineFocusList = [];

    for (const f of analysisFiles) {
      try {
        const filePath = path.join(p.ALURFILM_DIR, f);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (data.naskah_voiceover?.script_text) {
          combinedScript += `\n--- PART ${data.chunk_part || ''} ---\n` + data.naskah_voiceover.script_text;
        }
        if (data.naskah_voiceover?.macro_summary) {
          macroSummariesList.push(`Part ${data.chunk_part || ''}: ${data.naskah_voiceover.macro_summary}`);
        }
        if (Array.isArray(data.character_registry)) {
          data.character_registry.forEach(c => {
            if (c.assigned_name && !characterRegistryList.some(x => x.assigned_name === c.assigned_name)) {
              characterRegistryList.push(c);
            }
          });
        }
        if (Array.isArray(data.timeline_edits)) {
          data.timeline_edits.forEach(tl => {
            if (tl.scene_label || tl.narrative_focus) {
              timelineFocusList.push(`[${tl.scene_label || 'Scene'}]: ${tl.narrative_focus || ''}`);
            }
          });
        }
        if (data.movie_title && !movieTitle) {
          movieTitle = data.movie_title;
        }
      } catch { }
    }

    if (!combinedScript.trim()) {
      throw new Error('Naskah alur film tidak ditemukan. Silakan selesaikan Step 2 (Script Generator) terlebih dahulu.');
    }

    const systemPrompt = `Anda adalah seorang Pakar Psikologi Penonton & Strategi SEO YouTube khusus Niche Alur Cerita Film (Recap Film).
Tugas Anda adalah menganalisis SELURUH KONTEKS ALUR FILM (naskah, daftar karakter, ringkasan cerita) dan menghasilkan judul & metadata video YouTube yang 100% AKURAT SESUAI ISI FILM, tidak mengarang/asal-asalan, serta sangat memicu insting emosional penonton (CTR & Retention Tinggi).

🧠 TAHAP 1 — ANALISIS EKSTRAKSI 5 JANGKAR PSIKOLOGI CERITA (Wajib Analisis Dalam Hati Sebelum Membuat Judul):
Sebelum merumuskan judul, Anda HARUS mengekstrak 5 fakta psikologis riil dari data naskah yang diberikan:
1. Status Underdog & Penderitaan: Siapa karakter utama, kondisi fisik/sosial/ekonominya, dan penderitaan nyata yang dialami.
2. Taruhan Nyata (Survival Stakes): Apa yang hilang/rusak jika karakter gagal (nyawa, keluarga, kehormatan, masa depan).
3. Aksi Ekstrem Nyata: Tindakan nekat/perjuangan fisik/keberanian terbesar yang benar-benar dilakukan di naskah.
4. Bentuk Penindasan: Siapa penindasnya/pihak yang meremehkan dan bagaimana bentuk perlakuan zalimnya secara spesifik.
5. Tamparan Penyesalan / Puncak Emosi: Payoff emosional, tamparan fakta bagi penindas, atau klimaks pembuktian diri.

🚨 ATURAN AKURASI & FAKTUAlITAS MUTLAK (DILARANG HALUSINASI):
1. DILARANG KERAS mengarang metafora acak, profesi palsu, atau istilah yang tidak ada dalam film (seperti "menggebrak panggung gendang", "pensiunan pembalap", "kode bank", "juara dunia" jika filmnya tentang drama keluarga/difabel/anak berkebutuhan khusus).
2. Setiap kata pada slot Judul WAJIB 100% didasarkan pada kejadian riil, penderitaan nyata, dan perlawanan/pembuktian emosional karakter utama dari data naskah yang diberikan.

🎯 TAHAP 2 — STRUKTUR FORMULA JUDUL (TABUHAN GENDANG EMOSI CTR):
Semua opsi judul HARUS mengikuti pola formula CTR berikut:
[Tindakan Ekstrem / Perjuangan Nyata] + [Status Karakter Underdog] + [Konflik / Puncak Emosi Realistis] — Alur Cerita Film

CONTOH FORMULA AKURAT BERDASARKAN PSIKOLOGI PENONTON:
- [Demi Sembuh Dari Lumpuh] [Pemuda Cerebral Palsy] [Buktikan Bisa Hidup Mandiri] — Alur Cerita Film
- [Diremehkan Ibu Sendiri] [Anak Difabel Ini] [Bikin Satu Keluarga Menangis Penyesalan] — Alur Cerita Film
- [Dihina Fisik Kaku] [Pemuda Cerebral Palsy] [Berhasil Bangkit & Temukan Cinta Sejati] — Alur Cerita Film
- [Neikat Jualan Permen] [Pemuda Cerebral Palsy] [Buktikan Bisa Bangkit Dari Keputusasaan] — Alur Cerita Film

PEMBAGIAN 5 OPSI JUDUL SESUAI TABUHAN GENDANG EMOSI PSIKOLOGIS:
Anda harus menghasilkan tepat 5 variasi judul dengan kategori emosi berikut:
1. "underdog": Mengincar Gendang Empati & Penderitaan (Haru/Perjuangan Karakter Biasa/Difabel yang Diremehkan).
2. "balas_dendam": Mengincar Gendang Kemarahan & Penyesalan (Pembuktian Diri & Tamparan Penyesalan bagi Penindas).
3. "aksi_nekat": Mengincar Gendang Ketegangan & Survival (Keberanian/Pengorbanan Karakter Mengambil Risiko Besar).
4. "kaget": Mengincar Gendang Syok & Kontradiksi (Kejadian Tak Terduga / Paradox di Alur Cerita).
5. "misteri": Mengincar Gendang Kepo Terlarang (Rahasia, Motivasi Tersembunyi & Curiosity Gap).

ATURAN TEKS THUMBNAIL (GAYA DUA WARNA VIRAL):
Teks thumbnail harus 2-4 kata yang sangat singkat & kontras tajam.
Gaya teks mengikuti pola dua warna yang terbukti meledak di niche Alur Cerita Film:
- Kata Pertama (Yellow Part): Teks penarik perhatian warna Kuning Cerah (misal: "FISIK KAKU", "DIREMEHKAN", "TAK BISA", "BISA BANGKIT", "DEMI IBU").
- Kata Kedua (Red Part): Teks klimaks emosi warna Merah Menyala dengan Outline Hitam (misal: "BUKTIKAN MANUSIA", "MENANGIS PENYESALAN", "CINTA SEJATI", "DIBANGKITKAN", "TAMPAKAN").

ATURAN PROMPT GAMBAR THUMBNAIL (AI IMAGE GENERATOR):
Hasilkan prompt gambar AI profesional (dalam Bahasa Inggris) untuk Midjourney / Flux / DALL-E / Google Flow yang menggambarkan visual emosi karakter utama & konflik cerita secara sinematik dengan spesifikasi:
1. Visual Utama: Karakter utama (sesuai deskripsi fisik di registry) dengan raut emosi mendalam (haru/perjuangan/tekad) dipadukan dengan atmosfer sinematik pendukung.
2. Lighting & Color Texture: Dramatic cinematic lighting, teal and orange color grading, vibrant color contrast, highly detailed gritty textures, 8k photorealistic concept art.
3. Angle: Wide-angle / medium cinematic shot, epic atmosphere.

DESKRIPSI VIDEO YOUTUBE (TERSTRUKTUR & SEO FRIENDLY):
1. 2 Baris Pertama: Hook pembuka tajam yang selaras dengan judul.
2. Ringkasan Cerita (Sinopsis 100-150 kata): Rangkuman alur film tanpa membocorkan spoiler akhir cerita.
3. Fair Use & Copyright Notice: Kalimat standar penafsiran hak cipta karya film.
4. Call to Action (CTA): Ajak penonton Like, Comment pendapat mereka, dan Subscribe channel.

TAGS & KEYWORDS (MINIMAL 15-20 TAGS):
Daftar kata kunci relevan dipisahkan koma untuk metadata YouTube.

OUTPUT FORMAT (MANDATORY JSON OBJECT ONLY):
{
  "titles": [
    {
      "id": "1",
      "emotion_category": "underdog",
      "emotion_label": "😢 Underdog & Perjuangan",
      "title": "...",
      "thumbnail_text_yellow": "...",
      "thumbnail_text_red": "...",
      "thumbnail_prompt": "...",
      "thumbnail_composition_notes": "..."
    },
    {
      "id": "2",
      "emotion_category": "balas_dendam",
      "emotion_label": "😡 Pembuktian & Tamparan Penyesalan",
      "title": "...",
      "thumbnail_text_yellow": "...",
      "thumbnail_text_red": "...",
      "thumbnail_prompt": "...",
      "thumbnail_composition_notes": "..."
    },
    {
      "id": "3",
      "emotion_category": "aksi_nekat",
      "emotion_label": "⚡ Keberanian & Aksi Nekat",
      "title": "...",
      "thumbnail_text_yellow": "...",
      "thumbnail_text_red": "...",
      "thumbnail_prompt": "...",
      "thumbnail_composition_notes": "..."
    },
    {
      "id": "4",
      "emotion_category": "kaget",
      "emotion_label": "😱 Syok & Tak Terduga",
      "title": "...",
      "thumbnail_text_yellow": "...",
      "thumbnail_text_red": "...",
      "thumbnail_prompt": "...",
      "thumbnail_composition_notes": "..."
    },
    {
      "id": "5",
      "emotion_category": "misteri",
      "emotion_label": "🤨 Rahasia & Curiosity Gap",
      "title": "...",
      "thumbnail_text_yellow": "...",
      "thumbnail_text_red": "...",
      "thumbnail_prompt": "...",
      "thumbnail_composition_notes": "..."
    }
  ],
  "description": "...",
  "tags": ["Alur Cerita Film", "Recap Film", "..."]
}`;

    const characterContext = characterRegistryList.map(c => `- ${c.assigned_name}: ${c.visual_description || ''}`).join('\n');
    const macroContext = macroSummariesList.join('\n');
    const timelineContext = timelineFocusList.join('\n');

    const promptText = `Berikut adalah DATA KONTEKS LENGKAP ALUR FILM UNTUK DIANALISIS:
${movieTitle ? `JUDUL FILM: ${movieTitle}\n` : ''}
${customNotes ? `CATATAN KHUSUS USER: ${customNotes}\n` : ''}

DAFTAR KARAKTER UTAMA:
${characterContext || 'Tidak ada data karakter'}

RINGKASAN ALUR CERITA (PER PART):
${macroContext || 'Tidak ada ringkasan makro'}

FOKUS ADEGAN UTAMA:
${timelineContext || 'Tidak ada fokus adegan'}

NASKAH VOICEOVER LENGKAP:
${combinedScript}`;

    const rawJsonText = await aiClient.streamChatCompletion({
      systemPrompt,
      prompt: promptText,
      model: model || 'ag/gemini-3-flash-agent',
      jsonMode: true,
      temperature: 0.7,
      onChunk: (chunk, fullText) => {
        try {
          event.sender.send('alurfilm-metadata-chunk', { chunk, fullText });
        } catch { }
      },
    });

    let resultData = null;
    try {
      resultData = JSON.parse(rawJsonText);
    } catch (e) {
      const cleanJson = aiClient.extractCleanJsonObject(rawJsonText);
      resultData = JSON.parse(cleanJson);
    }

    // Save initial generated metadata
    const destPath = path.join(p.ALURFILM_DIR, `alurfilm_${contentId}_metadata.json`);
    fs.writeFileSync(destPath, JSON.stringify(resultData, null, 2), 'utf-8');

    return resultData;
  });

  // ─── Save Alurfilm Metadata ───────────────────────────
  ipcMain.handle('save-alurfilm-metadata', async (_event, { modeContentId, metadata }) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    const destPath = path.join(p.ALURFILM_DIR, `alurfilm_${contentId}_metadata.json`);

    if (!fs.existsSync(p.ALURFILM_DIR)) {
      fs.mkdirSync(p.ALURFILM_DIR, { recursive: true });
    }

    const payload = {
      ...metadata,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(destPath, JSON.stringify(payload, null, 2), 'utf-8');
    return { success: true, filePath: destPath, metadata: payload };
  });

  // ─── Get Alurfilm Metadata ────────────────────────────
  ipcMain.handle('get-alurfilm-metadata', async (_event, modeContentId) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    const destPath = path.join(p.ALURFILM_DIR, `alurfilm_${contentId}_metadata.json`);

    if (fs.existsSync(destPath)) {
      try {
        const raw = fs.readFileSync(destPath, 'utf-8');
        return JSON.parse(raw);
      } catch { }
    }
    return null;
  });

  // ─── Render Alurfilm Intro Test Video ───────────────────
  ipcMain.handle('alurfilm:render-intro-test', async (_event, options) => {
    return new Promise((resolve) => {
      const optsJson = JSON.stringify(options || {});
      const runnerScript = `
import { renderIntroVideo } from './lib/alurfilm/intro-engine.ts';
(async () => {
  try {
    const opts = ${optsJson};
    const res = await renderIntroVideo(opts, (percent, msg) => {
      console.log('PROGRESS:' + JSON.stringify({ percent, msg }));
    });
    console.log('RESULT:' + JSON.stringify(res));
  } catch (e) {
    console.log('RESULT:' + JSON.stringify({ success: false, error: e.message }));
  }
})();
      `;

      const child = spawn('npx', ['tsx', '-e', runnerScript], {
        cwd: p.PROJECT_ROOT,
        env: { ...process.env },
      });

      let lastResult = { success: false, error: 'Unknown render failure' };

      child.stdout.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('PROGRESS:')) {
            try {
              const payload = JSON.parse(line.replace('PROGRESS:', ''));
              _event.sender.send('alurfilm:render-intro-progress', payload);
            } catch { }
          } else if (line.startsWith('RESULT:')) {
            try {
              lastResult = JSON.parse(line.replace('RESULT:', ''));
            } catch { }
          }
        }
      });

      child.stderr.on('data', (data) => {
        console.error('Intro render stderr:', data.toString());
      });

      child.on('close', (code) => {
        if (code === 0 && lastResult.success) {
          resolve(lastResult);
        } else {
          resolve({
            success: false,
            outputPath: lastResult.outputPath || '',
            error: lastResult.error || `Process exited with code ${code}`,
          });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  });

  // ─── Get Alurfilm Intro Video Path ──────────────────────
  ipcMain.handle('get-alurfilm-intro', async (_event, modeContentId) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    const outputDir = path.join(p.PROJECT_ROOT, 'output');
    if (!fs.existsSync(outputDir)) return null;

    const files = fs.readdirSync(outputDir);
    const matches = files.filter((f) => (f.includes(`alurfilm_${contentId}_intro`) || f.includes('alurfilm_intro_test')) && f.endsWith('.mp4')).sort().reverse();
    if (matches.length > 0) {
      const filePath = path.join(outputDir, matches[0]);
      return { filePath, mediaUrl: media.mediaUrl(filePath), fileName: matches[0] };
    }

    const anyIntro = files.filter((f) => f.includes('intro') && f.endsWith('.mp4')).sort().reverse();
    if (anyIntro.length > 0) {
      const filePath = path.join(outputDir, anyIntro[0]);
      return { filePath, mediaUrl: media.mediaUrl(filePath), fileName: anyIntro[0] };
    }

    return null;
  });

  // ─── IPC: generate-alurfilm-test-tts-with-silence ──────
  ipcMain.handle('generate-alurfilm-test-tts-with-silence', async (_event, { scriptText }) => {
    const contentId = p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_AUDIO_DIR)) fs.mkdirSync(p.ALURFILM_AUDIO_DIR, { recursive: true });

    const tagRegex = /\[VISUAL_ONLY:\s*([\d.]+)\s*s?\s*(?:\|\s*([^\]]+))?\]/gi;
    const rawSegments = [];
    let lastIndex = 0;
    let match;

    const inputScript = scriptText || '';

    while ((match = tagRegex.exec(inputScript)) !== null) {
      const textBefore = inputScript.slice(lastIndex, match.index).trim();
      if (textBefore) {
        rawSegments.push({ type: 'narration', text: textBefore });
      }

      const durationSec = Math.max(1.0, parseFloat(match[1]) || 5.0);
      const description = (match[2] || 'Adegan Visual Murni Action').trim();
      rawSegments.push({ type: 'visual_only', durationSec, description });

      lastIndex = tagRegex.lastIndex;
    }

    const textAfter = inputScript.slice(lastIndex).trim();
    if (textAfter) {
      rawSegments.push({ type: 'narration', text: textAfter });
    }

    if (rawSegments.length === 0) {
      rawSegments.push({ type: 'narration', text: inputScript || 'Naskah pengujian alur film.' });
    }

    const timestamp = Date.now();
    const tempFiles = [];
    const processedSegments = [];
    let currentClockSec = 0;

    for (let i = 0; i < rawSegments.length; i++) {
      const seg = rawSegments[i];
      const tempPath = path.join(p.ALURFILM_AUDIO_DIR, `temp_seg_${timestamp}_${i}.wav`);
      tempFiles.push(tempPath);

      let duration = 0;
      if (seg.type === 'narration') {
        const words = seg.text.split(/\s+/).filter(Boolean);
        duration = Math.max(2.0, Number((words.length / 3.0).toFixed(1)));

        // Generate synthetic narration audio tone for testing
        await new Promise((resolve, reject) => {
          const args = [
            '-f', 'lavfi',
            '-i', `sine=frequency=350:duration=${duration}`,
            '-ar', '16000',
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            '-y',
            tempPath
          ];
          const proc = spawn(ffmpeg.ffmpegPath, args);
          proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg narration audio error code ${code}`)));
          proc.on('error', reject);
        });
      } else {
        duration = seg.durationSec;
        // Generate pure silence audio
        await new Promise((resolve, reject) => {
          const args = [
            '-f', 'lavfi',
            '-i', `anullsrc=r=16000:cl=mono`,
            '-t', String(duration),
            '-c:a', 'pcm_s16le',
            '-y',
            tempPath
          ];
          const proc = spawn(ffmpeg.ffmpegPath, args);
          proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg silence audio error code ${code}`)));
          proc.on('error', reject);
        });
      }

      const startSec = Number(currentClockSec.toFixed(1));
      currentClockSec += duration;
      const endSec = Number(currentClockSec.toFixed(1));

      processedSegments.push({
        index: i,
        type: seg.type,
        text: seg.text || null,
        description: seg.description || null,
        startSec,
        endSec,
        durationSec: Number(duration.toFixed(1))
      });
    }

    // Concatenate all temp files using FFmpeg concat list
    const listFilePath = path.join(p.ALURFILM_AUDIO_DIR, `concat_list_${timestamp}.txt`);
    const listContent = tempFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listFilePath, listContent, 'utf-8');

    const outputName = `${contentId}_test_silence_audio_${timestamp}.wav`;
    const finalAudioPath = path.join(p.ALURFILM_AUDIO_DIR, outputName);

    await new Promise((resolve, reject) => {
      const args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', listFilePath,
        '-c', 'copy',
        '-y',
        finalAudioPath
      ];
      const proc = spawn(ffmpeg.ffmpegPath, args);
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg concat error code ${code}`)));
      proc.on('error', reject);
    });

    // Cleanup temp files
    try { fs.unlinkSync(listFilePath); } catch { }
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch { }
    }

    return {
      success: true,
      audioPath: finalAudioPath,
      audioUrl: media.mediaUrl(finalAudioPath),
      totalDurationSec: Number(currentClockSec.toFixed(1)),
      segments: processedSegments
    };
  });

  // ─── IPC: run-alurfilm-test-whisper-alignment ───────────
  ipcMain.handle('run-alurfilm-test-whisper-alignment', async (event, { audioPath, scriptText }) => {
    const contentId = p.getOrGenerateContentId('longform');
    const tmpDir = path.join(p.ALURFILM_DIR, 'transcripts');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const timestamp = Date.now();
    const rawText = scriptText || '';

    // Step 1: Parse raw script into an ordered sequence of elements (sentences + VISUAL_ONLY tags)
    const tagRegex = /\[VISUAL_ONLY:\s*([\d.]+)\s*s?\s*(?:\|\s*([^\]]+))?\]/gi;
    const scriptElements = [];
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(rawText)) !== null) {
      const textBefore = rawText.slice(lastIndex, match.index).trim();
      if (textBefore) {
        const sents = textBefore.split(/(?<=[.!?])\s+/).filter(Boolean);
        for (const st of sents) {
          scriptElements.push({ type: 'narration', text: st });
        }
      }

      const silenceDur = Math.max(1.0, parseFloat(match[1]) || 5.0);
      const desc = (match[2] || 'Adegan Visual Murni Action').trim();
      scriptElements.push({
        type: 'visual_only',
        text: `[VISUAL_ONLY: ${desc}]`,
        description: desc,
        duration: silenceDur
      });

      lastIndex = tagRegex.lastIndex;
    }

    const textAfter = rawText.slice(lastIndex).trim();
    if (textAfter) {
      const sents = textAfter.split(/(?<=[.!?])\s+/).filter(Boolean);
      for (const st of sents) {
        scriptElements.push({ type: 'narration', text: st });
      }
    }

    // Step 2: Extract clean narration text for Faster-Whisper alignment
    const narrationSentencesOnly = scriptElements
      .filter(el => el.type === 'narration')
      .map(el => el.text)
      .join('\n');

    const tmpScriptPath = path.join(tmpDir, `tmp_test_script_${timestamp}.txt`);
    fs.writeFileSync(tmpScriptPath, narrationSentencesOnly || 'Naskah pengujian alur film.', 'utf-8');

    const outJsonPath = path.join(tmpDir, `tmp_test_transcript_${timestamp}.json`);
    const pythonBin = path.join(p.PROJECT_ROOT, 'whisperx', 'venv', 'bin', 'python3');
    const alignCli = path.join(p.PROJECT_ROOT, 'whisperx', 'align_cli.py');

    let whisperSentences = [];
    let isFasterWhisperUsed = false;

    if (fs.existsSync(pythonBin) && fs.existsSync(alignCli) && audioPath && fs.existsSync(audioPath)) {
      try {
        const sendProgress = (stage, progress, msg) => {
          try {
            event.sender.send('alurfilm-test-whisper-progress', { stage, progress, message: msg });
          } catch { }
        };

        sendProgress('loading_model', 20, 'Memuat CTranslate2 / Faster-Whisper Model...');

        await new Promise((resolve, reject) => {
          const child = spawn(pythonBin, [alignCli, '--audio', audioPath, '--text', tmpScriptPath, '--output', outJsonPath, '--model', 'medium'], {
            cwd: p.PROJECT_ROOT,
            env: { ...process.env, PYTHONSAFEPATH: '1' },
          });

          child.stdout.on('data', (d) => {
            const line = d.toString().trim();
            if (line.includes('Starting Silero VAD')) sendProgress('transcribing', 40, 'Menjalankan Silero VAD & Faster-Whisper Transkrip...');
            if (line.includes('Perform Fuzzy Text-Matching')) sendProgress('aligning', 80, 'Menyesuaikan alignment teks & timestamp...');
          });

          child.on('close', (code) => code === 0 && fs.existsSync(outJsonPath) ? resolve() : reject(new Error(`Faster-Whisper process code ${code}`)));
          child.on('error', reject);
        });

        if (fs.existsSync(outJsonPath)) {
          const data = JSON.parse(fs.readFileSync(outJsonPath, 'utf-8'));
          const parsed = Array.isArray(data) ? data : (data.transcript || data.sentences || []);
          whisperSentences = parsed.map((item, idx) => {
            let rawSpeechEnd = item.end_seconds !== undefined ? item.end_seconds : (item.end || 0);
            let firstWordStart = item.start_seconds !== undefined ? item.start_seconds : (item.start || 0);
            if (Array.isArray(item.words) && item.words.length > 0) {
              const firstWord = item.words[0];
              const lastWord = item.words[item.words.length - 1];
              if (firstWord && firstWord.start !== undefined) firstWordStart = firstWord.start;
              if (lastWord && lastWord.end !== undefined) rawSpeechEnd = lastWord.end;
            }
            return {
              sentence_index: idx,
              text: item.text || item.kalimat || item.narration || '',
              start: Number((item.start_seconds !== undefined ? item.start_seconds : (item.start || 0)).toFixed(3)),
              end: Number((item.end_seconds !== undefined ? item.end_seconds : (item.end || 0)).toFixed(3)),
              firstWordStart: Number(Number(firstWordStart).toFixed(3)),
              lastWordEnd: Number(Number(rawSpeechEnd).toFixed(3))
            };
          });
          isFasterWhisperUsed = true;
        }
      } catch (err) {
        console.warn('Faster-Whisper CLI failed, falling back to script alignment:', err.message);
      }
    }

    // Cleanup temp files
    try { fs.unlinkSync(tmpScriptPath); } catch { }
    try { fs.unlinkSync(outJsonPath); } catch { }

    // Step 3: Map whisper timestamps onto narration elements
    let whisperIdx = 0;
    let simClock = 0;

    const alignedElements = scriptElements.map((el, idx) => {
      if (el.type === 'narration') {
        const nextEl = idx < scriptElements.length - 1 ? scriptElements[idx + 1] : null;
        const isFollowedByVisualOnly = nextEl && nextEl.type === 'visual_only';

        if (isFasterWhisperUsed && whisperIdx < whisperSentences.length) {
          const w = whisperSentences[whisperIdx++];
          const lastWordEnd = w.lastWordEnd || w.end;
          const firstWordStart = w.firstWordStart || w.start;
          const actualEnd = isFollowedByVisualOnly ? lastWordEnd : w.end;
          simClock = actualEnd;
          return {
            ...el,
            start: w.start,
            end: actualEnd,
            firstWordStart,
            lastWordEnd
          };
        } else {
          const words = (el.text || '').split(/\s+/).filter(Boolean);
          const dur = Math.max(2.5, Number((words.length / 3.0).toFixed(3)));
          const start = Number(simClock.toFixed(3));
          simClock += dur;
          const end = Number(simClock.toFixed(3));
          return { ...el, start, end };
        }
      }
      return el;
    });

    // Step 4: Zero-Loss Sequential Audio Splicing with 200ms Acoustic Tail Padding (Millisecond Precision)
    let finalAudioPath = audioPath || '';
    let finalAudioUrl = audioPath ? media.mediaUrl(audioPath) : '';
    let audioSpliced = false;

    const audioMeta = (audioPath && fs.existsSync(audioPath)) ? await ffmpeg.getVideoMetaHelper(audioPath) : null;
    const totalRawAudioDur = (audioMeta && audioMeta.duration) ? audioMeta.duration : 0.0;

    // Build sequential audio slice instructions with +0.20s acoustic tail padding
    const audioSplits = [];
    let lastCutTime = 0.0;

    for (let i = 0; i < alignedElements.length; i++) {
      const current = alignedElements[i];

      if (current.type === 'visual_only') {
        let prevNarr = null;
        for (let k = i - 1; k >= 0; k--) {
          if (alignedElements[k].type === 'narration') {
            prevNarr = alignedElements[k];
            break;
          }
        }

        let nextNarr = null;
        for (let k = i + 1; k < alignedElements.length; k++) {
          if (alignedElements[k].type === 'narration') {
            nextNarr = alignedElements[k];
            break;
          }
        }

        if (prevNarr && prevNarr.end !== undefined) {
          const cutEnd = Math.min(totalRawAudioDur, Number(prevNarr.end.toFixed(3)));
          if (cutEnd > lastCutTime) {
            audioSplits.push({
              type: 'audio_chunk',
              startSec: Number(lastCutTime.toFixed(3)),
              endSec: Number(cutEnd.toFixed(3))
            });
          }

          if (nextNarr && nextNarr.firstWordStart !== undefined) {
            lastCutTime = Math.max(cutEnd, Number(nextNarr.firstWordStart.toFixed(3)));
          } else {
            lastCutTime = cutEnd;
          }
        }

        audioSplits.push({
          type: 'silence_buffer',
          durationSec: Number((current.duration || 5.0).toFixed(3)),
          element: current
        });
      }
    }

    if (totalRawAudioDur > lastCutTime + 0.05) {
      audioSplits.push({
        type: 'audio_chunk',
        startSec: Number(lastCutTime.toFixed(3)),
        endSec: Number(totalRawAudioDur.toFixed(3))
      });
      lastCutTime = totalRawAudioDur;
    }

    // Calculate cumulative splicedStart & splicedEnd for precise timestamp mapping
    let currentSplicedClock = 0.0;
    for (let j = 0; j < audioSplits.length; j++) {
      const item = audioSplits[j];
      if (item.type === 'audio_chunk') {
        item.splicedStart = Number(currentSplicedClock.toFixed(3));
        item.splicedEnd = Number((currentSplicedClock + (item.endSec - item.startSec)).toFixed(3));
        currentSplicedClock = item.splicedEnd;
      } else {
        item.splicedStart = Number(currentSplicedClock.toFixed(3));
        item.splicedEnd = Number((currentSplicedClock + item.durationSec).toFixed(3));
        currentSplicedClock = item.splicedEnd;
      }
    }

    // Perform FFmpeg slicing and concatenation
    if (audioPath && fs.existsSync(audioPath) && audioSplits.length > 0) {
      try {
        const tempFiles = [];
        const sendProgress = (stage, progress, msg) => {
          try { event.sender.send('alurfilm-test-whisper-progress', { stage, progress, message: msg }); } catch { }
        };

        sendProgress('splicing_audio', 85, 'Splicing audio sekuensial & menyisipkan Silence Gap presisi...');

        for (let i = 0; i < audioSplits.length; i++) {
          const item = audioSplits[i];
          const tempChunkPath = path.join(p.ALURFILM_AUDIO_DIR, `temp_chunk_${timestamp}_${i}.wav`);
          tempFiles.push(tempChunkPath);

          if (item.type === 'audio_chunk') {
            const ss = Math.max(0, item.startSec);
            const to = Math.max(ss + 0.01, item.endSec);
            const dur = Number((to - ss).toFixed(3));

            await new Promise((resolve, reject) => {
              const args = [
                '-i', audioPath,
                '-ss', String(ss),
                '-t', String(dur),
                '-ar', '16000',
                '-ac', '1',
                '-c:a', 'pcm_s16le',
                '-y',
                tempChunkPath
              ];
              const proc = spawn(ffmpeg.ffmpegPath, args);
              proc.on('close', (code) => code === 0 && fs.existsSync(tempChunkPath) ? resolve() : reject(new Error(`FFmpeg slice error ${code}`)));
              proc.on('error', reject);
            });
          } else {
            const silenceDur = Number((item.durationSec || 5.0).toFixed(3));
            await new Promise((resolve, reject) => {
              const args = [
                '-f', 'lavfi',
                '-i', 'anullsrc=r=16000:cl=mono',
                '-t', String(silenceDur),
                '-ar', '16000',
                '-ac', '1',
                '-c:a', 'pcm_s16le',
                '-y',
                tempChunkPath
              ];
              const proc = spawn(ffmpeg.ffmpegPath, args);
              proc.on('close', (code) => code === 0 && fs.existsSync(tempChunkPath) ? resolve() : reject(new Error(`FFmpeg silence error ${code}`)));
              proc.on('error', reject);
            });
          }
        }

        // Concatenate using FFmpeg concat filter with re-encoding to guarantee clean stream joining
        const listFilePath = path.join(p.ALURFILM_AUDIO_DIR, `concat_list_${timestamp}.txt`);
        const listContent = tempFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
        fs.writeFileSync(listFilePath, listContent, 'utf-8');

        const outputName = `${contentId}_final_audio_with_silence_gaps_${timestamp}.wav`;
        const outPath = path.join(p.ALURFILM_AUDIO_DIR, outputName);

        await new Promise((resolve, reject) => {
          const args = [
            '-f', 'concat',
            '-safe', '0',
            '-i', listFilePath,
            '-ar', '16000',
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            '-y',
            outPath
          ];
          const proc = spawn(ffmpeg.ffmpegPath, args);
          proc.on('close', (code) => code === 0 && fs.existsSync(outPath) ? resolve() : reject(new Error(`FFmpeg concat error code ${code}`)));
          proc.on('error', reject);
        });

        // Clean up temp files
        try { fs.unlinkSync(listFilePath); } catch { }
        for (const f of tempFiles) { try { fs.unlinkSync(f); } catch { } }

        finalAudioPath = outPath;
        finalAudioUrl = media.mediaUrl(outPath);
        audioSpliced = true;
      } catch (err) {
        console.warn('FFmpeg audio splicing failed, keeping original audio:', err.message);
      }
    }

    // Step 5: Construct timeline items matching adjusted final audio file perfectly
    const finalItems = [];
    let itemCounter = 0;
    let clockSec = 0.0;
    let sourceVideoClock = 15.0;

    for (let i = 0; i < alignedElements.length; i++) {
      const current = alignedElements[i];

      if (current.type === 'visual_only') {
        const silenceItem = audioSplits.find(s => s.type === 'silence_buffer' && s.element === current);
        const start = (audioSpliced && silenceItem)
          ? silenceItem.splicedStart
          : Number(clockSec.toFixed(3));
        const duration = (audioSpliced && silenceItem)
          ? Number((silenceItem.splicedEnd - silenceItem.splicedStart).toFixed(3))
          : Number((current.duration || 5.0).toFixed(3));
        const end = (audioSpliced && silenceItem)
          ? silenceItem.splicedEnd
          : Number((start + duration).toFixed(3));

        clockSec = end;

        const clip1Dur = Number((duration * 0.5).toFixed(3));
        const clip2Dur = Number((duration - clip1Dur).toFixed(3));

        finalItems.push({
          sentence_index: itemCounter++,
          type: 'visual_only',
          text: current.text,
          description: current.description || 'Adegan Visual Murni Action',
          start,
          end,
          duration,
          visuals: [
            { type: 'video_cut', duration: clip1Dur, source_start_seconds: Number(sourceVideoClock.toFixed(1)), color_grading_shift: { contrast: 1.06, brightness: 0.005, saturation: 1.06 } },
            { type: 'video_cut', duration: clip2Dur, source_start_seconds: Number((sourceVideoClock + 25.0).toFixed(1)), color_grading_shift: { contrast: 1.05, brightness: 0.004, saturation: 1.05 } }
          ]
        });
        sourceVideoClock += 35.0;
      } else {
        const origStart = current.start !== undefined ? current.start : 0;
        const origEnd = current.end !== undefined ? current.end : (origStart + 3.0);
        const rawDuration = Math.max(0.5, Number((origEnd - origStart).toFixed(3)));

        let start = 0.0;
        let end = 0.0;

        if (audioSpliced && audioSplits.length > 0) {
          let matchingChunk = audioSplits.find(item => item.type === 'audio_chunk' && origStart >= item.startSec && origStart <= item.endSec);
          if (!matchingChunk) {
            matchingChunk = audioSplits.filter(item => item.type === 'audio_chunk').find(item => origStart <= item.endSec) || audioSplits.filter(item => item.type === 'audio_chunk').pop();
          }

          if (matchingChunk) {
            const offset = Math.max(0, origStart - matchingChunk.startSec);
            start = Number((matchingChunk.splicedStart + offset).toFixed(3));
            end = Number((start + rawDuration).toFixed(3));
          } else {
            start = Number(clockSec.toFixed(3));
            end = Number((start + rawDuration).toFixed(3));
          }
        } else {
          start = Number((current.start !== undefined ? current.start : clockSec).toFixed(3));
          end = Number((current.end !== undefined ? current.end : (start + rawDuration)).toFixed(3));
        }

        clockSec = Math.max(clockSec, end);

        finalItems.push({
          sentence_index: itemCounter++,
          type: 'narration',
          text: current.text,
          start,
          end,
          duration: rawDuration,
          visuals: [
            { type: 'video_cut', duration: rawDuration, source_start_seconds: Number(sourceVideoClock.toFixed(1)), color_grading_shift: { contrast: 1.04, brightness: 0.003, saturation: 1.04 } }
          ]
        });
        sourceVideoClock += 12.0;
      }
    }

    const totalDur = Number(clockSec.toFixed(3));

    return {
      success: true,
      isFasterWhisperUsed,
      audioSpliced,
      finalAudioPath,
      finalAudioUrl,
      totalDurationSec: totalDur,
      items: finalItems
    };


  });



}

module.exports = { register };

