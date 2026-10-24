/* Basecamp 2299 — pembaca file Excel master artikel (besar) langsung di browser.
 * File .xlsx dibuka sebagai zip lalu sheet dibaca bertahap (streaming), hanya kolom
 * yang dipakai, supaya file puluhan MB tidak menghabiskan memori. */
(function (root) {
  'use strict';

  var COLS = {
    article: 'Article', cross: 'Cross-Site', generic: 'Generic Code', created: 'Created On', desc: 'Article Description',
    descGen: 'Desc Generic', grade: 'Fash. Grade', lv2: 'Lv2-Description', lv3: 'Lv3-Description', lv4: 'Lv4-Description',
    harga: 'Loc Amount', dc: 'DC Status', activity: 'Activity', gender: 'Gender', season: 'Season', status: 'Product Status',
    collection: 'Collection', story: 'Story'
  };

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  function zipEntries(b) {
    var e = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 70000); i--) { if (u32(b, i) === 0x06054b50) { e = i; break; } }
    if (e < 0) throw new Error('File bukan .xlsx yang valid');
    var n = u16(b, e + 10), off = u32(b, e + 16), out = {};
    var dec = new TextDecoder();
    for (var k = 0; k < n; k++) {
      if (u32(b, off) !== 0x02014b50) break;
      var method = u16(b, off + 10), comp = u32(b, off + 20), nl = u16(b, off + 28), xl = u16(b, off + 30), cl = u16(b, off + 32), lh = u32(b, off + 42);
      var name = dec.decode(b.subarray(off + 46, off + 46 + nl));
      out[name] = { method: method, comp: comp, lh: lh };
      off += 46 + nl + xl + cl;
    }
    return out;
  }
  function entryStream(b, ent) {
    var s = ent.lh + 30 + u16(b, ent.lh + 26) + u16(b, ent.lh + 28);
    var raw = new Blob([b.subarray(s, s + ent.comp)]).stream();
    if (ent.method === 8) raw = raw.pipeThrough(new DecompressionStream('deflate-raw'));
    return raw.pipeThrough(new TextDecoderStream());
  }
  function readText(b, ent) {
    var r = entryStream(b, ent).getReader(), acc = '';
    return (function pump() { return r.read().then(function (x) { if (x.done) return acc; acc += x.value; return pump(); }); })();
  }
  /** Baca teks per potongan; onPiece(buffer) mengembalikan sisa yang belum terpakai. */
  function streamPieces(b, ent, onPiece, onProgress) {
    var r = entryStream(b, ent).getReader(), buf = '', got = 0;
    return (function pump() {
      return r.read().then(function (x) {
        if (x.done) { onPiece(buf, true); return; }
        buf += x.value; got += x.value.length;
        buf = onPiece(buf, false);
        if (onProgress) onProgress(got);
        return pump();
      });
    })();
  }

  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  function unesc(s) {
    return s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, function (m, g) {
      if (g[0] === '#') return String.fromCharCode(g[1] === 'x' || g[1] === 'X' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10));
      return ENT[g] != null ? ENT[g] : m;
    });
  }
  function siText(seg) {
    var out = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g, m;
    var noPh = seg.replace(/<rPh[\s\S]*?<\/rPh>/g, '');
    while ((m = re.exec(noPh))) out += m[1] || '';
    return unesc(out);
  }
  function colIdx(ref) {
    var n = 0;
    for (var i = 0; i < ref.length; i++) { var c = ref.charCodeAt(i); if (c < 65 || c > 90) break; n = n * 26 + (c - 64); }
    return n - 1;
  }

  /** Baca sheet pertama. onRow(cells[]) dipanggil per baris (array nilai mentah per kolom). */
  function readFirstSheet(u8, onRow, onProgress) {
    var ents = zipEntries(u8);
    var sst = [];
    var wbE = ents['xl/workbook.xml'], relE = ents['xl/_rels/workbook.xml.rels'];
    var sheetPath = null;
    return Promise.all([wbE ? readText(u8, wbE) : '', relE ? readText(u8, relE) : '']).then(function (x) {
      var m = x[0].match(/<sheet\b[^>]*\br:id="([^"]+)"/) || x[0].match(/<sheet\b[^>]*\bid="([^"]+)"/);
      if (m) {
        var re = new RegExp('<Relationship\\b[^>]*Id="' + m[1] + '"[^>]*Target="([^"]+)"'), r2 = x[1].match(re);
        if (!r2) r2 = x[1].match(new RegExp('<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="' + m[1] + '"'));
        if (r2) sheetPath = r2[1].replace(/^\/?xl\//, '').replace(/^\//, '');
      }
      if (!sheetPath || !ents['xl/' + sheetPath]) {
        sheetPath = Object.keys(ents).filter(function (k) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(k); }).sort()[0];
        if (!sheetPath) throw new Error('Sheet tidak ditemukan di file');
        sheetPath = sheetPath.slice(3);
      }
      var ss = ents['xl/sharedStrings.xml'];
      if (!ss) return;
      return streamPieces(u8, ss, function (buf) {
        var p = 0, i;
        while ((i = buf.indexOf('</si>', p)) >= 0) {
          var st = buf.lastIndexOf('<si', i);
          sst.push(siText(buf.slice(st, i)));
          p = i + 5;
        }
        return buf.slice(p);
      });
    }).then(function () {
      var ent = ents['xl/' + sheetPath];
      var total = ent.comp * 8; // perkiraan ukuran teks
      var cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      return streamPieces(u8, ent, function (buf) {
        var p = 0, i;
        while ((i = buf.indexOf('</row>', p)) >= 0) {
          var st = buf.indexOf('<row', p);
          var seg = buf.slice(st, i);
          var cells = [], m, auto = 0;
          cellRe.lastIndex = 0;
          while ((m = cellRe.exec(seg))) {
            var at = m[1], inner = m[2] || '';
            var rm = at.match(/\br="([A-Z]+)\d*"/), tm = at.match(/\bt="(\w+)"/);
            var c = rm ? colIdx(rm[1]) : auto;
            auto = c + 1;
            var t = tm ? tm[1] : 'n', v = null;
            if (t === 'inlineStr') { v = siText(inner); }
            else {
              var vm = inner.match(/<v>([\s\S]*?)<\/v>/);
              if (vm) {
                if (t === 's') v = sst[Number(vm[1])];
                else if (t === 'str' || t === 'e') v = unesc(vm[1]);
                else if (t === 'b') v = vm[1] === '1';
                else v = Number(vm[1]);
              }
            }
            cells[c] = v;
          }
          onRow(cells);
          p = i + 6;
        }
        return buf.slice(p);
      }, onProgress ? function (got) { onProgress(Math.min(0.99, got / total)); } : null);
    });
  }

  function toIso(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') {
      if (v < 20000 || v > 80000) return '';
      var d = new Date(Math.round((v - 25569) * 864e5));
      return d.toISOString().slice(0, 10);
    }
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    if ((m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/))) {
      var a = Number(m[1]), b2 = Number(m[2]), y = Number(m[3]); if (y < 100) y += 2000;
      var mo = a, dd = b2;           // format sistem: bulan/tanggal/tahun
      if (a > 12) { mo = b2; dd = a; } // jaga-jaga bila tanggal/bulan/tahun
      return y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + dd).slice(-2);
    }
    return '';
  }
  function num(v) { if (typeof v === 'number') return v; var n = Number(String(v || '').replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; }
  function txt(v) { return v == null ? '' : String(v).trim(); }
  function colorOf(desc) { var p = String(desc || '').split(','); return p.length >= 3 ? p[p.length - 2].trim().toUpperCase() : ''; }
  function nameOf(desc) { var p = String(desc || '').split(','); return (p.length >= 3 ? p.slice(0, p.length - 2).join(',') : p[0]).trim(); }

  /**
   * Proses file master: kumpulkan per varian (generic + warna).
   * opts.keep(generic, dibuatTerbaru) → true bila varian disimpan.
   * Hasil: { rows: [[varian, generic, nama, warna, dibuat, dibuat_terbaru, season, collection, story, gender, activity, lv2, lv3, lv4, dc, status, grade, harga]], artikel: n }
   */
  function processMaster(u8, opts) {
    opts = opts || {};
    var idx = null, V = {}, artikel = 0;
    return readFirstSheet(u8, function (cells) {
      if (!idx) {
        var h = cells.map(function (x) { return txt(x).toLowerCase(); });
        if (h.indexOf('article') >= 0 && h.indexOf('generic code') >= 0) {
          idx = {};
          Object.keys(COLS).forEach(function (k) { idx[k] = h.indexOf(COLS[k].toLowerCase()); });
        }
        return;
      }
      var art = txt(cells[idx.article]);
      if (!art) return;
      artikel++;
      var gen = txt(cells[idx.generic]) || art.slice(0, 9);
      var desc = txt(cells[idx.desc]);
      var cross = idx.cross >= 0 ? txt(cells[idx.cross]) : '';
      var w = cross.indexOf('.') > 0 ? cross.split('.').slice(1).join('.').toUpperCase() : colorOf(desc);
      var key = gen + (w ? '.' + w : '');
      var d = toIso(cells[idx.created]);
      var o = V[key];
      if (!o) {
        o = V[key] = [key, gen, txt(cells[idx.descGen]) || nameOf(desc), w, d, d,
          txt(cells[idx.season]), txt(cells[idx.collection]), txt(cells[idx.story]), txt(cells[idx.gender]), txt(cells[idx.activity]),
          txt(cells[idx.lv2]), txt(cells[idx.lv3]), txt(cells[idx.lv4]), txt(cells[idx.dc]), txt(cells[idx.status]), txt(cells[idx.grade]), num(cells[idx.harga])];
      } else {
        if (d && (!o[4] || d < o[4])) o[4] = d;
        if (d && d > o[5]) o[5] = d;
        for (var j = 6; j <= 16; j++) {
          if (!o[j]) {
            var src = [idx.season, idx.collection, idx.story, idx.gender, idx.activity, idx.lv2, idx.lv3, idx.lv4, idx.dc, idx.status, idx.grade][j - 6];
            o[j] = txt(cells[src]);
          }
        }
        var hg = num(cells[idx.harga]); if (hg > o[17]) o[17] = hg;
      }
    }, opts.onProgress).then(function () {
      if (!idx) throw new Error('Kolom "Article" dan "Generic Code" tidak ditemukan. Pastikan file master artikel.');
      var rows = Object.keys(V).map(function (k) { return V[k]; });
      if (opts.keep) rows = rows.filter(function (r) { return opts.keep(r[1], r[5]); });
      return { rows: rows, artikel: artikel, varianTotal: Object.keys(V).length };
    });
  }

  function b64ToBytes(b64) {
    var bin = atob(b64), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  var api = { processMaster: processMaster, readFirstSheet: readFirstSheet, toIso: toIso, b64ToBytes: b64ToBytes,
    supported: function () { return typeof DecompressionStream !== 'undefined' && typeof TextDecoderStream !== 'undefined'; } };
  root.MasterXlsx = api;
})(this);
