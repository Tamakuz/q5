# Shorts Module Step 1: Video Downloader Design Document

## 1. Overview & Objective
Modul Shorts Step 1 berfungsi untuk mengunduh video mentahan (*raw source videos*) dari YouTube secara dinamis. Pengguna dapat menambah, mengedit, dan mengunduh beberapa video YouTube sekaligus menggunakan antarmuka berbasis card dinamis. Sistem memastikan file video dan metadata tersimpan secara konsisten pada struktur folder proyek.

---

## 2. Architecture & Data Flow

```
[ Dashboard UI (ShortsSourceStep.tsx) ]
       │
       ├─► Read / Save State ────► input/shorts/video-sources.json
       │
       └─► Invoke IPC ───────────► shorts:download-video (projectHandlers.cjs via yt-dlp)
                                          │
                                          ▼
                                   Save MP4 Video
                                          │
                                          ▼
                                  input/shorts/raw_videos/*.mp4
```

---

## 3. UI Component Design & Features

### 3.1 Header & Quick Action Stats
- **Header Info**: Title ("Step 1: Dynamic Video Downloader"), subtext workflow ("Shorts Factory 9:16"), and badge total video.
- **Top Actions**:
  - `➕ Tambah Card Video`: Menambahkan card input YouTube link baru ke daftar.
  - `📥 Download Semua Video Pending`: Memicu download untuk semua card yang belum diunduh.

### 3.2 Dynamic Video Card Layout (`ShortsSourceStep.tsx`)
Setiap card mewakili 1 item video dengan field & elemen berikut:
- **Card Header**: Index item (`Video #1`, `Video #2`), badge status (`Ready`, `Downloading...`, `Downloaded`, `Error`), dan tombol `🗑️ Hapus Card`.
- **Inputs**:
  - **YouTube URL Input**: Input untuk menempelkan URL YouTube (`https://www.youtube.com/watch?v=...` atau `https://youtu.be/...`).
  - **Title / Keterangan (Optional)**: Input teks opsional untuk nama/label video.
- **Progress Indicator (Saat Download Active)**:
  - Progress bar animasi dengan nilai persentase (`0%` - `100%`).
  - Kecepatan download (`MB/s`) & total ukuran file yang dikirim via IPC event listener `shorts:download-progress`.
- **Video Preview Player (Setelah Download Selesai)**:
  - Player `<video>` HTML5 terintegrasi yang memutar file dari `media://content-auto/${encodeURIComponent(video_path)}`.
  - Info badge: Nama file (`.mp4`), ukuran file (`MB`), dan tanggal download.
  - Tombol `🔄 Download Ulang` untuk mengganti atau mengunduh ulang video.

---

## 4. File Structure & Path Persistence Consistency

| Asset Type | Storage Path | Description |
| :--- | :--- | :--- |
| **Raw Videos** | `input/shorts/raw_videos/<filename>.mp4` | Tempat penyimpanan file MP4 mentahan hasil *yt-dlp*. |
| **State Manifest** | `input/shorts/video-sources.json` | File JSON yang memuat seluruh list card, URL, status, dan lokasi file MP4. |

### JSON Schema (`input/shorts/video-sources.json`):
```json
{
  "updated_at": "2026-08-16T00:58:00.000Z",
  "items": [
    {
      "id": "vid_1723766400000_1",
      "title": "Woodworking Process",
      "youtube_url": "https://www.youtube.com/watch?v=EXAMPLE",
      "video_filename": "shorts_raw_1723766400000_1.mp4",
      "video_path": "input/shorts/raw_videos/shorts_raw_1723766400000_1.mp4",
      "status": "downloaded",
      "file_size_bytes": 15420100,
      "downloaded_at": "2026-08-16T00:58:00.000Z"
    }
  ]
}
```

---

## 5. Backend IPC & Electron Integrations

1. **`Sidebar.tsx`**: Update `SHORTS_STEPS` array dengan step:
   - `{ id: 'source', icon: '📥', label: '1. Video Downloader', subText: 'Download & kelola video mentahan YouTube' }`
2. **`App.tsx`**: Render `<ShortsSourceStep />` ketika `contentMode === 'shorts'`.
3. **`projectHandlers.cjs`**: Pastikan handler `shorts:download-video` mengurus pembuatan folder `input/shorts/raw_videos` jika belum ada, menulis file `.mp4`, dan mengupdate `input/shorts/video-sources.json`.

---

## 6. Verification & Test Plan
1. Membuka Dashboard Electron, masuk ke menu **Shorts**.
2. Memastikan step **1. Video Downloader** tampil aktif pada sidebar dan area utama.
3. Klik **"➕ Tambah Card Video"** untuk membuat card link dinamis.
4. Input URL YouTube valid, jalankan **Download Video**.
5. Verifikasi progress bar berjalan dan pemutar preview video `<video>` dapat memutar hasil download.
6. Memastikan file `.mp4` tersimpan di `input/shorts/raw_videos/` dan metadata tersimpan di `input/shorts/video-sources.json`.
7. Refresh / remount komponen untuk memastikan data persisten ter-load kembali.
