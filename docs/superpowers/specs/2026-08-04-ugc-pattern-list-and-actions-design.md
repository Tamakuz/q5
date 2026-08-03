# Design Spec: UGC Pattern List Table & Enhanced Render Actions

**Date:** 2026-08-04
**Status:** Approved by User

## Overview
Enhance Step 4 (UGC Render Studio) with a Pattern List Table showing all available 3-clip patterns, per-pattern render buttons, checkbox multi-selection for batch rendering selected patterns, "Tandai Sudah Upload" status toggle, and video deletion actions.

## Data Persistence Schema (`pattern_statuses.json`)

Saved per product in `input/ugc/products/{product_id}/pattern_statuses.json`:
```json
{
  "vid_01.mp4::vid_02.mp4::vid_03.mp4": {
    "pattern": ["vid_01.mp4", "vid_02.mp4", "vid_03.mp4"],
    "rendered": true,
    "uploaded": false,
    "outputFileName": "render_ugc_1722730000000.mp4",
    "renderedAt": "2026-08-04T00:10:00.000Z",
    "uploadedAt": null
  }
}
```

## IPC Handlers Updates (`ugcHandlers.cjs`)

1. `ugc:get-render-patterns-list`:
   - Returns array of pattern items:
     `{ patternKey, pattern: string[], rendered: boolean, uploaded: boolean, outputFileName?: string, videoUrl?: string, renderedAt?: string }`.
2. `ugc:render-pattern`:
   - Accepts `{ productId, pattern: string[] }`.
   - Renders specified pattern via FFmpeg concat.
   - Updates `pattern_statuses.json`.
3. `ugc:toggle-upload-status`:
   - Accepts `{ productId, patternKey, uploaded: boolean }`.
   - Updates `uploaded` state in `pattern_statuses.json`.
4. `ugc:delete-render-pattern`:
   - Accepts `{ productId, patternKey }`.
   - Unlinks output file and resets `rendered` and `uploaded` in `pattern_statuses.json`.

## Frontend UI Updates (`UGCRenderStudioStep.tsx`)

1. Pattern List Table with Checkbox Column for multi-select.
2. Actions Header: "⚡ Render Selected ({count})" & "Select All Unrendered".
3. Row Actions:
   - 🎬 **Render** (renders this individual pattern).
   - 🚀 **Tandai Uploaded / Unmark** toggle button.
   - 🗑️ **Hapus Video** button.
   - ▶️ **Preview** modal player button.
