# Design Spec: UGC Isolated Render Studio & 3-Clip Pattern Generator

**Date:** 2026-08-04
**Status:** Approved by User

## Overview
Implement Step 4 (UGC Render Studio) for the UGC module in `content-auto`. The studio generates unique 3-clip patterns from full raw videos in the active product's isolated folder (`input/ugc/products/{product_id}/assets/videos/`), deduplicates against previously rendered patterns, and concatenates them using FFmpeg into `output/ugc/{product_id}/render_{timestamp}.mp4`.

## Pattern Generation & Deduplication Logic

For a product with $N$ raw video clips:
- Total possible unique ordered 3-clip patterns = $N \times (N-1) \times (N-2)$ (for $N \ge 3$).
- Rendered patterns tracking: `input/ugc/products/{product_id}/rendered_patterns.json`
  ```json
  {
    "renderedPatterns": [
      ["vid_01.mp4", "vid_02.mp4", "vid_03.mp4"]
    ]
  }
  ```
- Output location: `output/ugc/{product_id}/render_{timestamp}.mp4`

## Backend IPC Handlers (`dashboard/electron/ipc/ugcHandlers.cjs`)

1. `ugc:get-render-patterns-stats`:
   - Returns `{ totalRawClips, totalPossiblePatterns, renderedCount, remainingCount, activeProduct }`.
2. `ugc:render-pattern`:
   - Accepts `{ productId, pattern?: string[] }`.
   - If pattern is omitted, automatically picks an unrendered 3-clip pattern.
   - Concatenates the 3 full videos via FFmpeg `concat` demuxer/filter.
   - Saves output to `output/ugc/{productId}/render_{timestamp}.mp4`.
   - Emits progress events `ugc:render-progress`.
   - Updates `rendered_patterns.json`.
   - Returns rendered video info.
3. `ugc:list-renders`:
   - Lists rendered videos in `output/ugc/{productId}/`.
4. `ugc:delete-render`:
   - Deletes rendered output file.

## Frontend Integration

1. `dashboard/src/components/common/Sidebar.tsx`:
   - Add Step 4: 🎬 **4. UGC Render Studio** (`id: 'render'`).
2. `dashboard/src/electron-api.ts`:
   - Add IPC method signatures and return types.
3. `dashboard/src/components/ugc/UGCRenderStudioStep.tsx`:
   - Pattern stats dashboard (Total Clips, Total Variations, Rendered, Remaining).
   - "Render Pola Baru" & "Batch Render" actions with live progress indicator.
   - Rendered Video Gallery Grid with playback modal and delete actions.
4. `dashboard/src/App.tsx`:
   - Map `activeStep === 'render'` to `UGCRenderStudioStep`.
