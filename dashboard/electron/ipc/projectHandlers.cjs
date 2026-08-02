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
  ipcMain.handle('reset-project', async (_event, mode = 'shortform') => {
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
        if (fs.existsSync(alurfilmChunksDir)) {
          const files = fs.readdirSync(alurfilmChunksDir);
          for (const f of files) { try { fs.unlinkSync(path.join(alurfilmChunksDir, f)); } catch { } }
        }
        if (fs.existsSync(alurfilmDir)) {
          const files = fs.readdirSync(alurfilmDir);
          for (const f of files) {
            const fullPath = path.join(alurfilmDir, f);
            try { if (fs.statSync(fullPath).isFile()) fs.unlinkSync(fullPath); } catch { }
          }
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
      } else {
        console.log(`🧹 [Reset Shortform] Clearing all shortform files and setting new Content ID: ${newId}`);
        if (fs.existsSync(outputDir)) {
          const files = fs.readdirSync(outputDir);
          for (const f of files) { try { fs.unlinkSync(path.join(outputDir, f)); } catch { } }
        }
        if (fs.existsSync(assetsDir)) {
          const files = fs.readdirSync(assetsDir);
          for (const f of files) { try { fs.unlinkSync(path.join(assetsDir, f)); } catch { } }
        }
        if (fs.existsSync(tmpDir)) {
          const files = fs.readdirSync(tmpDir);
          for (const f of files) { try { fs.unlinkSync(path.join(tmpDir, f)); } catch { } }
        }
        const mappingFile = path.join(inputDir, 'mapping.json');
        const defaultMapping = {
          settings: { fps: 30, format: "9:16", fg_aspect: "4:5", bgm: "random", content_id: newId },
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

  // ─── List project assets ──────────────────────────────
  ipcMain.handle('list-project-assets', async () => {
    const assetsDir = path.join(p.PROJECT_ROOT, 'assets');
    if (!fs.existsSync(assetsDir)) return { logos: [], bgms: [] };

    const files = fs.readdirSync(assetsDir);
    const logos = files.filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i)).map(f => ({
      name: f,
      path: path.join(assetsDir, f),
      url: media.mediaUrl(path.join(assetsDir, f)),
    }));
    const bgms = files.filter(f => f.match(/\.(mp3|wav|m4a|aac|flac)$/i)).map(f => ({
      name: f,
      path: path.join(assetsDir, f),
      url: media.mediaUrl(path.join(assetsDir, f)),
    }));

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
}

module.exports = { register };
