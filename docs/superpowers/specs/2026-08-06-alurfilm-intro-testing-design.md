# Design Specification: Alur Film Intro Studio & Testing Lab

## Overview
This document specifies the architecture, UI design, audio sync, rendering engine, and test framework for the **Alur Film Intro Studio** and **Testing Lab** within the Content Auto Dashboard.

The feature enables creating and previewing cinematic movie recap intros with synced soundtrack audio (`assets/The Final Horizon.mp3`) and rendering them into 1080p MP4 videos.

---

## 1. UI Navigation Architecture

### 1.1 Film Mode Sidebar Split
Inside the **Film Mode (Alur Cerita Film 16:9)** category, a section toggle allows switching between:
- **📋 Main Workflow**: Splitter, Script Generator, Voice Over, Transcript, Video Mapping, Video Render, Metadata Hub.
- **🧪 Testing Lab**: Dedicated experimental testing ground for upcoming Alur Film features.

### 1.2 Testing Lab Sub-Tab Structure
When `🧪 Testing Lab` is selected in Film Mode, the main content area renders the **Alur Film Testing Lab** with sub-tabs:
1. `🎬 Intro Studio` (Active Test Feature)
2. `🔮 Feature Test 2` (Placeholder slot for future experimental features)

---

## 2. Intro Studio Component & Feature Design

### 2.1 Configuration Controls
- **Main Title Text**: String (Default: `"UNDER THE DOME"`).
- **Subtitle Text**: String (Default: `"FILM 2013"` or `"ALUR CERITA FILM"`).
- **Audio Track**: File path relative to project root (Default: `"assets/The Final Horizon.mp3"`).
- **Beat Impact Timestamp**: Number in seconds (Default: `0.48s`).
- **Total Duration**: Number in seconds (Default: `6.0s`).
- **Visual Style Presets**:
  - `Cinematic Gold` (Gold `#E5B83A` title font, white tracked subtitle, black background).
  - `Silver Epic` (Metallic silver gradient, subtle glow).
  - `Neon Thriller` (Crimson / Deep blue glow outline).
- **Animation Speed & Scale**: Scale-in impact factor (1.0x to 1.3x) with smooth decay.

### 2.2 Dual Preview Modes
1. **Interactive Web Live Preview**:
   - Audio playback sync via HTML5 `<audio>`.
   - Real-time CSS keyframe animation / SVG Canvas synced to playback time.
   - Play, Pause, Replay, and Seeking controls with timestamp scrubber.
2. **FFmpeg Render Test & Native Player**:
   - `🎬 Render Test Video` button triggers background FFmpeg video generation via Electron IPC.
   - Progress indicator (0% -> 100%).
   - Displays output MP4 in an embedded HTML5 video player with download / open folder option.

---

## 3. Backend Engine & FFmpeg Implementation

### 3.1 IPC Channel Contract (`electron/ipc/alurfilmHandlers.cjs`)
New IPC handlers added:
- `alurfilm:render-intro-test`: Accepts `{ titleText, subtitleText, audioPath, impactTime, duration, stylePreset }`. Returns `{ success: boolean, outputPath: string, error?: string }`.
- `alurfilm:get-intro-config`: Fetches stored test settings or returns defaults.

### 3.2 FFmpeg Video Generator (`lib/alurfilm/intro-renderer.ts` or helper script)
- Creates temporary styled canvas frame image / transparent PNGs using HTML Canvas / Node Canvas or FFmpeg `drawtext` filters.
- Applies text styling:
  - Font: `Cinzel` / `Bebas Neue` / `Montserrat`.
  - Color: `#E5B83A` (Cinematic Gold).
  - Tracking/Letter-spacing for subtitle (`FILM 2013`).
- Applies video filter effects:
  - Black background `color=c=black:s=1920x1080:d=6.0:r=60`.
  - Text scale / fade animation filter starting at `t=0.48s`.
  - Muxes audio from `assets/The Final Horizon.mp3`.
- Output path: `output/testing/intro_test.mp4`.

---

## 4. Future Integration into Alur Film Render Pipeline

When the intro testing is validated, the render pipeline in `render-alurfilm.ts` can concatenate `intro_test.mp4` at the very beginning of the full movie recap using FFmpeg concat protocol:
```bash
ffmpeg -f concat -safe 0 -i concat_list.txt -c copy output/final_alurfilm.mp4
```

---

## 5. Verification Plan

### 5.1 Automated / Build Verification
- Verify TypeScript compilation across dashboard (`npm run build -w dashboard` or typecheck).
- Verify Electron IPC handler registration without errors.

### 5.2 Manual Verification
- Launch dashboard via Electron (`npm run dev`).
- Switch to **Film** category -> click **🧪 Testing Lab** tab.
- Test interactive HTML5 preview with `assets/The Final Horizon.mp3` playing audio & title animating at 0.48s.
- Click `Render Test Video`, verify output video file generated in `output/testing/intro_test.mp4` and playback in UI player.
