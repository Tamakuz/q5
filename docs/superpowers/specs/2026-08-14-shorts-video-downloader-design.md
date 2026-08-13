# Shorts Factory Step 2: Isolated Keyword Video Downloader Design Spec

## Executive Summary
This design specifies the implementation of **Step 2 (Factory Video Sourcing & Download)** in the YouTube Shorts Factory pipeline. 
Instead of a generic placeholder, Step 2 loads today's 4 active sub-niche keywords generated in Step 1 (`input/shorts/keywords-history.json`) into 4 isolated cards.
Each card enables the user to paste a YouTube URL corresponding to that specific keyword and automatically download high-quality MP4 video using `./bin/yt-dlp`.

---

## Data Structure & Storage

### 1. `input/shorts/video-sources.json`
Stores the mapping between keywords and downloaded video assets:
```json
{
  "date": "2026-08-14",
  "items": [
    {
      "keyword_id": "kw_1785483200_0",
      "sub_niche": "Mass Food Production",
      "keyword": "how frozen pizza is made in factory",
      "youtube_url": "https://www.youtube.com/watch?v=EXAMPLE",
      "video_filename": "mass_food_production_kw_1785483200_0.mp4",
      "video_path": "input/shorts/raw_videos/mass_food_production_kw_1785483200_0.mp4",
      "status": "downloaded",
      "downloaded_at": "2026-08-14T01:00:00.000Z",
      "file_size_bytes": 45200100
    }
  ]
}
```

### 2. Video Storage Directory
- Directory: `input/shorts/raw_videos/`
- Filename format: `{sub_niche_slug}_{keyword_id}.mp4`

---

## Electron IPC Architecture

### IPC Channel: `shorts:download-video`
- **Request Payload**: `{ keywordId: string, subNiche: string, keyword: string, youtubeUrl: string }`
- **Backend Execution**:
  1. Spawns `./bin/yt-dlp` CLI command:
     `./bin/yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "input/shorts/raw_videos/{sub_niche_slug}_{keyword_id}.mp4" "{youtubeUrl}"`
  2. Emits real-time progress events over `shorts:download-progress` channel (`{ keywordId, percentage, loadedBytes, totalBytes, speed }`).
  3. Updates `input/shorts/video-sources.json`.
- **Response**: `{ success: boolean, videoPath: string, fileSizeBytes: number, error?: string }`

---

## UI Components (`ShortsAnalyzeStep.tsx`)

### Layout & Elements
1. **Header**: Title "Step 2: Video Sourcing & Download per Keyword", displaying active date and status badge.
2. **Grid Layout**: 4 isolated cards corresponding to the 4 daily keywords.
   Each card displays:
   - Sub-Niche icon + badge (e.g. 🍕 *Mass Food Production*)
   - Target Keyword string (read from Step 1)
   - YouTube URL Input Box (`https://www.youtube.com/watch?v=...`)
   - Action Buttons:
     - **🔍 Search YouTube**: Opens YouTube search results in browser.
     - **📥 Download Video**: Triggers `yt-dlp` download via Electron IPC.
   - Live Progress bar (0% - 100%) showing download speed and loaded MBs.
   - Status indicator: `Pending Link` ➔ `Downloading` ➔ `Downloaded (45.2 MB) ✅`
   - File details & reset option once downloaded.

---

## Verification & Error Handling
- Validate YouTube URL format before spawning process.
- Handle missing `yt-dlp` binary with automatic fallback check to `./bin/yt-dlp`.
- Provide error messages in UI for dead YouTube links or private videos.
