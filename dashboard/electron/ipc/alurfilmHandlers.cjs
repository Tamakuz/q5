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
  async function splitAlurfilmVideoHelper(masterPath, startTime, endTime) {
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

    for (let i = 0; i < numParts; i++) {
      const partStartSec = startSec + (i * chunkDuration);
      const partDurationSec = Math.min(chunkDuration, endSec - partStartSec);
      const partNumStr = String(i + 1).padStart(2, '0');
      const outputName = `${contentId}_part_${partNumStr}.mp4`;
      const destPath = path.join(p.ALURFILM_CHUNKS_DIR, outputName);

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
        createdChunks.push({
          part: i + 1,
          name: outputName,
          size: stat.size,
          startSec: partStartSec,
          durationSec: partDurationSec,
          filePath: destPath,
          url: media.mediaUrl(destPath)
        });
      }
    }

    return createdChunks;
  }

  // ─── IPC: split-alurfilm-video ─────────────────────────
  ipcMain.handle('split-alurfilm-video', async (_event, opts) => {
    const masterPath = typeof opts === 'string' ? opts : opts?.masterPath;
    const startTime = opts?.startTime ?? 0;
    const endTime = opts?.endTime ?? 0;
    return splitAlurfilmVideoHelper(masterPath, startTime, endTime);
  });

  // ─── IPC: split-alurfilm-master ────────────────────────
  ipcMain.handle('split-alurfilm-master', async (_event, opts) => {
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

    const chunks = await splitAlurfilmVideoHelper(masterPath, startTime, endTime);
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
  ipcMain.handle('upload-alurfilm-audio', async (_event, { part, filePath }) => {
    const contentId = p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_DIR)) fs.mkdirSync(p.ALURFILM_DIR, { recursive: true });

    const ext = path.extname(filePath) || '.mp3';
    const partStr = String(part).padStart(2, '0');
    const outputName = `${contentId}_audio_part_${partStr}${ext}`;
    const destPath = path.join(p.ALURFILM_DIR, outputName);

    const existingFiles = fs.readdirSync(p.ALURFILM_DIR).filter(f => f.startsWith(`${contentId}_audio_part_${partStr}`));
    for (const f of existingFiles) {
      try { fs.unlinkSync(path.join(p.ALURFILM_DIR, f)); } catch { }
    }

    fs.copyFileSync(filePath, destPath);
    const stat = fs.statSync(destPath);

    return { part, name: outputName, filePath: destPath, url: media.mediaUrl(destPath), size: stat.size };
  });

  // ─── List Alurfilm Audios ──────────────────────────────
  ipcMain.handle('list-alurfilm-audios', async (_event, modeContentId) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_DIR)) return [];

    const files = fs.readdirSync(p.ALURFILM_DIR);
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
    const audios = files
      .filter(f => f.startsWith(`${contentId}_audio_part_`) && audioExtensions.includes(path.extname(f).toLowerCase()))
      .map(f => {
        const match = f.match(/_audio_part_(\d+)/);
        const part = match ? parseInt(match[1], 10) : 1;
        const fullPath = path.join(p.ALURFILM_DIR, f);
        const stat = fs.statSync(fullPath);
        return { part, name: f, filePath: fullPath, url: media.mediaUrl(fullPath), size: stat.size };
      })
      .sort((a, b) => a.part - b.part);

    return audios;
  });

  // ─── Delete Alurfilm Audio ─────────────────────────────
  ipcMain.handle('delete-alurfilm-audio', async (_event, { part }) => {
    const contentId = p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_DIR)) return true;

    const partStr = String(part).padStart(2, '0');
    const existingFiles = fs.readdirSync(p.ALURFILM_DIR).filter(f => f.startsWith(`${contentId}_audio_part_${partStr}`));
    for (const f of existingFiles) {
      try { fs.unlinkSync(path.join(p.ALURFILM_DIR, f)); } catch { }
    }
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
      promptTemplate = `Kamu adalah AI Audio Transcriber presisi tinggi. Transkrip audio part ${chunkPart} ke JSON array dengan start_seconds, end_seconds, timestamp_minute, text. Parameter durasi audio: {{audio_duration}}.`;
    }

    let audioDurationText = `[Sesuai total durasi file audio Part #${chunkPart}]`;
    if (fs.existsSync(p.ALURFILM_DIR)) {
      const partStr = String(chunkPart).padStart(2, '0');
      const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
      const files = fs.readdirSync(p.ALURFILM_DIR);
      const audioFile = files.find(f => f.startsWith(`${contentId}_audio_part_${partStr}`) && audioExtensions.includes(path.extname(f).toLowerCase()));
      if (audioFile) {
        const fullPath = path.join(p.ALURFILM_DIR, audioFile);
        try {
          const meta = await ffmpeg.getVideoMetaHelper(fullPath);
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

  // ─── Save Alurfilm Transcript ──────────────────────────
  ipcMain.handle('save-alurfilm-transcript', async (_event, { chunkPart, jsonText }) => {
    const contentId = p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_DIR)) fs.mkdirSync(p.ALURFILM_DIR, { recursive: true });

    let raw = (jsonText || '').trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(raw);
    const partStr = String(chunkPart).padStart(2, '0');
    const outputName = `${contentId}_transcript_part_${partStr}.json`;
    const destPath = path.join(p.ALURFILM_DIR, outputName);

    fs.writeFileSync(destPath, JSON.stringify(parsed, null, 2), 'utf-8');

    return { part: chunkPart, name: outputName, filePath: destPath, data: parsed };
  });

  // ─── List Alurfilm Transcripts ─────────────────────────
  ipcMain.handle('list-alurfilm-transcripts', async (_event, modeContentId) => {
    const contentId = modeContentId || p.getOrGenerateContentId('longform');
    if (!fs.existsSync(p.ALURFILM_DIR)) return [];

    const files = fs.readdirSync(p.ALURFILM_DIR);
    const transcripts = files
      .filter(f => f.startsWith(`${contentId}_transcript_part_`) && f.endsWith('.json'))
      .map(f => {
        const match = f.match(/_transcript_part_(\d+)/);
        const part = match ? parseInt(match[1], 10) : 1;
        const fullPath = path.join(p.ALURFILM_DIR, f);
        try {
          const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          return { part, name: f, filePath: fullPath, data };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => a.part - b.part);

    return transcripts;
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
    const transcriptPath = path.join(p.ALURFILM_DIR, `${contentId}_transcript_part_${partStr}.json`);
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
