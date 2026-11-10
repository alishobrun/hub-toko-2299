/* Basecamp 2299 — "Kirim promo ke katalog".
 * Dijalankan oleh bookmark di halaman Info Promo (Juknis) Integrated Hub Jateng 01
 * (sudah login). Membaca promo yang sedang/akan berjalan untuk toko reguler, lalu
 * membuka Basecamp (menu Katalog Pelanggan) yang langsung menyimpannya.
 * Tidak membaca atau mengirim data login apa pun: hanya teks promo yang tampil di layar. */
(function () {
  'use strict';
  var BASECAMP = 'https://alishobrun.github.io/hub-toko-2299/#/katalog';
  var BULAN = { JAN: 1, JANUARI: 1, FEB: 2, FEBRUARI: 2, MAR: 3, MARET: 3, APR: 4, APRIL: 4, MEI: 5, MAY: 5, JUN: 6, JUNI: 6, JUL: 7, JULI: 7,
    AGU: 8, AGT: 8, AGS: 8, AUG: 8, AGUSTUS: 8, SEP: 9, SEPT: 9, SEPTEMBER: 9, OKT: 10, OCT: 10, OKTOBER: 10, NOV: 11, NOVEMBER: 11, DES: 12, DEC: 12, DESEMBER: 12 };
  var JENIS = { EVENT: 'Event', EAC: 'EAC', REGULER: 'Reguler', BANKING: 'Banking', BAZAAR: 'Bazaar' };

  function pesan(teks, gagal) {
    var b = document.createElement('div');
    b.textContent = teks;
    b.style.cssText = 'position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:99999;max-width:90vw;padding:14px 18px;border-radius:12px;' +
      'font:600 14px/1.4 system-ui,sans-serif;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25);background:' + (gagal ? '#C2392B' : '#0F2A7A');
    document.body.appendChild(b);
    setTimeout(function () { b.remove(); }, 6000);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** Ubah teks halaman Info Promo menjadi daftar promo. Diekspor untuk diuji. */
  function baca(teks) {
    var kepala = teks.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    var tahun = kepala ? Number(kepala[4]) : new Date().getFullYear();
    var bulanJuknis = kepala ? BULAN[kepala[3].toUpperCase()] : new Date().getMonth() + 1;
    var a = teks.search(/Sedang berjalan|Akan berjalan/i);
    var z = teks.search(/Timeline\s/i);
    if (a < 0) return [];
    var baris = teks.slice(a, z > a ? z : undefined).split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var out = [], cur = null;
    function tgl(hari, bln) {
      var b = BULAN[String(bln || '').toUpperCase()] || bulanJuknis;
      var y = tahun + (b > 10 && bulanJuknis < 3 ? -1 : b < 3 && bulanJuknis > 10 ? 1 : 0);
      return y + '-' + pad(b) + '-' + pad(Number(hari));
    }
    function tutup() { if (cur && cur.judul && cur.mulai) out.push(cur); cur = null; }
    baris.forEach(function (x) {
      var j = x.toUpperCase();
      if (JENIS[j]) { tutup(); cur = { jenis: JENIS[j], judul: '', mulai: '', selesai: '', syarat: '', produk: '', toko: '' }; return; }
      if (!cur) return;
      if (!cur.judul) { cur.judul = x.replace(/\s+—\s+/g, ': '); return; }
      if (/^📅/.test(x)) {
        var m = x.match(/(\d{1,2})\s*([A-Za-z]{3,})?\s*[–-]\s*(\d{1,2})\s*([A-Za-z]{3,})/);
        if (m) { cur.mulai = tgl(m[1], m[2] || m[4]); cur.selesai = tgl(m[3], m[4]); }
        else { var s = x.match(/(\d{1,2})\s*([A-Za-z]{3,})/); if (s) cur.mulai = cur.selesai = tgl(s[1], s[2]); }
        return;
      }
      if (/^🧾/.test(x)) { cur.syarat = x.replace(/^🧾\s*/, ''); return; }
      if (/^🏬/.test(x)) { cur.toko = x.replace(/^🏬\s*/, ''); return; }
      if (/^🏷/.test(x)) { cur.produk = x.replace(/^🏷️?\s*/, ''); return; }
    });
    tutup();
    var lihat = {};
    return out.filter(function (p) {
      // hanya promo untuk toko reguler: lewati Factory Store / toko terpilih / tanpa toko
      if (/^[–-]?$/.test(p.toko) || /factory|selected store|toko terpilih|lihat list toko|validasi/i.test(p.toko + ' ' + p.judul)) return false;
      if (lihat[p.judul]) return false;
      lihat[p.judul] = 1;
      return true;
    }).map(function (p) {
      if (/endless aisle/i.test(p.toko) && !/endless aisle/i.test(p.syarat)) p.syarat = (p.syarat ? p.syarat + ', ' : '') + 'lewat Endless Aisle';
      delete p.toko;
      return p;
    });
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { baca: baca }; return; }

  if (!/fanydzikri\.github\.io/.test(location.host)) { pesan('Buka dulu menu Info Promo (Juknis) di Integrated Hub Jateng 01, lalu klik bookmark ini lagi.', true); return; }
  if (!/#\/promo/.test(location.hash)) { location.hash = '#/promo'; pesan('Membuka menu Info Promo… klik bookmark ini sekali lagi setelah halamannya tampil.'); return; }
  var main = document.querySelector('main') || document.body;
  var promos = baca(main.innerText || main.textContent || '');
  if (!promos.length) { pesan('Promo belum terbaca. Pastikan sudah login dan halaman Info Promo sudah tampil, lalu klik lagi.', true); return; }
  var data = btoa(unescape(encodeURIComponent(JSON.stringify(promos))));
  pesan(promos.length + ' promo terbaca. Membuka Basecamp untuk menyimpan…');
  window.open(BASECAMP + '?impor=' + encodeURIComponent(data), '_blank');
})();
