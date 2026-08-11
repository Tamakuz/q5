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

## 📂 5 Kategori BGM & Daftar File Fisik (Aktif Terbaru)

Berikut adalah daftar file audio MP3 yang **benar-benar ada dan aktif digunakan** di dalam folder `assets/bgm/`:

### 1. 📁 `01_tegang_suspense` (High Tension & Thriller)
* **Suasana:** Berdebar, intimidasi, ancaman musuh, terdesak waktu, bahaya mengintai.
* **File MP3 Fisik:**
  * `assets/bgm/01_tegang_suspense/Black Glass Corridor.mp3`

---

### 2. 📁 `02_aksi_seru` (Fast Pacing & Fight Scene)
* **Suasana:** Beat cepat, drum bertenaga, adrenalin tinggi, perkelahian, kejar-kejaran mobil.
* **File MP3 Fisik:**
  * `assets/bgm/02_aksi_seru/Shard of Thunder.mp3`

---

### 3. 📁 `03_sedih_haru` (Tragedy & Underdog Low Point)
* **Suasana:** Piano melankolis, biola menyayat hati, alunan lambat dan emosional.
* **File MP3 Fisik:**
  * `assets/bgm/03_sedih_haru/Velvet After Rain.mp3`

---

### 4. 📁 `04_kebangkitan_epic` (Heroic Comeback & Climax)
* **Suasana:** Simfoni megah, membakar semangat, drum bertenaga, nada kemenangan.
* **File MP3 Fisik:**
  * `assets/bgm/04_kebangkitan_epic/Skyward Triumph.mp3`

---

### 5. 📁 `05_santai_misteri` (Default Baseline BGM & Casual / Investigation)
* **Suasana:** Beat lo-fi/hip-hop santai, piano ringan, atau synth teka-teki.
* **File MP3 Fisik:**
  * `assets/bgm/05_santai_misteri/Paper Map Morning.mp3`

---

## 🎛️ Aturan & Strategi Dynamic BGM (Pacing & Transisi)

Untuk menjaga kenyamanan (*retention*) penonton dan mencegah kebisingan audio fatigue:

1. **Scene/Babak Level Tagging (Bukan per Sentence):**
   * Tagging emosi BGM dilakukan pada skala **Babak / Scene** (bertahan 30 detik – 2 menit per mood). Dilarang mengganti BGM per kalimat agar audio tidak terputus-putus.
2. **Aturan Durasi Minimal BGM (Guard Rule):**
   * BGM minimal bertahan **20 – 30 detik** sebelum diizinkan berganti ke emosi lain, kecuali jika terjadi klimaks/turning point ekstrim secara tiba-tiba.
3. **Dominasi Baseline (`05_santai_misteri`):**
   * Sekitar 60–70% total durasi video tetap mengalir menggunakan BGM baseline ini saat adegan normal/investigasi/penjelasan.
4. **Smooth Crossfade (1.5s - 2.0s):**
   * Semua perpindahan BGM antar-scene **wajib menggunakan crossfade 1.5 - 2.0 detik** agar transisi musik terasa mulus tanpa kejut audio.
5. **Dynamic Sidechain Ducking (Voiceover vs Visual Only):**
   * Saat narator bicara: Volume BGM mengecil ke **-22 dB (15%)** agar narasi jernih.
   - Saat `VISUAL_ONLY` murni: Volume BGM membesar otomatis ke **-10 dB (45-50%)** untuk memberikan dampak emosi penuh.

---

## ✂️ Multi-Split Video Continuity (Aturan Cliffhanger & Re-Hook)

Ketika skrip alur film dibagi menjadi beberapa bagian/chunk (misal Part 1 dan Part 2) dan klimaks adegan terjadi di perbatasan split:

1. **Akhir Split 1 (Cliffhanger Audio):**
   * BGM klimaks (misal `04_kebangkitan_epic` / `01_tegang_suspense`) melakukan **fade-out halus (1.5 - 2.0s)** di detik-detik terakhir sebelum video Part 1 berakhir.
2. **Awal Split 2 (Re-hook Audio):**
   * Part 2 mewarisi emosi BGM terakhir dari Part 1 (`ending_bgm_emotion` Part 1 ➔ `initial_bgm_emotion` Part 2).
   * Detik 0.0 Part 2 langsung di-**fade-in (1.0s)** menggunakan BGM klimaks tersebut agar penonton Part 2 langsung tersedot kembali ke dalam cerita.
3. **Penyelarasan Kembali:**
   * Setelah adegan klimaks di Part 2 selesai (misal di detik 20-30 Part 2), BGM perlahan crossfade kembali ke `05_santai_misteri` (Baseline).
