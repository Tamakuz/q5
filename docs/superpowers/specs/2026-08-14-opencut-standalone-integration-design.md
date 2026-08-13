# Standalone OpenCut Integration Design

## Overview
This design outlines the integration of **OpenCut** as a standalone video editor module within the `content-auto` Electron Dashboard. OpenCut will operate independently without IPC data bridge coupling in Phase 1, allowing creators to upload local media assets (images, videos, audio), construct multi-track timelines, preview cuts, and export finalized video renders directly. A clear navigation toggle will allow switching between the main Dashboard and OpenCut Studio view.

## Goal & User Requirements
- Provide a dedicated **OpenCut Studio** view inside the Electron Dashboard app.
- Provide a navigation entry in the Dashboard (Sidebar and/or TopBar) to switch to OpenCut.
- Provide a clear **"← Kembali ke Dashboard"** button inside the OpenCut header to return to the previous view.
- Enable full standalone editor capabilities in OpenCut: local media upload, multi-track timeline editing, preview, and rendering.
- Defer data IPC bridge / cross-module data passing to future phases (YAGNI).

## Proposed Architecture

### Micro-Frontend / Sub-App Isolation Architecture
OpenCut will be included as an isolated sub-application component inside `dashboard/src/components/opencut/`.

1. **View Integration (`dashboard/src/App.tsx`)**:
   - Register a new navigation state `isOpenCutActive: boolean` (or `StepId: 'opencut'`).
   - When active, the main content panel renders `OpenCutStudioView`.

2. **OpenCut Component Frame (`dashboard/src/components/opencut/OpenCutStudioView.tsx`)**:
   - Contains a top navigation bar with **"← Kembali ke Dashboard"** button and OpenCut status banner.
   - Embeds OpenCut editor component/iframe frame.
   - Provides a clean, full-height UI environment for multi-track timeline editing.

3. **Standalone Asset & Export Operations**:
   - Media uploads (drag-and-drop or file picker) utilize local browser / HTML5 File API and WebCodecs/Canvas/WGPU.
   - Video rendering and exports run locally inside OpenCut's client engine without requiring external server dependencies.

## UI & Navigation Design

```
+-----------------------------------------------------------------------------+
|  TopBar: [ OpenCut Studio ]                  [ ← Kembali ke Dashboard ]     |
+-----------------------------------------------------------------------------+
|                                                                             |
|                       OPENCUT VIDEO EDITOR INTERFACE                        |
|                                                                             |
|  [ + Import Media ] [ Tracks ] [ Canvas Preview ] [ Timeline Controls ]     |
|  +-----------------------------------------------------------------------+  |
|  | Track 1: Video Clust                                                  |  |
|  | Track 2: Audio / Voiceover                                            |  |
|  | Track 3: Subtitles / Captions                                         |  |
|  +-----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
```

## Verification Plan

### Automated Checks
- `npm run build -w dashboard`: Ensure TypeScript compilation succeeds with no type errors.

### Manual Verification
- Launch dashboard with `npm run dev -w dashboard`.
- Click **"OpenCut Studio"** button in sidebar / topbar -> verify transition to OpenCut view.
- Test uploading local video/image file in OpenCut -> verify timeline placement and canvas playback.
- Click **"← Kembali ke Dashboard"** -> verify returning to active dashboard module without UI state corruption.
