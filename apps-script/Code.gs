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
  SESSION_DAYS: 30,
  HASH_ROUNDS: 300
};

const TABS = {
  users: ['username', 'nama', 'hash', 'salt', 'role', 'status', 'dibuat', 'disetujui_oleh', 'login_terakhir'],
  sessions: ['token', 'username', 'kedaluwarsa'],
  dsr: ['invoice', 'order_no', 'tanggal', 'jam', 'status', 'tipe', 'sku', 'nama_sku', 'kat3', 'kat4', 'brand',
    'qty', 'harga', 'sales_person', 'gross', 'promo_value', 'promo_name', 'coupon', 'discount', 'net',
    'cust_key', 'cust_name', 'upload_id'],
  uploads: ['id', 'waktu', 'username', 'nama_file', 'dari', 'sampai', 'baris', 'invoice_baru', 'invoice_diperbarui', 'invoice_sama'],
  targets: ['bulan', 'target', 'sumber', 'diperbarui'],
  bobot: ['tanggal', 'harian', 'kumulatif'],
  kas: ['id', 'tanggal', 'waktu', 'username', 'nama', 'pecahan', 'total_fisik', 'modal', 'penjualan_tunai',
    'masuk', 'keluar', 'perubahan', 'seharusnya', 'selisih', 'catatan'],
  settings: ['key', 'value', 'diperbarui', 'oleh']
};

const PECAHAN = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
const SETTING_DEFAULTS = { modal_till: 600000 };

// Kolom yang disimpan sebagai teks (supaya tanggal/kode tidak diubah Sheets)
const NUM_COLS = {
  dsr: ['qty', 'harga', 'gross', 'promo_value', 'coupon', 'discount', 'net'],
  uploads: ['baris', 'invoice_baru', 'invoice_diperbarui', 'invoice_sama'],
  targets: ['target'],
  bobot: ['harian', 'kumulatif'],
  kas: ['total_fisik', 'modal', 'penjualan_tunai', 'masuk', 'keluar', 'seharusnya', 'selisih'],
  settings: ['value']
};
const DSR_FIELDS = TABS.dsr.slice(0, TABS.dsr.length - 1); // tanpa upload_id

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
  const r = syncTarget_();
  Logger.log('Setup selesai. Target: ' + JSON.stringify(r));
  return r;
}

/* ===================== HTTP ===================== */

function doGet() {
  return json_({ ok: true, app: 'Hub Toko ' + CFG.STORE });
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
        dibuat: String(u.dibuat), disetujui_oleh: String(u.disetujui_oleh), login_terakhir: String(u.login_terakhir)
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
      if (res.changed) writeAll_('dsr', res.all);
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
    const t = read_('targets').filter(function (x) { return String(x.bulan) === bulan; })[0];
    const bobot = {};
    read_('bobot').forEach(function (b) {
      const d = String(b.tanggal);
      if (d.slice(0, 7) === bulan) bobot[d] = { harian: Number(b.harian), kumulatif: Number(b.kumulatif) };
    });
    const rows = read_('dsr').filter(function (r) { return String(r.tanggal).slice(0, 7) === bulan; });
    return {
      tanggal: tanggal, bulan: bulan, dataSampai: latest,
      store: CFG.STORE, storeName: CFG.STORE_NAME,
      target: t ? Number(t.target) : null, targetSumber: t ? String(t.sumber) : null,
      bobot: bobot,
      harian: aggregateDaily_(rows)
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
    const tunai = Number(req.penjualanTunai || 0);
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
    const modal = settings_().modal_till;
    const seharusnya = modal + tunai + masuk - keluar;
    const selisih = fisik - seharusnya;
    const catatan = String(req.catatan || '').trim().slice(0, 300);
    if (selisih !== 0 && !catatan) throw new Error('Ada selisih, isi catatan penjelasannya dulu');
    const now = new Date();
    const rec = {
      id: Utilities.formatDate(now, CFG.TZ, 'yyyyMMdd-HHmmss') + '-' + u.username,
      tanggal: Utilities.formatDate(now, CFG.TZ, 'yyyy-MM-dd'), waktu: now_(),
      username: u.username, nama: u.nama, pecahan: JSON.stringify(clean), total_fisik: fisik,
      modal: modal, penjualan_tunai: Math.round(tunai), masuk: masuk, keluar: keluar,
      perubahan: JSON.stringify(perubahan), seharusnya: seharusnya, selisih: selisih, catatan: catatan
    };
    withLock_(function () { append_('kas', rec); });
    return kasOut_(rec);
  },

  kasList: function (req) {
    auth_(req);
    const tgl = /^\d{4}-\d{2}-\d{2}$/.test(String(req.tanggal || '')) ? String(req.tanggal) : Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
    const all = read_('kas');
    const days = {};
    all.forEach(function (r) { days[String(r.tanggal)] = 1; });
    return {
      tanggal: tgl,
      tanggalTersedia: Object.keys(days).sort().reverse().slice(0, 60),
      list: all.filter(function (r) { return String(r.tanggal) === tgl; }).map(kasOut_).reverse()
    };
  }
};

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
  return {
    id: String(r.id), tanggal: String(r.tanggal), waktu: String(r.waktu), username: r.username, nama: r.nama,
    pecahan: pec, totalFisik: Number(r.total_fisik), modal: Number(r.modal), penjualanTunai: Number(r.penjualan_tunai),
    masuk: Number(r.masuk), keluar: Number(r.keluar), perubahan: per,
    seharusnya: Number(r.seharusnya), selisih: Number(r.selisih), catatan: String(r.catatan || '')
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
  }
  return s;
}

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
