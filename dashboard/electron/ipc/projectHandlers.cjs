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
  ipcMain.handle('reset-project', async (_event, mode = 'longform') => {
    const isLongform = mode === 'longform';
    try {
      const outputDir = path.join(p.PROJECT_ROOT, 'output');
      const inputDir = path.join(p.PROJECT_ROOT, 'input');
      const alurfilmDir = path.join(p.PROJECT_ROOT, 'input', 'alurfilm');
      const alurfilmChunksDir = path.join(p.PROJECT_ROOT, 'input', 'alurfilm', 'chunks');
      const assetsDir = path.join(p.PROJECT_ROOT, 'input', 'assets');
      const tmpDir = path.join(p.PROJECT_ROOT, 'input', '.tmp');

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const prefix = 'WV-FILM';
      const newId = `${prefix}-${dateStr}-${randStr}`;

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
}

module.exports = { register };
