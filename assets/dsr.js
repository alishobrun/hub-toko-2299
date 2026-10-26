/* Basecamp 2299 — pembaca file Item DSR & rumus sales.
 * Dipakai di browser (window.DSR) dan bisa diuji di Node (module.exports).
 * Rumus disamakan dengan Integrated Hub Jateng 01. */
(function (root) {
  'use strict';

  // Kolom yang disimpan, urutannya harus sama dengan DSR_FIELDS di Apps Script
  var FIELDS = ['invoice', 'order_no', 'tanggal', 'jam', 'status', 'tipe', 'sku', 'nama_sku', 'kat3', 'kat4', 'brand',
    'qty', 'harga', 'sales_person', 'gross', 'promo_value', 'promo_name', 'coupon', 'discount', 'net',
    'cust_key', 'cust_name', 'emp_disc'];

  var HEAD = {
    invoice: 'Invoice No', order_no: 'Order No', date: 'Order Date', status: 'Bill Status', tipe: 'Transaction Type',
    sku: 'SKU Code', nama_sku: 'Sku Name', kat3: 'Category Lv.3', kat4: 'Category Lv.4', brand: 'Brand',
    lokasi: 'Location', qty: 'Quantity', harga: 'Sale Price', sales_person: 'Sales Person', gross: 'Gross Amount',
    promo_value: 'Promotion Value', promo_name: 'Promotion Name', coupon: 'Coupon Value', discount: 'Discount Amount',
    net: 'Net Amount', emp_disc: 'Employee Discount', phone: 'Customer Phone', email: 'Customer Email', cust_name: 'Customer Name'
  };
  var REQUIRED = ['invoice', 'date', 'brand', 'nama_sku', 'qty', 'gross', 'net'];

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
  function pad(n) { n = Number(n); return (n < 10 ? '0' : '') + n; }

  function toDateTime(v, SSF) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) {
      return { d: v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate()), t: pad(v.getHours()) + ':' + pad(v.getMinutes()) + ':' + pad(v.getSeconds()) };
    }
    if (typeof v === 'number' && SSF && SSF.parse_date_code) {
      var p = SSF.parse_date_code(v);
      if (!p) return null;
      return { d: p.y + '-' + pad(p.m) + '-' + pad(p.d), t: pad(p.H) + ':' + pad(p.M) + ':' + pad(Math.floor(p.S)) };
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return { d: m[1] + '-' + m[2] + '-' + m[3], t: m[4] != null ? pad(m[4]) + ':' + m[5] + ':' + (m[6] || '00') : '00:00:00' };
    return null;
  }

  function toNum(x) {
    if (x == null || x === '') return 0;
    if (typeof x === 'number') return x;
    var v = Number(String(x).replace(/,/g, '').trim());
    return isNaN(v) ? 0 : v;
  }

  /** aoa: isi sheet sebagai array baris (array of arrays). */
  function parse(aoa, opts) {
    opts = opts || {};
    var hi = -1;
    for (var i = 0; i < Math.min(aoa.length, 50); i++) {
      var r = (aoa[i] || []).map(norm);
      if (r.indexOf('invoice no') >= 0 && r.indexOf('order date') >= 0) { hi = i; break; }
    }
    if (hi < 0) throw new Error('Kolom "Invoice No" dan "Order Date" tidak ditemukan. Pastikan file yang dipilih adalah Item DSR Report.');
    var head = aoa[hi].map(norm);
    var idx = {};
    Object.keys(HEAD).forEach(function (k) { idx[k] = head.indexOf(norm(HEAD[k])); });
    var miss = REQUIRED.filter(function (k) { return idx[k] < 0; });
    if (miss.length) throw new Error('Kolom berikut tidak ada di file: ' + miss.map(function (k) { return HEAD[k]; }).join(', '));

    var lokasi = '';
    for (var j = 0; j < hi; j++) {
      var mm = String((aoa[j] || [])[0] || '').match(/^\s*Location:\s*(.+)$/i);
      if (mm) lokasi = mm[1].replace(/\s+/g, ' ').trim();
    }

    var rows = [], bad = 0;
    for (var k = hi + 1; k < aoa.length; k++) {
      var row = aoa[k] || [];
      var inv = String(row[idx.invoice] == null ? '' : row[idx.invoice]).trim();
      if (!inv) continue;
      var dt = toDateTime(row[idx.date], opts.SSF);
      if (!dt) { bad++; continue; }
      var g = function (key) { return idx[key] >= 0 ? row[idx[key]] : null; };
      var t = function (key) { var x = g(key); return x == null ? '' : String(x).trim(); };
      if (!lokasi && idx.lokasi >= 0) lokasi = t('lokasi').replace(/\s+/g, ' ');
      rows.push({
        invoice: inv, order_no: t('order_no'), tanggal: dt.d, jam: dt.t, status: t('status'), tipe: t('tipe'),
        sku: t('sku'), nama_sku: t('nama_sku'), kat3: t('kat3'), kat4: t('kat4'), brand: t('brand'),
        qty: toNum(g('qty')), harga: toNum(g('harga')), sales_person: t('sales_person'), gross: toNum(g('gross')),
        promo_value: toNum(g('promo_value')), promo_name: t('promo_name'), coupon: toNum(g('coupon')),
        discount: toNum(g('discount')), net: toNum(g('net')),
        cust_key: '', cust_name: t('cust_name'), emp_disc: toNum(g('emp_disc')),
        _phone: t('phone'), _email: t('email')
      });
    }
    return { lokasi: lokasi, rows: rows, bad: bad };
  }

  /** Teks penanda customer (nama + HP/email tersensor). Di browser di-hash, tidak dikirim mentah. */
  function custSource(r) {
    var parts = [norm(r.cust_name), norm(r._phone), norm(r._email)];
    return parts.join('').length ? parts.join('|') : '';
  }

  function toArray(r) { return FIELDS.map(function (f) { return r[f] == null ? '' : r[f]; }); }

  /* ---------- rumus sales ---------- */

  /** Baris yang dihitung: barang dagangan brand EIGER, selain paper bag, voucher & barang bukan jual (kode 98…). */
  function isSalesLine(r) {
    return String(r.brand).trim().toUpperCase() === 'EIGER' && !/^98/.test(String(r.sku).trim())
      && !/PAPER\s*BAG|VOUCHER/i.test(String(r.nama_sku)) && String(r.kat4).trim().toUpperCase() !== 'VOUCHER';
  }

  /** Ringkasan per tanggal: bruto, netto, qty, transaksi (invoice unik). Retur ikut mengurangi. */
  function aggregateDaily(rows) {
    var by = {};
    rows.forEach(function (r) {
      if (!isSalesLine(r)) return;
      var o = by[r.tanggal] || (by[r.tanggal] = { tanggal: r.tanggal, bruto: 0, netto: 0, qty: 0, inv: {} });
      o.bruto += Number(r.gross) || 0;
      o.netto += Number(r.net) || 0;
      o.qty += Number(r.qty) || 0;
      o.inv[r.invoice] = 1;
    });
    return Object.keys(by).sort().map(function (d) {
      var o = by[d];
      return { tanggal: d, bruto: Math.round(o.bruto), netto: Math.round(o.netto), qty: o.qty, trx: Object.keys(o.inv).length };
    });
  }

  /** data: hasil API monitoring {tanggal, target, bobot:{tgl:{harian,kumulatif}}, harian:[...]}; mode 'bruto'|'netto' */
  function summarize(data, mode) {
    var key = mode === 'netto' ? 'netto' : 'bruto';
    var tgl = data.tanggal;
    var T = data.target == null ? null : Number(data.target);
    var b = (data.bobot || {})[tgl] || null;
    var upto = (data.harian || []).filter(function (h) { return h.tanggal <= tgl; });
    var day = (data.harian || []).filter(function (h) { return h.tanggal === tgl; })[0] || { bruto: 0, netto: 0, qty: 0, trx: 0 };
    var sum = function (k) { return upto.reduce(function (s, x) { return s + (Number(x[k]) || 0); }, 0); };
    var kSales = sum(key), kTrx = sum('trx'), kQty = sum('qty');
    var kT = T != null && b && b.kumulatif != null ? Math.round(T * b.kumulatif) : null;
    var dT = T != null && b && b.harian != null ? Math.round(T * b.harian) : null;
    var ds = Number(day[key]) || 0;
    return {
      mode: key, tanggal: tgl, bobot: b,
      monthly: { target: T, sales: kSales, ach: T ? kSales / T : null, diff: T != null ? kSales - T : null },
      kum: { target: kT, sales: kSales, ach: kT ? kSales / kT : null, diff: kT != null ? kSales - kT : null,
        trx: kTrx, qty: kQty, upt: kTrx ? kQty / kTrx : null, basket: kTrx ? kSales / kTrx : null },
      daily: { target: dT, sales: ds, ach: dT ? ds / dT : null, diff: dT != null ? ds - dT : null,
        trx: day.trx, qty: day.qty, upt: day.trx ? day.qty / day.trx : null, basket: day.trx ? ds / day.trx : null }
    };
  }

  var api = { FIELDS: FIELDS, parse: parse, custSource: custSource, toArray: toArray, isSalesLine: isSalesLine, aggregateDaily: aggregateDaily, summarize: summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DSR = api;
})(this);
