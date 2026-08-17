# Empty Shorts Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all step choices from the sidebar and render an empty screen when selecting the Shorts category module.

**Architecture:** Update `SHORTS_STEPS` in `Sidebar.tsx` to `[]` and update `contentMode === 'shorts'` handling in `App.tsx` to render a pure empty container.

**Tech Stack:** React, TypeScript, TailwindCSS

## Global Constraints
- Sidebar steps array for Shorts must be `[]`.
- No error on selecting Shorts mode.

---

### Task 1: Empty Shorts Sidebar Steps and Main Workspace

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Set `SHORTS_STEPS` to empty array in `Sidebar.tsx`**

In `dashboard/src/components/common/Sidebar.tsx`:
```tsx
const SHORTS_STEPS: Step[] = [];
```

- [ ] **Step 2: Update `App.tsx` to render empty view for Shorts mode**

In `dashboard/src/App.tsx`:
```tsx
{contentMode === 'shorts' ? (
  <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-gray-950 border border-dashed border-gray-800/60 rounded-3xl">
    <span className="text-gray-600 text-xs font-mono">Modul Shorts Kosong</span>
  </div>
) : contentMode === 'ugc' ? (
```

- [ ] **Step 3: Verify TypeScript compilation & dashboard build**
Run: `npm run build` or test in `dashboard` directory.
