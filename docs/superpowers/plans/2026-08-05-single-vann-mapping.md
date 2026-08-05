# Single System `vann_mapping.json` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task.

**Goal:** Ensure `vann_mapping_topic_${topicId}.json` is always written to `input/vann/mappings/` when transcript completes, and remove the redundant `timeline.json` UI card and generator code.

**Tech Stack:** React, TypeScript, Electron IPC.

---

### Task 1: Ensure `vann_mapping_topic_${topicId}.json` Persistence in `VannVoiceOverStep.tsx`

- Modify `VannVoiceOverStep.tsx` in `handleProcessManualTranscriptJson` and Faster-Whisper alignment handler so it ALWAYS writes:
  - `input/vann/mappings/vann_mapping_topic_${topicId}.json`
  - `input/vann/mappings/vann_mapping.json` (if `topicId === 1`)
  - `input/vann/vann_mapping.json` (if `topicId === 1`)

### Task 2: Remove Legacy `timeline.json` Card & State from `VannVoiceOverStep.tsx`

- Remove `timelineData` state and `handleGenerateTimelineData` function.
- Remove the bottom JSX card: `Visual Timeline Mapping Adegan Video (timeline.json)`.

### Task 3: Build Verification

- Run `npx tsc --noEmit` to verify zero type errors.
