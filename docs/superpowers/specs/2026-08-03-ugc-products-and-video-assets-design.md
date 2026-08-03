# Design Spec: UGC Products & Isolated Video Assets Manager

**Date:** 2026-08-03
**Status:** Approved by User

## Overview
Implement Step 2 (Products Manager) and Step 3 (Video Assets Manager) for the UGC module in `content-auto`. Each product is stored in `input/ugc/products/{product_id}/` and contains its own isolated video assets in `input/ugc/products/{product_id}/assets/videos/`.

## Directory Hierarchy & Storage Structure

```
input/ugc/
├── active_product.json
└── products/
    ├── prod_1722730000001/
    │   ├── info.json
    │   ├── photo.jpg          (Optional)
    │   └── assets/
    │       └── videos/
    │           ├── vid_01.mp4
    │           └── vid_02.mp4
    └── prod_1722730000002/
        ├── info.json
        └── assets/
            └── videos/
```

### Product Info Schema (`info.json`)
```json
{
  "id": "prod_1722730000001",
  "name": "Skincare Glow Serum",
  "photo": "photo.jpg",
  "createdAt": "2026-08-03T23:40:00.000Z"
}
```

## Backend IPC Handlers (`dashboard/electron/ipc/ugcHandlers.cjs`)

1. `ugc:get-products`: Reads `input/ugc/products/`, parses `info.json`, computes `photoUrl`, returns array of `UGCProduct`.
2. `ugc:create-product`: Accepts `{ name, sourcePhotoPath }` (photo optional), creates `input/ugc/products/{product_id}/assets/videos/`, writes `info.json`.
3. `ugc:delete-product`: Removes product folder `input/ugc/products/{product_id}/`.
4. `ugc:select-active-product`: Writes active product ID to `input/ugc/active_product.json`.
5. `ugc:get-active-product`: Returns active product ID.
6. `ugc:select-video-file`: Opens dialog for selecting video files (`.mp4`, `.mov`, `.webm`, `.mkv`).
7. `ugc:upload-video-asset`: Accepts `{ productId, sourceFilePath }`, copies video into `input/ugc/products/{productId}/assets/videos/`.
8. `ugc:list-video-assets`: Reads `input/ugc/products/{productId}/assets/videos/`, returns list of `UGCVideoAsset` with `mediaUrl` and video meta.
9. `ugc:delete-video-asset`: Deletes specified video file from `input/ugc/products/{productId}/assets/videos/`.

## Frontend Integration

1. `dashboard/src/components/common/Sidebar.tsx`:
   - Update `UGC_STEPS`:
     - Step 1 (`source`): 👤 1. Character Profiles
     - Step 2 (`analyze`): 📦 2. Products Manager
     - Step 3 (`audio`): 📹 3. Video Assets
2. `dashboard/src/electron-api.ts`:
   - Add interfaces `UGCProduct` and `UGCVideoAsset`.
   - Expose Electron API window methods.
3. `dashboard/src/components/ugc/UGCProductsManager.tsx`:
   - Product Card Grid & Modal form to add Product.
4. `dashboard/src/components/ugc/UGCVideoAssetsManager.tsx`:
   - Isolated video asset manager for active product with file uploader & video gallery grid.
5. `dashboard/src/App.tsx`:
   - Render `UGCStudioStep` for Step 1, `UGCProductsManager` for Step 2 (`analyze`), `UGCVideoAssetsManager` for Step 3 (`audio`).
