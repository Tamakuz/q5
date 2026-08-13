# Shorts Factory Step 2 Isolated Video Downloader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Step 2 in Shorts Factory pipeline to display 4 isolated keyword cards, allow pasting YouTube URLs per keyword, and download videos via `./bin/yt-dlp` with real-time progress.

**Architecture:** Add IPC channel `shorts:download-video` and progress event listener in Electron main process (`dashboard/electron/ipc/projectHandlers.cjs`). Update `preload.cjs` and `electron-api.ts` definitions. Build `ShortsAnalyzeStep.tsx` UI displaying 4 keyword cards from `input/shorts/keywords-history.json` and storing results in `input/shorts/video-sources.json`.

**Tech Stack:** React, TypeScript, Electron IPC, `./bin/yt-dlp`, Node.js `child_process.spawn`.

## Global Constraints
- Target 4 Shorts / day isolated by sub-niche & keyword.
- Execute standalone `./bin/yt-dlp` binary.
- Persist video source metadata in `input/shorts/video-sources.json`.

---

### Task 1: Electron IPC Handler for `yt-dlp` Video Downloader

**Files:**
- Modify: `dashboard/electron/ipc/projectHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`
- Modify: `dashboard/src/electron-api.ts`

**Interfaces:**
- Consumes: `./bin/yt-dlp` executable path, `input/shorts/keywords-history.json`
- Produces: `window.electronAPI.downloadShortsVideo({ keywordId, subNiche, keyword, youtubeUrl })`

- [ ] **Step 1: Implement IPC Handler in `projectHandlers.cjs`**

Add `shorts:download-video` handler using `child_process.spawn` to execute `./bin/yt-dlp` and parse progress output.

```javascript
// In projectHandlers.cjs
ipcMain.handle('shorts:download-video', async (event, { keywordId, subNiche, keyword, youtubeUrl }) => {
  const ytDlpPath = path.resolve(__dirname, '../../../bin/yt-dlp');
  const outputDir = path.resolve(__dirname, '../../../input/shorts/raw_videos');
  await fs.mkdir(outputDir, { recursive: true });

  const safeSlug = (subNiche || 'short').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const outputFilename = `${safeSlug}_${keywordId}.mp4`;
  const outputPath = path.join(outputDir, outputFilename);

  return new Promise((resolve) => {
    const args = [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '-o', outputPath,
      '--newline',
      youtubeUrl
    ];

    const child = spawn(ytDlpPath, args);
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      // Match yt-dlp progress: [download]  45.2% of  12.34MiB at  2.10MiB/s ETA 00:05
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

    child.on('close', async (code) => {
      if (code === 0) {
        let stats = { size: 0 };
        try { stats = await fs.stat(outputPath); } catch {}
        
        // Save metadata to input/shorts/video-sources.json
        const sourcesPath = path.resolve(__dirname, '../../../input/shorts/video-sources.json');
        let sourcesData = { items: [] };
        try {
          const raw = await fs.readFile(sourcesPath, 'utf8');
          sourcesData = JSON.parse(raw);
        } catch {}

        const now = new Date().toISOString();
        const existingIdx = (sourcesData.items || []).findIndex(i => i.keyword_id === keywordId);
        const newItem = {
          keyword_id: keywordId,
          sub_niche: subNiche,
          keyword,
          youtube_url: youtubeUrl,
          video_filename: outputFilename,
          video_path: `input/shorts/raw_videos/${outputFilename}`,
          status: 'downloaded',
          downloaded_at: now,
          file_size_bytes: stats.size
        };

        if (existingIdx >= 0) {
          sourcesData.items[existingIdx] = newItem;
        } else {
          sourcesData.items = [newItem, ...(sourcesData.items || [])];
        }

        await fs.writeFile(sourcesPath, JSON.stringify(sourcesData, null, 2), 'utf8');

        resolve({ success: true, videoPath: `input/shorts/raw_videos/${outputFilename}`, fileSizeBytes: stats.size });
      } else {
        resolve({ success: false, error: errorOutput || `yt-dlp exited with code ${code}` });
      }
    });
  });
});
```

- [ ] **Step 2: Expose IPC in `preload.cjs`**

Add bridge functions:
```javascript
downloadShortsVideo: (data) => ipcRenderer.invoke('shorts:download-video', data),
onShortsDownloadProgress: (handler) => {
  ipcRenderer.on('shorts:download-progress', handler);
  return () => ipcRenderer.removeListener('shorts:download-progress', handler);
}
```

- [ ] **Step 3: Update `electron-api.ts` definitions**

```typescript
export interface ShortsVideoSource {
  keyword_id: string;
  sub_niche: string;
  keyword: string;
  youtube_url: string;
  video_filename: string;
  video_path: string;
  status: 'downloaded' | 'failed' | 'pending';
  downloaded_at: string;
  file_size_bytes: number;
}

// In ElectronAPI interface:
downloadShortsVideo?: (data: { keywordId: string; subNiche: string; keyword: string; youtubeUrl: string }) => Promise<{ success: boolean; videoPath?: string; error?: string }>;
onShortsDownloadProgress?: (handler: (event: any, data: { keywordId: string; percentage: number; totalSize: string; speed: string }) => void) => () => void;
```

- [ ] **Step 4: Commit Task 1**

```bash
git add dashboard/electron/ipc/projectHandlers.cjs dashboard/electron/preload.cjs dashboard/src/electron-api.ts
git commit -m "feat(shorts): add Electron IPC handler for yt-dlp video downloading"
```

---

### Task 2: Build Step 2 UI Component (`ShortsAnalyzeStep.tsx`)

**Files:**
- Modify: `dashboard/src/components/shorts/ShortsAnalyzeStep.tsx`

**Interfaces:**
- Consumes: `input/shorts/keywords-history.json`, `input/shorts/video-sources.json`, `window.electronAPI.downloadShortsVideo`
- Produces: 4 Card isolated YouTube Video Downloader UI

- [ ] **Step 1: Implement 4 Card UI in `ShortsAnalyzeStep.tsx`**

Implement complete Step 2 UI:
1. Load active keywords from `input/shorts/keywords-history.json`.
2. Load downloaded video statuses from `input/shorts/video-sources.json`.
3. Render 4 isolated cards for sub-niches:
   - Mass Food Production
   - Industrial Manufacturing
   - Master Crafting & Rare Processing
   - Woodworking & Resin Crafting
4. Provide per-card input for YouTube Link, **🔍 Search YouTube**, **📥 Download Video** button, live progress bar, and downloaded status badge.

- [ ] **Step 2: Verify TypeScript Compilation**

Run: `npm run build -w dashboard`
Expected: Clean build without TypeScript errors.

- [ ] **Step 3: Commit Task 2**

```bash
git add dashboard/src/components/shorts/ShortsAnalyzeStep.tsx
git commit -m "feat(shorts): implement Step 2 isolated 4-card video downloader component"
```
