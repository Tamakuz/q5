# Design Spec: UGC Video Downloader via URL Link

**Date:** 2026-08-03
**Status:** Approved by User

## Overview
Add URL video download capability to Step 3 (Video Assets Manager) of the UGC module. Allows users to paste video links, download them asynchronously with progress feedback, and save them strictly inside `input/ugc/products/{product_id}/assets/videos/`.

## Architecture & Data Flow

```
[User Input URL] ➔ IPC: ugc:download-video-asset ➔ HTTP Stream Downloader
                                                         │
                                                         ▼
                             Saved to: input/ugc/products/{product_id}/assets/videos/
```

## Backend IPC Handlers (`dashboard/electron/ipc/ugcHandlers.cjs`)

1. `ugc:download-video-asset`:
   - Accepts `{ productId, videoUrl }`.
   - Downloads video stream using Node.js `https`/`http`.
   - Emits progress events (`ugc:download-video-progress`) with `{ productId, progress, loadedBytes, totalBytes }`.
   - Saves file to `input/ugc/products/{productId}/assets/videos/vid_{timestamp}_{sanitizedName}.mp4`.
   - Returns created `UGCVideoAsset`.

## Frontend Integration

1. `dashboard/src/electron-api.ts`:
   - Expose `downloadUGCVideoAsset(productId, videoUrl)` and `onUGCVideoDownloadProgress(callback)`.
2. `dashboard/src/components/ugc/UGCVideoAssetsManager.tsx`:
   - Add "🔗 Import via Link Video" modal dialog.
   - Live download progress bar with percentage & MB info.
