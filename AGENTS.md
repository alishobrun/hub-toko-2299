# Aturan untuk AI / siapa pun yang mengubah Basecamp 2299

Proyek ini dikerjakan lebih dari satu asisten (Claude & Cindy). Supaya tidak saling menimpa:

1. **GitHub adalah sumber tunggal.** Selalu `git pull` dulu, ubah, commit, `git push` — baru pasang ke Apps Script.
   Jangan pernah mengedit langsung di editor Apps Script tanpa menyimpan perubahan yang sama ke GitHub.
2. **Naikkan `KODE_VERSI`** di `apps-script/Code.gs` setiap kali Code.gs berubah (format `yyyy-MM-dd.n`).
   Halaman *Kesehatan Data* membandingkan versi mesin yang aktif dengan GitHub; merah = ada kode di luar GitHub.
3. **Pasang ke deployment yang sama** (Kelola deployment → edit → Versi baru). Jangan buat deployment baru,
   karena alamat API di `assets/config.js` akan berbeda.
4. **Naikkan `?v=` di `index.html`** setiap kali file di `assets/` berubah. Angka `?v=` pada app.js juga dipakai HP untuk mendeteksi versi baru dan memperbarui otomatis — kalau lupa dinaikkan, HP tidak tahu ada versi baru.
5. **Encoding:** UTF-8 tanpa BOM, akhir baris LF (sudah diatur `.gitattributes`). Periksa tidak ada teks rusak
   seperti `â€¦` / `Ã`.
6. **Data:** jangan menghapus baris/tab di sheet "DB Hub Toko 2299" atau sheet JADWAL secara langsung.
   Semua file buatan Basecamp ada di Drive pemilik: "01 Eiger / Basecamp 2299" (database, Cadangan: DB harian 30 hari & JADWAL mingguan, Handover, Sistem). Jangan membuat file/folder baru di halaman utama Drive.
7. Pemilik: Ali Muhammad Shobrun (Store Leader 2299). Perubahan fitur dibahas dulu; dibangun setelah ia bilang "gass".
