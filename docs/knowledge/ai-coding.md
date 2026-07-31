# Knowledge: Panduan & Aturan AI Coding (Content Auto)

Dokumen ini berisi standar dan aturan main AI dalam memodifikasi, menambah fitur, dan merefaktor kode pada repositori `content-auto`.

---

## Standar AI Coding

### 1. Perencanaan & Konfirmasi (Planning & Clarity)
- Pahami konteks repositori sebelum mengubah kode.
- Jangan membuat asumsi skema atau path file tanpa memeriksa file sumbernya.

### 2. Kualitas Kode & Arsitektur
- Gunakan TypeScript dengan tipe data yang ketat (`strict type`).
- Pertahankan struktur modul yang ada di `lib/`, `cli.ts`, dan `dashboard/`.
- Jaga pemisahan logika bisnis (pengerjaan video/alurfilm) dengan UI Dashboard & CLI handler.

### 3. Verifikasi & Pengujian
- Setiap perubahan harus diverifikasi melalui perintah build atau tes yang sesuai.
- Jangan mengklaim pekerjaan selesai tanpa bukti verifikasi runtime/build.
- Jangan memotong atau menyembunyikan error; perbaiki penyebab utamanya (*root cause*).
