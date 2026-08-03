// dashboard/electron/ipc/ugcHandlers.cjs
const path = require('path');
const fs = require('fs');

function register(ipcMain, { paths: p, media }) {
  const ACTIVE_PROFILE_FILE = path.join(p.UGC_DIR, 'active_profile.json');

  // ─── Select Image File Dialog ──────────────────────────────────
  ipcMain.handle('ugc:select-image-file', async () => {
    const { dialog, BrowserWindow } = require('electron');
    const result = await dialog.showOpenDialog(BrowserWindow.getAllWindows()[0], {
      title: 'Select Character Photo',
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
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

  // ─── Get All Profiles ─────────────────────────────────────────
  ipcMain.handle('ugc:get-profiles', async () => {
    const profilesDir = p.UGC_PROFILES_DIR;
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
      return [];
    }

    const entries = fs.readdirSync(profilesDir, { withFileTypes: true });
    const profiles = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderPath = path.join(profilesDir, entry.name);
        const infoPath = path.join(folderPath, 'info.json');

        if (fs.existsSync(infoPath)) {
          try {
            const raw = fs.readFileSync(infoPath, 'utf-8');
            const data = JSON.parse(raw);
            const photoFile = data.photo || 'photo.png';
            const fullPhotoPath = path.join(folderPath, photoFile);

            if (fs.existsSync(fullPhotoPath)) {
              data.photoUrl = media.mediaUrl(fullPhotoPath);
              data.photoPath = fullPhotoPath;
            }

            profiles.push(data);
          } catch (e) {
            console.error(`Failed to parse profile info at ${infoPath}`, e);
          }
        }
      }
    }

    return profiles;
  });

  // ─── Create Profile ────────────────────────────────────────────
  ipcMain.handle('ugc:create-profile', async (_event, { name, sourceFilePath }) => {
    if (!name || !name.trim()) {
      throw new Error('Name is required for profile');
    }

    const profileId = `char_${Date.now()}`;
    const profileFolder = path.join(p.UGC_PROFILES_DIR, profileId);
    fs.mkdirSync(profileFolder, { recursive: true });

    let photoName = 'photo.png';
    let photoDestPath = path.join(profileFolder, photoName);

    if (sourceFilePath && fs.existsSync(sourceFilePath)) {
      const ext = path.extname(sourceFilePath) || '.png';
      photoName = `photo${ext}`;
      photoDestPath = path.join(profileFolder, photoName);
      fs.copyFileSync(sourceFilePath, photoDestPath);
    } else {
      // Create fallback dummy placeholder if no file
      fs.writeFileSync(photoDestPath, '');
    }

    const profileInfo = {
      id: profileId,
      name: name.trim(),
      photo: photoName,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(profileFolder, 'info.json'),
      JSON.stringify(profileInfo, null, 2),
      'utf-8'
    );

    profileInfo.photoUrl = media.mediaUrl(photoDestPath);
    profileInfo.photoPath = photoDestPath;

    // Set as active profile if none selected
    if (!fs.existsSync(ACTIVE_PROFILE_FILE)) {
      fs.writeFileSync(
        ACTIVE_PROFILE_FILE,
        JSON.stringify({ activeId: profileId }, null, 2),
        'utf-8'
      );
    }

    return profileInfo;
  });

  // ─── Delete Profile ────────────────────────────────────────────
  ipcMain.handle('ugc:delete-profile', async (_event, profileId) => {
    if (!profileId) return false;
    const profileFolder = path.join(p.UGC_PROFILES_DIR, profileId);

    if (fs.existsSync(profileFolder)) {
      fs.rmSync(profileFolder, { recursive: true, force: true });
    }

    // Reset active profile if deleted
    if (fs.existsSync(ACTIVE_PROFILE_FILE)) {
      try {
        const raw = fs.readFileSync(ACTIVE_PROFILE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (data.activeId === profileId) {
          fs.writeFileSync(ACTIVE_PROFILE_FILE, JSON.stringify({ activeId: null }, null, 2), 'utf-8');
        }
      } catch {}
    }

    return true;
  });

  // ─── Select Active Profile ─────────────────────────────────────
  ipcMain.handle('ugc:select-active-profile', async (_event, profileId) => {
    fs.writeFileSync(
      ACTIVE_PROFILE_FILE,
      JSON.stringify({ activeId: profileId }, null, 2),
      'utf-8'
    );
    return true;
  });

  // ─── Get Active Profile ID ─────────────────────────────────────
  ipcMain.handle('ugc:get-active-profile', async () => {
    if (!fs.existsSync(ACTIVE_PROFILE_FILE)) return null;
    try {
      const raw = fs.readFileSync(ACTIVE_PROFILE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      return data.activeId || null;
    } catch {
      return null;
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // PRODUCTS & ISOLATED VIDEO ASSETS
  // ═══════════════════════════════════════════════════════════════
  const ACTIVE_PRODUCT_FILE = path.join(p.UGC_DIR, 'active_product.json');

  // ─── Select Video File Dialog ──────────────────────────────────
  ipcMain.handle('ugc:select-video-file', async () => {
    const { dialog, BrowserWindow } = require('electron');
    const result = await dialog.showOpenDialog(BrowserWindow.getAllWindows()[0], {
      title: 'Select Raw Video Asset',
      filters: [
        { name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    return result.filePaths.map((fp) => {
      const stat = fs.statSync(fp);
      return {
        name: path.basename(fp),
        size: stat.size,
        path: fp,
      };
    });
  });

  // ─── Get All Products ──────────────────────────────────────────
  ipcMain.handle('ugc:get-products', async () => {
    const productsDir = p.UGC_PRODUCTS_DIR;
    if (!fs.existsSync(productsDir)) {
      fs.mkdirSync(productsDir, { recursive: true });
      return [];
    }

    const entries = fs.readdirSync(productsDir, { withFileTypes: true });
    const products = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderPath = path.join(productsDir, entry.name);
        const infoPath = path.join(folderPath, 'info.json');

        if (fs.existsSync(infoPath)) {
          try {
            const raw = fs.readFileSync(infoPath, 'utf-8');
            const data = JSON.parse(raw);
            if (data.photo) {
              const photoPath = path.join(folderPath, data.photo);
              if (fs.existsSync(photoPath)) {
                data.photoUrl = media.mediaUrl(photoPath);
                data.photoPath = photoPath;
              }
            }
            products.push(data);
          } catch (e) {
            console.error(`Failed to parse product info at ${infoPath}`, e);
          }
        }
      }
    }

    return products;
  });

  // ─── Create Product ────────────────────────────────────────────
  ipcMain.handle('ugc:create-product', async (_event, { name, sourcePhotoPath }) => {
    if (!name || !name.trim()) {
      throw new Error('Name is required for product');
    }

    const productId = `prod_${Date.now()}`;
    const productFolder = path.join(p.UGC_PRODUCTS_DIR, productId);
    const videosFolder = path.join(productFolder, 'assets', 'videos');
    fs.mkdirSync(videosFolder, { recursive: true });

    let photoName = null;
    let photoDestPath = null;

    if (sourcePhotoPath && fs.existsSync(sourcePhotoPath)) {
      const ext = path.extname(sourcePhotoPath) || '.png';
      photoName = `photo${ext}`;
      photoDestPath = path.join(productFolder, photoName);
      fs.copyFileSync(sourcePhotoPath, photoDestPath);
    }

    const productInfo = {
      id: productId,
      name: name.trim(),
      photo: photoName,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(productFolder, 'info.json'),
      JSON.stringify(productInfo, null, 2),
      'utf-8'
    );

    if (photoDestPath && fs.existsSync(photoDestPath)) {
      productInfo.photoUrl = media.mediaUrl(photoDestPath);
      productInfo.photoPath = photoDestPath;
    }

    // Auto set as active product if none selected
    if (!fs.existsSync(ACTIVE_PRODUCT_FILE)) {
      fs.writeFileSync(
        ACTIVE_PRODUCT_FILE,
        JSON.stringify({ activeId: productId }, null, 2),
        'utf-8'
      );
    }

    return productInfo;
  });

  // ─── Delete Product ────────────────────────────────────────────
  ipcMain.handle('ugc:delete-product', async (_event, productId) => {
    if (!productId) return false;
    const productFolder = path.join(p.UGC_PRODUCTS_DIR, productId);

    if (fs.existsSync(productFolder)) {
      fs.rmSync(productFolder, { recursive: true, force: true });
    }

    if (fs.existsSync(ACTIVE_PRODUCT_FILE)) {
      try {
        const raw = fs.readFileSync(ACTIVE_PRODUCT_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (data.activeId === productId) {
          fs.writeFileSync(ACTIVE_PRODUCT_FILE, JSON.stringify({ activeId: null }, null, 2), 'utf-8');
        }
      } catch {}
    }

    return true;
  });

  // ─── Select Active Product ─────────────────────────────────────
  ipcMain.handle('ugc:select-active-product', async (_event, productId) => {
    fs.writeFileSync(
      ACTIVE_PRODUCT_FILE,
      JSON.stringify({ activeId: productId }, null, 2),
      'utf-8'
    );
    return true;
  });

  // ─── Get Active Product ID ─────────────────────────────────────
  ipcMain.handle('ugc:get-active-product', async () => {
    if (!fs.existsSync(ACTIVE_PRODUCT_FILE)) return null;
    try {
      const raw = fs.readFileSync(ACTIVE_PRODUCT_FILE, 'utf-8');
      const data = JSON.parse(raw);
      return data.activeId || null;
    } catch {
      return null;
    }
  });

  // ─── Upload Video Asset (Product Scoped) ───────────────────────
  ipcMain.handle('ugc:upload-video-asset', async (_event, { productId, sourceFilePath }) => {
    if (!productId) throw new Error('Product ID is required');
    if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {
      throw new Error('Valid video source file is required');
    }

    const videosFolder = path.join(p.UGC_PRODUCTS_DIR, productId, 'assets', 'videos');
    if (!fs.existsSync(videosFolder)) {
      fs.mkdirSync(videosFolder, { recursive: true });
    }

    const originalName = path.basename(sourceFilePath);
    const ext = path.extname(originalName) || '.mp4';
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetName = `vid_${Date.now()}_${baseName}${ext}`;
    const destPath = path.join(videosFolder, targetName);

    fs.copyFileSync(sourceFilePath, destPath);
    const stat = fs.statSync(destPath);

    return {
      id: targetName,
      name: originalName,
      fileName: targetName,
      size: stat.size,
      filePath: destPath,
      url: media.mediaUrl(destPath),
      createdAt: new Date().toISOString(),
    };
  });

  // ─── List Video Assets (Product Scoped) ────────────────────────
  ipcMain.handle('ugc:list-video-assets', async (_event, productId) => {
    if (!productId) return [];
    const videosFolder = path.join(p.UGC_PRODUCTS_DIR, productId, 'assets', 'videos');

    if (!fs.existsSync(videosFolder)) {
      return [];
    }

    const files = fs.readdirSync(videosFolder);
    const videoAssets = [];

    for (const file of files) {
      const fullPath = path.join(videosFolder, file);
      if (fs.statSync(fullPath).isFile()) {
        const stat = fs.statSync(fullPath);
        videoAssets.push({
          id: file,
          name: file,
          fileName: file,
          size: stat.size,
          filePath: fullPath,
          url: media.mediaUrl(fullPath),
          createdAt: stat.birthtime.toISOString(),
        });
      }
    }

    return videoAssets;
  });

  // ─── Delete Video Asset (Product Scoped) ───────────────────────
  ipcMain.handle('ugc:delete-video-asset', async (_event, { productId, fileName }) => {
    if (!productId || !fileName) return false;
    const filePath = path.join(p.UGC_PRODUCTS_DIR, productId, 'assets', 'videos', fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  });

  // ─── Download Video Asset via URL (Product Scoped) ──────────────
  ipcMain.handle('ugc:download-video-asset', async (event, { productId, videoUrl }) => {
    if (!productId) throw new Error('Product ID is required');
    if (!videoUrl || !videoUrl.trim()) throw new Error('Video URL is required');

    const http = require('http');
    const https = require('https');
    const { URL } = require('url');

    const videosFolder = path.join(p.UGC_PRODUCTS_DIR, productId, 'assets', 'videos');
    if (!fs.existsSync(videosFolder)) {
      fs.mkdirSync(videosFolder, { recursive: true });
    }

    const downloadStream = (targetUrl, redirectCount = 0) => {
      if (redirectCount > 5) throw new Error('Too many HTTP redirects');

      return new Promise((resolve, reject) => {
        let parsedUrl;
        try {
          parsedUrl = new URL(targetUrl);
        } catch {
          return reject(new Error('Invalid URL format'));
        }

        const client = parsedUrl.protocol === 'https:' ? https : http;

        const req = client.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let redirectLocation = res.headers.location;
            if (!redirectLocation.startsWith('http')) {
              redirectLocation = new URL(redirectLocation, targetUrl).toString();
            }
            return downloadStream(redirectLocation, redirectCount + 1).then(resolve).catch(reject);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Server returned HTTP ${res.statusCode}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let loadedBytes = 0;

          // Parse filename from URL
          const urlPath = parsedUrl.pathname;
          let baseName = path.basename(urlPath);
          if (!baseName || !baseName.includes('.')) {
            baseName = 'downloaded_video.mp4';
          }
          const ext = path.extname(baseName) || '.mp4';
          const cleanName = path.basename(baseName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
          const fileName = `vid_${Date.now()}_${cleanName}${ext}`;
          const destPath = path.join(videosFolder, fileName);

          const fileStream = fs.createWriteStream(destPath);

          res.on('data', (chunk) => {
            loadedBytes += chunk.length;
            const progress = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;
            if (event.sender && !event.sender.isDestroyed()) {
              event.sender.send('ugc:download-video-progress', {
                productId,
                progress,
                loadedBytes,
                totalBytes,
              });
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => resolve(fileName));
          });

          fileStream.on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        });

        req.on('error', (err) => {
          reject(err);
        });
      });
    };

    const fileName = await downloadStream(videoUrl.trim());
    const destPath = path.join(videosFolder, fileName);
    const stat = fs.statSync(destPath);

    return {
      id: fileName,
      name: fileName,
      fileName,
      size: stat.size,
      filePath: destPath,
      url: media.mediaUrl(destPath),
      createdAt: new Date().toISOString(),
    };
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDER STUDIO & 3-CLIP PATTERN GENERATOR
  // ═══════════════════════════════════════════════════════════════

  // Helper: Generate all unique ordered 3-clip permutations
  function generate3ClipPermutations(clips) {
    if (!clips || clips.length < 3) return [];
    const result = [];
    for (let i = 0; i < clips.length; i++) {
      for (let j = 0; j < clips.length; j++) {
        if (j === i) continue;
        for (let k = 0; k < clips.length; k++) {
          if (k === i || k === j) continue;
          result.push([clips[i], clips[j], clips[k]]);
        }
      }
    }
    return result;
  }

  // Helper: Read/write pattern_statuses.json
  function getPatternStatusesPath(productId) {
    return path.join(p.UGC_PRODUCTS_DIR, productId, 'pattern_statuses.json');
  }

  function loadPatternStatuses(productId) {
    const statusFile = getPatternStatusesPath(productId);
    let statuses = {};

    if (fs.existsSync(statusFile)) {
      try {
        const raw = fs.readFileSync(statusFile, 'utf-8');
        statuses = JSON.parse(raw);
      } catch {}
    } else {
      // Legacy fallback: check rendered_patterns.json
      const legacyFile = path.join(p.UGC_PRODUCTS_DIR, productId, 'rendered_patterns.json');
      if (fs.existsSync(legacyFile)) {
        try {
          const raw = fs.readFileSync(legacyFile, 'utf-8');
          const parsed = JSON.parse(raw);
          const legacyPatterns = parsed.renderedPatterns || [];
          legacyPatterns.forEach((pat) => {
            if (Array.isArray(pat) && pat.length === 3) {
              const key = pat.join('::');
              statuses[key] = {
                pattern: pat,
                rendered: true,
                uploaded: false,
                renderedAt: new Date().toISOString(),
              };
            }
          });
        } catch {}
      }
    }

    return statuses;
  }

  function savePatternStatuses(productId, statuses) {
    const statusFile = getPatternStatusesPath(productId);
    fs.writeFileSync(statusFile, JSON.stringify(statuses, null, 2), 'utf-8');
  }

  // Helper: Smart Anti-Adjacency Shuffle Engine
  function shuffleSmartPatterns(list) {
    if (!list || list.length <= 1) return list;
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Anti-adjacency pass: ensure consecutive items do not share starting clip if possible
    for (let i = 1; i < shuffled.length; i++) {
      const prev = shuffled[i - 1];
      const curr = shuffled[i];
      if (prev[0] === curr[0]) {
        for (let k = i + 1; k < shuffled.length; k++) {
          if (shuffled[k][0] !== prev[0]) {
            [shuffled[i], shuffled[k]] = [shuffled[k], shuffled[i]];
            break;
          }
        }
      }
    }
    return shuffled;
  }

  function getPatternOrderPath(productId) {
    return path.join(p.UGC_PRODUCTS_DIR, productId, 'pattern_order.json');
  }

  function loadPatternOrder(productId, allPermutations) {
    const orderFile = getPatternOrderPath(productId);
    const validKeys = new Set(allPermutations.map((p) => p.join('::')));
    const permMap = new Map(allPermutations.map((p) => [p.join('::'), p]));

    if (fs.existsSync(orderFile)) {
      try {
        const raw = fs.readFileSync(orderFile, 'utf-8');
        const savedKeys = JSON.parse(raw);

        // Keep saved order for valid keys, append any new keys
        const ordered = [];
        const seen = new Set();
        savedKeys.forEach((key) => {
          if (validKeys.has(key) && !seen.has(key)) {
            ordered.push(permMap.get(key));
            seen.add(key);
          }
        });

        allPermutations.forEach((p) => {
          const k = p.join('::');
          if (!seen.has(k)) {
            ordered.push(p);
            seen.add(k);
          }
        });

        return ordered;
      } catch {}
    }

    // Default: generate smart shuffled order
    const shuffled = shuffleSmartPatterns(allPermutations);
    savePatternOrder(productId, shuffled);
    return shuffled;
  }

  function savePatternOrder(productId, orderedPermutations) {
    const orderFile = getPatternOrderPath(productId);
    const keys = orderedPermutations.map((p) => p.join('::'));
    fs.writeFileSync(orderFile, JSON.stringify(keys, null, 2), 'utf-8');
  }

  // ─── Get Full Pattern List with Statuses ────────────────────────
  ipcMain.handle('ugc:get-render-patterns-list', async (_event, productId) => {
    if (!productId) return { items: [], stats: null };

    const videosFolder = path.join(p.UGC_PRODUCTS_DIR, productId, 'assets', 'videos');
    const productOutputDir = path.join(p.UGC_OUTPUT_DIR, productId);

    let rawClips = [];
    if (fs.existsSync(videosFolder)) {
      rawClips = fs.readdirSync(videosFolder).filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return ['.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(ext);
      });
    }

    const allPermutations = generate3ClipPermutations(rawClips);
    const orderedPermutations = loadPatternOrder(productId, allPermutations);
    const statuses = loadPatternStatuses(productId);

    let renderedCount = 0;
    let uploadedCount = 0;

    const items = orderedPermutations.map((pat) => {
      const key = pat.join('::');
      const st = statuses[key] || {};

      let isRendered = Boolean(st.rendered);
      let outputFileName = st.outputFileName;
      let videoUrl = null;

      // Verify file existence on disk
      if (isRendered && outputFileName) {
        const fullOutputPath = path.join(productOutputDir, outputFileName);
        if (fs.existsSync(fullOutputPath)) {
          videoUrl = media.mediaUrl(fullOutputPath);
        } else {
          isRendered = false;
        }
      }

      if (isRendered) renderedCount++;
      if (st.uploaded) uploadedCount++;

      return {
        patternKey: key,
        pattern: pat,
        rendered: isRendered,
        uploaded: Boolean(st.uploaded),
        outputFileName: outputFileName || null,
        videoUrl,
        renderedAt: st.renderedAt || null,
        uploadedAt: st.uploadedAt || null,
      };
    });

    const rawClipUrls = {};
    rawClips.forEach((file) => {
      const fullPath = path.join(videosFolder, file);
      rawClipUrls[file] = media.mediaUrl(fullPath);
    });

    const remainingCount = allPermutations.length - renderedCount;

    return {
      productId,
      items,
      rawClipUrls,
      stats: {
        totalRawClips: rawClips.length,
        totalPossiblePatterns: allPermutations.length,
        renderedCount,
        uploadedCount,
        remainingCount,
      },
    };
  });

  // ─── Reshuffle Pattern Order ───────────────────────────────────
  ipcMain.handle('ugc:shuffle-render-patterns', async (_event, productId) => {
    if (!productId) return false;
    const videosFolder = path.join(p.UGC_PRODUCTS_DIR, productId, 'assets', 'videos');
    let rawClips = [];
    if (fs.existsSync(videosFolder)) {
      rawClips = fs.readdirSync(videosFolder).filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return ['.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(ext);
      });
    }

    const allPermutations = generate3ClipPermutations(rawClips);
    const shuffled = shuffleSmartPatterns(allPermutations);
    savePatternOrder(productId, shuffled);
    return true;
  });

  // ─── Get Pattern Stats for Active Product ──────────────────────
  ipcMain.handle('ugc:get-render-patterns-stats', async (_event, productId) => {
    if (!productId) return null;

    const videosFolder = path.join(p.UGC_PRODUCTS_DIR, productId, 'assets', 'videos');
    let rawClips = [];
    if (fs.existsSync(videosFolder)) {
      rawClips = fs.readdirSync(videosFolder).filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return ['.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(ext);
      });
    }

    const allPermutations = generate3ClipPermutations(rawClips);
    const statuses = loadPatternStatuses(productId);

    let renderedCount = 0;
    let uploadedCount = 0;

    allPermutations.forEach((pat) => {
      const key = pat.join('::');
      const st = statuses[key];
      if (st && st.rendered) renderedCount++;
      if (st && st.uploaded) uploadedCount++;
    });

    const remainingCount = allPermutations.length - renderedCount;

    return {
      productId,
      totalRawClips: rawClips.length,
      totalPossiblePatterns: allPermutations.length,
      renderedCount,
      uploadedCount,
      remainingCount,
    };
  });

  // Helper: Probe Video Duration using ffprobe
  function getVideoDurationSync(filePath) {
    try {
      const { ffprobePath } = require('../shared/ffmpeg.cjs');
      const { execFileSync } = require('child_process');
      const out = execFileSync(
        ffprobePath,
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
        { encoding: 'utf-8' }
      );
      const dur = parseFloat(out.trim());
      return isNaN(dur) || dur <= 0 ? 10 : dur;
    } catch (err) {
      console.error('Failed to probe duration for', filePath, err);
      return 10;
    }
  }

  // ─── Render 3-Clip Pattern Video via FFmpeg ─────────────────────
  ipcMain.handle('ugc:render-pattern', async (event, { productId, pattern, patternIndex, transitionStyle }) => {
    if (!productId) throw new Error('Product ID is required');

    const videosFolder = path.join(p.UGC_PRODUCTS_DIR, productId, 'assets', 'videos');
    const productOutputDir = path.join(p.UGC_OUTPUT_DIR, productId);

    if (!fs.existsSync(productOutputDir)) {
      fs.mkdirSync(productOutputDir, { recursive: true });
    }

    let targetPattern = pattern;
    const statuses = loadPatternStatuses(productId);

    // If pattern not provided, pick first unrendered pattern automatically
    if (!targetPattern || targetPattern.length !== 3) {
      let rawClips = [];
      if (fs.existsSync(videosFolder)) {
        rawClips = fs.readdirSync(videosFolder).filter((f) => {
          const ext = path.extname(f).toLowerCase();
          return ['.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(ext);
        });
      }
      const allPermutations = generate3ClipPermutations(rawClips);
      const unrendered = allPermutations.filter((p) => {
        const key = p.join('::');
        return !statuses[key] || !statuses[key].rendered;
      });

      if (unrendered.length === 0) {
        throw new Error('Semua pola kombinasi 3-clip sudah pernah di-render untuk produk ini!');
      }

      targetPattern = unrendered[0];
    }

    // Verify all 3 video files exist
    const inputPaths = targetPattern.map((fileName) => path.join(videosFolder, fileName));
    for (const ip of inputPaths) {
      if (!fs.existsSync(ip)) {
        throw new Error(`File video asset '${path.basename(ip)}' tidak ditemukan.`);
      }
    }

    const timestamp = Date.now();
    const idxTag = patternIndex || 1;
    const outputFileName = `video_${idxTag}_${timestamp}.mp4`;
    const outputPath = path.join(productOutputDir, outputFileName);

    const { spawn } = require('child_process');
    const { ffmpegPath } = require('../shared/ffmpeg.cjs');

    // Determine transition type (Default: radian_glow)
    const mode = transitionStyle || 'radian_glow';

    return new Promise((resolve, reject) => {
      if (event.sender && !event.sender.isDestroyed()) {
        event.sender.send('ugc:render-progress', { productId, stage: 'start', progress: 10 });
      }

      let args = [];
      let concatListFile = null;

      if (mode === 'none') {
        // Fast Concat without transitions
        concatListFile = path.join(p.TMP_DIR, `concat_${timestamp}.txt`);
        const concatContent = inputPaths.map((fp) => `file '${fp.replace(/'/g, "'\\''")}'`).join('\n');
        fs.writeFileSync(concatListFile, concatContent, 'utf-8');

        args = [
          '-f', 'concat',
          '-safe', '0',
          '-i', concatListFile,
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'ultrafast',
          '-y',
          outputPath,
        ];
      } else {
        // CapCut Radian Glow / Dissolve Xfade Filtergraph
        const dur1 = getVideoDurationSync(inputPaths[0]);
        const dur2 = getVideoDurationSync(inputPaths[1]);

        const transDur = 0.4;
        const offset1 = Math.max(0.1, dur1 - transDur);
        const offset2 = Math.max(0.2, offset1 + dur2 - transDur);

        // xfade transition method: 'fadewhite' for Radian Glow, 'fade' for Dissolve
        const xfadeMethod = mode === 'dissolve' ? 'fade' : 'fadewhite';

        const filtergraph =
          `[0:v][1:v]xfade=transition=${xfadeMethod}:duration=${transDur}:offset=${offset1.toFixed(3)}[v01];` +
          `[v01][2:v]xfade=transition=${xfadeMethod}:duration=${transDur}:offset=${offset2.toFixed(3)}[vout];` +
          `[0:a][1:a]acrossfade=d=${transDur}[a01];` +
          `[a01][2:a]acrossfade=d=${transDur}[aout]`;

        args = [
          '-i', inputPaths[0],
          '-i', inputPaths[1],
          '-i', inputPaths[2],
          '-filter_complex', filtergraph,
          '-map', '[vout]',
          '-map', '[aout]',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-c:a', 'aac',
          '-y',
          outputPath,
        ];
      }

      const ffmpegProc = spawn(ffmpegPath, args);

      ffmpegProc.stderr.on('data', () => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('ugc:render-progress', { productId, stage: 'rendering', progress: 50 });
        }
      });

      ffmpegProc.on('close', (code) => {
        if (concatListFile && fs.existsSync(concatListFile)) {
          fs.unlinkSync(concatListFile);
        }

        if (code !== 0) {
          return reject(new Error(`FFmpeg exited with error code ${code}`));
        }

        // Save status in pattern_statuses.json
        const patternKey = targetPattern.join('::');
        statuses[patternKey] = {
          pattern: targetPattern,
          rendered: true,
          uploaded: statuses[patternKey]?.uploaded || false,
          outputFileName,
          renderedAt: new Date().toISOString(),
          uploadedAt: statuses[patternKey]?.uploadedAt || null,
        };
        savePatternStatuses(productId, statuses);

        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('ugc:render-progress', { productId, stage: 'done', progress: 100 });
        }

        const stat = fs.statSync(outputPath);
        resolve({
          id: outputFileName,
          name: outputFileName,
          fileName: outputFileName,
          size: stat.size,
          pattern: targetPattern,
          filePath: outputPath,
          url: media.mediaUrl(outputPath),
          createdAt: new Date().toISOString(),
        });
      });
    });
  });

  // ─── Toggle Upload Status for Pattern ──────────────────────────
  ipcMain.handle('ugc:toggle-upload-status', async (_event, { productId, patternKey, uploaded }) => {
    if (!productId || !patternKey) return false;
    const statuses = loadPatternStatuses(productId);

    if (!statuses[patternKey]) {
      const parts = patternKey.split('::');
      statuses[patternKey] = { pattern: parts, rendered: false, uploaded: false };
    }

    statuses[patternKey].uploaded = uploaded;
    statuses[patternKey].uploadedAt = uploaded ? new Date().toISOString() : null;

    savePatternStatuses(productId, statuses);
    return true;
  });

  // ─── Delete Render Pattern (Removes output video & resets status) ─
  ipcMain.handle('ugc:delete-render-pattern', async (_event, { productId, patternKey }) => {
    if (!productId || !patternKey) return false;
    const statuses = loadPatternStatuses(productId);
    const item = statuses[patternKey];

    if (item && item.outputFileName) {
      const fullPath = path.join(p.UGC_OUTPUT_DIR, productId, item.outputFileName);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    if (statuses[patternKey]) {
      statuses[patternKey].rendered = false;
      // Preserve uploaded status & uploadedAt timestamp!
      statuses[patternKey].outputFileName = null;
    }

    savePatternStatuses(productId, statuses);
    return true;
  });

  // ─── List Rendered Outputs ─────────────────────────────────────
  ipcMain.handle('ugc:list-renders', async (_event, productId) => {
    if (!productId) return [];
    const productOutputDir = path.join(p.UGC_OUTPUT_DIR, productId);

    if (!fs.existsSync(productOutputDir)) return [];

    const files = fs.readdirSync(productOutputDir);
    const renders = [];

    for (const file of files) {
      const fullPath = path.join(productOutputDir, file);
      if (fs.statSync(fullPath).isFile() && file.endsWith('.mp4')) {
        const stat = fs.statSync(fullPath);
        renders.push({
          id: file,
          name: file,
          fileName: file,
          size: stat.size,
          filePath: fullPath,
          url: media.mediaUrl(fullPath),
          createdAt: stat.birthtime.toISOString(),
        });
      }
    }

    return renders;
  });

  // ─── Delete Rendered Output ────────────────────────────────────
  ipcMain.handle('ugc:delete-render', async (_event, { productId, fileName }) => {
    if (!productId || !fileName) return false;
    const filePath = path.join(p.UGC_OUTPUT_DIR, productId, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const statuses = loadPatternStatuses(productId);
    let updated = false;
    Object.keys(statuses).forEach((key) => {
      if (statuses[key].outputFileName === fileName) {
        statuses[key].rendered = false;
        statuses[key].outputFileName = null;
        // uploaded & uploadedAt remain intact!
        updated = true;
      }
    });

    if (updated) {
      savePatternStatuses(productId, statuses);
    }

    return true;
  });
}

module.exports = { register };
