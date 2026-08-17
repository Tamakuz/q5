# Shorts Step 3: Voiceover Audio & Transcript Sync Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Step 3 (Voiceover Audio & Transcript Sync Studio) for the Shorts module, enabling VO audio upload per segment, Faster-Whisper automatic sentence alignment, interactive transcript editing, bilingual support (Indo & English), and JSON persistence.

**Architecture:** Electron IPC handlers in `projectHandlers.cjs`, preload & API bridges, React UI component `ShortsAudioStep.tsx`.

---

### Task 1: Add Electron IPC Handlers for Shorts Audio & Alignment

**Files:**
- Modify: `dashboard/electron/ipc/projectHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`
- Modify: `dashboard/src/electron-api.ts`

- [ ] **Step 1: Add `shorts:upload-vo-audio` and `shorts:run-whisper-alignment` in `projectHandlers.cjs`**

Add IPC handlers to handle uploading audio to `input/shorts/audio/` and spawning Python `whisperx/align_cli.py`.

- [ ] **Step 2: Expose IPC methods in `preload.cjs` and `electron-api.ts`**

Expose `uploadShortsVoAudio` and `runShortsWhisperAlignment` to window.electronAPI.

- [ ] **Step 3: Commit IPC additions**

```bash
git add dashboard/electron/ipc/projectHandlers.cjs dashboard/electron/preload.cjs dashboard/src/electron-api.ts
git commit -m "feat(shorts): add IPC handlers for Shorts voiceover audio upload and Faster-Whisper alignment"
```

---

### Task 2: Update Sidebar Navigation & App Routing for Step 3

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Register Step 3 in `Sidebar.tsx`**

Add step 3 to `SHORTS_STEPS`:
```typescript
{ id: 'audio', icon: '🎙️', label: '3. Audio & Transcript', subText: 'Upload VO & align timestamp' },
```

- [ ] **Step 2: Update `App.tsx` routing for `activeStep === 'audio'`**

Import `ShortsAudioStep` and render it when `contentMode === 'shorts'` and `activeStep === 'audio'`.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/common/Sidebar.tsx dashboard/src/App.tsx
git commit -m "feat(shorts): register step 3 Audio & Transcript in Sidebar and App router"
```

---

### Task 3: Build `ShortsAudioStep.tsx` Component

**Files:**
- Create: `dashboard/src/components/shorts/ShortsAudioStep.tsx`

- [ ] **Step 1: Implement `ShortsAudioStep.tsx`**

Features:
- Segment list sidebar read from `input/shorts/script-segments.json`.
- Language toggle (`🇮🇩 Indo` & `🇺🇸 English`).
- Drag-and-drop or file picker for VO audio (`.mp3`, `.wav`, `.m4a`).
- HTML5 `<audio ref={audioRef} src={mediaUrl} controls />` player.
- Faster-Whisper alignment trigger button.
- Transcript Table Editor (sentence text, start sec, end sec, play line button).
- Persistence: `input/shorts/audio-transcripts.json`.

- [ ] **Step 2: Verify Build**

Run: `npm run build -w dashboard`
Expected: Build passes with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/shorts/ShortsAudioStep.tsx
git commit -m "feat(shorts): implement step 3 ShortsAudioStep for VO upload and transcript alignment"
```
