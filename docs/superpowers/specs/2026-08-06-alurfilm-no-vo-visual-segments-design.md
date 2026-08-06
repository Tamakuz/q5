# Design Spec: Alur Film No-VO Visual Segments & Audio Silence Gap Testing Studio

**Date:** 2026-08-06  
**Status:** Approved for Implementation  
**Topic:** Alur Film No-VO Visual Clips & TTS Silence Gap Testing  

---

## 📌 Executive Summary

Dalam pembuatan movie recap (Alur Cerita Film), narasi *Voiceover* (VO) yang berjalan nonstop dari awal hingga akhir dapat membuat penonton merasa jenuh (*overwhelmed*). Untuk meningkatkan **Retention** dan memberikan **Pattern Interrupt**, kita menambahkan fitur **"No-VO Visual-Only Segments"**. 

Pada momen-momen aksi/klimaks (seperti adegan pertarungan, tsunami menerjang, ledakan, atau kejar-kejaran), narasi VO akan hening selama 4.0 – 8.0 detik. Selama jeda ini, video hanya menampilkan klip-klip aksi sinematik (*pure action clips*) diiringi BGM/SFX bawaan film sebelum narasi dilanjutkan kembali.

Fitur ini akan dibangun pertama kali dalam bentuk **Isolated Testing Studio** di tab `AlurfilmTestingHub` untuk menguji naskah statis, sintesis audio TTS dengan jeda hening (*silence gap*), serta preview visual fallback.

---

## 🎯 Requirements & Key Decisions

1. **Testing Playground First (`AlurfilmVisualOnlyTestStep.tsx`)**:
   - Dibuat sebagai sub-tab di `dashboard/src/components/longform/testing/AlurfilmTestingHub.tsx`.
   - Tidak langsung menyentuh alur produksi utama (*main flow*) agar aman untuk diuji coba secara komprehensif.

2. **Naskah Statis & Tag `[VISUAL_ONLY]`**:
   - Menyediakan input naskah statis yang dapat diedit untuk testing cepat.
   - Menggunakan format tag: `[VISUAL_ONLY: 5.0s | Adegan baku hantam dan pertarungan sengit]`.
   - AI Scriptwriter prompt (`alurfilm-singlepass-prompt.md`) diperbarui agar dapat mendeteksi momen klimaks dan menyisipkan tag ini secara otomatis dengan durasi ideal (4.0s – 8.0s).

3. **TTS Silence Gap Engine**:
   - Saat naskah dikirim ke engine TTS (Gemini TTS / TTS synthesis), tag `[VISUAL_ONLY]` dibersihkan dari teks ucapan.
   - Audio TTS digabungkan dengan **buffer audio hening (*silence audio PCM/WAV*)** berdurasi presisi (misal 5.0 detik) persis di posisi tag tersebut.
   - Menghasilkan 1 file audio VO utuh yang memiliki jeda bernapas alami ("tidak langsung bablas").

4. **Visual & Audio Mapping Rules**:
   - **Visual Fallback di Studio Test**: Menggunakan preview overlay teks / visual placeholder sederhana untuk menguji timing.
   - **Aturan Visual Murni pada Final Mapping**:
     - 🚫 **Dilarang**: `slow_motion`, `freeze_frame_with_zoom`, `mirror_cut`, `pan_and_zoom_cut`.
     - ✅ **Wajib**: 100% `video_cut` (potongan adegan aksi kecepatan normal) untuk menjaga kesan aksi tajam dan realistis.

---

## 🏛️ Architecture & Component Design

```text
[AlurfilmTestingHub]
       └── Sub-Tab: "🎥 No-VO Visual Test" (AlurfilmVisualOnlyTestStep.tsx)
                 ├── Panel 1: Input Naskah Statis + Sample Tag [VISUAL_ONLY: 5.0s]
                 ├── Panel 2: TTS Silence Gap Generator (Gemini TTS + FFmpeg Silence Buffer)
                 ├── Panel 3: Audio Waveform & Timestamp Player (Dengar Jeda Audio)
                 └── Panel 4: Visual Preview & Mapping Rule Verification (Pure video_cut)
```

### Files & Extensions
1. **`dashboard/src/components/longform/testing/AlurfilmVisualOnlyTestStep.tsx`** `[NEW]`
   - UI Komponen Studio Uji Coba No-VO Visual & TTS Silence.
2. **`dashboard/src/components/longform/testing/AlurfilmTestingHub.tsx`** `[MODIFY]`
   - Menambahkan sub-tab menu untuk mengakses `AlurfilmVisualOnlyTestStep`.
3. **`dashboard/electron/ipc/alurfilmHandlers.cjs`** `[MODIFY]`
   - IPC handler baru/tambahan: `generate-alurfilm-test-tts-with-silence` untuk menggabungkan audio TTS dengan jeda hening FFmpeg.
4. **`dashboard/prompts/longform/alurfilm-singlepass-prompt.md`** `[MODIFY]`
   - Menambahkan pedoman penulisan tag `[VISUAL_ONLY: X.Xs]` untuk AI Scriptwriter.
5. **`dashboard/prompts/longform/alurfilm-mapping-prompt.md`** `[MODIFY]`
   - Menambahkan aturan strict `video_cut` murni untuk segmen `VISUAL_ONLY`.

---

## 🧪 Verification & Acceptance Criteria

1. **Uji Coba Jeda Audio TTS**:
   - Narasi audio hasil generate dapat diputar dan memiliki jeda hening presisi (misal 5.0s) pada posisi tag `[VISUAL_ONLY]`, tanpa terpotong atau "bablas".
2. **Uji Coba Tag Parser**:
   - Tag `[VISUAL_ONLY]` berhasil diekstrak menjadi metadata jeda timeline (start time, end time, duration).
3. **Isolasi Fitur**:
   - Fitur bekerja 100% mandiri di dalam `AlurfilmTestingHub` tanpa mengganggu alur produksi utama.

---
