// dashboard/electron/ipc/alurfilmHandlers.cjs
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function register(ipcMain, { paths: p, media, ffmpeg, aiClient, loadPrompt }) {
  // Ensure alurfilm dirs exist
  if (!fs.existsSync(p.ALURFILM_DIR)) fs.mkdirSync(p.ALURFILM_DIR, { recursive: true });
  if (!fs.existsSync(p.ALURFILM_CHUNKS_DIR)) fs.mkdirSync(p.ALURFILM_CHUNKS_DIR, { recursive: true });

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
    const chunkDuration = 600; // Locked at 10 minutes (600 seconds)

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
        ffmpegProc.stderr.on('data', () => {});

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
          url: media.mediaUrl(destPath)
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

    const files = fs.readdirSync(p.ALURFILM_CHUNKS_DIR);
    const chunks = files
      .filter(f => f.startsWith(contentId) && f.endsWith('.mp4'))
      .sort()
      .map((f, idx) => {
        const fullPath = path.join(p.ALURFILM_CHUNKS_DIR, f);
        const stat = fs.statSync(fullPath);
        return {
          part: idx + 1,
          name: f,
          size: stat.size,
          filePath: fullPath,
          url: media.mediaUrl(fullPath),
          mediaUrl: media.mediaUrl(fullPath)
        };
      });

    return { chunks: chunks || [], content_id: contentId };
  });

  // ─── List Alurfilm Chunks ──────────────────────────────
  ipcMain.handle('list-alurfilm-chunks', async (_event, modeContentId) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_CHUNKS_DIR)) return [];

    const files = fs.readdirSync(p.ALURFILM_CHUNKS_DIR);
    const chunks = files
      .filter(f => f.startsWith(contentId) && f.endsWith('.mp4'))
      .sort()
      .map((f, idx) => {
        const fullPath = path.join(p.ALURFILM_CHUNKS_DIR, f);
        const stat = fs.statSync(fullPath);
        return {
          part: idx + 1,
          name: f,
          size: stat.size,
          filePath: fullPath,
          url: media.mediaUrl(fullPath)
        };
      });

    return chunks;
  });

  // ─── Delete Alurfilm Chunk ─────────────────────────────
  ipcMain.handle('delete-alurfilm-chunk', async (_event, opts) => {
    const contentId = p.getOrGenerateContentId('longform');
    const part = typeof opts === 'object' ? opts.part : opts;
    if (!fs.existsSync(p.ALURFILM_CHUNKS_DIR)) return true;

    const files = fs.readdirSync(p.ALURFILM_CHUNKS_DIR);
    const partStr = String(part).padStart(2, '0');
    const targetFiles = files.filter(f => f.startsWith(`${contentId}_part_${partStr}.mp4`));

    for (const f of targetFiles) {
      try { fs.unlinkSync(path.join(p.ALURFILM_CHUNKS_DIR, f)); } catch (e) {
        console.error('Failed to delete chunk:', e);
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
      promptTemplate = `Kamu adalah AI Audio Transcriber presisi tinggi. Transkrip audio part ${chunkPart} ke JSON dengan start_seconds, end_seconds, timestamp_minute, text. Durasi: {{audio_duration}}.`;
    }

    let audioDurationText = `[Sesuai total durasi file audio Part #${chunkPart}]`;
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
              const meta = await ffmpeg.getVideoMetaHelper(audioEntry.filePath);
              if (meta && meta.duration && meta.duration > 0) {
                const m = Math.floor(meta.duration / 60);
                const s = Math.floor(meta.duration % 60);
                const minStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                audioDurationText = `${meta.duration.toFixed(1)} Detik (${minStr})`;
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
      ? `Keluarkan HANYA JSON Object yang dikelompokkan berdasarkan nomor Part seperti contoh berikut:

{
  "${targetParts[0]}": [
    {
      "id": 1,
      "start_seconds": 0.0,
      "end_seconds": 3.4,
      "timestamp_minute": "00:00 - 00:03",
      "text": "Kalimat naskah awal...",
      "speaker": "Narator"
    }
  ],
  "${targetParts[1] || targetParts[0] + 1}": [
    {
      "id": 1,
      "start_seconds": 105.2,
      "end_seconds": 109.1,
      "timestamp_minute": "01:45 - 01:49",
      "text": "Kalimat awal part berikutnya...",
      "speaker": "Narator"
    }
  ]
}`
      : `Keluarkan HANYA JSON Array murni seperti contoh berikut:

[
  {
    "id": 1,
    "start_seconds": 0.0,
    "end_seconds": 3.4,
    "timestamp_minute": "00:00 - 00:03",
    "text": "Kalimat naskah...",
    "speaker": "Narator"
  }
]`;

    const fullPrompt = promptTemplate
      .replace(/{{chunk_part}}/g, String(chunkPart))
      .replace(/{{total_chunks}}/g, String(totalChunks))
      .replace(/{{target_parts_text}}/g, targetPartsText)
      .replace(/{{audio_duration}}/g, audioDurationText)
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
    speaker: entry.speaker || 'Narator',
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
      throw new Error('Transcript JSON payload is empty or invalid.');
    }

    let raw = (typeof jsonText === 'string' ? jsonText : JSON.stringify(jsonText)).trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    let parsed = JSON.parse(raw);

    const parsedInfo = parseTranscriptPayload(parsed);
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

    sendProgress('preparing', 5, `Starting WhisperX alignment for Parts #${sortedParts.join(', #')}...`);

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
        } catch {}
      }
    }

    if (!targetAudioPath || !fs.existsSync(targetAudioPath)) {
      throw new Error(`Voiceover audio file not found for Parts #${sortedParts.join(', #')}. Please upload audio first.`);
    }

    // Collect reference scripts from Step 2 analysis JSON files
    const referenceTexts = [];
    const scriptByPart = {};
    for (const pt of sortedParts) {
      const partStr = String(pt).padStart(2, '0');
      const analysisPath = path.join(p.ALURFILM_DIR, `${contentId}_analysis_part_${partStr}.json`);
      if (fs.existsSync(analysisPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
          const scriptText = data.naskah_voiceover?.script_text || data.script_text || '';
          if (scriptText) {
            referenceTexts.push(scriptText.trim());
            scriptByPart[pt] = scriptText.trim();
          }
        } catch {}
      }
    }

    if (referenceTexts.length === 0) {
      throw new Error(`Script analysis files not found for Parts #${sortedParts.join(', #')}. Please generate or upload scripts first.`);
    }

    const combinedScriptText = referenceTexts.join(' ');
    const partsStr = sortedParts.map(pt => String(pt).padStart(2, '0')).join('-');
    const tempNarasiPath = path.join(p.TMP_DIR, `${contentId}_narasi_parts_${partsStr}.txt`);
    const tempOutputPath = path.join(p.TMP_DIR, `${contentId}_alignment_output_${partsStr}.json`);

    fs.writeFileSync(tempNarasiPath, combinedScriptText, 'utf-8');
    sendProgress('preparing', 15, `Prepared script text (~${combinedScriptText.split(/\s+/).length} words) and target audio: ${path.basename(targetAudioPath)}`);

    // Setup Python process arguments
    const projectRoot = p.PROJECT_ROOT || path.resolve(__dirname, '..', '..', '..');
    const pythonBin = path.join(projectRoot, 'whisperx', 'venv', 'bin', 'python3');
    const alignCli = path.join(projectRoot, 'whisperx', 'align_cli.py');

    if (!fs.existsSync(pythonBin)) {
      throw new Error(`Python virtual environment not found at ${pythonBin}`);
    }
    if (!fs.existsSync(alignCli)) {
      throw new Error(`Align CLI script not found at ${alignCli}`);
    }

    const args = [
      alignCli,
      '--audio', targetAudioPath,
      '--text', tempNarasiPath,
      '--output', tempOutputPath,
      '--model', 'medium',
      '--device', 'cpu'
    ];

    const childEnv = {
      ...process.env,
      PYTHONSAFEPATH: '1'
    };

    sendProgress('loading_model', 25, `Spawning Python Faster-Whisper alignment process...`);

    await new Promise((resolve, reject) => {
      const proc = spawn(pythonBin, args, { env: childEnv, cwd: projectRoot });

      function handleLogLine(rawLine) {
        const line = rawLine.replace(/^\[log\]\s*/, '').replace(/^\[faster-whisper\]\s*/, '').trim();
        if (!line) return;

        let progress = 30;
        let stage = 'aligning';

        if (line.includes('Load faster-whisper model')) { progress = 25; stage = 'loading_model'; }
        else if (line.includes('Transcribing audio fisik')) { progress = 50; stage = 'transcribing'; }
        else if (line.includes('Selesai VAD Transcribe')) { progress = 75; stage = 'aligning'; }
        else if (line.includes('Mapping')) { progress = 85; stage = 'mapping'; }
        else if (line.includes('Selesai!')) { progress = 90; stage = 'done'; }

        sendProgress(stage, progress, line);
      }

      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const l of lines) handleLogLine(l);
      });

      proc.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const l of lines) handleLogLine(l);
      });

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempOutputPath)) {
          resolve(true);
        } else {
          reject(new Error(`WhisperX alignment process exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });

    sendProgress('mapping', 92, `Alignment complete. Mapping aligned sentences to individual parts...`);

    // Parse alignment JSON output
    const alignJsonRaw = fs.readFileSync(tempOutputPath, 'utf-8');
    const alignJson = JSON.parse(alignJsonRaw);
    const transcriptEntries = alignJson.transcript || alignJson.sentences || [];

    // Map sentences to individual parts
    let idx = 0;
    const multiPartMap = {};

    for (const pt of sortedParts) {
      const scriptText = scriptByPart[pt] || '';
      const matched = [];

      while (idx < transcriptEntries.length) {
        const item = transcriptEntries[idx];
        const txt = item.text || '';
        if (txt && scriptText.includes(txt)) {
          const itemCopy = { ...item, id: matched.length + 1 };
          matched.push(itemCopy);
          idx++;
        } else {
          break;
        }
      }

      multiPartMap[pt] = matched;
      sendProgress('mapping', 95, `Part #${pt}: Mapped ${matched.length} aligned entries.`);
    }

    // Handle any remaining unmatched entries by appending to last part if applicable
    if (idx < transcriptEntries.length) {
      const lastPt = sortedParts[sortedParts.length - 1];
      const remaining = transcriptEntries.slice(idx);
      multiPartMap[lastPt] = (multiPartMap[lastPt] || []).concat(remaining);
    }

    // Save outputs using save-alurfilm-transcript multiPart feature
    const targetDir = p.ALURFILM_TRANSCRIPTS_DIR || path.join(p.ALURFILM_DIR, 'transcripts');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const savedResults = [];
    for (const pt of sortedParts) {
      const entries = multiPartMap[pt] || [];
      const partStr = String(pt).padStart(2, '0');
      const outputName = `${contentId}_transcript_part_${partStr}.json`;
      const destPath = path.join(targetDir, outputName);

      let prevEnd = 0;
      const normEntries = entries.map((e, index) => {
        const res = normalizeBackendEntry(e, index, prevEnd);
        prevEnd = res.end_seconds;
        return res;
      });

      fs.writeFileSync(destPath, JSON.stringify(normEntries, null, 2), 'utf-8');
      savedResults.push({ part: pt, name: outputName, filePath: destPath, data: normEntries, entries: normEntries });
    }

    // Save combined multipart file as well
    const multipartFile = path.join(targetDir, `${contentId}_transcript_multipart.json`);
    const multiPartObject = {};
    for (const pt of sortedParts) {
      multiPartObject[String(pt)] = multiPartMap[pt] || [];
    }
    fs.writeFileSync(multipartFile, JSON.stringify(multiPartObject, null, 2), 'utf-8');

    sendProgress('done', 100, `Successfully saved transcript files for Parts #${sortedParts.join(', #')}!`);

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
    let transcriptPath = path.join(targetTransDir, `${contentId}_transcript_part_${partStr}.json`);
    if (!fs.existsSync(transcriptPath)) {
      transcriptPath = path.join(p.ALURFILM_DIR, `${contentId}_transcript_part_${partStr}.json`);
    }
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

  // ─── Save Alurfilm Mapping ─────────────────────────────
  ipcMain.handle('save-alurfilm-mapping', async (_event, { chunkPart, jsonText }) => {
    const contentId = p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_DIR)) fs.mkdirSync(p.ALURFILM_DIR, { recursive: true });

    let raw = (jsonText || '').trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(raw);
    const partStr = String(chunkPart).padStart(2, '0');
    const outputName = `${contentId}_mapping_part_${partStr}.json`;
    const destPath = path.join(p.ALURFILM_DIR, outputName);

    fs.writeFileSync(destPath, JSON.stringify(parsed, null, 2), 'utf-8');

    return { part: chunkPart, name: outputName, filePath: destPath, data: parsed };
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
          const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          return { part, name: f, filePath: fullPath, data };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => a.part - b.part);

    return mappings;
  });

  // ─── List Alurfilm Renders ─────────────────────────────
  ipcMain.handle('list-alurfilm-renders', async (_event, modeContentId) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    const outputDir = path.join(p.PROJECT_ROOT, 'output');
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
              partMap[part] = { part, name: f, filePath: fullPath, mediaUrl: media.mediaUrl(fullPath), mtimeMs: stat.mtimeMs, elapsed: 'Done' };
            }
          } catch { }
        }
      }
    }

    return Object.values(partMap).sort((a, b) => a.part - b.part);
  });
}

module.exports = { register };
