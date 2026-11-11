# Basecamp 2299

Web hub untuk tim EIGER Store A. Yani Kertasuro Sukoharjo (2299): monitoring sales, unggah DSR, dan jadwal shift. Bisa dibuka di HP maupun komputer.

## Isi

Menu dikelompokkan per kategori (di HP berupa dropdown, di komputer berupa sidebar):

- **Sales**: Monitoring Sales (rumus sama dengan Integrated Hub Jateng 01), Sales Trend (per jam & per hari), RA Performance (per sales person), Produk & Promo (kategori, Pareto 80/20, terlaris, kontribusi promo), Customer & Retur.
- **Inventory**:
  - Monitoring Stok dari sheet SOH (rasio stok, display, status Tipis/Lambat).
  - Stok Artikel dari data by bin, dengan label **NEW** (Created On ≤ 60 hari, dari master artikel) dan **BARU DI TOKO** (pertama ada stok ≤ 30 hari), plus season & collection.
  - Cek Display: generic/varian yang ada di gudang tapi belum di Selling Area (zona Sales Area atau bin berawalan S), % terdisplay vs target 95%, display double + rekomendasi pengganti, analisa per MC.
  - Cari Barang: lokasi bin per SKU dan isi per bin.
  - Unggah By Bin: file export stock by bin, siapa saja, kapan saja.
- **Master artikel** diambil otomatis dari folder Drive *MASTER ARTIKEL 2026* (dicek tiap hari jam 6). File baru dibaca di browser admin (komputer) lalu yang disimpan hanya kolom penting per varian.
- Tombol **Unduh Excel** di Stok, Stok Artikel, Cek Display, Cari Barang, Produk & Promo, RA Performance dan Rekap Kas.
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

## Katalog pelanggan

- **Pilihan toko (koleksi), poster & aplikasi (Nov 2026):** koleksi disusun di Basecamp → Katalog Pelanggan (tab `katalog_koleksi`, latar foto alam Unsplash); poster Status WA / Story IG dibuat di halaman yang sama (3 desain, kanvas di browser, gambar diambil lewat `katalogGambar`); pencarian pelanggan tanpa hasil tercatat sebagai `cari kosong` di `katalog_log` dan tampil di statistik; katalog bisa dipasang di layar utama (`manifest.webmanifest`, `sw.js`, `ikon-*.png`). Daftar berkas yang disalin ke situs katalog ada di `katalog/berkas.txt`.

- **Fitur pelanggan (Nov 2026):** daftar tanya (beberapa barang dalam satu pesan WA, tersimpan di HP pelanggan), "Kabari saya" untuk ukuran kosong (tab `katalog_tunggu`, staf menindaklanjuti di menu **Kabari Pelanggan**), panduan ukuran resmi dari eigeradventure (`katalog_foto.panduan`, dicari bertahap tiap malam), barang serupa, info toko (jam buka & peta di `KATALOG.INFO`), dan peringatan anti-penipuan (alamat resmi, WA resmi, pembayaran hanya di kasir; halaman yang dibuka di alamat lain menampilkan peringatan merah).
- **Statistik & QR:** katalog mengirim jejak anonim (artikel dibuka / tanya stok / scan QR) ke tab `katalog_log` (disimpan 90 hari, dibatasi per menit). Basecamp → Katalog Pelanggan menampilkan statistik dan QR (cetak poster A5 / unduh PNG) yang mengarah ke `https://eigerkartasura.github.io/?dari=qr`.

- **Banner kampanye** diambil otomatis dari beranda eigeradventure.com (`bannerEiger_`, sekali sehari, ikut pemicu 03.00). Banner cara bayar/diskon online dilewati; kalau situs gagal dibaca, daftar terakhir tetap dipakai. Status terlihat di Basecamp → Katalog Pelanggan. Ketuk banner = cari barang serupa di katalog toko.

Halaman publik untuk pelanggan di `katalog/`, tanpa login. Alamat yang dibagikan: **https://eigerkartasura.github.io/** (repo organisasi `eigerkartasura/eigerkartasura.github.io`). Situs itu menyalin `katalog/` + `assets/config.js` dan ikon dari repo ini lewat workflow `salin-katalog.yml` tiap jam (menit ke-7); jangan edit file di repo situs, edit di sini saja. Link lama `…/hub-toko-2299/katalog/` dialihkan otomatis ke alamat baru.

- Isi: artikel yang tersedia di toko per kategori (Tas, Pakaian, Sepatu & sandal, Perlengkapan outdoor, Topi, Aksesoris) dan sub-kategori, pencarian, filter Pria/Wanita, urutan harga. Tombol **Tanya di WhatsApp** ke nomor toko (`KATALOG.WA` di `Code.gs`) dengan pesan berisi nama, kode, warna dan ukuran.
- **Tidak ada jumlah stok.** Per warna hanya ukuran *tersedia* atau *kosong* (dicoret). Data sales, pelanggan dan lokasi bin tidak dikirim.
- Data dari aksi `katalog` (tanpa token): stok tab `bin` (available > 0, barang jual, bukan Damage), nama/gender/harga (Loc Amount) dari `master`, ukuran lengkap dari `master_sku`. Label **Baru** = Created On ≤ batas New Arrival. Disimpan di cache dan dihitung ulang otomatis saat By Bin atau master diunggah.
- **Foto:** pemicu `cariFotoKatalog` (tiap hari 03.00, dilanjutkan otomatis bila belum selesai) memakai pencarian situs eigeradventure per artikel (nama lengkap, lalu nama pendek) dan hanya memakai foto produk yang `skuProduct`-nya sama dengan kode generic. Cadangan: halaman `eigeradventure.com/d/<nama-artikel>` yang mencantumkan kode generic. Artikel yang dicek dengan cara lama otomatis dicek ulang (`KATALOG.METODE`). Hasil di tab `katalog_foto`. Artikel yang tidak ketemu dicoba lagi setelah 14 hari.
- **Harga promo per artikel** dari LIST PROMO bulanan (sheet STORE-SELECTED, menu New Arrival & Promo): pita diskon, harga promo, harga coret dan "Promo s/d <akhir bulan>". Hanya dipakai bila list promo untuk bulan berjalan; filter **Hanya promo** dan urutan **Diskon terbesar**.
- **Promo di toko** (tiket promo umum: event, banking, EAC, dll.) dari tab `katalog_promo`, diisi admin dari Info Promo (Juknis) Integrated Hub Jateng 01. Status berlaku dihitung otomatis tiap hari; yang sudah lewat hilang sendiri.
- **Unggah Juknis PDF (cara utama):** di menu Katalog Pelanggan, file *Juknis Promo <bulan>.pdf* dibaca di browser (pdf.js + `assets/juknis.js`): tiap halaman program (SYARAT KETENTUAN & CONTOH PENERAPAN) menjadi promo dengan periode, minimal belanja, produk dan ketentuan untuk pelanggan (catatan kasir/HO dibuang). Hanya promo toko reguler yang disimpan (`katalogPromoImpor`, sumber `juknis`).
- **Ambil promo otomatis dari Integrated Hub:** bookmark "Kirim promo ke katalog" (tombol di menu Katalog Pelanggan) memuat `assets/kirim-promo.js` di halaman Info Promo (Juknis) Integrated Hub yang sudah login, membaca promo yang sedang/akan berjalan untuk toko reguler, lalu membuka `#/katalog?impor=…` di Basecamp yang menyimpannya (`katalogPromoImpor`). Promo hasil impor sebelumnya diganti; promo yang diisi manual tetap. Tidak ada data login yang dibaca atau disimpan.
- Tampilan memakai warna Eigerindo (navy & oranye) dan font Plus Jakarta Sans + Bricolage Grotesque.
- Menu admin **Katalog Pelanggan**: link untuk dibagikan, status foto, jalankan pencarian, dan isi link foto manual (eigeradventure atau Google Drive). Isian manual tidak pernah ditimpa pencarian otomatis.

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
