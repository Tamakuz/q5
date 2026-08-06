# Spensia Workflow & Feature Parity with Vann Design Spec

Date: 2026-08-06
Status: Approved

## Overview
This design spec outlines the complete synchronization of the **Spensia** workflow to make it 100% identical in steps, features, UI controls, AI prompts, and utility functions to the **Vann** workflow without exception.

## 1. 7-Step Workflow Sequence & Navigation
The Spensia workflow is re-aligned from 8 steps to 7 steps, matching Vann's structure:
1. `source`: **1. Topics Generator** (`SpensiaTopicsStep`)
2. `analyze`: **2. Script Generator** (`SpensiaScriptStep`)
3. `publish`: **3. Voice & Timeline Studio** (`SpensiaVoiceOverStep`) — *Includes Voiceover audio generation, Faster-Whisper transcript extraction, integrated scene visual breakdown, and auto-timeline generation.*
4. `mapping`: **4. Image Prompt Generator** (`SpensiaImagePromptStep`) — *Generates visual prompts based on timeline clips & breakdown segments from Step 3.*
5. `render`: **5. Image Generator** (`SpensiaImageGeneratorStep`) — *Generates images based on prompt cards.*
6. `upload`: **6. Render Studio (16:9)** (`SpensiaRenderStep`) — *Video render engine with watermark, captions, BGM, and export.*
7. `thumbnail`: **7. Publish Hub & Thumbnail** (`SpensiaThumbnailStep`) — *SEO title, tags, description & 3x thumbnail generation.*

Files updated for navigation:
- `dashboard/src/components/common/Sidebar.tsx`
- `dashboard/src/components/common/WorkflowHeader.tsx`
- `dashboard/src/App.tsx`

## 2. Component & Feature Parity
- `SpensiaVoiceOverStep.tsx`: Full integration of TTS/Whisper transcription, visual scene breakdown, and automatic `spensia_timeline.json` creation matching `VannVoiceOverStep.tsx`.
- `SpensiaImagePromptStep.tsx`: Concurrency controls, no-text enforcement options, segment keyword continuity parameters, and expanded AI model selectors matching `VannImagePromptStep.tsx`.
- `SpensiaTopicsStep.tsx` & `SpensiaScriptStep.tsx`: Batch selection, counterintuitive history prompt logic, and script validation matching Vann's latest implementation.
- `SpensiaImageGeneratorStep.tsx`, `SpensiaRenderStep.tsx`, `SpensiaThumbnailStep.tsx`: Render configurations, ASS subtitle generation parameters, and publish hub matching Vann.

## 3. Prompts & Backend Utilities Parity
- Synchronize all files in `dashboard/prompts/spensia/` with `dashboard/prompts/vann/`:
  - `image-prompt-generator-prompt.md`
  - `script-prompt.md`
  - `thumbnail-prompts-generator-prompt.md`
  - `topics-prompt.md`
  - `breakdown-prompt.md`
  - `analyze-metadata-prompt.md`, `analyze-thumbnails-vision-prompt.md`, `audio-mapping-prompt.md`, `demand-keyphrases-prompt.md`, `fix-metadata-prompt.md`, `upload-metadata-prompt.md`
- Synchronize utility functions in `dashboard/src/utils/`:
  - `spensiaTimelineGenerator.ts`
  - `spensiaValidation.ts`
  - `spensiaAssGenerator.ts`
  - `spensiaRenderConfig.ts`
