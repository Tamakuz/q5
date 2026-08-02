# Alur Film Multi-Part Voiceover Audio Upload & Dedicated Storage Design

## Overview
Enhance the Alur Film Flow 3 (Voiceover Audio Studio) in the dashboard application so that single or multi-part continuous Voiceover (VO) audio files can be uploaded and mapped to one or multiple video split parts (e.g. Parts 1–4). All uploaded audio assets and mapping state will be stored in a dedicated folder (`input/alurfilm/audio/`).

## User Intent & Requirements
- **Multi-Part Audio Coverage**: Allow a single uploaded audio file to cover multiple video split parts (e.g. Parts 1, 2, 3, 4) or an individual part.
- **Pre-Upload Target Selector**: Require the user to select which video split parts are covered by the audio file before triggering the upload action.
- **Dedicated Storage Directory**: Store all uploaded VO audio files and their mapping state in a dedicated directory: `input/alurfilm/audio/`.
- **State Persistence**: Persist the relationship between audio files and covered video split parts in an `audio_mappings.json` file inside `input/alurfilm/audio/`.
- **UI Feedback & Badges**: Display clear visual indicators (checkmarks, badges, covered part lists) in both the side parts selector and the main audio player panel.

## Architecture & Data Flow

### 1. Storage Structure (`input/alurfilm/audio/`)
- **Directory Path**: `input/alurfilm/audio/` (configured as `ALURFILM_AUDIO_DIR` in `dashboard/electron/shared/paths.cjs`).
- **Audio Files**: Saved as `${contentId}_audio_parts_${partsRange}.${ext}` (e.g. `WV-FILM-20260802-ABCD_audio_parts_1-4.mp3`).
- **Mapping State File**: `input/alurfilm/audio/${contentId}_audio_mappings.json`.

#### Metadata Schema (`audio_mappings.json`):
```json
{
  "contentId": "WV-FILM-20260802-ABCD",
  "audios": [
    {
      "id": "audio_1722550000_123",
      "name": "WV-FILM-20260802-ABCD_audio_parts_1-4.mp3",
      "parts": [1, 2, 3, 4],
      "filePath": "/absolute/path/to/input/alurfilm/audio/WV-FILM-20260802-ABCD_audio_parts_1-4.mp3",
      "url": "atom://...",
      "size": 15420000,
      "createdAt": "2026-08-02T04:40:00.000Z"
    }
  ]
}
```

---

### 2. IPC Handlers & Bridge (`dashboard/electron/ipc/alurfilmHandlers.cjs` & `preload.cjs` & `electron-api.ts`)

#### A. Path Extensions (`paths.cjs`)
Export `ALURFILM_AUDIO_DIR`:
```javascript
const ALURFILM_AUDIO_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'audio');
```

#### B. IPC Handlers (`alurfilmHandlers.cjs`)
- **`upload-alurfilm-audio`**:
  - Accept `{ parts: number[], filePath: string }`.
  - Ensure `ALURFILM_AUDIO_DIR` exists.
  - Generate formatted filename e.g., `${contentId}_audio_parts_${minPart}-${maxPart}${ext}`.
  - Copy uploaded audio file into `ALURFILM_AUDIO_DIR`.
  - Update `input/alurfilm/audio/${contentId}_audio_mappings.json`, removing any previous overlapping part mappings for the specified parts and appending the new audio entry.
  - Return the created audio object.
- **`list-alurfilm-audios`**:
  - Read `input/alurfilm/audio/${contentId}_audio_mappings.json`.
  - Verify audio file existence on disk, filter out missing entries, and return the active audio entries array.
- **`delete-alurfilm-audio`**:
  - Remove specified audio entry by `id` from `audio_mappings.json` and delete the audio file from disk.

#### C. Type Definitions & Preload (`electron-api.ts` & `preload.cjs`)
```typescript
export interface AlurfilmAudioResult {
  id: string;
  name: string;
  parts: number[];
  filePath: string;
  url: string;
  size: number;
  createdAt?: string;
}

export interface ElectronAPI {
  uploadAlurfilmAudio: (contentId: string, parts: number[], filePath: string) => Promise<AlurfilmAudioResult>;
  listAlurfilmAudios: (contentId?: string) => Promise<AlurfilmAudioResult[]>;
  deleteAlurfilmAudio: (audioId: string) => Promise<boolean>;
  // ...
}
```

---

### 3. Frontend UI Component (`dashboard/src/components/longform/AlurfilmAudioStep.tsx`)

#### A. State Management
- `selectedParts: number[]`: Array of currently selected part numbers for upload target.
- `audios: AlurfilmAudioResult[]`: List of uploaded audio mapping items from `listAlurfilmAudios`.

#### B. Center Panel (Target Split Selector & Upload)
- **Multi-Select Checkboxes Grid**: Displays checkboxes for all available video split parts (e.g., `[x] Part #1`, `[x] Part #2`, `[x] Part #3`, `[x] Part #4`).
- **Quick Select Controls**: "Select All" and "Clear Selection" buttons.
- **Upload Button Logic**:
  - Disabled if `selectedParts.length === 0`.
  - Dynamic button text: `"Upload Audio untuk Part #1, #2, #3, #4"`.
- **Audio Card & Player**:
  - Displays audio player if the active part has an associated audio file.
  - Badges showing covered parts list e.g., `Parts: #1, #2, #3, #4`.
  - "Replace Audio" and "Delete Audio" actions.

#### C. Side Panel (Parts List)
- Displays checkmarks (`✓`) and subtitle badges for parts that have an assigned audio file e.g., `Part #1 (Master VO 1-4)`.

---

## Verification Plan

### 1. Build Verification
- Run `npm run build` or `npx tsc --noEmit` inside `dashboard` to ensure clean TypeScript compilation.

### 2. Runtime & File Verification
- Launch dashboard app (`npm run dev -w dashboard`).
- Navigate to Alur Film Flow 3 (Audio Studio).
- Select Parts #1, #2, #3, #4, and upload a test `.mp3` file.
- Check disk to verify file is saved in `input/alurfilm/audio/` and `input/alurfilm/audio/<contentId>_audio_mappings.json` is created with valid JSON structure.
- Verify side panel shows checkmarks for all 4 parts.
- Verify switching active part to Part 2 or Part 3 loads and plays the master audio file.
