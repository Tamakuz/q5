# Fast Split & On-Demand Per-Chunk Video Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revert initial splitting back to fast stream copy (`-c copy`) into `input/alurfilm/chunks/`, display chunk file sizes in the UI, and add an on-demand "Compress" button for individual chunks to compress into `input/alurfilm/compress/` (< 400 MB).

**Architecture:** 
1. `alurfilmHandlers.cjs`: `splitAlurfilmVideoHelper` uses fast stream copy to `chunks/`.
2. Add IPC `compress-alurfilm-chunk` to compress a specific chunk into `compress/` with CRF 20 & maxrate limit.
3. `list-alurfilm-chunks`: Checks `compress/` first, falls back to `chunks/`, adding size & `isCompressed` metadata.
4. `AlurfilmSplitterStep.tsx` & `electron-api.ts`: Displays file size (e.g., `350.4 MB`), `isCompressed` badge, and a "🗜️ Compress" button per chunk.

**Tech Stack:** Electron (IPC), Node.js (fs, child_process), React / TypeScript (Alurfilm UI).

## Global Constraints
- Initial split must be fast stream-copy (`-c copy`).
- Compression target size: Max 400 MB (380 MB safety limit formula).
- Compressed outputs directory: `input/alurfilm/compress/`.

---

### Task 1: Revert Splitting to Fast `-c copy` & Add `compress-alurfilm-chunk` IPC Handler

**Files:**
- Modify: `dashboard/electron/ipc/alurfilmHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`
- Modify: `dashboard/src/electron-api.ts`

**Interfaces:**
- Consumes: `masterPath`, `part`, `filePath`
- Produces: `compress-alurfilm-chunk` IPC handler returning updated chunk metadata object.

- [ ] **Step 1: Revert `splitAlurfilmVideoHelper` and `split-alurfilm-master-range` to fast `-c copy`**

In `dashboard/electron/ipc/alurfilmHandlers.cjs`:
Update `splitAlurfilmVideoHelper` to save to `p.ALURFILM_CHUNKS_DIR` using `-c copy`:
```javascript
const destPath = path.join(p.ALURFILM_CHUNKS_DIR, outputName);
const args = [
  '-ss', String(partStartSec),
  '-i', masterPath,
  '-t', String(partDurationSec),
  '-c', 'copy',
  '-avoid_negative_ts', 'make_zero',
  '-y',
  destPath
];
```
Fallback on code !== 0: `-c:v libx264 -c:a aac -preset ultrafast`.

- [ ] **Step 2: Add `compress-alurfilm-chunk` IPC handler in `alurfilmHandlers.cjs`**

Implement `compress-alurfilm-chunk` handler:
```javascript
ipcMain.handle('compress-alurfilm-chunk', async (_event, { part, filePath }) => {
  const contentId = p.getOrGenerateContentId('longform');
  const partStr = String(part).padStart(2, '0');
  const outputName = `${contentId}_part_${partStr}.mp4`;
  const destPath = path.join(p.ALURFILM_COMPRESS_DIR, outputName);

  if (!fs.existsSync(p.ALURFILM_COMPRESS_DIR)) {
    fs.mkdirSync(p.ALURFILM_COMPRESS_DIR, { recursive: true });
  }

  const meta = await ffmpeg.getVideoMetaHelper(filePath).catch(() => null);
  const durationSec = meta?.duration || 1200;

  await encodeAndCompressChunk(ffmpeg.ffmpegPath, filePath, 0, durationSec, destPath);

  const stat = fs.statSync(destPath);
  return {
    part: Number(part),
    name: outputName,
    size: stat.size,
    durationSec: durationSec,
    filePath: destPath,
    url: media.mediaUrl(destPath),
    isCompressed: true
  };
});
```

- [ ] **Step 3: Update `list-alurfilm-chunks` in `alurfilmHandlers.cjs`**

In `list-alurfilm-chunks`:
Look for files in `ALURFILM_COMPRESS_DIR` first (with `isCompressed: true`). If missing, look in `ALURFILM_CHUNKS_DIR` (`isCompressed: false`). Include `size` and `isCompressed` properties in the returned objects.

- [ ] **Step 4: Expose `compressAlurfilmChunk` in `preload.cjs` & `electron-api.ts`**

In `dashboard/electron/preload.cjs`:
```javascript
compressAlurfilmChunk: (opts) => ipcRenderer.invoke('compress-alurfilm-chunk', opts),
```

In `dashboard/src/electron-api.ts`:
Add `isCompressed?: boolean;` to `AlurfilmChunk` interface and declare `compressAlurfilmChunk(opts: { part: number; filePath: string }): Promise<AlurfilmChunk>;`.

---

### Task 2: UI File Size Display & Per-Chunk "Compress" Button (`AlurfilmSplitterStep.tsx`)

**Files:**
- Modify: `dashboard/src/components/longform/AlurfilmSplitterStep.tsx`

**Interfaces:**
- Consumes: `chunk.size`, `chunk.isCompressed`, `api.compressAlurfilmChunk`
- Produces: Interactive chunk list item with formatted size (e.g. `245 MB`), compression badge, and individual Compress button.

- [ ] **Step 1: Add file size formatting helper in `AlurfilmSplitterStep.tsx`**

```typescript
function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
```

- [ ] **Step 2: Add compression state tracking for individual chunks**

Add state in `AlurfilmSplitterStep.tsx`:
```typescript
const [compressingParts, setCompressingParts] = useState<Record<number, boolean>>({});
```

- [ ] **Step 3: Implement `handleCompressChunk` function**

```typescript
const handleCompressChunk = async (chunk: AlurfilmChunk) => {
  try {
    setCompressingParts(prev => ({ ...prev, [chunk.part]: true }));
    showToast(`🗜️ Mengompres Part #${chunk.part}... Mohon tunggu.`);

    const updated = await api.compressAlurfilmChunk({
      part: chunk.part,
      filePath: chunk.filePath
    });

    setChunks(prev => prev.map(c => c.part === chunk.part ? { ...c, ...updated } : c));
    showToast(`✅ Part #${chunk.part} berhasil dikompres (${formatBytes(updated.size)})!`);
  } catch (err: any) {
    setError(`Gagal mengompres Part #${chunk.part}: ${err.message}`);
  } finally {
    setCompressingParts(prev => ({ ...prev, [chunk.part]: false }));
  }
};
```

- [ ] **Step 4: Render file size, status badges, and Compress button in list items**

In chunk item JSX:
Display formatted size: `<span className="text-gray-400 font-mono"> | {formatBytes(chunk.size)}</span>`.
Add Compress button beside Delete button:
```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    handleCompressChunk(chunk);
  }}
  disabled={compressingParts[chunk.part]}
  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1 ${
    chunk.isCompressed
      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50 hover:bg-emerald-900/60'
      : 'bg-purple-950/40 text-purple-300 border-purple-800/50 hover:bg-purple-900/60'
  }`}
  title="Kompres file ini agar < 400 MB"
>
  {compressingParts[chunk.part] ? '⏳ Compressing...' : chunk.isCompressed ? '⚡ Compressed' : '🗜️ Compress'}
</button>
```

- [ ] **Step 5: Verify build & TypeScript compilation**

Run:
```bash
npx tsc --noEmit -p dashboard/tsconfig.json
```
Expected output: 0 errors.
