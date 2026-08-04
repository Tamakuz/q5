# Design Spec: Merge Step 6 & 7 into "Voice & Timeline Studio"

Date: 2026-08-05
Status: Approved

## Overview
This design unifies Step 6 (Voice Over Generator) and Step 7 (Timeline & Mapping Studio) into a single streamlined step: **Step 6: Voice & Timeline Studio**.
By combining audio transcription (Faster-Whisper / Gemini Audio Mapping) directly with automatic timeline JSON generation and visual clip preview, the application eliminates redundant steps, aligns word-level timestamps directly to visual scene breakdown segments and generated images, and reduces the total Vann & Spensia workflow from 9 steps to 8 steps.

## Workflow Change (8-Step Pipeline)
The step navigation bar (Sidebar) for `vann`, `waku`, `shortform`, and `spensia` will be updated to:

1. **Topics Generator** (`source`)
2. **Script Generator** (`analyze`)
3. **Scene Splitter** (`audio`)
4. **Image Prompt Generator** (`mapping`)
5. **Image Generator** (`render`)
6. **Voice & Timeline Studio** (`publish`) - *Combined Step 6 & 7*
7. **Render Studio (16:9)** (`upload`) - *Shifted from Step 8*
8. **Publish Hub & Thumbnail** (`thumbnail`) - *Shifted from Step 9*

## Core Features & Data Flow

### 1. Unified Transcribe & Auto-Timeline Generation
When transcription finishes via Faster-Whisper or Gemini Audio Mapping:
1. `validateWakuWordTranscript` produces aligned `words` and `sentences`.
2. The system automatically executes timeline segment matching:
   - Reads `breakdownSegments` (from Step 3/4) and generated `images` (from Step 5).
   - Matches scene text/quotes with word timestamps to determine `start_sec`, `end_sec`, and `duration_sec` for each `TimelineClipItem`.
   - Constructs `FullTimelineData` structure containing `video_clips`, `audio_tracks`, and `segments`.
3. Both `transcript.json` AND `timeline.json` are written to the active topic directory in a single step.
4. `topic_config.json` is updated with `hasVo: true` and `hasTimeline: true`.

### 2. UI Layout in `VannVoiceOverStep.tsx`
- **Audio & Transcribe Section**:
  - Audio file upload/selection & Faster-Whisper automated run / Gemini Audio Mapping JSON input.
  - Aligned words & sentences display with click-to-seek audio playback.
- **Timeline & Visual Mapping Section**:
  - Timeline clips preview with mapped images for each scene segment.
  - Interactive audio player linked with timeline clip highlighting during playback.
  - Manual clip timing / image re-assignment fine-tuning controls.
  - Quick action button to proceed directly to Render Studio.

## Affected Components & Files

| Component / File | Action | Description |
|---|---|---|
| `dashboard/src/components/common/Sidebar.tsx` | Modify | Update `VANN_STEPS` and `SPENSIA_STEPS` to 8 steps |
| `dashboard/src/App.tsx` | Modify | Remove `transcript` step rendering; route `publish` to unified `VannVoiceOverStep` |
| `dashboard/src/components/vann/VannVoiceOverStep.tsx` | Modify | Absorb timeline mapping generator, timeline preview state, and `timeline.json` persistence |
| `dashboard/src/components/vann/VannTimelineMappingStep.tsx` | Remove/Deprecate | Legacy step superseded by unified `VannVoiceOverStep` |

## Verification Plan
1. Launch dashboard dev server (`npm run dev -w dashboard`).
2. Verify Sidebar step menu for Vann and Spensia shows 8 steps with correct labels.
3. Test Voice Over & Timeline generation flow:
   - Upload narration audio.
   - Run Faster-Whisper / Gemini mapping.
   - Verify `transcript.json` and `timeline.json` are created in topic directory.
   - Verify timeline clip visual preview displays mapped images and updates active clip on audio playback.
4. Navigate to Step 7 (Render Studio) and confirm it successfully loads the generated `timeline.json`.
