// dashboard/electron/ipc/shortsHandlers.cjs
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function register(ipcMain, { paths: p, media, ffmpeg, aiClient, loadPrompt, getMainWindow }) {
  // Ensure shorts directories exist
  if (!fs.existsSync(p.SHORTS_OUTPUT_DIR)) fs.mkdirSync(p.SHORTS_OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(p.SHORTS_INPUT_DIR)) fs.mkdirSync(p.SHORTS_INPUT_DIR, { recursive: true });
  const promptsDir = path.join(p.SHORTS_INPUT_DIR, 'prompts');
  if (!fs.existsSync(promptsDir)) fs.mkdirSync(promptsDir, { recursive: true });

  const sendProgress = (stage, progress, message) => {
    try {
      const win = getMainWindow ? getMainWindow() : null;
      if (win && !win.isDestroyed()) {
        win.webContents.send('merge-shorts-progress', { stage, progress, message });
      }
    } catch {}
  };

  /**
   * Linear video merger: Merges Part 1 and Part 2 into 1 single video
   */
  ipcMain.handle('merge-shorts-videos', async (_event, { part1Path, part2Path, outputName }) => {
    return new Promise(async (resolve) => {
      try {
        if (!part1Path || !fs.existsSync(part1Path)) {
          return resolve({ success: false, error: 'File Video Part 1 tidak ditemukan atau belum dipilih.' });
        }
        if (!part2Path || !fs.existsSync(part2Path)) {
          return resolve({ success: false, error: 'File Video Part 2 tidak ditemukan atau belum dipilih.' });
        }

        sendProgress('analyze', 10, 'Menganalisis properti Video Part 1 dan Part 2...');

        const meta1 = await ffmpeg.getVideoMetaHelper(part1Path);
        const meta2 = await ffmpeg.getVideoMetaHelper(part2Path);

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const targetFilename = outputName || `shorts_merged_${dateStr}_${randStr}.mp4`;
        const outputPath = path.join(p.SHORTS_OUTPUT_DIR, targetFilename);

        const listFile = path.join(p.TMP_DIR, `shorts_concat_${Date.now()}.txt`);
        const fileContent = `file '${part1Path.replace(/\\/g, '/')}'\nfile '${part2Path.replace(/\\/g, '/')}'\n`;
        fs.writeFileSync(listFile, fileContent, 'utf-8');

        sendProgress('merging', 30, 'Menggabungkan video dengan stream-copy (lossless)...');

        // Method 1: Fast Concat Demuxer (Stream Copy)
        const tryConcatCopy = () => {
          return new Promise((res) => {
            const args = ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-y', outputPath];
            const proc = spawn(ffmpeg.ffmpegPath, args);
            let stderr = '';
            proc.stderr.on('data', (d) => { stderr += d.toString(); });
            proc.on('close', (code) => {
              if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1024) {
                res({ success: true });
              } else {
                res({ success: false, error: stderr });
              }
            });
            proc.on('error', (err) => res({ success: false, error: err.message }));
          });
        };

        const copyResult = await tryConcatCopy();

        if (copyResult.success) {
          try { if (fs.existsSync(listFile)) fs.unlinkSync(listFile); } catch {}
          const finalMeta = await ffmpeg.getVideoMetaHelper(outputPath);
          sendProgress('done', 100, 'Berhasil menggabungkan Video Part 1 & Part 2!');
          return resolve({
            success: true,
            outputPath,
            outputUrl: media.mediaUrl(outputPath),
            outputFilename: targetFilename,
            duration: finalMeta?.duration || ((meta1?.duration || 0) + (meta2?.duration || 0)),
            width: finalMeta?.width || meta1?.width || 1080,
            height: finalMeta?.height || meta1?.height || 1920,
            fileSizeBytes: finalMeta?.size || fs.statSync(outputPath).size,
            method: 'copy',
          });
        }

        // Method 2: Fallback Re-encode Concat Filter (guarantees compatibility if resolutions or codecs differ)
        sendProgress('reencoding', 50, 'Format video berbeda, mengodekan ulang (re-encode) dan menggabungkan...');

        const targetW = meta1?.width || 1080;
        const targetH = meta1?.height || 1920;

        const filterComplex = [
          `[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0];`,
          `[1:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v1];`,
          `[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[vout][aout]`,
        ].join(' ');

        const reencodeArgs = [
          '-i', part1Path,
          '-i', part2Path,
          '-filter_complex', filterComplex,
          '-map', '[vout]',
          '-map', '[aout]',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '20',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-y', outputPath,
        ];

        const reencodeProc = spawn(ffmpeg.ffmpegPath, reencodeArgs);
        let reencodeStderr = '';

        reencodeProc.stderr.on('data', (d) => {
          reencodeStderr += d.toString();
          // parse time if available
          const match = d.toString().match(/time=(\d+):(\d+):(\d+\.\d+)/);
          if (match) {
            const h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            const s = parseFloat(match[3]);
            const currentSec = h * 3600 + m * 60 + s;
            const totalSec = (meta1?.duration || 0) + (meta2?.duration || 0);
            if (totalSec > 0) {
              const pct = Math.min(98, Math.max(50, Math.round(50 + (currentSec / totalSec) * 45)));
              sendProgress('reencoding', pct, `Memproses encode video (${pct}%)...`);
            }
          }
        });

        reencodeProc.on('close', async (code) => {
          try { if (fs.existsSync(listFile)) fs.unlinkSync(listFile); } catch {}

          if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1024) {
            const finalMeta = await ffmpeg.getVideoMetaHelper(outputPath);
            sendProgress('done', 100, 'Berhasil menggabungkan Video Part 1 & Part 2!');
            return resolve({
              success: true,
              outputPath,
              outputUrl: media.mediaUrl(outputPath),
              outputFilename: targetFilename,
              duration: finalMeta?.duration || ((meta1?.duration || 0) + (meta2?.duration || 0)),
              width: finalMeta?.width || targetW,
              height: finalMeta?.height || targetH,
              fileSizeBytes: finalMeta?.size || fs.statSync(outputPath).size,
              method: 'reencode',
            });
          } else {
            return resolve({
              success: false,
              error: reencodeStderr.split('\n').slice(-8).join('\n') || `FFmpeg concat gagal dengan code ${code}`,
            });
          }
        });

        reencodeProc.on('error', (err) => {
          try { if (fs.existsSync(listFile)) fs.unlinkSync(listFile); } catch {}
          return resolve({ success: false, error: `Gagal menjalankan FFmpeg: ${err.message}` });
        });

      } catch (err) {
        return resolve({ success: false, error: err.message });
      }
    });
  });

  /**
   * Open file location in Windows Explorer / OS file manager
   */
  ipcMain.handle('open-in-folder', async (_event, filePath) => {
    try {
      const { shell } = require('electron');
      if (filePath && fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  /**
   * AI Prompt Director: Generate 2-part linear video prompts and VO script in JSON
   */
  ipcMain.handle('generate-shorts-prompt', async (_event, { itemTitle, customInstructions, model } = {}) => {
    try {
      let systemPrompt = '';
      try {
        systemPrompt = loadPrompt ? loadPrompt('shorts/shorts-crafting-director-prompt.md') : '';
      } catch {
        const fallbackPath = path.join(p.PROMPTS_DIR, 'shorts', 'shorts-crafting-director-prompt.md');
        if (fs.existsSync(fallbackPath)) {
          systemPrompt = fs.readFileSync(fallbackPath, 'utf-8');
        }
      }

      if (!systemPrompt) {
        return { success: false, error: 'Berkas template prompt shorts-crafting-director-prompt.md tidak ditemukan.' };
      }

      let userPrompt = '';
      if (itemTitle && itemTitle.trim()) {
        userPrompt = `TOLONG BUATKAN UNTUK PROYEK BERIKUT: "${itemTitle.trim()}".`;
      } else {
        userPrompt = `Pilihlah satu ide proyek kerajinan tangan / gadget mekanik / karya inovatif yang sangat unik, viral, dan memuaskan mata (oddly satisfying) secara mandiri (AI Decision Mode), lalu buatkan video prompt dan skrip VO-nya.`;
      }

      if (customInstructions && customInstructions.trim()) {
        userPrompt += `\nTambahan instruksi khusus: "${customInstructions.trim()}".`;
      }

      const FALLBACK_MODELS = [
        'gemini/gemini-3.1-flash-lite-preview',
        'gemini/gemini-3-flash-preview',
        'ds/deepseek-chat',
        'cmc/Qwen/Qwen3.6-Plus',
        'cmc/deepseek/deepseek-v4-flash',
      ];

      const modelsToTry = model ? [model, ...FALLBACK_MODELS.filter((m) => m !== model)] : FALLBACK_MODELS;

      let rawResponse = '';
      let lastErr = null;

      for (const targetModel of modelsToTry) {
        try {
          rawResponse = await aiClient.chatCompletion({
            prompt: userPrompt,
            systemPrompt,
            model: targetModel,
            jsonMode: true,
            temperature: 0.7,
          });
          if (rawResponse) break;
        } catch (err) {
          lastErr = err;
          console.warn(`[ShortsPrompt] Model ${targetModel} error:`, err.message);
        }
      }

      if (!rawResponse) {
        return {
          success: false,
          error: lastErr ? `AI API error: ${lastErr.message}` : 'Tidak ada respon dari model AI.',
        };
      }

      const cleanJsonStr = aiClient.extractCleanJsonObject(rawResponse);
      let parsed = null;
      try {
        parsed = JSON.parse(cleanJsonStr);
      } catch (e) {
        parsed = JSON.parse(rawResponse);
      }

      // Save as latest prompt
      const latestPath = path.join(p.SHORTS_INPUT_DIR, 'shorts_craft_prompt.json');
      fs.writeFileSync(latestPath, JSON.stringify(parsed, null, 2), 'utf-8');

      // Save to history
      const historyFile = path.join(p.SHORTS_INPUT_DIR, 'prompts', `prompt_${Date.now()}.json`);
      fs.writeFileSync(historyFile, JSON.stringify(parsed, null, 2), 'utf-8');

      return { success: true, data: parsed };
    } catch (err) {
      console.error('[ShortsPrompt] Generation error:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * Retrieve the latest generated shorts prompt JSON if available
   */
  ipcMain.handle('get-latest-shorts-prompt', async () => {
    try {
      const latestPath = path.join(p.SHORTS_INPUT_DIR, 'shorts_craft_prompt.json');
      if (fs.existsSync(latestPath)) {
        const content = fs.readFileSync(latestPath, 'utf-8');
        return { success: true, data: JSON.parse(content) };
      }
      return { success: false };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  /**
   * Save modified shorts prompt JSON
   */
  ipcMain.handle('save-shorts-prompt', async (_event, { data }) => {
    try {
      if (!data) return { success: false, error: 'Data JSON kosong.' };
      const latestPath = path.join(p.SHORTS_INPUT_DIR, 'shorts_craft_prompt.json');
      fs.writeFileSync(latestPath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { register };

