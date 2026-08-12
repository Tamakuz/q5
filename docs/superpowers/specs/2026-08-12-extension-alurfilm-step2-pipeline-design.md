# Alurfilm Step 2 Script Generation Pipeline Design

## Goal
Implement a production pipeline script in `playwright/pipelines/alurfilm-step2-script-pipeline.ts` that integrates Alurfilm Step 2 prompt template (`dashboard/prompts/longform/alurfilm-singlepass-prompt.md`) with dynamic placeholders, media attachment via Google Drive or local fallback, prompt submission, AI output extraction, JSON/text validation, and saving to `input/alurfilm/`.

## Architecture & Data Flow

```
+-----------------------------------------------------------------------------------------+
| Alurfilm Step 2 Script Pipeline (playwright/pipelines/alurfilm-step2-script-pipeline.ts)|
|                                                                                         |
|  1. Load Prompt Template: dashboard/prompts/longform/alurfilm-singlepass-prompt.md      |
|  2. Substitute Placeholders:                                                            |
|      - {{chunk_part}}              - {{total_chunks}}                                  |
|      - {{is_first_part}}           - {{is_last_part}}                                  |
|      - {{target_words_per_chunk}}  - {{previous_context}}                              |
|      - {{style_example}}                                                                |
|                                                                                         |
|  3. Execute Chrome Extension Actions:                                                   |
|      Step A: inputPrompt (rendered prompt)                                              |
|      Step B: openDrivePicker                                                            |
|      Step C: searchDriveFile -> selectDriveFile (or uploadLocalFile fallback)           |
|      Step D: submitPrompt                                                               |
|      Step E: extractOutput (streaming text stabilization)                               |
|                                                                                         |
|  4. Validate & Save Output:                                                             |
|      - saveScriptOutput(extractedText, targetVideoPath)                                 |
|      - Writes to input/alurfilm/<video_basename>_script.json                            |
|      - Writes to input/alurfilm/<video_basename>_script.txt                            |
+-----------------------------------------------------------------------------------------+
```

## Options & Parameters

```typescript
export interface AlurfilmStep2PipelineOptions {
  targetVideoPath?: string;    // Default: 'input/alurfilm/compress/WV-FILM-20260811-CTBB_part_01.mp4'
  chunkPart?: number;          // Default: 1
  totalChunks?: number;        // Default: 1
  isFirstPart?: boolean;       // Default: true
  isLastPart?: boolean;        // Default: true
  targetWordsPerChunk?: number;// Default: 300
  previousContext?: string;    // Default: 'Belum ada (Part 1 Pembuka)'
  styleExample?: string;       // Default: 'Formal-Santai Dewasa (TTS Neutral & Familiar)'
  headed?: boolean;            // Default: true
  timeout?: number;            // Default: 180000
}
```
