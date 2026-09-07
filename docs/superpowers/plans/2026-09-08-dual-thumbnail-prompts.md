# Dual Thumbnail Prompts (Q5 & Q5Asia) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide direct action buttons for Q5 and Q5Asia prompt copying and metadata generation in Step 7 (Metadata Studio).

**Architecture:** Create separate prompt markdown files (`alurfilm-thumbnail-prompt-q5.md` and `alurfilm-thumbnail-prompt-q5asia.md`), extend IPC handlers to support `promptType` selection, and update `AlurfilmMetadataStep.tsx` with explicit action buttons.

**Tech Stack:** React (TypeScript), Tailwind CSS, Electron IPC (Node.js).

## Global Constraints
- Do not use dropdowns for prompt selection; expose direct buttons.
- Preserve backward compatibility for existing IPC calls.

---

### Task 1: Create Prompt Template Files

**Files:**
- Create: `dashboard/prompts/longform/alurfilm-thumbnail-prompt-q5.md`
- Create: `dashboard/prompts/longform/alurfilm-thumbnail-prompt-q5asia.md`

**Interfaces:**
- Consumes: Raw Q5 prompt template from git history (`cb94586`) & existing Q5Asia prompt template.
- Produces: Two distinct prompt template files in `dashboard/prompts/longform/`.

- [ ] **Step 1: Write `alurfilm-thumbnail-prompt-q5.md`**
- [ ] **Step 2: Write `alurfilm-thumbnail-prompt-q5asia.md`**
- [ ] **Step 3: Commit prompt files**

---

### Task 2: Update Electron IPC Handlers & Preload API

**Files:**
- Modify: `dashboard/electron/ipc/alurfilmHandlers.cjs`
- Modify: `dashboard/src/electron-api.ts`

**Interfaces:**
- Consumes: `promptType` option (`'q5' | 'q5asia'`) in IPC payloads.
- Produces: Updated `get-alurfilm-image-ready-prompt` and `generate-alurfilm-metadata` IPC handlers.

- [ ] **Step 1: Update IPC handlers in `alurfilmHandlers.cjs` to select prompt file based on `promptType`**
- [ ] **Step 2: Update TypeScript types in `electron-api.ts`**
- [ ] **Step 3: Commit IPC updates**

---

### Task 3: Update `AlurfilmMetadataStep.tsx` UI

**Files:**
- Modify: `dashboard/src/components/longform/AlurfilmMetadataStep.tsx`

**Interfaces:**
- Consumes: `window.electronAPI.getAlurfilmImageReadyPrompt({ promptType, customNotes })` & `generateAlurfilmMetadata({ promptType, model, customNotes })`.
- Produces: Direct `Prompt Q5` / `Prompt Q5Asia` copy buttons and `Generate Q5` / `Generate Q5Asia` metadata buttons.

- [ ] **Step 1: Add prompt copy handlers (`handleCopyPromptQ5` & `handleCopyPromptQ5Asia`)**
- [ ] **Step 2: Update generate handler to accept `promptType`**
- [ ] **Step 3: Render direct action buttons in UI header banner**
- [ ] **Step 4: Commit UI changes**
