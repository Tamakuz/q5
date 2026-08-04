# Spensia Render Studio Vertical Layout & Subtitle Color Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-architect Spensia Step 8 (Render Studio) into a full-width vertical stacked layout with a large 16:9 Live Canvas Preview (`max-w-4xl`), and fix the subtitle color rendering & text stroke scaling so white/slate colors display cleanly.

**Architecture:** Increase `PREVIEW_SCALE` from `0.25` to `0.45` in `PreviewCanvas`, refine CSS text-stroke & drop-shadow calculation, add custom `<ColorInput>` for subtitle color, and reorganize `SpensiaRenderStep.tsx` layout into top canvas + bottom config sections.

**Tech Stack:** React, Tailwind CSS, TypeScript.

---

### Task 1: Refine `PreviewCanvas` Scale Factor & Subtitle Text Outline (`SpensiaRenderStep.tsx`)

**Files:**
- Modify: `dashboard/src/components/spensia/SpensiaRenderStep.tsx:31-135`

- [ ] **Step 1: Increase `PREVIEW_SCALE` to `0.45`**
  - Change `PREVIEW_SCALE = 0.45` (864px preview width inside `max-w-4xl` container).

- [ ] **Step 2: Fix Subtitle Stroke & Color CSS**
  - Compute outline width: `Math.max(0.5, scale(cap?.outlineWidth || 2) * 0.6)`.
  - Apply `color: capColor` explicitly with high-contrast text shadow:
    `textShadow: '0 2px 8px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95)'`.
  - Ensure `#FFFFFF` (White) and `#CBD5E1` (Slate) render with 100% color fidelity.

---

### Task 2: Vertical Stacked Layout & Subtitle Color Input (`SpensiaRenderStep.tsx`)

**Files:**
- Modify: `dashboard/src/components/spensia/SpensiaRenderStep.tsx:847-1150`

- [ ] **Step 1: Convert Main Studio Grid to Vertical Stack**
  - Move **LIVE CANVAS PREVIEW (CSS OVERLAY)** to top full-width card with container size `max-w-4xl`.
  - Place Render Progress Bar directly beneath top preview card.
  - Stack Config Sections below in clean 2-column or full-width layout.

- [ ] **Step 2: Add Custom Subtitle ColorInput**
  - Add `<ColorInput label="Warna Teks Custom" value={config.caption?.inactiveColorHex || '#CBD5E1'} onChange={(v) => updateCaption({ inactiveColorHex: v })} />` to the Subtitel & Caption Engine ConfigSection.

---

### Task 3: Verification & Build Validation

- [ ] **Step 1: Run TypeScript Verification**
  - Run `npx tsc --noEmit` in `dashboard/`.

- [ ] **Step 2: Visual Inspection**
  - Confirm large preview canvas renders at top and text color updates dynamically when selecting White (`#FFFFFF`), Slate (`#CBD5E1`), or custom colors.
