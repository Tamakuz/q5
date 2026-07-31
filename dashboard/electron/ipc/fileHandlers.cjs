// dashboard/electron/ipc/fileHandlers.cjs
const path = require('path');
const fs = require('fs');

function register(ipcMain, { paths: p, media, ffmpeg }) {
  // ─── Select file ──────────────────────────────────────
  ipcMain.handle('select-file', async () => {
    const { dialog, BrowserWindow } = require('electron');
    const result = await dialog.showOpenDialog(BrowserWindow.getAllWindows()[0], {
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
  ipcMain.handle('get-video-meta', async (_event, filePath) => {
    const meta = await ffmpeg.getVideoMetaHelper(filePath);
    if (meta) {
      meta.url = media.mediaUrl(filePath);
    }
    return meta;
  });

  // ─── Upload & trim with FFmpeg ────────────────────────
  ipcMain.handle('upload-source', async (_event, { filePath, start, end }) => {
    const contentId = p.getOrGenerateContentId();
    const ext = path.extname(filePath) || '.mp4';
    const shouldTrim = start > 0 || end > 0;
    const resourceType = shouldTrim ? 'video_trimmed' : 'video_source';
    const outputName = `${contentId}_${resourceType}${ext}`;
    const destPath = path.join(p.INPUT_ASSETS, outputName);

    if (!shouldTrim) {
      if (filePath !== destPath) {
        await fs.promises.copyFile(filePath, destPath);
      }
      const stat = await fs.promises.stat(destPath);
      return {
        id: contentId,
        name: outputName,
        size: stat.size,
        url: media.mediaUrl(destPath),
        filePath: destPath,
      };
    }

    const { spawn } = require('child_process');
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

      const ffmpegProc = spawn(ffmpeg.ffmpegPath, args);
      ffmpegProc.stderr.on('data', () => {});

      ffmpegProc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`FFmpeg exited with code ${code}`));
        const stat = fs.statSync(destPath);
        resolve({
          id: contentId,
          name: outputName,
          size: stat.size,
          url: media.mediaUrl(destPath),
          filePath: destPath,
        });
      });

      ffmpegProc.on('error', (err) => reject(err));
    });
  });

  // ─── Select audio file ────────────────────────────────
  ipcMain.handle('select-audio', async () => {
    const { dialog, BrowserWindow } = require('electron');
    const result = await dialog.showOpenDialog(BrowserWindow.getAllWindows()[0], {
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
    const contentId = p.getOrGenerateContentId();
    const ext = path.extname(filePath) || '.mp3';
    const outputName = `${contentId}_audio_source${ext}`;
    const destPath = path.join(p.INPUT_ASSETS, outputName);

    fs.copyFileSync(filePath, destPath);
    const stat = fs.statSync(destPath);

    try {
      const stateFile = path.join(p.PROJECT_ROOT, 'input', 'state.json');
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
      url: media.mediaUrl(destPath),
      filePath: destPath,
    };
  });

  // ─── List audio files ─────────────────────────────────
  ipcMain.handle('list-audio', async () => {
    try {
      const files = fs.readdirSync(p.INPUT_ASSETS)
        .filter((f) => /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f))
        .map((f) => {
          const fp = path.join(p.INPUT_ASSETS, f);
          const stat = fs.statSync(fp);
          return {
            name: f,
            size: stat.size,
            createdAt: stat.birthtime.toISOString(),
            url: media.mediaUrl(fp),
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
      const files = fs.readdirSync(p.INPUT_ASSETS)
        .filter((f) => /\.(mp4|mov|webm|mkv|avi)$/i.test(f))
        .map((f) => {
          const fp = path.join(p.INPUT_ASSETS, f);
          const stat = fs.statSync(fp);
          return {
            name: f,
            size: stat.size,
            createdAt: stat.birthtime.toISOString(),
            url: media.mediaUrl(fp),
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
    const outputDir = path.join(p.PROJECT_ROOT, 'output');
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
            url: media.mediaUrl(fp),
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
    const fp = path.join(p.INPUT_ASSETS, fileName);
    if (!fp.startsWith(p.INPUT_ASSETS)) throw new Error('Forbidden');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    return true;
  });

  // ─── Clipboard ─────────────────────────────────────────
  ipcMain.handle('copy-to-clipboard', async (_event, text) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
    return true;
  });

  // ─── Save file to project ─────────────────────────────
  ipcMain.handle('save-to-project', async (_event, { subPath, data }) => {
    const dest = path.join(p.PROJECT_ROOT, subPath);
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dest, data, 'utf-8');

    try {
      const contentId = p.getOrGenerateContentId();
      if (subPath === 'input/transcript.json') {
        const assetFileName = `${contentId}_transcript_result.json`;
        const assetFile = path.join(p.INPUT_ASSETS, assetFileName);
        fs.writeFileSync(assetFile, data, 'utf-8');

        const stateFile = path.join(p.PROJECT_ROOT, 'input', 'state.json');
        if (fs.existsSync(stateFile)) {
          const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
          stateData.resources = stateData.resources || {};
          stateData.resources.transcript_result = `input/assets/${assetFileName}`;
          stateData.updated_at = new Date().toISOString();
          fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2), 'utf-8');
        }
      } else if (subPath === 'input/analysis.json') {
        const assetFileName = `${contentId}_analysis_result.json`;
        const assetFile = path.join(p.INPUT_ASSETS, assetFileName);
        fs.writeFileSync(assetFile, data, 'utf-8');

        const stateFile = path.join(p.PROJECT_ROOT, 'input', 'state.json');
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
    const fp = path.join(p.PROJECT_ROOT, subPath);
    if (!fp.startsWith(p.PROJECT_ROOT)) throw new Error('Forbidden');
    if (!fs.existsSync(fp)) return null;
    return fs.readFileSync(fp, 'utf-8');
  });
}

module.exports = { register };
