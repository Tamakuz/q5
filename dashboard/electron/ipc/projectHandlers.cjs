// dashboard/electron/ipc/projectHandlers.cjs
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

function register(ipcMain, { paths: p, media, ffmpeg, aiClient, loadPrompt, getMainWindow }) {
  // ─── Content ID Helper ────────────────────────────────
  ipcMain.handle('get-content-id', async (_event, mode) => {
    return p.getOrGenerateContentId(mode);
  });

  // ─── Reset project workspace ───────────────────────────
  ipcMain.handle('reset-project', async (_event, mode = 'spensia') => {
    const isLongform = mode === 'longform';
    const isSpensia = mode === 'spensia';
    try {
      const outputDir = path.join(p.PROJECT_ROOT, 'output');
      const inputDir = path.join(p.PROJECT_ROOT, 'input');
      const alurfilmDir = path.join(p.PROJECT_ROOT, 'input', 'alurfilm');
      const alurfilmChunksDir = path.join(p.PROJECT_ROOT, 'input', 'alurfilm', 'chunks');
      const assetsDir = path.join(p.PROJECT_ROOT, 'input', 'assets');
      const tmpDir = path.join(p.PROJECT_ROOT, 'input', '.tmp');

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const prefix = isSpensia ? 'WV-SPENSIA' : isLongform ? 'WV-FILM' : 'WV';
      const newId = `${prefix}-${dateStr}-${randStr}`;

      if (isSpensia) {
        console.log(`🧹 [Reset Spensia] Clearing spensia workspace and setting new Content ID: ${newId}`);
        const spensiaInputDir = path.join(inputDir, 'spensia');
        const spensiaOutputDir = path.join(outputDir, 'spensia');

        if (fs.existsSync(spensiaInputDir)) {
          try {
            const items = fs.readdirSync(spensiaInputDir);
            for (const item of items) {
              try { fs.rmSync(path.join(spensiaInputDir, item), { recursive: true, force: true }); } catch (err) {
                console.error(`[Reset Spensia] Failed to delete ${item}:`, err);
              }
            }
          } catch (e) {
            console.error('[Reset Spensia] Error reading input/spensia:', e);
          }
        } else { fs.mkdirSync(spensiaInputDir, { recursive: true }); }

        if (fs.existsSync(spensiaOutputDir)) {
          try {
            const items = fs.readdirSync(spensiaOutputDir);
            for (const item of items) {
              try { fs.rmSync(path.join(spensiaOutputDir, item), { recursive: true, force: true }); } catch (err) {
                console.error(`[Reset Spensia] Failed to delete output item ${item}:`, err);
              }
            }
          } catch (e) {
            console.error('[Reset Spensia] Error reading output/spensia:', e);
          }
        } else { fs.mkdirSync(spensiaOutputDir, { recursive: true }); }

        const mappingFile = path.join(spensiaInputDir, 'spensia_mapping.json');
        const mapping = {
          settings: { fps: 30, format: "16:9", fg_aspect: "16:9", bgm: "random", content_id: newId },
          timeline: []
        };
        fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2), 'utf-8');
        fs.writeFileSync(path.join(spensiaInputDir, '.current_content_id'), newId, 'utf-8');
        return { success: true, content_id: newId };
      }

      if (isLongform) {
        console.log(`🧹 [Reset Longform] Clearing all longform files and setting new Content ID: ${newId}`);
        if (fs.existsSync(alurfilmDir)) {
          try {
            const items = fs.readdirSync(alurfilmDir);
            for (const item of items) {
              try { fs.rmSync(path.join(alurfilmDir, item), { recursive: true, force: true }); } catch (err) {
                console.error(`[Reset Longform] Failed to delete ${item}:`, err);
              }
            }
          } catch (e) {
            console.error('[Reset Longform] Error reading input/alurfilm:', e);
          }
        } else {
          fs.mkdirSync(alurfilmDir, { recursive: true });
        }

        if (fs.existsSync(outputDir)) {
          const files = fs.readdirSync(outputDir);
          for (const f of files) { try { fs.unlinkSync(path.join(outputDir, f)); } catch { } }
        }
        const mappingFile = path.join(inputDir, 'longform_mapping.json');
        const defaultMapping = {
          settings: { fps: 30, format: "16:9", fg_aspect: "16:9", bgm: "random", content_id: newId },
          timeline: []
        };
        fs.writeFileSync(mappingFile, JSON.stringify(defaultMapping, null, 2), 'utf-8');
        if (!fs.existsSync(alurfilmDir)) fs.mkdirSync(alurfilmDir, { recursive: true });
        fs.writeFileSync(path.join(alurfilmDir, '.current_content_id'), newId, 'utf-8');
        return { success: true, content_id: newId };
      }

      return { success: true, content_id: newId };
    } catch (err) {
      console.error('Reset project error:', err);
      return { success: false, error: err.message };
    }
  });

  // ─── List project assets ──────────────────────────────
  ipcMain.handle('list-project-assets', async () => {
    const assetsDir = path.join(p.PROJECT_ROOT, 'assets');
    if (!fs.existsSync(assetsDir)) return { logos: [], bgms: [] };

    const logos = [];
    const bgms = [];

    const scanDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile()) {
          const relPath = path.relative(p.PROJECT_ROOT, fullPath);
          if (entry.name.match(/\.(png|jpg|jpeg|webp)$/i)) {
            logos.push({ name: entry.name, path: relPath, fullPath, url: media.mediaUrl(fullPath) });
          } else if (entry.name.match(/\.(mp3|wav|m4a|aac|flac)$/i)) {
            bgms.push({ name: entry.name, path: relPath, fullPath, url: media.mediaUrl(fullPath) });
          }
        }
      }
    };

    scanDir(assetsDir);
    return { logos, bgms };
  });

  // ─── Generate YouTube Shorts Titles via AI ────────────
  ipcMain.handle('generate-youtube-titles', async (_event, transcriptText) => {
    const promptFileName = 'youtube-shorts-prompt.md';
    const promptFile = path.join(p.PROMPTS_DIR, 'shortform', promptFileName);
    let promptTemplate = '';
    if (fs.existsSync(promptFile)) {
      promptTemplate = fs.readFileSync(promptFile, 'utf-8');
    } else {
      promptTemplate = `Kamu adalah YouTube Shorts Algorithm Expert. Buatkan 5 Judul Viral, Deskripsi, dan Hashtag untuk video recap ini: {{transcript_text}}. Output JSON: {"titles": [], "description": "", "hashtags": [], "recommended_title": ""}`;
    }

    const fullPrompt = promptTemplate.replace('{{transcript_text}}', transcriptText || 'Video Recap Anime/Cartoon');
    return aiClient.generateYoutubeTitles({ fullPrompt });
  });

  // ─── Generate YouTube Shorts Sourcing Keywords via 9router AI ────
  ipcMain.handle('generate-shorts-keywords', async (_event, opts = {}) => {
    const promptFile = path.join(p.PROMPTS_DIR, 'shortform', 'shorts-sourcing-keywords.md');
    let promptTemplate = '';
    if (fs.existsSync(promptFile)) {
      promptTemplate = fs.readFileSync(promptFile, 'utf-8');
    } else {
      promptTemplate = `You are a YouTube Shorts Sourcing Strategist for US audiences. Generate 4 search keywords in English for footage sourcing: 1. Mass Food Production, 2. Industrial Manufacturing, 3. Master Crafting & Rare Processing, 4. Woodworking & Resin Crafting. Rules: DO NOT use active blacklisted keywords: {{ACTIVE_KEYWORDS_BLACKLIST}}. Return JSON array with "sub_niche" and "keyword".`;
    }

    const historyFile = path.join(p.PROJECT_ROOT, 'input', 'shorts', 'keywords-history.json');
    let historyData = { cooldown_days: 14, history: [] };
    if (fs.existsSync(historyFile)) {
      try {
        historyData = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      } catch (e) {
        console.error('Error reading keywords history file:', e);
      }
    }

    const now = new Date();

    // Check if keywords were already generated today
    const todaysKeywords = (historyData.history || []).filter((item) => {
      if (!item.used_at) return false;
      const d = new Date(item.used_at);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    });

    if (todaysKeywords.length >= 4 && !opts.force) {
      console.log('📌 [generate-shorts-keywords] Returning existing keywords generated today.');
      return {
        success: true,
        keywords: todaysKeywords.slice(0, 4),
        alreadyGeneratedToday: true,
        activeHistory: (historyData.history || []).filter((item) => new Date(item.expires_at) > now),
      };
    }

    const activeKeywords = (historyData.history || []).filter((item) => new Date(item.expires_at) > now);
    const blacklist = activeKeywords.map((k) => k.keyword.toLowerCase());

    const fullPrompt = promptTemplate.replace('{{ACTIVE_KEYWORDS_BLACKLIST}}', JSON.stringify(blacklist, null, 2));

    const rawText = await aiClient.chatCompletion({
      prompt: fullPrompt,
      systemPrompt: 'You are an expert YouTube Shorts Production Strategist. Output strictly valid JSON arrays.',
      model: opts.model || 'ag/gemini-3-flash-agent',
      jsonMode: true,
    });

    const cleaned = aiClient.extractCleanJsonObject(rawText);
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`Invalid JSON format returned from 9router: ${rawText}`);
    }
    if (!Array.isArray(parsed) || parsed.length !== 4) {
      throw new Error(`Invalid keyword count returned (Expected 4, received ${parsed?.length || 0})`);
    }

    const expires = new Date(now.getTime() + (historyData.cooldown_days || 14) * 24 * 60 * 60 * 1000);
    const newItems = parsed.map((item, idx) => ({
      id: `kw_${now.getTime()}_${idx}`,
      sub_niche: item.sub_niche || 'Sub-Niche',
      keyword: item.keyword,
      youtube_search_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(item.keyword)}`,
      target_market: 'US',
      used_at: now.toISOString(),
      expires_at: expires.toISOString(),
    }));

    historyData.history = [...newItems, ...(historyData.history || [])];
    fs.mkdirSync(path.dirname(historyFile), { recursive: true });
    fs.writeFileSync(historyFile, JSON.stringify(historyData, null, 2), 'utf-8');

    return {
      success: true,
      keywords: newItems,
      activeHistory: historyData.history.filter((item) => new Date(item.expires_at) > now),
    };
  });

  // ─── Download YouTube Shorts Video via yt-dlp ─────────────────
  ipcMain.handle('shorts:download-video', async (event, { keywordId, subNiche, keyword, youtubeUrl }) => {
    const ytDlpPath = path.resolve(p.PROJECT_ROOT, 'bin', 'yt-dlp');
    const outputDir = path.resolve(p.PROJECT_ROOT, 'input', 'shorts', 'raw_videos');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const safeSlug = (subNiche || 'short').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const outputFilename = `${safeSlug}_${keywordId}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    return new Promise((resolve) => {
      console.log(`📥 [shorts:download-video] Downloading YouTube video for keyword (${keywordId}): ${youtubeUrl}`);
      const args = [
        '--js-runtimes', 'node:/home/jovan/.nvm/versions/node/v22.21.1/bin/node',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        '--referer', 'https://www.youtube.com/',
        '--http-chunk-size', '10M',
        '--ffmpeg-location', '/usr/bin/ffmpeg',
        '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '-o', outputPath,
        '--newline',
        youtubeUrl
      ];

      const env = {
        ...process.env,
        PATH: `/home/jovan/.nvm/versions/node/v22.21.1/bin:${process.env.PATH || ''}`
      };

      const child = spawn(ytDlpPath, args, { env });
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        const text = data.toString();
        const match = text.match(/\[download\]\s+([\d\.]+)%\s+of\s+([~\d\.\w]+)\s+at\s+([~\d\.\w\/]+)/);
        if (match) {
          event.sender.send('shorts:download-progress', {
            keywordId,
            percentage: parseFloat(match[1]),
            totalSize: match[2],
            speed: match[3]
          });
        }
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          let stats = { size: 0 };
          try { stats = fs.statSync(outputPath); } catch (e) {}

          const sourcesFile = path.resolve(p.PROJECT_ROOT, 'input', 'shorts', 'video-sources.json');
          let sourcesData = { items: [] };
          if (fs.existsSync(sourcesFile)) {
            try {
              sourcesData = JSON.parse(fs.readFileSync(sourcesFile, 'utf-8'));
            } catch (e) {}
          }

          const now = new Date().toISOString();
          const existingIdx = (sourcesData.items || []).findIndex(i => i.keyword_id === keywordId);
          const existingItem = existingIdx >= 0 ? sourcesData.items[existingIdx] : {};
          // Auto compress if raw file size > 400 MB or check compressed folder
          const compressedDir = path.resolve(p.PROJECT_ROOT, 'input', 'shorts', 'compressed_videos');
          const compressedFilename = `${safeSlug}_${keywordId}_compressed.mp4`;
          const compressedPath = path.join(compressedDir, compressedFilename);
          const relativeCompressedPath = `input/shorts/compressed_videos/${compressedFilename}`;

          let compressedInfo = {};
          if (fs.existsSync(compressedPath)) {
            const compStats = fs.statSync(compressedPath);
            compressedInfo = {
              compressed_video_filename: compressedFilename,
              compressed_video_path: relativeCompressedPath,
              compressed_file_size_bytes: compStats.size,
              is_compressed: true,
            };
          }

          const newItem = {
            ...existingItem,
            keyword_id: keywordId,
            sub_niche: subNiche,
            keyword,
            youtube_url: youtubeUrl,
            video_filename: outputFilename,
            video_path: `input/shorts/raw_videos/${outputFilename}`,
            ...compressedInfo,
            status: 'downloaded',
            downloaded_at: now,
            file_size_bytes: stats.size
          };

          if (existingIdx >= 0) {
            sourcesData.items[existingIdx] = newItem;
          } else {
            sourcesData.items = [newItem, ...(sourcesData.items || [])];
          }

          fs.mkdirSync(path.dirname(sourcesFile), { recursive: true });
          fs.writeFileSync(sourcesFile, JSON.stringify(sourcesData, null, 2), 'utf-8');

          resolve({
            success: true,
            videoPath: `input/shorts/raw_videos/${outputFilename}`,
            compressedPath: compressedInfo.compressed_video_path,
            compressedSizeBytes: compressedInfo.compressed_file_size_bytes,
            fileSizeBytes: stats.size
          });
        } else {
          console.error(`❌ [shorts:download-video] Failed code ${code}:`, errorOutput);
          resolve({ success: false, error: errorOutput || `yt-dlp process exited with code ${code}` });
        }
      });
    });
  });

  // ─── Compress Shorts Video Helper & IPC Handler ───────────────
  async function compressShortsVideoHelper(inputPath, outputPath, keywordId, event) {
    return new Promise(async (resolve) => {
      if (!fs.existsSync(inputPath)) {
        return resolve({ success: false, error: `File video mentah tidak ditemukan: ${inputPath}` });
      }

      const compressedDir = path.dirname(outputPath);
      if (!fs.existsSync(compressedDir)) {
        fs.mkdirSync(compressedDir, { recursive: true });
      }

      let meta = { duration: 600 };
      try {
        if (ffmpeg.getVideoMetaHelper) {
          meta = await ffmpeg.getVideoMetaHelper(inputPath);
        }
      } catch (e) {}

      const durationSec = Math.max(10, meta.duration || 600);
      const targetSizeBytes = 350 * 1024 * 1024; // Target 350MB safe limit (<400MB)
      const totalTargetBitrateBps = (targetSizeBytes * 8) / durationSec;
      const audioBitrateBps = 128 * 1024;
      let videoBitrateKbps = Math.floor((totalTargetBitrateBps - audioBitrateBps) / 1000);

      if (videoBitrateKbps < 500) videoBitrateKbps = 500;
      if (videoBitrateKbps > 4000) videoBitrateKbps = 4000;

      const ffmpegBin = ffmpeg.ffmpegPath || '/usr/bin/ffmpeg';
      const cpuThreads = Math.min(4, Math.max(1, os.cpus().length - 1));
      const args = [
        '-y',
        '-threads', String(cpuThreads),
        '-i', inputPath,
        '-c:v', 'libx264',
        '-b:v', `${videoBitrateKbps}k`,
        '-maxrate', `${Math.floor(videoBitrateKbps * 1.2)}k`,
        '-bufsize', `${videoBitrateKbps * 2}k`,
        '-preset', 'superfast',
        '-vf', "scale='min(1920,iw)':-2",
        '-c:a', 'aac',
        '-b:a', '128k',
        outputPath
      ];

      console.log(`⚡ [shorts:compress-video] Compressing video for ${keywordId} to ${outputPath} (bitrate: ${videoBitrateKbps}k)...`);
      const child = spawn(ffmpegBin, args);
      let errorOutput = '';

      child.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
        if (timeMatch && durationSec > 0 && event?.sender) {
          const hours = parseFloat(timeMatch[1]);
          const mins = parseFloat(timeMatch[2]);
          const secs = parseFloat(timeMatch[3]);
          const currentSec = hours * 3600 + mins * 60 + secs;
          const percentage = Math.min(100, Math.round((currentSec / durationSec) * 100));
          event.sender.send('shorts:compress-progress', { keywordId, percentage });
        }
      });

      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log(`✅ [shorts:compress-video] Compression finished: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
          if (event?.sender) {
            event.sender.send('shorts:compress-progress', { keywordId, percentage: 100 });
          }
          resolve({ success: true, compressedPath: outputPath, compressedSizeBytes: stats.size });
        } else {
          console.error(`❌ [shorts:compress-video] Compression failed code ${code}:`, errorOutput);
          resolve({ success: false, error: errorOutput || `FFmpeg process exited with code ${code}` });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  ipcMain.handle('shorts:compress-video', async (event, { keywordId, videoPath }) => {
    const inputPath = path.resolve(p.PROJECT_ROOT, videoPath);
    const compressedDir = path.resolve(p.PROJECT_ROOT, 'input', 'shorts', 'compressed_videos');
    const baseName = path.basename(videoPath, path.extname(videoPath));
    const outputFilename = `${baseName}_compressed.mp4`;
    const outputPath = path.join(compressedDir, outputFilename);
    const relativeCompressedPath = `input/shorts/compressed_videos/${outputFilename}`;

    const res = await compressShortsVideoHelper(inputPath, outputPath, keywordId, event);
    if (res.success) {
      const sourcesFile = path.resolve(p.PROJECT_ROOT, 'input', 'shorts', 'video-sources.json');
      if (fs.existsSync(sourcesFile)) {
        try {
          const sourcesData = JSON.parse(fs.readFileSync(sourcesFile, 'utf-8'));
          const idx = (sourcesData.items || []).findIndex(i => i.keyword_id === keywordId || i.id === keywordId);
          if (idx >= 0) {
            sourcesData.items[idx] = {
              ...sourcesData.items[idx],
              compressed_video_filename: outputFilename,
              compressed_video_path: relativeCompressedPath,
              compressed_file_size_bytes: res.compressedSizeBytes,
              is_compressed: true,
            };
            fs.writeFileSync(sourcesFile, JSON.stringify(sourcesData, null, 2), 'utf-8');
          }
        } catch (e) {}
      }
    }
    return {
      ...res,
      compressedPath: relativeCompressedPath,
    };
  });

  // ─── Upload Shorts VO Audio ──────────────────────────────────
  ipcMain.handle('shorts:upload-vo-audio', async (_event, { segmentId, lang = 'id', sourcePath, bufferArray, extension = 'mp3' }) => {
    const audioDir = path.resolve(p.PROJECT_ROOT, 'input', 'shorts', 'audio');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

    const filename = `seg_${segmentId}_vo_${lang}.${extension.replace('.', '')}`;
    const targetPath = path.join(audioDir, filename);

    if (sourcePath && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
    } else if (bufferArray) {
      const buf = Buffer.from(bufferArray);
      fs.writeFileSync(targetPath, buf);
    } else {
      throw new Error('File audio source atau buffer tidak valid.');
    }

    const relativePath = `input/shorts/audio/${filename}`;
    const stats = fs.statSync(targetPath);
    return {
      success: true,
      audioPath: relativePath,
      audioFilename: filename,
      fileSizeBytes: stats.size,
    };
  });

  // ─── Run Shorts Faster-Whisper Alignment ───────────────────────
  ipcMain.handle('shorts:run-whisper-alignment', async (event, { audioPath, scriptText, lang = 'id' }) => {
    return new Promise((resolve) => {
      const sendProgress = (step, percent, detail) => {
        if (event?.sender) {
          event.sender.send('shorts:whisper-progress', { step, percent, detail });
        }
      };

      sendProgress('init', 5, 'Menyiapkan file audio dan naskah narasi...');

      let resolvedAudio = audioPath;
      if (!path.isAbsolute(resolvedAudio)) {
        resolvedAudio = path.resolve(p.PROJECT_ROOT, resolvedAudio);
      }

      if (!fs.existsSync(resolvedAudio)) {
        return resolve({ success: false, error: `File audio narasi tidak ditemukan di: ${resolvedAudio}` });
      }

      let pythonBin = path.join(p.PROJECT_ROOT, 'whisperx', 'venv', 'bin', 'python3');
      if (!fs.existsSync(pythonBin)) {
        pythonBin = '/usr/bin/python3';
      }
      const alignCli = path.join(p.PROJECT_ROOT, 'whisperx', 'align_cli.py');
      if (!fs.existsSync(alignCli)) {
        return resolve({ success: false, error: `Align CLI script tidak ditemukan di: ${alignCli}` });
      }

      const tmpDir = path.join(p.PROJECT_ROOT, 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      const tmpScriptPath = path.join(tmpDir, `shorts_align_${Date.now()}.txt`);
      const outJsonPath = path.join(tmpDir, `shorts_align_${Date.now()}.json`);
      fs.writeFileSync(tmpScriptPath, scriptText || '', 'utf-8');

      sendProgress('loading_model', 20, `Memuat engine Faster-Whisper (${lang.toUpperCase()})...`);

      const spawnArgs = [
        alignCli,
        '--audio', resolvedAudio,
        '--text', tmpScriptPath,
        '--output', outJsonPath,
        '--model', 'small',
        '--language', lang
      ];

      const child = spawn(pythonBin, spawnArgs, {
        env: { ...process.env },
      });

      let errorLogs = '';

      child.stderr.on('data', (data) => {
        const text = data.toString();
        errorLogs += text;
        sendProgress('aligning', 50, 'Memproses alignment audio & naskah...');
      });

      child.on('close', (code) => {
        try {
          if (fs.existsSync(tmpScriptPath)) fs.unlinkSync(tmpScriptPath);
        } catch (e) {}

        if (code === 0 && fs.existsSync(outJsonPath)) {
          try {
            const rawJson = fs.readFileSync(outJsonPath, 'utf-8');
            const resultData = JSON.parse(rawJson);
            if (fs.existsSync(outJsonPath)) fs.unlinkSync(outJsonPath);

            sendProgress('done', 100, 'Alignment naskah & audio berhasil!');
            resolve({ success: true, result: resultData });
          } catch (err) {
            resolve({ success: false, error: `Gagal membaca hasil JSON alignment: ${err.message}` });
          }
        } else {
          resolve({ success: false, error: errorLogs || `Proses alignment keluar dengan exit code ${code}` });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: `Kesalahan sistem spawn python: ${err.message}` });
      });
    });
  });

  // ─── Render Shorts Segment Video via FFmpeg ────────────────────
  ipcMain.handle('shorts:render-segment', async (event, { segmentId, lang = 'id' }) => {
    return new Promise((resolve) => {
      const sendProgress = (percent, detail) => {
        if (event?.sender) {
          event.sender.send('shorts:render-progress', { segmentId, lang, percent, detail });
        }
      };

      sendProgress(5, 'Menyiapkan data video mapping & audio...');

      const mappingPath = path.join(p.PROJECT_ROOT, 'input/shorts/video-mapping.json');
      if (!fs.existsSync(mappingPath)) {
        return resolve({ success: false, error: 'Data video mapping (Step 4) belum ditemukan di input/shorts/video-mapping.json' });
      }

      let rawMapping = '';
      try {
        rawMapping = fs.readFileSync(mappingPath, 'utf-8');
      } catch (e) {
        return resolve({ success: false, error: `Gagal membaca file video mapping: ${e.message}` });
      }

      const manifest = JSON.parse(rawMapping);
      const segData = manifest.items ? (manifest.items[segmentId] || manifest.items['main_shorts'] || Object.values(manifest.items)[0]) : null;

      if (!segData) {
        return resolve({ success: false, error: `Data mapping untuk segmen #${segmentId} belum diimpor/dibuat di Step 4.` });
      }

      const cuts = lang === 'id' ? segData.cuts_id : segData.cuts_en;
      if (!cuts || cuts.length === 0) {
        return resolve({ success: false, error: `Belum ada potongan video (cuts) untuk Bahasa ${lang === 'id' ? 'Indonesia' : 'Inggris'}.` });
      }

      let videoPath = null;

      // 1. Prioritize segData.source_video_path specified for this segment in video-mapping.json
      if (segData.source_video_path) {
        let candidate = segData.source_video_path;
        const resolvedCandidate = path.isAbsolute(candidate) ? candidate : path.join(p.PROJECT_ROOT, candidate);
        if (fs.existsSync(resolvedCandidate)) {
          videoPath = resolvedCandidate;
        } else if (candidate.includes('/compressed_videos/')) {
          const rawCandidate = candidate
            .replace('/compressed_videos/', '/raw_videos/')
            .replace('_compressed.mp4', '.mp4');
          const resolvedRaw = path.isAbsolute(rawCandidate) ? rawCandidate : path.join(p.PROJECT_ROOT, rawCandidate);
          if (fs.existsSync(resolvedRaw)) {
            videoPath = resolvedRaw;
          }
        }
      }

      // 2. If segData.source_video_id or video filename is available, match in input/shorts/video-sources.json
      if (!videoPath) {
        const sourcesPath = path.join(p.PROJECT_ROOT, 'input/shorts/video-sources.json');
        if (fs.existsSync(sourcesPath)) {
          try {
            const sManifest = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));
            if (sManifest.items && Array.isArray(sManifest.items)) {
              let matchedItem = null;
              if (segData.source_video_id) {
                matchedItem = sManifest.items.find((it) => it.id === segData.source_video_id);
              }
              if (!matchedItem && segData.source_video_path) {
                const baseName = path.basename(segData.source_video_path).replace('_compressed', '');
                matchedItem = sManifest.items.find((it) => it.video_filename === baseName || (it.video_path && it.video_path.includes(baseName)));
              }
              if (!matchedItem && sManifest.items.length > 0) {
                matchedItem = sManifest.items[0];
              }

              if (matchedItem) {
                if (matchedItem.compressed_video_path) {
                  const resolvedComp = path.isAbsolute(matchedItem.compressed_video_path) ? matchedItem.compressed_video_path : path.join(p.PROJECT_ROOT, matchedItem.compressed_video_path);
                  if (fs.existsSync(resolvedComp)) {
                    videoPath = resolvedComp;
                  }
                }
                if (!videoPath) {
                  const rawCandidate = matchedItem.video_path || matchedItem.raw_video_path;
                  if (rawCandidate) {
                    const resolvedRaw = path.isAbsolute(rawCandidate) ? rawCandidate : path.join(p.PROJECT_ROOT, rawCandidate);
                    if (fs.existsSync(resolvedRaw)) {
                      videoPath = resolvedRaw;
                    }
                  }
                }
              }
            }
          } catch (e) {}
        }
      }

      // 3. Fallback to any valid video file in input/shorts/compressed_videos/ or input/shorts/raw_videos/
      if (!videoPath) {
        const compDir = path.join(p.PROJECT_ROOT, 'input/shorts/compressed_videos');
        if (fs.existsSync(compDir)) {
          const files = fs.readdirSync(compDir).filter((f) => /\.(mp4|mkv|mov|webm)$/i.test(f));
          if (files.length > 0) {
            videoPath = path.join(compDir, files[0]);
          }
        }
      }
      if (!videoPath) {
        const rawDir = path.join(p.PROJECT_ROOT, 'input/shorts/raw_videos');
        if (fs.existsSync(rawDir)) {
          const files = fs.readdirSync(rawDir).filter((f) => /\.(mp4|mkv|mov|webm)$/i.test(f));
          if (files.length > 0) {
            videoPath = path.join(rawDir, files[0]);
          }
        }
      }

      if (!videoPath || !fs.existsSync(videoPath)) {
        return resolve({ success: false, error: `File video sumber asli tidak ditemukan untuk segmen #${segmentId}.` });
      }

      let rawAudioPath = lang === 'id' ? segData.audio_path_id : segData.audio_path_en;
      let resolvedAudioPath = null;
      if (rawAudioPath) {
        const candidate = path.isAbsolute(rawAudioPath) ? rawAudioPath : path.join(p.PROJECT_ROOT, rawAudioPath);
        if (fs.existsSync(candidate)) {
          resolvedAudioPath = candidate;
        } else {
          const filename = path.basename(rawAudioPath);
          const inAudioDir = path.join(p.PROJECT_ROOT, 'input/shorts/audio', filename);
          if (fs.existsSync(inAudioDir)) {
            resolvedAudioPath = inAudioDir;
          }
        }
      }

      if (!resolvedAudioPath) {
        sendProgress(10, '⚠️ Audio voiceover tidak ditemukan, video akan dirender tanpa audio VO.', '[Warning] Audio VO tidak ditemukan');
      } else {
        sendProgress(10, `Audio VO ditemukan: ${path.basename(resolvedAudioPath)}`, `[Audio] VO: ${resolvedAudioPath}`);
      }

      // 4. Construct FFmpeg Args with Fast Seek (-ss & -t per clip) for 10x Speed & 0% CPU Starvation
      const spawnArgs = ['-y'];
      const filterParts = [];
      const concatInputs = [];

      cuts.forEach((cut, i) => {
        const vStart = Number(cut.video_start || 0);
        const vEnd = Number(cut.video_end || (vStart + (cut.duration || 3.0)));
        const dur = Math.max(0.1, parseFloat((vEnd - vStart).toFixed(3)));

        // Fast seeking before input
        spawnArgs.push('-ss', String(vStart), '-t', String(dur), '-i', videoPath);
        filterParts.push(
          `[${i}:v]split=2[bg_src${i}][fg_src${i}]`,
          `[bg_src${i}]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=4:1,scale=1080:1920,eq=brightness=-0.15[bg${i}]`,
          `[fg_src${i}]scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350[fg${i}]`,
          `[bg${i}][fg${i}]overlay=x=0:y=285,setsar=1[v${i}]`
        );
        concatInputs.push(`[v${i}]`);
      });

      const audioInputIndex = cuts.length;
      if (resolvedAudioPath && fs.existsSync(resolvedAudioPath)) {
        spawnArgs.push('-i', resolvedAudioPath);
      }

      const concatFilter = `${concatInputs.join('')}concat=n=${cuts.length}:v=1:a=0[vconcat]`;
      const fullFilterComplex = `${filterParts.join(';')};${concatFilter}`;

      const outputDir = path.join(p.PROJECT_ROOT, 'output/shorts');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const outputFileName = `seg_${segmentId}_${lang}_final.mp4`;
      const outputPath = path.join(outputDir, outputFileName);

      spawnArgs.push(
        '-filter_complex', fullFilterComplex,
        '-map', '[vconcat]'
      );

      if (resolvedAudioPath && fs.existsSync(resolvedAudioPath)) {
        spawnArgs.push('-map', `${audioInputIndex}:a`, '-c:a', 'aac', '-b:a', '192k', '-shortest');
      }

      const cpuThreads = Math.min(3, Math.max(1, Math.floor(os.cpus().length / 3)));
      spawnArgs.push(
        '-threads', String(cpuThreads),
        '-c:v', 'libx264',
        '-preset', 'superfast',
        '-crf', '20',
        outputPath
      );

      sendProgress(15, `Mulai merender ${cuts.length} klip video vertikal 9:16 (Fast Seek & Nice Priority)...`, `[FFmpeg Fast Engine] Spawning ffmpeg for ${outputFileName}`);
      sendProgress(18, `Input Video: ${path.basename(videoPath)}`, `[Input Video] ${videoPath}`);
      if (resolvedAudioPath) {
        sendProgress(20, `Input Audio VO: ${path.basename(resolvedAudioPath)}`, `[Input Audio] ${resolvedAudioPath}`);
      }

      const startTime = Date.now();

      let ffmpegBin = (ffmpeg && ffmpeg.ffmpegPath) ? ffmpeg.ffmpegPath : 'ffmpeg';
      let spawnCmd = ffmpegBin;
      let finalSpawnArgs = spawnArgs;
      if (process.platform === 'linux' || process.platform === 'darwin') {
        spawnCmd = 'nice';
        finalSpawnArgs = ['-n', '15', ffmpegBin, ...spawnArgs];
      }

      const child = spawn(spawnCmd, finalSpawnArgs, { cwd: p.PROJECT_ROOT, env: { ...process.env } });

      let fullStderr = '';

      child.stderr.on('data', (d) => {
        const text = d.toString();
        fullStderr += text;

        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
          if (timeMatch) {
            const currentSec = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseFloat(timeMatch[3]);
            const totalDur = cuts.reduce((acc, c) => acc + (c.duration || 3.0), 0);
            const pct = Math.min(99, Math.max(15, Math.round((currentSec / (totalDur || 30)) * 100)));
            sendProgress(pct, `Merender video FFmpeg (${pct}%)...`, line);
          } else if (line.startsWith('frame=') || line.startsWith('Output')) {
            sendProgress(35, 'Memproses rendering adegan FFmpeg...', line);
          }
        }
      });

      child.on('close', (code) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (code === 0 && fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          sendProgress(100, `Selesai merender segmen Shorts dalam ${elapsed}s!`);
          resolve({
            success: true,
            outputPath,
            outputFilename: outputFileName,
            fileSizeBytes: stats.size,
            elapsedSec: elapsed,
          });
        } else {
          resolve({
            success: false,
            error: fullStderr.split('\n').slice(-10).join('\n') || `Render gagal dengan exit code ${code}`,
          });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: `Kesalahan spawn process FFmpeg: ${err.message}` });
      });
    });
  });
}

module.exports = { register };
