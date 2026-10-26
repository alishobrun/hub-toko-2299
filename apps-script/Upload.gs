/**
 * Basecamp 2299 — MESIN UPLOAD video dokumentasi opening/closing.
 *
 * Dipasang di akun Google PEMILIK folder dokumentasi (eigerkartasura@gmail.com),
 * sebagai project Apps Script terpisah, lalu di-deploy sebagai Web App:
 *   Execute as: Me   ·   Who has access: Anyone
 *
 * File yang diunggah menjadi milik akun ini (memakai kuota Drive akun ini).
 * Hanya menerima unggahan yang membawa tiket sah dari Basecamp 2299
 * (ditandatangani dengan kunci rahasia yang sama di kedua project).
 *
 * Setelah menempel kode: jalankan fungsi `setup` sekali, lalu salin
 * KUNCI dari Log eksekusi ke Basecamp (Admin → Mesin upload).
 */

const UP = {
  FOLDER_ID: '1qlwAdXg_liYKpyXrOLMwa5NohxpK8xZy', // folder "Dokumentasi open dan close"
  TZ: 'Asia/Jakarta',
  ORIGIN: 'https://alishobrun.github.io',
  BULAN: ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER']
};

function setup() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('KUNCI')) p.setProperty('KUNCI', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  if (!p.getProperty('RETENSI_HARI')) p.setProperty('RETENSI_HARI', '0');
  DriveApp.getFolderById(UP.FOLDER_ID).getName(); // cek akses folder
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bersihkan') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('bersihkan').timeBased().everyDays(1).atHour(2).create();
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  Logger.log('KUNCI=' + p.getProperty('KUNCI'));
  return 'ok';
}

function doGet() { return out_({ ok: true, app: 'Basecamp 2299 upload' }); }

function doPost(e) {
  let res;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const t = cekTiket_(req.tiket);
    const fn = { start: start_, chunk: chunk_, cek: cek_, selesai: selesai_ }[req.action];
    if (!fn) throw new Error('Aksi tidak dikenal');
    res = { ok: true, data: fn(req, t) };
  } catch (err) {
    res = { ok: false, error: String((err && err.message) || err) };
  }
  return out_(res);
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- tiket ---------- */
function cekTiket_(tiket) {
  const parts = String(tiket || '').split('.');
  if (parts.length !== 2) throw new Error('Tiket tidak sah');
  const kunci = PropertiesService.getScriptProperties().getProperty('KUNCI');
  if (!kunci) throw new Error('Mesin upload belum di-setup');
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], kunci)).replace(/=+$/, '');
  if (sig !== parts[1]) throw new Error('Tiket tidak sah');
  const t = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (!t.exp || Date.now() > t.exp) throw new Error('Tiket kedaluwarsa, ulangi unggah dari awal');
  if (!/^(OPENING|CLOSING)$/.test(t.j)) throw new Error('Jenis tidak sah');
  return t;
}

/* ---------- folder & nama ---------- */
function folderBulan_(tgl) {
  const root = DriveApp.getFolderById(UP.FOLDER_ID);
  const name = tgl.slice(0, 7) + ' ' + UP.BULAN[Number(tgl.slice(5, 7)) - 1];
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}
/** Folder harian di dalam folder bulan, mis. "2026-10 OKTOBER/2026-10-26". */
function folderHari_(tgl) {
  const m = folderBulan_(tgl);
  const it = m.getFoldersByName(tgl);
  return it.hasNext() ? it.next() : m.createFolder(tgl);
}
/** Sekali jalan (otomatis saat unggahan pertama setelah update): pindahkan video yang masih di folder bulan ke folder harian. */
function rapikanHarian() {
  const subs = DriveApp.getFolderById(UP.FOLDER_ID).getFolders();
  let n = 0;
  while (subs.hasNext()) {
    const files = subs.next().getFiles();
    while (files.hasNext()) {
      const f = files.next(), m = String(f.getName()).match(/^(\d{4}-\d{2}-\d{2}) (OPENING|CLOSING) /);
      if (!m) continue;
      f.moveTo(folderHari_(m[1])); n++;
    }
  }
  Logger.log('Dipindah: ' + n);
  return n;
}
function bersihNama_(s) { return String(s || '').replace(/[\\/:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }

/* ---------- unggah (Drive resumable upload) ---------- */
function start_(req, t) {
  const size = Number(req.size) || 0;
  if (size <= 0) throw new Error('File kosong');
  if (size > t.max) throw new Error('Video ' + Math.round(size / 1048576) + ' MB, maksimal ' + Math.round(t.max / 1048576) + ' MB');
  const mime = /^video\//.test(String(req.mime || '')) ? String(req.mime) : 'video/mp4';
  const ext = String(req.ext || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp4';
  const pr = PropertiesService.getScriptProperties();
  if (!pr.getProperty('RAPI_HARIAN')) { try { rapikanHarian(); } catch (e) { /* lanjut */ } pr.setProperty('RAPI_HARIAN', '1'); }
  const folder = folderHari_(t.t);
  const nama = t.t + ' ' + t.j + ' - ' + bersihNama_(t.n) + ' ' + t.h + '.' + ext;
  const meta = { name: nama, parents: [folder.getId()], mimeType: mime, description: 'Basecamp 2299 · ' + t.j + ' · ' + t.n + ' (' + t.u + ')' };
  const r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size', {
    method: 'post', contentType: 'application/json; charset=UTF-8', payload: JSON.stringify(meta), muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size), Origin: UP.ORIGIN }
  });
  if (r.getResponseCode() !== 200) throw new Error('Gagal membuat sesi unggah (' + r.getResponseCode() + ')');
  const h = r.getHeaders();
  const sesi = h.Location || h.location;
  CacheService.getScriptCache().put('s_' + t.id, sesi, 21600);
  CacheService.getScriptCache().put('n_' + t.id, String(size), 21600);
  return { sesi: sesi, nama: nama };
}

function sesi_(t) {
  const s = CacheService.getScriptCache().get('s_' + t.id);
  if (!s) throw new Error('Sesi unggah sudah berakhir, ulangi dari awal');
  return s;
}

/** Unggah potongan lewat server (cadangan bila browser tidak bisa langsung ke Drive). */
function chunk_(req, t) {
  const s = sesi_(t);
  const total = Number(CacheService.getScriptCache().get('n_' + t.id));
  const offset = Number(req.offset) || 0;
  const bytes = Utilities.base64Decode(String(req.data || ''));
  if (!bytes.length) throw new Error('Potongan kosong');
  const end = offset + bytes.length - 1;
  const r = UrlFetchApp.fetch(s, { method: 'put', payload: bytes, contentType: 'application/octet-stream', muteHttpExceptions: true,
    headers: { 'Content-Range': 'bytes ' + offset + '-' + end + '/' + total } });
  return hasil_(r, t);
}

/** Cek posisi unggahan (untuk melanjutkan). */
function cek_(req, t) {
  const s = sesi_(t);
  const total = Number(CacheService.getScriptCache().get('n_' + t.id));
  const r = UrlFetchApp.fetch(s, { method: 'put', payload: '', muteHttpExceptions: true, headers: { 'Content-Range': 'bytes */' + total } });
  return hasil_(r, t);
}

function hasil_(r, t) {
  const c = r.getResponseCode();
  if (c === 308) {
    const rg = r.getHeaders().Range || r.getHeaders().range;
    return { next: rg ? Number(String(rg).split('-')[1]) + 1 : 0 };
  }
  if (c === 200 || c === 201) {
    const f = JSON.parse(r.getContentText());
    return selesai_({ id: f.id }, t);
  }
  throw new Error('Unggah gagal (' + c + ')');
}

/** Tandai selesai: pastikan file ada di folder, bisa ditonton lewat link. */
function selesai_(req, t) {
  const f = DriveApp.getFileById(String(req.id));
  if (String(f.getDescription() || '').indexOf(t.u) < 0) throw new Error('File tidak cocok dengan tiket');
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* kebijakan akun */ }
  CacheService.getScriptCache().removeAll(['s_' + t.id, 'n_' + t.id]);
  return { done: true, id: f.getId(), nama: f.getName(), size: f.getSize() };
}

/** Pembersihan video lama ke Sampah. RETENSI_HARI = 0 berarti mati. */
function bersihkan() {
  const hari = Number(PropertiesService.getScriptProperties().getProperty('RETENSI_HARI') || 0);
  if (!hari) return;
  const batas = Date.now() - hari * 864e5;
  const sapu = function (folder, depth) {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (/^\d{4}-\d{2}-\d{2} (OPENING|CLOSING) /.test(f.getName()) && f.getDateCreated().getTime() < batas) f.setTrashed(true);
    }
    if (depth > 0) { const sub = folder.getFolders(); while (sub.hasNext()) sapu(sub.next(), depth - 1); }
  };
  sapu(DriveApp.getFolderById(UP.FOLDER_ID), 2);
}
