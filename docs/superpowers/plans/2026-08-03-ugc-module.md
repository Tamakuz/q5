# UGC Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the template foundation for the `ugc` (User Generated Content) module in `dashboard`, including Cyan theme integration, mode switcher support across Sidebar and TopBar, and a placeholder studio step.

**Architecture:** Extend `ContentMode` type definitions across dashboard components, implement Cyan theme styling in Sidebar and TopBar switches, create a dedicated `UGCStudioStep` placeholder component, and integrate mode handling in `App.tsx`.

**Tech Stack:** React, TypeScript, Tailwind CSS.

## Global Constraints

- Primary Cyan theme color palette: `cyan-600`, `cyan-500`, `cyan-400`, `cyan-950`, `cyan-900`, `cyan-800`.
- Icon for UGC: ⚡
- Grid layout in Sidebar category switcher must fit 4 items (`grid-cols-4`).

---

### Task 1: Create UGC Studio Placeholder Component

**Files:**
- Create: `dashboard/src/components/ugc/UGCStudioStep.tsx`

**Interfaces:**
- Produces: `UGCStudioStep: React.FC`

- [ ] **Step 1: Create `UGCStudioStep.tsx`**

```tsx
// dashboard/src/components/ugc/UGCStudioStep.tsx
import React from 'react';

const UGCStudioStep: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-gray-950 border border-dashed border-gray-800 rounded-3xl space-y-4">
      <div className="w-20 h-20 bg-cyan-600/10 text-cyan-400 rounded-3xl flex items-center justify-center text-4xl border border-cyan-500/20 shadow-xl shadow-cyan-950/40">
        ⚡
      </div>
      <div className="max-w-md space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="px-3 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-mono font-bold uppercase tracking-wider">
            Workflow UGC (User Generated Content)
          </span>
        </div>
        <h2 className="text-lg font-bold text-white pt-1">Modul UGC Siap Dibuat</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Template & Theme Cyan untuk modul UGC telah disiapkan. Langkah-langkah workflow (steps) dapat ditambahkan sesuai kebutuhan.
        </p>
      </div>
    </div>
  );
};

export default UGCStudioStep;
```

---

### Task 2: Extend Sidebar with UGC Mode & Steps

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx`

**Interfaces:**
- Consumes: `UGCStudioStep`
- Produces: Updated `ContentMode` type including `'ugc'` and 4-column mode switcher grid.

- [ ] **Step 1: Update `ContentMode` type and add `UGC_STEPS` in `Sidebar.tsx`**

Update `ContentMode`:
```tsx
export type ContentMode = 'shortform' | 'longform' | 'spensia' | 'ugc';
```

Add `UGC_STEPS`:
```tsx
const UGC_STEPS: Step[] = [];
```

Update `activeStepsList` lookup and update the Category Switcher button grid to `grid-cols-4` with the new UGC button:
```tsx
<button
  onClick={() => onModeChange('ugc')}
  className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1 ${
    contentMode === 'ugc'
      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
  }`}
>
  <span>⚡</span> UGC
</button>
```

---

### Task 3: Update TopBar & App Component Integration

**Files:**
- Modify: `dashboard/src/components/common/TopBar.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Update `TopBar.tsx` to handle `'ugc'` mode badge & content ID styling**

Add Cyan styling condition to mode badge and content ID button in `TopBar.tsx`:
Mode Badge:
```tsx
contentMode === 'shortform'
  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80'
  : contentMode === 'longform'
  ? 'bg-purple-950/80 text-purple-300 border-purple-800/80'
  : contentMode === 'spensia'
  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
  : 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80'
```

- [ ] **Step 2: Update `App.tsx` to import `UGCStudioStep` and render when `contentMode === 'ugc'`**

In `App.tsx`, import `UGCStudioStep` and add a conditional render block for `contentMode === 'ugc'`.

---

### Task 4: Verification

- [ ] **Step 1: Build & Verify TypeScript Compilation**

Run: `npm run build -w dashboard` or `npx tsc --noEmit` inside dashboard.
