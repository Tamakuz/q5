# Design Spec: CapCut Radian Glow Transition Engine for UGC Render Studio

**Date:** 2026-08-04
**Status:** Approved by User

## Overview
Implement CapCut-style Radian Glow (Radial White Flash) transitions between 3 video clips during FFmpeg rendering in Step 4 (UGC Render Studio). Uses `ffprobe` to determine input video durations and FFmpeg `xfade` (transition=fadewhite / radial) and `acrossfade` audio filters.

## FFmpeg Filtergraph Pipeline

For 3 input clips `[0:v]`, `[1:v]`, `[2:v]` with durations $D_1, D_2, D_3$:
- Transition Duration: $T_{trans} = 0.4\text{s}$
- $\text{Offset}_1 = D_1 - T_{trans}$
- $\text{Offset}_2 = \text{Offset}_1 + D_2 - T_{trans}$

FFmpeg filtergraph:
```bash
-filter_complex \
"[0:v][1:v]xfade=transition=fadewhite:duration=0.4:offset=OFFSET1[v01]; \
 [v01][2:v]xfade=transition=fadewhite:duration=0.4:offset=OFFSET2[vout]; \
 [0:a][1:a]acrossfade=d=0.4[a01]; \
 [a01][2:a]acrossfade=d=0.4[aout]" \
-map "[vout]" -map "[aout]"
```

Fallback handling: If any clip lacks audio streams, fallback to silent audio generation or video-only `xfade`.

## Transition Options
- `radian_glow`: CapCut Radial White Flash Glow Transition (`transition=fadewhite`)
- `dissolve`: Soft Crossfade Transition (`transition=fade`)
- `none`: Hard Cut Concat (`demuxer concat`)

## Backend Changes (`ugcHandlers.cjs`)

1. Helper `getVideoDuration(filePath)`: Uses `ffprobe` to get duration float in seconds.
2. Update `ugc:render-pattern`: Accepts `transitionStyle` parameter ('radian_glow' | 'dissolve' | 'none').
3. Dynamically builds FFmpeg `xfade` filtergraph command.

## Frontend Changes (`UGCRenderStudioStep.tsx`)

1. Transition Style selector dropdown in header:
   - 🌟 **Radian Glow CapCut** (Default)
   - 🔄 **Soft Dissolve**
   - ⚡ **Tanpa Transisi (Hard Cut)**
2. Passes `transitionStyle` to `renderUGCPattern` calls.
