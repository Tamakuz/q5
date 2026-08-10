# Design Spec: Upgrade Prompt Metadata & Dokumen Strategi "Tabuhan Gendang Emosi"

## Context & User Feedback
- **User Request**: Di metadata pastikan semua konteks dimasukkan agar judul tidak asal-asalan/generik, serta sesuaikan dengan psikologi manusia. Frasa metafora generik ("menggebrak panggung gendang", "kode bank", dll) dinilai sangat kurang tajam dan membingungkan jika tidak terikat fakta naskah.
- **Tujuan**: Menghadirkan sistem pemrosesan metadata YouTube Alur Film (Judul, Teks Thumbnail, Prompt Visual) yang 100% berbasis fakta alur cerita riil dan mengincar **5 Jangkar Emosi Psikologis Manusia (Tabuhan Gendang Emosi)**.

---

## Proposed Changes

### 1. Documentation Upgrade (`docs/knowledge/youtube-alurfilm.md`)
- Tambahkan seksi **🧠 Psikologi "Tabuhan Gendang Emosi" (Primal Psychological Emotional Drumbeat)** yang mendefinisikan 5 insting emosional dasar penonton:
  1. **Gendang Empati & Penderitaan (Underdog)**: Keadaan fisik, sosial, ekonomi, atau emosional terdesak yang memicu simpati mendalam.
  2. **Gendang Kemarahan & Penyesalan (Balas Dendam / Vindication)**: Penonton ingin menyaksikan pelaku kedzaliman kena batunya.
  3. **Gendang Kekaguman & Ketegangan (Aksi Nekat / Survival)**: Penonton terhenyak oleh aksi nekat tanpa batas yang dilakukan karakter demi orang tercinta/kelangsungan hidup.
  4. **Gendang Kebingungan Psikologis (Syok / Paradox)**: Sesuatu yang menentang ekspektasi wajar penonton.
  5. **Gendang Kepo Mendalam (Misteri / Tabu / Curiosity Gap)**: Hal yang ditutupi yang memicu dorongan kepo mendalam.
- Update aturan penulisan judul & checklist pre-upload agar menyelaraskan 5 Jangkar Emosi Psikologis ini dengan `Formula CTR`.

### 2. Prompt & Handler Upgrade (`dashboard/electron/ipc/alurfilmHandlers.cjs`)
- **Tahap 1: Ekstraksi 5 Jangkar Psikologi Cerita**:
  Instruksikan AI untuk membaca seluruh data konteks (`movieTitle`, `characterRegistryList`, `macroSummariesList`, `timelineFocusList`, `combinedScript`) dan mendokumentasikan 5 fakta riil cerita terlebih dahulu:
  - `underdog_status`: Kondisi terdesak & penderitaan nyata karakter utama.
  - `survival_stakes`: Taruhan nyata yang hilang jika karakter gagal.
  - `extreme_action`: Aksi nekat terberat yang dilakukan karakter utama.
  - `antagonist_oppression`: Pihak penindas & bentuk perlakuan zalimnya.
  - `emotional_payoff`: Puncak emosi / tamparan penyesalan di klimaks.

- **Tahap 2: CTR Title Generation via 5 Psychological Drumbeats**:
  Masukkan 5 fakta riil Tahap 1 ke dalam Formula CTR:
  `[Tindakan Ekstrem / Perjuangan Nyata] + [Status Karakter Underdog] + [Konflik / Puncak Emosi Realistis] — Alur Cerita Film`

  Hasilkan 5 opsi judul untuk masing-masing kategori emosi:
  1. `underdog`: 😢 Underdog & Perjuangan
  2. `balas_dendam`: 😡 Pembuktian & Tamparan Penyesalan
  3. `aksi_nekat`: ⚡ Keberanian & Aksi Nekat
  4. `kaget`: 😱 Syok & Tak Terduga
  5. `misteri`: 🤨 Rahasia & Curiosity Gap

- **Strict Anti-Hallucination Guardrail**:
  Dilarang keras mengarang kata, profesi palsu, atau istilah metafora acak yang tidak ada di dalam naskah.

---

## Verification Plan

### Automated / Syntax Check
1. Jalankan `npm run build` atau `npx tsc --noEmit` untuk memastikan tidak ada kesalahan syntax atau tipe data.
2. Periksa IPC handler `alurfilm:generate-metadata` di Electron untuk memastikan prompt terformat dengan sempurna tanpa merusak skema JSON output.

### Manual Verification
1. Uji pembuatan metadata Alur Film melalui UI dashboard atau script testing.
2. Verifikasi bahwa 5 variasi judul yang dihasilkan benar-benar merefleksikan alur cerita nyata dari naskah yang diinput tanpa ada kata-kata metafora palsu.
