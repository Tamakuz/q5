# Design Spec: UGC Character Profiles Manager

**Date:** 2026-08-03
**Status:** Approved by User

## Overview
Implement a multi-character profile management feature for the UGC (User Generated Content) module in `content-auto`. Each profile consists of a Character Name and Character Photo. Profiles are stored on disk inside `input/ugc/profiles/{profile_id}/`.

## File & Directory Structure

```
input/ugc/profiles/
├── char_1722730000001/
│   ├── info.json
│   └── photo.jpg
└── char_1722730000002/
    ├── info.json
    └── photo.png
```

### Profile Metadata Format (`info.json`)
```json
{
  "id": "char_1722730000001",
  "name": "Sarah Creator",
  "photo": "photo.jpg",
  "createdAt": "2026-08-03T23:15:00.000Z"
}
```

## Backend IPC Handlers (`dashboard/electron/ipc/ugcHandlers.cjs`)

1. `ugc:get-profiles`: Reads all subdirectories in `input/ugc/profiles/`, parses `info.json`, computes media URL for photo, and returns array of `UGCProfile`.
2. `ugc:create-profile`: Takes `{ name, sourceFilePath }`, generates `profile_id`, creates subfolder `input/ugc/profiles/{profile_id}/`, copies photo file, writes `info.json`, and returns created profile.
3. `ugc:delete-profile`: Menghapus folder `input/ugc/profiles/{profile_id}/`.
4. `ugc:select-active-profile`: Saves active profile ID to `input/ugc/active_profile.json`.
5. `ugc:get-active-profile`: Returns active profile ID.

## Frontend UI Components

1. `dashboard/src/electron-api.ts`:
   - Add TypeScript interface `UGCProfile`.
   - Expose Electron API window bindings: `getUGCProfiles`, `createUGCProfile`, `deleteUGCProfile`, `selectActiveUGCProfile`, `getActiveUGCProfile`, `selectImageFile`.
2. `dashboard/src/components/ugc/UGCProfilesManager.tsx`:
   - Cyan themed grid view displaying character cards.
   - Shows active cyan glow border around selected active character.
   - "+ Tambah Karakter Baru" modal card with file picker & name input.
3. `dashboard/src/components/ugc/UGCStudioStep.tsx`:
   - Renders `UGCProfilesManager` component.
