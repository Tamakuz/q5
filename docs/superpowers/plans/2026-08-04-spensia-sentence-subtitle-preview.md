# Spensia Sentence Subtitle Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Live Canvas Subtitle Overlay Preview (16:9) in Spensia Step 8 (Render Studio) using Slate-300 (`#CBD5E1`) color palette and default Sentence (`sentence`) display mode.

**Architecture:** Update `spensiaTheme.ts` & `spensiaRenderConfig.ts` schema defaults, enhance `PreviewCanvas` & config controls in `SpensiaRenderStep.tsx` for real-time subtitle preview, and update `spensiaHandlers.cjs` `buildAssSubtitleFile` to handle sentence-level ASS subtitle rendering with Slate color.

**Tech Stack:** TypeScript, React, Tailwind CSS, Zod, Electron IPC, FFmpeg ASS Subtitles.

---

### Task 1: Theme & Config Schema (`spensiaTheme.ts` & `spensiaRenderConfig.ts`)

**Files:**
- Modify: `dashboard/src/utils/spensiaTheme.ts:6-13`
- Modify: `dashboard/src/utils/spensiaRenderConfig.ts:30-46`

- [ ] **Step 1: Update Theme Color Tokens**
  - Set `inactiveColorHex` in `SPENSIA_CAPTION_COLORS` to `'#CBD5E1'` (Slate-300).

- [ ] **Step 2: Update CaptionConfigSchema in Zod**
  - Add `'sentence'` to `displayMode` enum: `z.enum(['single-word', 'phrase', 'sentence']).default('sentence')`.
  - Set `enabled: z.boolean().default(true)`.
  - Set `inactiveColorHex: z.string().default(SPENSIA_CAPTION_COLORS.inactiveColorHex)`.

---

### Task 2: Live Canvas Subtitle Overlay & Render Studio UI Controls (`SpensiaRenderStep.tsx`)

**Files:**
- Modify: `dashboard/src/components/spensia/SpensiaRenderStep.tsx:37-108`
- Modify: `dashboard/src/components/spensia/SpensiaRenderStep.tsx:1000-1150`

- [ ] **Step 1: Add Subtitle Overlay to `PreviewCanvas`**
  - Render subtitle overlay inside `PreviewCanvas` when `config.caption.enabled` is true.
  - Display sample sentence subtitle text: `"Bayangkan kamu terbangun di jam 2 pagi di tengah kegelapan..."` (or snippet from topic script).
  - Style with `color: config.caption.inactiveColorHex || '#CBD5E1'`, `fontSize: scale(config.caption.fontSize)`, `bottom: scale(config.caption.positionY || 160)`, `fontFamily: config.caption.fontName || 'Montserrat'`, `textShadow: '0px 2px 6px rgba(0,0,0,0.95)'`, `textAlign: 'center'`.

- [ ] **Step 2: Add Subtitle Control Config Section in Step 8**
  - Add **Subtitel & Caption Engine Config Section** in `SpensiaRenderStep.tsx`.
  - Toggle Switch: Subtitle On/Off (`config.caption.enabled`).
  - Display Mode Selector: `Kalimat (Sentence)` | `Frasa (Phrase)` | `Kata (Single Word)`.
  - Color Palette Presets: `Slate (#CBD5E1)` | `White (#FFFFFF)` | `Emerald Highlight (#22C55E)`.
  - Sliders for Font Size (`fontSize`), Position Y (`positionY`).

---

### Task 3: ASS Subtitle Generator Engine (`spensiaHandlers.cjs`)

**Files:**
- Modify: `dashboard/electron/ipc/spensiaHandlers.cjs:8-58`

- [ ] **Step 1: Add `sentence` Mode Support to `buildAssSubtitleFile`**
  - Update `buildAssSubtitleFile` to handle `displayMode === 'sentence'`: group words by sentence boundaries or ~10 words per dialogue line.
  - Apply Slate inactive color (`hexToAssColor('#CBD5E1')`) and active highlight (`#22C55E`).

---

### Task 4: Verification & Build Validation

- [ ] **Step 1: Run TypeScript Verification**
  - Run `npx tsc --noEmit` in `dashboard/` to verify zero type errors.

- [ ] **Step 2: Confirm Live Canvas Preview Visuals**
  - Verify subtitel preview displays cleanly in Slate color on the 16:9 canvas.
