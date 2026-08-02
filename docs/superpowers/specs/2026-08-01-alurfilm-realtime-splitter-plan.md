# Alur Film Realtime Video Splitter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real-time video splitting progress reporting and live chunk item updates in Alur Film Flow 1 Master Video Splitter.

**Architecture:** Main process emits IPC progress events (`start`, `splitting`, `chunk_completed`, `done`) over `'alurfilm-split-progress'` during FFmpeg execution. Preload bridge forwards these events to React, which updates the chunk list, progress bar, percentage, and an in-progress placeholder card in real-time.

**Tech Stack:** Electron IPC (`ipcMain`, `ipcRenderer`, `contextBridge`), React, TypeScript, TailwindCSS.

## Global Constraints
- Main process event channel: `'alurfilm-split-progress'`
- Types must be exported in `dashboard/src/electron-api.ts`
- Must cleanup IPC listener in `useEffect` on unmount / process completion.

---

### Task 1: Update Main IPC Handler & Preload Bridge for Progress Reporting

**Files:**
- Modify: `dashboard/electron/ipc/alurfilmHandlers.cjs:27-142`
- Modify: `dashboard/electron/preload.cjs:42-47`
- Modify: `dashboard/src/electron-api.ts:25-35`

**Interfaces:**
- Produces: `api.onAlurfilmSplitProgress(callback: (data: AlurfilmSplitProgressPayload) => void): () => void`

- [ ] **Step 1: Update `splitAlurfilmVideoHelper` in `alurfilmHandlers.cjs` to emit IPC events**

In `dashboard/electron/ipc/alurfilmHandlers.cjs`:
Update function signature to `splitAlurfilmVideoHelper(event, masterPath, startTime, endTime)`.
Emit `event.sender.send('alurfilm-split-progress', ...)` for `start`, `splitting`, `chunk_completed`, and `done`.

- [ ] **Step 2: Update IPC handlers `split-alurfilm-video` and `split-alurfilm-master`**

Pass `_event` to `splitAlurfilmVideoHelper(_event, masterPath, startTime, endTime)`.

- [ ] **Step 3: Expose `onAlurfilmSplitProgress` in `preload.cjs`**

Add listener registration and cleanup:
```js
onAlurfilmSplitProgress: (callback) => {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on('alurfilm-split-progress', handler);
  return () => ipcRenderer.removeListener('alurfilm-split-progress', handler);
},
```

- [ ] **Step 4: Update TypeScript definitions in `electron-api.ts`**

Add interface and method:
```ts
export interface AlurfilmSplitProgressPayload {
  status: 'start' | 'splitting' | 'chunk_completed' | 'done';
  currentPart: number;
  totalParts: number;
  chunk?: AlurfilmChunk;
}

// In ElectronAPI interface:
onAlurfilmSplitProgress: (callback: (data: AlurfilmSplitProgressPayload) => void) => () => void;
```

---

### Task 2: Implement Real-time UI & Live Chunk List in `AlurfilmSplitterStep.tsx`

**Files:**
- Modify: `dashboard/src/components/longform/AlurfilmSplitterStep.tsx`

**Interfaces:**
- Consumes: `api.onAlurfilmSplitProgress`

- [ ] **Step 1: Add progress state and IPC listener in `AlurfilmSplitterStep.tsx`**

Add state:
```tsx
const [splitProgress, setSplitProgress] = useState<{
  currentPart: number;
  totalParts: number;
  percentage: number;
  statusText: string;
} | null>(null);
```

In `handleAutoCutWithTimeRange`:
Register listener `const unsubscribe = api.onAlurfilmSplitProgress((data) => { ... })`.
- On `'start'`: `setChunks([])`, set initial progress state.
- On `'splitting'`: Update `currentPart`, status text, and percentage (`Math.round(((data.currentPart - 1) / data.totalParts) * 100)`).
- On `'chunk_completed'`: Append `data.chunk` to `chunks` list (`setChunks(prev => [...prev.filter(c => c.part !== data.chunk.part), data.chunk])`), update percentage (`Math.round((data.currentPart / data.totalParts) * 100)`).
- On `'done'`: `setSplitProgress(null)`, cleanup listener.

- [ ] **Step 2: Render Progress Bar in Control Box**

Render progress bar and percentage inside the `masterSource` control box while `splitting` is true:
```tsx
{splitting && splitProgress && (
  <div className="space-y-1.5 pt-1">
    <div className="flex justify-between items-center text-xs font-mono">
      <span className="text-purple-300 font-semibold">{splitProgress.statusText}</span>
      <span className="text-purple-400 font-bold">{splitProgress.percentage}%</span>
    </div>
    <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-purple-950">
      <div
        className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full transition-all duration-300"
        style={{ width: `${splitProgress.percentage}%` }}
      />
    </div>
  </div>
)}
```

- [ ] **Step 3: Render In-Progress Card Placeholder in Chunk List**

In the right panel chunk list, when `splitting` is true and `splitProgress` is active:
```tsx
{splitting && splitProgress && (
  <div className="p-3.5 rounded-xl border border-purple-500/50 bg-purple-950/30 animate-pulse flex items-center justify-between gap-3 shadow-lg">
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-8 h-8 rounded-lg bg-purple-600/30 border border-purple-500/40 text-purple-300 flex items-center justify-center font-bold text-xs font-mono shrink-0">
        P{splitProgress.currentPart}
      </span>
      <div className="min-w-0">
        <h4 className="text-xs font-bold text-purple-200 truncate font-mono">
          Sedang Memotong Part #{splitProgress.currentPart}...
        </h4>
        <p className="text-[11px] text-purple-400/80 font-mono mt-0.5">
          Proses FFmpeg {splitProgress.currentPart} dari {splitProgress.totalParts} chunks
        </p>
      </div>
    </div>
    <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compilation & dashboard UI functionality**

Run `npx tsc --noEmit` inside `dashboard/` directory to ensure zero type errors.
