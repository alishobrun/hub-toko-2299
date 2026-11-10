/* Basecamp 2299 — pembaca PDF "Juknis Promo" bulanan Eigerindo.
 * Teks PDF diambil dengan pdf.js di browser, lalu tiap halaman program promo
 * (bertanda "SYARAT KETENTUAN & CONTOH PENERAPAN") diubah menjadi data promo:
 * nama, jenis, periode, minimal transaksi, toko berlaku, produk, dan ketentuan
 * yang relevan untuk pelanggan (catatan internal kasir/HO dibuang). */
(function (root) {
  'use strict';

  var BULAN = { JANUARI: 1, FEBRUARI: 2, MARET: 3, APRIL: 4, MEI: 5, JUNI: 6, JULI: 7, AGUSTUS: 8, SEPTEMBER: 9, OKTOBER: 10, NOVEMBER: 11, DESEMBER: 12,
    JAN: 1, FEB: 2, MAR: 3, APR: 4, JUN: 6, JUL: 7, AGU: 8, AGT: 8, AUG: 8, SEP: 9, OKT: 10, OCT: 10, NOV: 11, DES: 12, DEC: 12 };
  var JENIS = { REGULAR: 'Reguler', REGULER: 'Reguler', EVENT: 'Event', BANKING: 'Banking', BAZAAR: 'Bazaar', EAC: 'EAC' };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function rapi(s) { return String(s || '').replace(/\s+/g, ' ').replace(/\s+([,.)])/g, '$1').replace(/([a-z])\s*-\s+([a-z])/g, '$1-$2').replace(/([a-z])\s+-([a-z])/g, '$1-$2').trim(); }

  /** Teks per halaman dari PDF (pdf.js). Halaman program promo berkolom dua (syarat di kiri,
   *  contoh di kanan), jadi kolom kiri dibaca dulu lalu kolom kanan; tiap kolom dikelompokkan per baris. */
  function teksPdf(pdfjs, data) {
    return pdfjs.getDocument({ data: data }).promise.then(function (doc) {
      var jobs = [];
      for (var i = 1; i <= doc.numPages; i++) jobs.push(doc.getPage(i).then(function (pg) {
        return pg.getTextContent().then(function (c) { return { w: pg.getViewport({ scale: 1 }).width, items: c.items }; });
      }));
      return Promise.all(jobs).then(function (ps) { return ps.map(function (p) { return susun(p.items, p.w); }); });
    });
  }
  function baris(items) {
    var rows = [];
    items.forEach(function (it) {
      var y = it.transform[5], r = rows.filter(function (q) { return Math.abs(q.y - y) < 2.5; })[0];
      if (!r) { r = { y: y, xs: [] }; rows.push(r); }
      r.xs.push({ x: it.transform[4], s: it.str });
    });
    rows.sort(function (a, b) { return b.y - a.y; });
    return rows.map(function (r) { return r.xs.sort(function (a, b) { return a.x - b.x; }).map(function (p) { return p.s; }).join(' ').replace(/\s+/g, ' ').trim(); });
  }
  function susun(items, w) {
    items = items.filter(function (it) { return it.str && it.str.trim(); });
    var kiri = items.filter(function (it) { return it.transform[4] < w * 0.5; }), kanan = items.filter(function (it) { return it.transform[4] >= w * 0.5; });
    return baris(kiri).concat(baris(kanan)).join('\n');
  }

  // ketentuan yang tidak perlu dilihat pelanggan (catatan kasir, HO, file list, dsb.)
  var BUANG = /exclude eg voucher|paper bag|^list|list:|list produk|tbc|\bHO\b|akunting|b2b2g|remark|bulan ini brand|eligible hanya|new arrival:|berlaku tanggal|\bPOS\b|kasir|di-klip|struk lalu/i;
  var STOP = /^(CONTOH PENERAPAN|\d+\s+Contoh|Contoh \d|Periode\s*:|List\s*:|New Arrival\s*:|Pesan:|TIPS KASIR|EIGER ADVENTURE|Bayar Rp|Non-?\s?promo hanya)/i;

  /** Ubah teks halaman-halaman Juknis menjadi { bulan: 'yyyy-mm', judul, promos: [...] }. */
  function baca(halaman) {
    var semua = halaman.join('\n');
    var kepala = semua.match(/Periode\s*:\s*(\d{1,2})\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
    if (!kepala) throw new Error('Ini bukan file Juknis Promo (periode tidak ditemukan)');
    var bln = BULAN[kepala[3].toUpperCase()], thn = Number(kepala[4]);
    var jenis = 'Reguler', promos = [];
    halaman.forEach(function (t) {
      var pemisah = t.length < 200 && t.match(/^\s*Promo\s*\n\s*([A-Za-z]+)\s*$/im);
      if (pemisah && JENIS[pemisah[1].toUpperCase()]) { jenis = JENIS[pemisah[1].toUpperCase()]; return; }
      if (!/SYARAT\s+KETENTUAN\s*&\s*CONTOH/i.test(t)) return;
      var baris = t.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      // judul = baris tepat sebelum "SYARAT & KETENTUAN" di kolom kiri
      var iS = baris.findIndex(function (x) { return /^SYARAT\s*&\s*KETENTUAN/i.test(x); }), judul = '';
      for (var q = iS - 1; q >= 0 && !judul; q--) if (!/SYARAT|^Periode|^List|^Min\.|^Berlaku|^Produk/i.test(baris[q])) judul = rapi(baris[q]);
      if (!judul) judul = rapi((baris.filter(function (x) { return !/SYARAT|EIGER ADVENTURE|^Periode/i.test(x); })[0]) || '');
      var ambil = function (re) { var m = t.match(re); return m ? rapi(m[1]) : ''; };
      var minTrx = ambil(/Min\.\s*Transaksi\s*:\s*([^\n]*)/i);
      var toko = ambil(/Berlaku di\s*:\s*([\s\S]*?)\n\s*Produk\s*:/i);
      var produk = ambil(/Produk\s*:\s*([^\n]*)/i);
      var per = t.match(/Periode\s*:\s*(\d{1,2})\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
      var mulai, selesai;
      if (per) {
        var b = BULAN[per[3].toUpperCase()] || bln, y = Number(per[4]);
        mulai = y + '-' + pad(b) + '-' + pad(Number(per[1])); selesai = y + '-' + pad(b) + '-' + pad(Number(per[2]));
      } else if (/sepanjang|1\s*[-–]\s*30/i.test(t)) { mulai = thn + '-' + pad(bln) + '-01'; selesai = thn + '-' + pad(bln) + '-' + pad(new Date(Date.UTC(thn, bln, 0)).getUTCDate()); }
      if (!judul || !mulai) return;
      var ket = [], iK = baris.findIndex(function (x) { return /^KETENTUAN\s*:?$/i.test(x); });
      if (iK >= 0) for (var k = iK + 1; k < baris.length; k++) {
        var x = baris[k];
        if (STOP.test(x)) { if (/^(Periode|List|New Arrival)\s*:/i.test(x)) continue; break; }
        if (!BUANG.test(x)) ket.push(rapi(x).replace(/\s*•\s*/g, ' · '));
      }
      promos.push({ judul: judul.replace(/\s+—\s+/g, ': '), jenis: jenis, mulai: mulai, selesai: selesai,
        syarat: minTrx && !/tidak ada/i.test(minTrx) ? 'Min. belanja ' + minTrx : '', produk: produk, toko: toko, ket: ket.slice(0, 5).join(' • ') });
    });
    return { bulan: thn + '-' + pad(bln), promos: promos };
  }

  /** Hanya promo yang berlaku di toko reguler (bukan Factory Store / Bazaar / toko terpilih). */
  function untukTokoReguler(promos) {
    return promos.filter(function (p) {
      return !/factory|bazaar|site kepala|selected store|toko terpilih|validasi/i.test(p.toko + ' ' + p.judul) && !/^[–-]$/.test(p.toko);
    });
  }

  var api = { teksPdf: teksPdf, susun: susun, baca: baca, untukTokoReguler: untukTokoReguler };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Juknis = api;
})(this);
