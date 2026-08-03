# Design Spec: Fast Split & On-Demand Per-Chunk Video Compression (< 400MB)

## Summary
Modifikasi alur pemotongan dan kompresi video pada fitur Alurfilm Longform:
1. Pemotongan awal (*splitting*) master video dilakukan secara cepat (*fast stream copy* `-c copy`) ke folder `input/alurfilm/chunks/`.
2. Setiap part video di daftar UI menampilkan durasi dan **ukuran file** (MB/GB) dengan jelas.
3. Pengguna memiliki tombol **"🗜️ Compress"** pada tiap baris part video di UI untuk mengompresi part secara individual jika diperlukan (atau jika ukuran $> 400 \text{ MB}$).
4. Ketika dikompresi, file hasil disimpan di `input/alurfilm/compress/` dengan *Smart CRF 20 + Bitrate Cap* agar ukurannya $< 400 \text{ MB}$, lalu metadata & ukuran file di UI di-update secara real-time.

## Motivation & Constraints
- **Kecepatan**: Split awal harus selesai sangat cepat tanpa menunda alur kerja pengguna.
- **Transparansi**: Pengguna dapat melihat ukuran tiap file chunk secara langsung di daftar.
- **Fleksibilitas**: Pengguna memilih chunk mana yang perlu dikompresi secara opsional/manual.
- **Constraint Limit**: File yang dikompresi harus dijamin $< 400 \text{ MB}$ tanpa penurunan kualitas visual yang berarti.

## Architecture & Data Flow

### 1. Fast Split Stream Copy (`alurfilmHandlers.cjs`)
`splitAlurfilmVideoHelper` & `split-alurfilm-master-range`:
- Gunakan `-c copy` ke `input/alurfilm/chunks/`.
- Fallback ke `-c:v libx264 -c:a aac -preset ultrafast` jika stream copy gagal.
- Pemotongan selesai dalam beberapa detik per part.

### 2. IPC Handler Baru: `compress-alurfilm-chunk` (`alurfilmHandlers.cjs`)
Menerima parameter `{ part, filePath }` atau `{ contentId, part }`:
1. Hitung durasi file / part.
2. Jalankan `encodeAndCompressChunk` dengan keluaran di `input/alurfilm/compress/`.
3. Kembalikan metadata chunk ter-update (`filePath`, `size`, `isCompressed: true`).

### 3. IPC `list-alurfilm-chunks` Update (`alurfilmHandlers.cjs`)
Saat mendaftar chunk:
- Periksa keberadaan file di `p.ALURFILM_COMPRESS_DIR` terlebih dahulu. Jika file terkompresi ada, gunakan path dari folder `compress/` dan tandai `isCompressed: true`.
- Jika belum ada di folder `compress/`, gunakan file dari folder `chunks/` (`isCompressed: false`).
- Sertakan `size` (byte) dan `formattedSize` (MB/GB).

### 4. Tampilan UI `AlurfilmSplitterStep.tsx`
- Setiap item part di list kanan menampilkan:
  - Part #, Nama File.
  - Durasi dan **Ukuran File** (misal: `1.25 GB` atau `234 MB`).
  - Badge visual: `✓ < 400MB` (jika $\le 400$ MB / compressed) atau badge peringatan `⚠️ > 400MB` (jika uncompressed $> 400$ MB).
  - Tombol **"🗜️ Compress"** di sebelah tombol `🗑️`.
- Ketika tombol "Compress" diklik:
  - Tampilkan indikator loading spinner / status "Compressing..." pada part tersebut.
  - Panggil `api.compressAlurfilmChunk({ part, filePath })`.
  - Update list chunk setelah kompresi selesai.

## Verification Plan
1. **Verifikasi Fast Split**: Pastikan proses split berlangsung cepat (< 5 detik untuk part 20-menit).
2. **Verifikasi Tampilan Size**: Pastikan ukuran file (MB/GB) muncul di daftar UI.
3. **Verifikasi Manual Compression**: Klik "Compress" pada satu part, pastikan file tersimpan di `input/alurfilm/compress/`, berukuran $< 400 \text{ MB}$, dan status UI diperbarui.
