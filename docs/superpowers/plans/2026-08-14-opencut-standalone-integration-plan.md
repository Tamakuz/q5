# Standalone OpenCut Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate OpenCut as an isolated, standalone video editor view inside the Electron Dashboard with a bi-directional navigation toggle.

**Architecture:** Add `'opencut'` as a primary navigation step in `Sidebar.tsx` and `App.tsx`. Create `OpenCutStudioView.tsx` inside `dashboard/src/components/opencut/` equipped with a top bar containing a **"← Kembali ke Dashboard"** button and an embedded multi-track timeline video editor interface.

**Tech Stack:** React 18, TypeScript, TailwindCSS, Electron, Vite.

## Global Constraints

- Navigation step identifier: `'opencut'`
- Sidebar label: `OpenCut Studio`
- Navigation toggle button text: `← Kembali ke Dashboard`
- Standalone mode: No IPC data bridge payload required in Phase 1 (YAGNI).

---

### Task 1: Navigation State & Sidebar Integration

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx`
- Modify: `dashboard/src/App.tsx`

**Interfaces:**
- Consumes: Sidebar `StepId` type definition.
- Produces: Updated `StepId` type including `'opencut'` and sidebar navigation entry.

- [ ] **Step 1: Add 'opencut' to StepId union in Sidebar.tsx**

Update `StepId` type definition in `dashboard/src/components/common/Sidebar.tsx`:
```typescript
export type StepId =
  | 'source'
  | 'analyze'
  | 'audio'
  | 'transcript'
  | 'mapping'
  | 'render'
  | 'metadata'
  | 'opencut';
```

- [ ] **Step 2: Add OpenCut Studio navigation item to Sidebar items**

In `Sidebar.tsx`, add OpenCut to the tool/studio menu section:
```tsx
{ id: 'opencut', label: 'OpenCut Studio', icon: '✂️' }
```

- [ ] **Step 3: Update App.tsx step rendering**

In `dashboard/src/App.tsx`, add step handling for `activeStep === 'opencut'` to render `OpenCutStudioView`.

- [ ] **Step 4: Verify build succeeds**

Run: `npm run build -w dashboard`
Expected: TypeScript compilation finishes cleanly without errors.

- [ ] **Step 5: Commit changes**

```bash
git add dashboard/src/components/common/Sidebar.tsx dashboard/src/App.tsx
git commit -m "feat(dashboard): add opencut to navigation sidebar and step state"
```

---

### Task 2: Create OpenCutStudioView Component

**Files:**
- Create: `dashboard/src/components/opencut/OpenCutStudioView.tsx`
- Create: `dashboard/src/components/opencut/OpenCutEditor.tsx`

**Interfaces:**
- Consumes: `onBackToDashboard: () => void` prop.
- Produces: Complete standalone OpenCut editor view container with top bar and navigation control.

- [ ] **Step 1: Create OpenCutEditor component**

Create `dashboard/src/components/opencut/OpenCutEditor.tsx`:
```tsx
import React, { useState } from 'react';

export const OpenCutEditor: React.FC = () => {
  const [tracks, setTracks] = useState<{ id: string; name: string; type: 'video' | 'audio' | 'text'; items: string[] }[]>([
    { id: '1', name: 'Video Track 1', type: 'video', items: [] },
    { id: '2', name: 'Audio Track 1 (VO)', type: 'audio', items: [] },
    { id: '3', name: 'Text / Subtitles', type: 'text', items: [] }
  ]);

  const [files, setFiles] = useState<File[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white p-4 gap-4 overflow-hidden">
      {/* Upper Panel: Asset Library & Preview Canvas */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Media Library */}
        <div className="col-span-4 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col gap-3">
          <h3 className="font-semibold text-sm text-slate-200">Media Assets</h3>
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-xs text-center font-medium transition">
            + Import Video / Image / Audio
            <input type="file" multiple accept="video/*,image/*,audio/*" className="hidden" onChange={handleFileUpload} />
          </label>
          <div className="flex-1 overflow-y-auto space-y-2">
            {files.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-6">Belum ada file diimpor</p>
            ) : (
              files.map((f, i) => (
                <div key={i} className="bg-slate-800 p-2 rounded text-xs flex items-center justify-between text-slate-300">
                  <span className="truncate max-w-[180px]">{f.name}</span>
                  <span className="text-[10px] text-slate-500 uppercase">{f.type.split('/')[0]}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Video Canvas Preview */}
        <div className="col-span-8 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col items-center justify-center">
          <div className="w-full max-w-lg aspect-video bg-slate-950 border border-slate-800 rounded flex items-center justify-center relative">
            <span className="text-slate-600 text-xs">OpenCut Preview Canvas</span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded text-xs">▶ Play</button>
            <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded text-xs">⏸ Pause</button>
            <span className="text-xs text-slate-400 font-mono">00:00:00 / 00:00:00</span>
          </div>
        </div>
      </div>

      {/* Multi-track Timeline */}
      <div className="h-48 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Multi-Track Timeline</span>
          <div className="flex gap-2">
            <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[11px]">+ Track</button>
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-[11px] font-medium">Render & Export</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {tracks.map((t) => (
            <div key={t.id} className="h-10 bg-slate-950 border border-slate-800 rounded flex items-center px-3 gap-3">
              <span className="text-xs font-medium text-slate-400 w-32 shrink-0">{t.name}</span>
              <div className="flex-1 h-6 bg-slate-900 rounded border border-slate-800 border-dashed flex items-center px-2 text-[10px] text-slate-600">
                Drag clip ke sini
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create OpenCutStudioView with Top Header Bar**

Create `dashboard/src/components/opencut/OpenCutStudioView.tsx`:
```tsx
import React from 'react';
import { OpenCutEditor } from './OpenCutEditor';

interface OpenCutStudioViewProps {
  onBackToDashboard: () => void;
}

export const OpenCutStudioView: React.FC<OpenCutStudioViewProps> = ({ onBackToDashboard }) => {
  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Top Bar Navigation Header */}
      <div className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg">✂️</span>
          <h2 className="font-semibold text-sm text-white">OpenCut Studio (Standalone Editor)</h2>
          <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded">Standalone</span>
        </div>
        <button
          onClick={onBackToDashboard}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition"
        >
          ← Kembali ke Dashboard
        </button>
      </div>

      {/* Main Editor Component Container */}
      <div className="flex-1 min-h-0">
        <OpenCutEditor />
      </div>
    </div>
  );
};

export default OpenCutStudioView;
```

- [ ] **Step 3: Connect OpenCutStudioView in App.tsx**

Import `OpenCutStudioView` in `dashboard/src/App.tsx` and render it when `activeStep === 'opencut'`.

- [ ] **Step 4: Verify build succeeds**

Run: `npm run build -w dashboard`
Expected: Build passes without type errors.

- [ ] **Step 5: Commit implementation**

```bash
git add dashboard/src/components/opencut/ dashboard/src/App.tsx
git commit -m "feat(dashboard): implement OpenCutStudioView standalone editor with navigation toggle"
```

---

## Verification Plan

### Automated Verification
- Run `npm run build -w dashboard` to verify clean TypeScript compilation.

### Manual Verification
1. Launch dev server: `npm run dev -w dashboard`
2. Click **OpenCut Studio** in the sidebar.
3. Verify transition to OpenCut Studio view with top bar and "← Kembali ke Dashboard" button.
4. Test file selection and timeline view.
5. Click "← Kembali ke Dashboard" and verify seamless return to previous module view.
