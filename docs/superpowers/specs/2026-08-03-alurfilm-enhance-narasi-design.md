# Alur Film Script Narration Enhancer (Gemini TTS Optimization) - Design Specification

## Overview
This feature introduces an AI-powered narration enhancement button ("✨ Enhance Narasi") in **Flow 2: Script Generator (`AlurfilmAnalyzeStep.tsx`)**. 
The enhancer takes an existing recap script text and optimizes its flow, rhythm, sentence structure, and breathing points using `9router` with the `ag/gemini-3-flash-agent` model. It applies 10 specific AI voice-over optimization rules for TTS tools like Gemini TTS without altering the story, facts, or dialogue meaning.

---

## 1. Voiceover Optimization Rules & System Prompt
The system prompt passed to 9router enforces the 10 core TTS optimization rules:
1. **Preserve Content**: Never change story, chronology, facts, names, or dialogue meaning.
2. **Merge Related Actions**: Merge fragmented sentences belonging to the same action/event.
3. **Sentence Length Variety**: Mix short (8-12 words for dramatic impact), medium (15-30 words average), and long (30-40 words for continuous action) sentences.
4. **Natural Connectives**: Avoid overusing periods; connect ideas using words like `dan`, `hingga`, `sementara`, `lalu`, `namun`, `meski begitu`, `bahkan`, `sehingga`, `karena`, `setelah itu`, `di saat yang sama`.
5. **Breathing Rhythm Commas**: Use commas for breathing rhythm instead of hard stops.
6. **Logical Paragraphs**: Paragraph breaks only on scene/location/topic/emotional shifts.
7. **Cinematic Pacing**: Preserve fast action pacing and slow emotional beats.
8. **Conversational Recapper Tone**: Professional YouTube recap narrator voice.
9. **No Bullet Points / Lists**: Flow naturally as a story.
10. **Strict Output**: Output ONLY the improved narration without explanations, summaries, code blocks, or comments.

Prompt template location: `dashboard/prompts/longform/enhance-voiceover-prompt.md`.

---

## 2. Backend Architecture (`alurfilmHandlers.cjs`)

### IPC Handler: `alurfilm:enhance-script`
- **Arguments**: `({ contentId, partNum })`
- **Execution Flow**:
  1. Load existing script analysis JSON for `partNum` from `dashboard/data/longform/{contentId}/analysis_part_{partNum}.json`.
  2. Extract `script_text` from `data.naskah_voiceover`. If missing/empty, return error `No script text available for part ${partNum}`.
  3. Load `enhance-voiceover-prompt.md`.
  4. Call `aiClient.chatCompletion`:
     - `model`: `'ag/gemini-3-flash-agent'`
     - `systemPrompt`: Content of `enhance-voiceover-prompt.md`
     - `prompt`: Existing `script_text`
  5. Clean response text (strip markdown code blocks if any).
  6. Recalculate `word_count` (splitting text by whitespace).
  7. Update `data.naskah_voiceover.script_text` and `data.naskah_voiceover.word_count`.
  8. Save updated analysis file back to disk.
  9. Return updated `AlurfilmAnalysisResult` object.

---

## 3. Preload & API Bridge (`preload.cjs` & `electron-api.ts`)
- Add method to `electron-api.ts`: `enhanceAlurfilmScript(contentId: string, partNum: number): Promise<AlurfilmAnalysisResult>`
- Register channel in `preload.cjs` and `renderHandlers.cjs` mapping `enhanceAlurfilmScript` to `alurfilm:enhance-script`.

---

## 4. Frontend Component (`AlurfilmAnalyzeStep.tsx`)
- Add `isEnhancing` loading state (`boolean`).
- Add **"✨ Enhance Narasi"** button to the header of the Script tab next to the **📋 Copy** button:
  - Enabled when `currentAnalysis?.naskah_voiceover?.script_text` exists and `!isEnhancing`.
  - Disabled during execution with spinner and text `⌛ Enhancing Narasi (ag/gemini)...`.
- On completion:
  - Updates `analyses[activePart]` state in React.
  - Displays toast notification: `✨ Narasi Part #${activePart} berhasil di-enhance untuk AI Voice-Over!`.

---

## 5. Verification Plan
1. Launch app (`npm run dev -w dashboard`).
2. Go to **Flow 2: Film Script Generator**.
3. Select or import a script analysis JSON for Part 1.
4. Click **✨ Enhance Narasi**.
5. Verify button shows loading state during API call to 9router with `ag/gemini-3-flash-agent`.
6. Verify script text updates in UI with improved flow, sentence structure, and word count.
7. Verify file `analysis_part_1.json` on disk is updated with the enhanced narration text.
