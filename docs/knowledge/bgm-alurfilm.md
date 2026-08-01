# Knowledge: Strategi BGM Design & 5 Kategori Emosi Alur Film

Dokumen ini berisi panduan pemilihan, struktur folder, dan daftar file BGM (Background Music) instrumental yang **tersedia secara fisik di dalam project workspace** untuk konten Alur Cerita Film.

---

## 🎵 Prinsip Utama BGM Design Alur Film

BGM dalam narasi alur film berfungsi sebagai **pengemudi emosi penonton** dan **penjaga tempo (*pacing*)**. 

1. **100% Murni Instrumental (No Vocal):**
   * Semua file BGM yang tersimpan adalah musik pengiring tanpa vokal agar tidak menabrak frekuensi suara narator (*Voiceover*).
2. **Default Baseline BGM (`05_santai_misteri`):**
   * Musik latar utama/default saat narasi berjalan normal adalah trek dari folder **05_santai_misteri**. Saat muncul adegan khusus (aksi, tegang, sedih, kebangkitan), BGM berpindah sementara lalu kembali ke baseline ini.
3. **Audio Pattern Interrupt (Pencegah Kebosanan):**
   * Pergantian BGM disesuaikan dengan transisi suasana adegan dalam skrip (misal: *Santai/Misteri* ➔ *Tegang* ➔ *Sedih* ➔ *Kebangkitan* ➔ kembali ke *Santai/Misteri*).
4. **Volume Balance:**
   * Suara narator adalah raja. Atur volume BGM sekitar **-18 dB sampai -25 dB** di bawah volume *Voiceover*.

---

## 📂 5 Kategori BGM & Daftar File Fisik (Aktif)

Berikut adalah daftar file audio MP3 yang **benar-benar ada dan siap digunakan** di dalam folder `assets/bgm/`:

### 1. 📁 `01_tegang_suspense` (High Tension & Thriller)
* **Suasana:** Berdebar, intimidasi, ancaman musuh, terdesak waktu, bahaya mengintai.
* **File MP3 yang Tersedia:**
  * `assets/bgm/01_tegang_suspense/Black Heat.mp3` *(Karya: Ross Bugden)*

---

### 2. 📁 `02_aksi_seru` (Fast Pacing & Fight Scene)
* **Suasana:** Beat cepat, drum bertenaga, adrenalin tinggi, perkelahian, kejar-kejaran mobil.
* **File MP3 yang Tersedia:**
  * `assets/bgm/02_aksi_seru/Epic Chase Music  - Run (Copyright and Royalty Free).mp3`

---

### 3. 📁 `03_sedih_haru` (Tragedy & Underdog Low Point)
* **Suasana:** Piano melankolis, biola menyayat hati, alunan lambat dan emosional.
* **File MP3 yang Tersedia:**
  * `assets/bgm/03_sedih_haru/Something Wicked.mp3` *(Karya: Ross Bugden)*

---

### 4. 📁 `04_kebangkitan_epic` (Heroic Comeback & Climax)
* **Suasana:** Simfoni megah, membakar semangat, drum bertenaga, nada kemenangan.
* **File MP3 yang Tersedia:**
  * `assets/bgm/04_kebangkitan_epic/Beyond.mp3` *(Karya: Ross Bugden)*

---

### 5. 📁 `05_santai_misteri` (Default Baseline BGM & Casual / Investigation)
* **Suasana:** Beat lo-fi/hip-hop santai, piano ringan, atau synth teka-teki.
* **File MP3 yang Tersedia:**
  * `assets/bgm/05_santai_misteri/Piano music in style of Thomas Newman - sad mood - Royalty free music no copyright music.mp3`

---

> ⚠️ **Catatan Penting:** Hanya gunakan file audio MP3 di atas yang sudah tersedia secara lokal di dalam folder project. Jangan mencantumkan atau memanggil file BGM lain yang belum ada di dalam direktori `assets/`.
