// dashboard/electron/ipc/spensiaHandlers.cjs
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');
const { hexToAssColor, assTime, cleanPunct } = require('../shared/subtitle-utils.cjs');

function buildAssSubtitleFile(captions, capCfg, width, height) {
  const fn = capCfg.fontName || 'Montserrat';
  const fs2 = capCfg.fontSize || 48;
  const activeColor = hexToAssColor(capCfg.activeColorHex || '#22C55E'); // green-500
  const inactiveColor = hexToAssColor(capCfg.inactiveColorHex || '#CBD5E1'); // Slate-300 (#CBD5E1)
  const outlineColor = hexToAssColor(capCfg.outlineColorHex || '#000000');
  const ow = capCfg.outlineWidth || 3;
  const sd = capCfg.shadowDistance || 2;
  const posY = capCfg.positionY || 160;
  const posX = capCfg.positionX || 40;
  const align = capCfg.alignment || 2;
  const displayMode = capCfg.displayMode || 'sentence';

  const lines = [];
  lines.push(
    '[Script Info]',
    'Title: Spensia CapCut Word-Level Sync Subtitles',
    'ScriptType: v4.00+',
    'WrapStyle: 2',
    `PlayResX: ${width || 1920}`,
    `PlayResY: ${height || 1080}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${fn},${fs2},${inactiveColor},${activeColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,${ow},${sd},${align},${posX},${posX},${posY},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  );

  if (!captions || captions.length === 0) return lines.join('\n');

  const clean = captions.map((c) => ({ ...c, word: cleanPunct(c.word) })).filter((c) => c.word);
  const sorted = [...clean].sort((a, b) => a.start_sec - b.start_sec);

  if (displayMode === 'single-word') {
    sorted.forEach((w, idx) => {
      const nextW = sorted[idx + 1];
      let startSec = Math.max(0, w.start_sec);
      let endSec = w.end_sec;
      if (nextW) {
        const ns = Math.max(0, nextW.start_sec);
        if (ns > startSec) endSec = Math.min(endSec, ns);
      }
      if (endSec <= startSec) endSec = startSec + 0.25;
      lines.push(`Dialogue: 0,${assTime(startSec)},${assTime(endSec)},Default,,0,0,0,,{\\1c${activeColor}\\3c${outlineColor}\\fscx115\\fscy115\\b1}${w.word}`);
    });
  } else if (displayMode === 'sentence') {
    const MAX_SENTENCE_WORDS = 10;
    const sentenceGroups = [];
    let currentGroup = [];

    sorted.forEach((w, idx) => {
      currentGroup.push(w);
      const prevW = currentGroup[currentGroup.length - 2];
      const gap = prevW ? w.start_sec - prevW.end_sec : 0;
      if (currentGroup.length >= MAX_SENTENCE_WORDS || gap > 1.2 || idx === sorted.length - 1) {
        sentenceGroups.push(currentGroup);
        currentGroup = [];
      }
    });

    sentenceGroups.forEach((group, gIdx) => {
      if (group.length === 0) return;
      const startSec = Math.max(0, group[0].start_sec);
      const lastWord = group[group.length - 1];
      const nextGroup = sentenceGroups[gIdx + 1];

      let endSec = Math.max(startSec + 0.3, lastWord.end_sec);
      if (nextGroup && nextGroup.length > 0) {
        const nextStart = Math.max(0, nextGroup[0].start_sec);
        if (nextStart > startSec) {
          endSec = Math.min(endSec, nextStart);
        }
      }
      if (endSec <= startSec) endSec = startSec + 0.3;

      const fullText = group.map((w) => w.word).join(' ');
      lines.push(`Dialogue: 0,${assTime(startSec)},${assTime(endSec)},Default,,0,0,0,,{\\1c${inactiveColor}\\3c${outlineColor}\\b1}${fullText}`);
    });
  } else {
    const MAX = 3;
    const groups = [];
    for (let i = 0; i < sorted.length; i += MAX) groups.push(sorted.slice(i, i + MAX));
    groups.forEach((group, gIdx) => {
      if (group.length === 0) return;
      const startSec = Math.max(0, group[0].start_sec);
      const lastWord = group[group.length - 1];
      const nextGroup = groups[gIdx + 1];

      let endSec = Math.max(startSec + 0.3, lastWord.end_sec);
      if (nextGroup && nextGroup.length > 0) {
        const nextStart = Math.max(0, nextGroup[0].start_sec);
        if (nextStart > startSec) {
          endSec = Math.min(endSec, nextStart);
        }
      }
      if (endSec <= startSec) endSec = startSec + 0.3;

      const phrase = group.map((w) => w.word).join(' ');
      lines.push(`Dialogue: 0,${assTime(startSec)},${assTime(endSec)},Default,,0,0,0,,{\\1c${inactiveColor}\\3c${outlineColor}\\b1}${phrase}`);
    });
  }

  return lines.join('\n');
}

// ─── Google Flow image generation ───────────────────────

function spawnTsxProcessForRoot(projectRoot, cliArgs, options = {}) {
  const tsxBin = path.join(projectRoot, 'node_modules', '.bin', 'tsx');
  if (fs.existsSync(tsxBin)) return spawn(tsxBin, cliArgs, options);
  return spawn('npx', ['--no-install', 'tsx', ...cliArgs], options);
}

function register(ipcMain, { paths: p, media, ffmpeg, aiClient, loadPrompt, getMainWindow }) {
  // Ensure spensia dirs
  if (!fs.existsSync(p.SPENSIA_IMAGES_DIR)) fs.mkdirSync(p.SPENSIA_IMAGES_DIR, { recursive: true });
  if (!fs.existsSync(p.SPENSIA_THUMBNAILS_DIR)) fs.mkdirSync(p.SPENSIA_THUMBNAILS_DIR, { recursive: true });
  if (!fs.existsSync(p.SPENSIA_AUDIO_DIR)) fs.mkdirSync(p.SPENSIA_AUDIO_DIR, { recursive: true });

  // ─── Spensia AI generation handlers ───────────────────
  ipcMain.handle('generate-spensia-topics', async (event, { promptText, model }) => {
    return aiClient.generateSpensiaTopics({ promptText, model, onChunk: (chunk, fullText) => {
      try { event.sender.send('spensia-topics-chunk', { chunk, fullText }); } catch { }
    }});
  });

  ipcMain.handle('generate-spensia-script', async (event, { promptText, model }) => {
    return aiClient.generateSpensiaScript({ promptText, model, onChunk: (chunk, fullText) => {
      try { event.sender.send('spensia-script-chunk', { chunk, fullText }); } catch { }
    }});
  });

  ipcMain.handle('generate-spensia-breakdown', async (event, { promptText, model }) => {
    return aiClient.generateSpensiaBreakdown({ promptText, model, onChunk: (chunk, fullText) => {
      try { event.sender.send('spensia-breakdown-chunk', { chunk, fullText }); } catch { }
    }});
  });

  ipcMain.handle('generate-spensia-image-prompts', async (event, { promptText, model }) => {
    return aiClient.generateSpensiaImagePrompts({ promptText, model, onChunk: (chunk, fullText) => {
      try { event.sender.send('spensia-image-prompts-chunk', { chunk, fullText }); } catch { }
    }});
  });

  // ─── Persist & save image ─────────────────────────────

  async function persistSpensiaImageToDisk(segmentId, savedObj, topicId) {
    try {
      const topId = topicId || 1;
      const jsonPaths = [path.join(p.PROJECT_ROOT, 'input', 'spensia', 'images', `generated_images_topic_${topId}.json`)];
      if (topId === 1) jsonPaths.push(path.join(p.PROJECT_ROOT, 'input', 'spensia', 'generated_images.json'));

      for (const jsonPath of jsonPaths) {
        let existingData = { total_images: 0, images: [] };
        if (fs.existsSync(jsonPath)) { try { existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch {} }
        if (!Array.isArray(existingData.images)) existingData.images = [];

        const idx = existingData.images.findIndex((img) => Number(img.segment_id) === Number(segmentId));
        if (idx >= 0) {
          existingData.images[idx] = { ...existingData.images[idx], status: 'success', url: savedObj.url, filePath: savedObj.filePath, error: undefined };
        } else {
          existingData.images.push({ segment_id: Number(segmentId), status: 'success', url: savedObj.url, filePath: savedObj.filePath });
        }
        existingData.total_images = existingData.images.length;
        await fs.promises.mkdir(path.dirname(jsonPath), { recursive: true });
        await fs.promises.writeFile(jsonPath, JSON.stringify(existingData, null, 2), 'utf8');
      }
    } catch (err) {
      console.warn(`[main.cjs] Warning persisting image JSON for segment #${segmentId}:`, err.message);
    }
  }

  async function saveSpensiaImageFile(segmentId, res, topicId) {
    const targetDir = topicId ? path.join(p.PROJECT_ROOT, 'input', 'spensia', 'images', `topic_${topicId}`) : p.SPENSIA_IMAGES_DIR;
    await fs.promises.mkdir(targetDir, { recursive: true });
    const destPath = path.join(targetDir, `segment_${segmentId}.png`);
    let resultObj;

    if (res.b64_json) {
      const buffer = Buffer.from(res.b64_json, 'base64');
      await fs.promises.writeFile(destPath, buffer);
      resultObj = { segmentId, topicId: topicId || null, filePath: destPath, url: media.mediaUrl(destPath), originalUrl: null };
    } else if (res.url) {
      let imgRes, lastErr;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try { imgRes = await fetch(res.url); if (imgRes.ok) break; lastErr = new Error(`HTTP ${imgRes.status}`); } catch (e) { lastErr = e; }
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
      if (imgRes && imgRes.ok) {
        const arrayBuffer = await imgRes.arrayBuffer();
        await fs.promises.writeFile(destPath, Buffer.from(arrayBuffer));
        resultObj = { segmentId, topicId: topicId || null, filePath: destPath, url: media.mediaUrl(destPath), originalUrl: res.url || null };
      } else {
        resultObj = { segmentId, topicId: topicId || null, filePath: destPath, url: res.url, originalUrl: res.url };
      }
    } else {
      resultObj = { segmentId, topicId: topicId || null, filePath: destPath, url: media.mediaUrl(destPath), originalUrl: null };
    }

    await persistSpensiaImageToDisk(segmentId, resultObj, topicId);
    return resultObj;
  }

  // ─── Generate single image via Google Flow ─────────────

  async function generateGoogleFlowImageDirect({ prompt, projectId, segmentId, workerId, onLog }) {
    const targetProject = projectId || process.env.GOOGLE_FLOW_PROJECT_ID || '10ab715a-31e2-48d3-8e56-840e8af6c062';
    const cliPath = path.join(p.PROJECT_ROOT, 'playwright', 'cli.ts');
    const projectRoot = p.PROJECT_ROOT;

    if (onLog && segmentId) { onLog({ segmentId, workerId, text: '🚀 Opening Chromium Browser...' }); }

    const res = await new Promise((resolve, reject) => {
      const child = spawnTsxProcessForRoot(p.PROJECT_ROOT, [cliPath, 'generate-images', '-p', targetProject, '-t', prompt, '--headed', '--close', '--json'], { cwd: projectRoot, env: { ...process.env } });

      let stdout = '';
      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', () => {});

      child.on('close', (code) => {
        if (code !== 0 && !stdout.trim()) return reject(new Error(`Google Flow process failed (exit code ${code})`));
        try {
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (!jsonMatch) return reject(new Error(`Failed to parse JSON output from Google Flow CLI`));
          const parsed = JSON.parse(jsonMatch[0]);
          if (!parsed.success || !parsed.images || parsed.images.length === 0) return reject(new Error(parsed.error || 'Google Flow returned no generated images.'));
          const imageUrl = parsed.images[0].url;
          if (!imageUrl) return reject(new Error('Google Flow image URL is missing'));
          resolve({ url: imageUrl });
        } catch (err) { reject(new Error(`Failed parsing Google Flow response: ${err.message}`)); }
      });
    });
    return res;
  }

  ipcMain.handle('generate-spensia-single-image', async (event, { segmentId, prompt, model, size, quality, image_detail, topicId }) => {
    const res = await generateGoogleFlowImageDirect({ prompt, segmentId, workerId: 1, onLog: (logData) => { try { event.sender.send('spensia-image-log', logData); } catch {} } });
    return saveSpensiaImageFile(segmentId, res, topicId);
  });

  // ─── Batch image generation ────────────────────────────

  ipcMain.handle('generate-spensia-batch-images', async (event, { items, model, size, quality, image_detail, topicId, concurrency }) => {
    const results = [];
    const total = items.length;
    let completedCount = 0;

    const targetProject = process.env.GOOGLE_FLOW_PROJECT_ID || '10ab715a-31e2-48d3-8e56-840e8af6c062';
    const cliPath = path.join(p.PROJECT_ROOT, 'playwright', 'cli.ts');
    const projectRoot = p.PROJECT_ROOT;

    try {
      const conc = concurrency || 5;
      const initialBatch = items.slice(0, conc).map((i) => i.segment_id);
      event.sender.send('spensia-image-chunk-start', { segmentIds: initialBatch, topicId: topicId || null });
    } catch {}

    await new Promise((resolve) => {
      const itemsJsonStr = JSON.stringify(items.map((i) => ({ segment_id: i.segment_id, prompt: i.prompt })));
      const concNum = concurrency || 5;
      const child = spawnTsxProcessForRoot(p.PROJECT_ROOT, [cliPath, 'batch-runner', '-p', targetProject, '-j', itemsJsonStr, '-c', String(concNum), '--profiles', 'user_1,user_2', '--models', 'Nano Banana Pro,Banana 2', '--headed'], { cwd: projectRoot, env: { ...process.env } });

      let buffer = '';
      child.stdout.on('data', (data) => {
        const str = data.toString();
        buffer += str;
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.includes('[ITEM_START]')) {
            const segId = Number(line.split('[ITEM_START]')[1].trim());
            try { event.sender.send('spensia-image-chunk-start', { segmentIds: [segId], topicId: topicId || null }); } catch {}
          } else if (line.includes('[ITEM_LOG]')) {
            const parts = line.split('[ITEM_LOG]')[1].split('|');
            const segId = Number(parts[0].trim());
            const text = parts.slice(1).join('|').trim();
            try { event.sender.send('spensia-image-log', { segmentId: segId, workerId: 1, text }); } catch {}
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
                event.sender.send('spensia-image-progress', { current: completedCount, total, segmentId: segId, topicId: topicId || null, saved, status: 'success' });
              });
            } catch (e) { console.warn('[main.cjs] Error parsing ITEM_SUCCESS JSON:', e); }
          } else if (line.includes('[ITEM_ERROR]')) {
            const parts = line.split('[ITEM_ERROR]')[1].split('|');
            const segId = Number(parts[0].trim());
            const errorMsg = parts.slice(1).join('|').trim();
            completedCount++;
            const resultObj = { segmentId: segId, topicId: topicId || null, error: errorMsg, status: 'error' };
            results.push(resultObj);
            try { event.sender.send('spensia-image-progress', { current: completedCount, total, segmentId: segId, topicId: topicId || null, error: errorMsg, status: 'error' }); } catch {}
          }
        }
      });

      child.stderr.on('data', (data) => { console.warn('[batch-runner stderr]', data.toString()); });
      child.on('close', () => resolve());
    });

    return results;
  });

  // ══════════════════════════════════════════════════════
  // Spensia Thumbnail Studio
  // ══════════════════════════════════════════════════════

  ipcMain.handle('generate-spensia-thumbnail-prompts', async (event, { scriptContent, topicTitle, selectedTitle, metadata, model, topicId }) => {
    const topId = topicId || 1;
    let contextText = scriptContent || '';
    if (!contextText) {
      const scriptPath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'scripts', `full_script_topic_${topId}.txt`);
      if (fs.existsSync(scriptPath)) contextText = fs.readFileSync(scriptPath, 'utf-8');
      else {
        const fallbackPath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'full_script.txt');
        if (fs.existsSync(fallbackPath)) contextText = fs.readFileSync(fallbackPath, 'utf-8');
      }
    }

    let activeMetadata = metadata;
    if (!activeMetadata) {
      const metaPath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'metadata', `upload_metadata_topic_${topId}.json`);
      if (fs.existsSync(metaPath)) { try { activeMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch {} }
    }

    const systemPrompt = loadPrompt('thumbnail-prompts-generator-prompt.md');
    const decidedTitle = selectedTitle || activeMetadata?.analysis?.superior_title || activeMetadata?.recommended_title || topicTitle || 'Fakta Spensia';

    const prompt = `JUDUL UTAMA VIDEO TERPILIH & SUDAH DIANALISA (TARGET UTAMA VISUAL & TEKS):\n"${decidedTitle}"\n\nMETADATA LENGKAP HASIL KEPUTUSAN ANALISIS AI:\n- Superior Title: ${activeMetadata?.analysis?.superior_title || decidedTitle}\n- Alasan Keunggulan: ${activeMetadata?.analysis?.superior_reason || 'Kuriositas tinggi penonton Indonesia.'}\n- Analisis Psikologis: ${activeMetadata?.analysis?.psychological_analysis || 'Memicu curiosity gap kognitif.'}\n- Dampak Doom Scrolling: ${activeMetadata?.analysis?.doom_scroll_impact || 'Thumb-stopping effect <0.5 detik.'}\n- Hook Deskripsi: ${activeMetadata?.description ? activeMetadata.description.slice(0, 200) + '...' : ''}\n- Top Tags: ${activeMetadata?.tags ? activeMetadata.tags.slice(0, 10).join(', ') : ''}\n\nNaskah / Detail Konten Video:\n${contextText || 'Fakta unik dan kontraintuitif tentang kehidupan purba vs modern.'}\n\nINSTRUKSI UTAMA:\nHasilkan 3 konsep thumbnail visual (beserta prompt bahasa Inggris untuk image generator) yang 100% selaras dengan JUDUL TERPILIH DI ATAS ("${decidedTitle}"). Terapkan 4 Core Triggers (Kontras, Emosi Ekstrem, Hal Aneh, Pemicu Curiosity) dan 4 Pola Visual dari Blueprint Mentor!`;

    const rawJson = await aiClient.streamChatCompletion({ systemPrompt, prompt, model: model || 'ag/gemini-3-flash-agent', jsonMode: true, temperature: 0.8, onChunk: (chunk, fullText) => { try { event.sender.send('spensia-thumbnail-prompts-chunk', { chunk, fullText }); } catch {} } });

    const cleanJsonStr = aiClient.extractCleanJsonObject(rawJson);
    const parsed = JSON.parse(cleanJsonStr);
    const savePath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_prompts_topic_${topId}.json`);
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(savePath, JSON.stringify(parsed, null, 2), 'utf-8');

    return parsed;
  });

  ipcMain.handle('generate-spensia-thumbnail-images', async (event, { concepts, model, size, topicId }) => {
    if (!Array.isArray(concepts) || concepts.length === 0) throw new Error('Concepts list is empty.');

    const topId = topicId || 1;
    const targetThumbDir = path.join(p.SPENSIA_THUMBNAILS_DIR, `topic_${topId}`);
    if (fs.existsSync(targetThumbDir)) {
      try { const files = fs.readdirSync(targetThumbDir); for (const file of files) fs.unlinkSync(path.join(targetThumbDir, file)); } catch {}
    } else { fs.mkdirSync(targetThumbDir, { recursive: true }); }

    const prevFiles = [
      path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnails_rendered_topic_${topId}.json`),
      path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_selected_topic_${topId}.json`),
      path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_topic_${topId}.png`),
    ];
    for (const fp of prevFiles) { if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch {} } }

    const results = [];
    const total = concepts.length;
    let completedCount = 0;

    const targetProject = process.env.GOOGLE_FLOW_PROJECT_ID || '10ab715a-31e2-48d3-8e56-840e8af6c062';
    const cliPath = path.join(p.PROJECT_ROOT, 'playwright', 'cli.ts');
    const projectRoot = p.PROJECT_ROOT;

    const batchItems = concepts.map((c, idx) => ({ segment_id: c.id || (idx + 1), prompt: c.prompt }));

    await new Promise((resolve) => {
      const itemsJsonStr = JSON.stringify(batchItems);
      const child = spawnTsxProcessForRoot(p.PROJECT_ROOT, [cliPath, 'batch-runner', '-p', targetProject, '-j', itemsJsonStr, '--headed'], { cwd: projectRoot, env: { ...process.env } });

      let buffer = '';
      child.stdout.on('data', async (data) => {
        const str = data.toString(); buffer += str;
        const lines = buffer.split('\n'); buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.includes('[ITEM_START]')) {
            const segId = Number(line.split('[ITEM_START]')[1].trim());
            const conceptObj = concepts.find((c, idx) => (c.id || (idx + 1)) === segId) || {};
            try { event.sender.send('spensia-thumbnail-image-progress', { current: results.length + 1, total, conceptId: segId, title: conceptObj.title || `Thumbnail #${segId}`, message: `🎨 Generating Thumbnail ${results.length + 1}/${total}`, status: 'generating' }); } catch {}
          } else if (line.includes('[ITEM_SUCCESS]')) {
            const parts = line.split('[ITEM_SUCCESS]')[1].split('|');
            const segId = Number(parts[0].trim());
            const jsonStr = parts.slice(1).join('|').trim();
            const conceptObj = concepts.find((c, idx) => (c.id || (idx + 1)) === segId) || {};
            const destPath = path.join(targetThumbDir, `thumbnail_${segId}.png`);

            try {
              const res = JSON.parse(jsonStr);
              let localUrl = null;
              if (res.b64_json) { fs.writeFileSync(destPath, Buffer.from(res.b64_json, 'base64')); localUrl = `${media.mediaUrl(destPath)}?t=${Date.now()}`; }
              else if (res.url) {
                try { const imgRes = await fetch(res.url); if (imgRes.ok) { const ab = await imgRes.arrayBuffer(); fs.writeFileSync(destPath, Buffer.from(ab)); } } catch (e) {}
                localUrl = `${media.mediaUrl(destPath)}?t=${Date.now()}`;
              }

              completedCount++;
              const item = { id: segId, title: conceptObj.title || `Thumbnail #${segId}`, text_overlay: conceptObj.text_overlay, badge_text: conceptObj.badge_text, viral_score: conceptObj.viral_score, viral_reason: conceptObj.viral_reason, prompt: conceptObj.prompt, filePath: destPath, url: localUrl || `${media.mediaUrl(destPath)}?t=${Date.now()}`, generatedAt: new Date().toISOString() };
              results.push(item);
              event.sender.send('spensia-thumbnail-image-progress', { current: completedCount, total, conceptId: segId, title: item.title, item, message: `✓ Thumbnail ${completedCount}/${total}`, status: 'success' });
            } catch (e) {}
          } else if (line.includes('[ITEM_ERROR]')) {
            const parts = line.split('[ITEM_ERROR]')[1].split('|');
            const segId = Number(parts[0].trim());
            const errorMsg = parts.slice(1).join('|').trim();
            const conceptObj = concepts.find((c, idx) => (c.id || (idx + 1)) === segId) || {};
            completedCount++;
            const errItem = { id: segId, title: conceptObj.title || `Thumbnail #${segId}`, text_overlay: conceptObj.text_overlay, badge_text: conceptObj.badge_text, viral_score: conceptObj.viral_score, viral_reason: conceptObj.viral_reason, prompt: conceptObj.prompt, error: errorMsg };
            results.push(errItem);
            try { event.sender.send('spensia-thumbnail-image-progress', { current: completedCount, total, conceptId: segId, title: errItem.title, error: errorMsg, message: `❌ Thumbnail ${completedCount}/${total}`, status: 'error' }); } catch {}
          }
        }
      });
      child.stderr.on('data', (data) => { console.warn('[thumbnail batch-runner stderr]', data.toString()); });
      child.on('close', () => resolve());
    });

    const savePath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnails_rendered_topic_${topId}.json`);
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(savePath, JSON.stringify(results, null, 2), 'utf-8');

    return results;
  });

  // ─── Analyze thumbnails with vision ────────────────────
  ipcMain.handle('analyze-spensia-thumbnail-images', async (event, { topicTitle, selectedTitle, thumbnails, model, topicId }) => {
    const topId = topicId || 1;
    const targetThumbDir = path.join(p.SPENSIA_THUMBNAILS_DIR, `topic_${topId}`);

    const images = [];
    let sharp = null;
    try { sharp = require('sharp'); } catch {}

    if (Array.isArray(thumbnails)) {
      for (const thumb of thumbnails) {
        const conceptId = thumb.id;
        let fp = thumb.filePath;
        if (!fp || !fs.existsSync(fp)) fp = path.join(targetThumbDir, `thumbnail_${conceptId}.png`);
        if (fs.existsSync(fp)) {
          let buf = fs.readFileSync(fp);
          if (sharp) { try { buf = await sharp(fp).resize(640, 360, { fit: 'inside' }).jpeg({ quality: 75 }).toBuffer(); } catch {} }
          images.push(`data:image/jpeg;base64,${buf.toString('base64')}`);
        }
      }
    }

    if (images.length === 0) throw new Error('Tidak ada file gambar thumbnail PNG yang dapat ditemukan.');

    const systemPrompt = loadPrompt('analyze-thumbnails-vision-prompt.md');
    const prompt = `Target Video Title: "${selectedTitle || topicTitle || 'Fakta Spensia'}"\n\nAttached Files: ${images.length} rendered thumbnails.\n\nPerform a ruthless human eye-tracking & thumb-stopping behavioral audit. Pick the winner_id and provide detailed objective evaluations.`;

    const rawJson = await aiClient.visionChatCompletion({ systemPrompt, prompt, images, model: model || 'ag/gemini-3-flash-agent', jsonMode: true, temperature: 0.7 });
    const cleanJsonStr = aiClient.extractCleanJsonObject(rawJson);
    const analysisResult = JSON.parse(cleanJsonStr);

    const savePath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnails_vision_analysis_topic_${topId}.json`);
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(savePath, JSON.stringify(analysisResult, null, 2), 'utf-8');

    if (analysisResult?.winner_id && Array.isArray(thumbnails)) {
      const winnerThumb = thumbnails.find((t) => t.id === analysisResult.winner_id);
      if (winnerThumb) {
        const selPath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_selected_topic_${topId}.json`);
        fs.writeFileSync(selPath, JSON.stringify({ selectedId: winnerThumb.id, concept: winnerThumb, topicId: topId }, null, 2), 'utf-8');
      }
    }

    return analysisResult;
  });

  // ─── Get/save thumbnails ───────────────────────────────
  ipcMain.handle('get-spensia-thumbnails', async (_event, args) => {
    const topicId = (typeof args === 'number' ? args : args?.topicId) || 1;
    const savePath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnails_rendered_topic_${topicId}.json`);
    const promptsPath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_prompts_topic_${topicId}.json`);

    let finalSavePath = savePath, finalPromptsPath = promptsPath;
    if (topicId === 1 && !fs.existsSync(savePath)) { const legacy = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails_rendered.json'); if (fs.existsSync(legacy)) finalSavePath = legacy; }
    if (topicId === 1 && !fs.existsSync(promptsPath)) { const legacy = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnail_prompts.json'); if (fs.existsSync(legacy)) finalPromptsPath = legacy; }

    let concepts = [];
    if (fs.existsSync(finalPromptsPath)) { try { const data = JSON.parse(fs.readFileSync(finalPromptsPath, 'utf-8')); concepts = data.concepts || []; } catch {} }

    let rendered = [];
    if (fs.existsSync(finalSavePath)) {
      try {
        rendered = JSON.parse(fs.readFileSync(finalSavePath, 'utf-8'));
        rendered = rendered.map((r) => { if (r.filePath && fs.existsSync(r.filePath)) return { ...r, url: `${media.mediaUrl(r.filePath)}?t=${Date.now()}` }; return r; });
      } catch {}
    }

    let selected = null;
    const selPath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_selected_topic_${topicId}.json`);
    let finalSelPath = selPath;
    if (topicId === 1 && !fs.existsSync(selPath)) { const legacy = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnail_selected.json'); if (fs.existsSync(legacy)) finalSelPath = legacy; }
    if (fs.existsSync(finalSelPath)) { try { selected = JSON.parse(fs.readFileSync(finalSelPath, 'utf-8')); } catch {} }

    return { concepts, rendered, selected };
  });

  ipcMain.handle('save-spensia-thumbnail-selection', async (_event, { selectedId, concept, topicId }) => {
    const topId = topicId || 1;
    const selPath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_selected_topic_${topId}.json`);
    const sdir = path.dirname(selPath);
    if (!fs.existsSync(sdir)) fs.mkdirSync(sdir, { recursive: true });
    const data = { selectedId, concept, updatedAt: new Date().toISOString() };
    fs.writeFileSync(selPath, JSON.stringify(data, null, 2), 'utf-8');
    if (concept?.filePath && fs.existsSync(concept.filePath)) {
      const mainThumbPath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'thumbnails', `thumbnail_topic_${topId}.png`);
      const tdir = path.dirname(mainThumbPath);
      if (!fs.existsSync(tdir)) fs.mkdirSync(tdir, { recursive: true });
      try { fs.copyFileSync(concept.filePath, mainThumbPath); } catch {}
    }
    return data;
  });

  // ══════════════════════════════════════════════════════
  // Upload Metadata
  // ══════════════════════════════════════════════════════

  ipcMain.handle('generate-spensia-upload-metadata', async (event, { scriptContent, topicTitle, model, topicId }) => {
    const topId = topicId || 1;
    let contextText = scriptContent || '';
    if (!contextText) {
      const scriptPath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'scripts', `full_script_topic_${topId}.txt`);
      if (fs.existsSync(scriptPath)) contextText = fs.readFileSync(scriptPath, 'utf-8');
      else { const fallback = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'full_script.txt'); if (fs.existsSync(fallback)) contextText = fs.readFileSync(fallback, 'utf-8'); }
    }

    let chaptersText = '';
    const mappingPath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'mappings', `spensia_mapping_topic_${topId}.json`);
    let finalMapPath = mappingPath;
    if (!fs.existsSync(mappingPath)) { const fallbackMap = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'spensia_mapping.json'); if (fs.existsSync(fallbackMap)) finalMapPath = fallbackMap; }

    if (fs.existsSync(finalMapPath)) {
      try {
        const mapping = JSON.parse(fs.readFileSync(finalMapPath, 'utf-8'));
        const timeline = mapping.timeline || [];
        if (timeline.length > 0) {
          let accSec = 0;
          const chapterLines = ['00:00 Intro & Fakta Utama'];
          for (let i = 0; i < timeline.length; i++) {
            const seg = timeline[i]; accSec += (seg.duration_sec || 5);
            if (i === Math.floor(timeline.length * 0.25) || i === Math.floor(timeline.length * 0.5) || i === Math.floor(timeline.length * 0.75)) {
              const mm = String(Math.floor(accSec / 60)).padStart(2, '0'), ss = String(Math.floor(accSec % 60)).padStart(2, '0');
              chapterLines.push(`${mm}:${ss} ${seg.quote ? seg.quote.slice(0, 30) + '...' : `Segmen #${seg.segment_id || (i + 1)}`}`);
            }
          }
          chaptersText = chapterLines.join('\n');
        }
      } catch {}
    }

    const systemPrompt = loadPrompt('upload-metadata-prompt.md');
    const prompt = `Judul Topik / Konten: "${topicTitle || 'Fakta Spensia'}"\n\nNaskah / Detail Konten:\n${contextText || 'Fakta unik dan kontraintuitif tentang kehidupan purba vs modern.'}\n\n${chaptersText ? `Catatan Timestamps Rencana:\n${chaptersText}` : ''}`;

    const rawJson = await aiClient.streamChatCompletion({ systemPrompt, prompt, model: model || 'ag/gemini-3-flash-agent', jsonMode: true, temperature: 0.7, onChunk: (chunk, fullText) => { try { event.sender.send('spensia-upload-metadata-chunk', { chunk, fullText }); } catch {} } });

    const parsed = JSON.parse(rawJson);
    const savePath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'metadata', `upload_metadata_topic_${topId}.json`);
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(savePath, JSON.stringify(parsed, null, 2), 'utf-8');

    return parsed;
  });

  ipcMain.handle('get-spensia-upload-metadata', async (_event, args) => {
    const topicId = (typeof args === 'number' ? args : args?.topicId) || 1;
    const savePath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'metadata', `upload_metadata_topic_${topicId}.json`);
    if (fs.existsSync(savePath)) { try { return JSON.parse(fs.readFileSync(savePath, 'utf-8')); } catch {} }
    else if (topicId === 1) { const legacy = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'upload_metadata.json'); if (fs.existsSync(legacy)) { try { return JSON.parse(fs.readFileSync(legacy, 'utf-8')); } catch {} } }
    return null;
  });

  ipcMain.handle('analyze-spensia-metadata', async (event, { topicTitle, metadata, model, topicId }) => {
    const topId = topicId || 1;
    const systemPrompt = loadPrompt('analyze-metadata-prompt.md');
    const prompt = `Topic Title: "${topicTitle || 'Spensia Educational Facts'}"\n\nGenerated Metadata to Analyze:\n${JSON.stringify(metadata, null, 2)}`;

    const rawJson = await aiClient.streamChatCompletion({ systemPrompt, prompt, model: model || 'ag/gemini-3-flash-agent', jsonMode: true, temperature: 0.7 });
    const analysis = JSON.parse(rawJson);

    const savePath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'metadata', `upload_metadata_topic_${topId}.json`);
    if (fs.existsSync(savePath)) {
      try { const existing = JSON.parse(fs.readFileSync(savePath, 'utf-8')); existing.analysis = analysis; if (analysis.superior_title) existing.recommended_title = analysis.superior_title; fs.writeFileSync(savePath, JSON.stringify(existing, null, 2), 'utf-8'); } catch {}
    }
    return analysis;
  });

  ipcMain.handle('fix-spensia-metadata', async (event, { topicTitle, metadata, analysis, model, topicId }) => {
    const topId = topicId || 1;
    const systemPrompt = loadPrompt('fix-metadata-prompt.md');
    const prompt = `Topic Title: "${topicTitle || 'Spensia Educational Facts'}"\n\nCurrent Metadata:\n${JSON.stringify(metadata, null, 2)}\n\nAI Analysis & Areas to Fix:\n${JSON.stringify(analysis || {}, null, 2)}`;

    const rawJson = await aiClient.streamChatCompletion({ systemPrompt, prompt, model: model || 'ag/gemini-3-flash-agent', jsonMode: true, temperature: 0.7 });
    const fixedMetadata = JSON.parse(rawJson);
    if (analysis) fixedMetadata.analysis = analysis;

    const savePath = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'metadata', `upload_metadata_topic_${topId}.json`);
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(savePath, JSON.stringify(fixedMetadata, null, 2), 'utf-8');

    return fixedMetadata;
  });

  // ══════════════════════════════════════════════════════
  // VO Audio Upload & Merge
  // ══════════════════════════════════════════════════════

  ipcMain.handle('upload-spensia-vo-audio', async (_event, { segmentId, sourcePath, bufferArray, topicId }) => {
    const targetAudioDir = topicId ? path.join(p.PROJECT_ROOT, 'input', 'spensia', 'audio', `topic_${topicId}`) : p.SPENSIA_AUDIO_DIR;
    await fs.promises.mkdir(targetAudioDir, { recursive: true });
    const ext = sourcePath ? path.extname(sourcePath) || '.mp3' : '.mp3';
    const filename = topicId ? `full_narration_topic_${topicId}${ext}` : (segmentId !== undefined ? `segment_${segmentId}${ext}` : `full_narration${ext}`);
    const destPath = path.join(targetAudioDir, filename);

    if (bufferArray) { await fs.promises.writeFile(destPath, Buffer.from(bufferArray)); }
    else if (sourcePath && fs.existsSync(sourcePath)) { await fs.promises.copyFile(sourcePath, destPath); }
    else { throw new Error('File audio source atau buffer tidak valid.'); }

    const duration = await ffmpeg.getAudioDurationHelper(destPath);
    return { segmentId, filename, filePath: destPath, url: media.mediaUrl(destPath), duration };
  });

  ipcMain.handle('merge-spensia-vo-audio', async (_event, { audioPaths, topicId }) => {
    if (!Array.isArray(audioPaths) || audioPaths.length === 0) throw new Error('Daftar file audio tidak boleh kosong.');
    const validPaths = audioPaths.filter((p) => p && fs.existsSync(p));
    if (validPaths.length === 0) throw new Error('Tidak ada file audio valid yang ditemukan.');

    const targetAudioDir = topicId ? path.join(p.PROJECT_ROOT, 'input', 'spensia', 'audio', `topic_${topicId}`) : p.SPENSIA_AUDIO_DIR;
    await fs.promises.mkdir(targetAudioDir, { recursive: true });
    const destPath = path.join(targetAudioDir, 'merged_narration.mp3');

    if (validPaths.length === 1) {
      await fs.promises.copyFile(validPaths[0], destPath);
      const duration = await ffmpeg.getAudioDurationHelper(destPath);
      return { filename: 'merged_narration.mp3', filePath: destPath, url: media.mediaUrl(destPath), duration };
    }

    const listFilePath = path.join(p.TMP_DIR, `spensia_vo_concat_${Date.now()}.txt`);
    const fileContent = validPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.promises.writeFile(listFilePath, fileContent, 'utf-8');

    const allMp3 = validPaths.every((p) => p.toLowerCase().endsWith('.mp3'));
    let streamCopySuccess = false;

    if (allMp3) {
      try {
        const concatArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', listFilePath, '-c', 'copy', destPath];
        await new Promise((resolve, reject) => {
          const child = spawn(ffmpeg.ffmpegPath, concatArgs, { cwd: p.PROJECT_ROOT });
          let stderr = '';
          child.stderr.on('data', (d) => { stderr += d.toString(); });
          child.on('close', (code) => { if (code === 0 && fs.existsSync(destPath) && fs.statSync(destPath).size > 0) resolve(); else reject(new Error(`Concat stream copy failed (code ${code})`)); });
          child.on('error', reject);
        });
        streamCopySuccess = true;
      } catch (err) { console.warn(`[Merge VO] Stream copy failed, using filter re-encoding...`); }
    }

    if (!streamCopySuccess) {
      const filterArgs = ['-y'];
      validPaths.forEach((p) => filterArgs.push('-i', p));
      const inputCount = validPaths.length;
      const filterStr = `${validPaths.map((_, i) => `[${i}:a]`).join('')}concat=n=${inputCount}:v=0:a=1[aout]`;
      filterArgs.push('-filter_complex', filterStr, '-map', '[aout]', '-c:a', 'libmp3lame', '-b:a', '192k', destPath);

      await new Promise((resolve, reject) => {
        const child = spawn(ffmpeg.ffmpegPath, filterArgs, { cwd: p.PROJECT_ROOT });
        child.stderr.on('data', () => {});
        child.on('close', (code) => { if (code === 0 && fs.existsSync(destPath) && fs.statSync(destPath).size > 0) resolve(); else reject(new Error(`Concat filter encoding failed (code ${code})`)); });
        child.on('error', reject);
      });
    }

    if (fs.existsSync(listFilePath)) { try { fs.unlinkSync(listFilePath); } catch {} }
    const duration = await ffmpeg.getAudioDurationHelper(destPath);
    return { filename: 'merged_narration.mp3', filePath: destPath, url: media.mediaUrl(destPath), duration };
  });

  ipcMain.handle('run-spensia-faster-whisper-alignment', async (event, { audioPath, scriptText, topicId }) => {
    const sendProgress = (stage, progress, message, logText) => {
      try {
        if (event && event.sender && !event.sender.isDestroyed()) {
          event.sender.send('spensia-faster-whisper-progress', { stage, progress, message, log: logText || message, topicId });
        }
      } catch (err) {
        console.warn('[Spensia Faster-Whisper] Failed to send progress:', err.message);
      }
    };

    try {
      sendProgress('preparing', 5, 'Memulai proses transkrip otomatis Faster-Whisper Spensia...');
      
      let audioToUse = audioPath;
      if (audioToUse && !path.isAbsolute(audioToUse)) {
        audioToUse = path.resolve(p.PROJECT_ROOT, audioToUse);
      }

      const topId = topicId || 1;
      if (!audioToUse || !fs.existsSync(audioToUse)) {
        const dirCandidates = [
          path.join(p.PROJECT_ROOT, 'input', 'spensia', 'audio', `topic_${topId}`),
          p.SPENSIA_AUDIO_DIR,
          path.join(p.PROJECT_ROOT, 'input', 'spensia', 'audio'),
        ];

        for (const dir of dirCandidates) {
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            const found = files.find((f) => /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(f));
            if (found) {
              audioToUse = path.join(dir, found);
              break;
            }
          }
        }
      }

      if (!audioToUse || !fs.existsSync(audioToUse)) {
        throw new Error(`File audio narasi tidak ditemukan. Harap upload file audio narasi terlebih dahulu.`);
      }

      const scriptToUse = scriptText || '';
      const tmpDir = path.join(p.PROJECT_ROOT, 'input', 'spensia', 'transcripts');
      await fs.promises.mkdir(tmpDir, { recursive: true });

      const tmpScriptPath = path.join(tmpDir, `tmp_script_topic_${topId}.txt`);
      await fs.promises.writeFile(tmpScriptPath, scriptToUse, 'utf-8');

      const outJsonPath = path.join(tmpDir, `merged_transcript_topic_${topId}.json`);

      const pythonBin = path.join(p.PROJECT_ROOT, 'whisperx', 'venv', 'bin', 'python3');
      const alignCli = path.join(p.PROJECT_ROOT, 'whisperx', 'align_cli.py');

      if (!fs.existsSync(pythonBin)) {
        throw new Error(`Python venv tidak ditemukan di: ${pythonBin}`);
      }
      if (!fs.existsSync(alignCli)) {
        throw new Error(`Align CLI script tidak ditemukan di: ${alignCli}`);
      }

      sendProgress('loading_model', 15, `Target Audio: ${path.basename(audioToUse)}. Memuat engine Faster-Whisper...`);

      await new Promise((resolve, reject) => {
        const child = spawn(pythonBin, [alignCli, '--audio', audioToUse, '--text', tmpScriptPath, '--output', outJsonPath, '--model', 'small'], {
          cwd: p.PROJECT_ROOT,
          env: { ...process.env, PYTHONSAFEPATH: '1' },
        });

        let currentProgress = 15;
        let currentStage = 'loading_model';

        function processLine(rawLine) {
          const line = rawLine.replace(/^\[faster-whisper\]\s*/, '').replace(/^\[log\]\s*/, '').trim();
          if (!line) return;

          if (line.includes('Checking local cache')) { currentProgress = 10; currentStage = 'loading_model'; }
          else if (line.includes('Initializing CTranslate2')) { currentProgress = 18; currentStage = 'loading_model'; }
          else if (line.includes('Loaded Faster-Whisper model')) { currentProgress = 25; currentStage = 'loading_model'; }
          else if (line.includes('Audio Target:')) { currentProgress = 28; currentStage = 'preparing'; }
          else if (line.includes('Starting Silero VAD')) { currentProgress = 30; currentStage = 'transcribing'; }
          else if (line.includes('Perform Fuzzy Text-Matching Alignment')) { currentProgress = 85; currentStage = 'aligning'; }
          else if (line.includes('Selesai!')) { currentProgress = 95; currentStage = 'done'; }

          const pctMatch = line.match(/\[(\d+)%\]/);
          if (pctMatch) {
            const rawPct = parseInt(pctMatch[1], 10);
            if (!isNaN(rawPct)) {
              currentProgress = Math.min(80, 30 + Math.floor((rawPct / 100) * 50));
              currentStage = 'transcribing';
            }
          }

          sendProgress(currentStage, currentProgress, line, line);
        }

        child.stdout.on('data', (data) => {
          const lines = data.toString().split('\n');
          lines.forEach(processLine);
        });

        child.stderr.on('data', (data) => {
          const lines = data.toString().split('\n');
          lines.forEach(processLine);
        });

        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Proses Faster-Whisper selesai dengan exit code ${code}`));
        });

        child.on('error', (err) => reject(err));
      });

      sendProgress('completed', 100, 'Transkrip otomatis kalimat & kata berhasil dibuat!', '✨ Transkrip otomatis kalimat & kata berhasil dibuat!');
      const jsonStr = await fs.promises.readFile(outJsonPath, 'utf-8');
      return { success: true, jsonContent: jsonStr, filePath: outJsonPath };
    } catch (err) {
      console.error('[Spensia Whisper Error]', err);
      sendProgress('error', 0, `Gagal: ${err.message}`, `❌ Gagal: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  // ══════════════════════════════════════════════════════
  // Get Spensia Render Result
  // ══════════════════════════════════════════════════════

  ipcMain.handle('get-spensia-render-result', async (_event, args) => {
    const topId = (typeof args === 'number' ? args : args?.topicId) || 1;
    const topicFolder = path.join(p.SPENSIA_OUTPUT_DIR, `topic_${topId}`);
    const topicMp4InFolder = path.join(topicFolder, `spensia_topic_${topId}.mp4`);
    if (fs.existsSync(topicMp4InFolder)) return { outputPath: topicMp4InFolder, mediaUrl: media.mediaUrl(topicMp4InFolder), fileName: `spensia_topic_${topId}.mp4` };

    const topicMp4Root = path.join(p.SPENSIA_OUTPUT_DIR, `spensia_topic_${topId}.mp4`);
    if (fs.existsSync(topicMp4Root)) return { outputPath: topicMp4Root, mediaUrl: media.mediaUrl(topicMp4Root), fileName: `spensia_topic_${topId}.mp4` };

    const infoPath = path.join(p.PROJECT_ROOT, 'input', 'spensia', `last_render_topic_${topId}.json`);
    if (fs.existsSync(infoPath)) {
      try { const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8')); if (info?.outputPath && fs.existsSync(info.outputPath)) return { outputPath: info.outputPath, mediaUrl: media.mediaUrl(info.outputPath), fileName: info.fileName || path.basename(info.outputPath), renderedAt: info.renderedAt }; } catch {}
    }
    return null;
  });

  // ══════════════════════════════════════════════════════
  // Spensia Render Engine
  // ══════════════════════════════════════════════════════

  ipcMain.handle('render-spensia-video', async (event, { config, timeline, outputPath, topicId }) => {
    const topId = topicId || timeline?.topic_id || 1;
    const targetTopicFolder = path.join(p.SPENSIA_OUTPUT_DIR, `topic_${topId}`);
    if (!fs.existsSync(targetTopicFolder)) fs.mkdirSync(targetTopicFolder, { recursive: true });

    const destFileName = `spensia_topic_${topId}.mp4`;
    const defaultOutputPath = path.join(targetTopicFolder, destFileName);
    const resolvedOutput = outputPath ? (path.isAbsolute(outputPath) ? outputPath : path.join(p.PROJECT_ROOT, outputPath)) : defaultOutputPath;

    if (fs.existsSync(resolvedOutput)) { try { fs.unlinkSync(resolvedOutput); } catch {} }
    const rootTopicOutput = path.join(p.SPENSIA_OUTPUT_DIR, destFileName);
    if (fs.existsSync(rootTopicOutput)) { try { fs.unlinkSync(rootTopicOutput); } catch {} }

    const outDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const tmpDir = path.join(p.TMP_DIR, `spensia-render-topic_${topId}-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const mainWindow = getMainWindow();
    const send = (stage, progress, message) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('render-progress', { stage, progress, message, topicId: topId });
    };

    try {
      const w = config?.resolution?.width || 1920, h = config?.resolution?.height || 1080, fps = config?.fps || 30;
      send('init', 0, `Initializing Spensia Render Engine for Topic #${topId}...`);

      const clips = timeline?.video_clips || [];
      if (clips.length === 0) { send('error', 0, `No video clips in timeline for Topic #${topId}.`); return { error: `No video clips in timeline for Topic #${topId}.` }; }

      const audioTracks = timeline?.audio_tracks || [];
      const validAudioTracks = audioTracks.filter((t) => t.filePath && fs.existsSync(t.filePath));

      let mappingSegments = [];
      const spensiaMappingPaths = [path.join(p.PROJECT_ROOT, 'input', 'spensia', `spensia_mapping_topic_${topId}.json`), path.join(p.PROJECT_ROOT, 'input', 'spensia', 'transcripts', `merged_transcript_topic_${topId}.json`)];
      if (topId === 1) spensiaMappingPaths.push(path.join(p.PROJECT_ROOT, 'input', 'spensia', 'spensia_mapping.json'));
      for (const smp of spensiaMappingPaths) { if (fs.existsSync(smp)) { try { const raw = JSON.parse(fs.readFileSync(smp, 'utf-8')); mappingSegments = raw.segments || []; if (mappingSegments.length > 0) break; } catch {} } }

      const clipDurations = clips.map((clip, i) => {
        if (typeof clip.duration_sec === 'number' && clip.duration_sec > 0) return clip.duration_sec;
        if (typeof clip.end_sec === 'number' && typeof clip.start_sec === 'number' && clip.end_sec > clip.start_sec) return clip.end_sec - clip.start_sec;
        const matched = mappingSegments.find((s) => s.segment_id === clip.segment_id) || mappingSegments[i];
        if (matched && typeof matched.duration_sec === 'number' && matched.duration_sec > 0) return matched.duration_sec;
        return 3.0;
      });

      const { execSync } = require('child_process');
      const getAudioDurSec = (fp) => { try { const out = execSync(`"${ffmpeg.ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fp}"`, { encoding: 'utf-8' }); const d = parseFloat(out.trim()); return isNaN(d) ? 0 : d; } catch { return 0; } };

      let audioMaxDur = 0;
      for (const a of validAudioTracks) {
        const realDur = getAudioDurSec(a.filePath);
        const trackDur = realDur > 0 ? realDur : (a.duration_sec || (a.end_sec - a.start_sec) || 0);
        const end = (a.start_sec || 0) + trackDur;
        if (end > audioMaxDur) audioMaxDur = end;
      }

      let visualSum = clipDurations.reduce((a, b) => a + b, 0);
      if (audioMaxDur > visualSum && clips.length > 0) { const extra = audioMaxDur - visualSum; clipDurations[clipDurations.length - 1] += extra; visualSum += extra; }
      const totalDur = Math.max(visualSum, audioMaxDur, 1);

      send('clips', 0.05, `🖼️ Memulai pre-rendering ${clips.length} segmen dengan zoom-in presisi (${totalDur.toFixed(1)}s)...`);

      const cpuCores = os.cpus().length || 4;
      const CONCURRENCY = Math.min(8, Math.max(4, Math.floor(cpuCores / 2)));
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
          if (!imgPath || !fs.existsSync(imgPath)) { const found = clips.find((c) => c.image_path && fs.existsSync(c.image_path)); if (found) imgPath = found.image_path; }
          if (!imgPath || !fs.existsSync(imgPath)) throw new Error(`Klip #${i + 1} tidak memiliki file gambar valid.`);

          const clipFrames = Math.max(1, Math.round(dur * fps));
          const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='1+0.08*(on/${clipFrames})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${w}x${h}:fps=${fps},format=yuv420p`;

          const args = ['-y', '-loop', '1', '-r', String(fps), '-t', String(dur.toFixed(3)), '-i', imgPath, '-vf', vf, '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '20', '-threads', '2', '-an', '-pix_fmt', 'yuv420p', outFile];

          return new Promise((resolve, reject) => {
            const child = spawn(ffmpeg.ffmpegPath, args, { cwd: p.PROJECT_ROOT });
            child.stderr.on('data', () => {});
            child.on('close', (code) => {
              if (code === 0) { completedClips++; const pct = 0.05 + ((completedClips / clips.length) * 0.60); send('clips', pct, `🖼️ Segmen ${completedClips}/${clips.length} (${dur.toFixed(1)}s)`); resolve(); }
              else reject(new Error(`FFmpeg segment #${i + 1} exit ${code}`));
            });
            child.on('error', reject);
          });
        });
        await Promise.all(tasks);
      }

      const listFile = path.join(tmpDir, 'concat_list.txt');
      fs.writeFileSync(listFile, clipFiles.map((f) => `file '${f}'`).join('\n'), 'utf-8');
      send('overlay', 0.67, '🔗 Menggabungkan segmen visual...');

      const finalArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile];
      let streamIdx = 1;
      const voStartIdx = streamIdx;
      validAudioTracks.forEach((t) => { finalArgs.push('-i', t.filePath); streamIdx++; });

      const bgmCfg = config?.bgm || {};
      let bgmInputIdx = null;
      if (bgmCfg.enabled !== false && bgmCfg.path) {
        const resolved = path.isAbsolute(bgmCfg.path) ? bgmCfg.path : path.join(p.PROJECT_ROOT, bgmCfg.path);
        if (fs.existsSync(resolved)) { finalArgs.push('-i', resolved); bgmInputIdx = streamIdx++; }
      }

      let assFilePath = null;
      const capCfg = config?.caption || {};
      if (capCfg.enabled !== false && (timeline?.captions || []).length > 0) {
        assFilePath = path.join(tmpDir, 'subtitles.ass');
        fs.writeFileSync(assFilePath, buildAssSubtitleFile(timeline.captions, capCfg, w, h), 'utf-8');
      }

      const filterParts = [], vFilters = [];

      const vigCfg = config?.vignette || {};
      if (vigCfg.enabled !== false) { const intensity = typeof vigCfg.intensity === 'number' ? vigCfg.intensity : 0.75; vFilters.push(`vignette=${(Math.PI / 10 + intensity * (Math.PI / 6)).toFixed(3)}`); }

      if (assFilePath) { const escapedAss = assFilePath.replace(/\\/g, '/').replace(/:/g, '\\:'); vFilters.push(`ass='${escapedAss}'`); }

      const wmCfg = config?.watermark || {};
      if (wmCfg.enabled !== false && wmCfg.text) {
        const escaped = wmCfg.text.replace(/'/g, "'\\\\\\''"), cHex = wmCfg.colorHex || '#FFFFFF';
        const opacity = typeof wmCfg.opacity === 'number' ? wmCfg.opacity : 0.8;
        const fc = `${cHex}@${opacity}`, pos = wmCfg.position || 'top-left';
        const ox = typeof wmCfg.offsetX === 'number' ? wmCfg.offsetX : 0, oy = typeof wmCfg.offsetY === 'number' ? wmCfg.offsetY : 0;
        const fontSize = wmCfg.fontSize || 52, margin = 40;
        let xExpr, yExpr;
        if (pos === 'top-left') { xExpr = `${margin + ox}`; yExpr = `${margin + oy}`; }
        else if (pos === 'top-center') { xExpr = `(w-text_w)/2+${ox}`; yExpr = `${margin + oy}`; }
        else if (pos === 'top-right') { xExpr = `w-text_w-${margin - ox}`; yExpr = `${margin + oy}`; }
        else if (pos === 'bottom-left') { xExpr = `${margin + ox}`; yExpr = `h-text_h-${margin + oy}`; }
        else if (pos === 'bottom-center') { xExpr = `(w-text_w)/2+${ox}`; yExpr = `h-text_h-${margin + oy}`; }
        else if (pos === 'bottom-right') { xExpr = `w-text_w-${margin - ox}`; yExpr = `h-text_h-${margin + oy}`; }
        else { xExpr = `(w-text_w)/2+${ox}`; yExpr = `h-text_h-${margin + oy}`; }

        let fontFile = '';
        const fontCandidates = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf', '/usr/share/fonts/TTF/DejaVuSans.ttf', '/System/Library/Fonts/Helvetica.ttc'];
        for (const fp of fontCandidates) { if (fs.existsSync(fp)) { fontFile = `:fontfile='${fp}'`; break; } }
        vFilters.push(`drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=${fc}:x=${xExpr}:y=${yExpr}:shadowcolor=black@0.6:shadowx=2:shadowy=2${fontFile}`);
      }

      if (vFilters.length > 0) filterParts.push(`[0:v]${vFilters.join(',')}[vout]`);

      let aMap = null;
      if (validAudioTracks.length > 0 || bgmInputIdx !== null) {
        const voLabels = [];
        let currentAudioStreamIdx = voStartIdx;
        for (let ai = 0; ai < validAudioTracks.length; ai++) {
          const t = validAudioTracks[ai], delayMs = Math.round((t.start_sec || 0) * 1000), label = `vo${ai}`;
          filterParts.push(`[${currentAudioStreamIdx}:a]adelay=${delayMs}|${delayMs}[${label}]`);
          voLabels.push(`[${label}]`);
          currentAudioStreamIdx++;
        }
        const voCfg = config?.voiceOver || {};
        const voEnabled = voCfg.enabled !== false, voVol = typeof voCfg.volume === 'number' ? voCfg.volume : 1.0;
        const activeVoLabels = voEnabled ? voLabels : [];

        if (bgmInputIdx !== null) {
          const bgmVol = bgmCfg.volume || 0.15, fadeIn = bgmCfg.fadeInSec || 1.0, fadeOut = bgmCfg.fadeOutSec || 2.0, fos = Math.max(0, totalDur - fadeOut);
          if (activeVoLabels.length > 1) {
            filterParts.push(`${activeVoLabels.join('')}amix=inputs=${activeVoLabels.length}:duration=longest:dropout_transition=0.5[vomix]`);
            filterParts.push(`[vomix]volume=${voVol.toFixed(2)}[vonorm]`);
            filterParts.push(`[${bgmInputIdx}:a]aloop=loop=-1:size=2e+09,volume=${bgmVol},afade=t=in:d=${fadeIn},afade=t=out:st=${fos.toFixed(1)}:d=${fadeOut}[bgmproc]`);
            filterParts.push(`[vonorm][bgmproc]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
          } else if (activeVoLabels.length === 1) {
            filterParts.push(`${activeVoLabels[0]}volume=${voVol.toFixed(2)}[vonorm]`);
            filterParts.push(`[${bgmInputIdx}:a]aloop=loop=-1:size=2e+09,volume=${bgmVol},afade=t=in:d=${fadeIn},afade=t=out:st=${fos.toFixed(1)}:d=${fadeOut}[bgmproc]`);
            filterParts.push(`[vonorm][bgmproc]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
          } else {
            filterParts.push(`[${bgmInputIdx}:a]aloop=loop=-1:size=2e+09,volume=${bgmVol},afade=t=in:d=${fadeIn},afade=t=out:st=${fos.toFixed(1)}:d=${fadeOut}[aout]`);
          }
        } else if (activeVoLabels.length > 1) {
          filterParts.push(`${activeVoLabels.join('')}amix=inputs=${activeVoLabels.length}:duration=longest:dropout_transition=0.5[vomix]`);
          filterParts.push(`[vomix]volume=${voVol.toFixed(2)}[aout]`);
        } else if (activeVoLabels.length === 1) {
          filterParts.push(`${activeVoLabels[0]}volume=${voVol.toFixed(2)}[aout]`);
        }
        aMap = '[aout]';
      }

      if (filterParts.length > 0) finalArgs.push('-filter_complex', filterParts.join(';'));
      if (vFilters.length > 0) finalArgs.push('-map', '[vout]'); else finalArgs.push('-map', '0:v');
      if (aMap) finalArgs.push('-map', aMap);

      const q = config?.outputQuality || 'balanced';
      const qMap = {
        fast: ['-preset', 'ultrafast', '-tune', 'zerolatency', '-bf', '0', '-crf', '23'],
        balanced: ['-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '19'],
        high: ['-preset', 'superfast', '-crf', '17']
      };
      finalArgs.push('-c:v', 'libx264', ...(qMap[q] || qMap.balanced), '-threads', '0', '-pix_fmt', 'yuv420p');
      if (aMap) finalArgs.push('-c:a', 'aac', '-b:a', '192k');
      finalArgs.push('-movflags', '+faststart', '-t', String(totalDur.toFixed(2)), resolvedOutput);

      send('final', 0.75, `⚡ Memulai encoding ekspor MP4 1080p...`);

      await new Promise((resolve, reject) => {
        const child = spawn(ffmpeg.ffmpegPath, finalArgs, { cwd: p.PROJECT_ROOT });
        child.stderr.on('data', (d) => {
          const text = d.toString();
          const tm = text.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
          if (tm) {
            const sec = parseInt(tm[1]) * 3600 + parseInt(tm[2]) * 60 + parseInt(tm[3]);
            const fpct = Math.min(1.0, sec / totalDur);
            const mappedPct = Math.min(0.99, 0.75 + (fpct * 0.24));
            send('final', mappedPct, `⚡ Encoding MP4 1080p: ${sec}s / ${totalDur.toFixed(0)}s`);
          }
        });
        child.on('close', (code) => { if (code === 0) { send('done', 1.0, '🎉 Render Video 1080p Selesai!'); resolve(); } else reject(new Error(`FFmpeg exit ${code}`)); });
        child.on('error', (err) => reject(err));
      });

      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

      const resultObj = { outputPath: resolvedOutput, mediaUrl: media.mediaUrl(resolvedOutput), fileName: path.basename(resolvedOutput), topicId: topId, renderedAt: new Date().toISOString() };
      try {
        fs.writeFileSync(path.join(p.PROJECT_ROOT, 'input', 'spensia', `last_render_topic_${topId}.json`), JSON.stringify(resultObj, null, 2), 'utf-8');
        if (topId === 1) fs.writeFileSync(path.join(p.PROJECT_ROOT, 'input', 'spensia', 'last_render.json'), JSON.stringify(resultObj, null, 2), 'utf-8');
      } catch {}
      return resultObj;
    } catch (err) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      send('error', 0, `❌ Spensia Render Error: ${err.message}`);
      return { error: err.message };
    }
  });

  // ─── Render Spensia Preview Frame ──────────────────────
  ipcMain.handle('render-spensia-preview-frame', async (_event, { config, imagePath }) => {
    if (!imagePath || !fs.existsSync(imagePath)) return { error: 'Preview image not found.' };

    const w = config?.resolution?.width || 1920, h = config?.resolution?.height || 1080;
    const previewPath = path.join(p.TMP_DIR, `spensia_preview_${Date.now()}.png`);

    try {
      let vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;

      const vigCfg = config?.vignette || {};
      if (vigCfg.enabled !== false) { const intensity = typeof vigCfg.intensity === 'number' ? vigCfg.intensity : 0.75; vf += `,vignette=${(Math.PI / 10 + intensity * (Math.PI / 6)).toFixed(3)}`; }

      const wmCfg = config?.watermark || {};
      if (wmCfg.enabled !== false && wmCfg.text) {
        const escaped = wmCfg.text.replace(/'/g, "'\\\\\\''"), cHex = wmCfg.colorHex || '#FFFFFF';
        const opacity = typeof wmCfg.opacity === 'number' ? wmCfg.opacity : 0.8;
        const fc = `${cHex}@${opacity}`, pos = wmCfg.position || 'top-left';
        const ox = typeof wmCfg.offsetX === 'number' ? wmCfg.offsetX : 0, oy = wmCfg.offsetY || 0;
        const fontSize = wmCfg.fontSize || 52, margin = 40;
        let xExpr, yExpr;
        if (pos === 'top-left') { xExpr = `${margin + ox}`; yExpr = `${margin + oy}`; }
        else if (pos === 'top-center') { xExpr = `(w-text_w)/2+${ox}`; yExpr = `${margin + oy}`; }
        else if (pos === 'top-right') { xExpr = `w-text_w-${margin - ox}`; yExpr = `${margin + oy}`; }
        else if (pos === 'bottom-left') { xExpr = `${margin + ox}`; yExpr = `h-text_h-${margin + oy}`; }
        else if (pos === 'bottom-center') { xExpr = `(w-text_w)/2+${ox}`; yExpr = `h-text_h-${margin + oy}`; }
        else if (pos === 'bottom-right') { xExpr = `w-text_w-${margin - ox}`; yExpr = `h-text_h-${margin + oy}`; }
        else { xExpr = `(w-text_w)/2+${ox}`; yExpr = `h-text_h-${margin + oy}`; }

        let fontFile = '';
        const fontCandidates = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf', '/usr/share/fonts/TTF/DejaVuSans.ttf', '/System/Library/Fonts/Helvetica.ttc'];
        for (const fp of fontCandidates) { if (fs.existsSync(fp)) { fontFile = `:fontfile='${fp}'`; break; } }
        vf += `,drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=${fc}:x=${xExpr}:y=${yExpr}:shadowcolor=black@0.6:shadowx=2:shadowy=2${fontFile}`;
      }

      vf += `,format=yuv420p`;

      await new Promise((resolve, reject) => {
        const args = ['-y', '-i', imagePath, '-vf', vf, '-vframes', '1', '-c:v', 'png', previewPath];
        const ff = spawn(ffmpeg.ffmpegPath, args, { cwd: p.PROJECT_ROOT });
        ff.stderr.on('data', () => {});
        ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Preview render exit ${code}`)));
        ff.on('error', reject);
      });

      return { filePath: previewPath, url: media.mediaUrl(previewPath) };
    } catch (err) { return { error: err.message }; }
  });

  // ══════════════════════════════════════════════════════
  // Spensia Timeline Generator
  // ══════════════════════════════════════════════════════

  ipcMain.handle('generate-spensia-timeline', async (_event, args) => {
    try {
      const topicId = (typeof args === 'number' ? args : args?.topicId) || 1;
      const spensiaDir = path.join(p.PROJECT_ROOT, 'input', 'spensia');
      const transcriptsDir = path.join(spensiaDir, 'transcripts');

      let segments = [];
      const breakdownPaths = topicId === 1
        ? [path.join(spensiaDir, 'breakdowns', `breakdown_topic_1.json`), path.join(spensiaDir, `breakdown_topic_1.json`), path.join(spensiaDir, 'breakdown.json')]
        : [path.join(spensiaDir, 'breakdowns', `breakdown_topic_${topicId}.json`), path.join(spensiaDir, `breakdown_topic_${topicId}.json`)];

      for (const bp of breakdownPaths) { if (fs.existsSync(bp)) { try { const raw = JSON.parse(fs.readFileSync(bp, 'utf-8')); const segs = Array.isArray(raw) ? raw : (raw.segments || raw.breakdown || []); if (segs.length > 0) { segments = segs; break; } } catch {} } }
      if (segments.length === 0) return { error: `No breakdown data found for Topic #${topicId}. Jalankan step Scene Splitter dulu.` };

      const images = [];
      const genImgJsonPath = path.join(spensiaDir, 'images', `generated_images_topic_${topicId}.json`);
      if (fs.existsSync(genImgJsonPath)) {
        try {
          const genData = JSON.parse(fs.readFileSync(genImgJsonPath, 'utf-8'));
          const genSegs = Array.isArray(genData) ? genData : (genData.segments || genData.images || []);
          genSegs.forEach((s) => {
            const segId = Number(s.segment_id || s.id);
            const topicSubfile = path.join(spensiaDir, 'images', `topic_${topicId}`, `segment_${segId}.png`);
            if (fs.existsSync(topicSubfile)) images.push({ segment_id: segId, filePath: topicSubfile, url: media.mediaUrl(topicSubfile) });
            else if (s.filePath && s.filePath.includes(`topic_${topicId}`) && fs.existsSync(s.filePath)) images.push({ segment_id: segId, filePath: s.filePath, url: media.mediaUrl(s.filePath) });
            else if (topicId === 1 && s.filePath && !s.filePath.includes('topic_') && fs.existsSync(s.filePath)) images.push({ segment_id: segId, filePath: s.filePath, url: media.mediaUrl(s.filePath) });
          });
        } catch {}
      }

      const topicImgDir = path.join(spensiaDir, 'images', `topic_${topicId}`);
      const searchImgDirs = [topicImgDir];
      if (topicId === 1) searchImgDirs.push(path.join(spensiaDir, 'images', 'topic_1'));
      for (const d of searchImgDirs) {
        if (fs.existsSync(d)) {
          const files = fs.readdirSync(d).filter(f => /^segment_\d+\.(png|jpg|jpeg|webp)$/i.test(f));
          for (const f of files) {
            const m = f.match(/segment_(\d+)/);
            if (m) { const segId = parseInt(m[1], 10); const filePath = path.join(d, f); if (!images.some((i) => i.segment_id === segId)) images.push({ segment_id: segId, filePath, url: media.mediaUrl(filePath) }); }
          }
        }
      }

      let singleAudio = null, part1Audio = null, part2Audio = null;
      const topicAudDir = path.join(spensiaDir, 'audio', `topic_${topicId}`);
      const searchAudDirs = topicId === 1 ? [topicAudDir, path.join(spensiaDir, 'audio')] : [topicAudDir];

      for (const d of searchAudDirs) {
        if (fs.existsSync(d)) {
          const audioFiles = fs.readdirSync(d).filter(f => /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(f));
          for (const f of audioFiles) {
            const fp = path.join(d, f);
            let dur = 30;
            try { const probeOut = require('child_process').execSync(`"${ffmpeg.ffprobePath}" -v error -show_entries format=duration -of csv=p=0 "${fp}"`, { encoding: 'utf-8', timeout: 5000 }); dur = parseFloat(probeOut) || 30; } catch {}
            if (f.includes('full') || f.includes('merged') || f.includes('single') || f.includes(`topic_${topicId}`)) singleAudio = { filePath: fp, url: media.mediaUrl(fp), duration: dur };
            else if (f.includes('part_1') || f.includes('part1') || f.includes('segment_1')) part1Audio = { filePath: fp, url: media.mediaUrl(fp), duration: dur };
            else if (f.includes('part_2') || f.includes('part2') || f.includes('segment_2')) part2Audio = { filePath: fp, url: media.mediaUrl(fp), duration: dur };
          }
          if (!singleAudio && audioFiles.length > 0) {
            const fp = path.join(d, audioFiles[0]); let dur = 30;
            try { const probeOut = require('child_process').execSync(`"${ffmpeg.ffprobePath}" -v error -show_entries format=duration -of csv=p=0 "${fp}"`, { encoding: 'utf-8', timeout: 5000 }); dur = parseFloat(probeOut) || 30; } catch {}
            singleAudio = { filePath: fp, url: media.mediaUrl(fp), duration: dur };
          }
        }
      }

      let mergedTranscript = null;
      const spensiaMappingPaths = topicId === 1
        ? [path.join(spensiaDir, 'mappings', `spensia_mapping_topic_1.json`), path.join(spensiaDir, `spensia_mapping_topic_1.json`), path.join(transcriptsDir, `merged_transcript_topic_1.json`), path.join(spensiaDir, 'mappings', 'spensia_mapping.json'), path.join(spensiaDir, 'spensia_mapping.json')]
        : [path.join(spensiaDir, 'mappings', `spensia_mapping_topic_${topicId}.json`), path.join(spensiaDir, `spensia_mapping_topic_${topicId}.json`), path.join(transcriptsDir, `merged_transcript_topic_${topicId}.json`)];

      for (const smp of spensiaMappingPaths) {
        if (fs.existsSync(smp)) { try { const rawMap = JSON.parse(fs.readFileSync(smp, 'utf-8')); const words = rawMap.words || []; const segs = rawMap.segments || []; if (words.length > 0 || segs.length > 0) { mergedTranscript = { words, segments: segs, transcript_full: rawMap.transcript_full || '' }; break; } } catch {} }
      }

      const fps = 30, width = 1920, height = 1080;
      // Uses cleanPunct from shared/subtitle-utils.cjs — canonical punctuation removal
      const cleanWordForMatch = (str) => cleanPunct(str).toLowerCase();

      const videoClips = [];
      let clipId = 1;

      const buildClips = (segs, partId, partStartOffset, partDuration, transcriptData) => {
        const transcriptWords = transcriptData?.words || [];
        let wordSearchIdx = 0;

        // Pass 1: Extract start timestamps for all segments from transcript word alignment
        const rawStarts = segs.map((seg, idx) => {
          let segStartSec = -1;
          if (transcriptWords.length > 0) {
            const rawSegText = (seg.text || seg.quote || '').trim();
            const segWords = rawSegText.split(/\s+/).map(cleanWordForMatch).filter(Boolean);
            if (segWords.length > 0) {
              const firstTargetWord = segWords[0];
              for (let i = wordSearchIdx; i < transcriptWords.length; i++) {
                const tw = cleanWordForMatch(transcriptWords[i].word || transcriptWords[i].text);
                if (tw === firstTargetWord || tw.includes(firstTargetWord) || firstTargetWord.includes(tw)) {
                  const parseN = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, '')));
                  const startVal = parseN(transcriptWords[i].start);
                  if (!isNaN(startVal) && startVal >= 0) {
                    segStartSec = partStartOffset + startVal;
                    wordSearchIdx = i + 1;
                    break;
                  }
                }
              }
            }
          }
          return segStartSec;
        });

        // Segment 0 always starts at part start (0.00s)
        rawStarts[0] = partStartOffset;

        // Interpolate any missing start timestamps proportionally
        segs.forEach((seg, idx) => {
          if (rawStarts[idx] < 0) {
            let prevKnownIdx = idx - 1;
            while (prevKnownIdx >= 0 && rawStarts[prevKnownIdx] < 0) prevKnownIdx--;
            const prevStart = prevKnownIdx >= 0 ? rawStarts[prevKnownIdx] : partStartOffset;

            let nextKnownIdx = idx + 1;
            while (nextKnownIdx < segs.length && rawStarts[nextKnownIdx] < 0) nextKnownIdx++;
            const nextStart = nextKnownIdx < segs.length ? rawStarts[nextKnownIdx] : (partStartOffset + partDuration);

            const gapDuration = Math.max(1.0, nextStart - prevStart);
            const subSegs = segs.slice(prevKnownIdx >= 0 ? prevKnownIdx : 0, nextKnownIdx);
            const subTotalChars = subSegs.reduce((acc, s) => acc + (s.text || s.quote || '').length, 0);

            let subCharAcc = 0;
            const startCheck = prevKnownIdx >= 0 ? prevKnownIdx : 0;
            for (let k = startCheck; k < idx; k++) {
              subCharAcc += (segs[k].text || segs[k].quote || '').length;
            }
            const ratio = subTotalChars > 0 ? (subCharAcc / subTotalChars) : ((idx - startCheck) / (nextKnownIdx - startCheck));
            rawStarts[idx] = Number((prevStart + (ratio * gapDuration)).toFixed(2));
          }
        });

        // Pass 2: Generate 100% contiguous visual clips where end_sec(i) === start_sec(i+1)
        segs.forEach((seg, idx) => {
          const img = images.find((i) => i.segment_id === (seg.segment_id || seg.id || idx + 1));
          const startSec = Number(rawStarts[idx].toFixed(2));
          let endSec = (idx < segs.length - 1) ? Number(rawStarts[idx + 1].toFixed(2)) : Number((partStartOffset + partDuration).toFixed(2));

          if (endSec <= startSec) endSec = Number((startSec + 1.5).toFixed(2));
          const segDurationSec = Number((endSec - startSec).toFixed(2));

          videoClips.push({
            clip_id: clipId++,
            segment_id: seg.segment_id || seg.id || idx + 1,
            part_id: partId,
            quote: seg.text || seg.quote || '',
            image_path: img?.filePath || '',
            image_url: img?.url || '',
            start_sec: startSec,
            end_sec: endSec,
            duration_sec: segDurationSec,
            start_frame: Math.round(startSec * fps),
            end_frame: Math.round(endSec * fps),
            transition: 'crossfade'
          });
        });
      };

      const captions = [];
      const addCaptions = (transcript, partId, timeOffset) => {
        const words = Array.isArray(transcript) ? transcript : transcript?.words;
        if (!words) return;
        words.forEach((w) => { const word = (w.word || w.text || '').replace(/[.,:;!?\-""''`()[\]{}]/g, '').trim(); if (!word) return; captions.push({ part_id: partId, word, start_sec: (w.start || 0) + timeOffset, end_sec: (w.end || (w.start + 0.5) || 0) + timeOffset }); });
      };

      const audioTracks = [];
      const isSingleAudio = Boolean(singleAudio) || (!part2Audio && (part1Audio || singleAudio));
      let totalDur = 0;

      if (isSingleAudio) {
        const activeAudio = singleAudio || part1Audio;
        totalDur = activeAudio?.duration || (segments.length * 4);
        if (activeAudio) audioTracks.push({ track: 'A1', part_id: 1, filePath: activeAudio.filePath, url: activeAudio.url, start_sec: 0, end_sec: totalDur, duration_sec: totalDur });
        const activeTranscript = mergedTranscript;
        buildClips(segments, 1, 0, totalDur, activeTranscript);
        addCaptions(activeTranscript, 1, 0);
      } else {
        const mid = Math.ceil(segments.length / 2);
        const p1Segs = segments.slice(0, mid), p2Segs = segments.slice(mid);
        const p1Dur = part1Audio?.duration || (p1Segs.length * 4), p2Dur = part2Audio?.duration || (p2Segs.length * 4);
        totalDur = p1Dur + p2Dur;
        if (part1Audio) audioTracks.push({ track: 'A1', part_id: 1, filePath: part1Audio.filePath, url: part1Audio.url, start_sec: 0, end_sec: p1Dur, duration_sec: p1Dur });
        if (part2Audio) audioTracks.push({ track: 'A2', part_id: 2, filePath: part2Audio.filePath, url: part2Audio.url, start_sec: p1Dur, end_sec: totalDur, duration_sec: p2Dur });
        buildClips(p1Segs, 1, 0, p1Dur, mergedTranscript);
        buildClips(p2Segs, 2, p1Dur, p2Dur, null);
        addCaptions(mergedTranscript, 1, 0);
      }

      const timeline = { title: `Spensia Timeline Topic #${topicId}`, topic_id: topicId, fps, resolution: { width, height, aspect_ratio: '16:9' }, total_duration_sec: Math.round(totalDur * 100) / 100, total_frames: Math.round(totalDur * fps), audio_tracks: audioTracks, video_clips: videoClips, captions, generated_at: new Date().toISOString() };

      const timelinesDir = path.join(spensiaDir, 'timelines');
      if (!fs.existsSync(timelinesDir)) fs.mkdirSync(timelinesDir, { recursive: true });
      const timelineFolderFile = path.join(timelinesDir, `timeline_topic_${topicId}.json`);
      fs.writeFileSync(timelineFolderFile, JSON.stringify(timeline, null, 2), 'utf-8');
      const topicTimelinePath = path.join(spensiaDir, `spensia_timeline_topic_${topicId}.json`);
      fs.writeFileSync(topicTimelinePath, JSON.stringify(timeline, null, 2), 'utf-8');
      if (topicId === 1) { const globalTimelinePath = path.join(spensiaDir, 'spensia_timeline.json'); fs.writeFileSync(globalTimelinePath, JSON.stringify(timeline, null, 2), 'utf-8'); }

      return { timeline, saved: true };
    } catch (err) { return { error: err.message }; }
  });
}

module.exports = { register };
