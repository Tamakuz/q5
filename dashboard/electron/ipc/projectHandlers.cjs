// dashboard/electron/ipc/projectHandlers.cjs
const path = require('path');
const fs = require('fs');
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
    const activeKeywords = (historyData.history || []).filter((item) => new Date(item.expires_at) > now);
    const blacklist = activeKeywords.map((k) => k.keyword.toLowerCase());

    const fullPrompt = promptTemplate.replace('{{ACTIVE_KEYWORDS_BLACKLIST}}', JSON.stringify(blacklist, null, 2));

    const rawText = await aiClient.chatCompletion({
      prompt: fullPrompt,
      systemPrompt: 'You are an expert YouTube Shorts Production Strategist. Output strictly valid JSON arrays.',
      model: opts.model || 'ag/gemini-3-flash-agent',
      jsonMode: true,
    });

    let cleaned = rawText.trim();
    if (cleaned.includes('```')) {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (match && match[1]) cleaned = match[1].trim();
    }
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error(`Invalid JSON format returned from 9router: ${rawText}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);
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
}

module.exports = { register };
