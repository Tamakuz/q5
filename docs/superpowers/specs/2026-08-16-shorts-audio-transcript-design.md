# Shorts Step 3: Voiceover Audio & Transcript Sync Studio Design Document

## 1. Overview & Objective
Step 3 pada modul Shorts berfungsi untuk mengunggah file audio voiceover (VO narasi Bahasa Indonesia & Bahasa Inggris) per segmen Shorts, serta menyinkronkan timestamp transkrip (kalimat per kalimat) secara otomatis menggunakan engine **Faster-Whisper (`whisperx/align_cli.py`)** atau penyuntingan manual.

---

## 2. Workflow & Data Flow

```
[ Step 2: Segmen Shorts (script-segments.json) ]
                       │
                       ▼
         [ ShortsAudioStep.tsx UI ]
                       │
     ┌─────────────────┴─────────────────┐
     ▼                                   ▼
[ 1. Upload Audio VO ]         [ 2. Faster-Whisper Sync ]
.mp3 / .wav / .m4a             Auto-calculate Start/End sec
`input/shorts/audio/`          via `whisperx/align_cli.py`
     │                                   │
     └─────────────────┬─────────────────┘
                       ▼
       [ 3. Transcript Editor Table ]
   - Interactive Audio Player (<audio>)
   - Editable Sentence Timestamps (Start - End)
   - Test Play Sentence per Line
   - Bilingual Switcher (🇮🇩 Indo & 🇺🇸 English)
                       │
                       ▼
       [ 4. Persistence Manifest ]
    `input/shorts/audio-transcripts.json`
```

---

## 3. Data Structure (`input/shorts/audio-transcripts.json`)

```typescript
export interface TranscriptSentence {
  id: string;
  text: string;
  start: number; // in seconds (e.g. 0.0)
  end: number;   // in seconds (e.g. 3.2)
}

export interface ShortsAudioSegmentData {
  segment_id: string;
  segment_title: string;

  // Indonesian Version
  audio_path_id?: string;
  audio_filename_id?: string;
  sentences_id: TranscriptSentence[];

  // English Version
  audio_path_en?: string;
  audio_filename_en?: string;
  sentences_en: TranscriptSentence[];
}

export interface AudioTranscriptsManifest {
  updated_at: string;
  items: Record<string, ShortsAudioSegmentData>;
}
```

---

## 4. IPC Handlers (`projectHandlers.cjs`)

1. `shorts:upload-vo-audio`:
   - Menerima `segmentId`, `lang` ('id' | 'en'), dan `sourcePath` / `buffer`.
   - Menyimpan ke: `input/shorts/audio/seg_<segmentId>_vo_<lang>.<ext>`.
2. `shorts:run-whisper-alignment`:
   - Menjalankan script Python CLI: `pythonBin whisperx/align_cli.py --audio <audioPath> --text <tmpScriptPath> --output <outJsonPath> --model small`.
   - Mengembalikan array `TranscriptSentence[]` dengan timestamp hasil alignment.

---

## 5. UI Layout (`ShortsAudioStep.tsx`)

1. **Left Sidebar Panel**: Daftar Segmen Shorts (dibaca dari `input/shorts/script-segments.json`).
2. **Main Workspace**:
   - **Language Switcher**: Toggle `🇮🇩 Bahasa Indonesia` & `🇺🇸 English`.
   - **Audio Upload Panel**: Tombol browse audio `.mp3 / .wav`, indikator file tersimpan, dan pemutar audio HTML5 `<audio>`.
   - **Whisper Alignment Trigger**: Tombol `🎙️ Run Auto Alignment (Faster-Whisper)`.
   - **Transcript Table**: Tabel kalimat transkrip dengan input Start (detik), End (detik), tombol `▶ Play Line`, `➕ Tambah Kalimat`, dan `🗑️ Hapus`.
3. **Persistence**: `input/shorts/audio-transcripts.json`.

---

## 6. Verification Plan
1. Buka modul Shorts ➔ Masuk ke **Step 3: Audio & Transcript**.
2. Pilih segmen dari sidebar kiri.
3. Upload file audio voiceover MP3/WAV.
4. Klik tombol **Run Auto Alignment** (atau edit timestamp manual pada tabel).
5. Uji pemutaran baris kalimat via pemutar audio.
6. Verifikasi manifest tersimpan di `input/shorts/audio-transcripts.json`.
