# Alur Film Mandatory Intro First & Intro Preview Section Design

## Overview
Automate mandatory cinematic Intro video rendering prior to partial part renders in Alur Film (16:9), and provide a dedicated **Intro Studio & Preview Section** directly on the `AlurfilmRenderStep` UI page.

## Key Requirements
1. **Intro Studio & Preview Card**:
   - Situated prominently at the top of the `AlurfilmRenderStep` component.
   - Allows users to preview their Intro Title and Subtitle settings.
   - Includes an explicit **"⚡ Render Intro Video"** trigger.
   - Features a video player component to preview the generated intro MP4 immediately upon completion.
2. **Mandatory Intro-First Pipeline Enforcement**:
   - When a user clicks **"Render Part #X"** or **"Render All Parts"**:
   - The render pipeline automatically checks if an Intro video has been rendered for the current content session.
   - If not rendered yet (and `introEnabled` is true), the system automatically executes the Intro rendering step first, logs the progress in the Live Terminal, and only then proceeds with rendering the requested partial part(s).

## Technical Architecture

### 1. IPC & Backend (`renderHandlers.cjs` & `electron-api.ts`)
- Expose IPC channel `render-alurfilm-intro` which calls `renderIntroVideoHelper(settings, projectRoot)`.
- Save generated intro video in `output/alurfilm_<contentId>_intro.mp4`.
- Expose helper `getAlurfilmIntroPath(contentId)` to check if intro file exists on disk.

### 2. Frontend (`AlurfilmRenderStep.tsx`)
- Maintain state `introResult` (`{ outputPath?: string; mediaUrl?: string; rendering: boolean }`).
- Include Intro Preview card component at the top of the layout.
- Enhance `handleRenderPart(partNum)` with pre-flight check:
  ```ts
  if (settings.introEnabled !== false && !introResult?.outputPath) {
    addLog('[STEP 0] 🎬 Auto-rendering mandatory Intro Video first...', 'step');
    await handleRenderIntro();
  }
  ```

## UI Design
- Dark, sleek 16:9 card with amber/purple gradient accents.
- Embedded video preview with HTML5 `<video>` player when `introResult.outputPath` is available.
- Status badges: `[STATUS: READY]` or `[STATUS: NOT RENDERED YET]`.
