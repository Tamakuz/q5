// dashboard/electron/ipc/renderHandlers.cjs
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function register(ipcMain, { paths: p, media, ffmpeg, getMainWindow }) {
  // ─── Render video via FFmpeg CLI (shortform) ───────────
  ipcMain.handle('render-video', async (_event, mapping, videoPath, audioPath) => {
    if (!mapping || !videoPath) {
      return { error: 'Missing mapping or video path.' };
    }

    let resolvedVideo = path.isAbsolute(videoPath) ? videoPath : path.join(p.INPUT_ASSETS, videoPath);
    if (!fs.existsSync(resolvedVideo)) resolvedVideo = path.resolve(videoPath);
    if (!fs.existsSync(resolvedVideo)) return { error: `Video not found: ${resolvedVideo}` };

    let resolvedAudio = null;
    if (audioPath) {
      resolvedAudio = path.isAbsolute(audioPath) ? audioPath : path.join(p.INPUT_ASSETS, audioPath);
      if (!fs.existsSync(resolvedAudio)) resolvedAudio = path.resolve(audioPath);
      if (!fs.existsSync(resolvedAudio)) {
        console.warn(`⚠️  Audio not found: ${resolvedAudio}, rendering without`);
        resolvedAudio = null;
      }
    }

    if (!resolvedAudio) {
      try {
        const audioFiles = fs.readdirSync(p.INPUT_ASSETS).filter((f) => /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f));
        if (audioFiles.length > 0) resolvedAudio = path.join(p.INPUT_ASSETS, audioFiles[0]);
      } catch { }
    }

    // Convert Alurfilm mapping format if present
    let renderMapping = mapping;
    if (Array.isArray(renderMapping)) {
      renderMapping = renderMapping.find(m => m && m.mappings) || renderMapping[0] || {};
    }
    if (renderMapping && renderMapping.mappings && Array.isArray(renderMapping.mappings)) {
      const timelineClips = [];
      let clipIdCounter = 1;
      for (const item of mapping.mappings) {
        if (item.visuals && Array.isArray(item.visuals)) {
          for (const vis of item.visuals) {
            const ss = vis.source_start_seconds !== undefined ? vis.source_start_seconds : (vis.source_timestamp_seconds !== undefined ? vis.source_timestamp_seconds : 0);
            timelineClips.push({ id: clipIdCounter++, text: item.text || '', ss, t: vis.duration || item.duration || 2.5, type: vis.type, slow_mo_factor: vis.slow_mo_factor, mirror_mode: vis.mirror_mode, zoom_speed: vis.zoom_speed, color_grading_shift: vis.color_grading_shift });
          }
        } else {
          timelineClips.push({ id: clipIdCounter++, text: item.text || '', ss: item.start || 0, t: item.duration || 2.5 });
        }
      }
      renderMapping = { settings: { fps: 30, format: "16:9", captions: false }, timeline: timelineClips };
    }

    const mappingFile = path.join(p.TMP_DIR, `mapping_${Date.now()}.json`);
    fs.writeFileSync(mappingFile, JSON.stringify(renderMapping, null, 2), 'utf-8');

    const outputDir = path.join(p.PROJECT_ROOT, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputFileName = `render_${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, outputFileName);

    const mainWindow = getMainWindow();

    return new Promise((resolve) => {
      const startTime = Date.now();
      const cliPath = path.join(p.PROJECT_ROOT, 'cli.ts');
      let cmd = `npx tsx "${cliPath}" render "${mappingFile}" --video "${resolvedVideo}"`;
      if (resolvedAudio) cmd += ` --audio "${resolvedAudio}"`;
      cmd += ` -o "${outputPath}"`;

      const child = spawn('bash', ['-c', cmd], { cwd: p.PROJECT_ROOT, env: { ...process.env } });

      let fullStdout = '';
      let fullStderr = '';

      child.stdout.on('data', (d) => {
        fullStdout += d.toString();
        const lines = d.toString().trim().split('\n').filter(Boolean);
        for (const line of lines) {
          const pctMatch = line.match(/(\d+)%/);
          if (pctMatch && mainWindow && !mainWindow.isDestroyed()) {
            const pct = parseInt(pctMatch[1], 10) / 100;
            mainWindow.webContents.send('render-progress', { stage: 'render', progress: Math.min(0.99, pct), message: line.trim() });
          } else if (mainWindow && !mainWindow.isDestroyed()) {
            const trimmed = line.trim();
            if (trimmed) mainWindow.webContents.send('render-progress', { stage: 'render', progress: 0.05, message: trimmed });
          }
        }
      });
      child.stderr.on('data', (d) => { fullStderr += d.toString(); });

      child.on('close', (code) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        try { fs.unlinkSync(mappingFile); } catch { }
        if (code === 0) {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('render-progress', { stage: 'done', progress: 1, message: `Done in ${elapsed}s` });
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

  const DEFAULT_RENDER_SETTINGS = {
    narrationVolume: 1.8,
    bgmVolume: 0.18,
    bgmEnabled: true,
    bgmPath: 'assets/bgm/05_santai_misteri/Paper Map Morning.mp3',
    logoEnabled: true,
    logoPath: 'assets/logo.png',
    logoOpacity: 0.6,
    logoMargin: 40,
    logoScale: 60,
    introEnabled: true,
    introTitleText: 'UNDER THE DOME',
    introSubtitleText: 'ALUR CERITA FILM',
    introStylePreset: 'cinematic_gold',
    introDuration: 6.0,
    introImpactTimestamp: 0.48,
    introAudioPath: 'assets/Denied Access - Density & Time.mp3',
  };

  async function renderIntroVideoHelper(introOpts, cwd) {
    return new Promise((resolve) => {
      const optsJson = JSON.stringify(introOpts || {});
      const runnerScript = `
import { renderIntroVideo } from './lib/alurfilm/intro-engine.ts';
(async () => {
  try {
    const opts = ${optsJson};
    const res = await renderIntroVideo(opts);
    console.log('RESULT:' + JSON.stringify(res));
  } catch (e) {
    console.log('RESULT:' + JSON.stringify({ success: false, error: e.message }));
  }
})();
      `;

      const child = spawn('npx', ['tsx', '-e', runnerScript], { cwd, env: { ...process.env } });
      let lastResult = { success: false, error: 'Unknown render failure' };

      child.stdout.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('RESULT:')) {
            try { lastResult = JSON.parse(line.replace('RESULT:', '')); } catch {}
          }
        }
      });

      child.on('close', (code) => {
        if (code === 0 && lastResult.success) {
          resolve(lastResult);
        } else {
          resolve({ success: false, error: lastResult.error || `Intro render exited with code ${code}` });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  const getSettingsFilePath = () => path.join(p.PROJECT_ROOT, 'input', 'render_settings.json');

  const loadSavedSettings = () => {
    const filePath = getSettingsFilePath();
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return { ...DEFAULT_RENDER_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('⚠️ Error reading render_settings.json:', e.message);
    }
    return { ...DEFAULT_RENDER_SETTINGS };
  };

  ipcMain.handle('get-render-settings', async () => {
    const settings = loadSavedSettings();
    const filePath = getSettingsFilePath();
    if (!fs.existsSync(filePath)) {
      try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
      } catch (e) {}
    }
    return settings;
  });

  ipcMain.handle('save-render-settings', async (_event, newSettings) => {
    const filePath = getSettingsFilePath();
    try {
      const merged = { ...loadSavedSettings(), ...newSettings };
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
      console.log('⚙️ [Render Settings] Saved to input/render_settings.json');
      return { success: true, settings: merged };
    } catch (e) {
      console.error('❌ [Render Settings] Save failed:', e);
      return { success: false, error: e.message };
    }
  });

  // ─── Concat Alurfilm Final Video ───────────────────────
  ipcMain.handle('concat-alurfilm-final-video', async (_event, opts = {}) => {
    const {
      parts, bgmPath, bgmVolume, narrationVolume, logoPath, logoOpacity, logoMargin, logoScale, bgmEnabled, logoEnabled,
      introEnabled, introTitleText, introSubtitleText, introStylePreset, introDuration, introImpactTimestamp, introAudioPath
    } = opts;
    const saved = loadSavedSettings();

    const isBgmActive = bgmEnabled !== undefined ? bgmEnabled : saved.bgmEnabled;
    const isLogoActive = logoEnabled !== undefined ? logoEnabled : saved.logoEnabled;
    const isIntroActive = introEnabled !== undefined ? introEnabled : (saved.introEnabled !== undefined ? saved.introEnabled : true);

    const contentId = p.getOrGenerateContentId('longform');
    const outputDir = path.join(p.PROJECT_ROOT, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const files = fs.readdirSync(outputDir);
    const partFiles = [];

    for (const pt of parts || []) {
      const partStr = String(pt).padStart(2, '0');
      const matches = files.filter((f) => f.startsWith(`alurfilm_${contentId}_part_${partStr}_`) && f.endsWith('.mp4'));
      if (matches.length > 0) {
        matches.sort((a, b) => {
          const statA = fs.statSync(path.join(outputDir, a)).mtimeMs;
          const statB = fs.statSync(path.join(outputDir, b)).mtimeMs;
          return statB - statA;
        });
        partFiles.push(path.join(outputDir, matches[0]));
      }
    }

    if (partFiles.length === 0) return { error: 'Belum ada video part yang dirender.' };

    let introFilePath = null;
    if (isIntroActive) {
      const introTitle = introTitleText || saved.introTitleText || 'UNDER THE DOME';
      const introSubtitle = introSubtitleText || saved.introSubtitleText || 'ALUR CERITA FILM';
      const introPreset = introStylePreset || saved.introStylePreset || 'cinematic_gold';
      const introDur = introDuration || saved.introDuration || 6.0;
      const introImpact = introImpactTimestamp || saved.introImpactTimestamp || 0.48;
      const introAudio = introAudioPath || saved.introAudioPath || 'assets/Denied Access - Density & Time.mp3';
      const introOut = path.join(outputDir, `alurfilm_${contentId}_intro_${Date.now()}.mp4`);

      console.log(`🎬 [Intro Generator] Generating intro title video: "${introTitle}"...`);
      const introRes = await renderIntroVideoHelper({
        titleText: introTitle,
        subtitleText: introSubtitle,
        stylePreset: introPreset,
        duration: introDur,
        impactTimestamp: introImpact,
        audioPath: introAudio,
        outputPath: introOut,
      }, p.PROJECT_ROOT);

      if (introRes.success && introRes.outputPath && fs.existsSync(introRes.outputPath)) {
        introFilePath = introRes.outputPath;
        console.log(`✅ [Intro Generator] Intro video generated successfully: ${path.basename(introFilePath)}`);
      } else {
        console.warn(`⚠️ [Intro Generator] Failed to generate intro video: ${introRes.error}`);
      }
    }

    const allConcatFiles = [];
    if (introFilePath) {
      allConcatFiles.push(introFilePath);
    }
    allConcatFiles.push(...partFiles);

    const finalOutputName = contentId.startsWith('WV-FILM-') ? `${contentId}-FULL-FINAL.mp4` : `WV-FILM-${contentId}-FULL-FINAL.mp4`;
    const finalOutputPath = path.join(outputDir, finalOutputName);

    const listFile = path.join(p.TMP_DIR, `concat_list_${Date.now()}.txt`);
    fs.writeFileSync(listFile, allConcatFiles.map((f) => `file '${f}'`).join('\n'), 'utf-8');

    let resolvedLogo = null;
    if (isLogoActive) {
      const targetLogo = logoPath || saved.logoPath;
      if (targetLogo && fs.existsSync(targetLogo)) {
        resolvedLogo = targetLogo;
      } else {
        const defaultLogo = path.join(p.PROJECT_ROOT, 'assets', 'logo.png');
        const transparentLogo = path.join(p.PROJECT_ROOT, 'assets', 'logo-transparent.png');
        if (fs.existsSync(defaultLogo)) resolvedLogo = defaultLogo;
        else if (fs.existsSync(transparentLogo)) resolvedLogo = transparentLogo;
      }
    }

    let resolvedBgm = null;
    if (isBgmActive) {
      const targetBgm = bgmPath || saved.bgmPath;
      if (targetBgm && fs.existsSync(targetBgm)) {
        resolvedBgm = targetBgm;
      } else {
        const thomasNewmanPath = path.join(p.PROJECT_ROOT, 'assets', 'bgm', '05_santai_misteri', 'Piano music in style of Thomas Newman - sad mood - Royalty free music no copyright music.mp3');
        if (fs.existsSync(thomasNewmanPath)) {
          resolvedBgm = thomasNewmanPath;
        } else {
          const assetsDir = path.join(p.PROJECT_ROOT, 'assets');
          if (fs.existsSync(assetsDir)) {
            const mp3s = fs.readdirSync(assetsDir).filter(f => f.toLowerCase().endsWith('.mp3'));
            const thomasNewman = mp3s.find(f => f.toLowerCase().includes('thomas newman'));
            if (thomasNewman) resolvedBgm = path.join(assetsDir, thomasNewman);
            else if (mp3s.length > 0) resolvedBgm = path.join(assetsDir, mp3s[0]);
          }
        }
      }
    }

    const vol = bgmVolume ?? saved.bgmVolume ?? 0.18;
    const opacity = logoOpacity ?? saved.logoOpacity ?? 0.6;
    const margin = logoMargin ?? saved.logoMargin ?? 40;
    const scaleHeight = logoScale ?? saved.logoScale ?? 60;

    const args = ['-y'];
    for (const f of allConcatFiles) {
      args.push('-i', f);
    }

    let logoIndex = null;
    if (resolvedLogo && fs.existsSync(resolvedLogo)) {
      console.log(`🎨 [Final Render] Injecting Logo Watermark: ${path.basename(resolvedLogo)} (Opacity: ${opacity}, Scale: ${scaleHeight}px, Margin: ${margin}px)`);
      args.push('-i', resolvedLogo);
      logoIndex = allConcatFiles.length;
    }

    const filterParts = [];
    for (let i = 0; i < allConcatFiles.length; i++) {
      filterParts.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=30[v${i}]`);
      filterParts.push(`[${i}:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}]`);
    }

    const concatPairs = allConcatFiles.map((_, i) => `[v${i}][a${i}]`).join('');
    filterParts.push(`${concatPairs}concat=n=${allConcatFiles.length}:v=1:a=1[vconcat][aout]`);

    let vMap = '[vconcat]';
    let aMap = '[aout]';

    if (logoIndex !== null) {
      filterParts.push(`[${logoIndex}:v]scale=-1:${scaleHeight},format=rgba,colorchannelmixer=aa=${opacity}[logo_alpha]`);
      filterParts.push(`[vconcat][logo_alpha]overlay=${margin}:${margin}[vout]`);
      vMap = '[vout]';
    }

    args.push('-filter_complex', filterParts.join(';'));
    args.push('-map', vMap, '-map', aMap);
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-r', '30', '-pix_fmt', 'yuv420p');
    args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
    args.push('-movflags', '+faststart', finalOutputPath);

    let estimatedTotalSec = 0;
    for (const pf of partFiles) {
      try {
        const meta = await ffmpeg.getVideoMetaHelper(pf);
        if (meta && meta.duration) estimatedTotalSec += meta.duration;
      } catch {}
    }
    if (!estimatedTotalSec) estimatedTotalSec = 600;

    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('render-progress', {
        stage: 'concat',
        progress: 0,
        message: `[FFmpeg] Starting full movie concat for ${partFiles.length} parts...`
      });
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn(ffmpeg.ffmpegPath, args, { cwd: p.PROJECT_ROOT });
      let stderr = '';
      let currentProgress = 5;

      child.stderr.on('data', (d) => {
        const text = d.toString();
        stderr += text;

        const timeMatch = text.match(/time=(\d{2}:\d{2}:\d{2}\.\d+)/);
        if (timeMatch && estimatedTotalSec > 0) {
          const timeParts = timeMatch[1].split(':');
          const currentSec = parseFloat(timeParts[0]) * 3600 + parseFloat(timeParts[1]) * 60 + parseFloat(timeParts[2]);
          const pct = Math.min(0.99, Math.max(0.05, currentSec / estimatedTotalSec));
          currentProgress = Math.round(pct * 100);
        }

        const lines = text.split(/[\r\n]+/);
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          if (line.includes('frame=') || line.includes('size=') || line.includes('time=') || line.includes('FFmpeg') || line.includes('Injecting')) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('render-progress', {
                stage: 'concat',
                progress: currentProgress,
                message: line
              });
            }
          }
        }
      });

      child.on('close', (code) => {
        try { fs.unlinkSync(listFile); } catch { }
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        if (code === 0) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('render-progress', {
              stage: 'done',
              progress: 100,
              message: `🎉 [Alurfilm Engine] Full Movie Recap Render Complete in ${elapsed}s!`
            });
          }
          resolve({ filePath: finalOutputPath, fileName: finalOutputName, mediaUrl: media.mediaUrl(finalOutputPath) });
        } else {
          const lastErr = stderr.split('\n').filter(Boolean).slice(-10).join(' | ');
          const errMsg = `FFmpeg final render exit ${code}: ${lastErr}`;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('render-progress', {
              stage: 'error',
              progress: 0,
              message: `❌ ${errMsg}`
            });
          }
          resolve({ error: errMsg });
        }
      });

      child.on('error', (e) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('render-progress', {
            stage: 'error',
            progress: 0,
            message: `❌ ${e.message}`
          });
        }
        resolve({ error: e.message });
      });
    });
  });

  // ─── Render Alurfilm Video (per-part) ──────────────────
  ipcMain.handle('render-alurfilm-video', async (_event, args = {}) => {
    const part = typeof args.part !== 'undefined' && args.part !== null ? Number(args.part) : (typeof args.chunkPart !== 'undefined' && args.chunkPart !== null ? Number(args.chunkPart) : 1);
    const mapping = args.mapping || args.mappingData;
    const videoPath = args.videoPath;
    const audioPath = args.audioPath;
    const saved = loadSavedSettings();

    const { bgmPath, bgmVolume, narrationVolume, logoPath, logoOpacity, logoMargin, logoScale, bgmEnabled, logoEnabled } = args;

    if (!mapping || !videoPath) return { error: 'Missing Alurfilm mapping or video path.' };

    const contentId = p.getOrGenerateContentId('longform');
    const partStr = String(part).padStart(2, '0');

    let resolvedVideo = path.isAbsolute(videoPath) ? videoPath : path.join(p.ALURFILM_CHUNKS_DIR, videoPath);
    if (!fs.existsSync(resolvedVideo)) resolvedVideo = path.resolve(videoPath);
    if (!fs.existsSync(resolvedVideo)) return { error: `Alurfilm video chunk not found: ${resolvedVideo}` };

    let resolvedAudio = null;
    if (audioPath) {
      resolvedAudio = path.isAbsolute(audioPath) ? audioPath : path.join(p.ALURFILM_DIR, audioPath);
      if (!fs.existsSync(resolvedAudio)) resolvedAudio = path.resolve(audioPath);
    }

    const mappingFile = path.join(p.TMP_DIR, `alurfilm_mapping_part_${partStr}_${Date.now()}.json`);
    fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2), 'utf-8');

    const outputDir = path.join(p.PROJECT_ROOT, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputFileName = `alurfilm_${contentId}_part_${partStr}_${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, outputFileName);

    const mainWindow = getMainWindow();

    const rawBgmPath = bgmPath || saved.bgmPath;
    let finalBgmPath = null;
    if (rawBgmPath) {
      const absBgm = path.isAbsolute(rawBgmPath) ? rawBgmPath : path.resolve(p.PROJECT_ROOT, rawBgmPath);
      if (fs.existsSync(absBgm)) finalBgmPath = absBgm;
    }
    const finalBgmVol = bgmVolume ?? saved.bgmVolume;
    const finalNarrationVol = narrationVolume ?? saved.narrationVolume;

    const rawLogoPath = logoPath || saved.logoPath;
    let finalLogoPath = null;
    if (rawLogoPath) {
      const absLogo = path.isAbsolute(rawLogoPath) ? rawLogoPath : path.resolve(p.PROJECT_ROOT, rawLogoPath);
      if (fs.existsSync(absLogo)) finalLogoPath = absLogo;
    }
    const finalLogoOpacity = logoOpacity ?? saved.logoOpacity;
    const finalLogoMargin = logoMargin ?? saved.logoMargin;
    const finalLogoScale = logoScale ?? saved.logoScale;

    const isBgmActive = bgmEnabled !== undefined ? bgmEnabled : (saved.bgmEnabled !== undefined ? saved.bgmEnabled : true);
    const isLogoActive = logoEnabled !== undefined ? logoEnabled : (saved.logoEnabled !== undefined ? saved.logoEnabled : true);

    return new Promise((resolve) => {
      const startTime = Date.now();
      const cliPath = path.join(p.PROJECT_ROOT, 'render-alurfilm.ts');
      let cmd = `npx tsx "${cliPath}" render "${mappingFile}" --video "${resolvedVideo}"`;
      if (resolvedAudio && fs.existsSync(resolvedAudio)) cmd += ` --audio "${resolvedAudio}"`;

      if (isBgmActive === false) {
        cmd += ` --no-bgm`;
      } else {
        if (finalBgmPath) cmd += ` --bgm "${finalBgmPath}"`;
        if (finalBgmVol !== undefined) cmd += ` --bgm-volume ${finalBgmVol}`;
      }

      if (finalNarrationVol !== undefined) cmd += ` --narration-volume ${finalNarrationVol}`;

      if (isLogoActive && finalLogoPath) {
        cmd += ` --logo "${finalLogoPath}"`;
        if (finalLogoOpacity !== undefined) cmd += ` --logo-opacity ${finalLogoOpacity}`;
        if (finalLogoMargin !== undefined) cmd += ` --logo-margin ${finalLogoMargin}`;
        if (finalLogoScale !== undefined) cmd += ` --logo-scale ${finalLogoScale}`;
      }

      cmd += ` -o "${outputPath}"`;

      const child = spawn('bash', ['-c', cmd], { cwd: p.PROJECT_ROOT, env: { ...process.env } });

      let fullStdout = '';
      let fullStderr = '';
      let currentProgress = 5;

      child.stdout.on('data', (d) => {
        const text = d.toString();
        fullStdout += text;
        const lines = text.split(/[\r\n]+/);
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          const pctMatch = line.match(/(\d+)%/);
          if (pctMatch) currentProgress = Math.min(99, parseInt(pctMatch[1], 10));
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('render-progress', { stage: 'render', progress: currentProgress, message: line });
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
            mainWindow.webContents.send('render-progress', { stage: 'render', progress: currentProgress, message: `[STDERR] ${line}` });
          }
        }
      });

      child.on('close', (code) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        try { fs.unlinkSync(mappingFile); } catch { }
        if (code === 0) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('render-progress', { stage: 'done', progress: 100, message: `🎉 [Alurfilm Engine] Render Part #${part} Done in ${elapsed}s` });
          }
          resolve({ part, outputPath, elapsed, name: outputFileName, mediaUrl: media.mediaUrl(outputPath) });
        } else {
          const errLines = (fullStderr || fullStdout).split('\n').filter(Boolean).slice(-20).join('\n');
          const errMsg = `❌ [Alurfilm CLI Exit Code ${code}]\n${errLines}`;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('render-progress', { stage: 'error', progress: 0, message: errMsg });
          }
          resolve({ error: errMsg });
        }
      });
      child.on('error', (err) => {
        try { fs.unlinkSync(mappingFile); } catch { }
        const errMsg = `❌ Failed to launch Alurfilm render CLI: ${err.message}`;
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('render-progress', { stage: 'error', progress: 0, message: errMsg });
        resolve({ error: errMsg });
      });
    });
  });
}

module.exports = { register };
