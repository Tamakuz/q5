# Shorts Step 4: Shorts Video Mapping Studio Design Document

## 1. Overview & Objective
Step 4 pada modul Shorts berfungsi untuk memetakan *(mapping)* potong-potongan klip video sumber (`raw_video` / `compressed_video`) ke setiap kalimat narasi audio voiceover per segmen Shorts untuk kebutuhan render FFmpeg pada Step 5.

---

## 2. Workflow & Data Flow

```
[ Step 2: script-segments.json ] ──┐
                                   ├──► [ ShortsMappingStep.tsx UI ]
[ Step 3: audio-transcripts.json ] ┘                  │
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │ 1. Pilih Segmen & Bahasa     │
                                       │    (🇮🇩 Indo / 🇺🇸 English)   │
                                       └──────────────┬───────────────┘
                                                      │
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │ 2. Klik "⚡ Auto-Map Cuts"   │
                                       │    (Sinkron audio & video)   │
                                       └──────────────┬───────────────┘
                                                      │
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │ 3. Tabel Mapping & Player    │
                                       │    - Timestamp Video Start/End│
                                       │    - Tombol "⏱️ Set Player"   │
                                       │    - Tombol "▶ Play Cut"      │
                                       │    - Text Overlay / Subtitle  │
                                       └──────────────┬───────────────┘
                                                      │
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │ 4. Persistence Manifest      │
                                       │ `input/shorts/video-mapping` │
                                       └──────────────────────────────┘
```

---

## 3. Data Structure (`input/shorts/video-mapping.json`)

```typescript
export interface VideoCutMappingItem {
  id: string;
  sentence_index: number;
  text: string;
  audio_start: number;
  audio_end: number;
  duration: number;
  video_start: number;
  video_end: number;
  overlay_text?: string;
}

export interface ShortsSegmentMappingData {
  segment_id: string;
  segment_title: string;
  source_video_path: string;

  // Indonesian Mapping
  audio_path_id?: string;
  cuts_id: VideoCutMappingItem[];

  // English Mapping
  audio_path_en?: string;
  cuts_en: VideoCutMappingItem[];
}

export interface VideoMappingManifest {
  updated_at: string;
  items: Record<string, ShortsSegmentMappingData>;
}
```

---

## 4. UI Layout & Features (`ShortsMappingStep.tsx`)

1. **Left Sidebar Panel**: Daftar Segmen Shorts dari Step 2 & Step 3. Menampilkan status mapping per bahasa (`🇮🇩 Mapped` / `🇺🇸 Mapped`).
2. **Main Workspace**:
   - **Language Toggle**: Switch `🇮🇩 Bahasa Indonesia` & `🇺🇸 English`.
   - **Auto-Map Button**: Tombol `⚡ Auto-Map Cuts dari Step 2 & 3` untuk memetakan detik video secara otomatis dari timestamp segmen Step 2.
   - **Video Preview Player**: Pemutar video mentah/terkompresi terintegrasi.
   - **Interactive Video Mapping Table**:
     - Menampilkan kalimat, timestamp audio `audio_start` - `audio_end` (`duration`).
     - Input timestamp `video_start` & `video_end` (detik) dengan tombol `⏱️ Set Start/End` dari posisi player.
     - Field `Overlay Text` (default teks visual hook / subtitle).
     - Tombol `▶ Play Cut`: Memutar video khusus pada potongan `video_start` hingga `video_end`.
3. **Persistence**: `input/shorts/video-mapping.json`.

---

## 5. Verification Plan
1. Buka modul Shorts ➔ Masuk ke **Step 4: Video Mapping**.
2. Pilih segmen dan bahasa dari sidebar kiri.
3. Klik tombol **Auto-Map Cuts**.
4. Verifikasi potongan video ter-map sesuai durasi audio kalimat.
5. Uji tombol **▶ Play Cut** pada player video.
6. Verifikasi manifest tersimpan di `input/shorts/video-mapping.json`.
