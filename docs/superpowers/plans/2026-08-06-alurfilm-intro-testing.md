# Alur Film Intro Studio & Testing Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Alur Film Intro Studio and Testing Lab inside the Dashboard UI under Film mode, including interactive HTML5 live preview, FFmpeg MP4 intro video rendering engine, audio beat synchronization with `assets/The Final Horizon.mp3`, and Electron IPC integration.

**Architecture:** A modular intro renderer in `lib/alurfilm/intro-engine.ts` uses FFmpeg to generate 1080p intro MP4 videos. Electron IPC handler `alurfilm:render-intro-test` handles render requests from the frontend UI. The Dashboard Sidebar in Film mode supports switching between Main Workflow and Testing Lab, which hosts the Intro Test component.

**Tech Stack:** TypeScript, React, Vite, Tailwind CSS, Electron IPC, FFmpeg, HTML5 Web Audio API.

---

### Task 1: Backend Intro Generator Engine & Electron IPC Handler

**Files:**
- Create: `lib/alurfilm/intro-engine.ts`
- Modify: `dashboard/electron/ipc/alurfilmHandlers.cjs`
- Modify: `dashboard/src/electron-api.ts`

**Interfaces:**
- Consumes: Audio file path (`assets/The Final Horizon.mp3`), title string, subtitle string, beat impact time (number).
- Produces: `renderIntroVideo(options)` function returning `{ success: boolean, outputPath: string }`, IPC method `window.electronAPI.renderAlurfilmIntroTest(config)`.

- [ ] **Step 1: Create `lib/alurfilm/intro-engine.ts` for FFmpeg rendering**

```typescript
// lib/alurfilm/intro-engine.ts
import path from 'path';
import fs from 'fs';
import { runFFmpegProgress } from '../../cli/shared/ffmpeg-helpers.js';

export interface IntroRenderOptions {
  titleText: string;
  subtitleText: string;
  audioPath?: string;
  impactTimestamp?: number;
  duration?: number;
  stylePreset?: 'cinematic_gold' | 'silver_epic' | 'neon_thriller';
  outputPath?: string;
}

export async function renderIntroVideo(
  options: IntroRenderOptions,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; outputPath: string; error?: string }> {
  const {
    titleText = 'UNDER THE DOME',
    subtitleText = 'FILM 2013',
    audioPath = 'assets/The Final Horizon.mp3',
    impactTimestamp = 0.48,
    duration = 6.0,
    stylePreset = 'cinematic_gold',
    outputPath = 'output/testing/intro_test.mp4',
  } = options;

  const resolvedAudio = path.resolve(process.cwd(), audioPath);
  const resolvedOutput = path.resolve(process.cwd(), outputPath);

  const outDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Define styling based on preset
  let titleColor = '0xE5B83A'; // Gold
  let subtitleColor = '0xFFFFFF'; // White

  if (stylePreset === 'silver_epic') {
    titleColor = '0xE2E8F0';
    subtitleColor = '0x94A3B8';
  } else if (stylePreset === 'neon_thriller') {
    titleColor = '0xEF4444';
    subtitleColor = '0x38BDF8';
  }

  const cleanTitle = titleText.replace(/'/g, "\\'").replace(/:/g, '\\:');
  const cleanSubtitle = subtitleText.replace(/'/g, "\\'").replace(/:/g, '\\:');

  // FFmpeg filter complex:
  // Black background 1920x1080 -> drawtext title with scale/fade -> drawtext subtitle -> audio mux
  const filterComplex = [
    `color=c=black:s=1920x1080:d=${duration}:r=60[bg]`,
    `[bg]drawtext=font='Cinzel':text='${cleanTitle}':fontcolor=${titleColor}:fontsize=90:x=(w-text_w)/2:y=(h-text_h)/2-30:enable='between(t,${impactTimestamp},${duration})':alpha='if(lt(t,${impactTimestamp}),0,if(lt(t,${impactTimestamp + 0.3}),(t-${impactTimestamp})/0.3,if(gt(t,${duration - 1.0}),(${duration}-t)/1.0,1)))'[v1]`,
    `[v1]drawtext=font='Montserrat':text='${cleanSubtitle}':fontcolor=${subtitleColor}:fontsize=32:x=(w-text_w)/2:y=(h-text_h)/2+65:enable='between(t,${impactTimestamp + 0.1},${duration})':alpha='if(lt(t,${impactTimestamp + 0.1}),0,if(lt(t,${impactTimestamp + 0.4}),(t-${impactTimestamp}-0.1)/0.3,if(gt(t,${duration - 1.0}),(${duration}-t)/1.0,1)))'[vfinal]`
  ].join(';');

  const ffmpegArgs = [
    '-y',
    '-f', 'lavfi', '-i', `color=c=black:s=1920x1080:d=${duration}:r=60`,
    '-i', resolvedAudio,
    '-filter_complex', filterComplex,
    '-map', '[vfinal]',
    '-map', '1:a',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    resolvedOutput
  ];

  try {
    await runFFmpegProgress(ffmpegArgs, (progress) => {
      if (onProgress && progress.percent) {
        onProgress(Math.min(100, Math.max(0, Math.round(progress.percent))));
      }
    });

    return { success: true, outputPath: resolvedOutput };
  } catch (err: any) {
    console.error('❌ Intro render error:', err);
    return { success: false, outputPath: resolvedOutput, error: err.message };
  }
}
```

- [ ] **Step 2: Add IPC handler in `dashboard/electron/ipc/alurfilmHandlers.cjs`**

Add handler `alurfilm:render-intro-test` in `alurfilmHandlers.cjs`:
```javascript
ipcMain.handle('alurfilm:render-intro-test', async (_event, options) => {
  try {
    const { renderIntroVideo } = await import('../../../lib/alurfilm/intro-engine.js');
    const result = await renderIntroVideo(options, (percent) => {
      _event.sender.send('alurfilm:render-intro-progress', { percent });
    });
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

- [ ] **Step 3: Update `electron-api.ts` type declarations**

In `dashboard/src/electron-api.ts`:
Add `renderAlurfilmIntroTest` and `onAlurfilmIntroProgress` to `ElectronAPI` interface and implementation object.

---

### Task 2: Sidebar Navigation Update for Film Mode

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx`
- Modify: `dashboard/src/App.tsx`

**Interfaces:**
- Produces: Sidebar sub-tab toggle (`Main Workflow` vs `Testing Lab`) when `contentMode === 'longform'`.

- [ ] **Step 1: Add mode sub-tab toggle in `Sidebar.tsx`**

In `Sidebar.tsx`:
Add props `longformTab?: 'main' | 'testing'` and `onLongformTabChange?: (tab: 'main' | 'testing') => void`.
When `contentMode === 'longform'`, render a sleek segmented control button at top of workflow steps:
- `📋 Main Workflow`
- `🧪 Testing Lab`

- [ ] **Step 2: Connect state in `App.tsx`**

In `App.tsx`:
Add state `const [longformTab, setLongformTab] = useState<'main' | 'testing'>('main');`.
Pass `longformTab` and `onLongformTabChange` to `Sidebar`.
When `contentMode === 'longform'` and `longformTab === 'testing'`, render `<AlurfilmTestingHub />` component in the main area.

---

### Task 3: Intro Testing Studio Component & Dual Preview UI

**Files:**
- Create: `dashboard/src/components/longform/testing/AlurfilmIntroTestStep.tsx`
- Create: `dashboard/src/components/longform/testing/AlurfilmTestingHub.tsx`

**Interfaces:**
- Consumes: `window.electronAPI.renderAlurfilmIntroTest`.
- Produces: Testing Hub view with Intro Studio live preview & video render test player.

- [ ] **Step 1: Build `AlurfilmIntroTestStep.tsx`**

Create `AlurfilmIntroTestStep.tsx` with:
1. **Config Form**:
   - Title Input (`UNDER THE DOME`)
   - Subtitle Input (`FILM 2013`)
   - Audio Track Path (Default `assets/The Final Horizon.mp3`)
   - Beat Timestamp Slider (0.0s to 2.0s, default 0.48s)
   - Duration Selector (5s - 8s)
   - Visual Style Preset (Cinematic Gold, Silver Epic, Neon Thriller)
2. **Interactive Web Live Preview**:
   - HTML5 `<audio>` element loading local audio.
   - Simulated 16:9 cinematic screen box.
   - Text title animated with CSS transitions synced to `currentTime` of audio.
   - Play/Pause & Scrubber controls.
3. **Render Test & Video Result**:
   - Button `🎬 Render Video Test (FFmpeg)`.
   - Real-time progress bar.
   - Output HTML5 `<video>` player displaying rendered `output/testing/intro_test.mp4`.

- [ ] **Step 2: Build `AlurfilmTestingHub.tsx`**

Create `AlurfilmTestingHub.tsx`:
Top sub-tabs:
- `🎬 Intro Studio Test`
- `🔮 Future Test Slot`
Renders `<AlurfilmIntroTestStep />` when Intro tab is active.

---

### Task 4: Verification & Integration Test

- [ ] **Step 1: Test TypeScript build**
Run `npm run build` or typecheck to verify all frontend and IPC code compiles cleanly.

- [ ] **Step 2: Verify Runtime in Dashboard**
Run Electron dashboard (`npm run dev`), select `Film` category -> `Testing Lab` tab -> test live audio preview & FFmpeg video render.
