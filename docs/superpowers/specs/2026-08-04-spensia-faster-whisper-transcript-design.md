# Spensia Faster-Whisper Sentence & Word Level Transcript Specification

## Executive Summary
This feature introduces automatic, local audio transcription using Faster-Whisper (`whisperx/align_cli.py`) specifically for the **Spensia** module (Step 6: Voice Over & Audio Mapping). It replaces manual Gemini prompt copy-pasting with a 1-click automatic process, providing hierarchical **Sentence-Level** transcripts containing nested **Word-Level** timestamps (`sentences[].words[]`). This feature is strictly scoped to Spensia and does not alter the output format or functionality of Alurfilm, Shortform, or UGC workflows.

---

## 1. Scope & Isolation Rules
- **Module Scope**: Strictly limited to Spensia (`dashboard/src/components/spensia/*`, `dashboard/electron/ipc/spensiaHandlers.cjs`, and Spensia data utilities).
- **Backward Compatibility**: Existing modules (Alurfilm, Shortform) using `align_cli.py` will continue receiving their standard `entries` array output without breaking changes.
- **Fallbacks**: Manual JSON pasting in Spensia Step 6 remains supported for offline or external transcript imports.

---

## 2. Technical Architecture & Data Structures

### A. Python Alignment CLI Extension (`whisperx/align_cli.py`)
Add an optional flag `--spensia-format` or structured format generator in `align_cli.py`:
When enabled or when generating Spensia alignment output:
```json
{
  "mode": "faster-whisper-spensia",
  "audio_duration": 125.4,
  "sentences": [
    {
      "sentence_id": 1,
      "text": "Bayangkan kamu bangun sebagai bangsawan Prancis abad ke-17.",
      "start": 0.0,
      "end": 4.25,
      "words": [
        { "word": "Bayangkan", "start": 0.0, "end": 0.52 },
        { "word": "kamu", "start": 0.53, "end": 0.81 },
        { "word": "bangun", "start": 0.82, "end": 1.20 },
        { "word": "sebagai", "start": 1.21, "end": 1.55 },
        { "word": "bangsawan", "start": 1.56, "end": 2.10 },
        { "word": "Prancis", "start": 2.11, "end": 2.70 },
        { "word": "abad", "start": 2.71, "end": 3.10 },
        { "word": "ke-17.", "start": 3.11, "end": 4.25 }
      ]
    }
  ],
  "words": [ /* flat word timestamps array */ ],
  "chunks": [ /* phrase chunk timestamps array */ ]
}
```

### B. IPC Handler (`dashboard/electron/ipc/spensiaHandlers.cjs`)
Create `run-spensia-whisperx-alignment`:
- Accepts `audioPath` (path to merged voiceover `.mp3`/`.wav`) and `scriptText` (full script text from Spensia Step 2).
- Spawns `whisperx/venv/bin/python3 align_cli.py` with `--audio`, `--text`, `--spensia-format`.
- Emits real-time progress events (`spensia-whisper-progress`) to update UI status percentage and messages.
- Saves result to `input/spensia/transcripts/merged_transcript_topic_{topicId}.json` and returns the parsed JSON.

### C. Validation & Normalization (`dashboard/src/utils/spensiaValidation.ts`)
Update `SpensiaTranscriptData` interface and `validateSpensiaWordTranscript`:
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
- If input has `sentences`, validate and retain `sentences[].words`.
- If input only has flat `words`, automatically split into sentences based on punctuation (`.`, `!`, `?`) and pause durations (>0.5s).

### D. UI Enhancements in Step 6 (`SpensiaVoiceOverStep.tsx`)
- **Auto Transcript Button**: Prominent `⚡ Transkrip Otomatis (Faster-Whisper)` button next to audio controls.
- **Progress Indicator**: Shows real-time progress bar and log text during Faster-Whisper execution.
- **Sentence-Level Transkrip Inspector**:
  - Add tab button: `💬 Kalimat (Sentence & Words)` alongside `🧩 Phrase Chunks`, `⏱️ Words`, `📜 Full Text`.
  - Render list of Sentence Cards (`#1`, `#2`, ...).
  - Inside each Sentence Card, display text + time range (`00:00 ➔ 00:04`).
  - Render word pills inside the sentence card.
  - When audio plays, highlight current active sentence card (green border) AND bounce/highlight current active word pill (yellow background).
  - Clicking any sentence or word seeks audio playback directly to `start` timestamp.

---

## 3. Verification Plan

### Automated / Syntax Check
1. Build TypeScript / Vite in dashboard (`npm run build -w dashboard` or `npx tsc --noEmit`).
2. Run Python syntax check on `align_cli.py`: `python3 -m py_compile whisperx/align_cli.py`.

### Manual Verification
1. Open Spensia workflow Step 6 (VoiceOver).
2. Upload narration audio file.
3. Click `⚡ Transkrip Otomatis (Faster-Whisper)`.
4. Verify progress status updates and transcript generated without errors.
5. Inspect `💬 Kalimat (Sentence & Words)` tab:
   - Confirm sentence list with nested word pills.
   - Play audio and verify sentence border and word pill highlight sync in real-time.
6. Verify Alurfilm and Shortform modules remain untouched and operational.
