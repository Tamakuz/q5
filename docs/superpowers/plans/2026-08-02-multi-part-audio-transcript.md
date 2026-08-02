# Multi-Part Audio Transcript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable multi-part audio transcription with Step 2 script reference injection and automatic per-part JSON saving in `content-auto`.

**Architecture:** Update `alurfilm-transcript-prompt.md` template, update IPC prompt generator & save handlers in `alurfilmHandlers.cjs`, and update frontend `AlurfilmTranscriptStep.tsx` state updates.

**Tech Stack:** TypeScript, React, Electron IPC, Node.js fs.

---

### Task 1: Update Transcript Prompt Template
**Files:**
- Modify: `dashboard/prompts/longform/alurfilm-transcript-prompt.md`

- [ ] **Step 1: Edit `alurfilm-transcript-prompt.md` to include reference script section and Grouped JSON Object format for multi-part audio**

---

### Task 2: Backend IPC Handler Updates
**Files:**
- Modify: `dashboard/electron/ipc/alurfilmHandlers.cjs`

- [ ] **Step 1: Update `get-alurfilm-transcript-prompt` to inject `{{reference_script}}` for target audio parts**
- [ ] **Step 2: Update `save-alurfilm-transcript` to detect grouped JSON objects `{ "1": [...], "2": [...] }` and auto-save per-part JSON files**

---

### Task 3: Frontend Component Update
**Files:**
- Modify: `dashboard/src/components/longform/AlurfilmTranscriptStep.tsx`

- [ ] **Step 1: Update save/import handler to support multi-part save response and refresh all affected part transcripts**
