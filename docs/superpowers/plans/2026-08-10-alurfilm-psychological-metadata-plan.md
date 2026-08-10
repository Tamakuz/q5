# Alur Film Psychological Metadata Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade YouTube Alur Film metadata generation to parse 5 deep story context anchors and map them directly into 5 psychological CTR titles & thumbnail concepts, eliminating generic/hallucinated titles.

**Architecture:** Update `docs/knowledge/youtube-alurfilm.md` strategy documentation and enhance the system prompt inside `dashboard/electron/ipc/alurfilmHandlers.cjs` (`alurfilm:generate-metadata`).

**Tech Stack:** Node.js (CommonJS), Markdown, TypeScript / React (Electron IPC).

## Global Constraints

- Preserve 100% JSON schema output format expected by `AlurfilmMetadataStep.tsx`.
- Strictly enforce zero hallucinated metaphors (such as fake professions, fake bank codes, or ungrounded idioms like "menggebrak panggung gendang" when not in script).
- Ensure 5 emotion categories are returned (`underdog`, `balas_dendam`, `aksi_nekat`, `kaget`, `misteri`).

---

### Task 1: Update YouTube Alurfilm Content Strategy Knowledge Base

**Files:**
- Modify: `docs/knowledge/youtube-alurfilm.md:110-150`

**Interfaces:**
- Consumes: User feedback on psychological CTR title formula & drumbeat concept.
- Produces: Updated knowledge standard for AI agents & metadata prompts.

- [ ] **Step 1: Edit `docs/knowledge/youtube-alurfilm.md`**

Add the "🧠 Psikologi Tabuhan Gendang Emosi (Primal Psychological Emotional Drumbeat)" section explaining the 5 emotional drivers (Underdog, Balas Dendam/Penyesalan, Aksi Nekat, Syok/Kontradiksi, Misteri) and the 5-Anchor Story Extraction rule.

- [ ] **Step 2: Verify Markdown formatting**

View file `docs/knowledge/youtube-alurfilm.md` to ensure sections render cleanly.

- [ ] **Step 3: Commit changes**

```bash
git add docs/knowledge/youtube-alurfilm.md
git commit -m "docs: add psychological emotional drumbeat framework to youtube-alurfilm strategy"
```

---

### Task 2: Upgrade Prompt Engineering in `alurfilmHandlers.cjs`

**Files:**
- Modify: `dashboard/electron/ipc/alurfilmHandlers.cjs:1810-1875`

**Interfaces:**
- Consumes: Naskah, character registry, macro summaries, timeline focus, and user notes.
- Produces: Strictly factual 5-category psychological CTR titles and thumbnail prompts matching UI JSON schema.

- [ ] **Step 1: Update System Prompt in `dashboard/electron/ipc/alurfilmHandlers.cjs`**

Rewrite the `systemPrompt` variable in `alurfilm:generate-metadata` IPC handler to enforce:
1. Tahap 1: Deep Story Context & 5-Anchor Extraction (`underdog_status`, `survival_stakes`, `extreme_action`, `antagonist_oppression`, `emotional_payoff`).
2. Tahap 2: Mapping anchors to 5 CTR Titles using the formula `[Tindakan Ekstrem / Perjuangan Nyata] + [Status Karakter Underdog] + [Konflik / Puncak Emosi Realistis] — Alur Cerita Film`.
3. Strict anti-hallucination guardrail against fake idioms or professions.

- [ ] **Step 2: Test syntax & TypeScript/CJS compatibility**

Run: `npm run build` or `npx tsc --noEmit` in `dashboard` workspace if available.

- [ ] **Step 3: Commit changes**

```bash
git add dashboard/electron/ipc/alurfilmHandlers.cjs
git commit -m "feat(alurfilm): upgrade metadata generator prompt with 5-anchor psychological drumbeat extraction"
```

---

### Task 3: Verification & Walkthrough Creation

**Files:**
- Modify/Create: `<appDataDir>/brain/<conversation-id>/walkthrough.md`

- [ ] **Step 1: Verify code build & git status**

Run `git status` and ensure all files compile without syntax errors.

- [ ] **Step 2: Write Walkthrough artifact**

Summarize changes made and verify requirements are fully satisfied.
