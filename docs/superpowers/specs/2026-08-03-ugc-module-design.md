# Design Spec: UGC Module Template & Theme

**Date:** 2026-08-03
**Status:** Approved by User

## Overview
Add a new content category module named `ugc` (User Generated Content) to the `content-auto` Dashboard. This includes the Cyan visual theme, category mode switcher integration in `Sidebar` and `TopBar`, Electron API mode support, and an expandable empty/placeholder layout for future UGC workflow steps.

## Technical Architecture & Changes

### 1. Types & State Management
- `dashboard/src/components/common/Sidebar.tsx`:
  - Extend `ContentMode` type definition: `export type ContentMode = 'shortform' | 'longform' | 'spensia' | 'ugc';`
  - Define `UGC_STEPS: Step[] = [];` as an empty array placeholder for future step definitions.
  - Update grid layout in category switcher to 4 columns (`grid-cols-4`) to fit Shorts, Film, Spensia, UGC.

### 2. Design & Color Palette (Cyan Theme)
- Primary Accent: `cyan-500` / `cyan-400`
- Active State Styles:
  - Sidebar Switcher Button: `bg-cyan-600 text-white shadow-lg shadow-cyan-600/30`
  - TopBar Mode Badge: `bg-cyan-950/80 text-cyan-300 border-cyan-800/80`
  - TopBar Content ID Badge: `bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-700/50 text-cyan-300`
  - Main View Glow / Accent: `bg-cyan-600/10 text-cyan-400 border-cyan-500/20 shadow-cyan-950/40`

### 3. Navigation & TopBar Integration
- `dashboard/src/components/common/TopBar.tsx`:
  - Add support for `'ugc'` in mode badges and content ID state.
- `dashboard/src/App.tsx`:
  - Handle `'ugc'` content mode in state and effect calls (`getContentId('ugc')`, `resetProject('ugc')`).
  - Render UGC studio view / placeholder when `contentMode === 'ugc'`.

### 4. Component Structure
- `dashboard/src/components/ugc/UGCStudioStep.tsx`:
  - [NEW] Component serving as the default view for the UGC module when steps are empty or selected.
  - Features premium dark glassmorphism styling, Cyan theme elements, and clear placeholder info.

## Verification
- Verify TypeScript compilation without errors.
- Confirm dashboard renders the UGC mode tab in sidebar with Cyan theme and clean placeholder view.
