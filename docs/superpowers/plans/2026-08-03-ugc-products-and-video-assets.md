# UGC Products & Isolated Video Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Step 2 (Products Manager) and Step 3 (Isolated Video Assets) for the UGC module, allowing users to create products and upload raw video assets scoped strictly to each product.

**Architecture:** Extend paths in `paths.cjs`, add Product & Video IPC handlers in `ugcHandlers.cjs`, update `preload.cjs` and `electron-api.ts`, build `UGCProductsManager.tsx` and `UGCVideoAssetsManager.tsx` components, and map steps 1, 2, and 3 in `Sidebar.tsx` and `App.tsx`.

**Tech Stack:** React, TypeScript, Node.js fs/path, Electron IPC, Tailwind CSS (Cyan Theme).

## Global Constraints

- Storage: Products at `input/ugc/products/{product_id}/`, Isolated videos at `input/ugc/products/{product_id}/assets/videos/`.
- Strict isolation: Video assets belong strictly to a single product.

---

### Task 1: Add Product & Video IPC Handlers in Electron Backend

**Files:**
- Modify: `dashboard/electron/shared/paths.cjs`
- Modify: `dashboard/electron/ipc/ugcHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`

- [ ] **Step 1: Update `paths.cjs` to include `UGC_PRODUCTS_DIR = path.join(PROJECT_ROOT, 'input', 'ugc', 'products')`**
- [ ] **Step 2: Add Product & Video Asset handlers in `ugcHandlers.cjs`**
- [ ] **Step 3: Expose new IPC methods in `preload.cjs`**

---

### Task 2: Update Types & Electron API Interfaces

**Files:**
- Modify: `dashboard/src/electron-api.ts`

- [ ] **Step 1: Add `UGCProduct` and `UGCVideoAsset` interfaces and `ElectronAPI` method signatures**

---

### Task 3: Build `UGCProductsManager` Component (Step 2)

**Files:**
- Create: `dashboard/src/components/ugc/UGCProductsManager.tsx`

- [ ] **Step 1: Build `UGCProductsManager.tsx` with card grid layout, create product modal (Name + Optional Photo), and active product selector**

---

### Task 4: Build `UGCVideoAssetsManager` Component (Step 3)

**Files:**
- Create: `dashboard/src/components/ugc/UGCVideoAssetsManager.tsx`

- [ ] **Step 1: Build `UGCVideoAssetsManager.tsx` with active product badge, video file upload dialog/dropzone, and isolated video gallery grid with preview player**

---

### Task 5: Update Sidebar Steps & App Component Routing

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Update `UGC_STEPS` in `Sidebar.tsx` for Step 1 (Character Profiles), Step 2 (Products Manager), and Step 3 (Video Assets)**
- [ ] **Step 2: Render components in `App.tsx` according to `activeStep` for `contentMode === 'ugc'`**

---

### Task 6: Verification

- [ ] **Step 1: Run TypeScript compiler check `npx tsc --noEmit -p dashboard/tsconfig.json`**
