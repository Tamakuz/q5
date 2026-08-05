# Vann Workflow Step Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder Step 6 ("Voice & Timeline Studio" / `publish`) to Step 3 in the Vann workflow so Voiceover audio and timing are generated after Script (Step 2) and before Scene Splitter (Step 4).

**Architecture:** Update `VANN_STEPS` in `Sidebar.tsx` and `WAKU_STEPS` in `WorkflowHeader.tsx` to reflect the new step order (`source` -> `analyze` -> `publish` -> `audio` -> `mapping` -> `render` -> `upload` -> `thumbnail`), and update inter-step navigation callback in `VannVoiceOverStep.tsx`.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS.

## Global Constraints
- Preserve all existing functionality for Spensia, Longform, and UGC workflows.
- Step IDs (`source`, `analyze`, `publish`, `audio`, `mapping`, `render`, `upload`, `thumbnail`) must remain valid `StepId` values.

---

### Task 1: Update Navigation Step Definitions for Vann Workflow

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx:15-24`
- Modify: `dashboard/src/components/common/WorkflowHeader.tsx:12-19`

**Interfaces:**
- Consumes: `StepId` type from `Sidebar.tsx`
- Produces: Updated `VANN_STEPS` and `WAKU_STEPS` lists with `publish` as step 3.

- [ ] **Step 1: Update VANN_STEPS array in `Sidebar.tsx`**

Modify `VANN_STEPS` in `dashboard/src/components/common/Sidebar.tsx` so step 3 is Voice & Timeline Studio (`publish`), step 4 is Scene Splitter (`audio`), step 5 is Image Prompt Generator (`mapping`), step 6 is Image Generator (`render`), step 7 is Render Studio (`upload`), step 8 is Publish Hub (`thumbnail`).

- [ ] **Step 2: Update WAKU_STEPS array in `WorkflowHeader.tsx`**

Modify `WAKU_STEPS` in `dashboard/src/components/common/WorkflowHeader.tsx` so step 3 is Voice Over (`publish`), step 4 is Scene Splitter (`audio`), step 5 is Image Prompts (`mapping`), step 6 is Image Generator (`render`).

- [ ] **Step 3: Commit navigation updates**

```bash
git add dashboard/src/components/common/Sidebar.tsx dashboard/src/components/common/WorkflowHeader.tsx
git commit -m "feat(vann): update step order placing Voice & Timeline Studio at step 3"
```

---

### Task 2: Update Navigation Action in Vann VoiceOver Component

**Files:**
- Modify: `dashboard/src/components/vann/VannVoiceOverStep.tsx:73-77,1370-1372`

**Interfaces:**
- Consumes: `onStepChange` prop callback
- Produces: Navigates to `audio` (Scene Splitter - Step 4) upon completion of Voice Over step.

- [ ] **Step 1: Update VannVoiceOverStepProps and transition target**

In `dashboard/src/components/vann/VannVoiceOverStep.tsx`:
Change `onStepChange?: (step: 'upload') => void;` to `onStepChange?: (step: StepId) => void;` (importing `StepId` from `../common/Sidebar`).
Change `onClick={() => onStepChange('upload')}` to `onClick={() => onStepChange('audio')}`.

- [ ] **Step 2: Verify UI Build / TypeScript check**

Run build or typecheck to ensure no errors.

- [ ] **Step 3: Commit component navigation updates**

```bash
git add dashboard/src/components/vann/VannVoiceOverStep.tsx
git commit -m "feat(vann): update voiceover next step transition to Scene Splitter"
```
