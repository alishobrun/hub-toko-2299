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
  users: ['username', 'nama', 'hash', 'salt', 'role', 'status', 'dibuat', 'disetujui_oleh', 'login_terakhir', 'nama_jadwal'],
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
    'lv2', 'lv3', 'lv4', 'dc_status', 'product_status', 'grade', 'harga']
};

const PECAHAN = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
const SETTING_DEFAULTS = { modal_till: 600000, floating_cash: 2400000 };

// Kolom yang disimpan sebagai teks (supaya tanggal/kode tidak diubah Sheets)
const NUM_COLS = {
  dsr: ['qty', 'harga', 'gross', 'promo_value', 'coupon', 'discount', 'net', 'emp_disc'],
  traffic: ['traffic'],
  uploads: ['baris', 'invoice_baru', 'invoice_diperbarui', 'invoice_sama'],
  targets: ['target'],
  bobot: ['harian', 'kumulatif'],
  kas: ['total_fisik', 'modal', 'penjualan_tunai', 'masuk', 'keluar', 'seharusnya', 'selisih'],
  settings: ['value'],
  ringkasan: ['bruto', 'netto', 'qty', 'trx'],
  bin: ['total', 'available', 'allocated', 'proses'],
  bin_upload: ['baris', 'sku', 'pcs'],
  master: ['harga']
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
    return withLock_(function () {
      const res = mergeDsr_(read_('dsr'), rows, uploadId_(u.username));
      if (res.changed) {
        writeAll_('dsr', res.all);
        writeAll_('ringkasan', aggregateDaily_(res.all));
        bumpVersion_();
      }
      log_(u.username, 'unggah DSR', res.dari + ' s/d ' + res.sampai + ': ' + res.baru + ' baru, ' + res.diperbarui + ' diperbarui');
      if (u.role !== 'admin') notif_('admin', 'info', 'dsr', 'DSR diunggah oleh ' + u.nama,
        'Data ' + res.dari + ' s/d ' + res.sampai + ' · ' + res.baru + ' invoice baru, ' + res.diperbarui + ' diperbarui', '#/unggah');
      append_('uploads', {
        id: res.id, waktu: now_(), username: u.username, nama_file: String(req.fileName || '').slice(0, 120),
        dari: res.dari, sampai: res.sampai, baris: rows.length,
        invoice_baru: res.baru, invoice_diperbarui: res.diperbarui, invoice_sama: res.sama
      });
      return { baru: res.baru, diperbarui: res.diperbarui, sama: res.sama, baris: rows.length, dari: res.dari, sampai: res.sampai };
    }, 120000);
  },

  monitoring: function (req) {
    auth_(req);
    const latest = latestDate_();
    const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(req.tanggal || '')) ? String(req.tanggal) : latest;
    const bulan = tanggal.slice(0, 7);
    syncTargetIfNeeded_(bulan);
    syncTrafficIfNeeded_();
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
  },

  jadwal: function (req) {
    auth_(req);
    return readJadwal_(Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'));
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

/** Baris yang dihitung sebagai sales: barang dagangan brand EIGER, selain paper bag.
 *  (Jasa seperti reparasi, packing WAB/ECOM dan paper bag tidak dihitung.) */
function isSalesLine_(r) {
  return String(r.brand).trim().toUpperCase() === 'EIGER' && !/PAPER\s*BAG/i.test(String(r.nama_sku));
}

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
  const ses = read_('sessions').filter(function (s) { return s.token === t; })[0];
  if (!ses || String(ses.kedaluwarsa) < now_()) throw new Error('AUTH: Sesi berakhir, silakan masuk lagi');
  const u = read_('users').filter(function (x) { return x.username === ses.username; })[0];
  if (!u || u.status !== 'aktif') throw new Error('AUTH: Akun tidak aktif');
  if (needAdmin && u.role !== 'admin') throw new Error('Menu ini khusus admin');
  return u;
}

function publicUser_(u) { return { username: u.username, nama: u.nama, role: u.role }; }
function namaUser_(username) { const u = read_('users').filter(function (x) { return x.username === username; })[0]; return u ? u.nama : username; }
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

function writeAll_(n, objs) {
  const s = sh_(n), h = TABS[n];
  const last = s.getLastRow();
  if (last > 1) s.getRange(2, 1, last - 1, h.length).clearContent();
  if (!objs.length) return;
  const need = objs.length + 1;
  if (s.getMaxRows() < need) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows());
  formatCols_(s, n, 2, objs.length);
  s.getRange(2, 1, objs.length, h.length).setValues(objs.map(function (o) {
    return h.map(function (k) { return o[k] == null ? '' : o[k]; });
  }));
}

function append_(n, o) {
  const s = sh_(n), h = TABS[n];
  const r = s.getLastRow() + 1;
  if (s.getMaxRows() < r) s.insertRowsAfter(s.getMaxRows(), 1);
  formatCols_(s, n, r, 1);
  s.getRange(r, 1, 1, h.length).setValues([h.map(function (k) { return o[k] == null ? '' : o[k]; })]);
}

function updateRow_(n, keyCol, keyVal, patch) {
  const s = sh_(n), h = TABS[n];
  const rows = read_(n);
  const i = rows.findIndex(function (r) { return String(r[keyCol]) === String(keyVal); });
  if (i < 0) return false;
  Object.keys(patch).forEach(function (k) { rows[i][k] = patch[k]; });
  s.getRange(i + 2, 1, 1, h.length).setValues([h.map(function (k) { return rows[i][k] == null ? '' : rows[i][k]; })]);
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
      let info = '';
      if (setuju) {
        try {
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
        patch.catatan_admin ? 'Catatan admin: ' + patch.catatan_admin : (setuju ? 'Jadwal kamu sudah diperbarui.' : ''), '#/request');
      if (setuju) {
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
    const R = ra[sp + '|' + d] || (ra[sp + '|' + d] = { p: sp, t: d, b: 0, n: 0, q: 0, inv: {} });
    R.b += g; R.n += n; R.q += q; R.inv[inv] = 1;
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
  if (!rows.length && sh_('dsr').getLastRow() > 1) rows = rebuildRingkasan_();
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
  const o = { bruto: 0, netto: 0, qty: 0, inv: {}, ea: [0, 0], wholesale: [0, 0], empDisc: 0, promo: 0, coupon: 0, prod: {}, ra: {} };
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
      .sort(function (a, b) { return b[2] - a[2]; })
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
function catatTraffic() { return syncTraffic_(); }
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
    const u = auth_(req);
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
      const jam = Number(Utilities.formatDate(new Date(), CFG.TZ, 'H'));
      const kemarin = addDays_(today, -1);
      const latest = latestDate_();
      if (jam >= 11 && latest < kemarin) {
        items.push({ id: 'live-dsr-' + today, live: true, level: 'cek', jenis: 'dsr', waktu: today + ' 11:00:00',
          judul: 'DSR kemarin belum diunggah', isi: 'Data terakhir sampai ' + tglPendek_(latest), link: '#/unggah' });
      }
    } else {
      tukar.filter(function (t) { return t.status === 'menunggu_rekan' && t.rekan === u.username; }).forEach(function (t) {
        items.push({ id: 'live-ajak-' + t.id, live: true, level: 'aksi', jenis: 'tukar', waktu: String(t.dibuat),
          judul: t.nama_pemohon + ' mengajak tukar shift', isi: tglPendek_(t.tanggal) + ' · kamu ' + t.shift_rekan + ' → ' + t.shift_pemohon + ' · ' + String(t.alasan || ''),
          link: '#/tukar', aksi: { tipe: 'ajak', id: String(t.id) } });
      });
      badges.tukar = items.length;
    }

    // catatan kejadian (60 hari terakhir, maks 60)
    const batasLama = addDays_(today, -60);
    const log = read_('notifikasi').filter(function (n) {
      const to = String(n.untuk);
      return (to === u.username || (admin && to === 'admin')) && String(n.waktu).slice(0, 10) >= batasLama;
    }).slice(-60).reverse().map(function (n) {
      const dib = String(n.dibaca || '').split(',').indexOf(u.username) >= 0;
      return { id: String(n.id), live: false, level: String(n.level), jenis: String(n.jenis), waktu: String(n.waktu),
        judul: String(n.judul), isi: String(n.isi), link: String(n.link), dibaca: dib };
    });

    const live = items.sort(function (a, b) { return a.level === b.level ? (a.waktu < b.waktu ? 1 : -1) : (a.level === 'aksi' ? -1 : 1); });
    const unread = live.length + log.filter(function (n) { return !n.dibaca && n.level !== 'info'; }).length;
    return { items: live.concat(log), unread: unread, badges: badges, waktu: now_() };
  },

  notifRead: function (req) {
    const u = auth_(req);
    const ids = req.semua ? null : (req.ids || []).map(String);
    return withLock_(function () {
      const all = read_('notifikasi');
      let n = 0;
      all.forEach(function (x) {
        const to = String(x.untuk);
        if (!(to === u.username || (u.role === 'admin' && to === 'admin'))) return;
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

/** Catat notifikasi. Dipanggil di dalam withLock_ yang sudah berjalan. */
function notif_(untuk, level, jenis, judul, isi, link) {
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
      kolom: F, rows: rows, pertama: pertama, today: today_(), naHari: CFG.NA_HARI, baruHari: CFG.BARU_TOKO_HARI
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
    return { kolom: F.slice(1), map: out, info: prop_('master_loaded'), today: today_(), naHari: CFG.NA_HARI };
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
