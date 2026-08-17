# Shorts Step 2: Multi-Segment & AI Script Generator Design Document

## 1. Overview & Objective
Step 2 pada modul Shorts berfungsi untuk meng-copy prompt AI Studio, mengimpor output JSON dari AI Studio, me-parse segmen-segmen video Shorts (durasi ~30-50 detik) dari 1 video longform mentah, serta menyediakan antarmuka pratinjau video per timestamp dan naskah narasi voiceover.

---

## 2. Workflow & Data Flow

```
[ Selected Raw/Compressed Video (Step 1) ]
                  │
                  ▼
[ 1. Copy Prompt AI Studio ] ──► User paste prompt to Google AI Studio (Gemini)
                  │
                  ▼
[ 2. Paste Output JSON ] ──────► User paste response JSON into Dashboard
                  │
                  ▼
[ 3. Auto Parse & Validate ] ──► Auto-generate Shorts Segment Cards:
                                   - Title & Hook Text
                                   - Timestamp Range (Start - End)
                                   - Narration Script & Sentences
                                   - Video Segment Preview Player
                  │
                  ▼
[ 4. Persistence ] ────────────► Save to `input/shorts/script-segments.json`
```

---

## 3. Prompt Template Location & Structure

Prompt template disimpan di: `dashboard/prompts/shortform/shorts-segment-script.md`.

Instruksi prompt meminta AI Studio memproduksi JSON murni berupa daftar segmen Shorts bertarget US market:
```json
{
  "source_video_title": "{{video_title}}",
  "segments": [
    {
      "id": "seg_1",
      "title": "Automated Ice Cream Cutting",
      "hook_text": "This machine cuts 10,000 ice creams in 1 hour!",
      "formatted_start": "01:15",
      "formatted_end": "02:00",
      "start_time_sec": 75,
      "end_time_sec": 120,
      "narration_script": "Ever wondered how thousands of ice cream bars are made so quickly?...",
      "sentences": [
        "Ever wondered how thousands of ice cream bars are made so quickly?",
        "This giant industrial cutter splits them with pinpoint accuracy."
      ]
    }
  ]
}
```

---

## 4. UI Component Features (`ShortsAnalyzeStep.tsx`)

1. **Source Video Selector**:
   - Dropdown untuk memilih video dari `input/shorts/video-sources.json`.
2. **AI Studio Prompt Panel**:
   - Menampilkan template prompt dinamis.
   - Tombol `📋 Copy Prompt AI Studio` dan `↗ Buka Google AI Studio`.
3. **JSON Import Panel**:
   - Textarea tempat menempelkan JSON dari AI Studio.
   - Tombol `📥 Import & Parse Data Segmen`.
4. **Segment Cards & Video Player**:
   - Menampilkan daftar segmen Shorts hasil import.
   - Setiap kartu memiliki field title, hook, start time, end time, dan naskah narasi.
   - Pemutar video `<video>` terintegrasi dengan tombol `▶ Play Segmen (01:15 - 02:00)` yang otomatis melakukan seek pada timestamp segmen.
   - Tombol `➕ Tambah Segmen Manual` & `🗑️ Hapus Segmen`.
5. **Path Persistence**: `input/shorts/script-segments.json`.

---

## 5. Verification Plan
1. Buka modul Shorts ➔ Masuk ke **Step 2: Script & Segment Generator**.
2. Pilih video sumber, klik **Copy Prompt**.
3. Tempel contoh JSON valid ke kolom import, klik **Import & Parse**.
4. Verifikasi kartu segmen ter-render dengan benar, naskah narasi tampil, dan tombol player segmen dapat memutar timestamp yang ditentukan.
5. Verifikasi persistence ter-save ke `input/shorts/script-segments.json`.
