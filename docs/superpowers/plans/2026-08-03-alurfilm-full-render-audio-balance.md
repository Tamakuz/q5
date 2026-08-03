# Alur Film Full Movie Render & Audio Volume Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Full Movie Recap Render button in Step 6 (`AlurfilmRenderStep.tsx`) to render/concat all movie parts into a single master video, default to the Thomas Newman mystery BGM asset, and balance audio volume (VO 1.8x boost, BGM 0.18x background).

**Architecture:** FFmpeg complex audio filter maps voiceover audio to `volume=1.8` and mixes background music at `volume=0.18`. `AlurfilmRenderStep.tsx` receives a top-level **Full Movie Recap Render** control panel allowing one-click build and master video playback.

**Tech Stack:** React, TypeScript, Electron IPC, FFmpeg CLI.

## Global Constraints

- Voiceover volume boost: `1.8` (`[vo]volume=1.8`).
- BGM volume level: `0.18` (`[bgm]volume=0.18`).
- Default BGM path: `assets/bgm/05_santai_misteri/Piano music in style of Thomas Newman - sad mood - Royalty free music no copyright music.mp3`.

---

### Task 1: Update Audio Filter & Default BGM Fallback in FFmpeg Handlers

**Files:**
- Modify: `dashboard/electron/ipc/renderHandlers.cjs`
- Modify: `render-alurfilm.ts`

**Interfaces:**
- Consumes: `concat-alurfilm-final-video` IPC args `{ parts, bgmPath, bgmVolume, ... }`
- Produces: Master video with 1.8x VO volume boost and 0.18 BGM mix.

- [ ] **Step 1: Update `concat-alurfilm-final-video` in `renderHandlers.cjs`**

In `dashboard/electron/ipc/renderHandlers.cjs`:
1. Update BGM fallback resolver to check `assets/bgm/05_santai_misteri/Piano music in style of Thomas Newman - sad mood - Royalty free music no copyright music.mp3`.
2. Set default `vol` to `bgmVolume ?? 0.18`.
3. Change VO audio volume filter to `[0:a]volume=1.8[vo]`.

```javascript
    let resolvedBgm = bgmPath && fs.existsSync(bgmPath) ? bgmPath : null;
    if (!resolvedBgm) {
      const thomasNewmanPath = path.join(p.PROJECT_ROOT, 'assets', 'bgm', '05_santai_misteri', 'Piano music in style of Thomas Newman - sad mood - Royalty free music no copyright music.mp3');
      if (fs.existsSync(thomasNewmanPath)) {
        resolvedBgm = thomasNewmanPath;
      } else {
        const assetsDir = path.join(p.PROJECT_ROOT, 'assets');
        if (fs.existsSync(assetsDir)) {
          const mp3s = fs.readdirSync(assetsDir).filter(f => f.toLowerCase().endsWith('.mp3'));
          if (mp3s.length > 0) resolvedBgm = path.join(assetsDir, mp3s[0]);
        }
      }
    }

    const vol = bgmVolume ?? 0.18;
```

And in complex filter:

```javascript
    if (bgmIndex !== null) {
      filterParts.push(`[0:a]volume=1.8[vo]`);
      filterParts.push(`[${bgmIndex}:a]volume=${vol},aloop=loop=-1:size=2e+09[bgm]`);
      filterParts.push(`[vo][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
      aMap = '[aout]';
    } else {
      filterParts.push(`[0:a]volume=1.8[vo]`);
      aMap = '[vo]';
    }
```

- [ ] **Step 2: Update audio filter pipeline in `render-alurfilm.ts`**

In `render-alurfilm.ts`:
1. Change default `bgmVolume` to `0.18`.
2. Change VO filter from `[${voIndex}:a]volume=1.0[vo]` to `[${voIndex}:a]volume=1.8[vo]`.

```typescript
    const bgmVolume = parseFloat(opts.bgmVolume || '0.18') || 0.18;
```

And in audio filter block:

```typescript
      if (voIndex !== null && bgmIndex !== null) {
        filterParts.push(`[${voIndex}:a]volume=1.8[vo]`);
        filterParts.push(`[${bgmIndex}:a]volume=${bgmVolume},aloop=loop=-1:size=2e+09,afade=t=out:st=${Math.max(0, totalDur - 2)}:d=2[bgm]`);
        filterParts.push(`[vo][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
        aMap = '[aout]';
      } else if (voIndex !== null) {
        filterParts.push(`[${voIndex}:a]volume=1.8[vo]`);
        aMap = '[vo]';
      }
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/electron/ipc/renderHandlers.cjs render-alurfilm.ts
git commit -m "feat(render): boost voiceover audio to 1.8x and balance BGM at 0.18x"
```

---

### Task 2: Implement Full Movie Recap Render UI & Controls in `AlurfilmRenderStep.tsx`

**Files:**
- Modify: `dashboard/src/components/longform/AlurfilmRenderStep.tsx`

**Interfaces:**
- Consumes: `api.concatAlurfilmFinalVideo(parts, { bgmPath, bgmVolume: 0.18 })`
- Produces: Full movie recap render status, progress UI, and master player card.

- [ ] **Step 1: Add Full Movie Render state in `AlurfilmRenderStep.tsx`**

Add state variables for full movie render:

```typescript
  const [isFullRendering, setIsFullRendering] = useState<boolean>(false);
  const [fullRenderProgress, setFullRenderProgress] = useState<string | null>(null);
  const [fullRenderResult, setFullRenderResult] = useState<{ filePath?: string; mediaUrl?: string; fileName?: string } | null>(null);
  const [fullRenderError, setFullRenderError] = useState<string | null>(null);
```

- [ ] **Step 2: Add `handleRenderFullMovie` method**

```typescript
  const handleRenderFullMovie = async () => {
    if (!chunks || chunks.length === 0) return;
    const allParts = chunks.map((c) => c.part).sort((a, b) => a - b);

    setIsFullRendering(true);
    setFullRenderError(null);
    setFullRenderProgress('Concatenating all parts & mixing audio (VO 1.8x + BGM 0.18x)...');

    try {
      if (api.concatAlurfilmFinalVideo) {
        const defaultBgm = 'assets/bgm/05_santai_misteri/Piano music in style of Thomas Newman - sad mood - Royalty free music no copyright music.mp3';
        const res = await api.concatAlurfilmFinalVideo(allParts, {
          bgmPath: defaultBgm,
          bgmVolume: 0.18,
        });

        if (res.error) {
          setFullRenderError(res.error);
        } else if (res.filePath) {
          setFullRenderResult(res);
          showToast('🎉 Full Movie Recap Render Completed Successfully!');
        }
      }
    } catch (err: any) {
      setFullRenderError(err.message || 'Full movie render failed');
    } finally {
      setIsFullRendering(false);
      setFullRenderProgress(null);
    }
  };
```

- [ ] **Step 3: Render Full Movie Recap Control & Master Video Player Cards**

Add top banner card above grid workspace in `AlurfilmRenderStep.tsx`:

```tsx
      {/* Top Banner: Full Movie Recap Render Controls */}
      <div className="bg-gradient-to-r from-purple-950/80 via-gray-900 to-indigo-950/80 border border-purple-800/40 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-lg shrink-0">
            🎬
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Render Full Movie Recap (All {chunks.length} Parts)
              <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-[10px] font-mono rounded-full border border-purple-500/30">
                VO 1.8x Boost + BGM 0.18
              </span>
            </h3>
            <p className="text-[11px] text-gray-400">
              Concatenate all video parts into one master movie recap with Thomas Newman mystery BGM.
            </p>
          </div>
        </div>

        <button
          onClick={handleRenderFullMovie}
          disabled={isFullRendering || chunks.length === 0}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 shrink-0 ${
            isFullRendering
              ? 'bg-purple-800 text-purple-200 cursor-not-allowed animate-pulse'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
          }`}
        >
          <span>{isFullRendering ? '⌛' : '🍿'}</span>
          <span>{isFullRendering ? 'Rendering Full Movie...' : 'Render Full Movie Recap'}</span>
        </button>
      </div>

      {/* Full Movie Result Player (when available) */}
      {fullRenderResult?.filePath && (
        <div className="bg-gray-900/90 border border-emerald-800/40 p-4 rounded-2xl shadow-2xl space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
              <span>🎉</span> Master Video Ready: {fullRenderResult.fileName}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">{fullRenderResult.filePath}</span>
          </div>
          <video
            src={`media://content-auto/${encodeURIComponent(fullRenderResult.filePath)}`}
            controls
            className="w-full max-h-72 rounded-xl bg-black object-contain border border-gray-800"
          />
        </div>
      )}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/longform/AlurfilmRenderStep.tsx
git commit -m "feat(alurfilm): add Full Movie Recap render controls and master video player"
```

---

### Task 3: Verification & Type Check

- [ ] **Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit` inside `dashboard/`.

- [ ] **Step 2: Verify feature workflow**

1. Open Flow 2 (Alur Film).
2. Go to **6. Video Render**.
3. Verify **"Render Full Movie Recap"** card and volume boost settings.
