# Design Spec: Single System `vann_mapping.json` (Eliminate Legacy `timeline.json`)

Date: 2026-08-05
Status: Approved by User

## Core Goal
Streamline Step 6 (Voice & Timeline Studio) to use **a single unified mapping source of truth**: `vann_mapping_topic_${topicId}.json`.
Completely remove the redundant `timeline.json` generator and its visual timeline card from the UI.

## Key Changes

### 1. Mandatory `vann_mapping_topic_${topicId}.json` Persistence
Whenever audio transcription or audio mapping completes (via Faster-Whisper or Gemini Audio Mapping):
- Save `input/vann/mappings/vann_mapping_topic_${topicId}.json` containing the normalized segment/sentence timestamps and quote data.
- Save `input/vann/mappings/vann_mapping.json` (if `topicId === 1`).
- Save `input/vann/vann_mapping.json` (if `topicId === 1`).
- Save `input/vann/transcripts/merged_transcript_topic_${topicId}.json`.

### 2. UI Cleanup in `VannVoiceOverStep.tsx`
- Remove the bottom card: `Visual Timeline Mapping Adegan Video (timeline.json)` and its "Re-Generate Timeline" button.
- Remove `timelineData` state and `handleGenerateTimelineData` function.
- Display the clean **Timeline Mapping Segmen Adegan (`vann_mapping.json`)** table directly in Step 6.

### 3. Step 7 (Render Studio) Direct Consumption
Step 7 and FFmpeg rendering read `vann_mapping_topic_${topicId}.json` directly from `input/vann/mappings/`.

## Affected Files
1. `dashboard/src/components/vann/VannVoiceOverStep.tsx` - Save `vann_mapping_topic_${topicId}.json` on completion and remove legacy `timeline.json` card UI & state.
