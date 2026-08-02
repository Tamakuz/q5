# Alur Film Multi-Part Voiceover Audio Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable uploading single or multi-part continuous Voiceover (VO) audio files in Flow 3 (`AlurfilmAudioStep.tsx`), associating them with selected video split parts, and persisting audio files & mapping state in a dedicated directory (`input/alurfilm/audio/`).

**Architecture:** Extend backend IPC handlers in `alurfilmHandlers.cjs` to store uploaded audio files in `input/alurfilm/audio/` and maintain an `audio_mappings.json` metadata index. Update `electron-api.ts` and `preload.cjs` signatures, and add a Multi-Select Split Parts target selector in `AlurfilmAudioStep.tsx`.

**Tech Stack:** Electron IPC (Node.js `fs`, `path`), React (TypeScript, TailwindCSS).

## Global Constraints

- Audio Storage Directory: `input/alurfilm/audio/` (`ALURFILM_AUDIO_DIR`)
- Mapping File: `input/alurfilm/audio/${contentId}_audio_mappings.json`
- File Naming: `${contentId}_audio_parts_${partsRange}.${ext}`
- Multi-Select Split Parts Selection required before trigger upload action.

---

### Task 1: Dedicated Audio Storage & IPC Handlers Extension

**Files:**
- Modify: `dashboard/electron/shared/paths.cjs:13-88`
- Modify: `dashboard/electron/ipc/alurfilmHandlers.cjs:387-440`

**Interfaces:**
- Produces: `upload-alurfilm-audio` accepting `{ parts: number[], filePath: string }`
- Produces: `list-alurfilm-audios` returning mapped audio entries from `audio_mappings.json`
- Produces: `delete-alurfilm-audio` accepting `{ id: string }`

- [ ] **Step 1: Export `ALURFILM_AUDIO_DIR` in `paths.cjs`**

Add `ALURFILM_AUDIO_DIR` to `dashboard/electron/shared/paths.cjs`:
```javascript
const ALURFILM_AUDIO_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'audio');

// Add ALURFILM_AUDIO_DIR to Ensure dirs exist loop
[INPUT_ASSETS, TMP_DIR, SPENSIA_INPUT_DIR, SPENSIA_OUTPUT_DIR, ALURFILM_DIR, ALURFILM_CHUNKS_DIR, ALURFILM_AUDIO_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Export ALURFILM_AUDIO_DIR in module.exports
```

- [ ] **Step 2: Implement Multi-Part Upload and Mapping Persistence in `alurfilmHandlers.cjs`**

Update `upload-alurfilm-audio` handler in `dashboard/electron/ipc/alurfilmHandlers.cjs`:
```javascript
ipcMain.handle('upload-alurfilm-audio', async (_event, { parts, filePath }) => {
  const contentId = p.getOrGenerateContentId('longform');
  if (!fs.existsSync(p.ALURFILM_AUDIO_DIR)) fs.mkdirSync(p.ALURFILM_AUDIO_DIR, { recursive: true });

  const sortedParts = Array.isArray(parts) && parts.length > 0 ? parts.sort((a, b) => a - b) : [1];
  const minPart = String(sortedParts[0]).padStart(2, '0');
  const maxPart = String(sortedParts[sortedParts.length - 1]).padStart(2, '0');
  const partsRange = sortedParts.length === 1 ? minPart : `${minPart}-${maxPart}`;

  const ext = path.extname(filePath) || '.mp3';
  const timestamp = Date.now();
  const outputName = `${contentId}_audio_parts_${partsRange}_${timestamp}${ext}`;
  const destPath = path.join(p.ALURFILM_AUDIO_DIR, outputName);

  fs.copyFileSync(filePath, destPath);
  const stat = fs.statSync(destPath);

  // Read or initialize audio_mappings.json
  const mappingFile = path.join(p.ALURFILM_AUDIO_DIR, `${contentId}_audio_mappings.json`);
  let mappingData = { contentId, audios: [] };
  if (fs.existsSync(mappingFile)) {
    try {
      mappingData = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
    } catch { }
  }

  // Remove overlapping parts from previous audios if needed
  mappingData.audios = (mappingData.audios || []).filter(item => {
    const hasOverlap = item.parts && item.parts.some(pt => sortedParts.includes(pt));
    return !hasOverlap;
  });

  const audioId = `audio_${timestamp}`;
  const newEntry = {
    id: audioId,
    name: outputName,
    parts: sortedParts,
    filePath: destPath,
    url: media.mediaUrl(destPath),
    size: stat.size,
    createdAt: new Date().toISOString()
  };

  mappingData.audios.push(newEntry);
  fs.writeFileSync(mappingFile, JSON.stringify(mappingData, null, 2), 'utf-8');

  return newEntry;
});
```

- [ ] **Step 3: Update `list-alurfilm-audios` and `delete-alurfilm-audio` in `alurfilmHandlers.cjs`**

```javascript
ipcMain.handle('list-alurfilm-audios', async (_event, modeContentId) => {
  const contentId = modeContentId || p.getOrGenerateContentId('longform');
  if (!fs.existsSync(p.ALURFILM_AUDIO_DIR)) return [];

  const mappingFile = path.join(p.ALURFILM_AUDIO_DIR, `${contentId}_audio_mappings.json`);
  if (!fs.existsSync(mappingFile)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
    const validAudios = (data.audios || []).filter(item => fs.existsSync(item.filePath));
    return validAudios;
  } catch {
    return [];
  }
});

ipcMain.handle('delete-alurfilm-audio', async (_event, { id }) => {
  const contentId = p.getOrGenerateContentId('longform');
  if (!fs.existsSync(p.ALURFILM_AUDIO_DIR)) return true;

  const mappingFile = path.join(p.ALURFILM_AUDIO_DIR, `${contentId}_audio_mappings.json`);
  if (!fs.existsSync(mappingFile)) return true;

  try {
    const data = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
    const targetItem = (data.audios || []).find(item => item.id === id);
    if (targetItem && fs.existsSync(targetItem.filePath)) {
      try { fs.unlinkSync(targetItem.filePath); } catch { }
    }
    data.audios = (data.audios || []).filter(item => item.id !== id);
    fs.writeFileSync(mappingFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch { }
  return true;
});
```

- [ ] **Step 4: Commit Task 1**

```bash
git add dashboard/electron/shared/paths.cjs dashboard/electron/ipc/alurfilmHandlers.cjs
git commit -m "feat(alurfilm): add dedicated audio directory and multi-part IPC handlers"
```

---

### Task 2: IPC Bridge & TypeScript Definitions Update

**Files:**
- Modify: `dashboard/electron/preload.cjs:80`
- Modify: `dashboard/src/electron-api.ts:35-45, 90-110`

**Interfaces:**
- Consumes: Backend IPC handlers `upload-alurfilm-audio`, `list-alurfilm-audios`, `delete-alurfilm-audio`
- Produces: TypeScript signature for `uploadAlurfilmAudio(contentId, parts, filePath)`

- [ ] **Step 1: Update Preload Bridge in `preload.cjs`**

Update IPC bridge in `dashboard/electron/preload.cjs`:
```javascript
uploadAlurfilmAudio: (contentId, parts, filePath) =>
  ipcRenderer.invoke('upload-alurfilm-audio', { parts, filePath }),
deleteAlurfilmAudio: (id) =>
  ipcRenderer.invoke('delete-alurfilm-audio', { id }),
```

- [ ] **Step 2: Update Type Definitions in `electron-api.ts`**

Update `AlurfilmAudioResult` and `ElectronAPI` interface in `dashboard/src/electron-api.ts`:
```typescript
export interface AlurfilmAudioResult {
  id: string;
  name: string;
  parts: number[];
  filePath: string;
  url: string;
  mediaUrl?: string;
  size: number;
  createdAt?: string;
}

// In ElectronAPI interface:
uploadAlurfilmAudio: (contentId: string, parts: number[], filePath: string) => Promise<AlurfilmAudioResult>;
listAlurfilmAudios: (contentId?: string) => Promise<AlurfilmAudioResult[]>;
deleteAlurfilmAudio: (id: string) => Promise<boolean>;
```

- [ ] **Step 3: Commit Task 2**

```bash
git add dashboard/electron/preload.cjs dashboard/src/electron-api.ts
git commit -m "feat(alurfilm): update audio IPC bridge and typescript definitions"
```

---

### Task 3: Multi-Part Split Selection UI in `AlurfilmAudioStep.tsx`

**Files:**
- Modify: `dashboard/src/components/longform/AlurfilmAudioStep.tsx:1-226`

**Interfaces:**
- Consumes: `api.listAlurfilmAudios`, `api.uploadAlurfilmAudio`, `api.deleteAlurfilmAudio`
- Produces: Updated Flow 3 UI component with target parts multi-select checklist

- [ ] **Step 1: Add Selected Parts State and Multi-Select Selector UI**

In `AlurfilmAudioStep.tsx`:
1. Maintain `selectedParts: number[]` state.
2. Initialize `selectedParts` with all available chunk parts when chunks load or default to `[activePart]`.
3. Add a "Target Split Parts" checklist section above the upload action in the Center Panel:
```tsx
<div className="bg-gray-950/80 p-4 rounded-xl border border-gray-800 space-y-2.5">
  <div className="flex items-center justify-between">
    <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
      <span>🎯</span> Target Split Parts untuk Audio ini:
    </span>
    <div className="flex items-center gap-2">
      <button
        onClick={() => setSelectedParts(chunks.map(c => c.part))}
        className="text-[10px] text-purple-400 hover:underline font-bold"
      >
        Pilih Semua ({chunks.length})
      </button>
      <span className="text-gray-700">|</span>
      <button
        onClick={() => setSelectedParts([])}
        className="text-[10px] text-gray-500 hover:underline font-bold"
      >
        Bersihkan
      </button>
    </div>
  </div>

  <div className="flex flex-wrap gap-2">
    {chunks.map(chunk => {
      const isSelected = selectedParts.includes(chunk.part);
      return (
        <button
          key={chunk.part}
          onClick={() => {
            if (isSelected) {
              setSelectedParts(selectedParts.filter(p => p !== chunk.part));
            } else {
              setSelectedParts([...selectedParts, chunk.part].sort((a, b) => a - b));
            }
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all flex items-center gap-1.5 ${
            isSelected
              ? 'bg-purple-600/30 border-purple-500 text-purple-200'
              : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
          }`}
        >
          <span>{isSelected ? '☑' : '☐'}</span>
          <span>Part #{chunk.part}</span>
        </button>
      );
    })}
  </div>
</div>
```

- [ ] **Step 2: Update Upload & Delete Handlers and Render Logic**

1. Update `handleUploadVoiceover`:
```tsx
const handleUploadVoiceover = async () => {
  if (selectedParts.length === 0) {
    showToast('⚠️ Silakan pilih minimal 1 Part Video Split sebelum upload!');
    return;
  }
  setError(null);
  try {
    const selected = await api.selectAudio();
    if (!selected) return;

    setUploading(true);
    const res = await api.uploadAlurfilmAudio(contentId || 'default', selectedParts, selected.path);
    
    // Reload audios list
    const updatedList = await api.listAlurfilmAudios(contentId || 'default');
    setAudioList(updatedList || []);
    showToast(`🎉 Uploaded Voiceover Audio untuk Part #${selectedParts.join(', #')}!`);
  } catch (err: any) {
    setError(`Failed to upload audio: ${err.message}`);
  }
  setUploading(false);
};
```

2. Update Side Panel Parts List to reflect assigned master audio:
```tsx
const assignedAudio = audioList.find(a => a.parts && a.parts.includes(chunk.part));
```
Render subtitle badge in part button e.g., `Part #{chunk.part} ${assignedAudio ? `(Parts ${assignedAudio.parts.join(',')})` : ''}`.

3. Update Audio Player Card in Center Panel to show covered parts badges:
```tsx
<div className="flex flex-wrap gap-1.5 mt-1">
  <span className="text-[10px] text-gray-400 font-mono">Part Mencakup:</span>
  {currentAudio.parts.map(p => (
    <span key={p} className="px-2 py-0.5 bg-purple-900/60 border border-purple-700 text-purple-200 text-[10px] font-mono rounded font-bold">
      Part #{p}
    </span>
  ))}
</div>
```

- [ ] **Step 3: Commit Task 3**

```bash
git add dashboard/src/components/longform/AlurfilmAudioStep.tsx
git commit -m "feat(alurfilm): add multi-part split selection and audio badges in Audio Studio UI"
```

---

### Task 4: Verification & Build Check

**Files:**
- Test: Build check in `dashboard`

- [ ] **Step 1: Run TypeScript Type Check and Build**

Run command:
```bash
npm run build -w dashboard
```
Expected: Build succeeds with 0 errors.

- [ ] **Step 2: Commit & Final Verification**

```bash
git add -A
git commit -m "chore(alurfilm): verify multi-part audio upload implementation"
```
