# Design Spec: Integrated Split & Smart Compression Video Alurfilm (< 400MB)

## Summary
Modifikasi alur pemotongan video (*splitting*) pada fitur Alurfilm Longform di mana setiap *chunk* video hasil *split* langsung dikompresi menggunakan FFmpeg dengan konfigurasi *Smart CRF + Dynamic Bitrate Cap*. Hasil kompresi disimpan di folder `input/alurfilm/compress/` dan dipastikan ukurannya tidak pernah melebihi 400 MB per file tanpa mengorbankan kualitas visual.

## Motivation & Constraints
- **Constraint**: File video *chunk* / *split* tidak boleh melebihi **400 MB**.
- **Visual Quality**: Kualitas video tidak boleh terlihat mengalami penurunan (visual loss imperceptible, menggunakan `CRF 20`).
- **Location**: Hasil kompresi harus disimpan di direktori terpisah `input/alurfilm/compress/` dan langsung digunakan untuk tahap selanjutnya (audio extraction, transcript alignment, & render mapping).

## Architecture & Data Flow

### 1. Directory Structure (`dashboard/electron/shared/paths.cjs`)
Menambahkan konstant & pembuatan otomatis untuk folder kompresi:
```javascript
const ALURFILM_COMPRESS_DIR = path.join(PROJECT_ROOT, 'input', 'alurfilm', 'compress');
```

### 2. FFmpeg Smart Compression Strategy (`dashboard/electron/ipc/alurfilmHandlers.cjs`)
Untuk setiap chunk yang dipotong (durasi default: 20 menit / 1200 detik):
1. **Safety Cap**: Target batas atas ukuran file adalah **380 MB** (memberikan margin aman 20 MB dari batas 400 MB).
2. **Kalkulasi Maxrate**:
   $$\text{target\_bits} = 380 \times 8 \times 1024 \times 1024 \text{ bits}$$
   $$\text{total\_max\_bitrate\_kbps} = \frac{\text{target\_bits}}{1024 \times \text{duration\_sec}}$$
   $$\text{video\_maxrate\_kbps} = \max(500, \text{total\_max\_bitrate\_kbps} - 128)$$
3. **Argumen FFmpeg**:
   ```bash
   ffmpeg -ss <start_sec> -i <master_path> -t <duration_sec> \
     -c:v libx264 -crf 20 -preset medium \
     -maxrate <video_maxrate_kbps>k -bufsize <video_maxrate_kbps * 2>k \
     -c:a aac -b:a 128k \
     -avoid_negative_ts make_zero -y <dest_path_in_compress_folder>
   ```
4. **Fallback & Second-pass Enforcement**:
   - Jika FFmpeg gagal dengan preset `medium`, re-try dengan preset `faster`.
   - Setelah proses encoding selasai, periksa ukuran file `stat.size`. Jika file secara tidak terduga melebihi 400 MB (419,430,400 bytes), jalankan *pass* kompresi ulang dengan bitrate 80% dari `video_maxrate_kbps`.

### 3. IPC Progress & Metadata Updates
- IPC channel `split-alurfilm-video`, `split-alurfilm-master`, dan `split-alurfilm-master-range` di-update untuk mengarahkan `destPath` ke `input/alurfilm/compress/`.
- Event `alurfilm-split-progress` mengirimkan payload:
  - `status: 'splitting'`
  - `status: 'chunk_completed'` (berisi objek chunk yang merujuk path `input/alurfilm/compress/filename.mp4` dan ukuran file yang sudah terkompresi).

### 4. Downstream Usage (`AlurfilmSplitterStep.tsx` & Handler IPC Alurfilm)
- UI `AlurfilmSplitterStep` menampilkan status split & kompresi serta ukuran file terkini.
- Proses selanjutnya (*audio extraction*, *transcript*, dll) menggunakan file terkompresi dari `ALURFILM_COMPRESS_DIR`.

## Verification Plan
1. **Pemeriksaan Direktori**: Memastikan `input/alurfilm/compress/` dibuat secara otomatis saat IPC dipanggil.
2. **Pengujian Split & Compression**:
   - Jalankan fungsi `split-alurfilm-master` / `split-alurfilm-video` via UI atau script pengujian.
   - Verifikasi bahwa file hasil diproduksi di `input/alurfilm/compress/`.
   - Verifikasi bahwa ukuran setiap file $< 400 \text{ MB}$.
3. **Verifikasi Kualitas & Format**:
   - Periksa bahwa resolusi & kualitas video tetap terjaga baik secara visual.
