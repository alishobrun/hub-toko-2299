/**
 * Hub Toko 2299 — mesin (API) untuk web hub toko.
 *
 * Dipasang sebagai Apps Script di sheet "DB Hub Toko 2299"
 * (Ekstensi → Apps Script), lalu di-deploy sebagai Web App:
 *   Execute as: Me   ·   Who has access: Anyone
 *
 * Setelah menempel kode: pilih fungsi `setup` lalu klik Run sekali.
 */

const CFG = {
  STORE: '2299',
  STORE_NAME: 'EIGER Store A. Yani Kertasuro Sukoharjo',
  TZ: 'Asia/Jakarta',
  // Sheet "Report Sales Per 2 Jam - Jateng 01" (tab Target: target bulanan + bobot harian)
  TARGET_SHEET_ID: '1c40J7AkgKP7xAzK3ssRismLy9WbM1lWrJKOvzb80lX0',
  // Sheet "JADWAL KARTASURA JAYA"
  JADWAL_SHEET_ID: '1FkeGbkWhAJHLQEhuKNerL9qbhycOA3s8VaNwQd2fbcc',
  // Sheet SOH toko (stok)
  SOH_SHEET_ID: '1C5iIPzR1nuG0_LIsT5BseIuSLoLcLAeunRmhVxKR0uo',
  // Tab jadwal yang boleh diubah web: periode yang mulai tanggal ini atau sesudahnya (OKT-NOV 2026)
  JADWAL_MIN_START: '2026-10-24',
  // Folder "MASTER ARTIKEL 2026" (subfolder per bulan berisi file Excel master artikel)
  MASTER_FOLDER_ID: '191L_XnHi-Z6bLlbgkA4vGpKBSU_7XXDf',
  MASTER_CHUNK: 2 * 1024 * 1024, // potongan teks base64 (kelipatan 4)
  MASTER_CACHE_FOLDER: 'Cache Master Artikel Basecamp 2299',
  NA_HARI: 60,          // New Arrival: dibuat (Created On) maksimal 60 hari lalu
  BARU_TOKO_HARI: 30,   // Baru di toko: pertama kali ada stok maksimal 30 hari lalu
  REQUEST_DEADLINE_DAY: 21,
  REQUEST_COLOR: '#B4A7D6',
  BACKUP_FOLDER: 'Cadangan Hub 2299',
  BACKUP_KEEP: 8,
  SESSION_DAYS: 30,
  HASH_ROUNDS: 300
};

const TABS = {
  users: ['username', 'nama', 'hash', 'salt', 'role', 'status', 'dibuat', 'disetujui_oleh', 'login_terakhir', 'nama_jadwal', 'nama_dsr'],
  sessions: ['token', 'username', 'kedaluwarsa'],
  dsr: ['invoice', 'order_no', 'tanggal', 'jam', 'status', 'tipe', 'sku', 'nama_sku', 'kat3', 'kat4', 'brand',
    'qty', 'harga', 'sales_person', 'gross', 'promo_value', 'promo_name', 'coupon', 'discount', 'net',
    'cust_key', 'cust_name', 'upload_id', 'emp_disc'],
  uploads: ['id', 'waktu', 'username', 'nama_file', 'dari', 'sampai', 'baris', 'invoice_baru', 'invoice_diperbarui', 'invoice_sama'],
  targets: ['bulan', 'target', 'sumber', 'diperbarui'],
  bobot: ['tanggal', 'harian', 'kumulatif'],
  kas: ['id', 'tanggal', 'waktu', 'username', 'nama', 'pecahan', 'total_fisik', 'modal', 'penjualan_tunai',
    'masuk', 'keluar', 'perubahan', 'seharusnya', 'selisih', 'catatan', 'pos'],
  settings: ['key', 'value', 'diperbarui', 'oleh'],
  ringkasan: ['tanggal', 'bruto', 'netto', 'qty', 'trx'],
  aktivitas: ['waktu', 'username', 'aksi', 'detail'],
  request_jadwal: ['id', 'dibuat', 'username', 'nama', 'tanggal', 'jenis', 'alasan', 'pakai_simpanan', 'status',
    'diputus_oleh', 'diputus_pada', 'catatan_admin', 'tertulis'],
  tukar_shift: ['id', 'dibuat', 'pemohon', 'nama_pemohon', 'rekan', 'nama_rekan', 'tanggal', 'shift_pemohon', 'shift_rekan',
    'alasan', 'status', 'diputus_oleh', 'diputus_pada', 'tertulis'],
  simpanan_off: ['id', 'dibuat', 'username', 'nama', 'tanggal_masuk', 'keterangan', 'status', 'diambil_tanggal', 'dicatat_oleh'],
  traffic: ['tanggal', 'traffic', 'diperbarui'],
  notifikasi: ['id', 'waktu', 'untuk', 'level', 'jenis', 'judul', 'isi', 'link', 'dibaca'],
  bin: ['sku', 'nama', 'generic', 'bin', 'zona', 'lv2', 'lv3', 'lv4', 'brand', 'kategori', 'total', 'available', 'allocated', 'proses'],
  bin_upload: ['id', 'waktu', 'username', 'nama_file', 'baris', 'sku', 'pcs'],
  varian_pertama: ['varian', 'generic', 'pertama', 'baseline'],
  master: ['varian', 'generic', 'nama', 'warna', 'dibuat', 'dibuat_terbaru', 'season', 'collection', 'story', 'gender', 'activity',
    'lv2', 'lv3', 'lv4', 'dc_status', 'product_status', 'grade', 'harga'],
  target_ra: ['bulan', 'ra', 'target', 'diubah', 'oleh'],
  pengumuman: ['id', 'dibuat', 'oleh', 'nama', 'judul', 'isi', 'penting', 'aktif', 'diubah'],
  pengumuman_baca: ['id', 'username', 'waktu'],
  handover: ['id', 'waktu', 'tanggal', 'shift', 'username', 'nama', 'isi', 'foto'],
  handover_baca: ['id', 'username', 'waktu'],
  // feedback anonim: SENGAJA tanpa kolom pengirim
  feedback: ['id', 'tanggal', 'kirim', 'untuk', 'jenis', 'isi', 'dibaca', 'dilaporkan', 'alasan_lapor'],
  apresiasi: ['id', 'waktu', 'username', 'nama', 'untuk', 'untuk_nama', 'isi', 'aktif'],
  omni_target: ['bulan', 'jenis', 'target', 'diubah', 'oleh'],
  push_sub: ['username', 'endpoint', 'p256dh', 'auth', 'ua', 'dibuat', 'terakhir'],
  jadwal_draf: ['periode', 'status', 'dibuat', 'diubah', 'oleh', 'data']
};

const PECAHAN = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
const SETTING_DEFAULTS = { modal_till: 600000, floating_cash: 2400000, target_upt: 2, target_basket: 0, dok_max_mb: 300, dok_batas_open: 630, dok_batas_close: 1350, na_hari: 60, dok_ingat_open: 570, dok_ingat_close: 1290, data_batas: 660 };

// Kolom yang disimpan sebagai teks (supaya tanggal/kode tidak diubah Sheets)
const NUM_COLS = {
  dsr: ['qty', 'harga', 'gross', 'promo_value', 'coupon', 'discount', 'net', 'emp_disc'],
  traffic: ['traffic'],
  uploads: ['baris', 'invoice_baru', 'invoice_diperbarui', 'invoice_sama'],
  targets: ['target'],
  omni_target: ['target'],
  bobot: ['harian', 'kumulatif'],
  kas: ['total_fisik', 'modal', 'penjualan_tunai', 'masuk', 'keluar', 'seharusnya', 'selisih'],
  settings: ['value'],
  ringkasan: ['bruto', 'netto', 'qty', 'trx'],
  bin: ['total', 'available', 'allocated', 'proses'],
  bin_upload: ['baris', 'sku', 'pcs'],
  master: ['harga'],
  target_ra: ['target']
};
const DSR_FIELDS = TABS.dsr.filter(function (f) { return f !== 'upload_id'; }); // urutan kolom yang dikirim web

/* ===================== Setup ===================== */

function setup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(CFG.TZ);
  Object.keys(TABS).forEach(function (name) {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const h = TABS[name];
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#0B1F5C').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    formatCols_(sh, name, 1, sh.getMaxRows());
  });
  ['Sheet1', 'Sheet 1', 'Lembar1', 'Lembar 1'].forEach(function (n) {
    const s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1 && s.getLastRow() === 0) ss.deleteSheet(s);
  });
  pasangCadanganMingguan_();
  pasangCatatTraffic_();
  pasangCekMaster_();
  try { syncTraffic_(); } catch (e) { Logger.log('Traffic: ' + e); }
  rebuildRingkasan_();
  const r = syncTarget_();
  Logger.log('Setup selesai. Target: ' + JSON.stringify(r));
  return r;
}

/* ===================== HTTP ===================== */

function doGet() {
  return json_({ ok: true, app: 'Basecamp ' + CFG.STORE });
}

function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = API[req.action];
    if (!fn) throw new Error('Aksi tidak dikenal: ' + req.action);
    out = { ok: true, data: fn(req) };
    // notifikasi penting langsung dikirim ke HP (tanpa menunggu pengecekan 15 menit)
    const seg = PUSH_SEGERA_AKSI[req.action];
    if (seg) seg(req).forEach(function (t) { PUSH_SEGERA[t] = 1; });
    if (Object.keys(PUSH_SEGERA).length) { try { pushUntuk_(Object.keys(PUSH_SEGERA)); } catch (e) { Logger.log('push segera: ' + e); } }
  } catch (err) {
    const msg = String((err && err.message) || err);
    out = { ok: false, auth: msg.indexOf('AUTH:') === 0, error: msg.replace(/^AUTH:\s*/, '') };
  }
  return json_(out);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ===================== API ===================== */

const API = {
  register: function (req) {
    const username = cleanUser_(req.username);
    const nama = String(req.nama || '').trim().slice(0, 60);
    const pw = String(req.password || '');
    if (!/^[a-z0-9._]{3,20}$/.test(username)) throw new Error('Username 3–20 karakter: huruf kecil, angka, titik atau garis bawah');
    if (nama.length < 2) throw new Error('Nama lengkap wajib diisi');
    if (pw.length < 6) throw new Error('Password minimal 6 karakter');
    return withLock_(function () {
      const users = read_('users');
      if (users.some(function (u) { return u.username === username; })) throw new Error('Username sudah dipakai');
      const first = users.length === 0;
      const salt = Utilities.getUuid();
      append_('users', {
        username: username, nama: nama, hash: hash_(pw, salt), salt: salt,
        role: first ? 'admin' : 'staf', status: first ? 'aktif' : 'menunggu',
        dibuat: now_(), disetujui_oleh: first ? '(admin pertama)' : '', login_terakhir: ''
      });
      log_(username, 'daftar', nama);
      return { status: first ? 'aktif' : 'menunggu', role: first ? 'admin' : 'staf' };
    });
  },

  login: function (req) {
    const username = cleanUser_(req.username);
    const u = read_('users').filter(function (x) { return x.username === username; })[0];
    if (!u || hash_(String(req.password || ''), u.salt) !== u.hash) throw new Error('Username atau password salah');
    if (u.status === 'menunggu') throw new Error('Akun Anda masih menunggu persetujuan admin');
    if (u.status !== 'aktif') throw new Error('Akun Anda dinonaktifkan. Hubungi admin.');
    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    const exp = Utilities.formatDate(new Date(Date.now() + CFG.SESSION_DAYS * 864e5), CFG.TZ, 'yyyy-MM-dd HH:mm:ss');
    withLock_(function () {
      const now = now_();
      const keep = read_('sessions').filter(function (s) { return String(s.kedaluwarsa) > now; });
      keep.push({ token: token, username: username, kedaluwarsa: exp });
      writeAll_('sessions', keep);
      updateRow_('users', 'username', username, { login_terakhir: now });
      log_(username, 'login', '');
    });
    return { token: token, user: publicUser_(u) };
  },

  logout: function (req) {
    const t = String(req.token || '');
    if (!t) return true;
    withLock_(function () {
      writeAll_('sessions', read_('sessions').filter(function (s) { return s.token !== t; }));
    });
    return true;
  },

  me: function (req) {
    const u = auth_(req);
    const out = publicUser_(u);
    if (u.role === 'admin') out.menunggu = read_('users').filter(function (x) { return x.status === 'menunggu'; }).length;
    return out;
  },

  changePassword: function (req) {
    const u = auth_(req);
    if (hash_(String(req.oldPassword || ''), u.salt) !== u.hash) throw new Error('Password lama salah');
    const pw = String(req.newPassword || '');
    if (pw.length < 6) throw new Error('Password baru minimal 6 karakter');
    const salt = Utilities.getUuid();
    withLock_(function () { updateRow_('users', 'username', u.username, { hash: hash_(pw, salt), salt: salt }); });
    return true;
  },

  /* ---------- admin ---------- */
  users: function (req) {
    auth_(req, true);
    return read_('users').map(function (u) {
      return {
        username: u.username, nama: u.nama, role: u.role, status: u.status,
        dibuat: String(u.dibuat), disetujui_oleh: String(u.disetujui_oleh), login_terakhir: String(u.login_terakhir),
        nama_jadwal: String(u.nama_jadwal || '')
      };
    });
  },

  setUserStatus: function (req) {
    const a = auth_(req, true);
    const target = cleanUser_(req.username);
    if (target === a.username) throw new Error('Tidak bisa mengubah status akun sendiri');
    if (['aktif', 'nonaktif'].indexOf(req.status) < 0) throw new Error('Status tidak dikenal');
    return withLock_(function () {
      const patch = { status: req.status };
      if (req.status === 'aktif') patch.disetujui_oleh = a.username;
      if (!updateRow_('users', 'username', target, patch)) throw new Error('User tidak ditemukan');
      if (req.status === 'nonaktif') {
        writeAll_('sessions', read_('sessions').filter(function (s) { return s.username !== target; }));
      }
      log_(a.username, 'status akun', target + ' → ' + req.status);
      return true;
    });
  },

  resetPassword: function (req) {
    const a = auth_(req, true);
    const target = cleanUser_(req.username);
    if (target === a.username) throw new Error('Untuk akun sendiri, pakai menu Ganti password');
    const temp = randomPassword_();
    const salt = Utilities.getUuid();
    return withLock_(function () {
      if (!updateRow_('users', 'username', target, { hash: hash_(temp, salt), salt: salt })) throw new Error('User tidak ditemukan');
      writeAll_('sessions', read_('sessions').filter(function (s) { return s.username !== target; }));
      log_(a.username, 'reset password', target);
      return { password: temp };
    });
  },

  /* ---------- data ---------- */
  info: function (req) {
    auth_(req);
    const ups = read_('uploads');
    const last = ups.length ? ups[ups.length - 1] : null;
    return {
      store: CFG.STORE, storeName: CFG.STORE_NAME,
      dataSampai: latestDate_(),
      unggahTerakhir: last ? {
        waktu: String(last.waktu), username: last.username, nama: namaUser_(last.username),
        dari: String(last.dari), sampai: String(last.sampai),
        baru: Number(last.invoice_baru), diperbarui: Number(last.invoice_diperbarui), sama: Number(last.invoice_sama)
      } : null
    };
  },

  uploads: function (req) {
    auth_(req);
    const names = {};
    read_('users').forEach(function (u) { names[u.username] = u.nama; });
    return read_('uploads').slice(-30).reverse().map(function (r) {
      return {
        waktu: String(r.waktu), username: r.username, nama: names[r.username] || r.username,
        file: r.nama_file, dari: String(r.dari), sampai: String(r.sampai), baris: Number(r.baris),
        baru: Number(r.invoice_baru), diperbarui: Number(r.invoice_diperbarui), sama: Number(r.invoice_sama)
      };
    });
  },

  upload: function (req) {
    const u = auth_(req);
    const rows = req.rows || [];
    if (!rows.length) throw new Error('File tidak berisi transaksi');
    const lokasi = String(req.lokasi || '');
    if (lokasi && lokasi.indexOf(CFG.STORE) < 0) throw new Error('File ini bukan DSR toko ' + CFG.STORE + ' (' + lokasi + ')');
    const N = DSR_FIELDS.length;
    rows.forEach(function (r, i) {
      if (!Array.isArray(r) || r.length !== N) throw new Error('Format baris ke-' + (i + 1) + ' tidak sesuai. Muat ulang halaman lalu coba lagi.');
      if (!r[0]) throw new Error('Baris ke-' + (i + 1) + ' tidak punya nomor invoice');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r[2]))) throw new Error('Tanggal baris ke-' + (i + 1) + ' tidak terbaca');
    });
    return simpanDsr_(rows, u, req.fileName);
  },

  monitoring: function (req) {
    auth_(req);
    const latest = latestDate_();
    const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(req.tanggal || '')) ? String(req.tanggal) : latest;
    const bulan = tanggal.slice(0, 7);
    syncTargetIfNeeded_(bulan);
    syncTrafficIfNeeded_();
    return cached_('mon_' + tanggal, 300, function () {
      const t = read_('targets').filter(function (x) { return String(x.bulan) === bulan; })[0];
      const bobot = {};
      read_('bobot').forEach(function (b) {
        const d = String(b.tanggal);
        if (d.slice(0, 7) === bulan) bobot[d] = { harian: Number(b.harian), kumulatif: Number(b.kumulatif) };
      });
      return {
        tanggal: tanggal, bulan: bulan, dataSampai: latest,
        store: CFG.STORE, storeName: CFG.STORE_NAME,
        target: t ? Number(t.target) : null, targetSumber: t ? String(t.sumber) : null,
        bobot: bobot,
        harian: ringkasan_().filter(function (r) { return r.tanggal.slice(0, 7) === bulan; }),
        traffic: trafficMap_(bulan)
      };
    });
  },

  jadwal: function (req) {
    auth_(req);
    return readJadwal_(Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'));
  },

  /* Satu request untuk pemuatan awal halaman (beranda): menghemat beberapa
   * kali bolak-balik ke Apps Script. Struktur: { user, notif, jadwal, mon }. */
  bootstrap: function (req) {
    const u = auth_(req);
    const out = { user: publicUser_(u) };
    if (u.role === 'admin') {
      out.user.menunggu = read_('users').filter(function (x) { return x.status === 'menunggu'; }).length;
    }
    out.notif = API.notif(req);
    out.jadwal = readJadwal_(Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'));
    out.mon = API.monitoring(req);
    return out;
  },

  /* ---------- Cek kas till ---------- */
  settings: function (req) {
    auth_(req);
    return settings_();
  },

  setSetting: function (req) {
    const a = auth_(req, true);
    const key = String(req.key || '');
    if (!Object.prototype.hasOwnProperty.call(SETTING_DEFAULTS, key)) throw new Error('Pengaturan tidak dikenal');
    const val = Number(req.value);
    if (!isFinite(val) || val < 0) throw new Error('Nilai harus angka 0 atau lebih');
    return withLock_(function () {
      const rows = read_('settings');
      const ex = rows.filter(function (r) { return String(r.key) === key; })[0];
      if (ex) { ex.value = val; ex.diperbarui = now_(); ex.oleh = a.username; }
      else rows.push({ key: key, value: val, diperbarui: now_(), oleh: a.username });
      writeAll_('settings', rows);
      log_(a.username, 'ubah pengaturan', key + ' = ' + val);
      return settings_();
    });
  },

  kasSave: function (req) {
    const u = auth_(req);
    const counts = req.pecahan || {};
    const clean = {};
    let fisik = 0;
    PECAHAN.forEach(function (p) {
      const n = Number(counts[p] || 0);
      if (!isFinite(n) || n < 0 || Math.floor(n) !== n || n > 100000) throw new Error('Jumlah lembar pecahan ' + p + ' tidak valid');
      if (n) clean[p] = n;
      fisik += n * p;
    });
    const pos = POS_KAS.indexOf(req.pos) >= 0 ? req.pos : 'till';
    const tunai = pos === 'till' ? Number(req.penjualanTunai || 0) : 0;
    if (!isFinite(tunai) || tunai < 0) throw new Error('Penjualan tunai tidak valid');
    const perubahan = (req.perubahan || []).map(function (x, i) {
      const jenis = x && x.jenis === 'masuk' ? 'masuk' : 'keluar';
      const jumlah = Number(x && x.jumlah);
      const ket = String((x && x.ket) || '').trim().slice(0, 200);
      if (!isFinite(jumlah) || jumlah <= 0) throw new Error('Jumlah perubahan kas ke-' + (i + 1) + ' tidak valid');
      if (!ket) throw new Error('Keterangan perubahan kas ke-' + (i + 1) + ' wajib diisi');
      return { jenis: jenis, jumlah: Math.round(jumlah), ket: ket };
    });
    const masuk = perubahan.filter(function (x) { return x.jenis === 'masuk'; }).reduce(function (s, x) { return s + x.jumlah; }, 0);
    const keluar = perubahan.filter(function (x) { return x.jenis === 'keluar'; }).reduce(function (s, x) { return s + x.jumlah; }, 0);
    const set = settings_();
    // Till: modal + tunai ± perubahan · Floating Cash: standar ± perubahan · Store Safe & Petty Cash: dicatat saja
    const modal = pos === 'till' ? set.modal_till : pos === 'floating' ? set.floating_cash : null;
    const seharusnya = modal == null ? null : modal + tunai + masuk - keluar;
    const selisih = seharusnya == null ? null : fisik - seharusnya;
    const catatan = String(req.catatan || '').trim().slice(0, 300);
    if (selisih && !catatan) throw new Error('Ada selisih, isi catatan penjelasannya dulu');
    const now = new Date();
    const rec = {
      id: Utilities.formatDate(now, CFG.TZ, 'yyyyMMdd-HHmmss') + '-' + pos + '-' + u.username,
      tanggal: Utilities.formatDate(now, CFG.TZ, 'yyyy-MM-dd'), waktu: now_(),
      username: u.username, nama: u.nama, pecahan: JSON.stringify(clean), total_fisik: fisik,
      modal: modal == null ? '' : modal, penjualan_tunai: Math.round(tunai), masuk: masuk, keluar: keluar,
      perubahan: JSON.stringify(perubahan), seharusnya: seharusnya == null ? '' : seharusnya,
      selisih: selisih == null ? '' : selisih, catatan: catatan, pos: pos
    };
    withLock_(function () {
      append_('kas', rec);
      log_(u.username, 'cek kas ' + POS_NAMA[pos], 'fisik ' + fisik + (selisih == null ? '' : ', selisih ' + selisih));
      if (selisih) notif_('admin', 'cek', 'kas', 'Selisih ' + POS_NAMA[pos] + ' ' + (selisih > 0 ? 'lebih' : 'kurang') + ' Rp' + rupiah_(Math.abs(selisih)),
        u.nama + ' · ' + rec.waktu.slice(11, 16) + (catatan ? ' · ' + catatan : ''), '#/kas-rekap');
    });
    return kasOut_(rec);
  },

  kasList: function (req) {
    auth_(req);
    const tgl = /^\d{4}-\d{2}-\d{2}$/.test(String(req.tanggal || '')) ? String(req.tanggal) : Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
    const pos = POS_KAS.indexOf(req.pos) >= 0 ? req.pos : 'till';
    const all = read_('kas').filter(function (r) { return (String(r.pos || '') || 'till') === pos; });
    const days = {};
    all.forEach(function (r) { days[String(r.tanggal)] = 1; });
    return {
      tanggal: tgl, pos: pos,
      tanggalTersedia: Object.keys(days).sort().reverse().slice(0, 60),
      list: all.filter(function (r) { return String(r.tanggal) === tgl; }).map(kasOut_).reverse()
    };
  },

  kasRekap: function (req) {
    auth_(req);
    const bulan = /^\d{4}-\d{2}$/.test(String(req.bulan || '')) ? String(req.bulan) : Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM');
    const by = {};
    const months = {};
    read_('kas').forEach(function (r) {
      months[String(r.tanggal).slice(0, 7)] = 1;
      if (String(r.tanggal).slice(0, 7) !== bulan) return;
      const pos = String(r.pos || '') || 'till';
      const k = r.username + '|' + pos;
      const o = by[k] || (by[k] = { username: r.username, nama: r.nama, pos: pos, hitungan: 0, adaSelisih: 0, kurang: 0, lebih: 0 });
      o.hitungan++;
      if (r.selisih !== '' && Number(r.selisih) !== 0) {
        o.adaSelisih++;
        if (Number(r.selisih) < 0) o.kurang += -Number(r.selisih); else o.lebih += Number(r.selisih);
      }
    });
    return { bulan: bulan, bulanTersedia: Object.keys(months).sort().reverse(), list: Object.keys(by).map(function (k) { return by[k]; }) };
  }
};

const POS_KAS = ['till', 'safe', 'floating', 'petty'];
const POS_NAMA = { till: 'Till', safe: 'Store Safe', floating: 'Floating Cash', petty: 'Petty Cash' };

function settings_() {
  const out = {};
  Object.keys(SETTING_DEFAULTS).forEach(function (k) { out[k] = SETTING_DEFAULTS[k]; });
  read_('settings').forEach(function (r) { if (Object.prototype.hasOwnProperty.call(SETTING_DEFAULTS, String(r.key)) && r.value !== '') out[String(r.key)] = Number(r.value); });
  return out;
}

function kasOut_(r) {
  let pec = {}, per = [];
  try { pec = JSON.parse(String(r.pecahan || '{}')); } catch (e) {}
  try { per = JSON.parse(String(r.perubahan || '[]')); } catch (e) {}
  const nn = function (v) { return v === '' || v == null ? null : Number(v); };
  return {
    id: String(r.id), tanggal: String(r.tanggal), waktu: String(r.waktu), username: r.username, nama: r.nama,
    pos: String(r.pos || '') || 'till',
    pecahan: pec, totalFisik: Number(r.total_fisik), modal: nn(r.modal), penjualanTunai: Number(r.penjualan_tunai) || 0,
    masuk: Number(r.masuk) || 0, keluar: Number(r.keluar) || 0, perubahan: per,
    seharusnya: nn(r.seharusnya), selisih: nn(r.selisih), catatan: String(r.catatan || '')
  };
}

/* ===================== Rumus sales (sama dengan Integrated Hub Jateng 01) ===================== */

/** Baris yang dihitung sebagai sales (sama dengan Monitoring Sales Integrated Hub Jateng 01):
 *  barang dagangan brand EIGER. Tidak dihitung: paper bag, voucher (Eiger Voucher), barang bukan jual
 *  berkode 98…, serta jasa seperti reparasi & packing WAB/ECOM. */
function isSalesLine_(r) {
  return String(r.brand).trim().toUpperCase() === 'EIGER' && !/^98/.test(String(r.sku).trim())
    && !/PAPER\s*BAG|VOUCHER/i.test(String(r.nama_sku)) && String(r.kat4).trim().toUpperCase() !== 'VOUCHER';
}
const RUMUS_SALES = '2'; // naikkan bila rumus berubah → ringkasan dihitung ulang otomatis

/** Ringkasan per tanggal: bruto (Gross Amount), netto (Net Amount), transaksi (invoice unik), qty.
 *  Retur (qty minus) ikut mengurangi. */
function aggregateDaily_(rows) {
  const by = {};
  rows.forEach(function (r) {
    if (!isSalesLine_(r)) return;
    const d = String(r.tanggal);
    const o = by[d] || (by[d] = { tanggal: d, bruto: 0, netto: 0, qty: 0, inv: {} });
    o.bruto += Number(r.gross) || 0;
    o.netto += Number(r.net) || 0;
    o.qty += Number(r.qty) || 0;
    o.inv[String(r.invoice)] = 1;
  });
  return Object.keys(by).sort().map(function (d) {
    const o = by[d];
    return { tanggal: d, bruto: Math.round(o.bruto), netto: Math.round(o.netto), qty: o.qty, trx: Object.keys(o.inv).length };
  });
}

/* ===================== Gabung unggahan (anti-dobel per invoice) ===================== */

function mergeDsr_(existing, rows, id) {
  const N = DSR_FIELDS.length;
  const norm = function (v) { return v == null ? '' : String(v); };
  const sig = function (arr) { return arr.map(function (r) { return r.slice(0, N).map(norm).join('\u0001'); }).sort().join('\u0002'); };

  const incoming = {};
  rows.forEach(function (r) { (incoming[r[0]] = incoming[r[0]] || []).push(r); });
  const exByInv = {};
  existing.forEach(function (o) {
    const k = String(o.invoice);
    (exByInv[k] = exByInv[k] || []).push(DSR_FIELDS.map(function (f) { return o[f]; }));
  });

  let baru = 0, diperbarui = 0, sama = 0;
  const changed = {};
  Object.keys(incoming).forEach(function (inv) {
    if (!exByInv[inv]) { baru++; changed[inv] = 1; }
    else if (sig(exByInv[inv]) === sig(incoming[inv])) sama++;
    else { diperbarui++; changed[inv] = 1; }
  });

  let dari = null, sampai = null;
  rows.forEach(function (r) { const d = String(r[2]); if (!dari || d < dari) dari = d; if (!sampai || d > sampai) sampai = d; });

  const out = { id: id, baru: baru, diperbarui: diperbarui, sama: sama, dari: dari, sampai: sampai, changed: Object.keys(changed).length > 0, all: null };
  if (out.changed) {
    const keep = existing.filter(function (o) { return !changed[String(o.invoice)]; });
    const add = [];
    Object.keys(changed).forEach(function (inv) {
      incoming[inv].forEach(function (r) {
        const o = {};
        DSR_FIELDS.forEach(function (f, i) { o[f] = r[i]; });
        o.upload_id = id;
        add.push(o);
      });
    });
    out.all = keep.concat(add).sort(function (a, b) {
      const ka = String(a.tanggal) + ' ' + String(a.jam) + ' ' + String(a.invoice);
      const kb = String(b.tanggal) + ' ' + String(b.jam) + ' ' + String(b.invoice);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }
  return out;
}

/* ===================== Target & bobot dari sheet Jateng 01 ===================== */

function syncTargetIfNeeded_(bulan) {
  const cache = CacheService.getScriptCache();
  const key = 'sync_' + bulan;
  if (cache.get(key)) return;
  try { syncTarget_(); } catch (e) { Logger.log('Sync target gagal: ' + e); }
  cache.put(key, '1', 3600);
}

/** Membaca tab Target: total target toko ini + tabel bobot (Daily Ratio, Cumm. Ratio) bulan berjalan. */
function syncTarget_() {
  const sh = SpreadsheetApp.openById(CFG.TARGET_SHEET_ID).getSheetByName('Target');
  if (!sh) throw new Error('Tab Target tidak ditemukan');
  const v = sh.getDataRange().getValues();
  const head = v[0].map(function (x) { return String(x).trim().toLowerCase(); });
  const iTotal = head.indexOf('total');
  let target = null;
  v.forEach(function (r) { if (String(r[0]).trim() === CFG.STORE && iTotal >= 0) target = num_(r[iTotal]); });

  const bobot = [];
  for (let i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim().toLowerCase() === 'date' && /cumm/i.test(String(v[i][3]))) {
      for (let j = i + 1; j < v.length; j++) {
        const d = toIsoDate_(v[j][0]);
        if (!d) break;
        bobot.push({ tanggal: d, harian: pct_(v[j][2]), kumulatif: pct_(v[j][3]) });
      }
      break;
    }
  }
  if (!bobot.length) throw new Error('Tabel bobot (Date / Daily Ratio / Cumm. Ratio) tidak ditemukan di tab Target');
  const bulan = bobot[0].tanggal.slice(0, 7);

  withLock_(function () {
    const b = read_('bobot').filter(function (x) { return String(x.tanggal).slice(0, 7) !== bulan; }).concat(bobot)
      .sort(function (a, c) { return String(a.tanggal) < String(c.tanggal) ? -1 : 1; });
    writeAll_('bobot', b);
    if (target != null) {
      const ts = read_('targets');
      const ex = ts.filter(function (x) { return String(x.bulan) === bulan; })[0];
      if (!ex) ts.push({ bulan: bulan, target: target, sumber: 'Target Jateng 01', diperbarui: now_() });
      else if (String(ex.sumber) !== 'manual') { ex.target = target; ex.sumber = 'Target Jateng 01'; ex.diperbarui = now_(); }
      ts.sort(function (a, c) { return String(a.bulan) < String(c.bulan) ? -1 : 1; });
      writeAll_('targets', ts);
    }
  });
  return { bulan: bulan, target: target, hari: bobot.length };
}

/* ===================== Jadwal ===================== */

const MON_ = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MEI: 5, MAY: 5, JUN: 6, JUL: 7, AGS: 8, AGU: 8, AUG: 8, SEP: 9, OKT: 10, OCT: 10, NOV: 11, DES: 12, DEC: 12 };
const WD_ = { MG: 0, SN: 1, SL: 2, RB: 3, KM: 4, JM: 5, SB: 6 };

function monthsFromName_(name) {
  const parts = String(name).toUpperCase().replace(/[^A-Z0-9\- ]/g, ' ').split(/[-\s]+/).filter(Boolean);
  const ms = [];
  parts.forEach(function (p) { const m = MON_[p.slice(0, 3)]; if (m && /^[A-Z]/.test(p)) ms.push(m); });
  return ms.slice(0, 2);
}

function parseJadwal_(v, months, name, today) {
  const days = v[0] || [], hari = v[2] || [];
  const nowY = Number(today.slice(0, 4));
  const yMatch = String(name).match(/20\d\d/);
  let year = yMatch ? Number(yMatch[0]) : nowY;
  const d1 = Number(days[1]), wd = WD_[String(hari[1] || '').trim().toUpperCase()];
  if (!yMatch && wd != null && d1) {
    const c = [];
    for (let y = nowY - 3; y <= nowY + 1; y++) if (new Date(Date.UTC(y, months[0] - 1, d1)).getUTCDay() === wd) c.push(y);
    if (c.length) year = c.sort(function (a, b) { return Math.abs(a - nowY) - Math.abs(b - nowY); })[0];
  }
  const dates = [], hariList = [];
  let mi = 0, prev = 0;
  for (let c = 1; c < days.length; c++) {
    const d = Number(String(days[c]).trim());
    if (!d || d > 31) { dates.push(null); hariList.push(null); continue; }
    if (d < prev && mi < months.length - 1) mi++;
    prev = d;
    let y = year;
    if (mi > 0 && months[mi] < months[0]) y = year + 1;
    dates.push(y + '-' + pad_(months[mi]) + '-' + pad_(d));
    hariList.push(String(hari[c] || '').trim());
  }
  const staff = [];
  for (let r = 3; r < v.length; r++) {
    const nama = String(v[r][0] || '').trim();
    if (!nama) break;
    const shifts = [];
    dates.forEach(function (t, i) { if (t) shifts.push(String(v[r][i + 1] || '').trim().toUpperCase()); });
    staff.push({ nama: nama, shift: shifts });
  }
  return { tab: name, tanggal: dates.filter(Boolean), hari: hariList.filter(function (x, i) { return dates[i]; }), staf: staff };
}

function readJadwal_(today) {
  const ss = SpreadsheetApp.openById(CFG.JADWAL_SHEET_ID);
  const sheets = ss.getSheets().slice().reverse();
  let first = null, checked = 0;
  for (let i = 0; i < sheets.length && checked < 5; i++) {
    const s = sheets[i];
    const months = monthsFromName_(s.getName());
    if (!months.length) continue;
    checked++;
    const v = s.getRange('B2:AJ16').getDisplayValues();
    const p = parseJadwal_(v, months, s.getName(), today);
    if (!p.staf.length || !p.tanggal.length) continue;
    if (p.tanggal.indexOf(today) >= 0) { p.hariIni = today; return p; }
    if (!first) first = p;
  }
  if (first) first.hariIni = today;
  return first || { tab: null, tanggal: [], hari: [], staf: [], hariIni: today };
}

/* ===================== Helpers ===================== */

function auth_(req, needAdmin) {
  const t = String(req.token || '');
  if (!t) throw new Error('AUTH: Silakan masuk dulu');
  const ses = readCached_('sessions', 30).filter(function (s) { return s.token === t; })[0];
  if (!ses || String(ses.kedaluwarsa) < now_()) throw new Error('AUTH: Sesi berakhir, silakan masuk lagi');
  const u = readCached_('users', 60).filter(function (x) { return x.username === ses.username; })[0];
  if (!u || u.status !== 'aktif') throw new Error('AUTH: Akun tidak aktif');
  if (needAdmin && u.role !== 'admin') throw new Error('Menu ini khusus admin');
  return u;
}

function publicUser_(u) { return { username: u.username, nama: u.nama, role: u.role }; }
function namaUser_(username) { const u = readCached_('users', 60).filter(function (x) { return x.username === username; })[0]; return u ? u.nama : username; }
function cleanUser_(u) { return String(u || '').trim().toLowerCase(); }
function now_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function pad_(n) { return (n < 10 ? '0' : '') + n; }
function uploadId_(username) { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMdd-HHmmss') + '-' + username; }

function hash_(pw, salt) {
  let h = salt + '|' + pw;
  for (let i = 0; i < CFG.HASH_ROUNDS; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  }
  return h;
}

function randomPassword_() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function num_(x) {
  if (typeof x === 'number') return x;
  const s = String(x).replace(/[^0-9.\-]/g, '');
  return s ? Number(s) : null;
}
function pct_(x) {
  if (typeof x === 'number') return x;
  const s = String(x).trim();
  const n = Number(s.replace('%', '').replace(',', '.'));
  return isNaN(n) ? null : (s.indexOf('%') >= 0 ? n / 100 : n);
}
function toIsoDate_(x) {
  if (x instanceof Date) return Utilities.formatDate(x, CFG.TZ, 'yyyy-MM-dd');
  const m = String(x).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + pad_(Number(m[1])) + '-' + pad_(Number(m[2]));
  const m2 = String(x).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m2 ? m2[0] : null;
}

function latestDate_() {
  const s = sh_('dsr');
  const last = s.getLastRow();
  if (last < 2) return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
  // data disimpan urut tanggal, jadi baris terakhir = tanggal terbaru
  return String(s.getRange(last, TABS.dsr.indexOf('tanggal') + 1).getDisplayValue());
}

function withLock_(fn, ms) {
  const lock = LockService.getScriptLock();
  lock.waitLock(ms || 30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function sh_(n) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(n);
  if (!s) {
    if (!TABS[n]) throw new Error('Tab "' + n + '" tidak dikenal');
    // tab baru (mis. setelah pembaruan kode) dibuat otomatis
    s = ss.insertSheet(n);
    const h = TABS[n];
    s.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#0B1F5C').setFontColor('#FFFFFF');
    s.setFrozenRows(1);
    formatCols_(s, n, 1, s.getMaxRows());
  } else if (!HEADER_OK_[n] && TABS[n]) {
    // kolom baru ditambahkan di ujung setelah pembaruan kode: perbarui baris judul
    const h = TABS[n];
    const cur = s.getRange(1, 1, 1, h.length).getValues()[0].map(String);
    if (cur.join('|') !== h.join('|')) {
      if (s.getMaxColumns() < h.length) s.insertColumnsAfter(s.getMaxColumns(), h.length - s.getMaxColumns());
      s.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#0B1F5C').setFontColor('#FFFFFF');
      formatCols_(s, n, 2, Math.max(1, s.getMaxRows() - 1));
    }
  }
  HEADER_OK_[n] = true;
  return s;
}
const HEADER_OK_ = {};

function formatCols_(sh, name, startRow, count) {
  if (count < 1) return;
  const h = TABS[name];
  const nums = NUM_COLS[name] || [];
  h.forEach(function (k, i) {
    sh.getRange(startRow, i + 1, count, 1).setNumberFormat(nums.indexOf(k) >= 0 ? '0.########' : '@');
  });
}

function read_(n) {
  const s = sh_(n), h = TABS[n];
  const last = s.getLastRow();
  if (last < 2) return [];
  const v = s.getRange(2, 1, last - 1, h.length).getValues();
  return v.map(function (r) {
    const o = {};
    h.forEach(function (k, i) { o[k] = r[i]; });
    return o;
  });
}

/* Baca sheet dengan cache pendek — untuk tab yang sering dibaca & jarang berubah
 * (sessions, users). Otomatis batal saat tab itu ditulis (lihat bump di
 * writeAll_/append_/updateRow_). */
function readCached_(n, seconds) {
  const c = CacheService.getScriptCache();
  const k = 'rc_' + n + '_v' + (PropertiesService.getScriptProperties().getProperty('ver') || '0');
  const hit = c.get(k);
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* lanjut baca sheet */ } }
  const out = read_(n);
  try { c.put(k, JSON.stringify(out), seconds || 60); } catch (e) { /* terlalu besar */ }
  return out;
}

function invalidateReadCache_(n) {
  if (n === 'users' || n === 'sessions') bumpVersion_();
}

function writeAll_(n, objs) {
  const s = sh_(n), h = TABS[n];
  const last = s.getLastRow();
  if (last > 1) s.getRange(2, 1, last - 1, h.length).clearContent();
  if (!objs.length) { invalidateReadCache_(n); return; }
  const need = objs.length + 1;
  if (s.getMaxRows() < need) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows());
  formatCols_(s, n, 2, objs.length);
  s.getRange(2, 1, objs.length, h.length).setValues(objs.map(function (o) {
    return h.map(function (k) { return o[k] == null ? '' : o[k]; });
  }));
  invalidateReadCache_(n);
}

function append_(n, o) {
  const s = sh_(n), h = TABS[n];
  const r = s.getLastRow() + 1;
  if (s.getMaxRows() < r) s.insertRowsAfter(s.getMaxRows(), 1);
  formatCols_(s, n, r, 1);
  s.getRange(r, 1, 1, h.length).setValues([h.map(function (k) { return o[k] == null ? '' : o[k]; })]);
  invalidateReadCache_(n);
}

function updateRow_(n, keyCol, keyVal, patch) {
  const s = sh_(n), h = TABS[n];
  const rows = read_(n);
  const i = rows.findIndex(function (r) { return String(r[keyCol]) === String(keyVal); });
  if (i < 0) return false;
  Object.keys(patch).forEach(function (k) { rows[i][k] = patch[k]; });
  s.getRange(i + 2, 1, 1, h.length).setValues([h.map(function (k) { return rows[i][k] == null ? '' : rows[i][k]; })]);
  invalidateReadCache_(n);
  return true;
}

/* =====================================================================
 * TAHAP 2: laporan sales, customer, stok, jadwal (request / tukar /
 * simpanan OFF), aktivitas, cadangan
 * ===================================================================== */

Object.assign(API, {
  /* ---------- laporan sales per bulan ---------- */
  laporan: function (req) {
    auth_(req);
    const bulan = /^\d{4}-\d{2}$/.test(String(req.bulan || '')) ? String(req.bulan) : latestDate_().slice(0, 7);
    return cached_('lap_' + bulan, 600, function () {
      const rows = read_('dsr').filter(function (r) { return String(r.tanggal).slice(0, 7) === bulan; });
      const out = laporan_(rows);
      try { out.raHO = raHO_(rows, raToko_(bulan, rows)); } catch (e) { out.raHO = null; }
      out.bulan = bulan;
      out.dataSampai = latestDate_();
      out.bulanTersedia = bulanTersedia_();
      return out;
    });
  },

  customer: function (req) {
    auth_(req);
    return cached_('cust', 900, function () { return customer_(read_('dsr'), latestDate_()); });
  },

  stok: function (req) {
    auth_(req);
    const c = CacheService.getScriptCache();
    const hit = c.get('stok');
    if (hit && !req.segar) return JSON.parse(hit);
    const out = readSoh_();
    try { c.put('stok', JSON.stringify(out), 1800); } catch (e) {}
    return out;
  },

  /* ---------- aktivitas ---------- */
  aktivitas: function (req) {
    auth_(req, true);
    const names = namesMap_();
    return read_('aktivitas').slice(-300).reverse().map(function (r) {
      return { waktu: String(r.waktu), username: r.username, nama: names[r.username] || r.username, aksi: r.aksi, detail: String(r.detail || '') };
    });
  },

  /* ---------- nama di jadwal ---------- */
  tim: function (req) {
    const u = auth_(req);
    const j = readJadwal_(today_());
    const staf = j.staf.map(function (s) { return s.nama; });
    return {
      namaJadwal: staf,
      users: read_('users').filter(function (x) { return x.status === 'aktif'; }).map(function (x) {
        return { username: x.username, nama: x.nama, namaJadwal: resolveNamaJadwal_(x, staf) };
      }),
      saya: u.username
    };
  },

  setNamaJadwal: function (req) {
    const a = auth_(req, true);
    const target = cleanUser_(req.username);
    const nj = String(req.namaJadwal || '').trim();
    return withLock_(function () {
      if (!updateRow_('users', 'username', target, { nama_jadwal: nj })) throw new Error('User tidak ditemukan');
      log_(a.username, 'nama jadwal', target + ' → ' + (nj || '(otomatis)'));
      return true;
    });
  },

  /* ---------- request jadwal ---------- */
  reqList: function (req) {
    const u = auth_(req);
    const all = read_('request_jadwal').map(reqOut_);
    const today = today_();
    const cur = periodOf_(today);
    const next = periodOf_(addDays_(cur.end, 1));
    const sisa = simpananSaldo_(u.username);
    return {
      saya: all.filter(function (r) { return r.username === u.username; }).reverse(),
      semua: u.role === 'admin' ? all.slice().reverse() : null,
      periode: { sekarang: periodInfo_(cur), berikut: periodInfo_(next) },
      simpananSaya: sisa,
      bolehKapanSaja: u.role === 'admin'
    };
  },

  reqCreate: function (req) {
    const u = auth_(req);
    const tgl = String(req.tanggal || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) throw new Error('Tanggal tidak valid');
    const jenis = String(req.jenis || '').toUpperCase();
    if (JENIS_REQUEST.indexOf(jenis) < 0) throw new Error('Jenis request tidak dikenal');
    const alasan = String(req.alasan || '').trim().slice(0, 200);
    if (!alasan) throw new Error('Alasan wajib diisi');
    const p = periodOf_(tgl);
    if (p.start < CFG.JADWAL_MIN_START) throw new Error('Periode ini sudah ditutup dan tidak bisa diubah');
    if (tgl < today_()) throw new Error('Tanggal sudah lewat');
    if (u.role !== 'admin' && now_() > deadlineOf_(p)) throw new Error('Batas request periode ' + p.label + ' sudah lewat (tanggal ' + CFG.REQUEST_DEADLINE_DAY + ' pukul 23.59)');
    const pakai = !!req.pakaiSimpanan && jenis === 'OFF';
    if (pakai && simpananSaldo_(u.username) < 1) throw new Error('Simpanan OFF Anda kosong');
    return withLock_(function () {
      const all = read_('request_jadwal');
      if (all.some(function (r) { return r.username === u.username && String(r.tanggal) === tgl && (r.status === 'menunggu' || r.status === 'disetujui'); })) {
        throw new Error('Anda sudah punya request di tanggal itu');
      }
      const rec = {
        id: Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMddHHmmss') + '-' + u.username,
        dibuat: now_(), username: u.username, nama: u.nama, tanggal: tgl, jenis: jenis, alasan: alasan,
        pakai_simpanan: pakai ? 'ya' : '', status: 'menunggu', diputus_oleh: '', diputus_pada: '', catatan_admin: '', tertulis: ''
      };
      append_('request_jadwal', rec);
      log_(u.username, 'request jadwal', jenis + ' ' + tgl);
      return { request: reqOut_(rec), peringatan: reqWarnings_(all.concat([rec]), rec, p) };
    });
  },

  reqCancel: function (req) {
    const u = auth_(req);
    return withLock_(function () {
      const r = read_('request_jadwal').filter(function (x) { return String(x.id) === String(req.id); })[0];
      if (!r) throw new Error('Request tidak ditemukan');
      if (r.username !== u.username) throw new Error('Hanya pemilik yang bisa membatalkan');
      if (r.status !== 'menunggu') throw new Error('Request yang sudah diputuskan tidak bisa dibatalkan');
      updateRow_('request_jadwal', 'id', r.id, { status: 'dibatalkan', diputus_pada: now_() });
      log_(u.username, 'batal request', r.jenis + ' ' + r.tanggal);
      notif_('admin', 'info', 'batal', u.nama + ' membatalkan request', r.jenis + ' · ' + tglPendek_(r.tanggal), '#/request');
      return true;
    });
  },

  reqDecide: function (req) {
    const a = auth_(req, true);
    const setuju = req.keputusan === 'setuju';
    return withLock_(function () {
      const r = read_('request_jadwal').filter(function (x) { return String(x.id) === String(req.id); })[0];
      if (!r) throw new Error('Request tidak ditemukan');
      if (r.status !== 'menunggu') throw new Error('Request ini sudah diputuskan');
      const patch = { status: setuju ? 'disetujui' : 'ditolak', diputus_oleh: a.username, diputus_pada: now_(), catatan_admin: String(req.catatan || '').slice(0, 200) };
      let info = '', keDraf = null;
      if (setuju) {
        const pr = periodOf_(String(r.tanggal));
        if (jdMasihDraf_(pr)) {
          keDraf = pr;
          patch.tertulis = 'draf ' + pr.label;
          info = 'Masuk ke draf jadwal ' + pr.label + '. Draf disusun ulang otomatis; cek di menu Susun Jadwal lalu terbitkan.';
        } else try {
          const user = read_('users').filter(function (x) { return x.username === r.username; })[0];
          const w = writeShift_(user, String(r.tanggal), String(r.jenis));
          patch.tertulis = 'ya · tab ' + w.tab;
          info = 'Ditulis ke tab ' + w.tab + (w.tabBaru ? ' (tab baru dibuat)' : '');
        } catch (e) {
          patch.tertulis = 'gagal: ' + e.message;
          info = 'Disetujui, tapi belum tertulis ke sheet: ' + e.message;
        }
        if (String(r.pakai_simpanan) === 'ya') pakaiSimpanan_(r.username, String(r.tanggal));
      }
      updateRow_('request_jadwal', 'id', r.id, patch);
      log_(a.username, setuju ? 'setujui request' : 'tolak request', r.nama + ' ' + r.jenis + ' ' + r.tanggal);
      const lbl = (String(r.pakai_simpanan) === 'ya' ? 'OFF (simpanan)' : r.jenis) + ' ' + tglPendek_(r.tanggal);
      if (r.username !== a.username) notif_(r.username, setuju ? 'ok' : 'tolak', 'request', 'Request ' + lbl + (setuju ? ' disetujui' : ' ditolak'),
        patch.catatan_admin ? 'Catatan admin: ' + patch.catatan_admin : (setuju ? (keDraf ? 'Sudah masuk jadwal ' + keDraf.label + ' (terbit setelah disahkan admin).' : 'Jadwal kamu sudah diperbarui.') : ''), '#/request');
      if (setuju && keDraf) {
        try { jdBuat_(keDraf, a.username, 'request ' + r.nama + ' ' + r.jenis + ' ' + tglPendek_(r.tanggal)); }
        catch (e) { info += ' (Draf belum bisa disusun: ' + e.message + ')'; }
      } else if (setuju) {
        if (String(patch.tertulis).indexOf('gagal') === 0) notif_('admin', 'cek', 'sheet', 'Gagal menulis ke sheet jadwal', r.nama + ' · ' + lbl + ' · ' + String(patch.tertulis).replace(/^gagal:\s*/, ''), '#/request');
        else notif_('admin', 'info', 'sheet', 'Jadwal tertulis ke sheet', r.nama + ' · ' + lbl + ' · ' + String(patch.tertulis).replace(/^ya · /, ''), '#/jadwal');
      }
      return { info: info };
    });
  },

  /* ---------- tukar shift ---------- */
  tukarList: function (req) {
    const u = auth_(req);
    const all = read_('tukar_shift').map(tukarOut_).reverse();
    return {
      saya: all.filter(function (t) { return t.pemohon === u.username || t.rekan === u.username; }),
      semua: u.role === 'admin' ? all : null
    };
  },

  tukarCreate: function (req) {
    const u = auth_(req);
    const tgl = String(req.tanggal || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) throw new Error('Tanggal tidak valid');
    if (tgl < today_()) throw new Error('Tanggal sudah lewat');
    const p = periodOf_(tgl);
    if (p.start < CFG.JADWAL_MIN_START) throw new Error('Periode ini sudah ditutup dan tidak bisa diubah');
    const rekanU = cleanUser_(req.rekan);
    if (rekanU === u.username) throw new Error('Pilih rekan lain');
    const users = read_('users');
    const rekan = users.filter(function (x) { return x.username === rekanU && x.status === 'aktif'; })[0];
    if (!rekan) throw new Error('Rekan tidak ditemukan');
    const alasan = String(req.alasan || '').trim().slice(0, 200);
    if (!alasan) throw new Error('Alasan wajib diisi');
    const sh1 = shiftOn_(u, tgl), sh2 = shiftOn_(rekan, tgl);
    if (!sh1 || !sh2) throw new Error('Shift di tanggal itu belum ada di jadwal');
    if (sh1 === sh2) throw new Error('Shift Anda dan rekan sama (' + sh1 + '), tidak perlu ditukar');
    return withLock_(function () {
      const rec = {
        id: Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMddHHmmss') + '-' + u.username,
        dibuat: now_(), pemohon: u.username, nama_pemohon: u.nama, rekan: rekan.username, nama_rekan: rekan.nama,
        tanggal: tgl, shift_pemohon: sh1, shift_rekan: sh2, alasan: alasan, status: 'menunggu_rekan',
        diputus_oleh: '', diputus_pada: '', tertulis: ''
      };
      append_('tukar_shift', rec);
      log_(u.username, 'ajukan tukar shift', tgl + ' dengan ' + rekan.username);
      return tukarOut_(rec);
    });
  },

  tukarRespond: function (req) {
    const u = auth_(req);
    return withLock_(function () {
      const t = read_('tukar_shift').filter(function (x) { return String(x.id) === String(req.id); })[0];
      if (!t) throw new Error('Pengajuan tidak ditemukan');
      if (t.rekan !== u.username) throw new Error('Hanya rekan yang diajak yang bisa menjawab');
      if (t.status !== 'menunggu_rekan') throw new Error('Pengajuan ini sudah dijawab');
      updateRow_('tukar_shift', 'id', t.id, { status: req.terima ? 'menunggu_admin' : 'ditolak_rekan', diputus_pada: req.terima ? '' : now_() });
      log_(u.username, req.terima ? 'terima tukar shift' : 'tolak tukar shift', t.tanggal + ' dari ' + t.pemohon);
      notif_(t.pemohon, req.terima ? 'ok' : 'tolak', 'tukar', u.nama + (req.terima ? ' menerima' : ' menolak') + ' tukar shift',
        tglPendek_(t.tanggal) + (req.terima ? ' · menunggu persetujuan admin' : ''), '#/tukar');
      return true;
    });
  },

  tukarCancel: function (req) {
    const u = auth_(req);
    return withLock_(function () {
      const t = read_('tukar_shift').filter(function (x) { return String(x.id) === String(req.id); })[0];
      if (!t) throw new Error('Pengajuan tidak ditemukan');
      if (t.pemohon !== u.username) throw new Error('Hanya pemohon yang bisa membatalkan');
      if (['menunggu_rekan', 'menunggu_admin'].indexOf(t.status) < 0) throw new Error('Pengajuan ini sudah selesai');
      updateRow_('tukar_shift', 'id', t.id, { status: 'dibatalkan', diputus_pada: now_() });
      notif_('admin', 'info', 'batal', u.nama + ' membatalkan tukar shift', 'Dengan ' + t.nama_rekan + ' · ' + tglPendek_(t.tanggal), '#/tukar');
      if (t.status === 'menunggu_rekan') notif_(t.rekan, 'info', 'batal', u.nama + ' membatalkan ajakan tukar shift', tglPendek_(t.tanggal), '#/tukar');
      return true;
    });
  },

  tukarDecide: function (req) {
    const a = auth_(req, true);
    const setuju = req.keputusan === 'setuju';
    return withLock_(function () {
      const t = read_('tukar_shift').filter(function (x) { return String(x.id) === String(req.id); })[0];
      if (!t) throw new Error('Pengajuan tidak ditemukan');
      if (t.status !== 'menunggu_admin') throw new Error(t.status === 'menunggu_rekan' ? 'Rekan belum menerima pengajuan ini' : 'Pengajuan ini sudah diputuskan');
      const patch = { status: setuju ? 'disetujui' : 'ditolak', diputus_oleh: a.username, diputus_pada: now_() };
      let info = '';
      if (setuju) {
        const users = read_('users');
        const up = users.filter(function (x) { return x.username === t.pemohon; })[0];
        const ur = users.filter(function (x) { return x.username === t.rekan; })[0];
        const d = String(t.tanggal);
        const n1 = shiftOn_(up, d), n2 = shiftOn_(ur, d);
        if (n1 !== String(t.shift_pemohon) || n2 !== String(t.shift_rekan)) {
          throw new Error('Jadwal di sheet sudah berubah sejak diajukan (sekarang ' + n1 + ' / ' + n2 + '). Tolak lalu minta diajukan ulang.');
        }
        const w = writeShift_(up, d, String(t.shift_rekan));
        writeShift_(ur, d, String(t.shift_pemohon));
        patch.tertulis = 'ya · tab ' + w.tab;
        info = 'Shift ditukar di tab ' + w.tab;
      }
      updateRow_('tukar_shift', 'id', t.id, patch);
      log_(a.username, setuju ? 'setujui tukar shift' : 'tolak tukar shift', t.nama_pemohon + ' ↔ ' + t.nama_rekan + ' ' + t.tanggal);
      [t.pemohon, t.rekan].forEach(function (un) {
        if (un !== a.username) notif_(un, setuju ? 'ok' : 'tolak', 'tukar', 'Tukar shift ' + tglPendek_(t.tanggal) + (setuju ? ' disetujui' : ' ditolak'),
          t.nama_pemohon + ' (' + t.shift_pemohon + ') ↔ ' + t.nama_rekan + ' (' + t.shift_rekan + ')', '#/tukar');
      });
      if (setuju) notif_('admin', 'info', 'sheet', 'Tukar shift tertulis ke sheet', t.nama_pemohon + ' ↔ ' + t.nama_rekan + ' · ' + tglPendek_(t.tanggal), '#/jadwal');
      return { info: info };
    });
  },

  /* ---------- simpanan OFF ---------- */
  simpananList: function (req) {
    const u = auth_(req);
    const all = read_('simpanan_off').map(simpananOut_).reverse();
    return { saya: all.filter(function (s) { return s.username === u.username; }), semua: u.role === 'admin' ? all : null, saldo: simpananSaldo_(u.username) };
  },

  simpananAdd: function (req) {
    const a = auth_(req, true);
    const target = cleanUser_(req.username);
    const user = read_('users').filter(function (x) { return x.username === target; })[0];
    if (!user) throw new Error('User tidak ditemukan');
    const tgl = String(req.tanggalMasuk || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) throw new Error('Tanggal tidak valid');
    const ket = String(req.keterangan || '').trim().slice(0, 200);
    if (!ket) throw new Error('Keterangan wajib diisi');
    return withLock_(function () {
      const rec = { id: Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMddHHmmss') + '-' + target, dibuat: now_(), username: target, nama: user.nama,
        tanggal_masuk: tgl, keterangan: ket, status: 'tersedia', diambil_tanggal: '', dicatat_oleh: a.username };
      append_('simpanan_off', rec);
      log_(a.username, 'tambah simpanan OFF', user.nama + ' ' + tgl);
      if (target !== a.username) notif_(target, 'ok', 'simpanan', 'Simpanan OFF bertambah', 'Dari ' + tglPendek_(tgl) + ' · ' + ket, '#/simpanan');
      return simpananOut_(rec);
    });
  },

  simpananSet: function (req) {
    const a = auth_(req, true);
    return withLock_(function () {
      const s = read_('simpanan_off').filter(function (x) { return String(x.id) === String(req.id); })[0];
      if (!s) throw new Error('Data tidak ditemukan');
      const patch = req.status === 'diambil'
        ? { status: 'diambil', diambil_tanggal: /^\d{4}-\d{2}-\d{2}$/.test(String(req.tanggal || '')) ? String(req.tanggal) : today_() }
        : req.status === 'batal' ? { status: 'batal' } : { status: 'tersedia', diambil_tanggal: '' };
      updateRow_('simpanan_off', 'id', s.id, patch);
      log_(a.username, 'simpanan OFF ' + patch.status, s.nama + ' ' + s.tanggal_masuk);
      return true;
    });
  }
});

const JENIS_REQUEST = ['OFF', 'CT', 'PD', 'SB', 'MD', 'MC', 'SC', 'NS'];
const BULAN_PENDEK = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGS', 'SEP', 'OKT', 'NOV', 'DES'];
const BULAN_PANJANG = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
const HARI_KODE = ['MG', 'SN', 'SL', 'RB', 'KM', 'JM', 'SB'];

/* ---------- laporan ---------- */
function laporan_(rows) {
  const jam = {}, ra = {}, kat = {}, prod = {}, promo = {}, retur = [], vr = {};
  rows.forEach(function (r) {
    if (!isSalesLine_(r)) return;
    const d = String(r.tanggal), h = Number(String(r.jam).slice(0, 2)) || 0;
    const g = Number(r.gross) || 0, n = Number(r.net) || 0, q = Number(r.qty) || 0, inv = String(r.invoice);
    const J = jam[d + '|' + h] || (jam[d + '|' + h] = { t: d, h: h, b: 0, n: 0, inv: {} });
    J.b += g; J.n += n; J.inv[inv] = 1;
    const sp = String(r.sales_person || '').trim() || '(tanpa nama)';
    if (!DILEBUR_TIPE.test(String(r.tipe || ''))) {
      const R = ra[sp + '|' + d] || (ra[sp + '|' + d] = { p: sp, t: d, b: 0, n: 0, q: 0, inv: {} });
      R.b += g; R.n += n; R.q += q; R.inv[inv] = 1;
    }
    const k3 = String(r.kat3 || '').trim() || 'LAINNYA', k4 = String(r.kat4 || '').trim() || '-';
    const K = kat[k3 + '|' + k4] || (kat[k3 + '|' + k4] = { k3: k3, k4: k4, b: 0, n: 0, q: 0 });
    K.b += g; K.n += n; K.q += q;
    const sku = String(r.sku);
    const P = prod[sku] || (prod[sku] = { sku: sku, nama: String(r.nama_sku), k3: k3, k4: k4, b: 0, n: 0, q: 0 });
    P.b += g; P.n += n; P.q += q;
    const vk = varianKey_(sku, r.nama_sku);
    const V = vr[vk] || (vr[vk] = { b: 0, n: 0, q: 0 });
    V.b += g; V.n += n; V.q += q;
    const pn = String(r.promo_name || '').trim() || '(tanpa promo)';
    const M = promo[pn] || (promo[pn] = { b: 0, n: 0, q: 0, inv: {} });
    M.b += g; M.n += n; M.q += q; M.inv[inv] = 1;
    if (q < 0) retur.push([d, String(r.jam).slice(0, 5), inv, String(r.nama_sku), q, Math.round(g), Math.round(n), sp, String(r.status || '')]);
  });
  const R0 = function (x) { return Math.round(x); };
  const prods = Object.keys(prod).map(function (k) { return prod[k]; });
  const pareto = function (key) {
    const list = prods.map(function (p) { return p[key]; }).filter(function (v) { return v > 0; }).sort(function (a, b) { return b - a; });
    const total = list.reduce(function (s, v) { return s + v; }, 0);
    let acc = 0, i = 0;
    while (i < list.length && acc < total * 0.8) { acc += list[i]; i++; }
    return { n80: i, total: list.length };
  };
  return {
    jam: Object.keys(jam).map(function (k) { const x = jam[k]; return [x.t, x.h, R0(x.b), R0(x.n), Object.keys(x.inv).length]; }),
    ra: Object.keys(ra).map(function (k) { const x = ra[k]; return [x.p, x.t, R0(x.b), R0(x.n), x.q, Object.keys(x.inv).length]; }),
    kategori: Object.keys(kat).map(function (k) { const x = kat[k]; return [x.k3, x.k4, R0(x.b), R0(x.n), x.q]; }),
    produk: prods.sort(function (a, b) { return b.n - a.n; }).slice(0, 100).map(function (x) { return [x.sku, x.nama, x.k3, x.k4, x.q, R0(x.b), R0(x.n)]; }),
    pareto: { netto: pareto('n'), bruto: pareto('b') },
    promo: Object.keys(promo).map(function (k) { const x = promo[k]; return [k, R0(x.b), R0(x.n), x.q, Object.keys(x.inv).length]; }),
    retur: retur,
    varian: Object.keys(vr).map(function (k) { const x = vr[k]; return [k, x.q, R0(x.b), R0(x.n)]; })
  };
}

function customer_(rows, latest) {
  const by = {};
  rows.forEach(function (r) {
    const key = String(r.cust_key || '');
    if (!key || !isSalesLine_(r)) return;
    const o = by[key] || (by[key] = { nama: '', n: 0, b: 0, inv: {}, first: '', last: '' });
    const nm = String(r.cust_name || '').trim();
    if (nm) o.nama = nm;
    o.n += Number(r.net) || 0; o.b += Number(r.gross) || 0;
    o.inv[String(r.invoice)] = 1;
    const d = String(r.tanggal);
    if (!o.first || d < o.first) o.first = d;
    if (!o.last || d > o.last) o.last = d;
  });
  const list = Object.keys(by).map(function (k) {
    const o = by[k];
    return [o.nama || '(tanpa nama)', Math.round(o.n), Math.round(o.b), Object.keys(o.inv).length, o.first, o.last];
  });
  const cutoff = addDays_(latest, -60);
  return {
    dataSampai: latest,
    jumlah: list.length,
    berulang: list.filter(function (x) { return x[3] >= 2; }).length,
    top: list.slice().sort(function (a, b) { return b[1] - a[1]; }).slice(0, 100),
    lama: list.filter(function (x) { return x[3] >= 2 && x[5] < cutoff; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 60),
    batasLama: cutoff
  };
}

function bulanTersedia_() {
  const m = {};
  ringkasan_().forEach(function (r) { m[r.tanggal.slice(0, 7)] = 1; });
  return Object.keys(m).sort().reverse();
}

/* ---------- ringkasan harian (supaya cepat) ---------- */
function ringkasan_() {
  let rows = read_('ringkasan');
  const p = PropertiesService.getScriptProperties();
  if ((!rows.length || p.getProperty('rumus_sales') !== RUMUS_SALES) && sh_('dsr').getLastRow() > 1) {
    rows = rebuildRingkasan_();
    p.setProperty('rumus_sales', RUMUS_SALES);
  }
  return rows.map(function (r) { return { tanggal: String(r.tanggal), bruto: Number(r.bruto), netto: Number(r.netto), qty: Number(r.qty), trx: Number(r.trx) }; });
}
function rebuildRingkasan_() {
  const agg = aggregateDaily_(read_('dsr'));
  writeAll_('ringkasan', agg);
  bumpVersion_();
  return agg;
}

/* ---------- cache ---------- */
function bumpVersion_() {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('ver', String(Number(p.getProperty('ver') || 0) + 1));
}
function cached_(key, seconds, fn) {
  const ver = PropertiesService.getScriptProperties().getProperty('ver') || '0';
  const c = CacheService.getScriptCache();
  const k = key + '_v' + ver;
  const hit = c.get(k);
  if (hit) return JSON.parse(hit);
  const out = fn();
  try { c.put(k, JSON.stringify(out), seconds); } catch (e) { /* terlalu besar untuk cache */ }
  return out;
}

/* ---------- stok SOH ---------- */
function numId_(s) {
  s = String(s == null ? '' : s).trim();
  if (!s || /[a-z]/i.test(s) || s.charAt(0) === '#') return null;
  const n = Number(s.replace('%', '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}
function readSoh_() {
  const sh = SpreadsheetApp.openById(CFG.SOH_SHEET_ID).getSheetByName('SOH');
  if (!sh) throw new Error('Tab SOH tidak ditemukan di sheet stok');
  const top = sh.getRange('B2:AE9').getDisplayValues();
  const det = sh.getRange('B13:AE' + Math.max(14, sh.getLastRow())).getDisplayValues();
  if (String(top[0][1]).trim() !== 'MC Lv. 3') throw new Error('Susunan tab SOH berubah (judul MC Lv. 3 tidak ditemukan)');
  const bulan = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
  const row = function (r, withMc4) {
    const o = withMc4 ? { mc3: String(r[0]).trim(), mc4: String(r[1]).trim() } : { mc3: String(r[1]).trim() };
    o.qty = numId_(r[2]); o.varian = numId_(r[3]); o.sku = numId_(r[4]); o.generic = numId_(r[5]);
    o.display = numId_(r[9]); o.rasio = numId_(r[17]);
    o.sales = bulan.map(function (b, i) { return numId_(r[18 + i]) || 0; });
    return o;
  };
  return {
    update: String(top[0][0]).trim(),
    kategori: top.slice(1).filter(function (r) { return String(r[1]).trim(); }).map(function (r) { return row(r, false); }),
    detail: det.slice(1).filter(function (r) { return String(r[0]).trim() && String(r[1]).trim(); }).map(function (r) { return row(r, true); })
  };
}

/* ---------- aktivitas ---------- */
function log_(username, aksi, detail) {
  try { append_('aktivitas', { waktu: now_(), username: username || 'sistem', aksi: aksi, detail: String(detail || '').slice(0, 300) }); } catch (e) {}
}
function namesMap_() {
  const m = {};
  read_('users').forEach(function (u) { m[u.username] = u.nama; });
  return m;
}

/* ---------- cadangan mingguan ---------- */
function cadangan() {
  const ss = SpreadsheetApp.getActive();
  const it = DriveApp.getFoldersByName(CFG.BACKUP_FOLDER);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(CFG.BACKUP_FOLDER);
  const name = 'Cadangan DB Hub 2299 ' + Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HHmm');
  DriveApp.getFileById(ss.getId()).makeCopy(name, folder);
  const files = [];
  const fi = folder.getFiles();
  while (fi.hasNext()) { const f = fi.next(); if (f.getName().indexOf('Cadangan DB Hub 2299') === 0) files.push(f); }
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(CFG.BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });
  log_('sistem', 'cadangan', name);
  return name;
}
function pasangCadanganMingguan_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'cadangan') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cadangan').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(3).create();
}

/* ---------- periode jadwal (24 s/d 23) ---------- */
function today_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
function addDays_(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + pad_(d.getUTCMonth() + 1) + '-' + pad_(d.getUTCDate());
}
function periodOf_(iso) {
  const p = iso.split('-').map(Number);
  let y = p[0], m = p[1];
  if (p[2] < 24) { m--; if (m < 1) { m = 12; y--; } }
  let y2 = y, m2 = m + 1;
  if (m2 > 12) { m2 = 1; y2++; }
  return {
    start: y + '-' + pad_(m) + '-24', end: y2 + '-' + pad_(m2) + '-23', m1: m, m2: m2, y1: y, y2: y2,
    label: BULAN_PENDEK[m - 1] + '-' + BULAN_PENDEK[m2 - 1] + ' ' + y2
  };
}
function deadlineOf_(p) { return p.start.slice(0, 8) + pad_(CFG.REQUEST_DEADLINE_DAY) + ' 23:59:59'; }
function periodInfo_(p) {
  return { mulai: p.start, selesai: p.end, label: p.label, batas: deadlineOf_(p), terbuka: now_() <= deadlineOf_(p) && p.start >= CFG.JADWAL_MIN_START, bisaDiubah: p.start >= CFG.JADWAL_MIN_START };
}

/* ---------- baca / tulis sheet jadwal ---------- */
function normName_(s) { return String(s || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function resolveNamaJadwal_(user, staf) {
  if (!user) return '';
  if (String(user.nama_jadwal || '').trim()) return String(user.nama_jadwal).trim();
  const n = normName_(user.nama);
  if (!n) return '';
  const exact = staf.filter(function (s) { return normName_(s) === n; })[0];
  if (exact) return exact;
  const part = staf.filter(function (s) { const x = normName_(s); return x.indexOf(n) === 0 || n.indexOf(x) === 0; });
  return part.length === 1 ? part[0] : '';
}

function findTab_(ss, p) {
  const sheets = ss.getSheets();
  for (let i = sheets.length - 1; i >= 0; i--) {
    const s = sheets[i];
    const ms = monthsFromName_(s.getName());
    if (ms.length < 2 || ms[0] !== p.m1 || ms[1] !== p.m2) continue;
    const v = s.getRange('B2:AJ6').getDisplayValues();
    const parsed = parseJadwal_(v, ms, s.getName(), p.start);
    if (parsed.tanggal[0] === p.start) return s;
  }
  return null;
}

function dayCols_(sh) {
  const row = sh.getRange(2, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const cols = [];
  for (let c = 2; c < row.length; c++) {
    const d = Number(String(row[c]).trim());
    if (d >= 1 && d <= 31 && String(row[c]).trim() !== '') cols.push(c + 1); else if (cols.length) break;
  }
  return cols; // nomor kolom (1-based)
}

function createTab_(ss, p) {
  if (p.start < CFG.JADWAL_MIN_START) throw new Error('Periode ' + p.label + ' sudah ditutup');
  const prev = periodOf_(addDays_(p.start, -1));
  const src = findTab_(ss, prev);
  if (!src) throw new Error('Tab periode sebelumnya (' + prev.label + ') tidak ditemukan untuk dijadikan contoh');
  const days = [];
  for (let d = p.start; d <= p.end; d = addDays_(d, 1)) days.push(d);
  let name = BULAN_PENDEK[p.m1 - 1] + '-' + BULAN_PENDEK[p.m2 - 1];
  if (ss.getSheetByName(name)) name += ' ' + p.y2;
  const sh = src.copyTo(ss).setName(name);
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(ss.getNumSheets());
  let cols = dayCols_(sh);
  if (!cols.length) throw new Error('Baris tanggal di tab contoh tidak terbaca');
  const diff = days.length - cols.length;
  const last = cols[cols.length - 1];
  if (diff > 0) sh.insertColumnsBefore(last, diff);          // di dalam rentang, rumus total ikut melebar
  if (diff < 0) sh.deleteColumns(last + diff + 1, -diff);
  cols = [];
  for (let i = 0; i < days.length; i++) cols.push(3 + i);
  sh.getRange(1, 1).setValue(BULAN_PANJANG[p.m1 - 1] + '-' + BULAN_PANJANG[p.m2 - 1] + ' ' + p.y2);
  sh.getRange(2, 3, 1, days.length).setValues([days.map(function (d) { return Number(d.slice(8)); })]);
  sh.getRange(4, 3, 1, days.length).setValues([days.map(function (d) {
    const q = d.split('-').map(Number);
    return HARI_KODE[new Date(Date.UTC(q[0], q[1] - 1, q[2])).getUTCDay()];
  })]);
  const names = sh.getRange(5, 2, Math.max(1, sh.getLastRow() - 4), 1).getDisplayValues();
  let n = 0;
  while (n < names.length && String(names[n][0]).trim()) n++;
  if (n) sh.getRange(5, 3, n, days.length).clearContent().setBackground(null);
  return sh;
}

function writeShift_(user, iso, code) {
  const p = periodOf_(iso);
  if (p.start < CFG.JADWAL_MIN_START) throw new Error('Periode ' + p.label + ' sudah ditutup');
  const ss = SpreadsheetApp.openById(CFG.JADWAL_SHEET_ID);
  let sh = findTab_(ss, p), baru = false;
  if (!sh) { sh = createTab_(ss, p); baru = true; }
  const names = sh.getRange(5, 2, Math.max(1, sh.getLastRow() - 4), 1).getDisplayValues().map(function (r) { return String(r[0]).trim(); });
  const staf = [];
  for (let i = 0; i < names.length && names[i]; i++) staf.push(names[i]);
  const nj = resolveNamaJadwal_(user, staf);
  const ri = nj ? staf.map(normName_).indexOf(normName_(nj)) : -1;
  if (ri < 0) throw new Error('Nama ' + (user ? user.nama : '?') + ' tidak ada di tab ' + sh.getName() + '. Atur "Nama di jadwal" di menu Admin.');
  const cols = dayCols_(sh);
  const dayRow = sh.getRange(2, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const want = Number(iso.slice(8));
  const ci = cols.filter(function (c) { return Number(dayRow[c - 1]) === want; })[0];
  if (!ci) throw new Error('Tanggal ' + iso + ' tidak ada di tab ' + sh.getName());
  sh.getRange(5 + ri, ci).setValue(code).setBackground(CFG.REQUEST_COLOR);
  return { tab: sh.getName(), tabBaru: baru };
}

function shiftOn_(user, iso) {
  const j = readJadwalPeriode_(iso);
  if (!j) return '';
  const nj = resolveNamaJadwal_(user, j.staf.map(function (s) { return s.nama; }));
  const s = j.staf.filter(function (x) { return normName_(x.nama) === normName_(nj); })[0];
  const i = j.tanggal.indexOf(iso);
  return s && i >= 0 ? String(s.shift[i] || '') : '';
}

function readJadwalPeriode_(iso) {
  const p = periodOf_(iso);
  const ss = SpreadsheetApp.openById(CFG.JADWAL_SHEET_ID);
  const sh = findTab_(ss, p);
  if (!sh) return null;
  return parseJadwal_(sh.getRange('B2:AJ16').getDisplayValues(), monthsFromName_(sh.getName()), sh.getName(), p.start);
}

/* ---------- request helpers ---------- */
function reqOut_(r) {
  return { id: String(r.id), dibuat: String(r.dibuat), username: r.username, nama: r.nama, tanggal: String(r.tanggal), jenis: r.jenis,
    alasan: r.alasan, pakaiSimpanan: String(r.pakai_simpanan) === 'ya', status: r.status, diputusOleh: r.diputus_oleh,
    diputusPada: String(r.diputus_pada || ''), catatanAdmin: String(r.catatan_admin || ''), tertulis: String(r.tertulis || '') };
}
function reqWarnings_(all, rec, p) {
  const w = [];
  const inP = function (r) { return String(r.tanggal) >= p.start && String(r.tanggal) <= p.end && (r.status === 'menunggu' || r.status === 'disetujui'); };
  if (rec.jenis === 'OFF') {
    const mine = all.filter(function (r) { return inP(r) && r.username === rec.username && r.jenis === 'OFF'; }).length;
    if (mine > 4) w.push('Ini request OFF ke-' + mine + ' di periode ' + p.label + ' (jatah biasanya 4).');
    const same = all.filter(function (r) { return inP(r) && String(r.tanggal) === String(rec.tanggal) && r.jenis === 'OFF' && r.username !== rec.username; }).length;
    if (same >= 1) w.push(same + ' orang lain juga minta OFF di tanggal ini.');
  }
  return w;
}
function tukarOut_(t) {
  return { id: String(t.id), dibuat: String(t.dibuat), pemohon: t.pemohon, namaPemohon: t.nama_pemohon, rekan: t.rekan, namaRekan: t.nama_rekan,
    tanggal: String(t.tanggal), shiftPemohon: t.shift_pemohon, shiftRekan: t.shift_rekan, alasan: t.alasan, status: t.status,
    diputusOleh: t.diputus_oleh, diputusPada: String(t.diputus_pada || ''), tertulis: String(t.tertulis || '') };
}
function simpananOut_(s) {
  return { id: String(s.id), dibuat: String(s.dibuat), username: s.username, nama: s.nama, tanggalMasuk: String(s.tanggal_masuk),
    keterangan: s.keterangan, status: s.status, diambilTanggal: String(s.diambil_tanggal || ''), dicatatOleh: s.dicatat_oleh };
}
function simpananSaldo_(username) {
  return read_('simpanan_off').filter(function (s) { return s.username === username && s.status === 'tersedia'; }).length;
}
function pakaiSimpanan_(username, tanggal) {
  const s = read_('simpanan_off').filter(function (x) { return x.username === username && x.status === 'tersedia'; })
    .sort(function (a, b) { return String(a.tanggal_masuk) < String(b.tanggal_masuk) ? -1 : 1; })[0];
  if (s) updateRow_('simpanan_off', 'id', s.id, { status: 'diambil', diambil_tanggal: tanggal });
}

/* =====================================================================
 * TAHAP 3: traffic dari SOH (untuk CR), data harian untuk WA, area
 * ===================================================================== */

Object.assign(API, {
  /** Data satu hari untuk laporan WA dan PICA. */
  hari: function (req) {
    auth_(req);
    const tgl = /^\d{4}-\d{2}-\d{2}$/.test(String(req.tanggal || '')) ? String(req.tanggal) : latestDate_();
    syncTrafficIfNeeded_();
    return cached_('hari_' + tgl, 600, function () {
      const rows = read_('dsr').filter(function (r) { return String(r.tanggal) === tgl; });
      const out = hari_(rows);
      out.tanggal = tgl;
      const tr = read_('traffic').filter(function (x) { return String(x.tanggal) === tgl; })[0];
      out.traffic = tr && tr.traffic !== '' ? Number(tr.traffic) : null;
      return out;
    });
  },

  /** Posisi toko di laporan regional Jateng 01. */
  area: function (req) {
    auth_(req);
    const c = CacheService.getScriptCache();
    const hit = c.get('area');
    if (hit) return JSON.parse(hit);
    const out = readArea_();
    try { c.put('area', JSON.stringify(out), 1800); } catch (e) {}
    return out;
  }
});

function hari_(rows) {
  const o = { bruto: 0, netto: 0, qty: 0, inv: {}, ea: [0, 0], wholesale: [0, 0], empDisc: 0, promo: 0, coupon: 0, prod: {}, ra: {}, vr: {} };
  rows.forEach(function (r) {
    if (!isSalesLine_(r)) return;
    const g = Number(r.gross) || 0, n = Number(r.net) || 0, q = Number(r.qty) || 0;
    const tipe = String(r.tipe || '').toLowerCase();
    o.bruto += g; o.netto += n; o.qty += q; o.inv[String(r.invoice)] = 1;
    if (tipe.indexOf('endless') >= 0) { o.ea[0] += g; o.ea[1] += n; }
    if (tipe.indexOf('wholesale') >= 0) { o.wholesale[0] += g; o.wholesale[1] += n; }
    o.empDisc += Number(r.emp_disc) || 0;
    o.promo += Number(r.promo_value) || 0;
    o.coupon += Number(r.coupon) || 0;
    const P = o.prod[String(r.sku)] || (o.prod[String(r.sku)] = { nama: String(r.nama_sku), q: 0, b: 0, n: 0 });
    P.q += q; P.b += g; P.n += n;
    const vk = varianKey_(r.sku, r.nama_sku), parts = String(r.nama_sku).split(',');
    const V = o.vr[vk] || (o.vr[vk] = { nama: (parts.length >= 3 ? parts.slice(0, parts.length - 2).join(',').trim() + ' ' + parts[parts.length - 2].trim() : String(r.nama_sku)), q: 0, b: 0, n: 0 });
    V.q += q; V.b += g; V.n += n;
    const sp = String(r.sales_person || '').trim() || '(tanpa nama)';
    const R = o.ra[sp] || (o.ra[sp] = { b: 0, n: 0, inv: {} });
    R.b += g; R.n += n; R.inv[String(r.invoice)] = 1;
  });
  const R0 = Math.round;
  return {
    bruto: R0(o.bruto), netto: R0(o.netto), qty: o.qty, trx: Object.keys(o.inv).length,
    ea: { bruto: R0(o.ea[0]), netto: R0(o.ea[1]) }, wholesale: { bruto: R0(o.wholesale[0]), netto: R0(o.wholesale[1]) },
    empDisc: R0(o.empDisc), promo: R0(o.promo), coupon: R0(o.coupon),
    produk: Object.keys(o.prod).map(function (k) { const x = o.prod[k]; return [x.nama, x.q, R0(x.b), R0(x.n)]; })
      .sort(function (a, b) { return b[3] - a[3]; }).slice(0, 5),
    ra: Object.keys(o.ra).map(function (k) { const x = o.ra[k]; return [k, R0(x.b), R0(x.n), Object.keys(x.inv).length]; })
      .sort(function (a, b) { return b[2] - a[2]; }),
    varian: Object.keys(o.vr).map(function (k) { const x = o.vr[k]; return [k, x.nama, x.q, R0(x.b), R0(x.n)]; })
      .sort(function (a, b) { return b[4] - a[4]; }).slice(0, 15)
  };
}

/* ---------- traffic ---------- */
function trafficMap_(bulan) {
  const m = {};
  read_('traffic').forEach(function (r) {
    const d = String(r.tanggal);
    if ((!bulan || d.slice(0, 7) === bulan) && r.traffic !== '') m[d] = Number(r.traffic);
  });
  return m;
}
function syncTrafficIfNeeded_() {
  const c = CacheService.getScriptCache();
  if (c.get('trafsync')) return;
  try { syncTraffic_(); } catch (e) { Logger.log('Traffic gagal: ' + e); }
  c.put('trafsync', '1', 1800);
}
/** Baca traffic hari berjalan di tab DAILY REPORT sheet SOH lalu simpan per tanggal. */
function syncTraffic_() {
  const sh = SpreadsheetApp.openById(CFG.SOH_SHEET_ID).getSheetByName('DAILY REPORT');
  if (!sh) throw new Error('Tab DAILY REPORT tidak ditemukan');
  const v = sh.getRange('A5:W9').getDisplayValues();
  const m = String(v[0][0]).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) throw new Error('Tanggal di DAILY REPORT tidak terbaca: ' + v[0][0]);
  const mi = BULAN_PANJANG.indexOf(m[2].toUpperCase());
  if (mi < 0) throw new Error('Nama bulan tidak dikenal: ' + m[2]);
  const tgl = m[3] + '-' + pad_(mi + 1) + '-' + pad_(Number(m[1]));
  const head = v[2].map(function (x) { return String(x).trim().toLowerCase(); });
  const it = head.indexOf('traffic');
  if (it < 0) throw new Error('Kolom Traffic tidak ditemukan di DAILY REPORT');
  const traffic = numId_(v[4][it]);
  if (traffic == null) return { tanggal: tgl, traffic: null };
  withLock_(function () {
    const rows = read_('traffic');
    const ex = rows.filter(function (r) { return String(r.tanggal) === tgl; })[0];
    if (ex) { ex.traffic = traffic; ex.diperbarui = now_(); }
    else rows.push({ tanggal: tgl, traffic: traffic, diperbarui: now_() });
    rows.sort(function (a, b) { return String(a.tanggal) < String(b.tanggal) ? -1 : 1; });
    writeAll_('traffic', rows);
  });
  return { tanggal: tgl, traffic: traffic };
}
/** Dipanggil pemicu per jam supaya traffic tiap hari tetap tercatat walau web tidak dibuka. */
function catatTraffic() { try { cekDokumentasi_(); } catch (e) { Logger.log('dok: ' + e); } try { kirimFeedback_(); } catch (e) { Logger.log('fb: ' + e); } return syncTraffic_(); }
function pasangCatatTraffic_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'catatTraffic') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('catatTraffic').timeBased().everyHours(1).create();
}

/* ---------- area Jateng 01 ---------- */
function readArea_() {
  const sh = SpreadsheetApp.openById(CFG.TARGET_SHEET_ID).getSheetByName('Report');
  if (!sh) throw new Error('Tab Report tidak ditemukan');
  const v = sh.getRange('A4:P45').getDisplayValues();
  const us = function (s) { s = String(s).trim(); if (!s || /[a-z]/i.test(s)) return null; const p = s.indexOf('%') >= 0; const n = Number(s.replace(/[%,]/g, '')); return isNaN(n) ? null : (p ? n / 100 : n); };
  const rows = v.slice(4).filter(function (r) { return String(r[0]).trim(); }).map(function (r) {
    return { site: String(r[0]).trim(), store: String(r[1]).trim(), achBulan: us(r[4]), achKum: us(r[9]), achHarian: us(r[14]) };
  });
  const stores = rows.filter(function (r) { return r.site !== 'TOTAL' && r.achKum != null; }).sort(function (a, b) { return b.achKum - a.achKum; });
  const me = stores.filter(function (r) { return r.site === CFG.STORE; })[0] || null;
  return {
    tanggal: String(v[0][1] || '').trim(),
    total: rows.filter(function (r) { return r.site === 'TOTAL'; })[0] || null,
    toko: me, peringkat: me ? stores.indexOf(me) + 1 : null, jumlah: stores.length
  };
}


/* =====================================================================
 * TAHAP 4: notifikasi (lonceng)
 *  - "Perlu keputusan" dihitung langsung dari data (selalu sesuai keadaan).
 *  - Kejadian lain dicatat di tab notifikasi; untuk = username atau 'admin'.
 * ===================================================================== */

Object.assign(API, {
  notif: function (req) {
    return notifFor_(auth_(req));
  },

  notifRead: function (req) {
    const u = auth_(req);
    const ids = req.semua ? null : (req.ids || []).map(String);
    return withLock_(function () {
      const all = read_('notifikasi');
      let n = 0;
      all.forEach(function (x) {
        const to = String(x.untuk);
        if (!(to === u.username || to === 'semua' || (u.role === 'admin' && to === 'admin'))) return;
        if (ids && ids.indexOf(String(x.id)) < 0) return;
        const list = String(x.dibaca || '').split(',').filter(String);
        if (list.indexOf(u.username) >= 0) return;
        list.push(u.username);
        x.dibaca = list.join(',');
        n++;
      });
      if (n) writeAll_('notifikasi', all);
      return { ditandai: n };
    });
  }
});


/** Isi lonceng notifikasi untuk satu user (dipakai web & push). */
function notifFor_(u) {
    const admin = u.role === 'admin';
  const today = today_();
  const items = [];
  const badges = { admin: 0, request: 0, tukar: 0 };

  const reqs = read_('request_jadwal');
  const tukar = read_('tukar_shift');

  if (admin) {
    const users = read_('users').filter(function (x) { return x.status === 'menunggu'; });
    reqs.filter(function (r) { return r.status === 'menunggu'; }).forEach(function (r) {
      const simp = String(r.pakai_simpanan) === 'ya';
      items.push({ id: 'live-req-' + r.id, live: true, level: 'aksi', jenis: simp ? 'simpanan' : 'request', waktu: String(r.dibuat),
        judul: r.nama + (simp ? ' pakai simpanan OFF' : ' minta ' + r.jenis), isi: tglPendek_(r.tanggal) + ' · ' + String(r.alasan || ''),
        link: '#/request', aksi: { tipe: 'req', id: String(r.id) } });
    });
    tukar.filter(function (t) { return t.status === 'menunggu_admin'; }).forEach(function (t) {
      items.push({ id: 'live-tukar-' + t.id, live: true, level: 'aksi', jenis: 'tukar', waktu: String(t.dibuat),
        judul: 'Tukar shift ' + t.nama_pemohon + ' ↔ ' + t.nama_rekan, isi: tglPendek_(t.tanggal) + ' · ' + t.shift_pemohon + ' ↔ ' + t.shift_rekan + ' · sudah diterima rekan',
        link: '#/tukar', aksi: { tipe: 'tukar', id: String(t.id) } });
    });
    users.forEach(function (x) {
      items.push({ id: 'live-user-' + x.username, live: true, level: 'aksi', jenis: 'akun', waktu: String(x.dibuat),
        judul: 'Akun baru: ' + x.nama, isi: '@' + x.username + ' menunggu disetujui', link: '#/admin', aksi: { tipe: 'akun', id: x.username } });
    });
    badges.admin = users.length;
    badges.request = reqs.filter(function (r) { return r.status === 'menunggu'; }).length;
    badges.tukar = tukar.filter(function (t) { return t.status === 'menunggu_admin'; }).length;

    // batas request periode berikutnya sudah dekat
    const nx = periodOf_(addDays_(periodOf_(today).end, 1));
    const batas = deadlineOf_(nx).slice(0, 10);
    const pend = reqs.filter(function (r) { return r.status === 'menunggu' && String(r.tanggal) >= nx.start && String(r.tanggal) <= nx.end; }).length;
    if (pend && today >= addDays_(batas, -4) && today < nx.start) {
      const sisa = Math.round((Date.parse(batas) - Date.parse(today)) / 864e5);
      items.push({ id: 'live-batas-' + nx.start, live: true, level: 'cek', jenis: 'batas', waktu: today + ' 00:00:00',
        judul: pend + ' request ' + nx.label + ' belum diputuskan',
        isi: sisa > 0 ? 'Batas request ' + tglPendek_(batas) + ' (' + sisa + ' hari lagi)' : sisa === 0 ? 'Batas request hari ini' : 'Batas request sudah lewat, periode mulai ' + tglPendek_(nx.start),
        link: '#/request' });
    }

    // DSR kemarin belum masuk (setelah jam 11)
    const mnt = menitNow_(), bData = Number(settings_().data_batas) || 660;
    const jamB = pad_(Math.floor(bData / 60)) + ':' + pad_(bData % 60);
    const kemarin = addDays_(today, -1);
    const latest = latestDate_();
    if (mnt >= bData && latest < kemarin) {
      items.push({ id: 'live-dsr-' + today, live: true, level: 'cek', jenis: 'dsr', waktu: today + ' ' + jamB + ':00',
        judul: 'DSR kemarin belum diunggah', isi: 'Data terakhir sampai ' + tglPendek_(latest), link: '#/unggah' });
    }
    if (mnt >= bData) {
      const bu = read_('bin_upload'), lb = bu.length ? String(bu[bu.length - 1].waktu).slice(0, 10) : '';
      if (lb < today) items.push({ id: 'live-bin-' + today, live: true, level: 'cek', jenis: 'bin', waktu: today + ' ' + jamB + ':00',
        judul: 'By Bin hari ini belum diunggah', isi: lb ? 'Unggahan terakhir ' + tglPendek_(lb) : 'Belum pernah diunggah', link: '#/unggahbin' });
    }
  } else {
    tukar.filter(function (t) { return t.status === 'menunggu_rekan' && t.rekan === u.username; }).forEach(function (t) {
      items.push({ id: 'live-ajak-' + t.id, live: true, level: 'aksi', jenis: 'tukar', waktu: String(t.dibuat),
        judul: t.nama_pemohon + ' mengajak tukar shift', isi: tglPendek_(t.tanggal) + ' · kamu ' + t.shift_rekan + ' → ' + t.shift_pemohon + ' · ' + String(t.alasan || ''),
        link: '#/tukar', aksi: { tipe: 'ajak', id: String(t.id) } });
    });
    badges.tukar = items.length;
  }

  // tugas video opening/closing sesuai shift hari ini
  try { dokTugas_(u, today).forEach(function (x) { items.push(x); }); } catch (e) { /* jadwal/Drive belum siap */ }
  try { badges.fb = fbMasuk_(u).filter(function (x) { return !x.dibaca; }).length; } catch (e) { badges.fb = 0; }
  try {
    const hb = {}; read_('handover_baca').forEach(function (x) { if (x.username === u.username) hb[String(x.id)] = 1; });
    const lastHo = read_('handover').filter(function (x) { return String(x.tanggal) >= addDays_(today, -1) && x.username !== u.username; }).pop();
    badges.ho = lastHo && !hb[String(lastHo.id)] ? 1 : 0;
  } catch (e) { badges.ho = 0; }

  // catatan kejadian (60 hari terakhir, maks 60)
  const batasLama = addDays_(today, -60);
  const log = read_('notifikasi').filter(function (n) {
    const to = String(n.untuk);
    return (to === u.username || to === 'semua' || (admin && to === 'admin')) && String(n.waktu).slice(0, 10) >= batasLama;
  }).slice(-60).reverse().map(function (n) {
    const dib = String(n.dibaca || '').split(',').indexOf(u.username) >= 0;
    return { id: String(n.id), live: false, level: String(n.level), jenis: String(n.jenis), waktu: String(n.waktu),
      judul: String(n.judul), isi: String(n.isi), link: String(n.link), dibaca: dib };
  });

  try {
    const sudah = {};
    read_('pengumuman_baca').forEach(function (x) { if (x.username === u.username) sudah[String(x.id)] = 1; });
    badges.peng = read_('pengumuman').filter(function (p) { return p.aktif !== 'tidak' && !sudah[String(p.id)]; }).length;
  } catch (e) { badges.peng = 0; }
  const live = items.sort(function (a, b) { return a.level === b.level ? (a.waktu < b.waktu ? 1 : -1) : (a.level === 'aksi' ? -1 : 1); });
  const unread = live.length + log.filter(function (n) { return !n.dibaca && n.level !== 'info'; }).length;
  return { items: live.concat(log), unread: unread, badges: badges, waktu: now_() };
}

/** Catat notifikasi. Dipanggil di dalam withLock_ yang sudah berjalan. */
function notif_(untuk, level, jenis, judul, isi, link) {
  if (level !== 'info') PUSH_SEGERA[String(untuk)] = 1;
  try {
    append_('notifikasi', {
      id: Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMddHHmmss') + '-' + Math.random().toString(36).slice(2, 7),
      waktu: now_(), untuk: untuk, level: level, jenis: jenis,
      judul: String(judul || '').slice(0, 140), isi: String(isi || '').slice(0, 300), link: link || '', dibaca: ''
    });
    const s = sh_('notifikasi');
    if (s.getLastRow() > 1500) s.deleteRows(2, 500); // simpan yang terbaru saja
  } catch (e) { Logger.log('notif gagal: ' + e); }
}
function tglPendek_(iso) {
  const p = String(iso).slice(0, 10).split('-').map(Number);
  if (p.length < 3 || !p[0]) return String(iso);
  return p[2] + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][p[1] - 1];
}
function rupiah_(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }


/* =====================================================================
 * TAHAP 5: stok by bin, cek display, master artikel, New Arrival
 * ===================================================================== */

/** Kunci varian = generic + warna, mis. 910010286.BLK (sama dengan kolom Cross-Site master artikel). */
function varianKey_(sku, nama) {
  const s = String(sku || '').trim();
  const g = s.length > 9 ? s.slice(0, 9) : s;
  const parts = String(nama || '').split(',');
  const w = parts.length >= 3 ? parts[parts.length - 2].trim().toUpperCase() : '';
  return g + (w ? '.' + w : '');
}
function prop_(k, v) {
  const p = PropertiesService.getScriptProperties();
  if (v === undefined) { const x = p.getProperty(k); try { return x ? JSON.parse(x) : null; } catch (e) { return null; } }
  if (v === null) p.deleteProperty(k); else p.setProperty(k, JSON.stringify(v));
}
function appendRows_(n, objs) {
  if (!objs.length) return;
  const s = sh_(n), h = TABS[n];
  const r = s.getLastRow() + 1;
  const need = r + objs.length - 1;
  if (s.getMaxRows() < need) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows());
  formatCols_(s, n, r, objs.length);
  s.getRange(r, 1, objs.length, h.length).setValues(objs.map(function (o) { return h.map(function (k) { return o[k] == null ? '' : o[k]; }); }));
}

Object.assign(API, {
  /* ---------- by bin ---------- */
  binUpload: function (req) {
    const u = auth_(req);
    const rows = req.rows || [];
    if (!rows.length) throw new Error('File tidak berisi data');
    const lokasi = String(req.lokasi || '');
    if (lokasi && lokasi.indexOf(CFG.STORE) < 0) throw new Error('File ini bukan stok toko ' + CFG.STORE + ' (' + lokasi + ')');
    const F = TABS.bin;
    const objs = rows.map(function (r, i) {
      if (!Array.isArray(r) || r.length !== F.length) throw new Error('Format baris ke-' + (i + 1) + ' tidak sesuai. Muat ulang halaman lalu coba lagi.');
      const o = {};
      F.forEach(function (k, j) { o[k] = r[j]; });
      ['total', 'available', 'allocated', 'proses'].forEach(function (k) { o[k] = Number(o[k]) || 0; });
      o.sku = String(o.sku); o.generic = String(o.generic || '');
      return o;
    });
    return withLock_(function () {
      writeAll_('bin', objs);
      const today = today_();
      const first = read_('varian_pertama');
      const baseline = first.length === 0;
      const have = {};
      first.forEach(function (x) { have[String(x.varian)] = 1; });
      const add = [];
      objs.forEach(function (o) {
        if (!(o.total > 0) || o.zona === 'Damage') return;
        const k = varianKey_(o.sku, o.nama);
        if (have[k]) return;
        have[k] = 1;
        add.push({ varian: k, generic: k.split('.')[0], pertama: today, baseline: baseline ? 'ya' : '' });
      });
      appendRows_('varian_pertama', add);
      const skus = {};
      let pcs = 0;
      objs.forEach(function (o) { skus[o.sku] = 1; pcs += o.total; });
      append_('bin_upload', { id: uploadId_(u.username), waktu: now_(), username: u.username, nama_file: String(req.fileName || '').slice(0, 120),
        baris: objs.length, sku: Object.keys(skus).length, pcs: pcs });
      log_(u.username, 'unggah by bin', objs.length + ' baris, ' + pcs + ' pcs' + (baseline ? '' : ', ' + add.length + ' varian baru di toko'));
      if (u.role !== 'admin') notif_('admin', 'info', 'dsr', 'Stok by bin diunggah oleh ' + u.nama,
        rupiah_(pcs) + ' pcs · ' + Object.keys(skus).length + ' SKU' + (baseline ? '' : ' · ' + add.length + ' varian baru masuk toko'), '#/stokart');
      return { baris: objs.length, sku: Object.keys(skus).length, pcs: pcs, varianBaru: baseline ? 0 : add.length, awal: baseline };
    }, 120000);
  },

  binData: function (req) {
    auth_(req);
    const ups = read_('bin_upload');
    const last = ups.length ? ups[ups.length - 1] : null;
    const F = TABS.bin;
    const rows = read_('bin').map(function (o) { return F.map(function (k) { return o[k]; }); });
    const pertama = {};
    read_('varian_pertama').forEach(function (x) { pertama[String(x.varian)] = x.baseline === 'ya' ? '' : String(x.pertama); });
    return {
      upload: last ? { waktu: String(last.waktu), nama: namaUser_(last.username), file: String(last.nama_file), pcs: Number(last.pcs), sku: Number(last.sku) } : null,
      kolom: F, rows: rows, pertama: pertama, today: today_(), naHari: Number(settings_().na_hari) || CFG.NA_HARI
    };
  },

  binUploads: function (req) {
    auth_(req);
    const names = namesMap_();
    return read_('bin_upload').slice(-15).reverse().map(function (r) {
      return { waktu: String(r.waktu), nama: names[r.username] || r.username, file: String(r.nama_file), baris: Number(r.baris), sku: Number(r.sku), pcs: Number(r.pcs) };
    });
  },

  /* ---------- master artikel ---------- */
  masterMap: function (req) {
    auth_(req);
    const F = TABS.master;
    const out = {};
    read_('master').forEach(function (o) { out[String(o.varian)] = F.slice(1).map(function (k) { return o[k]; }); });
    return { kolom: F.slice(1), map: out, info: prop_('master_loaded'), today: today_(), naHari: Number(settings_().na_hari) || CFG.NA_HARI };
  },

  masterStatus: function (req) {
    const u = auth_(req);
    const cek = prop_('master_cek');
    const pend0 = prop_('master_pending');
    if (req.cekSekarang || !cek || Date.now() - Number(cek) > 12 * 3600e3 || (pend0 && !pend0.ready)) { try { cekMaster(); } catch (e) { Logger.log(e); } }
    const proc = prop_('master_proc');
    return {
      loaded: prop_('master_loaded'), pending: prop_('master_pending'), error: prop_('master_error'),
      proses: proc && Date.now() - proc.at < 15 * 60e3 ? proc : null, admin: u.role === 'admin'
    };
  },

  masterClaim: function (req) {
    const u = auth_(req, true);
    return withLock_(function () {
      const pend = prop_('master_pending');
      if (!pend) throw new Error('Tidak ada master artikel baru untuk dimuat');
      if (!pend.ready) throw new Error('File master sedang disiapkan, coba lagi beberapa menit lagi');
      const proc = prop_('master_proc');
      if (proc && proc.by !== u.username && Date.now() - proc.at < 15 * 60e3) throw new Error('Sedang dimuat oleh ' + proc.nama);
      prop_('master_proc', { by: u.username, nama: u.nama, at: Date.now(), id: pend.id });
      const set = {};
      read_('bin').forEach(function (o) { set[String(o.generic || String(o.sku).slice(0, 9))] = 1; });
      const sh = sh_('dsr'), last = sh.getLastRow();
      if (last > 1) sh.getRange(2, TABS.dsr.indexOf('sku') + 1, last - 1, 1).getValues().forEach(function (r) { const k = String(r[0]); if (k) set[k.slice(0, 9)] = 1; });
      return { file: pend, chunks: pend.parts.length, generics: Object.keys(set), naHari: CFG.NA_HARI };
    });
  },

  masterChunk: function (req) {
    auth_(req, true);
    const pend = prop_('master_pending');
    if (!pend || pend.id !== req.id) throw new Error('File master sudah berganti, muat ulang halaman');
    const i = Number(req.i) || 0;
    if (!pend.parts || !pend.parts[i]) throw new Error('Potongan file tidak ditemukan');
    return { i: i, data: DriveApp.getFileById(pend.parts[i]).getBlob().getDataAsString() };
  },

  masterSave: function (req) {
    const u = auth_(req, true);
    const pend = prop_('master_pending');
    if (!pend || pend.id !== req.id) throw new Error('File master sudah berganti, muat ulang halaman');
    const F = TABS.master;
    const objs = (req.rows || []).map(function (r) { const o = {}; F.forEach(function (k, j) { o[k] = r[j]; }); o.harga = Number(o.harga) || 0; return o; });
    return withLock_(function () {
      if (Number(req.part) === 0) writeAll_('master', objs); else appendRows_('master', objs);
      if (!req.selesai) return { ok: true };
      const n = sh_('master').getLastRow() - 1;
      prop_('master_loaded', { id: pend.id, nama: pend.nama, folder: pend.folder, modified: pend.modified, waktu: now_(), oleh: u.nama, varian: n, sig: pend.sig, artikel: Number(req.artikel) || 0 });
      prop_('master_pending', null); prop_('master_proc', null); prop_('master_error', null);
      hapusCacheMaster_();
      bumpVersion_();
      log_(u.username, 'muat master artikel', pend.nama + ' · ' + n + ' varian');
      notif_('admin', 'info', 'master', 'Master artikel diperbarui', pend.nama + ' · ' + rupiah_(n) + ' varian dimuat', '#/stokart');
      return { varian: n };
    }, 120000);
  },

  masterFail: function (req) {
    const u = auth_(req, true);
    const msg = String(req.pesan || '').slice(0, 200);
    prop_('master_proc', null);
    prop_('master_error', { waktu: now_(), pesan: msg });
    notif_('admin', 'cek', 'master', 'Master artikel gagal dimuat', msg, '#/unggahbin');
    log_(u.username, 'gagal muat master', msg);
    return true;
  }
});

/** Cari file master artikel terbaru di folder MASTER ARTIKEL (subfolder bulan dengan nomor terbesar). */
function masterLatest_() {
  const root = DriveApp.getFolderById(CFG.MASTER_FOLDER_ID);
  let best = null;
  const it = root.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    const m = String(f.getName()).match(/^(\d+)/);
    const n = m ? Number(m[1]) : 0;
    const t = f.getDateCreated().getTime();
    if (!best || n > best.n || (n === best.n && t > best.t)) best = { f: f, n: n, t: t };
  }
  const folders = best ? [best.f, root] : [root];
  for (let i = 0; i < folders.length; i++) {
    let file = null;
    const fi = folders[i].getFiles();
    while (fi.hasNext()) {
      const x = fi.next();
      if (!/\.xlsx?$/i.test(x.getName()) && x.getMimeType() !== MimeType.MICROSOFT_EXCEL) continue;
      if (!file || x.getLastUpdated() > file.getLastUpdated()) file = x;
    }
    if (file) {
      const mod = Utilities.formatDate(file.getLastUpdated(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss');
      return { id: file.getId(), nama: file.getName(), folder: folders[i].getName(), modified: mod, size: file.getSize(), sig: file.getId() + '|' + mod };
    }
  }
  return null;
}

/** Dijalankan tiap hari (dan saat web dibuka bila sudah > 12 jam): tandai bila ada master baru. */
function cekMaster() {
  prop_('master_cek', Date.now());
  const f = masterLatest_();
  if (!f) return null;
  const loaded = prop_('master_loaded');
  if (loaded && loaded.sig === f.sig) { prop_('master_pending', null); return f; }
  const pend = prop_('master_pending');
  if (!pend || pend.sig !== f.sig) {
    f.ready = false;
    prop_('master_pending', f);
    // file besar disiapkan di latar (pemicu sekali jalan) supaya web tidak menunggu lama
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'siapkanMaster') ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger('siapkanMaster').timeBased().after(30 * 1000).create();
  } else if (!pend.ready && Date.now() - Number(prop_('master_siap_mulai') || 0) > 15 * 60e3 &&
    !ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'siapkanMaster'; })) {
    ScriptApp.newTrigger('siapkanMaster').timeBased().after(30 * 1000).create();
  }
  return f;
}

/** Pemicu latar: ubah file master jadi potongan teks kecil di folder cache Drive. */
function siapkanMaster() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'siapkanMaster') ScriptApp.deleteTrigger(t); });
  const pend = prop_('master_pending');
  if (!pend || pend.ready) return;
  prop_('master_siap_mulai', Date.now());
  try {
    hapusCacheMaster_();
    const b64 = Utilities.base64Encode(DriveApp.getFileById(pend.id).getBlob().getBytes());
    const folder = folderCacheMaster_();
    const parts = [];
    for (let a = 0, i = 0; a < b64.length; a += CFG.MASTER_CHUNK, i++) {
      parts.push(folder.createFile('master_' + i + '.txt', b64.slice(a, a + CFG.MASTER_CHUNK), MimeType.PLAIN_TEXT).getId());
    }
    const cur = prop_('master_pending');
    if (!cur || cur.sig !== pend.sig) return;
    cur.ready = true; cur.parts = parts;
    prop_('master_pending', cur);
    prop_('master_error', null);
    withLock_(function () {
      notif_('admin', 'info', 'master', 'Master artikel baru siap dimuat', cur.folder + ' · ' + cur.nama + ' · dimuat otomatis saat admin membuka web di komputer', '#/unggahbin');
    });
  } catch (e) {
    prop_('master_error', { waktu: now_(), pesan: 'Gagal menyiapkan file: ' + e.message });
    withLock_(function () { notif_('admin', 'cek', 'master', 'Master artikel gagal disiapkan', String(e.message || e).slice(0, 200), '#/unggahbin'); });
  }
}
function folderCacheMaster_() {
  const it = DriveApp.getFoldersByName(CFG.MASTER_CACHE_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CFG.MASTER_CACHE_FOLDER);
}
function hapusCacheMaster_() {
  try {
    const it = folderCacheMaster_().getFiles();
    while (it.hasNext()) it.next().setTrashed(true);
  } catch (e) { Logger.log('cache master: ' + e); }
}
function pasangCekMaster_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'cekMaster') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cekMaster').timeBased().everyDays(1).atHour(6).create();
}


/* =====================================================================
 * TAHAP 6: Briefing pagi (sales kemarin, posisi bulan, fokus otomatis)
 * ===================================================================== */
const PARTAI_MIN_QTY = 15; // invoice ≥ 15 pcs / wholesale tidak dihitung untuk UPT & basket

Object.assign(API, {
  briefing: function (req) {
    auth_(req);
    const today = today_();
    const kemarin = /^\d{4}-\d{2}-\d{2}$/.test(String(req.tanggal || '')) ? String(req.tanggal) : addDays_(today, -1);
    const latest = latestDate_();
    syncTrafficIfNeeded_();
    const out = cached_('brief_' + kemarin, 600, function () {
      const all = read_('dsr');
      const rowsK = all.filter(function (r) { return String(r.tanggal) === kemarin; });
      const h = hari_(rowsK);
      return { hari: h, kpi: kpiBriefing_(all, kemarin) };
    });
    const tr = read_('traffic').filter(function (x) { return String(x.tanggal) === kemarin; })[0];
    out.hari.traffic = tr && tr.traffic !== '' ? Number(tr.traffic) : null;
    out.kemarin = kemarin; out.today = today; out.dataSampai = latest;
    out.target = { upt: settings_().target_upt, basket: settings_().target_basket };
    return out;
  }
});

/** UPT & basket bulan berjalan (1..tgl), bulan lalu periode sama, dan rekor bulanan; tanpa pembelian partai/wholesale. */
function kpiBriefing_(rows, tgl) {
  const inv = {};
  rows.forEach(function (r) {
    if (!isSalesLine_(r)) return;
    const k = String(r.invoice);
    const o = inv[k] || (inv[k] = { t: String(r.tanggal), q: 0, b: 0, n: 0, ws: false });
    o.q += Number(r.qty) || 0; o.b += Number(r.gross) || 0; o.n += Number(r.net) || 0;
    if (String(r.tipe || '').toLowerCase().indexOf('wholesale') >= 0) o.ws = true;
  });
  const d = Number(tgl.slice(8, 10));
  const ym = tgl.slice(0, 7);
  const p = ym.split('-').map(Number);
  const lm = (p[1] === 1 ? (p[0] - 1) + '-12' : p[0] + '-' + pad_(p[1] - 1));
  const acc = function () { return { q: 0, b: 0, n: 0, t: 0, partai: 0 }; };
  const cur = acc(), last = acc(), months = {};
  Object.keys(inv).forEach(function (k) {
    const o = inv[k];
    const m = o.t.slice(0, 7), day = Number(o.t.slice(8, 10));
    const partai = o.ws || o.q >= PARTAI_MIN_QTY;
    const add = function (A) { if (partai) { A.partai++; return; } A.q += o.q; A.b += o.b; A.n += o.n; A.t++; };
    if (m === ym && day <= d) add(cur);
    if (m === lm && day <= d) add(last);
    if (m <= ym) { months[m] = months[m] || acc(); if (m < ym || day <= d) add(months[m]); }
  });
  const fin = function (A) { return { upt: A.t ? A.q / A.t : null, basketB: A.t ? A.b / A.t : null, basketN: A.t ? A.n / A.t : null, trx: A.t, partai: A.partai }; };
  const best = { upt: null, basketB: null, basketN: null };
  Object.keys(months).forEach(function (m) {
    const f = fin(months[m]);
    if (f.trx < 50) return; // bulan dengan data terlalu sedikit diabaikan
    ['upt', 'basketB', 'basketN'].forEach(function (k) { if (f[k] != null && (!best[k] || f[k] > best[k].nilai)) best[k] = { nilai: f[k], bulan: m }; });
  });
  return { bulanIni: fin(cur), bulanLalu: fin(last), bulanLaluKey: lm, rekor: best, partaiMin: PARTAI_MIN_QTY };
}


/* =====================================================================
 * TAHAP 7: Dokumentasi video opening/closing
 * Video diunggah lewat "mesin upload" di akun pemilik folder (lihat Upload.gs).
 * Basecamp memberi tiket bertanda tangan, lalu membaca isi folder untuk daftar & status.
 * Kunci & alamat mesin upload disimpan di Script Properties: UPLOAD_URL, UPLOAD_SECRET.
 * ===================================================================== */
const DOK_FOLDER_ID = '1qlwAdXg_liYKpyXrOLMwa5NohxpK8xZy';
const DOK_MUNDUR_HARI = 7; // anggota tim boleh mengunggah untuk tanggal sampai 7 hari ke belakang (admin bebas)
const DOK_RE = /^(\d{4}-\d{2}-\d{2}) (OPENING|CLOSING) - (.+?) (\d{4})\.(\w+)$/;

Object.assign(API, {
  dokTiket: function (req) {
    const u = auth_(req);
    const p = PropertiesService.getScriptProperties();
    const url = p.getProperty('UPLOAD_URL'), key = p.getProperty('UPLOAD_SECRET');
    if (!url || !key) throw new Error('Mesin upload belum disambungkan. Hubungi admin.');
    const jenis = String(req.jenis || '').toUpperCase();
    if (!/^(OPENING|CLOSING)$/.test(jenis)) throw new Error('Pilih Opening atau Closing');
    const set = settings_();
    const now = new Date(), today = today_();
    let tgl = String(req.tanggal || today);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) throw new Error('Tanggal tidak valid');
    if (tgl > today) throw new Error('Tanggal tidak boleh di masa depan');
    const batasMundur = u.role === 'admin' ? 366 : DOK_MUNDUR_HARI;
    if (tgl < addDays_(today, -batasMundur)) throw new Error('Tanggal paling lama ' + batasMundur + ' hari ke belakang');
    const payload = { id: Utilities.getUuid(), u: u.username, n: u.nama, j: jenis, max: Math.round(Number(set.dok_max_mb || 300) * 1048576),
      exp: Date.now() + 6 * 3600e3, t: tgl, h: Utilities.formatDate(now, CFG.TZ, 'HHmm') };
    const b = Utilities.base64EncodeWebSafe(JSON.stringify(payload)).replace(/=+$/, '');
    const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(b, key)).replace(/=+$/, '');
    return { url: url, tiket: b + '.' + sig, max: payload.max };
  },

  dokSelesai: function (req) {
    const u = auth_(req);
    const jenis = String(req.jenis || '').toUpperCase();
    const tg = /^\d{4}-\d{2}-\d{2}$/.test(String(req.tanggal || '')) ? String(req.tanggal) : today_();
    CacheService.getScriptCache().removeAll(['dok_' + tg.slice(0, 7), 'dok_' + today_().slice(0, 7), 'dok_bulan']);
    log_(u.username, 'unggah video ' + jenis.toLowerCase(), String(req.nama || '').slice(0, 120));
    withLock_(function () {
      if (u.role !== 'admin') notif_('admin', 'info', 'video', 'Video ' + jenis.toLowerCase() + ' diunggah oleh ' + u.nama,
        String(req.nama || '') + (req.size ? ' · ' + Math.round(req.size / 1048576) + ' MB' : ''), '#/dokumentasi');
    });
    return true;
  },

  dokList: function (req) {
    auth_(req);
    const bulan = /^\d{4}-\d{2}$/.test(String(req.bulan || '')) ? String(req.bulan) : today_().slice(0, 7);
    const c = CacheService.getScriptCache();
    const hit = c.get('dok_' + bulan);
    const items = hit ? JSON.parse(hit) : dokBaca_(bulan);
    if (!hit) { try { c.put('dok_' + bulan, JSON.stringify(items), 120); } catch (e) {} }
    let bl = c.get('dok_bulan');
    if (!bl) {
      const list = [];
      const it = DriveApp.getFolderById(DOK_FOLDER_ID).getFolders();
      while (it.hasNext()) { const m = String(it.next().getName()).match(/^(\d{4}-\d{2})/); if (m) list.push(m[1]); }
      bl = JSON.stringify(list.sort().reverse());
      try { c.put('dok_bulan', bl, 600); } catch (e) {}
    }
    const set = settings_();
    const p = PropertiesService.getScriptProperties();
    return { bulan: bulan, items: items, bulanTersedia: JSON.parse(bl), today: today_(), sekarang: Utilities.formatDate(new Date(), CFG.TZ, 'HH:mm'),
      mundur: DOK_MUNDUR_HARI,
      batasOpen: Number(set.dok_batas_open), batasClose: Number(set.dok_batas_close), maxMb: Number(set.dok_max_mb),
      siap: !!(p.getProperty('UPLOAD_URL') && p.getProperty('UPLOAD_SECRET')) };
  },

  /** Admin: sambungkan mesin upload (alamat Web App + kunci dari Upload.gs). */
  setUpload: function (req) {
    const a = auth_(req, true);
    const url = String(req.url || '').trim(), key = String(req.kunci || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) throw new Error('Alamat Web App tidak valid');
    if (key.length < 32) throw new Error('Kunci tidak valid');
    PropertiesService.getScriptProperties().setProperties({ UPLOAD_URL: url, UPLOAD_SECRET: key });
    log_(a.username, 'sambungkan mesin upload', url.slice(0, 60));
    return true;
  }
});

function dokBaca_(bulan) {
  const root = DriveApp.getFolderById(DOK_FOLDER_ID);
  const out = [];
  const ambil = function (folder, depth) {
    const fi = folder.getFiles();
    while (fi.hasNext()) {
      const x = fi.next(), m = String(x.getName()).match(DOK_RE);
      if (m) out.push({ id: x.getId(), nama: x.getName(), tanggal: m[1], jenis: m[2], oleh: m[3], jam: m[4].slice(0, 2) + ':' + m[4].slice(2), size: x.getSize(), dibuat: Utilities.formatDate(x.getDateCreated(), CFG.TZ, 'yyyy-MM-dd HH:mm') });
    }
    if (depth > 0) { const sub = folder.getFolders(); while (sub.hasNext()) ambil(sub.next(), depth - 1); }
  };
  const it = root.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    if (String(f.getName()).indexOf(bulan) === 0) ambil(f, 1); // folder bulan + subfolder harian
  }
  return out.sort(function (a, b) { return a.tanggal === b.tanggal ? (a.jam < b.jam ? -1 : 1) : (a.tanggal < b.tanggal ? 1 : -1); });
}

/** Dipanggil tiap jam: beri tahu admin bila video opening/closing belum ada lewat jam batas. */
function cekDokumentasi_() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('UPLOAD_URL')) return;
  const set = settings_();
  const now = new Date(), today = today_();
  const menit = Number(Utilities.formatDate(now, CFG.TZ, 'H')) * 60 + Number(Utilities.formatDate(now, CFG.TZ, 'm'));
  const cek = [['OPENING', Number(set.dok_batas_open)], ['CLOSING', Number(set.dok_batas_close)]];
  let items = null;
  cek.forEach(function (c) {
    if (!c[1] || menit < c[1]) return;
    const key = 'dok_notif_' + c[0];
    if (p.getProperty(key) === today) return;
    items = items || dokBaca_(today.slice(0, 7));
    if (items.some(function (x) { return x.tanggal === today && x.jenis === c[0]; })) return;
    p.setProperty(key, today);
    const jam = pad_(Math.floor(c[1] / 60)) + '.' + pad_(c[1] % 60);
    withLock_(function () { notif_('admin', 'cek', 'video', 'Video ' + c[0].toLowerCase() + ' hari ini belum diunggah', 'Batas pukul ' + jam + ' sudah lewat', '#/dokumentasi'); });
  });
}

/* =====================================================================
 * TAHAP 8: performa produk, target RA, laporan mingguan, pengumuman, handover
 * ===================================================================== */

Object.assign(API, {
  /** Data penjualan per generic untuk kriteria laku & saran request. */
  perfData: function (req) {
    auth_(req);
    const today = today_();
    return cached_('perf_' + today, 1800, function () {
      const d180 = addDays_(today, -182), d30 = addDays_(today, -30), d90 = addDays_(today, -90);
      const G = {}, V = {}, V90 = {};
      read_('dsr').forEach(function (r) {
        if (!isSalesLine_(r)) return;
        const t = String(r.tanggal), q = Number(r.qty) || 0, sku = String(r.sku);
        const g = sku.length > 9 ? sku.slice(0, 9) : sku;
        const o = G[g] || (G[g] = { q6: 0, q30: 0, q90: 0, first: t, last: t });
        if (t >= d90) { o.q90 += q; const vk9 = varianKey_(sku, r.nama_sku); V90[vk9] = (V90[vk9] || 0) + q; }
        if (t < o.first) o.first = t;
        if (t > o.last) o.last = t;
        if (t >= d180) o.q6 += q;
        if (t >= d30) {
          o.q30 += q;
          const vk = varianKey_(sku, r.nama_sku);
          V[vk] = (V[vk] || 0) + q;
        }
      });
      const firstBin = {};
      read_('varian_pertama').forEach(function (x) {
        const g = String(x.generic), t = String(x.pertama);
        if (t && (!firstBin[g] || t < firstBin[g])) firstBin[g] = t;
      });
      return {
        today: today, dari6: d180,
        gen: Object.keys(G).map(function (k) { const o = G[k]; return [k, o.q6, o.q30, o.first, o.last, o.q90]; }),
        firstBin: firstBin,
        var30: V, var90: V90
      };
    });
  },

  /* ---------- target per RA ---------- */
  raTarget: function (req) {
    const u = auth_(req);
    const bulan = /^\d{4}-\d{2}$/.test(String(req.bulan || '')) ? String(req.bulan) : today_().slice(0, 7);
    const targets = {};
    read_('target_ra').filter(function (x) { return String(x.bulan) === bulan; }).forEach(function (x) { targets[String(x.ra)] = Number(x.target) || 0; });
    const ras = raNames_(bulan);
    const t = read_('targets').filter(function (x) { return String(x.bulan) === bulan; })[0];
    const users = u.role === 'admin' ? read_('users').filter(function (x) { return x.status === 'aktif'; }).map(function (x) {
      return { username: x.username, nama: x.nama, namaDsr: resolveNamaDsr_(x, ras), manual: String(x.nama_dsr || '') };
    }) : null;
    let toko = [];
    try { toko = raToko_(bulan, read_('dsr').filter(function (r) { return String(r.tanggal).slice(0, 7) === bulan; })); } catch (e) { toko = []; }
    return { bulan: bulan, targets: targets, ras: ras, raToko: toko, targetToko: t ? Number(t.target) : null, users: users };
  },

  raTargetSet: function (req) {
    const a = auth_(req, true);
    const bulan = String(req.bulan || '');
    if (!/^\d{4}-\d{2}$/.test(bulan)) throw new Error('Bulan tidak valid');
    const list = (req.list || []).map(function (x) {
      const n = Number(x.target);
      if (!isFinite(n) || n < 0) throw new Error('Target ' + x.ra + ' tidak valid');
      return { bulan: bulan, ra: String(x.ra || '').trim(), target: Math.round(n), diubah: now_(), oleh: a.username };
    }).filter(function (x) { return x.ra; });
    return withLock_(function () {
      const keep = read_('target_ra').filter(function (x) { return String(x.bulan) !== bulan; });
      writeAll_('target_ra', keep.concat(list));
      log_(a.username, 'target RA', bulan + ' · ' + list.length + ' orang');
      return true;
    });
  },

  setNamaDsr: function (req) {
    const a = auth_(req, true);
    const target = cleanUser_(req.username);
    const nd = String(req.namaDsr || '').trim();
    return withLock_(function () {
      if (!updateRow_('users', 'username', target, { nama_dsr: nd })) throw new Error('User tidak ditemukan');
      log_(a.username, 'nama di DSR', target + ' → ' + (nd || '(otomatis)'));
      return true;
    });
  },

  /** Pencapaian pribadi bulan ini untuk Beranda. */
  saya: function (req) {
    const u = auth_(req);
    const today = today_(), bulan = today.slice(0, 7);
    const ras = raNames_(bulan);
    const nama = resolveNamaDsr_(u, ras);
    const rowsM = read_('dsr').filter(function (r) { return String(r.tanggal).slice(0, 7) === bulan; });
    const H = raHO_(rowsM, raToko_(bulan, rowsM));
    const list = H.list.map(function (x) { return { ra: x.nama, b: x.b, n: x.n, q: x.q, trx: x.trx, ownB: x.ownB, ownN: x.ownN, shareB: H.share.b, shareN: H.share.n }; });
    const tg = read_('target_ra').filter(function (x) { return String(x.bulan) === bulan && String(x.ra) === nama; })[0];
    const p = today.split('-').map(Number), dim = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
    return { bulan: bulan, nama: nama, list: list, target: tg ? Number(tg.target) : null, dataSampai: latestDate_(), sisaHari: dim - p[2] + 1 };
  },

  /* ---------- laporan mingguan ---------- */
  mingguan: function (req) {
    auth_(req);
    const dari = String(req.dari || ''), sampai = String(req.sampai || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dari) || !/^\d{4}-\d{2}-\d{2}$/.test(sampai) || dari > sampai) throw new Error('Rentang tanggal tidak valid');
    return cached_('ming_' + dari + '_' + sampai, 600, function () {
      const rows = read_('dsr').filter(function (r) { const t = String(r.tanggal); return t >= dari && t <= sampai; });
      const H = {}, inv = {}, vr = {}, ra = {};
      rows.forEach(function (r) {
        if (!isSalesLine_(r)) return;
        const t = String(r.tanggal), g = Number(r.gross) || 0, n = Number(r.net) || 0, q = Number(r.qty) || 0, k = String(r.invoice);
        const h = H[t] || (H[t] = { b: 0, n: 0, q: 0, inv: {} });
        h.b += g; h.n += n; h.q += q; h.inv[k] = 1;
        const I = inv[k] || (inv[k] = { q: 0, b: 0, n: 0, ws: false });
        I.q += q; I.b += g; I.n += n; if (String(r.tipe || '').toLowerCase().indexOf('wholesale') >= 0) I.ws = true;
        const vk = varianKey_(r.sku, r.nama_sku), parts = String(r.nama_sku).split(',');
        const V = vr[vk] || (vr[vk] = { nama: parts.length >= 3 ? parts.slice(0, parts.length - 2).join(',').trim() + ' ' + parts[parts.length - 2].trim() : String(r.nama_sku), q: 0, b: 0, n: 0 });
        V.q += q; V.b += g; V.n += n;
      });
      const HO = raHO_(rows, raToko_(sampai.slice(0, 7), rows));
      HO.list.forEach(function (x) { ra[x.nama] = { b: x.b, n: x.n, q: x.q, inv: null, t: x.trx }; });
      // target harian = target bulan × bobot hari itu
      const tg = {}; read_('targets').forEach(function (x) { tg[String(x.bulan)] = Number(x.target); });
      const bb = {}; read_('bobot').forEach(function (x) { bb[String(x.tanggal)] = Number(x.harian); });
      const tr = {}; read_('traffic').forEach(function (x) { if (x.traffic !== '') tr[String(x.tanggal)] = Number(x.traffic); });
      const hari = [];
      for (let t = dari; t <= sampai; t = addDays_(t, 1)) {
        const h = H[t] || { b: 0, n: 0, q: 0, inv: {} };
        const target = tg[t.slice(0, 7)] && bb[t] != null ? Math.round(tg[t.slice(0, 7)] * bb[t]) : null;
        hari.push({ tanggal: t, bruto: Math.round(h.b), netto: Math.round(h.n), qty: h.q, trx: Object.keys(h.inv).length, target: target, traffic: tr[t] != null ? tr[t] : null });
      }
      let kp = { q: 0, b: 0, n: 0, t: 0, partai: 0 };
      Object.keys(inv).forEach(function (k) { const o = inv[k]; if (o.ws || o.q >= PARTAI_MIN_QTY) { kp.partai++; return; } kp.q += o.q; kp.b += o.b; kp.n += o.n; kp.t++; });
      const kas = read_('kas').filter(function (x) { const t = String(x.tanggal); return t >= dari && t <= sampai; }).map(kasOut_);
      const kasSum = { hitung: kas.length, selisih: 0, kurang: 0, lebih: 0, list: [] };
      kas.forEach(function (x) {
        if (x.selisih == null || !x.selisih) return;
        kasSum.selisih++;
        if (x.selisih < 0) kasSum.kurang += -x.selisih; else kasSum.lebih += x.selisih;
        kasSum.list.push([x.tanggal, x.nama, x.pos, x.selisih, x.catatan]);
      });
      let dok = null;
      try {
        const items = dokBaca_(dari.slice(0, 7)).concat(dari.slice(0, 7) !== sampai.slice(0, 7) ? dokBaca_(sampai.slice(0, 7)) : []);
        const d = {}; items.forEach(function (x) { if (x.tanggal >= dari && x.tanggal <= sampai) (d[x.tanggal] = d[x.tanggal] || {})[x.jenis] = 1; });
        let lengkap = 0; Object.keys(d).forEach(function (k) { if (d[k].OPENING && d[k].CLOSING) lengkap++; });
        dok = { lengkap: lengkap, hari: hari.length, ada: Object.keys(d).length };
      } catch (e) { dok = null; }
      return {
        dari: dari, sampai: sampai, hari: hari,
        kpi: { upt: kp.t ? kp.q / kp.t : null, basketB: kp.t ? kp.b / kp.t : null, basketN: kp.t ? kp.n / kp.t : null, trx: kp.t, partai: kp.partai },
        varian: Object.keys(vr).map(function (k) { const x = vr[k]; return [k, x.nama, x.q, Math.round(x.b), Math.round(x.n)]; }).sort(function (a, b) { return b[4] - a[4]; }),
        ra: Object.keys(ra).map(function (k) { const x = ra[k]; return [k, Math.round(x.b), Math.round(x.n), x.q, x.t]; }).sort(function (a, b) { return b[2] - a[2]; }),
        raDilebur: { b: HO.dilebur.b, n: HO.dilebur.n, ra: HO.ras.length },
        kas: kasSum, dok: dok, dokRA: (function () { try { return dokRekap_(dari, sampai).list; } catch (e) { return []; } })(), dataSampai: latestDate_()
      };
    });
  },

  /* ---------- pengumuman ---------- */
  pengList: function (req) {
    const u = auth_(req);
    const baca = read_('pengumuman_baca');
    const users = read_('users').filter(function (x) { return x.status === 'aktif'; });
    const list = read_('pengumuman').filter(function (p) { return p.aktif !== 'tidak' || u.role === 'admin'; }).reverse().map(function (p) {
      const b = baca.filter(function (x) { return String(x.id) === String(p.id); });
      const o = { id: String(p.id), dibuat: String(p.dibuat), nama: String(p.nama), judul: String(p.judul), isi: String(p.isi), penting: p.penting === 'ya', aktif: p.aktif !== 'tidak', diubah: String(p.diubah || ''),
        dibaca: b.some(function (x) { return x.username === u.username; }), jumlahBaca: b.length, jumlahTim: users.length };
      if (u.role === 'admin') {
        const sudah = {}; b.forEach(function (x) { sudah[x.username] = String(x.waktu); });
        o.pembaca = users.map(function (x) { return { nama: x.nama, waktu: sudah[x.username] || '' }; });
      }
      return o;
    });
    return { list: list };
  },

  pengSave: function (req) {
    const a = auth_(req, true);
    const judul = String(req.judul || '').trim().slice(0, 120), isi = String(req.isi || '').trim().slice(0, 3000);
    if (!judul) throw new Error('Judul wajib diisi');
    if (!isi) throw new Error('Isi pengumuman wajib diisi');
    return withLock_(function () {
      if (req.id) {
        if (!updateRow_('pengumuman', 'id', String(req.id), { judul: judul, isi: isi, penting: req.penting ? 'ya' : '', diubah: now_() })) throw new Error('Pengumuman tidak ditemukan');
        if (req.ulangBaca) writeAll_('pengumuman_baca', read_('pengumuman_baca').filter(function (x) { return String(x.id) !== String(req.id); }));
        log_(a.username, 'ubah pengumuman', judul);
        return { id: String(req.id) };
      }
      const id = Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMddHHmmss');
      append_('pengumuman', { id: id, dibuat: now_(), oleh: a.username, nama: a.nama, judul: judul, isi: isi, penting: req.penting ? 'ya' : '', aktif: 'ya', diubah: '' });
      append_('pengumuman_baca', { id: id, username: a.username, waktu: now_() });
      notif_('semua', req.penting ? 'cek' : 'info', 'pengumuman', '📢 ' + judul, isi.slice(0, 140), '#/pengumuman');
      log_(a.username, 'pengumuman baru', judul);
      return { id: id };
    });
  },

  pengArsip: function (req) {
    const a = auth_(req, true);
    return withLock_(function () {
      if (!updateRow_('pengumuman', 'id', String(req.id), { aktif: req.aktif ? 'ya' : 'tidak' })) throw new Error('Pengumuman tidak ditemukan');
      log_(a.username, req.aktif ? 'aktifkan pengumuman' : 'arsipkan pengumuman', String(req.id));
      return true;
    });
  },

  pengBaca: function (req) {
    const u = auth_(req);
    return withLock_(function () {
      const ada = read_('pengumuman_baca').some(function (x) { return String(x.id) === String(req.id) && x.username === u.username; });
      if (!ada) append_('pengumuman_baca', { id: String(req.id), username: u.username, waktu: now_() });
      return true;
    });
  },

  /* ---------- handover dari foto buku ---------- */
  hoOcr: function (req) {
    const u = auth_(req);
    const b64 = String(req.gambar || '');
    if (!b64 || b64.length > 8 * 1024 * 1024) throw new Error('Foto tidak valid atau terlalu besar');
    const tgl = today_();
    const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', tgl + ' handover ' + u.username + ' ' + Utilities.formatDate(new Date(), CFG.TZ, 'HHmmss') + '.jpg');
    const foto = folderHandover_(tgl).createFile(blob);
    try { foto.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    let teks = '';
    try { teks = ocr_(blob); } catch (e) { teks = ''; Logger.log('OCR: ' + e); }
    return { teks: teks, foto: foto.getId() };
  },

  hoSave: function (req) {
    const u = auth_(req);
    const isi = String(req.isi || '').trim().slice(0, 5000);
    const tgl = /^\d{4}-\d{2}-\d{2}$/.test(String(req.tanggal || '')) ? String(req.tanggal) : today_();
    const shift = ['Pagi → Siang', 'Siang → Closing', 'Closing → Pagi', 'Lainnya'].indexOf(req.shift) >= 0 ? req.shift : 'Lainnya';
    const foto = (req.foto || []).map(String).filter(function (x) { return /^[\w-]{20,}$/.test(x); }).slice(0, 6).join(',');
    if (!isi && !foto) throw new Error('Isi handover atau foto wajib ada');
    return withLock_(function () {
      const id = Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMddHHmmss') + '-' + u.username;
      append_('handover', { id: id, waktu: now_(), tanggal: tgl, shift: shift, username: u.username, nama: u.nama, isi: isi, foto: foto });
      notif_('semua', 'info', 'handover', 'Handover ' + shift + ' dari ' + u.nama, isi.slice(0, 140) || '(foto)', '#/handover');
      log_(u.username, 'handover', shift + ' ' + tgl);
      return { id: id };
    });
  },

  hoList: function (req) {
    const u = auth_(req);
    const baca = read_('handover_baca'), names = namesMap_();
    return read_('handover').slice(-60).reverse().map(function (x) {
      const b = baca.filter(function (r) { return String(r.id) === String(x.id); });
      return { id: String(x.id), waktu: String(x.waktu), tanggal: String(x.tanggal), shift: String(x.shift), nama: String(x.nama), username: String(x.username), isi: String(x.isi), foto: String(x.foto || '').split(',').filter(String),
        dibaca: x.username === u.username || b.some(function (r) { return r.username === u.username; }),
        pembaca: b.map(function (r) { return names[r.username] || r.username; }) };
    });
  }
});

function normDsr_(s) { return String(s || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
/** Nama sales person (RA) di DSR bulan ini & bulan lalu. */
function raNames_(bulan) {
  const p = bulan.split('-').map(Number);
  const lm = p[1] === 1 ? (p[0] - 1) + '-12' : p[0] + '-' + pad_(p[1] - 1);
  const set = {};
  const sh = sh_('dsr'), last = sh.getLastRow();
  if (last < 2) return [];
  const iT = TABS.dsr.indexOf('tanggal'), iS = TABS.dsr.indexOf('sales_person');
  sh.getRange(2, 1, last - 1, TABS.dsr.length).getValues().forEach(function (r) {
    const m = String(r[iT]).slice(0, 7);
    const sp = String(r[iS] || '').trim();
    if (sp && (m === bulan || m === lm)) set[sp] = 1;
  });
  return Object.keys(set).sort();
}
function resolveNamaDsr_(user, ras) {
  if (!user) return '';
  if (String(user.nama_dsr || '').trim()) return String(user.nama_dsr).trim();
  const n = normDsr_(user.nama);
  if (!n) return '';
  const exact = ras.filter(function (s) { return normDsr_(s) === n; })[0];
  if (exact) return exact;
  const w = n.split(' ');
  const part = ras.filter(function (s) { const x = normDsr_(s); return x.indexOf(n) === 0 || n.indexOf(x) === 0 || (w.length > 1 && x.indexOf(w[0] + ' ' + w[1]) === 0); });
  if (part.length === 1) return part[0];
  const first = ras.filter(function (s) { return normDsr_(s).split(' ')[0] === w[0]; });
  return first.length === 1 ? first[0] : '';
}

function folderHandover_(tgl) {
  const it = DriveApp.getFoldersByName('Handover Basecamp 2299');
  const root = it.hasNext() ? it.next() : DriveApp.createFolder('Handover Basecamp 2299');
  const name = tgl.slice(0, 7);
  const s = root.getFoldersByName(name);
  return s.hasNext() ? s.next() : root.createFolder(name);
}

/** Baca teks dari gambar memakai OCR Google Drive (gambar → Google Docs → teks). */
function ocr_(blob) {
  const boundary = 'bc2299' + Date.now();
  const meta = { name: 'ocr-tmp-' + Date.now(), mimeType: 'application/vnd.google-apps.document' };
  const head = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + boundary + '\r\nContent-Type: image/jpeg\r\n\r\n';
  const tail = '\r\n--' + boundary + '--';
  const payload = Utilities.newBlob(head).getBytes().concat(blob.getBytes()).concat(Utilities.newBlob(tail).getBytes());
  const tok = ScriptApp.getOAuthToken();
  const r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=id&fields=id', {
    method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: payload, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + tok }
  });
  if (r.getResponseCode() !== 200) throw new Error('OCR gagal (' + r.getResponseCode() + ')');
  const id = JSON.parse(r.getContentText()).id;
  try {
    const t = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=text/plain', { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true });
    return t.getResponseCode() === 200 ? t.getContentText().replace(/^﻿/, '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim() : '';
  } finally {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
  }
}

/* =====================================================================
 * TAHAP 9: tugas video per shift, rekap kepatuhan, feedback anonim,
 * papan apresiasi, handover dibaca
 * ===================================================================== */
const SHIFT_OPEN = 'PD', SHIFT_CLOSE = 'SB';
function menitNow_() { const n = new Date(); return Number(Utilities.formatDate(n, CFG.TZ, 'H')) * 60 + Number(Utilities.formatDate(n, CFG.TZ, 'm')); }
function hhmm_(m) { return pad_(Math.floor(m / 60)) + '.' + pad_(m % 60); }

/** Peta shift semua tab jadwal terbaru: { 'yyyy-MM-dd': { 'NAMA': 'PD' } }. */
function jadwalMap_() {
  return cached_('jadwalmap_' + today_(), 600, function () {
    const ss = SpreadsheetApp.openById(CFG.JADWAL_SHEET_ID);
    const sheets = ss.getSheets().slice().reverse();
    const out = {}; let n = 0;
    for (let i = 0; i < sheets.length && n < 4; i++) {
      const months = monthsFromName_(sheets[i].getName());
      if (!months.length) continue;
      n++;
      const p = parseJadwal_(sheets[i].getRange('B2:AJ16').getDisplayValues(), months, sheets[i].getName(), today_());
      p.tanggal.forEach(function (t, k) {
        if (out[t]) return; // tab yang lebih baru menang
        const m = {}; p.staf.forEach(function (s) { m[s.nama] = s.shift[k] || ''; }); out[t] = m;
      });
    }
    return out;
  });
}
function dokItems_(bulan) {
  const c = CacheService.getScriptCache(), hit = c.get('dok_' + bulan);
  if (hit) return JSON.parse(hit);
  const items = dokBaca_(bulan);
  try { c.put('dok_' + bulan, JSON.stringify(items), 120); } catch (e) {}
  return items;
}
/** Notifikasi langsung untuk RA yang bertugas opening (PD) / closing (SB) hari ini. */
function dokTugas_(u, today) {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('UPLOAD_URL')) return [];
  const set = settings_(), mnt = menitNow_();
  const tugas = [['OPENING', SHIFT_OPEN, Number(set.dok_ingat_open), Number(set.dok_batas_open)], ['CLOSING', SHIFT_CLOSE, Number(set.dok_ingat_close), Number(set.dok_batas_close)]]
    .filter(function (t) { return t[2] && mnt >= t[2]; });
  if (!tugas.length) return [];
  const map = jadwalMap_()[today];
  if (!map) return [];
  const nama = resolveNamaJadwal_(u, Object.keys(map));
  if (!nama) return [];
  const out = [];
  let items = null;
  tugas.forEach(function (t) {
    if (map[nama] !== t[1]) return;
    items = items || dokItems_(today.slice(0, 7));
    if (items.some(function (x) { return x.tanggal === today && x.jenis === t[0]; })) return;
    const telat = mnt >= t[3], j = t[0] === 'OPENING' ? 'opening' : 'closing';
    out.push({ id: 'live-dok-' + j + '-' + today, live: true, level: telat ? 'aksi' : 'cek', jenis: 'video', waktu: today + ' ' + hhmm_(t[2]).replace('.', ':') + ':00',
      judul: (telat ? 'Terlambat: ' : '') + 'Video ' + j + ' hari ini belum diunggah',
      isi: 'Kamu shift ' + (t[1] === 'PD' ? 'pagi' : 'siang') + ' · batas ' + hhmm_(t[3]) + (telat ? ' sudah lewat' : ''),
      link: '#/dokumentasi?jenis=' + t[0] });
  });
  return out;
}

/** Rekap kepatuhan video per RA (berdasarkan shift PD = opening, SB = closing). */
function dokRekap_(dari, sampai) {
  const set = settings_(), today = today_(), mnt = menitNow_();
  const map = jadwalMap_();
  const bulan = {}; let t = dari;
  while (t <= sampai) { bulan[t.slice(0, 7)] = 1; t = addDays_(t, 1); }
  let items = [];
  Object.keys(bulan).forEach(function (b) { items = items.concat(dokItems_(b)); });
  const vid = {};
  items.forEach(function (x) {
    const k = x.tanggal + '|' + x.jenis, created = String(x.dibuat || (x.tanggal + ' ' + x.jam));
    if (!vid[k] || created < vid[k]) vid[k] = created;
  });
  const ra = {}, hariList = [];
  for (let d = dari; d <= sampai && d <= today; d = addDays_(d, 1)) {
    const m = map[d]; if (!m) continue;
    hariList.push(d);
    [['OPENING', SHIFT_OPEN, Number(set.dok_batas_open)], ['CLOSING', SHIFT_CLOSE, Number(set.dok_batas_close)]].forEach(function (c) {
      if (d === today && mnt < c[2]) return; // belum jatuh tempo
      const batas = d + ' ' + hhmm_(c[2]).replace('.', ':');
      const v = vid[d + '|' + c[0]];
      const st = !v ? 'kosong' : v <= batas ? 'tepat' : 'telat';
      Object.keys(m).forEach(function (nama) {
        if (m[nama] !== c[1]) return;
        const o = ra[nama] = ra[nama] || { nama: nama, OPENING: { tugas: 0, tepat: 0, telat: 0, kosong: 0 }, CLOSING: { tugas: 0, tepat: 0, telat: 0, kosong: 0 } };
        o[c[0]].tugas++; o[c[0]][st]++;
      });
    });
  }
  const list = Object.keys(ra).map(function (k) { return ra[k]; }).sort(function (a, b) { return a.nama < b.nama ? -1 : 1; });
  return { dari: dari, sampai: sampai, hari: hariList.length, list: list };
}

/* ---------- feedback anonim ---------- */
function fbTerkirim_(x, today, mnt) { const k = String(x.kirim); return k < today || (k === today && mnt >= 480); }
function fbMasuk_(u) {
  const today = today_(), mnt = menitNow_(), admin = u.role === 'admin';
  return read_('feedback').filter(function (x) {
    const to = String(x.untuk);
    return (to === u.username || (admin && to === 'toko')) && fbTerkirim_(x, today, mnt);
  }).map(function (x) {
    return { id: String(x.id), kirim: String(x.kirim), untuk: String(x.untuk), jenis: String(x.jenis), isi: String(x.isi),
      dibaca: String(x.dibaca || '').split(',').indexOf(u.username) >= 0, dilaporkan: String(x.dilaporkan) === 'ya' };
  }).sort(function (a, b) { return a.kirim < b.kirim ? 1 : a.kirim > b.kirim ? -1 : 0; });
}
/** Dipanggil tiap jam: jam 08.00 kirim notifikasi feedback yang terkumpul. */
function kirimFeedback_() {
  const p = PropertiesService.getScriptProperties(), today = today_();
  if (menitNow_() < 480 || p.getProperty('fb_kirim') === today) return;
  p.setProperty('fb_kirim', today);
  const per = {};
  read_('feedback').forEach(function (x) { if (String(x.kirim) === today) per[x.untuk] = (per[x.untuk] || 0) + 1; });
  const keys = Object.keys(per);
  if (!keys.length) return;
  withLock_(function () {
    keys.forEach(function (to) {
      notif_(to === 'toko' ? 'admin' : to, 'info', 'feedback', per[to] + ' feedback anonim baru' + (to === 'toko' ? ' untuk toko' : ' untukmu'), 'Buka untuk membaca', '#/feedback');
    });
  });
}

Object.assign(API, {
  dokRekap: function (req) {
    auth_(req);
    const b = /^\d{4}-\d{2}$/.test(String(req.bulan || '')) ? String(req.bulan) : today_().slice(0, 7);
    const y = Number(b.slice(0, 4)), m = Number(b.slice(5));
    const akhir = addDays_((m === 12 ? (y + 1) + '-01' : y + '-' + pad_(m + 1)) + '-01', -1);
    const r = dokRekap_(b + '-01', akhir < today_() ? akhir : today_());
    r.bulan = b;
    return r;
  },

  fbTujuan: function (req) {
    const u = auth_(req);
    return read_('users').filter(function (x) { return x.status === 'aktif' && x.username !== u.username; })
      .map(function (x) { return { username: x.username, nama: x.nama }; });
  },
  fbKirim: function (req) {
    const u = auth_(req);
    const untuk = String(req.untuk || ''), jenis = String(req.jenis || ''), isi = String(req.isi || '').trim().slice(0, 1500);
    if (!/^(apresiasi|saran)$/.test(jenis)) throw new Error('Pilih jenis feedback');
    if (isi.length < 10) throw new Error('Tulis minimal 10 huruf ya');
    if (untuk !== 'toko') {
      if (untuk === u.username) throw new Error('Tidak bisa mengirim ke diri sendiri');
      if (!read_('users').some(function (x) { return x.username === untuk && x.status === 'aktif'; })) throw new Error('Penerima tidak ditemukan');
    }
    const today = today_();
    // kuota harian disimpan sementara di cache (tanpa nama, tidak masuk sheet)
    const c = CacheService.getScriptCache();
    const kk = 'fbq_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, u.username + '|' + today + '|' + ScriptApp.getScriptId()));
    const n = Number(c.get(kk) || 0);
    if (n >= 3) throw new Error('Batas 3 feedback per hari sudah tercapai. Lanjut besok ya');
    const kirim = menitNow_() < 480 ? today : addDays_(today, 1);
    return withLock_(function () {
      const all = read_('feedback');
      const row = { id: Utilities.getUuid().slice(0, 8), tanggal: kirim, kirim: kirim, untuk: untuk, jenis: jenis, isi: isi, dibaca: '', dilaporkan: '', alasan_lapor: '' };
      all.splice(Math.floor(Math.random() * (all.length + 1)), 0, row); // posisi acak supaya urutan baris tidak membuka pengirim
      writeAll_('feedback', all);
      c.put(kk, String(n + 1), 21600);
      return { kirim: kirim, sisa: 2 - n };
    });
  },
  fbMasuk: function (req) {
    const u = auth_(req);
    const list = fbMasuk_(u);
    const un = list.filter(function (x) { return !x.dibaca; }).map(function (x) { return x.id; });
    if (un.length) withLock_(function () {
      const all = read_('feedback');
      all.forEach(function (x) { if (un.indexOf(String(x.id)) >= 0) { const l = String(x.dibaca || '').split(',').filter(String); l.push(u.username); x.dibaca = l.join(','); } });
      writeAll_('feedback', all);
    });
    const out = { list: list };
    if (u.role === 'admin') {
      const all = read_('feedback'), today = today_(), mnt = menitNow_(), d30 = addDays_(today, -30);
      const kirim = all.filter(function (x) { return fbTerkirim_(x, today, mnt) && String(x.kirim) >= d30; });
      out.ringkas = { apresiasi: kirim.filter(function (x) { return x.jenis === 'apresiasi'; }).length, saran: kirim.filter(function (x) { return x.jenis === 'saran'; }).length,
        antarRekan: kirim.filter(function (x) { return x.untuk !== 'toko'; }).length, menunggu: all.filter(function (x) { return !fbTerkirim_(x, today, mnt); }).length };
      const names = namesMap_();
      out.laporan = all.filter(function (x) { return String(x.dilaporkan) === 'ya'; }).map(function (x) {
        return { id: String(x.id), kirim: String(x.kirim), untuk: x.untuk === 'toko' ? 'Toko' : (names[x.untuk] || x.untuk), jenis: String(x.jenis), isi: String(x.isi), alasan: String(x.alasan_lapor || '') };
      });
    }
    return out;
  },
  fbLapor: function (req) {
    const u = auth_(req);
    return withLock_(function () {
      const all = read_('feedback');
      const x = all.filter(function (r) { return String(r.id) === String(req.id); })[0];
      if (!x || (x.untuk !== u.username && !(u.role === 'admin' && x.untuk === 'toko'))) throw new Error('Feedback tidak ditemukan');
      x.dilaporkan = 'ya'; x.alasan_lapor = String(req.alasan || '').slice(0, 300);
      writeAll_('feedback', all);
      notif_('admin', 'cek', 'feedback', 'Ada feedback anonim yang dilaporkan', 'Cek di menu Feedback Anonim', '#/feedback');
      return true;
    });
  },

  /* ---------- papan apresiasi (terbuka) ---------- */
  apList: function (req) {
    auth_(req);
    return read_('apresiasi').filter(function (x) { return x.aktif !== 'tidak'; }).slice(-40).reverse().map(function (x) {
      return { id: String(x.id), waktu: String(x.waktu), username: String(x.username), nama: String(x.nama), untuk: String(x.untuk), untukNama: String(x.untuk_nama), isi: String(x.isi) };
    });
  },
  apKirim: function (req) {
    const u = auth_(req);
    const isi = String(req.isi || '').trim().slice(0, 500), untuk = String(req.untuk || 'tim');
    if (isi.length < 5) throw new Error('Tulis apresiasinya dulu');
    let untukNama = 'Seluruh tim';
    if (untuk !== 'tim') {
      const t = read_('users').filter(function (x) { return x.username === untuk && x.status === 'aktif'; })[0];
      if (!t) throw new Error('Rekan tidak ditemukan');
      if (untuk === u.username) throw new Error('Pilih rekan lain ya');
      untukNama = t.nama;
    }
    return withLock_(function () {
      append_('apresiasi', { id: Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMddHHmmss') + '-' + u.username, waktu: now_(), username: u.username, nama: u.nama, untuk: untuk, untuk_nama: untukNama, isi: isi, aktif: 'ya' });
      notif_(untuk === 'tim' ? 'semua' : untuk, 'info', 'apresiasi', u.nama + ' mengapresiasi ' + (untuk === 'tim' ? 'tim' : 'kamu'), isi.slice(0, 100), '#/apresiasi');
      return true;
    });
  },
  apHapus: function (req) {
    const u = auth_(req);
    return withLock_(function () {
      const all = read_('apresiasi');
      const x = all.filter(function (r) { return String(r.id) === String(req.id); })[0];
      if (!x || (x.username !== u.username && u.role !== 'admin')) throw new Error('Tidak bisa menghapus');
      x.aktif = 'tidak'; writeAll_('apresiasi', all);
      return true;
    });
  },

  /* ---------- handover dibaca ---------- */
  hoBaca: function (req) {
    const u = auth_(req);
    return withLock_(function () {
      const ada = read_('handover_baca').some(function (x) { return String(x.id) === String(req.id) && x.username === u.username; });
      if (!ada) append_('handover_baca', { id: String(req.id), username: u.username, waktu: now_() });
      return true;
    });
  }
});

/* =====================================================================
 * TAHAP 10: sales RA cara HO (sales dilebur) & Monitoring OmniChannel
 * ===================================================================== */
// Jenis transaksi yang penjualannya dilebur & dibagi rata ke RA toko (cara HO).
const DILEBUR_TIPE = /endless\s*aisle|b2b2g|tour\s*&?\s*travel|wholesale/i;
// [id, label, aturan, % dari target bulanan]
const OMNI_JENIS = [
  ['ea', 'Endless Aisle', function (r) { return /endless\s*aisle/i.test(String(r.tipe)); }, 0.025],
  ['voucher', 'Eigerindo Voucher', function (r) { return String(r.kat4).trim().toUpperCase() === 'VOUCHER'; }, 0.01],
  ['tax', 'Tax Invoice', function (r) { return /b2b2g/i.test(String(r.tipe)); }, 0.01],
  ['easap', 'EASAP', function (r) { return /tour\s*&?\s*travel/i.test(String(r.tipe)); }, 0.01]
];
function sameName_(a, b) {
  const x = normDsr_(a), y = normDsr_(b);
  if (!x || !y) return false;
  if (x === y || x.indexOf(y) === 0 || y.indexOf(x) === 0) return true;
  const wa = x.split(' '), wb = y.split(' ');
  return wa.length > 1 && wb.length > 1 && wa[0] === wb[0] && wa[1] === wb[1];
}
/** Nama-nama Store Leader/admin (tidak dihitung sebagai RA). */
function slNames_() {
  const out = [];
  read_('users').forEach(function (u) {
    if (u.role !== 'admin') return;
    [u.nama_dsr, u.nama_jadwal, u.nama].forEach(function (x) { if (String(x || '').trim()) out.push(String(x).trim()); });
  });
  return out;
}
/** RA toko bulan itu: dari jadwal (tanpa Store Leader); bila jadwal tidak ada, dari penjual Walk In di DSR. */
function raToko_(bulan, rows) {
  const sl = slNames_();
  const isSl = function (n) { return sl.some(function (s) { return sameName_(s, n); }); };
  const dsrNames = {};
  rows.forEach(function (r) {
    if (!isSalesLine_(r) || DILEBUR_TIPE.test(String(r.tipe || ''))) return;
    const sp = String(r.sales_person || '').trim(); if (sp) dsrNames[sp] = 1;
  });
  const D = Object.keys(dsrNames);
  let jad = {};
  try {
    const map = jadwalMap_();
    Object.keys(map).forEach(function (t) {
      if (t.slice(0, 7) !== bulan) return;
      Object.keys(map[t]).forEach(function (nm) { if (String(map[t][nm] || '').trim()) jad[nm] = 1; });
    });
  } catch (e) { jad = {}; }
  const J = Object.keys(jad);
  const base = J.length ? J : D;
  const out = [];
  base.forEach(function (nm) {
    if (isSl(nm) || /^HL\b/i.test(String(nm).trim())) return; // Store Leader & tenaga harian lepas (HL) bukan RA
    const d = D.filter(function (x) { return sameName_(x, nm); })[0];
    const name = d || nm;
    if (out.indexOf(name) < 0) out.push(name);
  });
  return out.sort();
}
/** Sales per RA cara HO. Sales = Walk In atas nama sendiri + bagian rata sales dilebur.
 *  Dilebur = Endless Aisle, B2B2G (Tax Invoice), Tour & Travel (EASAP), Wholesale, dan penjualan
 *  yang bukan atas nama RA toko. UPT/qty/basket hanya dari transaksi sendiri. */
function raHO_(rows, ras) {
  const per = {}; ras.forEach(function (n) { per[n] = { b: 0, n: 0, q: 0, inv: {} }; });
  const dil = { b: 0, n: 0, inv: {}, rinci: {} };
  rows.forEach(function (r) {
    if (!isSalesLine_(r)) return;
    const g = Number(r.gross) || 0, n = Number(r.net) || 0, q = Number(r.qty) || 0;
    const tipe = String(r.tipe || ''), sp = String(r.sales_person || '').trim();
    const owner = ras.filter(function (x) { return sameName_(x, sp); })[0];
    if (DILEBUR_TIPE.test(tipe) || !owner) {
      dil.b += g; dil.n += n; dil.inv[String(r.invoice)] = 1;
      const k = DILEBUR_TIPE.test(tipe) ? tipe : 'Bukan atas nama RA toko';
      const o = dil.rinci[k] || (dil.rinci[k] = { b: 0, n: 0 }); o.b += g; o.n += n;
      return;
    }
    const o = per[owner]; o.b += g; o.n += n; o.q += q; o.inv[String(r.invoice)] = 1;
  });
  const cnt = ras.length || 1;
  const sb = dil.b / cnt, sn = dil.n / cnt;
  return {
    ras: ras,
    dilebur: { b: Math.round(dil.b), n: Math.round(dil.n), trx: Object.keys(dil.inv).length,
      rinci: Object.keys(dil.rinci).map(function (k) { return [k, Math.round(dil.rinci[k].b), Math.round(dil.rinci[k].n)]; }) },
    share: { b: Math.round(sb), n: Math.round(sn) },
    list: ras.map(function (nm) {
      const o = per[nm];
      return { nama: nm, ownB: Math.round(o.b), ownN: Math.round(o.n), b: Math.round(o.b + sb), n: Math.round(o.n + sn), q: o.q, trx: Object.keys(o.inv).length };
    }).sort(function (a, b) { return b.b - a.b; })
  };
}

Object.assign(API, {
  /** Monitoring OmniChannel: actual = gross sales bulan berjalan per jenis. */
  omni: function (req) {
    const u = auth_(req);
    const bulan = /^\d{4}-\d{2}$/.test(String(req.bulan || '')) ? String(req.bulan) : latestDate_().slice(0, 7);
    const act = {}, trx = [];
    OMNI_JENIS.forEach(function (j) { act[j[0]] = 0; });
    read_('dsr').forEach(function (r) {
      if (String(r.tanggal).slice(0, 7) !== bulan) return;
      OMNI_JENIS.forEach(function (j) {
        if (!j[2](r)) return;
        const g = Number(r.gross) || 0;
        act[j[0]] += g;
        trx.push([String(r.tanggal), String(r.invoice), j[1], String(r.sales_person || ''), String(r.nama_sku), Number(r.qty) || 0, Math.round(g)]);
      });
    });
    const tg = {};
    read_('omni_target').forEach(function (x) { if (String(x.bulan) === bulan) tg[String(x.jenis)] = Number(x.target) || 0; });
    const tb = read_('targets').filter(function (x) { return String(x.bulan) === bulan; })[0];
    const tBulan = tb ? Number(tb.target) || 0 : 0;
    return { bulan: bulan, dataSampai: latestDate_(), bulanTersedia: bulanTersedia_(), admin: u.role === 'admin', targetBulan: tBulan,
      jenis: OMNI_JENIS.map(function (j) {
        const auto = Math.round(tBulan * j[3]);
        return { id: j[0], label: j[1], pct: j[3], actual: Math.round(act[j[0]]), target: tg[j[0]] || auto, auto: auto, manual: !!tg[j[0]] };
      }),
      trx: trx.sort(function (a, b) { return a[0] < b[0] ? 1 : -1; }) };
  },
  omniTargetSet: function (req) {
    const a = auth_(req, true);
    const bulan = String(req.bulan || '');
    if (!/^\d{4}-\d{2}$/.test(bulan)) throw new Error('Bulan tidak valid');
    const list = req.list || {};
    return withLock_(function () {
      const keep = read_('omni_target').filter(function (x) { return String(x.bulan) !== bulan; });
      OMNI_JENIS.forEach(function (j) {
        const v = Number(list[j[0]]) || 0;
        if (v > 0) keep.push({ bulan: bulan, jenis: j[0], target: v, diubah: now_(), oleh: a.username });
      });
      writeAll_('omni_target', keep);
      log_(a.username, 'target omnichannel', bulan);
      return true;
    });
  }
});

/* =====================================================================
 * TAHAP 11: DSR otomatis dari email CARE Omni
 * CARE mengirim email "Export ItemDSRReport_….xlsx selesai diproses" berisi link unduhan.
 * Tiap 15 menit Basecamp mengambil file dari link itu, membaca, lalu mengimpornya.
 * ===================================================================== */
const DSR_EMAIL = { FROM: 'noreplyinfo@pos-eigerindo.com', LABEL: 'Basecamp-DSR', LABEL_GAGAL: 'Basecamp-DSR-gagal' };

/** Simpan baris DSR (array sesuai DSR_FIELDS). Dipakai unggah manual & otomatis dari email. */
function simpanDsr_(rows, u, fileName) {
  return withLock_(function () {
    const res = mergeDsr_(read_('dsr'), rows, uploadId_(u.username));
    if (res.changed) {
      writeAll_('dsr', res.all);
      writeAll_('ringkasan', aggregateDaily_(res.all));
      bumpVersion_();
    }
    log_(u.username, 'unggah DSR', res.dari + ' s/d ' + res.sampai + ': ' + res.baru + ' baru, ' + res.diperbarui + ' diperbarui');
    if (u.role !== 'admin') notif_('admin', 'info', 'dsr', u.username === 'email' ? 'DSR otomatis masuk dari email CARE' : 'DSR diunggah oleh ' + u.nama,
      'Data ' + res.dari + ' s/d ' + res.sampai + ' · ' + res.baru + ' invoice baru, ' + res.diperbarui + ' diperbarui', '#/unggah');
    append_('uploads', {
      id: res.id, waktu: now_(), username: u.username, nama_file: String(fileName || '').slice(0, 120),
      dari: res.dari, sampai: res.sampai, baris: rows.length,
      invoice_baru: res.baru, invoice_diperbarui: res.diperbarui, invoice_sama: res.sama
    });
    return { baru: res.baru, diperbarui: res.diperbarui, sama: res.sama, baris: rows.length, dari: res.dari, sampai: res.sampai };
  }, 120000);
}

/** Baca file xlsx → array baris (lewat konversi sementara ke Google Sheet). */
function xlsxAoa_(blob) {
  const boundary = 'bc2299x' + Date.now();
  const meta = { name: 'dsr-tmp-' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' };
  const head = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + boundary + '\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n';
  const tail = '\r\n--' + boundary + '--';
  const payload = Utilities.newBlob(head).getBytes().concat(blob.getBytes()).concat(Utilities.newBlob(tail).getBytes());
  const r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: payload, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  if (r.getResponseCode() !== 200) throw new Error('Gagal membaca file Excel (' + r.getResponseCode() + ')');
  const id = JSON.parse(r.getContentText()).id;
  try {
    const ss = SpreadsheetApp.openById(id), tz = ss.getSpreadsheetTimeZone();
    const sh = ss.getSheets()[0];
    return sh.getDataRange().getValues().map(function (row) {
      return row.map(function (v) { return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss') : v; });
    });
  } finally {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
  }
}

/** Sama dengan DSR.parse di web (assets/dsr.js). */
function parseDsrAoa_(aoa) {
  const HEAD = {
    invoice: 'Invoice No', order_no: 'Order No', date: 'Order Date', status: 'Bill Status', tipe: 'Transaction Type',
    sku: 'SKU Code', nama_sku: 'Sku Name', kat3: 'Category Lv.3', kat4: 'Category Lv.4', brand: 'Brand',
    lokasi: 'Location', qty: 'Quantity', harga: 'Sale Price', sales_person: 'Sales Person', gross: 'Gross Amount',
    promo_value: 'Promotion Value', promo_name: 'Promotion Name', coupon: 'Coupon Value', discount: 'Discount Amount',
    net: 'Net Amount', emp_disc: 'Employee Discount', phone: 'Customer Phone', email: 'Customer Email', cust_name: 'Customer Name'
  };
  const REQ = ['invoice', 'date', 'brand', 'nama_sku', 'qty', 'gross', 'net'];
  const norm = function (x) { return String(x == null ? '' : x).trim().toLowerCase().replace(/\s+/g, ' '); };
  const num = function (x) { if (x == null || x === '') return 0; if (typeof x === 'number') return x; const v = Number(String(x).replace(/,/g, '').trim()); return isNaN(v) ? 0 : v; };
  let hi = -1;
  for (let i = 0; i < Math.min(aoa.length, 50); i++) { const r = (aoa[i] || []).map(norm); if (r.indexOf('invoice no') >= 0 && r.indexOf('order date') >= 0) { hi = i; break; } }
  if (hi < 0) throw new Error('Kolom "Invoice No" dan "Order Date" tidak ditemukan');
  const head = aoa[hi].map(norm), idx = {};
  Object.keys(HEAD).forEach(function (k) { idx[k] = head.indexOf(norm(HEAD[k])); });
  const miss = REQ.filter(function (k) { return idx[k] < 0; });
  if (miss.length) throw new Error('Kolom tidak ada: ' + miss.map(function (k) { return HEAD[k]; }).join(', '));
  let lokasi = '';
  for (let j = 0; j < hi; j++) { const m = String((aoa[j] || [])[0] || '').match(/^\s*Location:\s*(.+)$/i); if (m) lokasi = m[1].replace(/\s+/g, ' ').trim(); }
  const keyCache = {};
  const custKey = function (src) {
    if (!src) return '';
    if (keyCache[src] == null) {
      const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'hub2299|' + src, Utilities.Charset.UTF_8);
      keyCache[src] = b.slice(0, 8).map(function (x) { return ('0' + ((x + 256) % 256).toString(16)).slice(-2); }).join('');
    }
    return keyCache[src];
  };
  const out = [];
  for (let k = hi + 1; k < aoa.length; k++) {
    const row = aoa[k] || [];
    const inv = String(row[idx.invoice] == null ? '' : row[idx.invoice]).trim();
    if (!inv) continue;
    const ds = String(row[idx.date] == null ? '' : row[idx.date]).trim();
    const m = ds.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) continue;
    const g = function (key) { return idx[key] >= 0 ? row[idx[key]] : null; };
    const t = function (key) { const x = g(key); return x == null ? '' : String(x).trim(); };
    if (!lokasi && idx.lokasi >= 0) lokasi = t('lokasi').replace(/\s+/g, ' ');
    const src = [norm(t('cust_name')), norm(t('phone')), norm(t('email'))];
    const o = {
      invoice: inv, order_no: t('order_no'), tanggal: m[1] + '-' + m[2] + '-' + m[3], jam: m[4] != null ? pad_(Number(m[4])) + ':' + m[5] + ':' + (m[6] || '00') : '00:00:00',
      status: t('status'), tipe: t('tipe'), sku: t('sku'), nama_sku: t('nama_sku'), kat3: t('kat3'), kat4: t('kat4'), brand: t('brand'),
      qty: num(g('qty')), harga: num(g('harga')), sales_person: t('sales_person'), gross: num(g('gross')),
      promo_value: num(g('promo_value')), promo_name: t('promo_name'), coupon: num(g('coupon')), discount: num(g('discount')), net: num(g('net')),
      cust_key: custKey(src.join('').length ? src.join('|') : ''), cust_name: t('cust_name'), emp_disc: num(g('emp_disc'))
    };
    out.push(DSR_FIELDS.map(function (f) { return o[f] == null ? '' : o[f]; }));
  }
  return { lokasi: lokasi, rows: out };
}

function labelOf_(name) { return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name); }

/** Dijalankan tiap 15 menit oleh pemicu waktu. */
function cekEmailDsr() {
  const lab = labelOf_(DSR_EMAIL.LABEL), labGagal = labelOf_(DSR_EMAIL.LABEL_GAGAL);
  const threads = GmailApp.search('from:' + DSR_EMAIL.FROM + ' -label:' + DSR_EMAIL.LABEL + ' -label:' + DSR_EMAIL.LABEL_GAGAL + ' newer_than:3d', 0, 30);
  const msgs = [];
  threads.forEach(function (th) {
    th.getMessages().forEach(function (m) { if (/ItemDSRReport/i.test(m.getSubject())) msgs.push({ th: th, m: m }); });
  });
  msgs.sort(function (a, b) { return a.m.getDate() - b.m.getDate(); });
  const bot = { username: 'email', nama: 'Email CARE', role: 'sistem' };
  const hasil = [];
  // email yang lebih lama dari unggahan manual terakhir dilewati, supaya tidak menimpa data yang lebih baru
  let manualTerakhir = '';
  read_('uploads').forEach(function (u) { if (u.username !== 'email' && String(u.waktu) > manualTerakhir) manualTerakhir = String(u.waktu); });
  msgs.forEach(function (x) {
    const tglEmail = Utilities.formatDate(x.m.getDate(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss');
    if (manualTerakhir && tglEmail < manualTerakhir) { x.th.addLabel(lab); hasil.push('Dilewati (sudah ada unggahan manual lebih baru): ' + x.m.getSubject()); return; }
    const body = x.m.getBody() + ' ' + x.m.getPlainBody();
    const mm = body.match(/https:\/\/[A-Za-z0-9.\-]+\/export\/(ItemDSRReport_[A-Za-z0-9_\-]+\.xlsx)/);
    try {
      if (!mm) throw new Error('Link unduhan tidak ditemukan di email');
      const r = UrlFetchApp.fetch(mm[0], { muteHttpExceptions: true, followRedirects: true });
      if (r.getResponseCode() !== 200) throw new Error('File tidak bisa diunduh (' + r.getResponseCode() + ')');
      const p = parseDsrAoa_(xlsxAoa_(r.getBlob()));
      if (p.lokasi && p.lokasi.indexOf(CFG.STORE) < 0) throw new Error('Bukan DSR toko ' + CFG.STORE + ' (' + p.lokasi + ')');
      if (!p.rows.length) throw new Error('File tidak berisi transaksi');
      const res = simpanDsr_(p.rows, bot, mm[1]);
      x.th.addLabel(lab);
      hasil.push(mm[1] + ': ' + res.dari + ' s/d ' + res.sampai + ', ' + res.baru + ' baru, ' + res.diperbarui + ' diperbarui');
    } catch (e) {
      x.th.addLabel(labGagal);
      withLock_(function () { notif_('admin', 'cek', 'dsr', 'DSR otomatis dari email gagal', (mm ? mm[1] + ': ' : '') + String(e.message || e).slice(0, 180), '#/unggah'); });
      hasil.push('GAGAL ' + (mm ? mm[1] : '') + ': ' + (e.message || e));
    }
  });
  Logger.log(hasil.join('\n') || 'Tidak ada email DSR baru');
  try { pushTick_(); } catch (e) { Logger.log('push: ' + e); }
  return hasil;
}

/** Jalankan sekali dari editor: minta izin Gmail & pasang pemicu tiap 15 menit. */
function pasangDsrEmail() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'cekEmailDsr') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cekEmailDsr').timeBased().everyMinutes(15).create();
  const h = cekEmailDsr();
  Logger.log('Pemicu DSR email terpasang. ' + (h.length ? h.join(' | ') : ''));
  return 'ok';
}

/* =====================================================================
 * TAHAP 12: notifikasi push ke HP (Web Push + VAPID, tanpa Firebase)
 * Push dikirim tanpa isi; HP lalu mengambil isi notifikasi dari API (aman, tanpa enkripsi payload).
 * ===================================================================== */
/* ---------- ECDSA P-256 (ES256) murni JS untuk VAPID Web Push ---------- */
const EC_ = (function () {
  const _B0 = BigInt(0), _B1 = BigInt(1), _B2 = BigInt(2), _B3 = BigInt(3), _B4 = BigInt(4), _B8 = BigInt(8);
  const P = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
  const N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  const A = P - _B3;
  const G = [BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'), BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')];
  const mod = function (a, m) { const r = a % m; return r >= _B0 ? r : r + m; };
  const inv = function (a, m) { let t = _B0, nt = _B1, r = m, nr = mod(a, m); while (nr) { const q = r / nr; [t, nt] = [nt, t - q * nt]; [r, nr] = [nr, r - q * nr]; } return mod(t, m); };
  // titik Jacobian [X,Y,Z]
  const dbl = function (p) {
    if (!p[2]) return p;
    const [X, Y, Z] = p;
    const YY = mod(Y * Y, P), S = mod(_B4 * X * YY, P), ZZ = mod(Z * Z, P);
    const M = mod(_B3 * X * X + A * ZZ * ZZ, P);
    const X3 = mod(M * M - _B2 * S, P);
    return [X3, mod(M * (S - X3) - _B8 * YY * YY, P), mod(_B2 * Y * Z, P)];
  };
  const add = function (p, q) {
    if (!p[2]) return q; if (!q[2]) return p;
    const Z1Z1 = mod(p[2] * p[2], P), Z2Z2 = mod(q[2] * q[2], P);
    const U1 = mod(p[0] * Z2Z2, P), U2 = mod(q[0] * Z1Z1, P);
    const S1 = mod(p[1] * q[2] * Z2Z2, P), S2 = mod(q[1] * p[2] * Z1Z1, P);
    if (U1 === U2) return S1 === S2 ? dbl(p) : [_B0, _B1, _B0];
    const H = mod(U2 - U1, P), R = mod(S2 - S1, P), HH = mod(H * H, P), HHH = mod(H * HH, P), V = mod(U1 * HH, P);
    const X3 = mod(R * R - HHH - _B2 * V, P);
    return [X3, mod(R * (V - X3) - S1 * HHH, P), mod(p[2] * q[2] * H, P)];
  };
  const mul = function (k, pt) {
    let r = [_B0, _B1, _B0], q = [pt[0], pt[1], _B1];
    while (k > _B0) { if (k & _B1) r = add(r, q); q = dbl(q); k >>= _B1; }
    const zi = inv(r[2], P), zi2 = mod(zi * zi, P);
    return [mod(r[0] * zi2, P), mod(r[1] * zi2 * zi, P)];
  };
  const toHex = function (n, len) { let h = n.toString(16); while (h.length < len * 2) h = '0' + h; return h; };
  const hexToBytes = function (h) { const out = []; for (let i = 0; i < h.length; i += 2) { const v = parseInt(h.substr(i, 2), 16); out.push(v > 127 ? v - 256 : v); } return out; };
  const bytesToHex = function (b) { return b.map(function (x) { return ('0' + ((x + 256) % 256).toString(16)).slice(-2); }).join(''); };
  return {
    N: N,
    /** kunci baru: {d: hex32, pub: hex65 (04|X|Y)} */
    keygen: function (randHex) {
      let d = mod(BigInt('0x' + randHex), N - _B1) + _B1;
      const Q = mul(d, G);
      return { d: toHex(d, 32), pub: '04' + toHex(Q[0], 32) + toHex(Q[1], 32) };
    },
    /** tanda tangan hash (hex32) → hex64 r||s. randHex: angka acak 32 byte hex */
    sign: function (hashHex, dHex, randHex) {
      const z = BigInt('0x' + hashHex), d = BigInt('0x' + dHex);
      for (let i = 0; i < 8; i++) {
        const k = mod(BigInt('0x' + randHex) + BigInt(i), N - _B1) + _B1;
        const R = mul(k, G), r = mod(R[0], N);
        if (!r) continue;
        let s = mod(inv(k, N) * (z + r * d), N);
        if (!s) continue;
        if (s > N / _B2) s = N - s;
        return toHex(r, 32) + toHex(s, 32);
      }
      throw new Error('ECDSA gagal');
    },
    hexToBytes: hexToBytes, bytesToHex: bytesToHex
  };
})();

function b64u_(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
function randHex_() { return EC_.bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now() + Math.random())); }
/** Kunci VAPID dibuat sekali oleh server & disimpan di Script Properties. */
function vapid_() {
  const p = PropertiesService.getScriptProperties();
  let d = p.getProperty('VAPID_D'), pub = p.getProperty('VAPID_PUB');
  if (!d || !pub) { const k = EC_.keygen(randHex_()); d = k.d; pub = k.pub; p.setProperties({ VAPID_D: d, VAPID_PUB: pub }); }
  return { d: d, pub: pub, pubB64: b64u_(EC_.hexToBytes(pub)) };
}
function vapidJwt_(aud) {
  const v = vapid_();
  const enc = function (o) { return b64u_(Utilities.newBlob(JSON.stringify(o)).getBytes()); };
  const input = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://alishobrun.github.io/hub-toko-2299/' });
  const h = EC_.bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8));
  return { jwt: input + '.' + b64u_(EC_.hexToBytes(EC_.sign(h, v.d, randHex_()))), k: v.pubB64 };
}
/** Kirim satu push kosong. true = terkirim, false = langganan sudah tidak berlaku. */
function kirimPush_(endpoint) {
  const aud = endpoint.match(/^https:\/\/[^/]+/)[0];
  const t = vapidJwt_(aud);
  const r = UrlFetchApp.fetch(endpoint, { method: 'post', muteHttpExceptions: true, payload: '',
    headers: { Authorization: 'vapid t=' + t.jwt + ', k=' + t.k, TTL: '86400', Urgency: 'high' } });
  const c = r.getResponseCode();
  if (c === 404 || c === 410) return false;
  if (c >= 400) throw new Error('Push ' + c + ': ' + r.getContentText().slice(0, 120));
  return true;
}
function idsNotif_(u) {
  const n = notifFor_(u);
  return n.items.filter(function (x) { return x.live || (!x.dibaca); }).map(function (x) { return x.id; });
}
/** Tiap 15 menit: kirim push ke user yang punya notifikasi baru sejak push terakhir. */
function pushTick_() {
  const subs = read_('push_sub');
  if (!subs.length) return;
  const p = PropertiesService.getScriptProperties();
  const users = {}; read_('users').forEach(function (x) { if (x.status === 'aktif') users[x.username] = x; });
  const byUser = {}; subs.forEach(function (s) { (byUser[s.username] = byUser[s.username] || []).push(s); });
  const mati = {};
  Object.keys(byUser).forEach(function (un) { pushUser_(users[un], byUser[un], p, mati); });
  buangLangganan_(mati);
  p.setProperty('push_tick', now_());
}
function pushUser_(u, subs, p, mati) {
  if (!u || !subs || !subs.length) return;
  let ids; try { ids = idsNotif_(u); } catch (e) { return; }
  const key = 'push_seen_' + u.username;
  const seen = JSON.parse(p.getProperty(key) || '[]');
  const baru = ids.filter(function (id) { return seen.indexOf(id) < 0; });
  p.setProperty(key, JSON.stringify(ids.slice(0, 150)));
  if (!baru.length) return;
  subs.forEach(function (s) {
    try { if (!kirimPush_(String(s.endpoint))) mati[s.endpoint] = 1; } catch (e) { Logger.log(e); }
  });
}
function buangLangganan_(mati) {
  if (!Object.keys(mati).length) return;
  writeAll_('push_sub', read_('push_sub').filter(function (s) { return !mati[s.endpoint]; }));
}
/** Kirim push sekarang untuk target: 'admin', 'semua', atau username. */
function pushUntuk_(targets) {
  const subs = read_('push_sub');
  if (!subs.length) return;
  const users = {}; read_('users').forEach(function (x) { if (x.status === 'aktif') users[x.username] = x; });
  const byUser = {}; subs.forEach(function (s) { (byUser[s.username] = byUser[s.username] || []).push(s); });
  const pilih = {};
  targets.forEach(function (t) {
    Object.keys(byUser).forEach(function (un) {
      const u = users[un]; if (!u) return;
      if (t === 'semua' || t === un || (t === 'admin' && u.role === 'admin')) pilih[un] = 1;
    });
  });
  const p = PropertiesService.getScriptProperties(), mati = {};
  Object.keys(pilih).forEach(function (un) { pushUser_(users[un], byUser[un], p, mati); });
  buangLangganan_(mati);
}

Object.assign(API, {
  pushKunci: function (req) { auth_(req); return { pub: vapid_().pubB64 }; },
  pushDaftar: function (req) {
    const u = auth_(req);
    const sub = req.sub || {};
    const ep = String(sub.endpoint || '');
    if (!/^https:\/\//.test(ep)) throw new Error('Langganan notifikasi tidak valid');
    return withLock_(function () {
      const all = read_('push_sub').filter(function (s) { return s.endpoint !== ep; });
      all.push({ username: u.username, endpoint: ep, p256dh: String((sub.keys || {}).p256dh || ''), auth: String((sub.keys || {}).auth || ''),
        ua: String(req.ua || '').slice(0, 120), dibuat: now_(), terakhir: now_() });
      writeAll_('push_sub', all);
      // tandai notifikasi yang sudah ada supaya tidak dikirim ulang
      try { PropertiesService.getScriptProperties().setProperty('push_seen_' + u.username, JSON.stringify(idsNotif_(u).slice(0, 150))); } catch (e) {}
      return { perangkat: all.filter(function (s) { return s.username === u.username; }).length };
    });
  },
  pushHapus: function (req) {
    const u = auth_(req);
    const ep = String(req.endpoint || '');
    return withLock_(function () {
      writeAll_('push_sub', read_('push_sub').filter(function (s) { return !(s.endpoint === ep && s.username === u.username); }));
      return true;
    });
  },
  pushStatus: function (req) {
    const u = auth_(req);
    return { perangkat: read_('push_sub').filter(function (s) { return s.username === u.username; }).map(function (s) { return { ua: String(s.ua), dibuat: String(s.dibuat), ep: String(s.endpoint).slice(-12) }; }) };
  },
  /** Kirim push percobaan ke perangkat sendiri. */
  pushTes: function (req) {
    const u = auth_(req);
    const subs = read_('push_sub').filter(function (s) { return s.username === u.username; });
    if (!subs.length) throw new Error('Belum ada perangkat yang mengaktifkan notifikasi');
    withLock_(function () { notif_(u.username, 'info', 'info', 'Tes notifikasi Basecamp 2299', 'Notifikasi di HP sudah aktif 👍', '#/akun'); });
    let ok = 0; const galat = [];
    subs.forEach(function (s) { try { if (kirimPush_(String(s.endpoint))) ok++; else galat.push('langganan kedaluwarsa'); } catch (e) { galat.push(String(e.message || e)); } });
    try { PropertiesService.getScriptProperties().setProperty('push_seen_' + u.username, JSON.stringify(idsNotif_(u).slice(0, 150))); } catch (e) {}
    return { terkirim: ok, perangkat: subs.length, galat: galat };
  }
});

/* ---------- penerima push segera ---------- */
var PUSH_SEGERA = {};
const PUSH_SEGERA_AKSI = {
  reqCreate: function () { return ['admin']; },
  register: function () { return ['admin']; },
  tukarCreate: function (req) { return [cleanUser_(req.rekan)]; },
  tukarRespond: function (req) { return req.terima ? ['admin'] : []; },
  pengSave: function (req) { return req.penting ? ['semua'] : []; }
};

/* =====================================================================
 * TAHAP 13: halaman Kesehatan Data (admin)
 * ===================================================================== */
Object.assign(API, {
  kesehatan: function (req) {
    auth_(req, true);
    const today = today_(), p = PropertiesService.getScriptProperties();
    const lag = function (d) { return d ? Math.round((Date.parse(today) - Date.parse(String(d).slice(0, 10))) / 864e5) : null; };
    const out = [];
    const add = function (grup, nama, status, nilai, ket, link) { out.push({ grup: grup, nama: nama, status: status, nilai: nilai, ket: ket || '', link: link || '' }); };
    // DSR
    const latest = latestDate_(), up = read_('uploads'), lu = up[up.length - 1];
    const dL = lag(latest);
    add('Data penjualan', 'DSR sampai tanggal', dL == null ? 'bad' : dL <= 1 ? 'ok' : dL <= 2 ? 'warn' : 'bad', latest ? tglPendek_(latest) : 'belum ada',
      dL == null ? '' : dL <= 1 ? 'sudah terbaru' : 'tertinggal ' + dL + ' hari', '#/unggah');
    if (lu) add('Data penjualan', 'Unggahan DSR terakhir', 'ok', String(lu.waktu).slice(0, 16).replace(' ', ' · '), (lu.username === 'email' ? 'otomatis dari email CARE' : 'manual oleh ' + namaUser_(lu.username)) + ' · ' + String(lu.nama_file || '').slice(0, 40), '#/unggah');
    // email CARE
    try {
      const gagal = GmailApp.search('label:' + DSR_EMAIL.LABEL_GAGAL + ' newer_than:7d', 0, 10);
      const sukses = GmailApp.search('label:' + DSR_EMAIL.LABEL + ' newer_than:7d', 0, 50);
      add('Data penjualan', 'DSR otomatis dari email (7 hari)', gagal.length ? 'bad' : 'ok', sukses.length + ' diproses · ' + gagal.length + ' gagal',
        gagal.length ? 'Gagal: ' + gagal.slice(0, 3).map(function (t) { return t.getFirstMessageSubject().replace(/^Export\s+|\s+selesai diproses$/g, ''); }).join(', ') : 'tidak ada yang gagal');
    } catch (e) { add('Data penjualan', 'DSR otomatis dari email', 'warn', 'tidak bisa dicek', String(e.message || e).slice(0, 80)); }
    // target & traffic
    const bulan = today.slice(0, 7);
    const tg = read_('targets').filter(function (x) { return String(x.bulan) === bulan; })[0];
    add('Data penjualan', 'Target bulan ini', tg ? 'ok' : 'bad', tg ? 'Rp ' + rupiah_(Number(tg.target)) : 'belum ada', tg ? 'dari sheet Target Jateng 01' : 'cek sheet Target Jateng 01', '#/monitoring');
    const tr = read_('traffic').filter(function (x) { return x.traffic !== ''; }).map(function (x) { return String(x.tanggal); }).sort().pop();
    const tL = lag(tr);
    add('Data penjualan', 'Traffic pengunjung sampai', tL == null ? 'warn' : tL <= 1 ? 'ok' : 'warn', tr ? tglPendek_(tr) : 'belum ada', tL > 1 ? 'tertinggal ' + tL + ' hari' : '');
    // stok
    const bu = read_('bin_upload'), lb = bu[bu.length - 1];
    const bL = lb ? lag(lb.waktu) : null;
    add('Stok', 'By Bin terakhir', bL == null ? 'bad' : bL === 0 ? 'ok' : bL <= 2 ? 'warn' : 'bad', lb ? String(lb.waktu).slice(0, 16) : 'belum ada',
      lb ? namaUser_(lb.username) + ' · ' + rupiah_(Number(lb.sku)) + ' SKU' + (bL ? ' · ' + bL + ' hari lalu' : ' · hari ini') : '', '#/unggahbin');
    const ml = prop_('master_loaded'), me = prop_('master_error'), mp = prop_('master_pending');
    const mBulan = ml && ml.folder ? String(ml.folder) : '';
    const blnNow = Number(bulan.slice(5));
    const mOk = ml && Number((mBulan.match(/^(\d{1,2})_/) || [])[1]) === blnNow;
    add('Stok', 'Master artikel', me ? 'bad' : mOk ? 'ok' : 'warn', ml ? ml.nama : 'belum dimuat',
      me ? 'Galat: ' + String(me.pesan || me).slice(0, 80) : mp ? 'Ada file baru menunggu dimuat' : mOk ? 'master bulan ini' : 'belum master bulan ini', '#/unggahbin');
    // jadwal
    try {
      const jm = jadwalMap_()[today];
      add('Tim', 'Jadwal hari ini', jm ? 'ok' : 'bad', jm ? Object.keys(jm).length + ' orang' : 'tidak ada', jm ? '' : 'tab jadwal periode ini belum ada di sheet', '#/jadwal');
    } catch (e) { add('Tim', 'Jadwal hari ini', 'bad', 'tidak bisa dibaca', String(e.message || e).slice(0, 80)); }
    // video
    const upOk = !!(p.getProperty('UPLOAD_URL') && p.getProperty('UPLOAD_SECRET'));
    add('Tim', 'Mesin upload video', upOk ? 'ok' : 'bad', upOk ? 'tersambung' : 'belum tersambung', '', '#/dokumentasi');
    // otomatisasi
    const trg = {}; ScriptApp.getProjectTriggers().forEach(function (t) { trg[t.getHandlerFunction()] = 1; });
    [['catatTraffic', 'Pengecekan tiap jam (traffic, pengingat video, feedback)'], ['cekEmailDsr', 'Pengecekan tiap 15 menit (DSR email & notifikasi HP)'], ['cadangan', 'Cadangan data mingguan']].forEach(function (x) {
      add('Otomatisasi', x[1], trg[x[0]] ? 'ok' : 'bad', trg[x[0]] ? 'aktif' : 'tidak aktif', trg[x[0]] ? '' : 'pemicu ' + x[0] + ' belum terpasang');
    });
    const pt = p.getProperty('push_tick');
    add('Otomatisasi', 'Notifikasi HP terakhir dicek', pt ? 'ok' : 'warn', pt ? pt.slice(0, 16) : 'belum pernah', '');
    try {
      const it = DriveApp.getFoldersByName(CFG.BACKUP_FOLDER);
      let last = null;
      if (it.hasNext()) { const fi = it.next().getFiles(); while (fi.hasNext()) { const f = fi.next(); if (f.getName().indexOf('Cadangan DB Hub 2299') === 0 && (!last || f.getDateCreated() > last)) last = f.getDateCreated(); } }
      const cL = last ? Math.round((Date.now() - last.getTime()) / 864e5) : null;
      add('Otomatisasi', 'Cadangan data terakhir', cL == null ? 'bad' : cL <= 8 ? 'ok' : 'warn', last ? Utilities.formatDate(last, CFG.TZ, 'yyyy-MM-dd HH:mm') : 'belum ada', cL != null ? cL + ' hari lalu' : '');
    } catch (e) {}
    // notifikasi HP per orang
    const subs = read_('push_sub'), dev = {};
    subs.forEach(function (s) { dev[s.username] = (dev[s.username] || 0) + 1; });
    const tim = read_('users').filter(function (x) { return x.status === 'aktif'; }).map(function (x) { return { nama: x.nama, username: x.username, perangkat: dev[x.username] || 0 }; });
    return { waktu: now_(), cek: out, tim: tim };
  }
});

/* ===================== Penyusun jadwal ===================== */
/**
 * Penyusun draf jadwal (simulated annealing di seluruh tabel).
 * inp = {
 *   tanggal: ['yyyy-MM-dd'...], dow: [0..6] (0 = Minggu),
 *   nama: ['YERIKO ...', ...], admin: indeks Store Leader (-1 bila tidak ada),
 *   prev: { nama: [kode periode lalu...] }, tetap: { nama: { idx: kode } },
 *   jatahOff: { nama: n }, ramai: [0..1 per tanggal] (1 = paling ramai), seed
 * }
 */
const JD_REST = { OFF: 1, CT: 1 };
const JD_MID = { MD: 1, MC: 1 };
const JD_H = 1000;

function jdRng_(seed) {
  let s = (seed >>> 0) || 1;
  return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function jdPrep_(inp) {
  const N = inp.nama.length, T = inp.tanggal.length;
  const tail = [], last = [], fixed = [];
  for (let p = 0; p < N; p++) {
    const pv = (inp.prev && inp.prev[inp.nama[p]]) || [];
    let n = 0;
    for (let i = pv.length - 1; i >= 0; i--) { if (JD_REST[pv[i]] || !pv[i]) break; n++; }
    tail.push(n);
    last.push(pv.length ? pv[pv.length - 1] : '');
    const f = [];
    const tp = (inp.tetap && inp.tetap[inp.nama[p]]) || {};
    for (let t = 0; t < T; t++) f.push(tp[t] != null ? tp[t] : (tp[String(t)] != null ? tp[String(t)] : null));
    fixed.push(f);
  }
  const wkend = inp.dow.map(function (d) { return d === 0 || d === 6; });
  const jatah = inp.nama.map(function (n) { return inp.jatahOff && inp.jatahOff[n] != null ? inp.jatahOff[n] : 4; });
  return { N: N, T: T, tail: tail, last: last, fixed: fixed, wkend: wkend, jatah: jatah, dow: inp.dow, admin: inp.admin, ramai: inp.ramai };
}

/** Biaya total + (opsional) daftar catatan. */
function jdCost_(G, P, notes) {
  const N = P.N, T = P.T;
  let c = 0;
  const add = function (v, p, t, msg, lvl) { c += v; if (notes && msg) notes.push({ p: p, t: t, msg: msg, lvl: lvl || 'merah' }); };
  // per hari
  for (let t = 0; t < T; t++) {
    let pd = 0, sb = 0, mid = 0, w = 0, midP = -1;
    for (let p = 0; p < N; p++) {
      const x = G[p][t];
      if (JD_REST[x]) continue;
      w++;
      if (x === 'PD') pd++; else if (x === 'SB') sb++; else if (JD_MID[x]) { mid++; midP = p; }
    }
    if (pd < 2) add(JD_H * (2 - pd), -1, t, 'Shift pagi kurang dari 2 orang');
    if (sb < 2) add(JD_H * (2 - sb), -1, t, 'Shift siang kurang dari 2 orang');
    if (w >= 5 && mid !== 1) add(200, -1, t, w + ' orang masuk tetapi ' + (mid ? mid + ' orang middle' : 'tidak ada MC/MD'), 'kuning');
    if (w <= 4 && mid > 0) add(150, -1, t, 'Middle dipakai saat hanya ' + w + ' orang', 'kuning');
    if (P.wkend[t]) { if (w < 5) add(40, -1, t, null); if (mid && midP !== P.admin && P.admin >= 0 && !JD_REST[G[P.admin][t]]) add(10, -1, t, null); }
    else if (w >= 5) add(6 + 30 * (1 - (P.ramai[t] || 0)), -1, t, null);
  }
  // per orang
  const midCnt = [];
  for (let p = 0; p < N; p++) {
    const g = G[p], f = P.fixed[p];
    let off = 0, run = P.tail[p], wkOff = 0, mids = 0;
    for (let t = 0; t < T; t++) {
      const x = g[t];
      const prevX = t > 0 ? g[t - 1] : P.last[p];
      const nextX = t < T - 1 ? g[t + 1] : null;
      if (x === 'OFF') off++;
      if (JD_MID[x]) mids++;
      if (JD_REST[x]) {
        run = 0;
        // H-1 harus PD
        if (prevX && !JD_REST[prevX] && prevX !== 'PD' && !(t > 0 && f[t - 1])) add(JD_H, p, t > 0 ? t - 1 : t, t > 0 ? 'Sehari sebelum ' + x + ' bukan PD' : x + ' di hari pertama, padahal shift terakhir periode lalu bukan PD');
        if (x === 'OFF' && t < T - 1 && nextX === 'OFF' && !f[t] && !f[t + 1]) add(30, p, t, null);
        if (p === P.admin && P.dow[t] === 1 && !f[t]) add(JD_H, p, t, 'Store Leader libur di hari Senin (seharusnya PD)');
        if (x === 'OFF' && P.wkend[t] && !f[t]) {
          if (p === P.admin) add(JD_H, p, t, 'Store Leader OFF di weekend');
          else { wkOff++; add(60, p, t, 'OFF di weekend', 'kuning'); }
        }
      } else {
        run++;
        if (run > 6) add(100 * (run - 6) * (run - 6), p, t, 'Hari kerja ke-' + run + ' berturut-turut', run === 7 ? 'kuning' : 'merah');
        // H+1 tidak boleh PD
        if (x === 'PD' && prevX && JD_REST[prevX] && !f[t]) add(JD_H, p, t, 'PD sehari setelah ' + prevX);
        if (x === 'PD' && prevX === 'SB') add(8, p, t, null);
        if (p === P.admin && P.dow[t] === 1 && x !== 'PD' && !f[t]) add(JD_H, p, t, 'Store Leader bukan PD di hari Senin');
        if (p === P.admin && JD_MID[x] && !P.wkend[t]) add(4, p, t, null);
      }
    }
    if (run > 4) add(20 * (run - 4), p, -1, null);
    if (off !== P.jatah[p]) add(JD_H * Math.abs(off - P.jatah[p]), p, -1, 'Jumlah OFF ' + off + ' (seharusnya ' + P.jatah[p] + ')');
    if (wkOff > 1) add(400 * (wkOff - 1), p, -1, 'OFF weekend ' + wkOff + '× dalam satu periode');
    // keseimbangan PD/SB per minggu
    for (let s = 0; s < T; s += 7) {
      let a = 0, b = 0;
      for (let t = s; t < Math.min(T, s + 7); t++) { if (g[t] === 'PD') a++; else if (g[t] === 'SB') b++; }
      const d = Math.abs(a - b); if (d > 1) add(3 * (d - 1), p, -1, null);
    }
    let tpd = 0, tsb = 0; g.forEach(function (x) { if (x === 'PD') tpd++; else if (x === 'SB') tsb++; });
    if (Math.abs(tpd - tsb) > 2) add(4 * (Math.abs(tpd - tsb) - 2), p, -1, null);
    if (p !== P.admin) midCnt.push(mids);
  }
  if (midCnt.length) {
    const m = midCnt.reduce(function (a, b) { return a + b; }, 0) / midCnt.length;
    midCnt.forEach(function (x) { c += 4 * (x - m) * (x - m); });
  }
  return c;
}

/* ---- tahap 1: letak OFF ---- */
function jdForced_(P, R, p, t) {
  // bit 1 = wajib PD, bit 2 = tidak boleh PD, 3 = bentrok, 6 = middle tetap (bukan PD/SB)
  const f = P.fixed[p][t];
  if (f) return f === 'PD' ? 1 : f === 'SB' ? 2 : 6;
  const prevRest = t > 0 ? R[p][t - 1] : !!JD_REST[P.last[p]];
  const nextRest = t < P.T - 1 ? R[p][t + 1] : false;
  let m = 0;
  if (nextRest) m |= 1;
  if (p === P.admin && P.dow[t] === 1) m |= 1;
  if (prevRest) m |= 2;
  return m;
}
function jdOffCost_(R, P) {
  const N = P.N, T = P.T;
  let c = 0;
  for (let t = 0; t < T; t++) {
    let w = 0, fPD = 0, fNo = 0, fMid = 0, bentrok = 0;
    for (let p = 0; p < N; p++) {
      if (R[p][t]) continue;
      w++;
      const m = jdForced_(P, R, p, t);
      if (m === 3) bentrok++; else if (m === 1) fPD++; else if (m === 2) fNo++; else if (m === 6) fMid++;
    }
    if (w - fMid < 4) c += JD_H * (4 - w + fMid);
    c += JD_H * bentrok;
    if (w - fNo - fMid - bentrok < 2) c += JD_H;   // tidak cukup orang untuk PD
    if (w - fPD - fMid - bentrok < 2) c += JD_H;   // tidak cukup orang untuk SB
    if (fMid > 1) c += 200;
    if (w >= 5 && fPD > w - 3) c += 200;           // 5 orang tapi tidak bisa ada middle
    if (w <= 4 && fMid) c += 150;
    if (P.wkend[t]) { if (w < 5) c += 40; }
    else if (w >= 5) c += 6 + 30 * (1 - (P.ramai[t] || 0));
  }
  for (let p = 0; p < N; p++) {
    const r = R[p], f = P.fixed[p];
    let run = P.tail[p], wkOff = 0;
    for (let t = 0; t < T; t++) {
      if (r[t]) {
        run = 0;
        if (!f[t]) {
          if (t === 0 && P.last[p] && !JD_REST[P.last[p]] && P.last[p] !== 'PD') c += JD_H;
          if (P.wkend[t]) { if (p === P.admin) c += JD_H; else { wkOff++; c += 60; } }
          if (p === P.admin && P.dow[t] === 1) c += JD_H;
          if (t < T - 1 && r[t + 1] && !f[t + 1]) c += 30;
        }
      } else { run++; if (run > 6) c += 100 * (run - 6) * (run - 6); }
    }
    if (run > 4) c += 20 * (run - 4); // jangan wariskan rangkaian panjang ke periode berikutnya
    if (wkOff > 1) c += 400 * (wkOff - 1);
  }
  return c;
}
function jdOffAnneal_(P, rnd, iters) {
  const N = P.N, T = P.T;
  const R = [], offs = [], need = [];
  for (let p = 0; p < N; p++) {
    const r = [];
    let fixedOff = 0;
    for (let t = 0; t < T; t++) { const f = P.fixed[p][t]; r.push(!!(f && JD_REST[f])); if (f === 'OFF') fixedOff++; }
    R.push(r); offs.push([]); need.push(Math.max(0, P.jatah[p] - fixedOff));
  }
  // awal: yang rangkaian kerjanya paling panjang dapat OFF paling awal, sisanya berjarak rata
  const used = []; for (let t = 0; t < T; t++) used.push(0);
  for (let p = 0; p < N; p++) for (let t = 0; t < T; t++) if (R[p][t]) used[t]++;
  const ord = []; for (let p = 0; p < N; p++) ord.push(p);
  ord.sort(function (a, b) { return P.tail[b] - P.tail[a] + (rnd() - 0.5) * 0.5; });
  const okDay = function (p, t) {
    if (P.fixed[p][t] || R[p][t] || P.wkend[t]) return false;
    if (p === P.admin && P.dow[t] === 1) return false;
    if (t === 0 && P.last[p] && !JD_REST[P.last[p]] && P.last[p] !== 'PD') return false;
    return true;
  };
  ord.forEach(function (p) {
    let pos = Math.max(0, 6 - P.tail[p]);
    while (need[p] > 0) {
      let t = -1;
      for (let d = 0; d < T; d++) {
        const cand = [pos - d, pos + d];
        for (let k = 0; k < 2; k++) { const x = cand[k]; if (x >= 0 && x < T && okDay(p, x) && used[x] === 0) { t = x; break; } }
        if (t >= 0) break;
      }
      if (t < 0) for (let x = 0; x < T; x++) if (okDay(p, x)) { t = x; break; }
      if (t < 0) break;
      R[p][t] = true; offs[p].push(t); used[t]++; need[p]--;
      pos = t + 7;
    }
  });
  let c = jdOffCost_(R, P), best = c, bestR = R.map(function (x) { return x.slice(); });
  let Tmp = 80;
  const people = []; for (let p = 0; p < N; p++) if (offs[p].length) people.push(p);
  if (!people.length) return bestR;
  for (let it = 0; it < iters; it++) {
    const p = people[Math.floor(rnd() * people.length)];
    const k = Math.floor(rnd() * offs[p].length), from = offs[p][k];
    if (rnd() < 0.25) { // tukar hari OFF dengan orang lain
      const q = people[Math.floor(rnd() * people.length)];
      if (q === p) continue;
      const kq = Math.floor(rnd() * offs[q].length), b = offs[q][kq];
      if (b === from || R[p][b] || R[q][from] || P.fixed[p][b] || P.fixed[q][from]) continue;
      R[p][from] = false; R[p][b] = true; R[q][b] = false; R[q][from] = true; offs[p][k] = b; offs[q][kq] = from;
      const c3 = jdOffCost_(R, P);
      if (c3 <= c || rnd() < Math.exp((c - c3) / Tmp)) {
        c = c3;
        if (c < best) { best = c; bestR = R.map(function (x) { return x.slice(); }); }
      } else { R[p][b] = false; R[p][from] = true; R[q][from] = false; R[q][b] = true; offs[p][k] = from; offs[q][kq] = b; }
      Tmp = Math.max(0.5, Tmp * 0.9998);
      continue;
    }
    let to;
    if (rnd() < 0.5) to = from + (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 3)); else to = Math.floor(rnd() * T);
    if (to < 0 || to >= T || R[p][to] || P.fixed[p][to]) continue;
    R[p][from] = false; R[p][to] = true; offs[p][k] = to;
    const c2 = jdOffCost_(R, P);
    if (c2 <= c || rnd() < Math.exp((c - c2) / Tmp)) {
      c = c2;
      if (c < best) { best = c; bestR = R.map(function (x) { return x.slice(); }); }
    } else { R[p][to] = false; R[p][from] = true; offs[p][k] = from; }
    Tmp = Math.max(0.5, Tmp * 0.9998);
  }
  return bestR;
}

/* ---- tahap 2: shift per hari ---- */
function jdShifts_(P, R, rnd) {
  const N = P.N, T = P.T;
  const G = [];
  for (let p = 0; p < N; p++) { const g = []; for (let t = 0; t < T; t++) g.push(R[p][t] ? (P.fixed[p][t] || 'OFF') : ''); G.push(g); }
  const midCnt = []; for (let p = 0; p < N; p++) midCnt.push(0);
  const wk = [], tot = []; for (let p = 0; p < N; p++) { wk.push({ pd: 0, sb: 0 }); tot.push({ pd: 0, sb: 0 }); }
  for (let t = 0; t < T; t++) {
    if (t % 7 === 0) wk.forEach(function (x) { x.pd = 0; x.sb = 0; });
    const W = [];
    for (let p = 0; p < N; p++) if (!R[p][t]) W.push(p);
    const w = W.length;
    let bestS = null, bestA = null;
    const total = Math.pow(3, w), opt = ['PD', 'SB', 'MD'];
    for (let code = 0; code < total; code++) {
      let x = code, pd = 0, sb = 0, mid = 0, ok = true, sc = 0;
      const a = [];
      for (let i = 0; i < w; i++) {
        const p = W[i];
        let v = opt[x % 3]; x = Math.floor(x / 3);
        const f = P.fixed[p][t];
        if (f) { if (v !== (f === 'PD' ? 'PD' : f === 'SB' ? 'SB' : 'MD')) { ok = false; break; } v = f; }
        else {
          const m = jdForced_(P, R, p, t);
          if (m === 1 && v !== 'PD') { ok = false; break; }
          if ((m & 2) && v === 'PD') { ok = false; break; }
        }
        a.push(v);
        if (v === 'PD') pd++; else if (v === 'SB') sb++; else mid++;
      }
      if (!ok || pd < 2 || sb < 2) continue;
      if (mid > 1) continue;
      if (w >= 5 && mid !== 1) sc += 200;
      for (let i = 0; i < w; i++) {
        const p = W[i], v = a[i];
        const prev = t > 0 ? G[p][t - 1] : P.last[p];
        if (v === 'PD' && prev === 'SB') sc += 8;
        if (v === 'PD') sc += 5 * Math.max(0, wk[p].pd - wk[p].sb) + 2 * Math.max(0, tot[p].pd - tot[p].sb); else if (v === 'SB') sc += 5 * Math.max(0, wk[p].sb - wk[p].pd) + 2 * Math.max(0, tot[p].sb - tot[p].pd);
        if (JD_MID[v]) {
          if (p === P.admin) sc += P.wkend[t] ? 0 : 4;
          else sc += (P.wkend[t] && P.admin >= 0 && !R[P.admin][t] ? 10 : 0) + 4 * midCnt[p];
        }
      }
      sc += rnd() * 0.5;
      if (bestS === null || sc < bestS) { bestS = sc; bestA = a; }
    }
    if (!bestA) { // tidak ada susunan sah: isi bergiliran
      bestA = W.map(function (p, i) { return P.fixed[p][t] || (i % 2 ? 'SB' : 'PD'); });
    }
    W.forEach(function (p, i) {
      const v = bestA[i]; G[p][t] = v;
      if (v === 'PD') { wk[p].pd++; tot[p].pd++; } else if (v === 'SB') { wk[p].sb++; tot[p].sb++; }
      if (JD_MID[v]) midCnt[p]++;
    });
  }
  return G;
}

/** Hasil: { shift: {nama: [kode]}, skor, catatan: [{nama, tanggal, pesan, level}] } */
function susunJadwal_(inp) {
  const P = jdPrep_(inp);
  const ulang = inp.ulang || 6, iters = inp.iters || 25000;
  const rnd = jdRng_((inp.seed || 7) * 7919 + 13);
  let best = null;
  for (let r = 0; r < ulang; r++) {
    const R = jdOffAnneal_(P, rnd, iters);
    for (let k = 0; k < 3; k++) {
      const G = jdShifts_(P, R, rnd);
      const c = jdCost_(G, P);
      if (!best || c < best.c) best = { G: G, c: c };
    }
  }
  const G = best.G;
  // middle di weekend = MC, hari biasa = MD (kecuali dari request)
  for (let p = 0; p < P.N; p++) for (let t = 0; t < P.T; t++) {
    if (!P.fixed[p][t] && JD_MID[G[p][t]]) G[p][t] = P.wkend[t] ? 'MC' : 'MD';
  }
  const out = {};
  inp.nama.forEach(function (n, p) { out[n] = G[p]; });
  return { shift: out, skor: Math.round(best.c), catatan: jdCatatan_(P, G, inp) };
}

/** Catatan pelanggaran aturan untuk tabel jadi (dipakai juga setelah diubah manual). */
function jdCatatan_(P, G, inp) {
  const notes0 = [];
  jdCost_(G, P, notes0);
  const seen = {};
  return notes0.filter(function (x) { const k = x.p + '|' + x.t + '|' + x.msg; if (seen[k]) return false; seen[k] = 1; return true; })
    .map(function (x) { return { nama: x.p >= 0 ? inp.nama[x.p] : '', tanggal: x.t >= 0 ? inp.tanggal[x.t] : '', pesan: x.msg, level: x.lvl }; });
}
function nilaiJadwal_(inp, shift) {
  const P = jdPrep_(inp);
  const G = inp.nama.map(function (n) { return shift[n].slice(); });
  return jdCatatan_(P, G, inp);
}


/* ===================== Draf jadwal otomatis ===================== */

const JD_KODE_SAH = ['PD', 'SB', 'MD', 'MC', 'OFF', 'CT', 'SC', 'NS'];

function jdTgl_(p) { const out = []; for (let d = p.start; d <= p.end; d = addDays_(d, 1)) out.push(d); return out; }
function jdDow_(iso) { const q = iso.split('-').map(Number); return new Date(Date.UTC(q[0], q[1] - 1, q[2])).getUTCDay(); }

function jdBaca_(mulai) {
  const r = read_('jadwal_draf').filter(function (x) { return String(x.periode) === mulai; })[0];
  if (!r) return null;
  let data = null;
  try { data = JSON.parse(String(r.data || '')); } catch (e) { data = null; }
  return { periode: String(r.periode), status: String(r.status), dibuat: String(r.dibuat), diubah: String(r.diubah), oleh: String(r.oleh), data: data };
}
function jdSimpan_(mulai, status, data, oleh) {
  const rows = read_('jadwal_draf');
  const i = rows.findIndex(function (x) { return String(x.periode) === mulai; });
  const rec = { periode: mulai, status: status, dibuat: i >= 0 ? rows[i].dibuat : now_(), diubah: now_(), oleh: oleh || '', data: JSON.stringify(data) };
  if (i >= 0) updateRow_('jadwal_draf', 'periode', mulai, rec); else append_('jadwal_draf', rec);
}

/** Seberapa ramai tiap hari (0 = paling sepi, 1 = paling ramai) dari median sales per hari 120 hari terakhir. */
function jdRamai_(tanggal) {
  const by = [[], [], [], [], [], [], []];
  const dari = addDays_(today_(), -120);
  ringkasan_().forEach(function (r) { if (r.tanggal >= dari && r.bruto > 0) by[jdDow_(r.tanggal)].push(r.bruto); });
  const med = by.map(function (a) { if (!a.length) return null; a.sort(function (x, y) { return x - y; }); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; });
  const def = [1, 0.2, 0.2, 0.2, 0.5, 0.5, 0.9]; // cadangan bila data kurang (Minggu..Sabtu)
  const v = med.filter(function (x) { return x != null; });
  const mn = Math.min.apply(null, v.length ? v : [0]), mx = Math.max.apply(null, v.length ? v : [1]);
  return tanggal.map(function (t) { const m = med[jdDow_(t)]; return m == null || mx === mn ? def[jdDow_(t)] : (m - mn) / (mx - mn); });
}

/** Bahan penyusun: staf, sisa periode lalu, request yang disetujui, kunci manual. */
function jdBahan_(p, kunci) {
  const tanggal = jdTgl_(p);
  const prevJ = readJadwalPeriode_(addDays_(p.start, -1));
  if (!prevJ || !prevJ.staf.length) throw new Error('Tab jadwal periode sebelumnya tidak ditemukan, staf tidak bisa ditentukan');
  const staf = prevJ.staf.filter(function (s) { return !/^HL\b/i.test(String(s.nama).trim()); });
  const nama = staf.map(function (s) { return s.nama; });
  const prev = {};
  staf.forEach(function (s) { prev[s.nama] = s.shift.slice(-10); });
  const users = read_('users').filter(function (u) { return u.status === 'aktif'; });
  const admins = users.filter(function (u) { return u.role === 'admin'; }).map(function (u) { return resolveNamaJadwal_(u, nama); }).filter(Boolean);
  const admin = admins.length ? nama.map(normName_).indexOf(normName_(admins[0])) : -1;
  const tetap = {}, jatah = {}, req = {};
  nama.forEach(function (n) { tetap[n] = {}; jatah[n] = 4; req[n] = []; });
  // kunci manual admin dulu, lalu request (request menang bila bentrok)
  Object.keys(kunci || {}).forEach(function (n) {
    if (!tetap[n]) return;
    Object.keys(kunci[n]).forEach(function (i) { tetap[n][Number(i)] = kunci[n][i]; });
  });
  read_('request_jadwal').forEach(function (r) {
    if (r.status !== 'disetujui') return;
    const t = String(r.tanggal), i = tanggal.indexOf(t);
    if (i < 0) return;
    const u = users.filter(function (x) { return x.username === r.username; })[0] || { nama: r.nama };
    const nj = resolveNamaJadwal_(u, nama);
    const n = nama.filter(function (x) { return normName_(x) === normName_(nj); })[0];
    if (!n) return;
    tetap[n][i] = String(r.jenis).toUpperCase();
    req[n].push(i);
    if (String(r.pakai_simpanan) === 'ya' && String(r.jenis).toUpperCase() === 'OFF') jatah[n]++;
  });
  return {
    inp: { tanggal: tanggal, dow: tanggal.map(jdDow_), nama: nama, admin: admin, prev: prev, tetap: tetap, jatahOff: jatah, ramai: jdRamai_(tanggal) },
    req: req, tabLalu: prevJ.tab
  };
}

function jdBuat_(p, oleh, alasan) {
  const lama = jdBaca_(p.start);
  const kunci = lama && lama.data ? (lama.data.kunci || {}) : {};
  const B = jdBahan_(p, kunci);
  const hasil = susunJadwal_(Object.assign({ seed: Math.floor(Math.random() * 1e6) + 1, ulang: 4, iters: 20000 }, B.inp));
  const data = {
    mulai: p.start, selesai: p.end, label: p.label, tanggal: B.inp.tanggal,
    hari: B.inp.tanggal.map(function (t) { return HARI_KODE[jdDow_(t)]; }),
    staf: B.inp.nama.map(function (n) { return { nama: n, shift: hasil.shift[n], req: B.req[n] }; }),
    kunci: kunci, catatan: hasil.catatan, skor: hasil.skor, dibuat: now_(), alasan: alasan || '', tabLalu: B.tabLalu
  };
  jdSimpan_(p.start, 'draf', data, oleh);
  return data;
}

/** Periode yang belum terbit (tab belum ada atau drafnya masih draf) → request disetujui masuk draf. */
function jdMasihDraf_(p) {
  const d = jdBaca_(p.start);
  if (d && d.status === 'draf') return true;
  if (d && d.status === 'terbit') return false;
  try { return !findTab_(SpreadsheetApp.openById(CFG.JADWAL_SHEET_ID), p); } catch (e) { return false; }
}

function jdTerbitkan_(p, oleh) {
  const d = jdBaca_(p.start);
  if (!d || !d.data) throw new Error('Draf periode ' + p.label + ' belum ada');
  const data = d.data;
  const ss = SpreadsheetApp.openById(CFG.JADWAL_SHEET_ID);
  let sh = findTab_(ss, p), baru = false;
  if (!sh) { sh = createTab_(ss, p); baru = true; }
  const names = sh.getRange(5, 2, Math.max(1, sh.getLastRow() - 4), 1).getDisplayValues().map(function (r) { return String(r[0]).trim(); });
  const staf = [];
  for (let i = 0; i < names.length && names[i]; i++) staf.push(names[i]);
  const cols = dayCols_(sh);
  const dayRow = sh.getRange(2, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const colOf = {};
  cols.forEach(function (c) { colOf[Number(dayRow[c - 1])] = c; });
  const c0 = cols[0], n = cols.length;
  const hilang = [];
  data.staf.forEach(function (s) {
    const ri = staf.map(normName_).indexOf(normName_(s.nama));
    if (ri < 0) { hilang.push(s.nama); return; }
    const row = [], bg = [];
    for (let k = 0; k < n; k++) {
      const day = Number(dayRow[c0 - 1 + k]);
      const i = data.tanggal.findIndex(function (t) { return Number(t.slice(8)) === day; });
      row.push(i >= 0 ? s.shift[i] : '');
      bg.push(i >= 0 && (s.req || []).indexOf(i) >= 0 ? CFG.REQUEST_COLOR : null);
    }
    sh.getRange(5 + ri, c0, 1, n).setValues([row]).setBackgrounds([bg]);
  });
  if (hilang.length) throw new Error('Nama tidak ada di tab ' + sh.getName() + ': ' + hilang.join(', '));
  jdSimpan_(p.start, 'terbit', data, oleh);
  bumpVersion_();
  return { tab: sh.getName(), tabBaru: baru };
}

Object.assign(API, {
  /** Draf jadwal periode (default: periode berikutnya). Admin. */
  jdDraf: function (req) {
    const a = auth_(req, true);
    const cur = periodOf_(today_());
    const p = req.mulai ? periodOf_(String(req.mulai)) : periodOf_(addDays_(cur.end, 1));
    if (p.start < CFG.JADWAL_MIN_START || p.end < today_()) throw new Error('Periode ' + p.label + ' sudah lewat');
    let d = jdBaca_(p.start);
    let tabAda = false;
    try { tabAda = !!findTab_(SpreadsheetApp.openById(CFG.JADWAL_SHEET_ID), p); } catch (e) {}
    if (!d && !tabAda && req.buat) {
      withLock_(function () { jdBuat_(p, a.username, 'dibuat pertama'); });
      d = jdBaca_(p.start);
    }
    return { periode: periodInfo_(p), tabAda: tabAda, draf: d };
  },

  jdSusun: function (req) {
    const a = auth_(req, true);
    const p = periodOf_(String(req.mulai || ''));
    if (p.start < CFG.JADWAL_MIN_START || p.end < today_()) throw new Error('Periode ' + p.label + ' sudah lewat');
    const d = jdBaca_(p.start);
    if (d && d.status === 'terbit' && !req.paksa) throw new Error('Jadwal periode ini sudah terbit. Susun ulang akan mengganti jadwal yang sudah dibagikan.');
    const data = withLock_(function () { return jdBuat_(p, a.username, 'disusun ulang'); }, 60000);
    log_(a.username, 'susun jadwal', p.label + ' · skor ' + data.skor);
    return { draf: jdBaca_(p.start) };
  },

  /** Ubah satu sel draf secara manual (dikunci saat disusun ulang). kode '' = buka kunci. */
  jdUbah: function (req) {
    const a = auth_(req, true);
    const p = periodOf_(String(req.mulai || ''));
    const kode = String(req.kode || '').toUpperCase();
    if (kode && JD_KODE_SAH.indexOf(kode) < 0) throw new Error('Kode shift tidak dikenal');
    return withLock_(function () {
      const d = jdBaca_(p.start);
      if (!d || !d.data) throw new Error('Draf belum ada');
      if (d.status !== 'draf') throw new Error('Jadwal sudah terbit; ubah lewat Request atau Tukar Shift');
      const data = d.data, i = data.tanggal.indexOf(String(req.tanggal));
      const s = data.staf.filter(function (x) { return x.nama === req.nama; })[0];
      if (!s || i < 0) throw new Error('Sel tidak ditemukan');
      data.kunci = data.kunci || {};
      data.kunci[s.nama] = data.kunci[s.nama] || {};
      if (kode) { data.kunci[s.nama][i] = kode; s.shift[i] = kode; } else delete data.kunci[s.nama][i];
      const B = jdBahan_(p, data.kunci);
      const shift = {}; data.staf.forEach(function (x) { shift[x.nama] = x.shift; });
      data.catatan = nilaiJadwal_(B.inp, shift);
      jdSimpan_(p.start, 'draf', data, a.username);
      return { draf: jdBaca_(p.start) };
    });
  },

  jdTerbit: function (req) {
    const a = auth_(req, true);
    const p = periodOf_(String(req.mulai || ''));
    if (p.start < CFG.JADWAL_MIN_START) throw new Error('Periode ' + p.label + ' sudah ditutup');
    const w = withLock_(function () { return jdTerbitkan_(p, a.username); }, 60000);
    log_(a.username, 'terbitkan jadwal', p.label + ' → tab ' + w.tab);
    notif_('semua', 'ok', 'jadwal', 'Jadwal ' + p.label + ' sudah terbit', 'Cek shift kamu ' + tglPendek_(p.start) + ' – ' + tglPendek_(p.end) + '.', '#/jadwal');
    return w;
  },

  /** Jadwal satu periode dari sheet (untuk lihat & unduh). */
  jadwalPeriode: function (req) {
    auth_(req);
    const p = periodOf_(String(req.mulai || today_()));
    const j = readJadwalPeriode_(p.start);
    return { periode: periodInfo_(p), jadwal: j };
  }
});
