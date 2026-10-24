# Basecamp 2299

Web hub untuk tim EIGER Store A. Yani Kertasuro Sukoharjo (2299): monitoring sales, unggah DSR, dan jadwal shift. Bisa dibuka di HP maupun komputer.

## Isi

Menu dikelompokkan per kategori (di HP berupa dropdown, di komputer berupa sidebar):

- **Sales**: Monitoring Sales (rumus sama dengan Integrated Hub Jateng 01), Sales Trend (per jam & per hari), RA Performance (per sales person), Produk & Promo (kategori, Pareto 80/20, terlaris, kontribusi promo), Customer & Retur.
- **Inventory**: Monitoring Stok dari sheet SOH (rasio stok, display, status Tipis/Lambat).
- **Kas**: Cek Kas per pos (Till, Floating Cash, Store Safe, Petty Cash) dan Rekap Selisih per orang.
- **Data**: Unggah DSR (*Item DSR Report* .xlsx). Data dicocokkan per nomor invoice, jadi tidak pernah dobel.
- **Tim**: Jadwal, Request Jadwal (batas tanggal 21), Tukar Shift (rekan menerima, lalu admin menyetujui), Simpanan OFF, Akun, Admin, Aktivitas.

Login per orang: anggota tim mendaftar sendiri, lalu admin menyetujui. Akun pertama otomatis menjadi admin.

### Jadwal di sheet

- Request dan tukar shift yang disetujui ditulis ke sheet **JADWAL KARTASURA JAYA** dengan warna ungu.
- Hanya tab **OKT-NOV 2026 dan sesudahnya** yang diubah. Tab lama tidak pernah disentuh.
- Kalau tab periode berikutnya belum ada, tab baru dibuat otomatis dari tab periode sebelumnya saat request pertama disetujui.
- Lonceng notifikasi: admin melihat request, tukar shift, akun baru (bisa langsung disetujui), selisih kas, DSR, dan status tulis sheet. Tim melihat hasil request dan ajakan tukar shift.
- Batas request untuk periode 24 s/d 23 adalah tanggal 21 bulan mulainya, pukul 23.59. Admin tetap bisa menambahkan.

### Teknis

- Ringkasan harian disimpan di tab `ringkasan` dan laporan disimpan sementara (cache), jadi halaman cepat dibuka.
- Cadangan otomatis setiap Senin dini hari ke folder Drive **Cadangan Hub 2299** (8 cadangan terakhir disimpan).
- Semua aksi penting tercatat di tab `aktivitas`.

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

Kalau `Code.gs` diubah: tempel kode baru, jalankan `setup` sekali (untuk izin baru dan cadangan mingguan), lalu **Terapkan → Kelola deployment → Edit → Versi baru → Terapkan**. URL-nya tetap sama.
