# Design: Empty Shorts Module

## Goal
Empty out all contents and sidebar step navigation items from the Shorts module in the dashboard UI, leaving a clean, blank workspace when in Shorts mode.

## Proposed Changes

### 1. `dashboard/src/components/common/Sidebar.tsx`
- Set `SHORTS_STEPS` to an empty array `[]`.
- Sidebar step navigation for `contentMode === 'shorts'` will now display zero step items.

### 2. `dashboard/src/App.tsx`
- Remove active step routing for `contentMode === 'shorts'`.
- Render a pure empty container when `contentMode === 'shorts'`.

## Verification Plan
- Launch/build the dashboard dev server or test rendering to verify that clicking the "Shorts" category button shows an empty sidebar step list and a completely blank main view.
