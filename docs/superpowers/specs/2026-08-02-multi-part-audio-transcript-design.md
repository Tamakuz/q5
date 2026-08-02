# Design Spec: Multi-Part Audio Transcript & Naskah Reference System

**Date:** 2026-08-02  
**Status:** Approved by User  
**Approach:** Approach A — Grouped Object JSON for Multi-Part Audio Transcripts with Reference Script Integration

---

## 🎯 Goal
When a single voiceover audio file covers multiple split video parts (e.g., 1 audio file for Parts #1, #2, #3, #4):
1. Inject the original recap script text (from Step 2 Script Analysis) into the Transcript Prompt as a reference so the AI Transcriber does not hallucinate.
2. Instruct the AI Transcriber to output a Grouped JSON Object keyed by part number (`{ "1": [...], "2": [...], ... }`).
3. Automatically split and save individual transcript files (`transcript_part_01.json`, `transcript_part_02.json`, etc.) in disk upon a single Save/Import action in the dashboard.

---

## 🏗️ Architecture & Component Changes

### 1. Transcript Prompt Template (`dashboard/prompts/longform/alurfilm-transcript-prompt.md`)
- Add `{{reference_script}}` section providing script text from Step 2 for all target parts.
- Add dynamic output instructions:
  - **Single-Part Mode:** Output JSON Array `[ { ... }, { ... } ]`.
  - **Multi-Part Mode:** Output Grouped JSON Object `{ "1": [ ... ], "2": [ ... ] }`.

### 2. Backend IPC Handlers (`dashboard/electron/ipc/alurfilmHandlers.cjs`)

#### `get-alurfilm-transcript-prompt`
- Inspect `audio_mappings.json` to check which parts are assigned to the target audio file.
- For each target part, read `analysis_part_XX.json` and extract `naskah_voiceover.script_text`.
- Format `{{reference_script}}` with clear headers:
  ```text
  --- NASKAH ACUAN PART #1 ---
  [script_text_1]

  --- NASKAH ACUAN PART #2 ---
  [script_text_2]
  ...
  ```
- Pass `{{audio_duration}}`, `{{target_parts_text}}`, and `{{reference_script}}` to the prompt template.

#### `save-alurfilm-transcript`
- Support parsing both array format `[...]` and object format `{ "1": [...], "2": [...] }`.
- If root JSON is an object with part keys (`"1"`, `"2"`, `"part_1"`, etc.):
  - Iterate each part key.
  - Normalize entries (`start_seconds`, `end_seconds`, `timestamp_minute`, `text`, `speaker`).
  - Save to `${contentId}_transcript_part_${partPadded}.json`.
  - Return `{ success: true, savedParts: [1, 2, 3, 4], totalEntries: N }`.
- If root JSON is a standard array `[...]`:
  - Save to the target `chunkPart` file as usual.

### 3. Frontend Component (`dashboard/src/components/longform/AlurfilmTranscriptStep.tsx`)
- When saving/importing JSON via modal:
  - Call `api.saveAlurfilmTranscript(contentId, activePart, parsed)`.
  - Update `transcripts` state for all saved parts returned by the backend.
  - Show toast: `🎉 Saved Transcripts for Parts #1, #2, #3, #4!`.
- Update prompt copy button to copy the enhanced prompt containing reference scripts and multi-part instructions.

---

## 🔍 Verification Plan

### Manual Verification
1. Open Dashboard -> **Step 4: Audio Transcript**.
2. Select **Part #1** (which covers Parts #1..#4).
3. Click **Copy Prompt**: Verify that the prompt includes the reference scripts from Step 2 for Parts 1..4, total audio duration, and instructions to output `{ "1": [...], "2": [...] }`.
4. Paste a sample multi-part JSON:
   ```json
   {
     "1": [ { "id": 1, "start_seconds": 0.0, "end_seconds": 5.0, "text": "Testing Part 1" } ],
     "2": [ { "id": 1, "start_seconds": 5.0, "end_seconds": 10.0, "text": "Testing Part 2" } ]
   }
   ```
5. Save JSON: Verify that both `Part #1` and `Part #2` update immediately with checkmarks ✓ and individual transcript entries.
