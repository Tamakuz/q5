# Alurfilm Video Split Smart Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement integrated split and smart compression for Alurfilm longform video chunks so that every split chunk is compressed with high visual quality (`CRF 20`) to `input/alurfilm/compress/` and strictly kept below 400 MB.

**Architecture:** Extend Electron IPC alurfilm handlers to calculate dynamic FFmpeg bitrate caps based on chunk duration and a 380 MB target budget. Direct output files to `input/alurfilm/compress/` and update metadata across the pipeline.

**Tech Stack:** Electron (Node.js CJS IPC handlers), FFmpeg CLI spawn (`libx264`, `aac`), React / TypeScript (Alurfilm UI steps).

## Global Constraints
- Video chunk target size: Max 400 MB (safety limit 380 MB in bitrate formula).
- Output directory: `PROJECT_ROOT/input/alurfilm/compress`.
- Quality: `CRF 20`, `-preset medium` (fallback to `-preset faster`).

---

### Task 1: Path Registration for Compression Directory

**Files:**
- Modify: `dashboard/electron/shared/paths.cjs:13-35`

**Interfaces:**
- Consumes: `PROJECT_ROOT`
- Produces: `ALURFILM_COMPRESS_DIR` (`PROJECT_ROOT/input/alurfilm/compress`)

- [ ] **Step 1: Check existing path declarations**

Inspect `dashboard/electron/shared/paths.cjs` around line 14 to verify `ALURFILM_CHUNKS_DIR` definition.

- [ ] **Step 2: Add `ALURFILM_COMPRESS_DIR` definition and directory auto-creation**

In `dashboard/electron/shared/paths.cjs`:
```javascript
const ALURFILM_COMPRESS_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'compress');
```
Add `ALURFILM_COMPRESS_DIR` to the directory initialization array and exports list.

- [ ] **Step 3: Verify directory creation script**

Run node command to verify paths exports:
```bash
node -e "const p = require('./dashboard/electron/shared/paths.cjs'); console.log(p.ALURFILM_COMPRESS_DIR);"
```
Expected output: `/home/jovan/project/content-auto/input/alurfilm/compress`

- [ ] **Step 4: Commit**

```bash
git add dashboard/electron/shared/paths.cjs
git commit -m "feat(alurfilm): add ALURFILM_COMPRESS_DIR path registration"
```

---

### Task 2: Smart Compression & Dynamic Maxrate FFmpeg Integration

**Files:**
- Modify: `dashboard/electron/ipc/alurfilmHandlers.cjs:26-150`

**Interfaces:**
- Consumes: `p.ALURFILM_COMPRESS_DIR`, `ffmpeg.ffmpegPath`, `masterPath`, `startSec`, `durationSec`
- Produces: Compressed MP4 chunk files in `input/alurfilm/compress/`, chunk metadata objects with `filePath` pointing to compressed file.

- [ ] **Step 1: Implement dynamic bitrate calculation helper in `alurfilmHandlers.cjs`**

Add helper function `calculateVideoMaxrateKbps(durationSec)`:
```javascript
function calculateVideoMaxrateKbps(durationSec) {
  const safeMegabytes = 380;
  const totalBits = safeMegabytes * 8 * 1024 * 1024;
  const duration = Math.max(1, durationSec);
  const totalKbps = Math.floor(totalBits / (1024 * duration));
  const audioKbps = 128;
  return Math.max(500, totalKbps - audioKbps);
}
```

- [ ] **Step 2: Update `splitAlurfilmVideoHelper` to produce compressed outputs**

In `splitAlurfilmVideoHelper`:
Change `outputName` and `destPath`:
```javascript
const destPath = path.join(p.ALURFILM_COMPRESS_DIR, outputName);
```

Update FFmpeg spawn arguments to include smart CRF & maxrate capping:
```javascript
const maxrateKbps = calculateVideoMaxrateKbps(partDurationSec);
const bufsizeKbps = maxrateKbps * 2;

const args = [
  '-ss', String(partStartSec),
  '-i', masterPath,
  '-t', String(partDurationSec),
  '-c:v', 'libx264',
  '-crf', '20',
  '-preset', 'medium',
  '-maxrate', `${maxrateKbps}k`,
  '-bufsize', `${bufsizeKbps}k`,
  '-c:a', 'aac',
  '-b:a', '128k',
  '-avoid_negative_ts', 'make_zero',
  '-y',
  destPath
];
```

Fallback args (if code !== 0):
```javascript
const fallbackArgs = [
  '-ss', String(partStartSec),
  '-i', masterPath,
  '-t', String(partDurationSec),
  '-c:v', 'libx264',
  '-crf', '20',
  '-preset', 'faster',
  '-maxrate', `${maxrateKbps}k`,
  '-bufsize', `${bufsizeKbps}k`,
  '-c:a', 'aac',
  '-b:a', '128k',
  '-avoid_negative_ts', 'make_zero',
  '-y',
  destPath
];
```

- [ ] **Step 3: Add size validation check (< 400MB)**

After `ffmpegProc` completes, check `stat.size`:
```javascript
const maxSizeBytes = 400 * 1024 * 1024;
if (fs.existsSync(destPath)) {
  let stat = fs.statSync(destPath);
  if (stat.size > maxSizeBytes) {
    // 2nd pass with 80% bitrate
    const reducedMaxrate = Math.floor(maxrateKbps * 0.8);
    const pass2Args = [
      '-ss', String(partStartSec),
      '-i', masterPath,
      '-t', String(partDurationSec),
      '-c:v', 'libx264',
      '-crf', '22',
      '-preset', 'faster',
      '-maxrate', `${reducedMaxrate}k`,
      '-bufsize', `${reducedMaxrate * 2}k`,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-avoid_negative_ts', 'make_zero',
      '-y',
      destPath
    ];
    await new Promise((res, rej) => {
      const p2 = spawn(ffmpeg.ffmpegPath, pass2Args);
      p2.on('close', (c) => c === 0 ? res() : rej(new Error('Pass 2 re-compression failed')));
      p2.on('error', rej);
    });
  }
}
```

- [ ] **Step 4: Verify syntax & run a dry execution test on helper functions**

Run node syntax check:
```bash
node -c dashboard/electron/ipc/alurfilmHandlers.cjs
```
Expected output: No syntax error.

- [ ] **Step 5: Commit**

```bash
git add dashboard/electron/ipc/alurfilmHandlers.cjs
git commit -m "feat(alurfilm): integrate smart FFmpeg compression for video splits (<400MB)"
```

---

### Task 3: UI Splitter & Downstream Reference Verification

**Files:**
- Modify: `dashboard/src/components/longform/AlurfilmSplitterStep.tsx`

**Interfaces:**
- Consumes: `chunk.filePath`, `chunk.size`
- Produces: Formatted file size in MB and status labels.

- [ ] **Step 1: Check `AlurfilmSplitterStep.tsx` chunk rendering**

Inspect chunk size formatting display to ensure MB size is shown clearly with compressed path tag.

- [ ] **Step 2: Verify `split-alurfilm-master-range` and chunk listing IPC handlers use `ALURFILM_COMPRESS_DIR`**

Inspect `dashboard/electron/ipc/alurfilmHandlers.cjs` for any other `ALURFILM_CHUNKS_DIR` references when listing or processing chunks and ensure fallback/consistency with `ALURFILM_COMPRESS_DIR`.

- [ ] **Step 3: Test build / compile check**

Run:
```bash
npm run build -w dashboard -- --noEmit
```
Expected output: Clean compile without TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/longform/AlurfilmSplitterStep.tsx dashboard/electron/ipc/alurfilmHandlers.cjs
git commit -m "feat(alurfilm): update UI and downstream handlers to reference compressed video chunks"
```
