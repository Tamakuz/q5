# Alurfilm Step 2 Script Generation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `playwright/pipelines/alurfilm-step2-script-pipeline.ts` integrating `dashboard/prompts/longform/alurfilm-singlepass-prompt.md` with dynamic parameters, Chrome Extension actions, AI output extraction, JSON/text validation, and saving to `input/alurfilm/`.

---

### Task 1: Implement `alurfilm-step2-script-pipeline.ts` & Register in Service

**Files:**
- Create: [playwright/pipelines/alurfilm-step2-script-pipeline.ts](file:///home/jovan/project/content-auto/playwright/pipelines/alurfilm-step2-script-pipeline.ts)
- Modify: [playwright/service.ts](file:///home/jovan/project/content-auto/playwright/service.ts)

- [ ] **Step 1: Create `playwright/pipelines/alurfilm-step2-script-pipeline.ts`**
  Implement `runAlurfilmStep2ScriptPipeline` function that reads prompt template, substitutes placeholders, runs extension actions, extracts output, validates JSON/text, and saves files.

- [ ] **Step 2: Update `playwright/service.ts`**
  Export `runAlurfilmStep2ScriptPipeline` from `PlaywrightService`.

---

### Task 2: Execute & Verify Pipeline Run

**Files:**
- Test File: [playwright/pipelines/alurfilm-step2-script-pipeline.ts](file:///home/jovan/project/content-auto/playwright/pipelines/alurfilm-step2-script-pipeline.ts)

- [ ] **Step 1: Execute `npx tsx playwright/pipelines/alurfilm-step2-script-pipeline.ts`**
  Run pipeline and verify JSON & text output in `input/alurfilm/`.
