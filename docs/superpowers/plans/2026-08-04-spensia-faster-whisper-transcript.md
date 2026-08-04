# Spensia Faster-Whisper Sentence & Word Level Transcript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Faster-Whisper local automatic transcription with sentence-level and nested word-level timestamps (`sentences[].words[]`) exclusively for Spensia Step 6 (VoiceOver).

**Architecture:** Python CLI (`whisperx/align_cli.py`) formats hierarchical output when called for Spensia. Electron IPC (`spensiaHandlers.cjs`) triggers Python execution asynchronously with real-time progress. Frontend Step 6 (`SpensiaVoiceOverStep.tsx`) adds a 1-click Faster-Whisper button and interactive Sentence + Word highlight inspector.

**Tech Stack:** Python 3 (Faster-Whisper, CTranslate2, Silero VAD), Node.js / Electron IPC, React, TypeScript, Tailwind CSS.

## Global Constraints
- Strictly scoped to Spensia (`spensiaHandlers.cjs`, `spensiaValidation.ts`, `SpensiaVoiceOverStep.tsx`). Do not alter Alurfilm/Shortform/UGC output schemas.
- Preserve backward compatibility for manual JSON pasting.

---

### Task 1: Extend Python CLI (`whisperx/align_cli.py`) for Sentence & Nested Word Timestamps

**Files:**
- Modify: `whisperx/align_cli.py:210-270`

**Interfaces:**
- Consumes: Audio file path (`--audio`), Script text path (`--text`).
- Produces: `output_data` containing `sentences` array where each sentence object contains `sentence_id`, `text`, `start`, `end`, and `words` array `[{ word, start, end }]`.

- [ ] **Step 1: Update `align_cli.py` sentence matching logic to attach nested words**

In `whisperx/align_cli.py`, inside `run_faster_whisper_pipeline`, construct the `words` array for each matched sentence:

```python
sentence_words = [
    {
        "word": w["raw"],
        "start": round(w["start"], 2),
        "end": round(w["end"], 2)
    }
    for w in all_words[best_start_idx:best_end_idx + 1]
]

entries.append({
    "id": i + 1,
    "sentence_id": i + 1,
    "start_seconds": start_sec,
    "end_seconds": end_sec,
    "start": start_sec,
    "end": end_sec,
    "timestamp_minute": f"{format_minute(start_sec)} - {format_minute(end_sec)}",
    "text": sent,
    "speaker": "Narator",
    "words": sentence_words
})
```

- [ ] **Step 2: Update `output_data` dictionary to expose `sentences` and `words` arrays**

```python
output_data = {
    "mode": "faster-whisper-spensia",
    "audio_duration": round(audio_dur, 2),
    "entry_count": len(entries),
    "sentences": entries,
    "transcript": entries,
    "words": all_words
}
```

- [ ] **Step 3: Test Python script compilation and syntax check**

Run: `python3 -m py_compile whisperx/align_cli.py`
Expected: Exit code 0 (clean compilation).

---

### Task 2: Implement Electron IPC Handler (`dashboard/electron/ipc/spensiaHandlers.cjs`)

**Files:**
- Modify: `dashboard/electron/ipc/spensiaHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`
- Modify: `dashboard/src/electron-api.ts`

**Interfaces:**
- Consumes: IPC invocation `run-spensia-whisperx-alignment` with `{ audioPath, scriptText, topicId }`.
- Produces: Normalized `SpensiaTranscriptData` containing `sentences`, `words`, and `transcript_full`.

- [ ] **Step 1: Add `run-spensia-whisperx-alignment` handler in `spensiaHandlers.cjs`**

```javascript
ipcMain.handle('run-spensia-whisperx-alignment', async (event, { audioPath, scriptText, topicId }) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const sendProgress = (stage, progress, message) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send('spensia-whisper-progress', { stage, progress, message, topicId });
    }
  };

  try {
    sendProgress('preparing', 5, 'Memulai proses transkrip otomatis Faster-Whisper Spensia...');
    // Create temporary script file for align_cli.py
    const projectRoot = path.resolve(__dirname, '../../..');
    const tmpScriptPath = path.join(projectRoot, 'input/spensia/transcripts', `tmp_script_${topicId || 'merged'}.txt`);
    fs.mkdirSync(path.dirname(tmpScriptPath), { recursive: true });
    fs.writeFileSync(tmpScriptPath, scriptText || '', 'utf8');

    const outJsonPath = path.join(projectRoot, 'input/spensia/transcripts', `merged_transcript_topic_${topicId || 'merged'}.json`);
    const pythonBin = path.join(projectRoot, 'whisperx/venv/bin/python3');
    const alignCli = path.join(projectRoot, 'whisperx/align_cli.py');

    sendProgress('loading_model', 25, 'Memuat model Faster-Whisper ke RAM...');

    await new Promise((resolve, reject) => {
      const child = spawn(pythonBin, [alignCli, '--audio', audioPath, '--text', tmpScriptPath, '--output', outJsonPath, '--model', 'small']);
      
      child.stderr.on('data', (chunk) => {
        const line = chunk.toString();
        if (line.includes('Transcribe')) sendProgress('transcribing', 50, 'Transkripsi audio dengan Silero VAD...');
        if (line.includes('Alignment')) sendProgress('aligning', 75, 'Mencocokkan kalimat & kata dengan naskah...');
      });

      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Faster-Whisper process exited with code ${code}`));
      });
    });

    sendProgress('completed', 100, 'Transkrip otomatis selesai!');
    const jsonContent = fs.readFileSync(outJsonPath, 'utf8');
    return { success: true, jsonContent, filePath: outJsonPath };
  } catch (err) {
    sendProgress('error', 0, `Gagal: ${err.message}`);
    return { success: false, error: err.message };
  }
});
```

- [ ] **Step 2: Expose IPC methods in `preload.cjs` and `electron-api.ts`**

In `preload.cjs`:
```javascript
runSpensiaWhisperxAlignment: (data) => ipcRenderer.invoke('run-spensia-whisperx-alignment', data),
onSpensiaWhisperProgress: (callback) => {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on('spensia-whisper-progress', listener);
  return () => ipcRenderer.removeListener('spensia-whisper-progress', listener);
}
```

In `electron-api.ts`:
Add declarations to `ElectronAPI` interface.

---

### Task 3: Update Data Validation (`dashboard/src/utils/spensiaValidation.ts`)

**Files:**
- Modify: `dashboard/src/utils/spensiaValidation.ts:646-887`

**Interfaces:**
- Consumes: Raw JSON response object containing `sentences` / `words` / `transcript`.
- Produces: `SpensiaTranscriptValidationReport` with `SpensiaSentenceTimestamp[]`.

- [ ] **Step 1: Update `SpensiaSentenceTimestamp` and `SpensiaTranscriptData` interfaces**

```typescript
export interface SpensiaSentenceTimestamp {
  sentence_id: number;
  text: string;
  start: number;
  end: number;
  words: SpensiaWordTimestamp[];
}

export interface SpensiaTranscriptData {
  transcript_full: string;
  sentences?: SpensiaSentenceTimestamp[];
  segments?: SpensiaSegmentTimestamp[];
  chunks?: SpensiaChunkTimestamp[];
  words: SpensiaWordTimestamp[];
}
```

- [ ] **Step 2: Update `validateSpensiaWordTranscript` to extract and normalize `sentences`**

Parse `dataObj.sentences` or `dataObj.transcript` array:
For each sentence object:
- Parse `sentence_id` (default: index + 1)
- Parse `text`
- Parse `start` and `end` timestamps
- Parse `words` array inside the sentence object.

If `sentences` array does not exist in JSON but `words` exist:
Auto-group `words` into sentences based on punctuation (`.`, `!`, `?`) and pause durations (>0.5s).

---

### Task 4: Upgrade UI in Step 6 (`SpensiaVoiceOverStep.tsx`)

**Files:**
- Modify: `dashboard/src/components/spensia/SpensiaVoiceOverStep.tsx`

**Interfaces:**
- Consumes: Audio duration, merged audio path, script text, `runSpensiaWhisperxAlignment`.
- Produces: Interactive sentence list view, active sentence highlight (green border), active word highlight (yellow bounce).

- [ ] **Step 1: Add Auto Transcript Trigger Button & State**

Add state for `isTranscribing`, `whisperProgress`, and `whisperProgressText`.
Add button `⚡ Transkrip Otomatis (Faster-Whisper)` under Merged Audio Card.
Connect listener for `onSpensiaWhisperProgress`.

- [ ] **Step 2: Add `sentences` Tab in Transcript Inspector UI**

In `transcriptTab` type, add `'sentences'`:
```typescript
const [transcriptTab, setTranscriptTab] = useState<'sentences' | 'chunks' | 'words' | 'full'>('sentences');
```

Add Tab button:
`💬 Kalimat (Sentence & Words)`

- [ ] **Step 3: Render Interactive Sentence & Nested Word Cards**

When `transcriptTab === 'sentences'`:
Render `(mergedVo.transcript.sentences || []).map((sent) => ...)`:
- Highlight sentence card if current audio time is within `[sent.start, sent.end]`.
- Click sentence timestamp or play button to seek audio to `sent.start`.
- Inside sentence card, render `sent.words.map((w) => ...)`:
  - If `currentTime >= w.start && currentTime <= w.end`, apply active yellow highlight (`bg-yellow-400 text-gray-950 font-black animate-bounce`).
  - Click word pill to seek audio to `w.start`.

---

### Task 5: Build Verification & Testing

- [ ] **Step 1: Check TypeScript types**

Run: `npx tsc --noEmit` in `dashboard/`
Expected: 0 errors.

- [ ] **Step 2: Validate Vite build**

Run: `npm run build -w dashboard`
Expected: Successful build output.
