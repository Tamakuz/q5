# Design Spec: Single High-Impact Shorts Video Per Longform Video

**Date:** 2026-08-17  
**Status:** Approved by User  
**Target Subsystem:** Shorts Generation & Render Studio (`input/shorts/`, `dashboard/src/components/shorts/`, `projectHandlers.cjs`)

---

## 1. Overview & Business Intent

Sistem pembuatan YouTube Shorts yang sebelumnya memecah 1 video longform menjadi beberapa segmen Shorts (`seg_1, seg_2, seg_3`) diubah menjadi **1 video Shorts utama per 1 video longform**.

Shorts ini bersifat **utuh, padat, dan berdiri sendiri (standalone)** dengan:
1. **Hook Dinamis & Story-Driven**: Pembuka cerita berdasar topik spesifik video (contoh: *"Ini dia cara unik orang Pakistan..."* atau *"Beginilah proses rahasia pembuatan..."*).
2. **Durasi Fleksibel (Flexi-Duration)**: Tidak dikunci pada durasi kaku tertentu, melainkan menyesuaikan secara alami dengan kecepatan narasi audio & adegan (kisaran 25–55 detik, <60 detik).
3. **Kombinasi Klip Highlight**: Mengambil 8–15 potongan adegan visual terbaik dari sepanjang video longform (dari awal sampai akhir).
4. **Format Visual 4:5 + Latar Belakang Blur**: Layer atas 4:5 (1080x1350) di atas layer bawah 9:16 (1080x1920) blurred background.

---

## 2. Changes Across Pipeline Steps

### Step 2: Naskah Narasi (Script Generation)
* **Format Data (`input/shorts/script-segments.json`)**:
  * Struktur data diubah dari `segments: [{id, title, ...}]` menjadi objek tunggal `shorts_data`:
  ```json
  {
    "video_title": "Proses Pembuatan Kelereng Kaca Pabrik",
    "shorts_data": {
      "id": "main_shorts",
      "title": "Ini Dia Cara Orang Pakistan Bikin Kelereng Kaca",
      "hook_type": "curiosity_gap",
      "script_id": "Sumpah, cuma orang Pakistan yang terpikir cara bikin kelereng kaca kayak begini...",
      "script_en": "You won't believe how marbles are traditionally forged in Pakistan...",
      "target_duration_sec": 42
    }
  }
  ```
* **UI Step 2**: Menampilkan 1 kotak editor naskah narasi tunggal (Indonesia & Inggris) tanpa tab pilihan segmen.

### Step 3: Sulih Suara & Alignment (Audio VO & WhisperX)
* **Format Audio (`input/shorts/audio/`)**:
  * Menghasilkan 1 file audio VO utama: `seg_main_shorts_vo_id.mp3` dan `seg_main_shorts_vo_en.mp3`.
* **UI Step 3**: Menampilkan pemutar audio tunggal & tombol alignment Faster-Whisper.

### Step 4: Video Mapping (Visual Cuts Selection)
* **Format Mapping (`input/shorts/video-mapping.json`)**:
  * Menyimpan 8–15 potongan klip visual (`cuts_id` dan `cuts_en`) yang mencakup sepanjang video longform:
  ```json
  {
    "items": {
      "main_shorts": {
        "title": "Shorts Video Utama",
        "source_video_path": "input/shorts/compressed_videos/source_compressed.mp4",
        "audio_path_id": "input/shorts/audio/seg_main_shorts_vo_id.mp3",
        "cuts_id": [
          { "cut_index": 1, "video_start": 12.5, "video_end": 15.0, "duration": 2.5, "text": "Hook text..." },
          { "cut_index": 2, "video_start": 45.0, "video_end": 48.2, "duration": 3.2, "text": "Escalation text..." }
        ]
      }
    }
  }
  ```
* **UI Step 4**: Menampilkan 1 lini masa adegan klip visual tunggal.

### Step 5: Render Studio & FFmpeg Engine
* **UI Step 5**: Menampilkan 1 kartu workspace render utama dengan 1 tombol aksi **"🎬 Render Shorts Video (9:16)"**.
* **FFmpeg Direct Engine (`projectHandlers.cjs`)**:
  * Merender 1 video final `output/shorts/seg_main_shorts_id_final.mp4`.
  * Memakai Fast Seek (`-ss`), `nice -n 15` priority, dan layout layer atas 4:5 di atas 9:16 blurred background.

---

## 3. Data Schema Specifications

### `input/shorts/script-segments.json`
```json
{
  "project_name": "Pabrik Kelereng Kaca",
  "generated_at": "2026-08-17T01:30:00.000Z",
  "segments": [
    {
      "id": "main_shorts",
      "title": "Ini Dia Cara Orang Pakistan Bikin Kelereng Kaca",
      "hook": "Sumpah, cuma orang Pakistan yang terpikir...",
      "script_id": "Naskah bahasa Indonesia lengkap...",
      "script_en": "Full English narrative script...",
      "estimated_duration": 38
    }
  ]
}
```

---

## 4. User Experience (UI Flow)

1. **Step 1 (Source Video)**: Mengimpor/mengompres video longform.
2. **Step 2 (Script Studio)**: Klik **"Generate Single Shorts Script"** ➔ Menghasilkan 1 naskah dinamis dengan Hook memikat.
3. **Step 3 (Audio VO)**: Rekam/Upload 1 audio VO & jalankan WhisperX alignment.
4. **Step 4 (Video Mapping)**: AI menyusun 8-15 klip adegan visual dari sepanjang video longform.
5. **Step 5 (Render Studio)**: Klik **"Render Shorts Video"** ➔ Menghasilkan 1 video MP4 9:16 vertikal siap upload.

---

## 5. Verification Plan

1. **Type Safety & Build**: Jalankan `npx tsc --noEmit` & `node -c dashboard/electron/ipc/projectHandlers.cjs` untuk memastikan tidak ada error kompilasi.
2. **Dashboard UI Flow Test**: Memastikan UI Step 2 hingga Step 5 berjalan mulus menampilkan 1 segmen tunggal tanpa error array `segments[0]`.
3. **FFmpeg Render Output Test**: Memastikan output video `output/shorts/seg_main_shorts_id_final.mp4` ter-render sempurna dengan audio VO sinkron dan tampilan 4:5 + background blur.
