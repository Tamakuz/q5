# Shorts Module Step 1 Video Downloader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Step 1 (Video Downloader) for the Shorts module with dynamic YouTube link cards, real-time download progress, embedded video preview player, and consistent JSON/directory path persistence.

**Architecture:** Frontend React component (`ShortsSourceStep.tsx`) coupled with Electron IPC (`shorts:download-video` & `shorts:download-progress` in `projectHandlers.cjs`). State is persisted to `input/shorts/video-sources.json` and raw MP4 files are stored in `input/shorts/raw_videos/`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Electron IPC, yt-dlp.

## Global Constraints

- Storage directory: `input/shorts/raw_videos/*.mp4`
- Manifest persistence path: `input/shorts/video-sources.json`
- Video player URL: `window.electronAPI.getMediaUrl(path)` or `media://content-auto/${encodeURIComponent(path)}`

---

### Task 1: Update Sidebar and App Routing for Shorts Step 1

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx:25`
- Modify: `dashboard/src/App.tsx:112-115`

**Interfaces:**
- Consumes: `StepId` ('source') and `ContentMode` ('shorts')
- Produces: Sidebar step item for Shorts Step 1 & active view routing in `App.tsx`

- [ ] **Step 1: Update `SHORTS_STEPS` in `Sidebar.tsx`**

Add step definition to `SHORTS_STEPS` array:
```typescript
const SHORTS_STEPS: Step[] = [
  { id: 'source', icon: '📥', label: '1. Video Downloader', subText: 'Download YouTube video source' },
];
```

- [ ] **Step 2: Update `App.tsx` to render `ShortsSourceStep` in Shorts mode**

Import `ShortsSourceStep` and render it when `contentMode === 'shorts'` and `activeStep === 'source'`:
```tsx
{contentMode === 'shorts' ? (
  activeStep === 'source' ? (
    <ShortsSourceStep key="shorts-source" />
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-gray-950/50 border border-dashed border-gray-800/60 rounded-3xl">
      <span className="text-gray-600 text-xs font-mono">Modul Shorts Kosong</span>
    </div>
  )
) : ...
```

- [ ] **Step 3: Verify build / typecheck**

Run: `npm run build -w dashboard`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/common/Sidebar.tsx dashboard/src/App.tsx
git commit -m "feat(shorts): register Shorts step 1 in Sidebar and App router"
```

---

### Task 2: Build Dynamic Video Downloader Component (`ShortsSourceStep.tsx`)

**Files:**
- Modify: `dashboard/src/components/shorts/ShortsSourceStep.tsx`

**Interfaces:**
- Consumes: `window.electronAPI.downloadShortsVideo`, `window.electronAPI.onDownloadProgress`, `window.electronAPI.readFromProject`, `window.electronAPI.saveToProject`, `window.electronAPI.getMediaUrl`
- Produces: Dynamic cards UI for YouTube video links, download triggering, progress monitoring, preview player, and JSON state persistence.

- [ ] **Step 1: Implement `ShortsSourceStep.tsx` UI & State Logic**

Rewrite `ShortsSourceStep.tsx` with:
1. `VideoItem` interface:
   ```typescript
   interface VideoItem {
     id: string;
     title: string;
     youtube_url: string;
     video_filename?: string;
     video_path?: string;
     status: 'idle' | 'downloading' | 'downloaded' | 'error';
     file_size_bytes?: number;
     downloaded_at?: string;
     error?: string;
     progressPercentage?: number;
     progressSpeed?: string;
   }
   ```
2. Dynamic card management functions:
   - `loadVideoSources()`: Loads from `input/shorts/video-sources.json`.
   - `saveVideoSources(items)`: Saves to `input/shorts/video-sources.json`.
   - `handleAddCard()`: Adds a new card with unique ID.
   - `handleDeleteCard(id)`: Removes a card and updates JSON persistence.
   - `handleDownloadVideo(id)`: Invokes `downloadShortsVideo` IPC and handles real-time progress events.
   - `handleDownloadAll()`: Iterates over pending cards and triggers download.
3. Card Rendering:
   - Input for YouTube URL & Title
   - Progress bar when downloading
   - `<video>` preview player when downloaded
   - Action buttons (Download, Re-download, Delete)

- [ ] **Step 2: Verify typecheck & dev build**

Run: `npm run build -w dashboard`
Expected: Build passes cleanly without TypeScript or React errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/shorts/ShortsSourceStep.tsx
git commit -m "feat(shorts): implement dynamic video downloader cards & preview player in ShortsSourceStep"
```

---

### Task 3: Verify & Validate End-to-End Integration

**Files:**
- None (Verification step)

- [ ] **Step 1: Test Electron Dashboard Launch**

Run: `npm run dev -w dashboard`
Expected: Vite & Electron launch clean without errors.

- [ ] **Step 2: Verify Dynamic Card Actions & Persistence**

Test adding card, removing card, and JSON update in `input/shorts/video-sources.json`.
