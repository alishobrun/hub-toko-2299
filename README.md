# Hub Toko 2299

Web hub untuk tim EIGER Store A. Yani Kertasuro Sukoharjo (2299): monitoring sales, unggah DSR, dan jadwal shift. Bisa dibuka di HP maupun komputer.

## Isi

- **Login per orang.** Anggota tim mendaftar sendiri, lalu admin menyetujui. Akun pertama yang mendaftar otomatis menjadi admin.
- **Monitoring Sales.** Achievement bulanan, kumulatif, dan harian (Bruto/Netto), plus UPT dan basket. Rumusnya sama dengan Integrated Hub Jateng 01.
- **Unggah DSR.** File *Item DSR Report* (.xlsx) dari sistem. Data dicocokkan per nomor invoice: invoice yang sudah ada diganti, invoice baru ditambah, jadi tidak pernah dobel.
- **Jadwal.** Dibaca langsung dari sheet JADWAL KARTASURA JAYA (tab periode berjalan).

## Rumus sales

- **Baris yang dihitung:** brand EIGER, selain paper bag. Jasa (reparasi) dan packing WAB/ECOM tidak dihitung.
- **Bruto** = Gross Amount, **Netto** = Net Amount. Retur (qty minus) ikut mengurangi.
- **Transaksi** = jumlah invoice unik. UPT = qty ÷ transaksi. Basket = sales ÷ transaksi.
- **Target bulanan:** kolom Total di tab Target sheet *Report Sales Per 2 Jam - Jateng 01*.
- **Target kumulatif** = target bulan × bobot kumulatif s/d tanggal. **Target harian** = target bulan × bobot hari itu.

## Susunan

| Bagian | Tempat |
|---|---|
| Tampilan web | GitHub Pages (folder ini) |
| Mesin/API | Google Apps Script (`apps-script/Code.gs`), dipasang di sheet *DB Hub Toko 2299* |
| Database | Google Sheet *DB Hub Toko 2299* (tab users, sessions, dsr, uploads, targets, bobot) |

Data customer yang disimpan hanya kode acak dan nama untuk rekap belanja. Nomor HP dan email tidak dikirim dari browser.

## Pemasangan

1. Buka sheet *DB Hub Toko 2299* → **Ekstensi → Apps Script**.
2. Hapus isi `Code.gs`, tempel isi `apps-script/Code.gs`, lalu simpan.
3. Pilih fungsi `setup` → **Run** → izinkan akses.
4. **Deploy → New deployment → Web app**. Isi *Execute as*: **Me**, *Who has access*: **Anyone** → **Deploy**. Salin URL Web App.
5. Isi `API_URL` di `assets/config.js` dengan URL itu.
6. GitHub: **Settings → Pages → Deploy from a branch → main / root**.
7. Buka web, lalu daftar sebagai akun pertama (otomatis admin).

Kalau `Code.gs` diubah: **Deploy → Manage deployments → Edit → Version: New version → Deploy**. URL-nya tetap sama.
