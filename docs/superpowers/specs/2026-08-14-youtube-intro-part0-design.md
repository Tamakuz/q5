# Technical Design Specification: YouTube Intro Part #0 for Alur Film (Step 2)

**Date**: 2026-08-14  
**Status**: Approved  
**Target Feature**: Add YouTube Video Intro (Part #0) with automated `yt-dlp` download, dedicated Script/Narration generation, and downstream pipeline integration in Alur Film workflow.

---

## 1. Overview
In the 16:9 Alur Film workspace, users need the ability to add a high-impact YouTube video intro clip at the very beginning of the recap video (Part #0), preceding the standard movie chunks (Part #1, Part #2, etc.).

This feature allows the user to paste a YouTube link in Step 2 (Script Generator), automatically download the video using `yt-dlp`, generate a dedicated Intro narration script using AI Studio/Playwright, and include Part #0 in subsequent Voice Over, Transcript, Video Mapping, and Final Render steps.

---

## 2. Architecture & Data Flow

```
[User pastes YouTube URL in Part #0 Tab]
          │
          ▼
[IPC call: alurfilm:download-intro]
          │
          ▼
[yt-dlp spawns & downloads to input/longform/raw_videos/intro_<contentId>.mp4]
          │
          ▼
[Metadata registered in chunk list as part: 0]
          │
          ▼
[User generates/imports Intro Script via Playwright / Gemini AI Studio]
          │
          ▼
[Downstream Pipeline (Step 3: VO -> Step 4: Transcript -> Step 5: Mapping -> Step 6: Render)]
```

---

## 3. Detailed Component Specifications

### 3.1 Frontend Component Updates (`AlurfilmAnalyzeStep.tsx`)
- **Part Navigation Bar**:
  - Insert a `Part #0 (Intro)` tab at the leftmost position of the parts navigation header.
  - Active part state supports `part === 0`.
- **Part #0 Download UI**:
  - Displays a YouTube URL input field when `part === 0` and video is not downloaded yet.
  - "Download Video Intro" button triggers `api.downloadAlurfilmIntro(youtubeUrl, contentId)`.
  - Progress bar displays real-time download percentage, file size, and speed from `yt-dlp`.
  - Video preview player displays the downloaded video from `input/longform/raw_videos/intro_<contentId>.mp4`.
- **Script Analysis for Part #0**:
  - "Auto Generate via Playwright" and "Copy Prompt" handle Part #0 with an Intro Pembuka prompt context (~100-200 words hook script).
  - Validation & save IPC `saveAlurfilmAnalysis` accepts `part: 0`.

### 3.2 IPC Handlers & Preload Bridge (`projectHandlers.cjs`, `preload.cjs`, `electron-api.d.ts`)
- **IPC Event `alurfilm:download-intro`**:
  - Args: `{ youtubeUrl: string, contentId: string }`.
  - Executable: `bin/yt-dlp`.
  - Arguments: `['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4', '-o', outputPath, '--newline', youtubeUrl]`.
  - Output path: `input/longform/raw_videos/intro_<contentId>.mp4`.
  - Emits: `alurfilm:download-intro-progress` with `{ percentage, totalSize, speed }`.
- **Preload API**:
  - `downloadAlurfilmIntro: (url: string, contentId: string) => Promise<{ success: boolean, videoPath?: string, error?: string }>`
  - `onAlurfilmIntroProgress: (callback: (data: any) => void) => () => void`

### 3.3 Prompting & Validation (`script-parser.ts`, `scriptValidation.ts`)
- `validateScriptAnalysis`: Allow `part === 0` for chunk validation.
- `getAlurfilmPrompt`: Support `chunkPart === 0` to format an Intro Hook prompt focused on extreme action underdog hook narration.

---

## 4. Verification Plan
1. Launch Electron Dashboard (`npm run dev -w dashboard`).
2. Navigate to Step 2 (Script Generator) under 16:9 Alur Film.
3. Select `Part #0 (Intro)` tab.
4. Input a YouTube URL and click "Download Video Intro".
5. Verify `yt-dlp` download progress bar updates smoothly.
6. Verify video preview player loads the downloaded video.
7. Verify "Copy Prompt" & "Auto Generate via Playwright" work for Part #0 script narration.
