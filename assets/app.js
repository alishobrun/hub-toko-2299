/* Basecamp 2299 — aplikasi web (tanpa framework). */
(function () {
  'use strict';

  var CFG = window.HUB_CONFIG || {};
  var APP = CFG.APP_NAME || ('Basecamp ' + (CFG.STORE || ''));

  // append/replaceChildren bawaan browser menulis null sebagai teks "null"; abaikan null/false
  ['append', 'replaceChildren'].forEach(function (m) {
    var orig = Element.prototype[m];
    Element.prototype[m] = function () {
      var args = [];
      (function flat(a) { for (var i = 0; i < a.length; i++) { var x = a[i]; if (Array.isArray(x)) flat(x); else if (x != null && x !== false) args.push(x); } })(arguments);
      return orig.apply(this, args);
    };
  });
  var S = { notif: null, badges: { admin: 0, request: 0, tukar: 0 }, token: null, user: null, menunggu: 0, mode: 'bruto', fmt: 'penuh', mon: null, jadwal: null, info: null };

  /* ---------- util ---------- */
  var store = {
    get: function (k) { try { return localStorage.getItem('hub2299.' + k); } catch (e) { return null; } },
    set: function (k, v) { try { v == null ? localStorage.removeItem('hub2299.' + k) : localStorage.setItem('hub2299.' + k, v); } catch (e) {} }
  };
  S.token = store.get('token');
  try { S.user = JSON.parse(store.get('user') || 'null'); } catch (e) { S.user = null; }
  S.mode = store.get('mode') === 'netto' ? 'netto' : 'bruto';
  S.fmt = store.get('fmt') === 'ringkas' ? 'ringkas' : 'penuh';

  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v; // hanya untuk ikon SVG statis
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(parent, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(parent, x); }); return; }
    parent.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  function $(s, r) { return (r || document).querySelector(s); }

  var nf = new Intl.NumberFormat('id-ID');
  function fNum(v) { return v == null || isNaN(v) ? '—' : nf.format(Math.round(v)); }
  function fRp(v) {
    if (v == null || isNaN(v)) return '—';
    if (S.fmt === 'ringkas') return (v / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' jt';
    return nf.format(Math.round(v));
  }
  function fRpShort(v) {
    if (v == null || isNaN(v)) return '—';
    var a = Math.abs(v);
    if (a >= 1e9) return 'Rp ' + (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' M';
    if (a >= 1e6) return 'Rp ' + (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
    return 'Rp ' + nf.format(Math.round(v));
  }
  function fPct(v, d) { return v == null || isNaN(v) ? '—' : (v * 100).toLocaleString('id-ID', { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }) + '%'; }
  function fDec(v) { return v == null || isNaN(v) ? '—' : v.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function achClass(v) { return v == null || isNaN(v) ? 'none' : v >= 1 ? 'good' : v >= 0.95 ? 'warn' : 'bad'; }
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BUL3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  function dParts(iso) { var p = String(iso).split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function dShort(iso) { var p = dParts(iso); return p.d + ' ' + BUL3[p.m - 1] + ' ' + p.y; }
  function dLong(iso) { var p = dParts(iso); var w = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); return HARI[w] + ', ' + p.d + ' ' + BULAN[p.m - 1] + ' ' + p.y; }
  function dDayName(iso) { var p = dParts(iso); return HARI[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()].slice(0, 3); }
  function todayJkt() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()); }
  function nowJkt() { return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date()); }

  var toastTimer;
  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 3500);
  }

  /* ---------- API ---------- */
  function api(action, payload) {
    var body = Object.assign({ action: action, token: S.token }, payload || {});
    return fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) {
        if (!r.ok) throw new Error('Server tidak merespons (' + r.status + ')');
        return r.json();
      }, function () { throw new Error('Tidak bisa terhubung. Periksa koneksi internet.'); })
      .then(function (res) {
        if (!res.ok) {
          if (res.auth) { setSession(null, null); go('login'); }
          throw new Error(res.error || 'Terjadi kesalahan');
        }
        return res.data;
      });
  }
  function setSession(token, user) {
    S.token = token; S.user = user;
    store.set('token', token); store.set('user', user ? JSON.stringify(user) : null);
    S.mon = null; S.jadwal = null; S.info = null;
  }

  /* ---------- ikon ---------- */
  var IC = {
    logo: '<svg viewBox="0 0 64 64"><path d="M8 46 26 22l9 12 7-9 14 21z" fill="#fff"/><path d="M8 54h48" stroke="#F26B3A" stroke-width="6" stroke-linecap="round"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14l4-4"/><path d="M3.5 18a9 9 0 1 1 17 0"/><circle cx="12" cy="14" r="1.5"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/></svg>',
    clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2.5h6V4M8.5 11h7M8.5 15h7M8.5 19h4"/></svg>',
    scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 21h14M6 7h12"/><path d="M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1.5 3h5L16 13h5"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1c-1-.4-1.8-1.2-2.2-2.2l1-1-1-2z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17l9-10"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    sunset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 17a5 5 0 0 0-10 0M12 3v6M8.5 6.5 12 3l3.5 3.5M2 21h20M4.2 12.2l1.4 1.4M18.4 13.6l1.4-1.4M2 17h2M20 17h2"/></svg>',
    coffee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2.5v3M12 2.5v3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M16 8v8"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M4 19h16"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M3 9h18M9 20v-6h6v6"/></svg>'
  };
  function icon(name, cls) { return el('span', { class: 'ic' + (cls ? ' ' + cls : ''), html: IC[name], 'aria-hidden': 'true' }); }

  /* ---------- router & menu ---------- */
  var GROUPS = [
    { id: 'beranda', label: 'Beranda', icon: 'home', color: '#F26B3A', items: [{ icon: 'home', id: 'beranda', label: 'Beranda' }] },
    { id: 'sales', label: 'Sales', icon: 'chart', color: '#4C8DFF', items: [
      { icon: 'gauge', id: 'monitoring', label: 'Monitoring Sales', desc: 'Achievement, UPT & basket' },
      { icon: 'sun', id: 'briefing', label: 'Briefing Pagi', desc: 'Teks briefing WA + fokus otomatis' },
      { icon: 'file', id: 'mingguan', label: 'Laporan Mingguan', desc: 'Ringkasan minggu, Excel/PDF/WA' },
      { icon: 'clip', id: 'pica', label: 'Analisa PICA', desc: 'Problem & corrective action, salin WA' },
      { icon: 'trend', id: 'trend', label: 'Sales Trend', desc: 'Per jam & per hari' },
      { icon: 'award', id: 'ra', label: 'RA Performance', desc: 'Sales per orang' },
      { icon: 'tag', id: 'produk', label: 'Produk & Promo', desc: 'Kategori, terlaris & promo' },
      { icon: 'heart', id: 'customer', label: 'Customer & Retur', desc: 'Member & barang kembali' }] },
    { id: 'inventory', label: 'Inventory', icon: 'box', color: '#14B8A6', items: [
      { icon: 'box', id: 'stok', label: 'Monitoring Stok', desc: 'Stok, rasio & display dari SOH' },
      { icon: 'star', id: 'stokart', label: 'Stok Artikel', desc: 'New Arrival, season & collection' },
      { icon: 'eye', id: 'display', label: 'Cek Display', desc: 'Barang belum terdisplay & display double' },
      { icon: 'search', id: 'cari', label: 'Cari Barang', desc: 'Lokasi bin per SKU, scan barcode' },
      { icon: 'inbox', id: 'saranreq', label: 'Saran Request', desc: 'Laris tapi stok tipis/habis' }] },
    { id: 'kasg', label: 'Kas', icon: 'cash', color: '#22C55E', items: [
      { icon: 'cash', id: 'kas', label: 'Cek Kas', desc: 'Till, Store Safe, Floating, Petty' },
      { icon: 'scale', id: 'kas-rekap', label: 'Rekap Selisih', desc: 'Selisih kas per orang' }] },
    { id: 'data', label: 'Data', icon: 'upload', color: '#A78BFA', items: [
      { icon: 'upload', id: 'unggah', label: 'Unggah DSR', desc: 'Perbarui data penjualan' },
      { icon: 'box', id: 'unggahbin', label: 'Unggah By Bin', desc: 'Perbarui stok per bin' },
      { icon: 'video', id: 'dokumentasi', label: 'Dokumentasi', desc: 'Video opening & closing' }] },
    { id: 'tim', label: 'Tim', icon: 'users', color: '#FB923C', items: [
      { icon: 'bell', id: 'pengumuman', label: 'Pengumuman', desc: 'Info tim + tanda sudah baca' },
      { icon: 'clip', id: 'handover', label: 'Handover', desc: 'Serah terima shift dari foto buku' },
      { icon: 'star', id: 'apresiasi', label: 'Apresiasi', desc: 'Ucapan terima kasih untuk rekan' },
      { icon: 'heart', id: 'feedback', label: 'Feedback Anonim', desc: 'Saran & apresiasi tanpa nama' },
      { icon: 'cal', id: 'jadwal', label: 'Jadwal', desc: 'Shift tim per periode' },
      { icon: 'inbox', id: 'request', label: 'Request Jadwal', desc: 'Ajukan OFF, cuti atau shift' },
      { icon: 'swap', id: 'tukar', label: 'Tukar Shift', desc: 'Tukar shift dengan rekan' },
      { icon: 'bookmark', id: 'simpanan', label: 'Simpanan OFF', desc: 'OFF yang belum diambil' },
      { icon: 'user', id: 'akun', label: 'Akun', desc: 'Ganti password' },
      { icon: 'shield', id: 'admin', label: 'Admin', desc: 'Akun tim & pengaturan', admin: true },
      { icon: 'list', id: 'aktivitas', label: 'Aktivitas', desc: 'Catatan siapa melakukan apa', admin: true }] }
  ];
  var VIEWS = {};
  function routeOf(id) {
    for (var i = 0; i < GROUPS.length; i++) for (var j = 0; j < GROUPS[i].items.length; j++) if (GROUPS[i].items[j].id === id) return { g: GROUPS[i], r: GROUPS[i].items[j] };
    return null;
  }
  function isAdmin() { return S.user && S.user.role === 'admin'; }
  function current() { return (location.hash.replace(/^#\/?/, '') || 'beranda').split('?')[0]; }
  function go(id) { if (current() === id) render(); else location.hash = '#/' + id; }
  window.addEventListener('hashchange', render);

  function render() {
    var app = $('#app');
    closeMenu();
    if (!CFG.API_URL) { app.replaceChildren(viewSetup()); return; }
    if (!S.token) { app.replaceChildren(viewLogin()); return; }
    var id = current();
    if (id === 'login') { location.hash = '#/beranda'; return; }
    var m = routeOf(id) || routeOf('beranda');
    if (m.r.admin && !isAdmin()) m = routeOf('beranda');
    if (!S.meChecked) { S.meChecked = true; refreshMe(); }
    app.replaceChildren(shell(m));
    loadNotif(false); startNotifPolling(); masterAuto();
    VIEWS[m.r.id]($('#view'));
    window.scrollTo(0, 0);
  }

  var menuEl = null;
  function closeMenu() {
    if (menuEl) { var m = menuEl; menuEl = null; m.classList.add('closing'); setTimeout(function () { m.remove(); }, 180); }
    document.body.classList.remove('no-scroll');
    closeBell();
  }
  document.addEventListener('click', function (e) {
    if (bellEl && !e.target.closest('.bell-pop') && !e.target.closest('.bell-btn')) closeBell();
  });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  function visibleItems(g) { return g.items.filter(function (x) { return !x.admin || isAdmin(); }); }
  function badgeCount(id) { var b = S.badges || {}; return id === 'admin' ? b.admin : id === 'request' ? b.request : id === 'tukar' ? b.tukar : id === 'pengumuman' ? b.peng : id === 'feedback' ? b.fb : id === 'handover' ? b.ho : 0; }
  function groupCount(g) { return visibleItems(g).reduce(function (n, x) { return n + (badgeCount(x.id) || 0); }, 0); }
  function badgeEl(n, cls) { return el('span', { class: 'nbadge' + (cls ? ' ' + cls : ''), 'data-n': n || 0, text: n > 99 ? '99+' : String(n || '') }); }
  function getFold() { try { return JSON.parse(store.get('fold') || '[]'); } catch (e) { return []; } }

  // Menu bawah di HP
  var BOTTOM = [
    { id: 'beranda', label: 'Beranda', icon: 'home', groups: ['beranda'] },
    { id: 'monitoring', label: 'Sales', icon: 'chart', groups: ['sales'] },
    { id: 'kas', label: 'Kas', icon: 'cash', groups: ['kasg'] },
    { id: 'jadwal', label: 'Jadwal', icon: 'cal', routes: ['jadwal', 'request', 'tukar', 'simpanan'], badge: ['request', 'tukar'] },
    { id: '_menu', label: 'Menu', icon: 'grid', badge: ['admin', 'pengumuman', 'feedback', 'handover'] }
  ];

  function shell(m) {
    var fold = getFold();
    var side = el('nav', { class: 'snav' }, GROUPS.map(function (g) {
      var items = visibleItems(g);
      if (g.id === 'beranda') {
        return el('a', { href: '#/beranda', class: 'snav-home', style: '--c:' + g.color, 'aria-current': m.r.id === 'beranda' ? 'page' : null },
          el('span', { class: 'tile' }, icon(g.icon)), el('span', { class: 'lbl', text: 'Beranda' }));
      }
      var folded = fold.indexOf(g.id) >= 0 && g !== m.g;
      var grp = el('div', { class: 'snav-group' + (folded ? ' folded' : '') + (g === m.g ? ' cur' : ''), style: '--c:' + g.color });
      var head = el('button', { type: 'button', class: 'snav-head', 'aria-expanded': String(!folded), onclick: function () {
        var f = getFold(), i = f.indexOf(g.id);
        if (grp.classList.toggle('folded')) { if (i < 0) f.push(g.id); } else if (i >= 0) f.splice(i, 1);
        head.setAttribute('aria-expanded', String(!grp.classList.contains('folded')));
        store.set('fold', JSON.stringify(f));
      } }, el('span', { class: 'dotc' }), el('span', { class: 'lbl', text: g.label }), badgeEl(groupCount(g), 'grp'), el('span', { class: 'chev' }, icon('chev')));
      var list = el('div', { class: 'snav-items' }, el('div', { class: 'snav-in' }, items.map(function (x) {
        return el('a', { href: '#/' + x.id, class: 'snav-item', 'data-id': x.id, 'aria-current': x.id === m.r.id ? 'page' : null },
          el('span', { class: 'tile' }, icon(x.icon)), el('span', { class: 'lbl', text: x.label }), badgeEl(badgeCount(x.id)));
      })));
      grp.append(head, list);
      return grp;
    }));

    var bottom = el('nav', { class: 'bnav', 'aria-label': 'Menu utama' }, BOTTOM.map(function (b) {
      var on = b.id === '_menu' ? !BOTTOM.some(function (x) { return x.id !== '_menu' && bottomOn(x, m); }) : bottomOn(b, m);
      var cnt = (b.badge || []).reduce(function (n, k) { return n + (badgeCount(k) || 0); }, 0);
      var g = b.groups ? GROUPS.filter(function (x) { return x.id === b.groups[0]; })[0] : b.routes ? GROUPS.filter(function (x) { return x.id === 'tim'; })[0] : null;
      var a = el('a', { href: b.id === '_menu' ? '#' : '#/' + b.id, class: 'bnav-a' + (on ? ' on' : ''), 'data-b': b.id, style: '--c:' + (g ? g.color : (on ? m.g.color : '#94A3B8')), 'aria-current': on ? 'page' : null },
        el('span', { class: 'bnav-ic' }, icon(b.icon), badgeEl(cnt, 'dot')), el('span', { class: 'bnav-l', text: b.label }));
      if (b.id === '_menu') a.addEventListener('click', function (e) { e.preventDefault(); openSheet(m); });
      return a;
    }));

    var refreshBtn = el('button', { class: 'icon-btn', title: 'Muat ulang data', 'aria-label': 'Muat ulang data', html: IC.refresh, onclick: function () {
      S.mon = null; S.jadwal = null; S.info = null; S.lap = {}; S.cust = null; S.stok = null; S.tim = null; S.bin = null; S.master = null; loadNotif(true); render(); toast('Data dimuat ulang');
    } });
    var bell = el('button', { class: 'bell-btn', type: 'button', title: 'Notifikasi', 'aria-label': 'Notifikasi', onclick: function (e) { e.stopPropagation(); bellEl ? closeBell() : openBell(); } },
      icon('bell'), badgeEl(S.notif ? S.notif.unread : 0, 'bell-n'));
    var crumb = m.r.id === 'beranda' ? el('span', { class: 'crumb' }, el('b', { text: 'Beranda' }))
      : el('span', { class: 'crumb', style: '--c:' + m.g.color }, el('span', { class: 'crumb-g' }, el('span', { class: 'dotc' }), m.g.label), el('span', { class: 'crumb-sep', text: '›' }), el('b', { text: m.r.label }));
    return el('div', { class: 'shell' },
      el('aside', { class: 'side' },
        el('div', { class: 'brand' }, el('div', { class: 'logo-plate' }, el('img', { src: 'assets/logo.png', alt: 'Eigerindo MPI' })),
          el('div', { class: 'brand-txt' }, el('b', { text: APP }), el('span', { text: CFG.STORE_NAME }))),
        side,
        el('div', { class: 'side-foot' }, el('div', { text: 'Dibuat oleh' }), el('b', { text: 'Ali Muhammad Shobrun' }))),
      el('div', { class: 'main-col' },
        el('header', { class: 'topbar' },
          el('div', { class: 'topbar-in' },
            el('a', { class: 'brand-sm', href: '#/beranda', 'aria-label': 'Beranda' }, el('img', { src: 'assets/logo.png', alt: 'Eigerindo MPI' })),
            el('span', { class: 'page-title' }, crumb),
            el('span', { class: 'user-name', text: S.user ? S.user.nama : '' }),
            el('span', { class: 'chip' }, icon('store'), CFG.STORE),
            bell,
            refreshBtn,
            el('button', { class: 'btn-out', text: 'Keluar', onclick: logout })),
          m.r.id === 'beranda' ? null : el('div', { class: 'm-crumb', style: '--c:' + m.g.color },
            el('span', { class: 'tile' }, icon(m.r.icon)), el('div', null, el('small', { text: m.g.label }), el('b', { text: m.r.label })))),
        el('main', { class: 'view', id: 'view' }),
        el('footer', { class: 'credit' }, APP + ' · Dibuat oleh ', el('b', { text: 'Ali Muhammad Shobrun' }))),
      bottom);
  }
  function bottomOn(b, m) {
    if (b.id === '_menu') return false;
    if (b.routes) return b.routes.indexOf(m.r.id) >= 0;
    return b.groups.indexOf(m.g.id) >= 0;
  }

  function openSheet(m) {
    closeMenu();
    document.body.classList.add('no-scroll');
    var panel = el('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Semua menu' },
      el('div', { class: 'sheet-grip' }),
      el('div', { class: 'sheet-head' }, el('b', { text: 'Semua menu' }), el('button', { class: 'sheet-x', 'aria-label': 'Tutup', html: IC.x, onclick: closeMenu })),
      el('div', { class: 'sheet-body' }, GROUPS.filter(function (g) { return g.id !== 'beranda'; }).map(function (g) {
        return el('section', { class: 'sheet-g', style: '--c:' + g.color },
          el('h4', null, el('span', { class: 'dotc' }), g.label),
          el('div', { class: 'sheet-grid' }, visibleItems(g).map(function (x) {
            var n = badgeCount(x.id);
            return el('a', { href: '#/' + x.id, class: 'sheet-tile' + (x.id === m.r.id ? ' on' : '') },
              el('span', { class: 'tile' }, icon(x.icon), n ? badgeEl(n, 'tile-n') : null), el('span', { class: 'lbl', text: x.label }));
          })));
      })));
    menuEl = el('div', { class: 'sheet-wrap', onclick: function (e) { if (e.target === menuEl) closeMenu(); } }, panel);
    document.body.appendChild(menuEl);
  }

  /* ---------- notifikasi (lonceng) ---------- */
  var bellEl = null, notifTimer = null, notifAt = 0;
  function loadNotif(force) {
    if (!S.token) return Promise.resolve(null);
    if (!force && S.notif && Date.now() - notifAt < 60000) { paintBadges(); return Promise.resolve(S.notif); }
    notifAt = Date.now();
    return api('notif').then(function (d) {
      S.notif = d; S.badges = d.badges || S.badges; S.menunggu = (d.badges || {}).admin || 0;
      paintBadges();
      if (bellEl) drawBell();
      return d;
    }).catch(function () { return null; });
  }
  function startNotifPolling() {
    if (notifTimer) return;
    notifTimer = setInterval(function () { if (S.token && document.visibilityState === 'visible') loadNotif(true); }, 180000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Date.now() - notifAt > 60000) loadNotif(true); });
  }
  function setBadge(node, n) { if (!node) return; node.setAttribute('data-n', n || 0); node.textContent = n ? (n > 99 ? '99+' : String(n)) : ''; }
  function paintBadges() {
    setBadge($('.bell-n'), S.notif ? S.notif.unread : 0);
    document.querySelectorAll('.snav-item').forEach(function (a) { setBadge(a.querySelector('.nbadge'), badgeCount(a.getAttribute('data-id'))); });
    document.querySelectorAll('.snav-group').forEach(function (gEl, i) {
      var g = GROUPS.filter(function (x) { return x.id !== 'beranda'; })[i];
      if (g) setBadge(gEl.querySelector('.nbadge.grp'), groupCount(g));
    });
    document.querySelectorAll('.bnav-a').forEach(function (a) {
      var b = BOTTOM.filter(function (x) { return x.id === a.getAttribute('data-b'); })[0];
      if (b) setBadge(a.querySelector('.nbadge'), (b.badge || []).reduce(function (n, k) { return n + (badgeCount(k) || 0); }, 0));
    });
  }
  function closeBell() { if (bellEl) { var b = bellEl; bellEl = null; b.classList.add('closing'); setTimeout(function () { b.remove(); }, 160); } }
  function openBell() {
    closeBell();
    bellEl = el('div', { class: 'bell-pop', role: 'dialog', 'aria-label': 'Notifikasi' });
    $('.topbar').appendChild(bellEl);
    drawBell();
    loadNotif(true);
  }
  var NJ = { feedback: 'heart', apresiasi: 'star', bin: 'box', pengumuman: 'bell', handover: 'clip', video: 'video', master: 'box', request: 'inbox', simpanan: 'bookmark', tukar: 'swap', akun: 'user', kas: 'cash', dsr: 'upload', sheet: 'file', batal: 'x', batas: 'alert' };
  function relTime(w) {
    var t = Date.parse(String(w).replace(' ', 'T') + '+07:00');
    if (isNaN(t)) return '';
    var s = (Date.now() - t) / 1000;
    if (s < 60) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' mnt lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    if (s < 172800) return 'kemarin';
    return dShort(String(w).slice(0, 10));
  }
  function drawBell() {
    if (!bellEl) return;
    var d = S.notif;
    var head = el('div', { class: 'bell-head' }, el('b', { text: 'Notifikasi' }),
      d && d.items.some(function (x) { return !x.live && !x.dibaca; }) ? el('button', { class: 'link-btn', text: 'Tandai semua dibaca', onclick: function (e) {
        e.stopPropagation();
        d.items.forEach(function (x) { if (!x.live) x.dibaca = true; });
        d.unread = d.items.filter(function (x) { return x.live; }).length;
        paintBadges(); drawBell();
        api('notifRead', { semua: true }).catch(function () {});
      } }) : null);
    if (!d) { bellEl.replaceChildren(head, el('div', { class: 'skel', style: 'margin:12px;height:80px' })); return; }
    var aksi = d.items.filter(function (x) { return x.live && x.level === 'aksi'; });
    var cek = d.items.filter(function (x) { return x.level === 'cek' && (x.live || !x.dibaca); });
    var lain = d.items.filter(function (x) { return aksi.indexOf(x) < 0 && cek.indexOf(x) < 0; }).slice(0, 25);
    function sec(title, arr, cls) {
      if (!arr.length) return null;
      return el('div', { class: 'bell-sec ' + cls }, el('div', { class: 'bell-sec-h' }, title, el('span', { text: arr.length })), arr.map(item));
    }
    function item(x) {
      var unread = x.live || !x.dibaca;
      var row = el('div', { class: 'nitem lv-' + x.level + (unread ? ' unread' : ''), tabindex: '0', role: 'button' },
        el('span', { class: 'nitem-ic' }, icon(NJ[x.jenis] || (x.level === 'ok' ? 'check' : 'info'))),
        el('div', { class: 'nitem-b' },
          el('b', { text: x.judul }),
          x.isi ? el('p', { text: x.isi }) : null,
          el('small', { text: relTime(x.waktu) }),
          x.aksi ? actions(x) : null),
        unread && !x.live ? el('span', { class: 'udot' }) : null);
      var openIt = function (e) {
        if (e.target.closest('button')) return;
        if (!x.live && !x.dibaca) { x.dibaca = true; d.unread = Math.max(0, d.unread - (x.level === 'info' ? 0 : 1)); paintBadges(); api('notifRead', { ids: [x.id] }).catch(function () {}); }
        closeBell();
        if (x.link) { if (location.hash === x.link) render(); else location.hash = x.link; }
      };
      row.addEventListener('click', openIt);
      row.addEventListener('keydown', function (e) { if (e.key === 'Enter') openIt(e); });
      return row;
    }
    function actions(x) {
      var t = x.aksi.tipe;
      var yes = t === 'ajak' ? 'Terima' : 'Setujui';
      var call = function (ok) {
        if (t === 'req') return api('reqDecide', { id: x.aksi.id, keputusan: ok ? 'setuju' : 'tolak' });
        if (t === 'tukar') return api('tukarDecide', { id: x.aksi.id, keputusan: ok ? 'setuju' : 'tolak' });
        if (t === 'akun') return api('setUserStatus', { username: x.aksi.id, status: ok ? 'aktif' : 'nonaktif' });
        if (t === 'ajak') return api('tukarRespond', { id: x.aksi.id, terima: ok });
      };
      var box = el('div', { class: 'nitem-act' });
      var bYes = el('button', { class: 'btn btn-primary btn-sm', text: yes });
      var bNo = el('button', { class: 'btn btn-ghost btn-sm', text: 'Tolak' });
      var armed = false, armT;
      function run(ok) {
        bYes.disabled = bNo.disabled = true;
        (ok ? bYes : bNo).textContent = 'Memproses…';
        call(ok).then(function (r) {
          toast((ok ? (t === 'ajak' ? 'Diterima' : 'Disetujui') : 'Ditolak') + (r && r.info ? ' · ' + r.info : ''));
          S.jadwal = null; S.tim = null;
          loadNotif(true).then(function () { if (/^(request|tukar|admin|jadwal|beranda)$/.test(current())) render(); });
        }).catch(function (err) { toast(err.message, true); bYes.disabled = bNo.disabled = false; bYes.textContent = yes; bNo.textContent = 'Tolak'; });
      }
      bYes.addEventListener('click', function (e) { e.stopPropagation(); run(true); });
      bNo.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!armed) { armed = true; bNo.textContent = 'Yakin tolak?'; bNo.classList.add('danger'); armT = setTimeout(function () { armed = false; bNo.textContent = 'Tolak'; bNo.classList.remove('danger'); }, 3000); return; }
        clearTimeout(armT); run(false);
      });
      box.append(bYes, bNo);
      return box;
    }
    var body = el('div', { class: 'bell-body' },
      sec('Perlu keputusan', aksi, 's-aksi'),
      sec('Perlu dicek', cek, 's-cek'),
      sec('Terbaru', lain, 's-lain'),
      !aksi.length && !cek.length && !lain.length ? el('div', { class: 'bell-empty' }, el('span', { class: 'tile' }, icon('bell')), el('b', { text: 'Semua beres' }), el('p', { text: 'Belum ada notifikasi.' })) : null);
    bellEl.replaceChildren(head, body);
  }

  function logout() {
    var t = S.token;
    setSession(null, null); S.notif = null; S.badges = { admin: 0, request: 0, tukar: 0 };
    if (t) api('logout', { token: t }).catch(function () {});
    location.hash = '#/login';
    render();
  }

  /* ---------- tampilan: belum tersambung ---------- */
  function viewSetup() {
    return el('div', { class: 'auth' }, el('div', { class: 'auth-card' },
      brandBlock(),
      el('p', { text: 'Web ini belum tersambung ke Apps Script. Isi API_URL di file assets/config.js dengan alamat Web App setelah deploy.' })));
  }
  function brandBlock() {
    return el('div', { class: 'auth-brand' }, el('img', { class: 'auth-logo', src: 'assets/logo.png', alt: 'Eigerindo MPI' }),
      el('div', null, el('h1', { text: APP }), el('p', { text: 'EIGER ' + CFG.STORE_NAME })));
  }

  /* ---------- login & daftar ---------- */
  function viewLogin() {
    var tab = 'masuk';
    var box = el('div');
    var segIn = el('button', { type: 'button', 'aria-pressed': 'true', text: 'Masuk', onclick: function () { tab = 'masuk'; draw(); } });
    var segUp = el('button', { type: 'button', 'aria-pressed': 'false', text: 'Daftar akun', onclick: function () { tab = 'daftar'; draw(); } });
    function msg(text, ok) { return el('div', { class: 'form-msg ' + (ok ? 'ok' : 'err'), text: text }); }
    function draw() {
      segIn.setAttribute('aria-pressed', String(tab === 'masuk'));
      segUp.setAttribute('aria-pressed', String(tab === 'daftar'));
      box.replaceChildren(tab === 'masuk' ? formMasuk() : formDaftar());
    }
    function formMasuk() {
      var u = el('input', { id: 'lg-u', autocomplete: 'username', autocapitalize: 'none', placeholder: 'Username', required: true });
      var p = el('input', { id: 'lg-p', type: 'password', autocomplete: 'current-password', required: true });
      var out = el('div');
      var btn = el('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Masuk' });
      var f = el('form', { onsubmit: function (e) {
        e.preventDefault(); btn.disabled = true; btn.textContent = 'Memeriksa…'; out.replaceChildren();
        api('login', { username: u.value, password: p.value }).then(function (d) {
          setSession(d.token, d.user); location.hash = '#/beranda'; render();
        }).catch(function (err) { out.replaceChildren(msg(err.message)); btn.disabled = false; btn.textContent = 'Masuk'; });
      } },
        el('div', { class: 'field' }, el('label', { for: 'lg-u', text: 'Username' }), u),
        el('div', { class: 'field' }, el('label', { for: 'lg-p', text: 'Password' }), p),
        btn, out,
        el('div', { class: 'auth-foot' }, 'Belum punya akun? ', el('a', { href: '#', onclick: function (e) { e.preventDefault(); tab = 'daftar'; draw(); }, text: 'Daftar di sini' })));
      return f;
    }
    function formDaftar() {
      var n = el('input', { id: 'rg-n', autocomplete: 'name', placeholder: 'Nama lengkap', required: true });
      var u = el('input', { id: 'rg-u', autocomplete: 'username', autocapitalize: 'none', placeholder: 'contoh: riska', required: true });
      var p = el('input', { id: 'rg-p', type: 'password', autocomplete: 'new-password', required: true, minlength: 6 });
      var p2 = el('input', { id: 'rg-p2', type: 'password', autocomplete: 'new-password', required: true });
      var out = el('div');
      var btn = el('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Daftar' });
      return el('form', { onsubmit: function (e) {
        e.preventDefault(); out.replaceChildren();
        if (p.value !== p2.value) { out.replaceChildren(msg('Ulangi password tidak sama')); return; }
        btn.disabled = true; btn.textContent = 'Mendaftarkan…';
        api('register', { nama: n.value, username: u.value, password: p.value }).then(function (d) {
          if (d.status === 'aktif') {
            out.replaceChildren(msg('Akun admin berhasil dibuat. Silakan masuk.', true));
          } else {
            out.replaceChildren(msg('Pendaftaran terkirim. Akun bisa dipakai setelah disetujui admin.', true));
          }
          btn.textContent = 'Terdaftar';
          setTimeout(function () { tab = 'masuk'; draw(); }, 2500);
        }).catch(function (err) { out.replaceChildren(msg(err.message)); btn.disabled = false; btn.textContent = 'Daftar'; });
      } },
        el('div', { class: 'field' }, el('label', { for: 'rg-n', text: 'Nama lengkap' }), n),
        el('div', { class: 'field' }, el('label', { for: 'rg-u', text: 'Username' }), u,
          el('small', { text: '3–20 karakter: huruf kecil, angka, titik atau garis bawah' })),
        el('div', { class: 'field' }, el('label', { for: 'rg-p', text: 'Password' }), p, el('small', { text: 'Minimal 6 karakter' })),
        el('div', { class: 'field' }, el('label', { for: 'rg-p2', text: 'Ulangi password' }), p2),
        btn, out);
    }
    draw();
    return el('div', { class: 'auth' }, el('div', { class: 'auth-card' },
      brandBlock(), el('div', { class: 'seg', role: 'group', 'aria-label': 'Masuk atau daftar' }, segIn, segUp), box,
      el('div', { class: 'auth-foot' }, 'Khusus tim toko ' + CFG.STORE + ' · Dibuat oleh ', el('b', { text: 'Ali Muhammad Shobrun' }))));
  }

  /* ---------- data loader ---------- */
  function loadMon(tanggal) {
    if (S.mon && (!tanggal || tanggal.slice(0, 7) === S.mon.bulan)) {
      if (tanggal) S.mon.tanggal = tanggal;
      return Promise.resolve(S.mon);
    }
    return api('monitoring', { tanggal: tanggal || '' }).then(function (d) { S.mon = d; return d; });
  }
  function loadJadwal() {
    if (S.jadwal) return Promise.resolve(S.jadwal);
    return api('jadwal').then(function (d) { S.jadwal = d; return d; });
  }
  function loadInfo() {
    return api('info').then(function (d) { S.info = d; return d; });
  }
  function refreshMe() {
    api('me').then(function (u) {
      var changed = !S.user || S.user.role !== u.role;
      S.user = { username: u.username, nama: u.nama, role: u.role };
      store.set('user', JSON.stringify(S.user));
      if (changed) render();
    }).catch(function () {});
  }

  function errBox(err) { return el('div', { class: 'err-box', text: err.message || String(err) }); }

  /* ---------- komponen KPI ---------- */
  function kpi(label, sub, value, note) {
    var c = achClass(value);
    return el('div', { class: 'kpi' },
      el('div', { class: 'k-label' }, label, sub ? el('small', { text: sub }) : null),
      el('div', { class: 'k-val' }, el('b', { class: 'c-' + c, text: fPct(value) }), note ? el('span', { text: note }) : null));
  }

  /* ---------- grafik batang harian ---------- */
  function dailyChart(data, mode) {
    var key = mode === 'netto' ? 'netto' : 'bruto';
    var p = dParts(data.tanggal);
    var nDays = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
    var byDate = {};
    (data.harian || []).forEach(function (h) { byDate[h.tanggal] = h; });
    var items = [];
    for (var d = 1; d <= nDays; d++) {
      var iso = data.bulan + '-' + (d < 10 ? '0' : '') + d;
      var b = (data.bobot || {})[iso];
      var h = byDate[iso];
      items.push({ iso: iso, d: d, v: h ? h[key] : null, trx: h ? h.trx : null, t: data.target != null && b ? Math.round(data.target * b.harian) : null });
    }
    var wrap = el('div', { class: 'chart' });
    var tip = el('div', { class: 'tip' });
    // gambar setelah elemen tampil, supaya ukuran huruf mengikuti lebar layar
    requestAnimationFrame(function () { draw(Math.max(300, Math.round(wrap.clientWidth || 700))); });
    return wrap;

    function draw(W) {
    var H = W < 520 ? 220 : 260, ml = 40, mr = 6, mt = 12, mb = 24;
    var max = 0;
    items.forEach(function (i) { max = Math.max(max, i.v || 0, i.t || 0); });
    if (!max) max = 1;
    var step = niceStep(max / 4); var top = Math.ceil(max / step) * step;
    var y = function (v) { return mt + (H - mt - mb) * (1 - Math.max(0, v) / top); };
    var bw = (W - ml - mr) / nDays;
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Sales harian dibanding target harian');
    function s(tag, a) { var e = document.createElementNS(NS, tag); Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); svg.appendChild(e); return e; }
    for (var g = 0; g <= top + 1; g += step) {
      s('line', { x1: ml, x2: W - mr, y1: y(g), y2: y(g), stroke: '#E4E9F2' });
      var tx = s('text', { x: ml - 6, y: y(g) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#5E6A85' });
      tx.textContent = g === 0 ? '0' : (g / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
    }
    items.forEach(function (i, idx) {
      var x = ml + idx * bw;
      if (i.v != null) {
        var cls = i.t ? achClass(i.v / i.t) : 'none';
        var col = { good: '#12876A', warn: '#C98A00', bad: '#C2392B', none: '#16379A' }[cls];
        var r = s('rect', { x: x + bw * 0.18, y: y(i.v), width: bw * 0.64, height: Math.max(0, y(0) - y(i.v)), rx: Math.min(4, bw * 0.3), fill: col, opacity: i.iso === data.tanggal ? 1 : 0.82 });
        r.style.cursor = 'pointer';
      }
      if (i.t != null) s('line', { x1: x + bw * 0.08, x2: x + bw * 0.92, y1: y(i.t), y2: y(i.t), stroke: '#0A1A4F', 'stroke-width': 2, 'stroke-dasharray': '3 2' });
      if (i.d === 1 || i.d % (bw < 18 ? 5 : 2) === 1 || i.d === nDays) {
        var lt = s('text', { x: x + bw / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 11, fill: i.iso === data.tanggal ? '#0A1A4F' : '#5E6A85', 'font-weight': i.iso === data.tanggal ? 700 : 400 });
        lt.textContent = i.d;
      }
      var hit = s('rect', { x: x, y: mt, width: bw, height: H - mt - mb, fill: 'transparent' });
      hit.addEventListener('mousemove', function (ev) { showTip(ev, i); });
      hit.addEventListener('click', function (ev) { showTip(ev, i); });
      hit.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    });
    function showTip(ev, i) {
      tip.replaceChildren(el('b', { text: dLong(i.iso) }),
        el('div', { text: 'Sales: ' + (i.v == null ? '—' : fRpShort(i.v)) }),
        el('div', { text: 'Target: ' + (i.t == null ? '—' : fRpShort(i.t)) + (i.v != null && i.t ? ' · ' + fPct(i.v / i.t) : '') }),
        i.trx != null ? el('div', { text: i.trx + ' transaksi' }) : null);
      tip.style.display = 'block';
      var rect = wrap.getBoundingClientRect();
      var x = ev.clientX - rect.left, yy = ev.clientY - rect.top;
      tip.style.left = Math.max(0, Math.min(rect.width - tip.offsetWidth, x - tip.offsetWidth / 2)) + 'px';
      tip.style.top = Math.max(0, yy - tip.offsetHeight - 12) + 'px';
    }
    wrap.replaceChildren(svg, tip);
    }
  }
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    var n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  /* ---------- Beranda ---------- */
  function viewBeranda(v) {
    var first = (S.user && S.user.nama || '').split(' ')[0];
    v.append(el('section', { class: 'hero' },
      el('div', null, el('h2', { text: 'Halo, ' + first + ' 👋' }), el('p', { text: 'EIGER ' + CFG.STORE_NAME })),
      el('div', { class: 'hero-right', id: 'hero-info', text: nowJkt() })));
    var kpis = el('div', { class: 'grid grid-3' }, el('div', { class: 'skel' }), el('div', { class: 'skel' }), el('div', { class: 'skel' }));
    v.append(kpis);
    v.append(pengBanner());
    v.append(hoBeranda());
    v.append(sayaCard());
    var row = el('div', { class: 'grid grid-2 section' });
    var duty = el('a', { class: 'card duty-card', href: '#/jadwal', title: 'Buka jadwal lengkap' }, el('h3', { text: 'Bertugas hari ini' }), el('p', { class: 'sub', text: dLong(todayJkt()) }), el('div', { class: 'skel' }));
    var chartCard = el('div', { class: 'card' }, el('h3', { text: 'Sales harian bulan ini' }), el('p', { class: 'sub', text: 'Batang = sales, garis putus-putus = target harian' }), el('div', { class: 'skel' }));
    row.append(chartCard, duty);
    v.append(row);
    var dokCard = el('a', { class: 'card dok-home section', href: '#/dokumentasi' }, el('div', { class: 'card-head' }, el('h3', { text: 'Dokumentasi hari ini' }), el('span', { class: 'duty-link' }, 'Unggah / lihat', icon('arrow'))), el('div', { class: 'skel', style: 'min-height:50px' }));
    api('dokList').then(function (d) {
      if (!d.siap && !d.items.length) { dokCard.remove(); return; }
      var tugas = ((S.notif && S.notif.items) || []).filter(function (x) { return /^live-dok-/.test(x.id); });
      dokCard.replaceChildren(el('div', { class: 'card-head' }, el('h3', null, 'Dokumentasi hari ini', tugas.length ? el('span', { class: 'tag tag-bad', style: 'margin-left:8px', text: 'Tugas kamu' }) : null), el('span', { class: 'duty-link' }, 'Unggah / lihat', icon('arrow'))), dokStatusEl(d));
      if (tugas.length) dokCard.setAttribute('href', tugas[0].link);
    }).catch(function () { dokCard.remove(); });
    v.append(dokCard);
    v.append(apBeranda());
    v.append(el('div', { class: 'quick section' },
      el('a', { href: '#/briefing' }, icon('sun'), 'Briefing Pagi', el('span', { text: 'Teks WA untuk tim' })),
      el('a', { href: '#/unggah' }, icon('upload'), 'Unggah DSR', el('span', { text: 'Perbarui data sales' })),
      el('a', { href: '#/monitoring' }, icon('chart'), 'Monitoring', el('span', { text: 'Achievement & UPT' })),
      el('a', { href: '#/kas' }, icon('cash'), 'Cek Kas', el('span', { text: 'Hitung uang di laci' })),
      el('a', { href: '#/request' }, icon('cal'), 'Request Jadwal', el('span', { text: 'OFF, cuti, tukar shift' }))));

    loadInfo().then(function (info) {
      var h = $('#hero-info');
      if (!h) return;
      h.replaceChildren();
      if (info.unggahTerakhir) {
        var u = info.unggahTerakhir;
        h.append('Data sampai ', el('b', { text: dShort(info.dataSampai) }), el('br'),
          'Unggahan terakhir ' + fTime(u.waktu) + ' oleh ' + u.nama);
      } else h.append('Belum ada data. ', el('a', { href: '#/unggah', style: 'color:#fff;font-weight:700', text: 'Unggah DSR pertama →' }));
    }).catch(function () {});

    loadMon().then(function (d) {
      var sm = DSR.summarize(d, S.mode);
      var label = S.mode === 'netto' ? 'Netto' : 'Bruto';
      kpis.replaceChildren(
        kpi('Monthly Sales Achievement', BULAN[dParts(d.tanggal).m - 1] + ' · ' + label, sm.monthly.ach, fRpShort(sm.monthly.sales) + ' dari ' + fRpShort(sm.monthly.target)),
        kpi('Cumulative Sales Achievement', '1–' + dParts(d.tanggal).d + ' ' + BUL3[dParts(d.tanggal).m - 1], sm.kum.ach, fRpShort(sm.kum.sales) + ' dari ' + fRpShort(sm.kum.target)),
        kpi('Daily Sales Achievement', dShort(d.tanggal), sm.daily.ach, fRpShort(sm.daily.sales) + ' dari ' + fRpShort(sm.daily.target)));
      chartCard.replaceChildren(el('h3', { text: 'Sales harian ' + BULAN[dParts(d.tanggal).m - 1] }),
        el('p', { class: 'sub', text: label + ' · batang = sales, garis putus-putus = target harian' }),
        d.harian.length ? dailyChart(d, S.mode) : el('div', { class: 'empty', text: 'Belum ada data bulan ini' }));
    }).catch(function (err) { kpis.replaceChildren(errBox(err)); chartCard.lastChild.replaceWith(el('div', { class: 'empty', text: '—' })); });

    loadJadwal().then(function (j) {
      var hi = j.hariIni || todayJkt();
      duty.replaceChildren(
        el('div', { class: 'duty-head' },
          el('div', null, el('h3', { text: 'Bertugas hari ini' }), el('p', { class: 'sub', text: dLong(hi) + (j.tab ? ' · tab ' + j.tab : '') })),
          el('span', { class: 'duty-link' }, 'Jadwal lengkap', icon('arrow'))),
        dutyBlock(j, hi), dutyBesok(j, addDays(hi, 1)));
    }).catch(function (err) { duty.lastChild.replaceWith(errBox(err)); });
  }

  var SHIFT_NAME = { PD: 'Pagi (PD)', NS: 'NS', MC: 'MC', MD: 'Middle (MD)', SC: 'SC', SB: 'Siang (SB)', OFF: 'Libur', CT: 'Cuti' };
  var SHIFT_SHORT = { PD: 'Pagi', SB: 'Siang', MD: 'Middle', OFF: 'Libur', CT: 'Cuti' };
  var SHIFT_ORDER = ['PD', 'NS', 'MC', 'MD', 'SC', 'SB', 'OFF', 'CT'];
  var AV_COLORS = ['#2F6FDB', '#E0703A', '#1E9E74', '#8B5CF6', '#D9467A', '#0E9AA7', '#B7791F', '#4B5BD6'];
  function shiftTone(c) { return c === 'PD' ? 'pagi' : c === 'SB' ? 'siang' : (c === 'MD' || c === 'MC' || c === 'NS' || c === 'SC') ? 'middle' : 'off'; }
  function shiftIcon(c) { var t = shiftTone(c); return t === 'pagi' ? 'sun' : t === 'siang' ? 'sunset' : t === 'middle' ? 'sun' : 'coffee'; }
  function shortName(n) { return titleCase(String(n).replace(/\s+/g, ' ').trim()).split(' ').slice(0, 2).join(' '); }
  function initials(n) { var w = String(n).replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/); return ((w[0] || '')[0] || '').toUpperCase() + ((w[1] || '')[0] || '').toUpperCase(); }
  function avColor(n) { var h = 0; String(n).split('').forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; }); return AV_COLORS[h % AV_COLORS.length]; }
  function isMe(n) {
    if (!S.user) return false;
    var a = String(n).toUpperCase().replace(/[^A-Z\s]/g, '').trim().split(/\s+/);
    var b = String(S.user.nama || '').toUpperCase().replace(/[^A-Z\s]/g, '').trim().split(/\s+/);
    if (!a[0] || !b[0] || a[0] !== b[0]) return false;
    return a.length < 2 || b.length < 2 || a[1] === b[1];
  }
  function addDays(d, k) { var p = dParts(d); var x = new Date(Date.UTC(p.y, p.m - 1, p.d + k)); return x.toISOString().slice(0, 10); }
  function groupShift(j, i) {
    var by = {};
    j.staf.forEach(function (s) { var c = String(s.shift[i] || '').trim().toUpperCase() || '—'; (by[c] = by[c] || []).push(s.nama); });
    var codes = Object.keys(by).sort(function (a, b) { return (SHIFT_ORDER.indexOf(a) + 1 || 50) - (SHIFT_ORDER.indexOf(b) + 1 || 50); });
    return { by: by, codes: codes };
  }
  function dutyBlock(j, day) {
    var i = (j.tanggal || []).indexOf(day);
    if (i < 0) return el('div', { class: 'empty', text: 'Tanggal ini tidak ada di tab jadwal terbaru' });
    var g = groupShift(j, i);
    var work = g.codes.filter(function (c) { return shiftTone(c) !== 'off'; });
    var off = g.codes.filter(function (c) { return shiftTone(c) === 'off'; });
    var person = function (n) {
      var me = isMe(n);
      return el('li', { class: me ? 'me' : null },
        el('span', { class: 'av', style: 'background:' + avColor(n), text: initials(n) }),
        el('span', { class: 'nm', text: shortName(n) }),
        me ? el('span', { class: 'me-tag', text: 'Kamu' }) : null);
    };
    return el('div', { class: 'duty-wrap' },
      work.length ? el('div', { class: 'duty' }, work.map(function (c) {
        return el('div', { class: 'duty-col t-' + shiftTone(c) },
          el('div', { class: 'duty-top' },
            el('span', { class: 'duty-ic' }, icon(shiftIcon(c))),
            el('h4', { text: SHIFT_NAME[c] || c }),
            el('span', { class: 'duty-n', text: g.by[c].length + ' orang' })),
          el('ul', null, g.by[c].map(person)));
      })) : el('div', { class: 'empty', text: 'Tidak ada yang bertugas' }),
      off.map(function (c) {
        return el('div', { class: 'duty-off' },
          el('span', { class: 'duty-off-k' }, icon('coffee'), SHIFT_SHORT[c] || SHIFT_NAME[c] || c),
          el('ul', null, g.by[c].map(person)));
      }));
  }
  function dutyBesok(j, day) {
    var i = (j.tanggal || []).indexOf(day);
    var box = el('div', { class: 'duty-next' }, el('div', { class: 'duty-next-h' }, el('b', { text: 'Besok' }), el('span', { text: dLong(day) })));
    if (i < 0) { box.append(el('p', { class: 'muted', text: 'Jadwal besok ada di tab periode berikutnya.' })); return box; }
    var g = groupShift(j, i);
    box.append(el('div', { class: 'duty-next-list' }, g.codes.map(function (c) {
      return el('div', { class: 'dn-row t-' + shiftTone(c) },
        el('span', { class: 'dn-k' }, icon(shiftIcon(c)), SHIFT_SHORT[c] || c),
        el('span', { class: 'dn-v', text: g.by[c].map(function (n) { return shortName(n).split(' ')[0]; }).join(', ') }));
    })));
    return box;
  }
  function titleCase(s) { return String(s).toLowerCase().replace(/(^|\s)\S/g, function (m) { return m.toUpperCase(); }); }

  /* ---------- Monitoring Sales ---------- */
  function viewMonitoring(v) {
    var hero = el('section', { class: 'hero' },
      el('div', null, el('h2', { text: 'Monitoring Sales · ' + CFG.STORE_NAME }), el('p', { id: 'mon-sub', text: 'Memuat…' })),
      el('div', { class: 'hero-right' }, el('b', { text: APP }), el('br'), el('span', { text: 'diambil ' + nowJkt() + (S.user ? ' · ' + S.user.nama : '') })));
    var date = el('input', { type: 'date', id: 'mon-date' });
    var segMode = segmented([['netto', 'Netto'], ['bruto', 'Bruto']], S.mode, function (m) { S.mode = m; store.set('mode', m); draw(); });
    var segFmt = segmented([['penuh', 'Penuh'], ['ringkas', 'Ringkas (jt)']], S.fmt, function (m) { S.fmt = m; store.set('fmt', m); draw(); });
    var body = el('div', null, el('div', { class: 'grid grid-3' }, el('div', { class: 'skel' }), el('div', { class: 'skel' }), el('div', { class: 'skel' })));
    v.append(hero,
      el('div', { class: 'toolbar' },
        el('div', { class: 'field' }, el('label', { for: 'mon-date', text: 'Tanggal laporan' }), date),
        segMode, segFmt), body);

    date.addEventListener('change', function () {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) return;
      body.style.opacity = .5;
      loadMon(date.value).then(function () { body.style.opacity = 1; draw(); }).catch(function (e) { body.style.opacity = 1; toast(e.message, true); });
    });

    function draw() {
      var d = S.mon;
      if (!d) return;
      date.value = d.tanggal;
      date.max = d.dataSampai > todayJkt() ? d.dataSampai : todayJkt();
      var sm = DSR.summarize(d, S.mode);
      var p = dParts(d.tanggal);
      $('#mon-sub').textContent = '1 site · tanggal ' + dShort(d.tanggal) + ' · kumulatif 1–' + p.d + ' ' + BULAN[p.m - 1] + ' ' + p.y +
        (sm.bobot ? ' · bobot kumulatif ' + fPct(sm.bobot.kumulatif) : '') + ' · ' + (S.mode === 'netto' ? 'Netto' : 'Bruto');
      var warn = [];
      if (d.target == null) warn.push('Target bulan ini belum tersedia di sheet Target Jateng 01, jadi achievement belum bisa dihitung.');
      else if (!sm.bobot) warn.push('Bobot untuk tanggal ini belum ada di sheet Target Jateng 01.');
      if (d.tanggal > d.dataSampai) warn.push('Data DSR baru tersedia sampai ' + dShort(d.dataSampai) + '. Unggah DSR terbaru supaya angkanya lengkap.');

      body.replaceChildren(
        warn.length ? el('div', { class: 'err-box', style: 'background:#FCF3DC;color:#8A5F00' }, warn.map(function (w) { return el('div', { text: w }); })) : null,
        el('div', { class: 'grid grid-3' },
          kpi('Monthly Sales Achievement', null, sm.monthly.ach, null),
          kpi('Cumulative Sales Achievement', null, sm.kum.ach, null),
          kpi('Daily Sales Achievement', null, sm.daily.ach, null)),
        el('div', { class: 'card section only-wide', style: 'padding:0;overflow:hidden' }, el('div', { class: 'scroll-x' }, monTable(sm))),
        el('div', { class: 'grid grid-2 section only-narrow' }, monCard('Kumulatif 1–' + p.d + ' ' + BUL3[p.m - 1], sm.kum), monCard('Harian ' + dShort(d.tanggal), sm.daily),
          monCard('Bulan ' + BULAN[p.m - 1], sm.monthly, true)),
        el('div', { class: 'legend' },
          el('span', null, el('i', { class: 'bg-good' }), '≥100%'), el('span', null, el('i', { class: 'bg-warn' }), '95–100%'), el('span', null, el('i', { class: 'bg-bad' }), '<95%')),
        el('div', { class: 'wa-actions', style: 'margin:12px 0 4px' },
          el('a', { class: 'btn btn-wa', href: '#/pica' }, icon('whatsapp'), 'Laporan WA & Analisa PICA')),
        el('p', { class: 'note', text: 'Sales = ' + (S.mode === 'netto' ? 'Net Amount' : 'Gross Amount') + ' barang dagangan EIGER (paper bag, jasa & packing tidak dihitung; retur mengurangi). UPT = qty ÷ jumlah transaksi. Basket = sales ÷ jumlah transaksi. Target kumulatif = target bulan × bobot kumulatif s/d tanggal laporan. Target harian = target bulan × bobot hari itu.' }),
        el('div', { class: 'card section' }, el('h3', { text: 'Sales harian ' + BULAN[p.m - 1] + ' ' + p.y }),
          el('p', { class: 'sub', text: 'Batang = sales (warna sesuai achievement), garis putus-putus = target harian. Ketuk batang untuk detail.' }),
          d.harian.length ? dailyChart(d, S.mode) : el('div', { class: 'empty', text: 'Belum ada data bulan ini' })),
        el('div', { class: 'card section', style: 'padding:0;overflow:hidden' },
          el('div', { style: 'padding:18px 18px 4px' }, el('h3', { text: 'Rincian per hari' })),
          el('div', { class: 'scroll-x' }, dailyTable(d))));
    }

    loadMon().then(draw).catch(function (err) { body.replaceChildren(errBox(err)); $('#mon-sub').textContent = ''; });
  }

  function segmented(opts, val, onChange) {
    var btns = opts.map(function (o) {
      return el('button', { type: 'button', 'aria-pressed': String(o[0] === val), text: o[1], onclick: function () {
        btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b === this)); }, this);
        onChange(o[0]);
      } });
    });
    return el('div', { class: 'seg', role: 'group' }, btns);
  }

  function monCard(title, x, monthOnly) {
    var c = achClass(x.ach);
    var kv = function (k, val, cls) { return el('div', { class: 'kv' }, el('span', { text: k }), el('b', { class: 'num ' + (cls || ''), text: val })); };
    return el('div', { class: 'card mon-card' },
      el('div', { class: 'card-head' }, el('h3', { text: title }), el('span', { class: 'tag tag-' + (c === 'none' ? 'x' : c), text: fPct(x.ach, 2) })),
      el('div', { class: 'kvs' },
        kv('Target', fRp(x.target)), kv('Sales', fRp(x.sales)),
        kv('Selisih', x.diff == null ? '—' : (x.diff >= 0 ? '+' : '') + fRp(x.diff), x.diff == null ? '' : x.diff >= 0 ? 'c-good' : 'c-bad'),
        monthOnly ? null : kv('Transaksi', fNum(x.trx)),
        monthOnly ? null : kv('UPT', fDec(x.upt)), monthOnly ? null : kv('Basket', fRp(x.basket))));
  }

  function monTable(sm) {
    var achTd = function (v) { var c = achClass(v); return [el('td', { class: 'bar bg-' + (c === 'none' ? 'x' : c) }), el('td', { class: 'n', text: fPct(v, 2) })]; };
    var diffTd = function (v) { return el('td', { class: 'n ' + (v == null ? '' : v >= 0 ? 'cell-good c-good' : 'cell-bad c-bad'), text: v == null ? '—' : fRp(v) }); };
    function row(cls) {
      return el('tr', { class: cls || null },
        el('td', { class: 'sticky-col', text: cls ? '' : CFG.STORE }),
        el('td', { text: cls ? 'TOTAL' : 'EIGER Store ' + CFG.STORE_NAME, style: 'white-space:normal;min-width:180px;font-weight:600' }),
        el('td', { class: 'n', text: fRp(sm.monthly.target) }), el('td', { class: 'n', text: fPct(sm.monthly.ach, 2) }),
        el('td', { class: 'n', text: fRp(sm.kum.target) }), el('td', { class: 'n', text: fRp(sm.kum.sales) }), achTd(sm.kum.ach), diffTd(sm.kum.diff),
        el('td', { class: 'n', text: fDec(sm.kum.upt) }), el('td', { class: 'n', text: fRp(sm.kum.basket) }),
        el('td', { class: 'n', text: fRp(sm.daily.target) }), el('td', { class: 'n', text: fRp(sm.daily.sales) }), achTd(sm.daily.ach), diffTd(sm.daily.diff),
        el('td', { class: 'n', text: fDec(sm.daily.upt) }), el('td', { class: 'n', text: fRp(sm.daily.basket) }));
    }
    return el('table', { class: 't' },
      el('thead', null,
        el('tr', null, el('th', { rowspan: 2, class: 'sticky-col', text: 'Site' }), el('th', { rowspan: 2, text: 'Store' }),
          el('th', { colspan: 2, class: 'grp', text: 'Monthly Sales' }), el('th', { colspan: 7, class: 'grp', text: 'Kumulatif Sales' }), el('th', { colspan: 7, class: 'grp', text: 'Daily Sales' })),
        el('tr', { class: 'sub-head' },
          ['Target', '%Ach', 'Target', 'Sales', '', '%Ach', 'Diff', 'UPT', 'Basket', 'Target', 'Sales', '', '%Ach', 'Diff', 'UPT', 'Basket'].map(function (t, i) {
            return el('th', { class: t ? 'n' : 'bar', text: t });
          }))),
      el('tbody', null, row(), row('total')));
  }

  function dailyTable(d) {
    var key = S.mode === 'netto' ? 'netto' : 'bruto';
    var p = dParts(d.tanggal);
    var nDays = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
    var by = {}; d.harian.forEach(function (h) { by[h.tanggal] = h; });
    var rows = [], cum = 0, cumT = 0;
    for (var i = 1; i <= nDays; i++) {
      var iso = d.bulan + '-' + (i < 10 ? '0' : '') + i;
      if (iso > d.tanggal) break;
      var h = by[iso] || { bruto: 0, netto: 0, trx: 0, qty: 0 };
      var b = (d.bobot || {})[iso];
      var t = d.target != null && b ? Math.round(d.target * b.harian) : null;
      cum += h[key]; cumT = d.target != null && b ? Math.round(d.target * b.kumulatif) : null;
      var ach = t ? h[key] / t : null, achC = cumT ? cum / cumT : null;
      rows.push(el('tr', null,
        el('td', { class: 'sticky-col', text: dDayName(iso) + ' ' + i }),
        el('td', { class: 'n', text: fRp(t) }), el('td', { class: 'n', text: fRp(h[key]) }),
        el('td', { class: 'n c-' + achClass(ach), text: fPct(ach) }),
        el('td', { class: 'n', text: fNum(h.trx) }), el('td', { class: 'n', text: fDec(h.trx ? h.qty / h.trx : null) }),
        el('td', { class: 'n', text: fRp(h.trx ? h[key] / h.trx : null) }),
        el('td', { class: 'n', text: fRp(cum) }), el('td', { class: 'n c-' + achClass(achC), text: fPct(achC) })));
    }
    rows.reverse();
    return el('table', { class: 't' },
      el('thead', null, el('tr', null, ['Tanggal', 'Target', 'Sales', '%Ach', 'Trx', 'UPT', 'Basket', 'Kumulatif', '%Ach kum.'].map(function (t, i) {
        return el('th', { class: i ? 'n' : 'sticky-col', text: t });
      }))),
      el('tbody', null, rows));
  }

  /* ---------- Unggah DSR ---------- */
  function viewUnggah(v) {
    v.append(el('section', { class: 'hero hero-sm' },
      el('div', null, el('h2', { text: 'Unggah DSR' }), el('p', { text: 'Perbarui data penjualan dari file Item DSR Report.' }))));

    var input = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', id: 'dsr-file' });
    var drop = el('label', { class: 'drop', for: 'dsr-file' },
      el('span', { class: 'drop-ic' }, icon('upload')),
      el('span', { class: 'drop-txt' }, el('b', { text: 'Pilih file DSR' }), el('span', { text: 'Format .xlsx · ketuk untuk memilih' })),
      input);
    var area = el('div');
    var steps = el('ol', { class: 'steps' },
      el('li', null, el('b', { text: 'Unduh' }), ' Item DSR Report dari sistem (rentang tanggal bebas).'),
      el('li', null, el('b', { text: 'Pilih file' }), ' di sini, lalu cek ringkasannya.'),
      el('li', null, el('b', { text: 'Unggah.' }), ' Invoice yang sudah ada tidak akan dobel.'));
    var hist = el('div', { class: 'card section' }, el('h3', { text: 'Riwayat unggahan' }), el('div', { class: 'skel', style: 'margin-top:12px;min-height:60px' }));
    v.append(el('div', { class: 'grid grid-up' },
      el('div', { class: 'card' }, drop, area),
      el('div', { class: 'card card-soft' }, el('h3', { text: 'Cara unggah' }), steps,
        el('p', { class: 'note', text: 'Nama, nomor HP dan email customer tidak dikirim. Yang disimpan hanya kode customer acak dan nama untuk rekap belanja.' }))),
      hist);

    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
    input.addEventListener('change', function () { if (input.files[0]) handle(input.files[0]); input.value = ''; });

    function handle(file) {
      area.replaceChildren(el('div', { class: 'file-row' }, el('span', { class: 'file-ic' }, icon('file')),
        el('div', null, el('b', { text: file.name }), el('span', { text: 'Membaca file…' }))));
      if (!window.XLSX) { area.replaceChildren(errBox(new Error('Pembaca Excel belum termuat. Periksa koneksi lalu muat ulang halaman.'))); return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(reader.result), { type: 'array', cellDates: false });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
          var parsed = DSR.parse(aoa, { SSF: XLSX.SSF });
          if (!parsed.rows.length) throw new Error('Tidak ada baris transaksi di file ini.');
          preview(file, parsed);
        } catch (err) { area.replaceChildren(errBox(err)); }
      };
      reader.onerror = function () { area.replaceChildren(errBox(new Error('File tidak bisa dibaca'))); };
      reader.readAsArrayBuffer(file);
    }

    function preview(file, parsed) {
      var rows = parsed.rows;
      var inv = {}; rows.forEach(function (r) { inv[r.invoice] = 1; });
      var dates = rows.map(function (r) { return r.tanggal; }).sort();
      var agg = DSR.aggregateDaily(rows);
      var bruto = agg.reduce(function (s, x) { return s + x.bruto; }, 0), netto = agg.reduce(function (s, x) { return s + x.netto; }, 0);
      var okStore = !parsed.lokasi || parsed.lokasi.indexOf(CFG.STORE) >= 0;
      var btn = el('button', { class: 'btn btn-orange btn-block', disabled: !okStore }, icon('upload'), 'Unggah sekarang');
      var bar = el('div', { class: 'progress hide' }, el('i'));
      var out = el('div');
      area.replaceChildren(
        el('div', { class: 'file-row' }, el('span', { class: 'file-ic ok' }, icon('file')),
          el('div', null, el('b', { text: file.name }), el('span', { text: parsed.lokasi || 'Lokasi tidak tertulis di file' }))),
        !okStore ? errBox(new Error('File ini bukan DSR toko ' + CFG.STORE + '.')) : null,
        el('div', { class: 'stats' },
          stat('Periode', dShort(dates[0]) + ' – ' + dShort(dates[dates.length - 1]), true),
          stat('Transaksi', fNum(Object.keys(inv).length) + ' invoice'),
          stat('Baris item', fNum(rows.length)),
          stat('Sales bruto', fRpShort(bruto)), stat('Sales netto', fRpShort(netto))),
        parsed.bad ? el('p', { class: 'muted', text: parsed.bad + ' baris dilewati karena tanggalnya tidak terbaca.' }) : null,
        btn, bar, out);
      btn.addEventListener('click', function () {
        btn.disabled = true; btn.lastChild.textContent = 'Menyiapkan…'; bar.classList.remove('hide');
        prepareRows(rows).then(function (arrs) {
          btn.lastChild.textContent = 'Mengunggah…';
          bar.firstChild.style.width = '35%';
          var slow = setTimeout(function () { bar.firstChild.style.width = '80%'; }, 4000);
          return api('upload', { rows: arrs, lokasi: parsed.lokasi, fileName: file.name }).then(function (res) {
            clearTimeout(slow);
            bar.firstChild.style.width = '100%';
            S.mon = null; S.info = null;
            area.replaceChildren(el('div', { class: 'done' },
              el('span', { class: 'done-ic' }, icon('check')),
              el('h3', { text: 'Data berhasil diperbarui' }),
              el('p', { class: 'muted', text: dShort(res.dari) + ' – ' + dShort(res.sampai) }),
              el('div', { class: 'stats stats-3' }, stat('Invoice baru', fNum(res.baru)), stat('Diperbarui', fNum(res.diperbarui)), stat('Sudah ada', fNum(res.sama))),
              el('a', { class: 'btn btn-primary btn-block', href: '#/monitoring', text: 'Lihat Monitoring Sales' })));
            loadHist();
          }, function (err) { clearTimeout(slow); throw err; });
        }).catch(function (err) {
          bar.classList.add('hide'); btn.disabled = false; btn.lastChild.textContent = 'Coba unggah lagi';
          out.replaceChildren(errBox(err));
        });
      });
    }

    function stat(label, val, wide) { return el('div', { class: 'stat' + (wide ? ' wide' : '') }, el('span', { text: label }), el('b', { text: val })); }

    function loadHist() {
      api('uploads').then(function (list) {
        hist.replaceChildren(el('div', { class: 'card-head' }, el('h3', { text: 'Riwayat unggahan' }), el('span', { class: 'muted', style: 'font-size:13px', text: list.length + ' terakhir' })),
          list.length ? el('ul', { class: 'hist' }, list.map(function (u) {
            return el('li', null,
              el('span', { class: 'avatar', text: initials(u.nama) }),
              el('div', { class: 'hist-main' },
                el('div', { class: 'hist-top' }, el('b', { text: u.nama }), el('span', { class: 'muted', text: fTime(u.waktu) })),
                el('div', { class: 'muted', text: 'Data ' + dShort(u.dari) + ' – ' + dShort(u.sampai) }),
                el('div', { class: 'tags' },
                  el('span', { class: 'tag tag-good', text: '+' + fNum(u.baru) + ' baru' }),
                  u.diperbarui ? el('span', { class: 'tag tag-warn', text: fNum(u.diperbarui) + ' diperbarui' }) : null,
                  el('span', { class: 'tag', text: fNum(u.sama) + ' sudah ada' }))));
          })) : el('div', { class: 'empty', text: 'Belum ada unggahan' }));
      }).catch(function (err) { hist.replaceChildren(el('h3', { text: 'Riwayat unggahan' }), errBox(err)); });
    }
    loadHist();
  }

  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(''); }
  function fTime(s) { s = String(s || ''); if (s.length < 16) return s; var p = dParts(s.slice(0, 10)); return p.d + ' ' + BUL3[p.m - 1] + ' ' + s.slice(11, 16); }

  /** Ubah baris jadi array untuk dikirim; data customer diganti kode acak (hash). */
  function prepareRows(rows) {
    var cache = {};
    var subtle = window.crypto && window.crypto.subtle;
    function key(src) {
      if (!src) return Promise.resolve('');
      if (cache[src]) return cache[src];
      cache[src] = subtle ? subtle.digest('SHA-256', new TextEncoder().encode('hub2299|' + src)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf).slice(0, 8), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      }) : Promise.resolve(src.split('').reduce(function (h, c) { return ((h << 5) - h + c.charCodeAt(0)) | 0; }, 0).toString(16));
      return cache[src];
    }
    return Promise.all(rows.map(function (r) {
      return key(DSR.custSource(r)).then(function (k) { var c = Object.assign({}, r, { cust_key: k }); return DSR.toArray(c); });
    }));
  }

  /* ---------- Cek Kas Till ---------- */
  var PECAHAN = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
  function parseRp(s) { var n = Number(String(s || '').replace(/[^0-9]/g, '')); return isNaN(n) ? 0 : n; }
  function rpInput(id, value, onChange, placeholder) {
    var inp = el('input', { id: id, inputmode: 'numeric', autocomplete: 'off', placeholder: placeholder || '0', value: value ? nf.format(value) : '' });
    inp.addEventListener('input', function () {
      var n = parseRp(inp.value);
      inp.value = n ? nf.format(n) : '';
      onChange(n);
    });
    return el('div', { class: 'rp-input' }, el('span', { text: 'Rp' }), inp);
  }

  var POS = [
    { id: 'till', label: 'Till', judul: 'Uang di laci kasir', desc: 'Dicocokkan dengan modal till + penjualan tunai sistem' },
    { id: 'floating', label: 'Floating Cash', judul: 'Floating Cash (modal besar)', desc: 'Dicocokkan dengan standar floating cash' },
    { id: 'safe', label: 'Store Safe', judul: 'Store Safe (sisa cash)', desc: 'Dicatat jumlahnya, tanpa pembanding' },
    { id: 'petty', label: 'Petty Cash', judul: 'Petty Cash (kas toko)', desc: 'Dicatat jumlahnya, tanpa pembanding' }
  ];
  function posOf(id) { return POS.filter(function (p) { return p.id === id; })[0] || POS[0]; }

  function viewKas(v) {
    var pos = posOf(S.kasPos || store.get('kasPos') || 'till');
    var key = 'kasDraft.' + pos.id + '.' + (S.user ? S.user.username : '');
    var draft;
    try { draft = JSON.parse(store.get(key) || 'null'); } catch (e) { draft = null; }
    if (!draft || !draft.pecahan) draft = { pecahan: {}, tunai: 0, perubahan: [], catatan: '' };
    var withTunai = pos.id === 'till', withCompare = pos.id === 'till' || pos.id === 'floating';
    var modal = null;
    function save() { store.set(key, JSON.stringify(draft)); }

    v.append(el('section', { class: 'hero hero-sm' },
      el('div', null, el('h2', { text: 'Cek Kas' }), el('p', { text: 'Hitung uang fisik per pos kas, lalu lihat apakah jumlahnya cocok.' }))));
    v.append(el('div', { class: 'pos-tabs' }, POS.map(function (p) {
      return el('button', { type: 'button', 'aria-pressed': String(p.id === pos.id), text: p.label, onclick: function () {
        S.kasPos = p.id; store.set('kasPos', p.id); render();
      } });
    })));

    /* 1. hitung pecahan */
    var subEls = {}, totalEl = el('b', { class: 'num' });
    var rows = PECAHAN.map(function (p) {
      var inp = el('input', { type: 'number', inputmode: 'numeric', min: 0, step: 1, value: draft.pecahan[p] || '', placeholder: '0', 'aria-label': 'Jumlah lembar ' + nf.format(p) });
      var setN = function (n) { n = Math.max(0, Math.floor(n || 0)); if (n) draft.pecahan[p] = n; else delete draft.pecahan[p]; inp.value = n || ''; update(); };
      inp.addEventListener('input', function () { setN(Number(inp.value)); });
      inp.addEventListener('focus', function () { inp.select(); });
      subEls[p] = el('span', { class: 'den-sub num' });
      return el('div', { class: 'den' + (p < 1000 ? ' coin' : '') },
        el('span', { class: 'den-face', text: p >= 1000 ? nf.format(p / 1000) + 'rb' : nf.format(p) }),
        el('div', { class: 'stepper' },
          el('button', { type: 'button', class: 'st-btn', 'aria-label': 'Kurangi', html: IC.minus, onclick: function () { setN((draft.pecahan[p] || 0) - 1); } }),
          inp,
          el('button', { type: 'button', class: 'st-btn', 'aria-label': 'Tambah', html: IC.plus, onclick: function () { setN((draft.pecahan[p] || 0) + 1); } })),
        subEls[p]);
    });
    var step = 1;
    var cardHitung = el('div', { class: 'card' },
      el('div', { class: 'card-head' }, el('div', null, el('h3', { text: (step++) + '. ' + pos.judul }), el('p', { class: 'sub', text: 'Isi jumlah lembar / keping per pecahan' })),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Kosongkan', onclick: function () {
          if (!confirm('Kosongkan semua isian ' + pos.label + '?')) return;
          store.set(key, null); render();
        } })),
      el('div', { class: 'dens' }, rows),
      el('div', { class: 'den-total' }, el('span', { text: 'Total uang fisik' }), totalEl));

    var cardTunai = withTunai ? el('div', { class: 'card' },
      el('h3', { text: (step++) + '. Penjualan tunai di sistem' }),
      el('p', { class: 'sub', text: 'Lihat total pembayaran tunai di POS sampai jam ini' }),
      rpInput('kas-tunai', draft.tunai, function (n) { draft.tunai = n; update(); })) : null;

    var perBox = el('div', { class: 'per-list' });
    function drawPer() {
      perBox.replaceChildren(draft.perubahan.length ? null : el('p', { class: 'muted', style: 'margin:0', text: 'Belum ada. Tambahkan kalau ada uang yang diambil atau dimasukkan.' }));
      draft.perubahan.forEach(function (x, i) {
        var seg = segmented([['keluar', 'Uang keluar'], ['masuk', 'Uang masuk']], x.jenis, function (j) { x.jenis = j; update(); });
        var ket = el('input', { class: 'per-ket', placeholder: 'Keterangan, mis. dipindah ke brankas', value: x.ket || '', maxlength: 200 });
        ket.addEventListener('input', function () { x.ket = ket.value; save(); });
        perBox.append(el('div', { class: 'per-item' },
          el('div', { class: 'per-top' }, seg,
            el('button', { type: 'button', class: 'st-btn ghost', 'aria-label': 'Hapus', html: IC.x, onclick: function () { draft.perubahan.splice(i, 1); drawPer(); update(); } })),
          rpInput(null, x.jumlah, function (n) { x.jumlah = n; update(); }, 'Jumlah'),
          ket));
      });
    }
    var cardPer = withCompare ? el('div', { class: 'card' },
      el('h3', { text: (step++) + '. Perubahan kas' }),
      el('p', { class: 'sub', text: 'Uang yang keluar/masuk selain ' + (withTunai ? 'penjualan' : 'standar') + ', wajib dengan keterangan' }),
      perBox,
      el('button', { type: 'button', class: 'btn btn-ghost btn-block', style: 'margin-top:12px', onclick: function () {
        draft.perubahan.push({ jenis: 'keluar', jumlah: 0, ket: '' }); drawPer(); update();
      } }, icon('plus'), 'Tambah perubahan kas')) : null;

    var r = { modal: el('b', { class: 'num' }), tunai: el('b', { class: 'num' }), masuk: el('b', { class: 'num' }), keluar: el('b', { class: 'num' }), seharusnya: el('b', { class: 'num' }), fisik: el('b', { class: 'num' }) };
    var selisihBox = el('div', { class: 'selisih' });
    var catatan = el('textarea', { id: 'kas-cat', rows: 2, maxlength: 300, placeholder: withCompare ? 'Wajib diisi kalau ada selisih' : 'Opsional' });
    catatan.value = draft.catatan || '';
    catatan.addEventListener('input', function () { draft.catatan = catatan.value; save(); });
    var out = el('div');
    var btnSave = el('button', { class: 'btn btn-orange btn-block', type: 'button' }, icon('check'), 'Simpan hitungan ' + pos.label);
    var cardHasil = el('div', { class: 'card card-result' },
      el('h3', { text: (step++) + '. Hasil pengecekan' }),
      withCompare ? el('ul', { class: 'calc' },
        el('li', null, el('span', { text: withTunai ? 'Modal till' : 'Standar floating cash' }), r.modal),
        withTunai ? el('li', null, el('span', { text: '+ Penjualan tunai' }), r.tunai) : null,
        el('li', null, el('span', { text: '+ Uang masuk' }), r.masuk),
        el('li', null, el('span', { text: '− Uang keluar' }), r.keluar),
        el('li', { class: 'sum' }, el('span', { text: 'Seharusnya' }), r.seharusnya),
        el('li', null, el('span', { text: 'Uang fisik dihitung' }), r.fisik)) : el('ul', { class: 'calc' },
        el('li', { class: 'sum' }, el('span', { text: 'Uang fisik dihitung' }), r.fisik)),
      withCompare ? selisihBox : el('p', { class: 'note', text: pos.label + ' dicatat jumlahnya saja, tanpa pembanding.' }),
      el('div', { class: 'field' }, el('label', { for: 'kas-cat', text: 'Catatan' }), catatan),
      btnSave, out);

    var sticky = el('div', { class: 'kas-bar' }, el('div', null, el('span', { text: 'Fisik' }), el('b', { class: 'num', id: 'kb-f' })),
      withCompare ? el('div', null, el('span', { text: 'Selisih' }), el('b', { class: 'num', id: 'kb-s' })) : null);

    v.append(el('div', { class: 'kas-grid' },
      el('div', { class: 'kas-left' }, cardHitung, cardTunai, cardPer),
      el('div', { class: 'kas-right' }, cardHasil)), sticky);
    var hist = el('div', { class: 'card section' });
    v.append(hist);

    function calc() {
      var fisik = PECAHAN.reduce(function (s, p) { return s + (draft.pecahan[p] || 0) * p; }, 0);
      var masuk = 0, keluar = 0;
      if (withCompare) draft.perubahan.forEach(function (x) { if (x.jenis === 'masuk') masuk += x.jumlah || 0; else keluar += x.jumlah || 0; });
      var seharusnya = !withCompare || modal == null ? null : modal + (withTunai ? draft.tunai || 0 : 0) + masuk - keluar;
      return { fisik: fisik, masuk: masuk, keluar: keluar, seharusnya: seharusnya, selisih: seharusnya == null ? null : fisik - seharusnya };
    }
    function rp(n) { return n == null ? '—' : 'Rp ' + nf.format(n); }
    function update() {
      save();
      var c = calc();
      PECAHAN.forEach(function (p) { var n = draft.pecahan[p] || 0; subEls[p].textContent = n ? nf.format(n * p) : '—'; subEls[p].classList.toggle('muted', !n); });
      totalEl.textContent = rp(c.fisik);
      r.modal.textContent = rp(modal); r.tunai.textContent = rp(draft.tunai || 0);
      r.masuk.textContent = rp(c.masuk); r.keluar.textContent = rp(c.keluar);
      r.seharusnya.textContent = rp(c.seharusnya); r.fisik.textContent = rp(c.fisik);
      $('#kb-f').textContent = rp(c.fisik);
      if (!withCompare) return;
      var st = selisihState(c.selisih, c.fisik);
      selisihBox.className = 'selisih s-' + st.cls;
      selisihBox.replaceChildren(el('span', { text: 'Selisih' }), el('b', { class: 'num', text: st.text }), el('small', { text: st.note }));
      var kb = $('#kb-s'); kb.textContent = st.short; kb.className = 'num c-' + st.cls;
    }

    btnSave.addEventListener('click', function () {
      out.replaceChildren();
      var c = calc();
      if (!c.fisik) { out.replaceChildren(errBox(new Error('Isi dulu jumlah uangnya'))); return; }
      var bad = draft.perubahan.filter(function (x) { return !x.jumlah || !String(x.ket || '').trim(); });
      if (withCompare && bad.length) { out.replaceChildren(errBox(new Error('Setiap perubahan kas wajib diisi jumlah dan keterangannya'))); return; }
      if (c.selisih && !String(draft.catatan || '').trim()) { out.replaceChildren(errBox(new Error('Ada selisih, isi catatan penjelasannya dulu'))); catatan.focus(); return; }
      btnSave.disabled = true; btnSave.lastChild.textContent = 'Menyimpan…';
      api('kasSave', { pos: pos.id, pecahan: draft.pecahan, penjualanTunai: withTunai ? draft.tunai || 0 : 0, perubahan: withCompare ? draft.perubahan : [], catatan: draft.catatan })
        .then(function () { store.set(key, null); toast('Hitungan ' + pos.label + ' tersimpan'); render(); })
        .catch(function (err) { btnSave.disabled = false; btnSave.lastChild.textContent = 'Simpan hitungan ' + pos.label; out.replaceChildren(errBox(err)); });
    });

    drawPer(); update();
    if (withCompare) api('settings').then(function (s) { modal = Number(withTunai ? s.modal_till : s.floating_cash); update(); }).catch(function (err) { out.replaceChildren(errBox(err)); });

    function loadHist(tgl) {
      hist.replaceChildren(el('h3', { text: 'Riwayat ' + pos.label }), el('div', { class: 'skel', style: 'margin-top:12px;min-height:60px' }));
      api('kasList', { tanggal: tgl || '', pos: pos.id }).then(function (d) {
        var sel = el('select', { 'aria-label': 'Pilih tanggal', class: 'sel-sm' });
        var opts = d.tanggalTersedia.indexOf(d.tanggal) < 0 ? [d.tanggal].concat(d.tanggalTersedia) : d.tanggalTersedia;
        opts.forEach(function (t) { var o = el('option', { value: t, text: dShort(t) }); if (t === d.tanggal) o.selected = true; sel.append(o); });
        sel.addEventListener('change', function () { loadHist(sel.value); });
        hist.replaceChildren(el('div', { class: 'card-head' }, el('h3', { text: 'Riwayat ' + pos.label }), sel),
          d.list.length ? el('ul', { class: 'hist' }, d.list.map(kasItem)) : el('div', { class: 'empty', text: 'Belum ada hitungan di tanggal ini' }));
      }).catch(function (err) { hist.replaceChildren(el('h3', { text: 'Riwayat ' + pos.label }), errBox(err)); });
    }
    loadHist();
  }

  function selisihState(s, fisik) {
    if (fisik === 0) return { cls: 'none', text: '—', short: '—', note: 'Isi hitungan uang dulu' };
    if (s == null) return { cls: 'none', text: '—', short: '—', note: 'Memuat standar…' };
    if (s === 0) return { cls: 'good', text: 'Pas', short: 'Pas', note: 'Jumlah uang sesuai' };
    if (s < 0) return { cls: 'bad', text: '− Rp ' + nf.format(-s), short: '−' + nf.format(-s), note: 'Uang kurang' };
    return { cls: 'warn', text: '+ Rp ' + nf.format(s), short: '+' + nf.format(s), note: 'Uang lebih' };
  }

  function kasItem(k) {
    var st = k.selisih == null ? null : selisihState(k.selisih, k.totalFisik);
    var det = el('details', { class: 'kas-det' }, el('summary', { text: 'Lihat rincian' }),
      el('div', { class: 'kas-det-grid' },
        el('div', null, el('b', { text: 'Pecahan' }), el('ul', null, PECAHAN.filter(function (p) { return k.pecahan[p]; }).map(function (p) {
          return el('li', null, el('span', { text: nf.format(p) + ' × ' + k.pecahan[p] }), el('span', { class: 'num', text: nf.format(p * k.pecahan[p]) }));
        }))),
        k.seharusnya == null ? null : el('div', null, el('b', { text: 'Perhitungan' }), el('ul', null,
          el('li', null, el('span', { text: k.pos === 'floating' ? 'Standar' : 'Modal' }), el('span', { class: 'num', text: nf.format(k.modal) })),
          k.pos === 'till' ? el('li', null, el('span', { text: 'Penjualan tunai' }), el('span', { class: 'num', text: nf.format(k.penjualanTunai) })) : null,
          k.perubahan.map(function (x) { return el('li', null, el('span', { text: (x.jenis === 'masuk' ? '+ ' : '− ') + x.ket }), el('span', { class: 'num', text: nf.format(x.jumlah) })); }),
          el('li', { class: 'sum' }, el('span', { text: 'Seharusnya' }), el('span', { class: 'num', text: nf.format(k.seharusnya) }))))));
    return el('li', null,
      el('span', { class: 'avatar', text: initials(k.nama) }),
      el('div', { class: 'hist-main' },
        el('div', { class: 'hist-top' }, el('b', { text: k.nama }), el('span', { class: 'muted', text: k.waktu.slice(11, 16) })),
        el('div', { class: 'tags' },
          el('span', { class: 'tag', text: 'Fisik Rp ' + nf.format(k.totalFisik) }),
          st ? el('span', { class: 'tag tag-' + (st.cls === 'good' ? 'good' : st.cls === 'bad' ? 'bad' : 'warn'), text: st.cls === 'good' ? 'Pas' : 'Selisih ' + st.text }) : null),
        k.catatan ? el('div', { class: 'hist-note', text: '“' + k.catatan + '”' }) : null,
        det));
  }

  /* =================== TAHAP 2: laporan, stok, jadwal =================== */

  function pageHead(v, title, desc) {
    v.append(el('section', { class: 'hero hero-sm' }, el('div', null, el('h2', { text: title }), desc ? el('p', { text: desc }) : null)));
  }
  function bulanLabel(ym) { var p = String(ym).split('-'); return BULAN[Number(p[1]) - 1] + ' ' + p[0]; }
  function monthSel(list, val, onChange) {
    var s = el('select', { class: 'sel', 'aria-label': 'Pilih bulan' });
    (list.indexOf(val) < 0 ? [val].concat(list) : list).forEach(function (m) { var o = el('option', { value: m, text: bulanLabel(m) }); if (m === val) o.selected = true; s.append(o); });
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }
  function modeSeg(onChange) {
    return segmented([['netto', 'Netto'], ['bruto', 'Bruto']], S.mode, function (m) { S.mode = m; store.set('mode', m); onChange(); });
  }
  function bar(value, max, cls) {
    var pct = max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0;
    return el('div', { class: 'bar-track' }, el('i', { class: cls || '', style: 'width:' + pct.toFixed(1) + '%' }));
  }
  function loadLap(bulan) {
    S.lap = S.lap || {};
    var k = bulan || '_';
    if (S.lap[k]) return Promise.resolve(S.lap[k]);
    return api('laporan', { bulan: bulan || '' }).then(function (d) { S.lap[k] = d; S.lap[d.bulan] = d; return d; });
  }
  function skel(n) { var a = []; for (var i = 0; i < (n || 1); i++) a.push(el('div', { class: 'skel', style: 'margin-bottom:14px' })); return a; }
  function emptyCard(text) { return el('div', { class: 'card' }, el('div', { class: 'empty', text: text })); }
  var HARI_URUT = [1, 2, 3, 4, 5, 6, 0];
  function weekday(iso) { var p = dParts(iso); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); }
  function key2() { return S.mode === 'bruto' ? 2 : 3; }

  /* ---------- Sales Trend ---------- */
  function viewTrend(v) {
    pageHead(v, 'Sales Trend', 'Jam dan hari paling ramai, dari data DSR.');
    var tools = el('div', { class: 'toolbar2' });
    var body = el('div', null, skel(3));
    v.append(tools, body);
    var bulan = S.trendBulan || '', tanggal = '';
    function load() {
      loadLap(bulan).then(function (d) { bulan = d.bulan; S.trendBulan = bulan; draw(d); }).catch(function (e) { body.replaceChildren(errBox(e)); });
    }
    function draw(d) {
      var K = key2();
      var dates = {}; d.jam.forEach(function (x) { dates[x[0]] = 1; });
      var dl = Object.keys(dates).sort();
      if (!dl.length) { tools.replaceChildren(monthSel(d.bulanTersedia, bulan, function (m) { bulan = m; tanggal = ''; load(); })); body.replaceChildren(emptyCard('Belum ada data bulan ini')); return; }
      if (dl.indexOf(tanggal) < 0) tanggal = dl[dl.length - 1];
      var dsel = el('select', { class: 'sel', 'aria-label': 'Pilih tanggal' });
      dl.slice().reverse().forEach(function (t) { var o = el('option', { value: t, text: dDayName(t) + ', ' + dShort(t) }); if (t === tanggal) o.selected = true; dsel.append(o); });
      dsel.addEventListener('change', function () { tanggal = dsel.value; draw(d); });
      tools.replaceChildren(monthSel(d.bulanTersedia, bulan, function (m) { bulan = m; tanggal = ''; load(); }), dsel, modeSeg(function () { draw(d); }));

      var H = []; for (var h = 8; h <= 22; h++) H.push(h);
      var day = {}, sumH = {}, cnt = dl.length;
      d.jam.forEach(function (x) { if (x[0] === tanggal) day[x[1]] = { v: x[K], t: x[4] }; sumH[x[1]] = (sumH[x[1]] || 0) + x[K]; });
      var items = H.map(function (h) { return { label: String(h), v: day[h] ? day[h].v : 0, t: day[h] ? day[h].t : 0, avg: (sumH[h] || 0) / cnt }; });
      var peak = items.slice().sort(function (a, b) { return b.avg - a.avg; })[0];

      var perDate = {}; d.jam.forEach(function (x) { perDate[x[0]] = (perDate[x[0]] || 0) + x[K]; });
      var wd = {}; Object.keys(perDate).forEach(function (t) { var w = weekday(t); (wd[w] = wd[w] || []).push(perDate[t]); });
      var wdAvg = HARI_URUT.map(function (w) { var a = wd[w] || []; return { w: w, v: a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : 0, n: a.length }; });
      var wdMax = Math.max.apply(null, wdAvg.map(function (x) { return x.v; }).concat([1]));
      var bestDay = wdAvg.slice().sort(function (a, b) { return b.v - a.v; })[0];

      var heat = {}, heatN = {};
      d.jam.forEach(function (x) { var k = weekday(x[0]) + '|' + x[1]; heat[k] = (heat[k] || 0) + x[K]; });
      Object.keys(perDate).forEach(function (t) { var w = weekday(t); heatN[w] = (heatN[w] || 0) + 1; });
      var hmax = 1; Object.keys(heat).forEach(function (k) { var w = k.split('|')[0]; hmax = Math.max(hmax, heat[k] / heatN[w]); });

      body.replaceChildren(
        el('div', { class: 'insights' },
          el('div', { class: 'insight' }, el('span', { text: 'Jam tersibuk ' + BULAN[dParts(bulan + '-01').m - 1] }), el('b', { text: pad2(peak.label) + '.00–' + pad2(Number(peak.label) + 1) + '.00' }), el('small', { text: 'rata-rata ' + fRpShort(peak.avg) + ' per hari' })),
          el('div', { class: 'insight' }, el('span', { text: 'Hari teramai' }), el('b', { text: HARI[bestDay.w] }), el('small', { text: 'rata-rata ' + fRpShort(bestDay.v) })),
          el('div', { class: 'insight' }, el('span', { text: 'Total ' + dShort(tanggal) }), el('b', { text: fRpShort(perDate[tanggal] || 0) }), el('small', { text: (S.mode === 'netto' ? 'Netto' : 'Bruto') }))),
        el('div', { class: 'card section' }, el('h3', { text: 'Per jam · ' + dLong(tanggal) }),
          el('p', { class: 'sub', text: 'Batang = sales jam itu, garis = rata-rata jam yang sama bulan ini. Ketuk batang untuk detail.' }),
          hourChart(items)),
        el('div', { class: 'grid grid-2 section' },
          el('div', { class: 'card' }, el('h3', { text: 'Rata-rata per hari' }), el('p', { class: 'sub', text: 'Sales harian rata-rata per hari dalam seminggu' }),
            el('div', { class: 'hbars' }, wdAvg.map(function (x) {
              return el('div', { class: 'hb-row' }, el('span', { class: 'hb-lbl', text: HARI[x.w] }), bar(x.v, wdMax, x === bestDay ? 'hot' : ''), el('b', { class: 'num', text: fRpShort(x.v) }));
            }))),
          el('div', { class: 'card' }, el('h3', { text: 'Peta jam sibuk' }), el('p', { class: 'sub', text: 'Makin gelap = makin ramai (rata-rata ' + BULAN[dParts(bulan + '-01').m - 1] + ')' }),
            el('div', { class: 'scroll-x' }, el('table', { class: 'heat' },
              el('thead', null, el('tr', null, el('th'), H.map(function (h) { return el('th', { text: h }); }))),
              el('tbody', null, HARI_URUT.map(function (w) {
                return el('tr', null, el('th', { text: HARI[w].slice(0, 3) }), H.map(function (h) {
                  var val = heatN[w] ? (heat[w + '|' + h] || 0) / heatN[w] : 0;
                  var a = val / hmax;
                  return el('td', { title: HARI[w] + ' ' + h + '.00: ' + fRpShort(val), style: 'background:rgba(15,42,122,' + (0.06 + a * 0.9).toFixed(2) + ')' });
                }));
              })))))));
    }
    load();
  }
  function pad2(n) { n = Number(n); return (n < 10 ? '0' : '') + n; }

  function hourChart(items) {
    var wrap = el('div', { class: 'chart' }), tip = el('div', { class: 'tip' });
    requestAnimationFrame(function () {
      var W = Math.max(300, Math.round(wrap.clientWidth || 600)), H = 220, ml = 40, mr = 6, mt = 10, mb = 22;
      var max = 1; items.forEach(function (i) { max = Math.max(max, i.v, i.avg); });
      var stp = niceStep(max / 4), top = Math.ceil(max / stp) * stp;
      var y = function (v) { return mt + (H - mt - mb) * (1 - v / top); };
      var bw = (W - ml - mr) / items.length;
      var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      function s(tag, a, txt) { var e = document.createElementNS(NS, tag); Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); if (txt != null) e.textContent = txt; svg.appendChild(e); return e; }
      for (var g = 0; g <= top + 1; g += stp) {
        s('line', { x1: ml, x2: W - mr, y1: y(g), y2: y(g), stroke: '#E4E9F2' });
        s('text', { x: ml - 6, y: y(g) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#5E6A85' }, g === 0 ? '0' : (g / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt');
      }
      var pts = [];
      items.forEach(function (it, i) {
        var x = ml + i * bw;
        if (it.v > 0) s('rect', { x: x + bw * 0.16, y: y(it.v), width: bw * 0.68, height: Math.max(0, y(0) - y(it.v)), rx: Math.min(4, bw * 0.3), fill: '#16379A' });
        pts.push((x + bw / 2) + ',' + y(it.avg));
        s('text', { x: x + bw / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 11, fill: '#5E6A85' }, it.label);
        var hit = s('rect', { x: x, y: mt, width: bw, height: H - mt - mb, fill: 'transparent' });
        var show = function (ev) {
          tip.replaceChildren(el('b', { text: pad2(it.label) + '.00–' + pad2(Number(it.label) + 1) + '.00' }), el('div', { text: 'Sales: ' + fRpShort(it.v) + (it.t ? ' · ' + it.t + ' trx' : '') }), el('div', { text: 'Rata-rata: ' + fRpShort(it.avg) }));
          tip.style.display = 'block';
          var rect = wrap.getBoundingClientRect();
          tip.style.left = Math.max(0, Math.min(rect.width - tip.offsetWidth, ev.clientX - rect.left - tip.offsetWidth / 2)) + 'px';
          tip.style.top = Math.max(0, ev.clientY - rect.top - tip.offsetHeight - 12) + 'px';
        };
        hit.addEventListener('mousemove', show); hit.addEventListener('click', show);
        hit.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
      });
      s('polyline', { points: pts.join(' '), fill: 'none', stroke: '#F26B3A', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
      wrap.replaceChildren(svg, tip);
    });
    return wrap;
  }

  /* ---------- RA Performance ---------- */
  function viewRA(v) {
    pageHead(v, 'RA Performance', 'Penjualan, transaksi, UPT dan basket per sales person.');
    var tools = el('div', { class: 'toolbar2' }), body = el('div', null, skel(2));
    v.append(tools, body);
    var bulan = S.raBulan || '', lingkup = 'bulan', tanggal = '', TG = {};
    function load() {
      loadLap(bulan).then(function (d) {
        bulan = d.bulan; S.raBulan = bulan;
        return api('raTarget', { bulan: bulan }).then(function (t) { TG = t.targets || {}; }, function () { TG = {}; }).then(function () { draw(d); });
      }).catch(function (e) { body.replaceChildren(errBox(e)); });
    }
    function draw(d) {
      var K = key2();
      var dates = {}; d.ra.forEach(function (x) { dates[x[1]] = 1; });
      var dl = Object.keys(dates).sort();
      if (dl.indexOf(tanggal) < 0) tanggal = dl[dl.length - 1] || '';
      var dsel = el('select', { class: 'sel' + (lingkup === 'hari' ? '' : ' hide'), 'aria-label': 'Pilih tanggal' });
      dl.slice().reverse().forEach(function (t) { var o = el('option', { value: t, text: dShort(t) }); if (t === tanggal) o.selected = true; dsel.append(o); });
      dsel.addEventListener('change', function () { tanggal = dsel.value; draw(d); });
      tools.replaceChildren(monthSel(d.bulanTersedia, bulan, function (m) { bulan = m; load(); }),
        segmented([['bulan', 'Sebulan'], ['hari', 'Per hari']], lingkup, function (x) { lingkup = x; draw(d); }), dsel, modeSeg(function () { draw(d); }));
      var by = {};
      d.ra.forEach(function (x) {
        if (lingkup === 'hari' && x[1] !== tanggal) return;
        var o = by[x[0]] || (by[x[0]] = { nama: x[0], s: 0, q: 0, t: 0 });
        o.s += x[K]; o.q += x[4]; o.t += x[5];
      });
      var list = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.s - a.s; });
      var total = list.reduce(function (s, x) { return s + x.s; }, 0), max = list.length ? list[0].s : 1;
      if (!list.length) { body.replaceChildren(emptyCard('Belum ada data')); return; }
      body.replaceChildren(el('div', { class: 'card' },
        el('div', { class: 'card-head' }, el('h3', { text: lingkup === 'hari' ? dLong(tanggal) : bulanLabel(bulan) }), el('span', { class: 'muted num', text: 'Total ' + fRpShort(total) })),
        el('p', { class: 'note', style: 'margin:4px 0 6px', text: 'Transaksi dihitung per invoice yang dilayani orang tersebut.' }),
        el('div', { style: 'margin-bottom:8px' }, dlBtn(function () {
          xlsxDownload('RA Performance ' + (lingkup === 'hari' ? tanggal : bulanLabel(bulan)), [{ name: 'RA', rows: [['Peringkat', 'Nama', 'Sales (' + (K === 2 ? 'bruto' : 'netto') + ')', 'Kontribusi %', 'Transaksi', 'Qty', 'UPT', 'Basket']].concat(list.map(function (x, i) {
            return [i + 1, x.nama, x.s, Math.round((total ? x.s / total : 0) * 1000) / 10, x.t, x.q, x.t ? Math.round(x.q / x.t * 100) / 100 : '', x.t ? Math.round(x.s / x.t) : ''];
          })) }]);
        })),
        el('ul', { class: 'ra-list' }, list.map(function (x, i) {
          return el('li', null,
            el('span', { class: 'rank' + (i < 3 ? ' top' : ''), text: i + 1 }),
            el('div', { class: 'ra-main' },
              el('div', { class: 'ra-top' }, el('b', { text: titleCase(x.nama) }), el('b', { class: 'num', text: fRpShort(x.s) })),
              bar(x.s, max, i === 0 ? 'hot' : ''),
              el('div', { class: 'tags' },
                lingkup === 'bulan' && TG[x.nama] ? el('span', { class: 'tag ' + (x.s >= TG[x.nama] ? 'tag-good' : 'tag-warn'), text: fPct(x.s / TG[x.nama]) + ' dari target ' + fRpShort(TG[x.nama]) }) : null,
                el('span', { class: 'tag', text: fPct(total ? x.s / total : 0) + ' kontribusi' }),
                el('span', { class: 'tag', text: fNum(x.t) + ' trx' }),
                el('span', { class: 'tag', text: 'UPT ' + fDec(x.t ? x.q / x.t : null) }),
                el('span', { class: 'tag', text: 'Basket ' + fRpShort(x.t ? x.s / x.t : null) }))));
        }))));
    }
    load();
  }

  /* ---------- Produk & Promo ---------- */
  function viewProduk(v) {
    pageHead(v, 'Produk & Promo', 'Kategori, produk terlaris dan kontribusi promo.');
    var tools = el('div', { class: 'toolbar2' }), body = el('div', null, skel(3));
    v.append(tools, body);
    var bulan = S.prBulan || '', topN = 20, q = '';
    function load() { loadLap(bulan).then(function (d) { bulan = d.bulan; S.prBulan = bulan; draw(d); }).catch(function (e) { body.replaceChildren(errBox(e)); }); }
    function draw(d) {
      var K = key2();
      tools.replaceChildren(monthSel(d.bulanTersedia, bulan, function (m) { bulan = m; load(); }), modeSeg(function () { draw(d); }));
      if (!d.kategori.length) { body.replaceChildren(emptyCard('Belum ada data bulan ini')); return; }
      var k3 = {};
      d.kategori.forEach(function (x) { var o = k3[x[0]] || (k3[x[0]] = { nama: x[0], s: 0, q: 0, sub: [] }); o.s += x[K]; o.q += x[4]; o.sub.push({ nama: x[1], s: x[K], q: x[4] }); });
      var kats = Object.keys(k3).map(function (k) { return k3[k]; }).sort(function (a, b) { return b.s - a.s; });
      var total = kats.reduce(function (s, x) { return s + x.s; }, 0), kmax = kats[0].s;
      var par = d.pareto[S.mode === 'bruto' ? 'bruto' : 'netto'];
      var promos = d.promo.map(function (x) { return { nama: x[0], s: x[K], q: x[3], t: x[4] }; }).sort(function (a, b) { return b.s - a.s; });
      var pmax = promos.length ? Math.max(promos[0].s, 1) : 1;
      var prodList = el('ol', { class: 'prod-list' });
      var search = el('input', { class: 'hb-search', type: 'search', placeholder: 'Cari produk…', value: q });
      function drawProd() {
        var qq = search.value.trim().toLowerCase();
        var rows = d.produk.map(function (x) { return { sku: x[0], nama: x[1], k3: x[2], k4: x[3], q: x[4], s: K === 2 ? x[5] : x[6] }; })
          .sort(function (a, b) { return b.s - a.s; })
          .filter(function (x) { return !qq || (x.nama + ' ' + x.k4 + ' ' + x.sku).toLowerCase().indexOf(qq) >= 0; });
        var pm = rows.length ? rows[0].s : 1;
        prodList.replaceChildren(rows.slice(0, topN).map(function (x, i) {
          return el('li', null, el('span', { class: 'rank' + (i < 3 && !qq ? ' top' : ''), text: i + 1 }),
            el('div', { class: 'ra-main' },
              el('div', { class: 'ra-top' }, el('b', { class: 'prod-name', text: x.nama }), el('b', { class: 'num', text: fRpShort(x.s) })),
              bar(x.s, pm),
              el('div', { class: 'muted', style: 'font-size:12.5px', text: titleCase(x.k3) + ' · ' + titleCase(x.k4) + ' · ' + fNum(x.q) + ' pcs' })));
        }));
      }
      search.addEventListener('input', function () { q = search.value; drawProd(); });
      drawProd();
      body.replaceChildren(
        el('div', { class: 'insights' },
          el('div', { class: 'insight' }, el('span', { text: 'Pareto 80/20' }), el('b', { text: fNum(par.n80) + ' produk' }), el('small', { text: 'dari ' + fNum(par.total) + ' produk terjual (' + fPct(par.total ? par.n80 / par.total : 0) + ') menyumbang 80% sales' })),
          el('div', { class: 'insight' }, el('span', { text: 'Kategori utama' }), el('b', { text: titleCase(kats[0].nama) }), el('small', { text: fPct(total ? kats[0].s / total : 0) + ' dari sales' })),
          el('div', { class: 'insight' }, el('span', { text: 'Sales dengan promo' }), el('b', { text: fPct(total ? 1 - ((promos.filter(function (p) { return p.nama === '(tanpa promo)'; })[0] || { s: 0 }).s / total) : 0) }), el('small', { text: 'sisanya harga normal' }))),
        el('div', { class: 'grid grid-2 section' },
          el('div', { class: 'card' }, el('h3', { text: 'Kontribusi kategori' }), el('p', { class: 'sub', text: 'Ketuk kategori untuk melihat subkategori' }),
            el('div', { class: 'kat-list' }, kats.map(function (k) {
              var subs = k.sub.sort(function (a, b) { return b.s - a.s; });
              return el('details', { class: 'kat' }, el('summary', null,
                el('div', { class: 'hb-row' }, el('span', { class: 'hb-lbl', text: titleCase(k.nama) }), bar(k.s, kmax, 'hot'), el('b', { class: 'num', text: fPct(total ? k.s / total : 0) }))),
                el('div', { class: 'kat-sub' }, subs.map(function (s) {
                  return el('div', { class: 'hb-row sm' }, el('span', { class: 'hb-lbl', text: titleCase(s.nama) }), bar(s.s, subs[0].s), el('span', { class: 'num', text: fRpShort(s.s) }));
                })));
            }))),
          el('div', { class: 'card' }, el('h3', { text: 'Kontribusi promo' }), el('p', { class: 'sub', text: 'Sales per nama promo' }),
            el('div', { class: 'promo-list' }, promos.map(function (p) {
              return el('div', { class: 'promo' }, el('div', { class: 'ra-top' }, el('span', { class: 'prod-name', text: p.nama }), el('b', { class: 'num', text: fPct(total ? p.s / total : 0) })),
                bar(p.s, pmax, p.nama === '(tanpa promo)' ? '' : 'hot'),
                el('div', { class: 'muted', style: 'font-size:12.5px', text: fRpShort(p.s) + ' · ' + fNum(p.t) + ' trx · ' + fNum(p.q) + ' pcs' }));
            })))),
        naSalesCard(d, K),
        el('div', { class: 'card section' },
          el('div', { class: 'card-head' }, el('h3', { text: 'Produk terlaris' }),
            segmented([['20', 'Top 20'], ['50', 'Top 50'], ['100', 'Top 100']], String(topN), function (x) { topN = Number(x); drawProd(); })),
          search, prodList,
          el('div', { style: 'margin-top:12px' }, dlBtn(function () {
            xlsxDownload('Produk & Promo ' + bulanLabel(d.bulan), [
              { name: 'Produk terlaris', rows: [['SKU', 'Nama', 'Kategori', 'Sub kategori', 'Qty', 'Bruto', 'Netto']].concat(d.produk.map(function (x) { return [x[0], x[1], x[2], x[3], x[4], x[5], x[6]]; })) },
              { name: 'Kategori', rows: [['Kategori', 'Sub kategori', 'Bruto', 'Netto', 'Qty']].concat(d.kategori) },
              { name: 'Promo', rows: [['Promo', 'Bruto', 'Netto', 'Qty', 'Transaksi']].concat(d.promo) }]);
          }))));
    }
    load();
  }

  /* ---------- Customer & Retur ---------- */
  function viewCustomer(v) {
    pageHead(v, 'Customer & Retur', 'Member dengan belanja terbesar dan barang yang dikembalikan.');
    var tab = S.custTab || 'customer';
    var tools = el('div', { class: 'toolbar2' }), body = el('div', null, skel(2));
    v.append(tools, body);
    var bulan = S.rtBulan || '';
    function draw() {
      var seg = segmented([['customer', 'Customer'], ['retur', 'Retur']], tab, function (x) { tab = x; S.custTab = x; draw(); });
      tools.replaceChildren(seg);
      body.replaceChildren(skel(2));
      if (tab === 'customer') {
        (S.cust ? Promise.resolve(S.cust) : api('customer').then(function (d) { S.cust = d; return d; })).then(function (d) {
          var row = function (x, i) {
            return el('li', null, el('span', { class: 'avatar', text: initials(x[0]) }),
              el('div', { class: 'hist-main' },
                el('div', { class: 'hist-top' }, el('b', { text: titleCase(x[0]) }), el('b', { class: 'num', text: fRpShort(x[1]) })),
                el('div', { class: 'tags' }, el('span', { class: 'tag', text: x[3] + '× belanja' }), el('span', { class: 'tag', text: 'terakhir ' + dShort(x[5]) }))));
          };
          body.replaceChildren(
            el('div', { class: 'insights' },
              el('div', { class: 'insight' }, el('span', { text: 'Customer tercatat' }), el('b', { text: fNum(d.jumlah) }), el('small', { text: 'yang namanya diisi di transaksi' })),
              el('div', { class: 'insight' }, el('span', { text: 'Belanja berulang' }), el('b', { text: fNum(d.berulang) }), el('small', { text: fPct(d.jumlah ? d.berulang / d.jumlah : 0) + ' dari customer tercatat' }))),
            el('div', { class: 'grid grid-2 section' },
              el('div', { class: 'card' }, el('h3', { text: 'Belanja terbesar' }), el('p', { class: 'sub', text: 'Total netto sepanjang data yang diunggah' }),
                d.top.length ? el('ul', { class: 'hist' }, d.top.slice(0, 30).map(row)) : el('div', { class: 'empty', text: 'Belum ada data customer' })),
              el('div', { class: 'card' }, el('h3', { text: 'Lama tidak belanja' }), el('p', { class: 'sub', text: 'Pernah belanja 2× atau lebih, terakhir sebelum ' + dShort(d.batasLama) + '. Cocok untuk di-follow up.' }),
                d.lama.length ? el('ul', { class: 'hist' }, d.lama.slice(0, 30).map(row)) : el('div', { class: 'empty', text: 'Belum ada. Muncul setelah data beberapa bulan terkumpul.' }))),
            el('p', { class: 'note', text: 'Hanya transaksi yang mencantumkan nama/HP customer yang terhitung. Nomor HP dan email tidak disimpan.' }));
        }).catch(function (e) { body.replaceChildren(errBox(e)); });
      } else {
        loadLap(bulan).then(function (d) {
          bulan = d.bulan; S.rtBulan = bulan;
          tools.replaceChildren(seg, monthSel(d.bulanTersedia, bulan, function (m) { bulan = m; draw(); }));
          var tot = d.retur.reduce(function (s, x) { return s + x[6]; }, 0), qty = d.retur.reduce(function (s, x) { return s + x[4]; }, 0);
          body.replaceChildren(
            el('div', { class: 'insights' },
              el('div', { class: 'insight' }, el('span', { text: 'Barang kembali' }), el('b', { text: fNum(-qty) + ' pcs' }), el('small', { text: d.retur.length + ' baris retur/tukar' })),
              el('div', { class: 'insight' }, el('span', { text: 'Nilai retur (netto)' }), el('b', { text: fRpShort(-tot) }), el('small', { text: 'mengurangi sales ' + bulanLabel(bulan) }))),
            el('div', { class: 'card section' }, el('h3', { text: 'Daftar retur & tukar barang' }), el('p', { class: 'sub', text: 'Dari baris DSR dengan qty minus' }),
              d.retur.length ? el('ul', { class: 'hist' }, d.retur.slice().reverse().map(function (x) {
                return el('li', null, el('span', { class: 'avatar ret', text: '↩' }),
                  el('div', { class: 'hist-main' },
                    el('div', { class: 'hist-top' }, el('b', { class: 'prod-name', text: x[3] }), el('b', { class: 'num c-bad', text: fRpShort(x[6]) })),
                    el('div', { class: 'muted', text: dShort(x[0]) + ' ' + x[1] + ' · ' + x[2] }),
                    el('div', { class: 'tags' }, el('span', { class: 'tag', text: fNum(x[4]) + ' pcs' }), el('span', { class: 'tag', text: titleCase(x[7]) }))));
              })) : el('div', { class: 'empty', text: 'Tidak ada retur di bulan ini' })));
        }).catch(function (e) { body.replaceChildren(errBox(e)); });
      }
    }
    draw();
  }

  /* ---------- Inventory ---------- */
  function stokStatus(x) {
    if (!x.qty) return 'Kosong';
    if (x.rasio == null) return 'Belum terjual';
    if (x.rasio < 2) return 'Tipis';
    if (x.rasio > 6) return 'Lambat';
    return 'Aman';
  }
  function viewStok(v) {
    pageHead(v, 'Monitoring Stok', 'Dari sheet SOH toko. Rasio = berapa bulan stok bisa menutup penjualan.');
    var body = el('div', null, skel(3));
    v.append(body);
    var filter = 'semua', q = '';
    (S.stok ? Promise.resolve(S.stok) : api('stok').then(function (d) { S.stok = d; return d; })).then(function (d) {
      var gt = d.kategori.filter(function (k) { return /grand total/i.test(k.mc3); })[0] || {};
      var kats = d.kategori.filter(function (k) { return !/grand total/i.test(k.mc3); }).sort(function (a, b) { return (b.qty || 0) - (a.qty || 0); });
      var kmax = kats.length ? kats[0].qty : 1;
      var det = d.detail.map(function (x) { x.status = stokStatus(x); return x; });
      var cnt = function (s) { return det.filter(function (x) { return x.status === s; }).length; };
      var mi = 11; while (mi > 0 && !kats.some(function (k) { return k.sales[mi]; })) mi--;
      var list = el('div', { class: 'stok-list' });
      var search = el('input', { class: 'hb-search', type: 'search', placeholder: 'Cari subkategori…' });
      var chips = el('div', { class: 'chips' });
      function drawList() {
        chips.replaceChildren([['semua', 'Semua', det.length], ['Tipis', 'Tipis', cnt('Tipis')], ['Lambat', 'Lambat', cnt('Lambat')], ['Kosong', 'Kosong', cnt('Kosong')]].map(function (c) {
          return el('button', { type: 'button', class: 'chip-btn' + (filter === c[0] ? ' on' : ''), onclick: function () { filter = c[0]; drawList(); } }, c[1], el('span', { text: c[2] }));
        }));
        var qq = search.value.trim().toLowerCase();
        var ord = { Tipis: 0, Lambat: 1, 'Belum terjual': 2, Aman: 3, Kosong: 4 };
        var rows = det.filter(function (x) { return (filter === 'semua' || x.status === filter) && (!qq || (x.mc3 + ' ' + x.mc4).toLowerCase().indexOf(qq) >= 0); })
          .sort(function (a, b) { return ord[a.status] - ord[b.status] || (a.rasio == null ? 99 : a.rasio) - (b.rasio == null ? 99 : b.rasio); });
        list.replaceChildren(rows.length ? rows.map(function (x) {
          return el('div', { class: 'stok-row' },
            el('div', null, el('b', { text: titleCase(x.mc4) }), el('div', { class: 'muted', style: 'font-size:12.5px', text: titleCase(x.mc3) + ' · display ' + fNum(x.display) + ' · terjual ' + BUL3[mi] + ' ' + fNum(x.sales[mi]) })),
            el('div', { class: 'stok-num' }, el('b', { class: 'num', text: fNum(x.qty) }), el('span', { text: 'rasio ' + (x.rasio == null ? '—' : fDec(x.rasio)) })),
            el('span', { class: 'pill st-pill-' + x.status.replace(/ /g, '-'), text: x.status }));
        }) : el('div', { class: 'empty', text: 'Tidak ada yang cocok' }));
      }
      search.addEventListener('input', drawList);
      drawList();
      body.replaceChildren(
        el('div', { class: 'insights' },
          el('div', { class: 'insight' }, el('span', { text: 'Total stok' }), el('b', { text: fNum(gt.qty) }), el('small', { text: fNum(gt.sku) + ' SKU · update ' + (d.update || '—') })),
          el('div', { class: 'insight' }, el('span', { text: 'Rasio stok' }), el('b', { text: fDec(gt.rasio) + ' bulan' }), el('small', { text: 'stok ÷ rata-rata penjualan per bulan' })),
          el('div', { class: 'insight warn' }, el('span', { text: 'Subkategori tipis' }), el('b', { text: fNum(cnt('Tipis')) }), el('small', { text: 'rasio di bawah 2 bulan' }))),
        el('div', { class: 'card section' }, el('h3', { text: 'Stok per kategori' }), el('p', { class: 'sub', text: 'Jumlah stok, display dan penjualan ' + BULAN[mi] }),
          el('div', { class: 'kat-grid' }, kats.map(function (k) {
            return el('div', { class: 'kat-card' }, el('div', { class: 'ra-top' }, el('b', { text: titleCase(k.mc3) }), el('b', { class: 'num', text: fNum(k.qty) })),
              bar(k.qty, kmax, 'hot'),
              el('div', { class: 'tags' }, el('span', { class: 'tag', text: 'rasio ' + fDec(k.rasio) }), el('span', { class: 'tag', text: 'display ' + fNum(k.display) }), el('span', { class: 'tag', text: 'terjual ' + fNum(k.sales[mi]) })));
          }))),
        el('div', { class: 'card section' }, el('h3', { text: 'Stok per subkategori' }),
          el('p', { class: 'sub', text: 'Tipis = rasio < 2 bulan · Lambat = rasio > 6 bulan' }), chips, search, list,
          el('div', { style: 'margin-top:12px' }, dlBtn(function () {
            xlsxDownload('Monitoring Stok SOH ' + CFG.STORE + ' ' + stamp(), [
              { name: 'Per subkategori', rows: [['MC LV 3', 'MC LV 4', 'Status', 'Qty', 'Display', 'Varian', 'SKU', 'Generic', 'Rasio', 'Terjual ' + BUL3[mi]]].concat(det.map(function (x) { return [x.mc3, x.mc4, x.status, x.qty, x.display, x.varian, x.sku, x.generic, x.rasio, x.sales[mi]]; })) },
              { name: 'Per kategori', rows: [['MC LV 3', 'Qty', 'Display', 'Rasio'].concat(BUL3)].concat(kats.map(function (k) { return [k.mc3, k.qty, k.display, k.rasio].concat(k.sales); })) }]);
          }))));
    }).catch(function (e) { body.replaceChildren(errBox(e)); });
  }

  /* ---------- Rekap selisih kas ---------- */
  function viewKasRekap(v) {
    pageHead(v, 'Rekap Selisih Kas', 'Ringkasan hitungan kas per orang per bulan.');
    var tools = el('div', { class: 'toolbar2' }), body = el('div', null, skel(2));
    v.append(tools, body);
    function load(bulan) {
      api('kasRekap', { bulan: bulan || '' }).then(function (d) {
        tools.replaceChildren(monthSel(d.bulanTersedia, d.bulan, load));
        if (!d.list.length) { body.replaceChildren(emptyCard('Belum ada hitungan kas di bulan ini')); return; }
        var by = {};
        d.list.forEach(function (x) { (by[x.username] = by[x.username] || { nama: x.nama, rows: [] }).rows.push(x); });
        tools.append(dlBtn(function () {
          xlsxDownload('Rekap selisih kas ' + bulanLabel(d.bulan), [{ name: 'Rekap', rows: [['Nama', 'Pos', 'Jumlah hitung', 'Ada selisih', 'Total kurang', 'Total lebih']].concat(d.list.map(function (x) { return [x.nama, posOf(x.pos).label, x.hitungan, x.adaSelisih, x.kurang, x.lebih]; })) }]);
        }));
        body.replaceChildren(el('div', { class: 'grid grid-2' }, Object.keys(by).map(function (u) {
          var p = by[u];
          var kurang = p.rows.reduce(function (s, x) { return s + x.kurang; }, 0);
          return el('div', { class: 'card' },
            el('div', { class: 'card-head' }, el('div', { class: 'who' }, el('span', { class: 'avatar', text: initials(p.nama) }), el('b', { text: p.nama })),
              el('span', { class: 'tag ' + (kurang ? 'tag-bad' : 'tag-good'), text: kurang ? 'Kurang ' + fRpShort(kurang) : 'Tidak ada kurang' })),
            el('ul', { class: 'calc' }, p.rows.map(function (x) {
              return el('li', null, el('span', { text: posOf(x.pos).label + ' · ' + x.hitungan + '× hitung' }),
                el('b', { class: 'num ' + (x.adaSelisih ? 'c-bad' : 'c-good'), text: x.adaSelisih ? x.adaSelisih + '× selisih (−' + nf.format(x.kurang) + ' / +' + nf.format(x.lebih) + ')' : 'selalu pas' }));
            })));
        })));
      }).catch(function (e) { body.replaceChildren(errBox(e)); });
    }
    load();
  }

  /* ---------- Jadwal: request ---------- */
  var JENIS = [['OFF', 'OFF (libur)'], ['CT', 'Cuti'], ['PD', 'Shift pagi (PD)'], ['SB', 'Shift siang (SB)'], ['MD', 'Middle (MD)']];
  function statusPill(s) {
    var map = { menunggu: ['warn', 'Menunggu'], disetujui: ['good', 'Disetujui'], ditolak: ['bad', 'Ditolak'], dibatalkan: ['', 'Dibatalkan'],
      menunggu_rekan: ['warn', 'Menunggu rekan'], menunggu_admin: ['warn', 'Menunggu admin'], ditolak_rekan: ['bad', 'Ditolak rekan'],
      tersedia: ['good', 'Tersedia'], diambil: ['', 'Sudah diambil'], batal: ['', 'Batal'] };
    var m = map[s] || ['', s];
    return el('span', { class: 'tag' + (m[0] ? ' tag-' + m[0] : ''), text: m[1] });
  }
  function fDateTime(s) { return fTime(s); }

  function viewRequest(v) {
    pageHead(v, 'Request Jadwal', 'Ajukan OFF, cuti atau shift tertentu untuk periode berikutnya.');
    var body = el('div', null, skel(2));
    v.append(body);
    function load() {
      api('reqList').then(draw).catch(function (e) { body.replaceChildren(errBox(e)); });
    }
    function draw(d) {
      var nx = d.periode.berikut, cur = d.periode.sekarang;
      var open = d.bolehKapanSaja ? (cur.bisaDiubah ? cur : nx) : nx;
      var info = el('div', { class: 'banner ' + (nx.terbuka ? 'b-good' : 'b-warn') },
        el('b', { text: 'Periode ' + nx.label + ' (' + dShort(nx.mulai) + ' – ' + dShort(nx.selesai) + ')' }),
        el('span', { text: nx.terbuka ? 'Request dibuka sampai ' + dShort(nx.batas.slice(0, 10)) + ' pukul 23.59.' : 'Batas request sudah lewat (' + dShort(nx.batas.slice(0, 10)) + ').' + (d.bolehKapanSaja ? ' Sebagai admin Anda tetap bisa menambahkan.' : '') }));
      var tgl = el('input', { type: 'date', id: 'rq-t', min: d.bolehKapanSaja ? todayJkt() : nx.mulai, max: nx.selesai, value: '' });
      var jenis = el('select', { id: 'rq-j' }, JENIS.map(function (j) { return el('option', { value: j[0], text: j[1] }); }));
      var alasan = el('input', { id: 'rq-a', maxlength: 200, placeholder: 'mis. acara keluarga' });
      var pakai = el('input', { type: 'checkbox', id: 'rq-s' });
      var pakaiBox = el('label', { class: 'check' + (d.simpananSaya ? '' : ' hide'), for: 'rq-s' }, pakai, 'Pakai simpanan OFF (sisa ' + d.simpananSaya + ')');
      jenis.addEventListener('change', function () { pakaiBox.classList.toggle('hide', jenis.value !== 'OFF' || !d.simpananSaya); });
      var out = el('div');
      var btn = el('button', { class: 'btn btn-orange btn-block', type: 'submit', disabled: !(nx.terbuka || d.bolehKapanSaja) }, 'Kirim request');
      var form = el('form', { class: 'card', onsubmit: function (e) {
        e.preventDefault(); out.replaceChildren();
        if (!tgl.value) { out.replaceChildren(errBox(new Error('Pilih tanggalnya dulu'))); return; }
        btn.disabled = true;
        api('reqCreate', { tanggal: tgl.value, jenis: jenis.value, alasan: alasan.value, pakaiSimpanan: pakai.checked }).then(function (r) {
          toast('Request terkirim');
          if (r.peringatan.length) alert('Catatan:\n• ' + r.peringatan.join('\n• '));
          load();
        }).catch(function (err) { btn.disabled = false; out.replaceChildren(errBox(err)); });
      } },
        el('h3', { text: 'Ajukan request' }), info,
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' }, el('label', { for: 'rq-t', text: 'Tanggal' }), tgl),
          el('div', { class: 'field' }, el('label', { for: 'rq-j', text: 'Jenis' }), jenis)),
        el('div', { class: 'field' }, el('label', { for: 'rq-a', text: 'Alasan' }), alasan), pakaiBox, btn, out);

      var mine = el('div', { class: 'card' }, el('h3', { text: 'Request saya' }),
        d.saya.length ? el('ul', { class: 'hist' }, d.saya.map(function (r) {
          return el('li', null, el('span', { class: 'avatar sm', text: r.jenis }),
            el('div', { class: 'hist-main' },
              el('div', { class: 'hist-top' }, el('b', { text: dLong(r.tanggal) }), statusPill(r.status)),
              el('div', { class: 'muted', text: r.alasan + (r.pakaiSimpanan ? ' · pakai simpanan OFF' : '') }),
              r.catatanAdmin ? el('div', { class: 'hist-note', text: 'Admin: ' + r.catatanAdmin }) : null,
              r.status === 'menunggu' ? el('div', { class: 'actions' }, el('button', { class: 'btn btn-ghost btn-sm', text: 'Batalkan', onclick: function (e) {
                e.target.disabled = true; api('reqCancel', { id: r.id }).then(function () { toast('Request dibatalkan'); load(); }).catch(function (err) { e.target.disabled = false; toast(err.message, true); });
              } })) : null));
        })) : el('div', { class: 'empty', text: 'Belum ada request' }));

      var adminBox = null;
      if (d.semua) {
        var pending = d.semua.filter(function (r) { return r.status === 'menunggu'; });
        var byDate = {};
        d.semua.filter(function (r) { return r.tanggal >= open.mulai && r.tanggal <= nx.selesai && (r.status === 'menunggu' || r.status === 'disetujui'); })
          .forEach(function (r) { (byDate[r.tanggal] = byDate[r.tanggal] || []).push(r); });
        adminBox = [
          el('div', { class: 'card section' }, el('h3', { text: 'Perlu diputuskan' + (pending.length ? ' (' + pending.length + ')' : '') }),
            pending.length ? el('ul', { class: 'hist' }, pending.slice().reverse().map(function (r) {
              return el('li', null, el('span', { class: 'avatar', text: initials(r.nama) }),
                el('div', { class: 'hist-main' },
                  el('div', { class: 'hist-top' }, el('b', { text: r.nama }), el('span', { class: 'tag tag-warn', text: r.jenis })),
                  el('div', null, dLong(r.tanggal)),
                  el('div', { class: 'muted', text: r.alasan + (r.pakaiSimpanan ? ' · pakai simpanan OFF' : '') }),
                  el('div', { class: 'actions' },
                    el('button', { class: 'btn btn-primary btn-sm', text: 'Setujui', onclick: function (e) { decide(e.target, r, 'setuju'); } }),
                    el('button', { class: 'btn btn-danger btn-sm', text: 'Tolak', onclick: function (e) { decide(e.target, r, 'tolak'); } }))));
            })) : el('p', { class: 'muted', style: 'margin:8px 0 0', text: 'Tidak ada request baru.' })),
          el('div', { class: 'card section' }, el('h3', { text: 'Kalender request' }), el('p', { class: 'sub', text: dShort(open.mulai) + ' – ' + dShort(nx.selesai) + ' · menunggu & disetujui' }),
            Object.keys(byDate).length ? el('ul', { class: 'cal-list' }, Object.keys(byDate).sort().map(function (t) {
              return el('li', null, el('div', { class: 'cal-date' }, el('b', { text: dParts(t).d }), el('span', { text: dDayName(t) })),
                el('div', { class: 'tags' }, byDate[t].map(function (r) { return el('span', { class: 'tag ' + (r.status === 'disetujui' ? 'tag-good' : 'tag-warn'), text: r.nama.split(' ')[0] + ' · ' + r.jenis }); })));
            })) : el('div', { class: 'empty', text: 'Belum ada request di periode ini' }))
        ];
      }
      body.replaceChildren(el('div', { class: 'grid grid-2' }, form, mine), adminBox);
    }
    function decide(btn, r, k) {
      var cat = k === 'tolak' ? prompt('Alasan ditolak (opsional):', '') : '';
      if (cat === null) return;
      btn.disabled = true;
      api('reqDecide', { id: r.id, keputusan: k, catatan: cat || '' }).then(function (res) {
        toast(k === 'setuju' ? 'Request disetujui' : 'Request ditolak');
        if (res.info) alert(res.info);
        S.jadwal = null; load();
      }).catch(function (err) { btn.disabled = false; toast(err.message, true); });
    }
    load();
  }

  /* ---------- Jadwal: tukar shift ---------- */
  function loadTim() {
    if (S.tim) return Promise.resolve(S.tim);
    return api('tim').then(function (d) { S.tim = d; return d; });
  }
  function viewTukar(v) {
    pageHead(v, 'Tukar Shift', 'Ajukan tukar shift dengan rekan. Rekan menerima dulu, lalu admin menyetujui.');
    var body = el('div', null, skel(2));
    v.append(body);
    function load() {
      Promise.all([loadTim(), api('tukarList')]).then(function (r) { draw(r[0], r[1]); }).catch(function (e) { body.replaceChildren(errBox(e)); });
    }
    function draw(tim, d) {
      var me = S.user.username;
      var tgl = el('input', { type: 'date', id: 'tk-t', min: todayJkt() });
      var rekan = el('select', { id: 'tk-r' }, el('option', { value: '', text: 'Pilih rekan' }),
        tim.users.filter(function (u) { return u.username !== me; }).map(function (u) { return el('option', { value: u.username, text: u.nama }); }));
      var alasan = el('input', { id: 'tk-a', maxlength: 200, placeholder: 'mis. ada keperluan pagi' });
      var out = el('div');
      var btn = el('button', { class: 'btn btn-orange btn-block', type: 'submit' }, 'Ajukan tukar shift');
      var form = el('form', { class: 'card', onsubmit: function (e) {
        e.preventDefault(); out.replaceChildren();
        if (!tgl.value || !rekan.value) { out.replaceChildren(errBox(new Error('Pilih tanggal dan rekan dulu'))); return; }
        btn.disabled = true;
        api('tukarCreate', { tanggal: tgl.value, rekan: rekan.value, alasan: alasan.value }).then(function (t) {
          toast('Pengajuan terkirim ke ' + t.namaRekan); load();
        }).catch(function (err) { btn.disabled = false; out.replaceChildren(errBox(err)); });
      } },
        el('h3', { text: 'Ajukan tukar shift' }),
        el('p', { class: 'sub', text: 'Shift Anda dan rekan di tanggal itu diambil otomatis dari jadwal.' }),
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' }, el('label', { for: 'tk-t', text: 'Tanggal' }), tgl),
          el('div', { class: 'field' }, el('label', { for: 'tk-r', text: 'Tukar dengan' }), rekan)),
        el('div', { class: 'field' }, el('label', { for: 'tk-a', text: 'Alasan' }), alasan), btn, out);

      function item(t, actions) {
        return el('li', null, el('span', { class: 'avatar sm', text: '⇄' }),
          el('div', { class: 'hist-main' },
            el('div', { class: 'hist-top' }, el('b', { text: dLong(t.tanggal) }), statusPill(t.status)),
            el('div', null, t.namaPemohon + ' (' + t.shiftPemohon + ') ⇄ ' + t.namaRekan + ' (' + t.shiftRekan + ')'),
            el('div', { class: 'muted', text: t.alasan }), actions ? el('div', { class: 'actions' }, actions) : null));
      }
      var masuk = d.saya.filter(function (t) { return t.rekan === me && t.status === 'menunggu_rekan'; });
      var lists = [
        masuk.length ? el('div', { class: 'card section hl' }, el('h3', { text: 'Menunggu jawaban Anda (' + masuk.length + ')' }),
          el('ul', { class: 'hist' }, masuk.map(function (t) {
            return item(t, [
              el('button', { class: 'btn btn-primary btn-sm', text: 'Terima', onclick: function (e) { act(e.target, 'tukarRespond', { id: t.id, terima: true }, 'Diterima, menunggu admin'); } }),
              el('button', { class: 'btn btn-danger btn-sm', text: 'Tolak', onclick: function (e) { act(e.target, 'tukarRespond', { id: t.id, terima: false }, 'Ditolak'); } })]);
          }))) : null,
        el('div', { class: 'card section' }, el('h3', { text: 'Pengajuan saya' }),
          d.saya.length ? el('ul', { class: 'hist' }, d.saya.map(function (t) {
            var can = t.pemohon === me && (t.status === 'menunggu_rekan' || t.status === 'menunggu_admin');
            return item(t, can ? [el('button', { class: 'btn btn-ghost btn-sm', text: 'Batalkan', onclick: function (e) { act(e.target, 'tukarCancel', { id: t.id }, 'Dibatalkan'); } })] : null);
          })) : el('div', { class: 'empty', text: 'Belum ada pengajuan' }))
      ];
      if (d.semua) {
        var pend = d.semua.filter(function (t) { return t.status === 'menunggu_admin'; });
        lists.push(el('div', { class: 'card section' }, el('h3', { text: 'Perlu disetujui admin' + (pend.length ? ' (' + pend.length + ')' : '') }),
          pend.length ? el('ul', { class: 'hist' }, pend.map(function (t) {
            return item(t, [
              el('button', { class: 'btn btn-primary btn-sm', text: 'Setujui', onclick: function (e) { act(e.target, 'tukarDecide', { id: t.id, keputusan: 'setuju' }, 'Tukar shift disetujui'); } }),
              el('button', { class: 'btn btn-danger btn-sm', text: 'Tolak', onclick: function (e) { act(e.target, 'tukarDecide', { id: t.id, keputusan: 'tolak' }, 'Ditolak'); } })]);
          })) : el('p', { class: 'muted', style: 'margin:8px 0 0', text: 'Tidak ada yang menunggu.' })));
      }
      body.replaceChildren(form, lists);
    }
    function act(btn, action, payload, msg) {
      btn.disabled = true;
      api(action, payload).then(function (r) { toast(msg); if (r && r.info) alert(r.info); S.jadwal = null; load(); }).catch(function (err) { btn.disabled = false; toast(err.message, true); });
    }
    load();
  }

  /* ---------- Jadwal: simpanan OFF ---------- */
  function viewSimpanan(v) {
    pageHead(v, 'Simpanan OFF', 'OFF yang tertunda karena masuk di hari libur.');
    var body = el('div', null, skel(2));
    v.append(body);
    function load() {
      Promise.all([api('simpananList'), isAdmin() ? loadTim() : Promise.resolve(null)]).then(function (r) { draw(r[0], r[1]); }).catch(function (e) { body.replaceChildren(errBox(e)); });
    }
    function item(s, admin) {
      return el('li', null, el('span', { class: 'avatar', text: initials(s.nama) }),
        el('div', { class: 'hist-main' },
          el('div', { class: 'hist-top' }, el('b', { text: admin ? s.nama : 'Masuk ' + dShort(s.tanggalMasuk) }), statusPill(s.status)),
          el('div', { class: 'muted', text: (admin ? 'Masuk ' + dShort(s.tanggalMasuk) + ' · ' : '') + s.keterangan + (s.diambilTanggal ? ' · diambil ' + dShort(s.diambilTanggal) : '') }),
          admin && s.status === 'tersedia' ? el('div', { class: 'actions' },
            el('button', { class: 'btn btn-ghost btn-sm', text: 'Tandai diambil', onclick: function (e) {
              var t = prompt('Tanggal diambil (YYYY-MM-DD):', todayJkt()); if (!t) return;
              act(e.target, { id: s.id, status: 'diambil', tanggal: t });
            } }),
            el('button', { class: 'btn btn-danger btn-sm', text: 'Batalkan', onclick: function (e) { if (confirm('Batalkan simpanan ini?')) act(e.target, { id: s.id, status: 'batal' }); } })) : null));
    }
    function act(btn, payload) {
      btn.disabled = true;
      api('simpananSet', payload).then(function () { toast('Tersimpan'); load(); }).catch(function (err) { btn.disabled = false; toast(err.message, true); });
    }
    function draw(d, tim) {
      var parts = [
        el('div', { class: 'insights' }, el('div', { class: 'insight' }, el('span', { text: 'Simpanan OFF saya' }), el('b', { text: d.saldo + ' hari' }), el('small', { text: 'bisa dipakai saat request OFF' }))),
        el('div', { class: 'card section' }, el('h3', { text: 'Riwayat saya' }),
          d.saya.length ? el('ul', { class: 'hist' }, d.saya.map(function (s) { return item(s, false); })) : el('div', { class: 'empty', text: 'Belum ada simpanan OFF' }))
      ];
      if (d.semua && tim) {
        var u = el('select', { id: 'sp-u' }, el('option', { value: '', text: 'Pilih anggota tim' }), tim.users.map(function (x) { return el('option', { value: x.username, text: x.nama }); }));
        var t = el('input', { type: 'date', id: 'sp-t', value: todayJkt() });
        var k = el('input', { id: 'sp-k', maxlength: 200, placeholder: 'mis. masuk menggantikan saat libur' });
        var out = el('div');
        var btn = el('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Tambah simpanan OFF' });
        parts.push(el('form', { class: 'card section', onsubmit: function (e) {
          e.preventDefault(); out.replaceChildren(); btn.disabled = true;
          api('simpananAdd', { username: u.value, tanggalMasuk: t.value, keterangan: k.value }).then(function () { toast('Simpanan OFF ditambahkan'); load(); })
            .catch(function (err) { btn.disabled = false; out.replaceChildren(errBox(err)); });
        } }, el('h3', { text: 'Tambah simpanan OFF (admin)' }),
          el('div', { class: 'form-grid' }, el('div', { class: 'field' }, el('label', { for: 'sp-u', text: 'Nama' }), u), el('div', { class: 'field' }, el('label', { for: 'sp-t', text: 'Tanggal masuk' }), t)),
          el('div', { class: 'field' }, el('label', { for: 'sp-k', text: 'Keterangan' }), k), btn, out));
        var sald = {};
        d.semua.forEach(function (s) { if (s.status === 'tersedia') sald[s.nama] = (sald[s.nama] || 0) + 1; });
        parts.push(el('div', { class: 'card section' }, el('h3', { text: 'Semua simpanan' }),
          Object.keys(sald).length ? el('div', { class: 'tags', style: 'margin:8px 0 4px' }, Object.keys(sald).map(function (n) { return el('span', { class: 'tag tag-good', text: n.split(' ')[0] + ': ' + sald[n] }); })) : null,
          d.semua.length ? el('ul', { class: 'hist' }, d.semua.map(function (s) { return item(s, true); })) : el('div', { class: 'empty', text: 'Belum ada data' })));
      }
      body.replaceChildren(parts);
    }
    load();
  }

  /* ---------- Aktivitas ---------- */
  function viewAktivitas(v) {
    pageHead(v, 'Catatan Aktivitas', '300 aktivitas terakhir: siapa melakukan apa dan kapan.');
    var body = el('div', { class: 'card' }, skel(2));
    v.append(body);
    api('aktivitas').then(function (list) {
      var q = el('input', { class: 'hb-search', type: 'search', placeholder: 'Cari nama atau aktivitas…' });
      var ul = el('ul', { class: 'hist' });
      function draw() {
        var qq = q.value.trim().toLowerCase();
        ul.replaceChildren(list.filter(function (a) { return !qq || (a.nama + ' ' + a.aksi + ' ' + a.detail).toLowerCase().indexOf(qq) >= 0; }).slice(0, 200).map(function (a) {
          return el('li', null, el('span', { class: 'avatar sm', text: initials(a.nama) }),
            el('div', { class: 'hist-main' }, el('div', { class: 'hist-top' }, el('b', { text: a.nama }), el('span', { class: 'muted', text: fTime(a.waktu) })),
              el('div', null, el('b', { text: a.aksi }), a.detail ? ' · ' + a.detail : '')));
        }));
      }
      q.addEventListener('input', draw); draw();
      body.replaceChildren(q, list.length ? ul : el('div', { class: 'empty', text: 'Belum ada aktivitas' }));
    }).catch(function (e) { body.replaceChildren(errBox(e)); });
  }

  /* ---------- Jadwal ---------- */
  function viewJadwal(v) {
    v.append(el('section', { class: 'hero' }, el('div', null, el('h2', { text: 'Jadwal Shift' }), el('p', { id: 'jd-sub', text: 'Dari sheet JADWAL KARTASURA JAYA' }))));
    var today = el('div', { class: 'card' }, el('h3', { text: 'Hari ini' }), el('div', { class: 'skel', style: 'margin-top:12px' }));
    var table = el('div', { class: 'card section', style: 'padding:0;overflow:hidden' }, el('div', { class: 'skel', style: 'margin:18px' }));
    v.append(today, table);
    loadJadwal().then(function (j) {
      var day = j.hariIni || todayJkt();
      $('#jd-sub').textContent = j.tab ? 'Tab ' + j.tab + ' · ' + dShort(j.tanggal[0]) + ' – ' + dShort(j.tanggal[j.tanggal.length - 1]) : 'Tab jadwal tidak ditemukan';
      today.replaceChildren(el('h3', { text: 'Hari ini' }), el('p', { class: 'sub', text: dLong(day) }), dutyBlock(j, day));
      if (!j.staf.length) { table.replaceChildren(el('div', { class: 'empty', text: 'Jadwal kosong' })); return; }
      var head = el('tr', null, el('th', { class: 'sticky-col', text: 'Nama' }), j.tanggal.map(function (t, i) {
        var p = dParts(t);
        return el('th', { class: 'n' + (t === day ? ' today' : ''), style: 'text-align:center', id: t === day ? 'jd-today' : null },
          el('div', { style: 'font-size:11px;opacity:.8', text: dDayName(t) }), p.d + (p.d === 1 || i === 0 ? ' ' + BUL3[p.m - 1] : ''));
      }), ['PD', 'SB', 'OFF'].map(function (c) { return el('th', { class: 'n', text: 'Σ' + c }); }));
      var body = j.staf.map(function (s) {
        var cnt = {}; s.shift.forEach(function (c) { cnt[c] = (cnt[c] || 0) + 1; });
        return el('tr', null, el('td', { class: 'sticky-col', style: 'font-weight:600', text: titleCase(s.nama) }),
          s.shift.map(function (c, i) {
            return el('td', { class: j.tanggal[i] === day ? 'today' : null, style: 'text-align:center' }, c ? el('span', { class: 'sh sh-' + c, text: c }) : '');
          }),
          ['PD', 'SB', 'OFF'].map(function (c) { return el('td', { class: 'n', text: cnt[c] || 0 }); }));
      });
      table.replaceChildren(el('div', { style: 'padding:18px 18px 8px' }, el('h3', { text: 'Jadwal per orang' }),
        el('p', { class: 'sub', style: 'margin-bottom:0', text: 'PD 08.00–16.00 · NS 08.00–17.00 · MC 11.00–19.00 · MD 12.00–20.00 · SC 13.00–22.00 · SB 14.00–22.00 · OFF libur · CT cuti' })),
        el('div', { class: 'scroll-x', id: 'jd-scroll' }, el('table', { class: 't' }, el('thead', null, head), el('tbody', null, body))));
      var th = $('#jd-today'), sc = $('#jd-scroll');
      if (th && sc) sc.scrollLeft = Math.max(0, th.offsetLeft - 160);
    }).catch(function (err) { today.replaceChildren(errBox(err)); table.replaceChildren(); });
  }

  function dokAdmin(s) {
    var box = el('div', { style: 'margin-top:18px' });
    var url = el('input', { id: 'up-url', placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off' });
    var key = el('input', { id: 'up-key', placeholder: 'Kunci dari Log eksekusi mesin upload', autocomplete: 'off' });
    var btn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Sambungkan', onclick: function () {
      btn.disabled = true;
      api('setUpload', { url: url.value, kunci: key.value }).then(function () { btn.disabled = false; key.value = ''; toast('Mesin upload tersambung'); }).catch(function (err) { btn.disabled = false; toast(err.message, true); });
    } });
    function hm(m) { m = Number(m) || 0; return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); }
    function timeRow(k, label) {
      var inp = el('input', { type: 'time', id: 'set-' + k, value: hm(s[k]), style: 'max-width:150px' });
      var b = el('button', { class: 'btn btn-primary', type: 'button', text: 'Simpan', onclick: function () {
        var p = String(inp.value).split(':'); if (p.length < 2) return;
        b.disabled = true;
        api('setSetting', { key: k, value: Number(p[0]) * 60 + Number(p[1]) }).then(function () { b.disabled = false; toast(label + ' disimpan'); }).catch(function (err) { b.disabled = false; toast(err.message, true); });
      } });
      return el('div', { class: 'field' }, el('label', { for: 'set-' + k, text: label }), el('div', { class: 'inline' }, inp, b));
    }
    var mb = el('input', { id: 'set-dokmb', inputmode: 'numeric', value: String(s.dok_max_mb || 300), style: 'max-width:120px' });
    var mbBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Simpan', onclick: function () {
      var n = Number(mb.value); if (!(n > 0)) { toast('Isi angka MB', true); return; }
      mbBtn.disabled = true;
      api('setSetting', { key: 'dok_max_mb', value: n }).then(function () { mbBtn.disabled = false; toast('Batas ukuran disimpan'); }).catch(function (err) { mbBtn.disabled = false; toast(err.message, true); });
    } });
    box.append(el('h3', { text: 'Dokumentasi video' }),
      el('p', { class: 'sub', text: 'Batas ukuran video dan jam batas notifikasi bila video belum diunggah.' }),
      el('div', { class: 'field' }, el('label', { for: 'set-dokmb', text: 'Maksimal ukuran video (MB)' }), el('div', { class: 'inline' }, mb, mbBtn)),
      timeRow('dok_ingat_open', 'Pengingat opening mulai (RA shift pagi)'), timeRow('dok_batas_open', 'Batas video opening'),
      timeRow('dok_ingat_close', 'Pengingat closing mulai (RA shift siang)'), timeRow('dok_batas_close', 'Batas video closing'),
      timeRow('data_batas', 'Pengingat admin: DSR & By Bin belum diunggah setelah jam'),
      el('h3', { text: 'Mesin upload', style: 'margin-top:18px' }),
      el('p', { class: 'sub', text: 'Alamat Web App dan kunci dari mesin upload di akun pemilik folder Dokumentasi.' }),
      el('div', { class: 'field' }, el('label', { for: 'up-url', text: 'Alamat Web App' }), url),
      el('div', { class: 'field' }, el('label', { for: 'up-key', text: 'Kunci' }), key), btn);
    return box;
  }
  /* ---------- Admin ---------- */
  function viewAdmin(v) {
    v.append(el('section', { class: 'hero' }, el('div', null, el('h2', { text: 'Admin · Akun Tim' }), el('p', { text: 'Setujui pendaftaran, nonaktifkan akun, atau reset password.' }))));
    var box = el('div', null, el('div', { class: 'skel' }));
    var setCard = el('div', { class: 'card section' }, el('h3', { text: 'Pengaturan kas' }), el('div', { class: 'skel', style: 'margin-top:12px;min-height:60px' }));
    v.append(box, setCard, raTargetAdmin());
    api('settings').then(function (s) {
      var vals = { modal_till: Number(s.modal_till) || 0, floating_cash: Number(s.floating_cash) || 0 };
      var row = function (key, id, label) {
        var btn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Simpan' });
        var inp = rpInput(id, vals[key], function (n) { vals[key] = n; });
        btn.addEventListener('click', function () {
          btn.disabled = true;
          api('setSetting', { key: key, value: vals[key] }).then(function () { btn.disabled = false; toast(label + ' disimpan'); })
            .catch(function (err) { btn.disabled = false; toast(err.message, true); });
        });
        return el('div', { class: 'field' }, el('label', { for: id, text: label }), el('div', { class: 'inline' }, inp, btn));
      };
      vals.target_basket = Number(s.target_basket) || 0;
      var uptVal = Number(s.target_upt) || 0;
      var uptInp = el('input', { id: 'set-upt', inputmode: 'decimal', value: String(uptVal).replace('.', ','), style: 'max-width:140px' });
      var uptBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Simpan', onclick: function () {
        var n = Number(String(uptInp.value).replace(',', '.'));
        if (!isFinite(n) || n < 0) { toast('Isi angka, misalnya 2 atau 1,8', true); return; }
        uptBtn.disabled = true;
        api('setSetting', { key: 'target_upt', value: n }).then(function () { uptBtn.disabled = false; toast('Target UPT disimpan'); }).catch(function (err) { uptBtn.disabled = false; toast(err.message, true); });
      } });
      setCard.replaceChildren(el('h3', { text: 'Pengaturan kas' }),
        el('p', { class: 'sub', text: 'Angka standar yang dipakai di menu Cek Kas.' }),
        row('modal_till', 'set-modal', 'Modal till (Float To Till)'),
        row('floating_cash', 'set-float', 'Floating Cash (modal besar)'),
        el('h3', { text: 'Target briefing', style: 'margin-top:18px' }),
        el('p', { class: 'sub', text: 'Patokan fokus otomatis di Briefing Pagi. Basket 0 = tidak dipakai (cukup bulan lalu & rekor).' }),
        el('div', { class: 'field' }, el('label', { for: 'set-upt', text: 'Target UPT' }), el('div', { class: 'inline' }, uptInp, uptBtn)),
        row('target_basket', 'set-basket', 'Target basket size'),
        dokAdmin(s));
    }).catch(function (err) { setCard.replaceChildren(el('h3', { text: 'Pengaturan kas' }), errBox(err)); });
    function load() {
      Promise.all([api('users'), api('tim').catch(function () { return { namaJadwal: [], users: [] }; })]).then(function (res) {
        var users = res[0], tim = res[1];
        S.tim = null;
        var resolved = {}; tim.users.forEach(function (x) { resolved[x.username] = x.namaJadwal; });
        var njSel = function (u) {
          if (u.status !== 'aktif') return null;
          var sel = el('select', { class: 'sel-sm', 'aria-label': 'Nama di jadwal untuk ' + u.nama },
            el('option', { value: '', text: resolved[u.username] ? 'Otomatis: ' + resolved[u.username] : 'Belum cocok, pilih nama…' }),
            tim.namaJadwal.map(function (n) { var o = el('option', { value: n, text: n }); if (n === u.nama_jadwal) o.selected = true; return o; }));
          sel.addEventListener('change', function () {
            api('setNamaJadwal', { username: u.username, namaJadwal: sel.value }).then(function () { toast('Nama di jadwal disimpan'); }).catch(function (err) { toast(err.message, true); });
          });
          return el('div', { class: 'nj' }, el('span', { text: 'Nama di jadwal' }), sel);
        };
        var pending = users.filter(function (u) { return u.status === 'menunggu'; });
        var others = users.filter(function (u) { return u.status !== 'menunggu'; });
        S.menunggu = pending.length; S.badges.admin = pending.length; paintBadges();
        box.replaceChildren(
          el('div', { class: 'card' }, el('h3', { text: 'Menunggu persetujuan' + (pending.length ? ' (' + pending.length + ')' : '') }),
            pending.length ? el('ul', { class: 'list' }, pending.map(function (u) {
              return el('li', null, userInfo(u), el('div', { class: 'actions' },
                el('button', { class: 'btn btn-primary btn-sm', text: 'Setujui', onclick: function (e) { act(e.target, 'setUserStatus', { username: u.username, status: 'aktif' }, u.nama + ' disetujui'); } }),
                el('button', { class: 'btn btn-danger btn-sm', text: 'Tolak', onclick: function (e) { act(e.target, 'setUserStatus', { username: u.username, status: 'nonaktif' }, 'Pendaftaran ' + u.nama + ' ditolak'); } })));
            })) : el('p', { class: 'muted', style: 'margin:10px 0 0', text: 'Tidak ada pendaftaran baru.' })),
          el('div', { class: 'card section' }, el('h3', { text: 'Semua akun' }),
            el('p', { class: 'sub', text: 'Pastikan "Nama di jadwal" cocok, supaya request dan tukar shift bisa ditulis ke sheet jadwal.' }),
            el('ul', { class: 'list' }, others.map(function (u) {
              var me = S.user && u.username === S.user.username;
              return el('li', { class: 'user-li' }, el('div', null, userInfo(u), njSel(u)), me ? el('span', { class: 'muted', style: 'font-size:13px', text: 'Anda' }) : el('div', { class: 'actions' },
                u.status === 'aktif'
                  ? el('button', { class: 'btn btn-ghost btn-sm', text: 'Nonaktifkan', onclick: function (e) { if (confirm('Nonaktifkan akun ' + u.nama + '?')) act(e.target, 'setUserStatus', { username: u.username, status: 'nonaktif' }, 'Akun dinonaktifkan'); } })
                  : el('button', { class: 'btn btn-ghost btn-sm', text: 'Aktifkan', onclick: function (e) { act(e.target, 'setUserStatus', { username: u.username, status: 'aktif' }, 'Akun diaktifkan'); } }),
                el('button', { class: 'btn btn-ghost btn-sm', text: 'Reset password', onclick: function (e) {
                  if (!confirm('Buat password sementara untuk ' + u.nama + '?')) return;
                  e.target.disabled = true;
                  api('resetPassword', { username: u.username }).then(function (r) { e.target.disabled = false; showTempPw(u, r.password); })
                    .catch(function (err) { e.target.disabled = false; toast(err.message, true); });
                } })));
            }))));
      }).catch(function (err) { box.replaceChildren(errBox(err)); });
    }
    function userInfo(u) {
      return el('div', null, el('b', { text: u.nama }), ' ',
        el('span', { class: 'pill pill-' + u.status, text: u.status }), u.role === 'admin' ? [' ', el('span', { class: 'pill pill-admin', text: 'admin' })] : null,
        el('div', { class: 'muted', style: 'font-size:13px', text: '@' + u.username + ' · daftar ' + u.dibuat.slice(0, 10) + (u.login_terakhir ? ' · login ' + u.login_terakhir.slice(0, 16) : '') }));
    }
    function act(btn, action, payload, okMsg) {
      btn.disabled = true;
      api(action, payload).then(function () { toast(okMsg); load(); }).catch(function (err) { btn.disabled = false; toast(err.message, true); });
    }
    function showTempPw(u, pw) {
      var back = el('div', { class: 'modal-back', onclick: function (e) { if (e.target === back) back.remove(); } },
        el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
          el('h3', { text: 'Password sementara' }),
          el('p', { class: 'muted', style: 'margin:0', text: 'Berikan ke ' + u.nama + ' (@' + u.username + '). Minta segera diganti lewat menu Akun.' }),
          el('div', { class: 'temp-pw', text: pw }),
          el('div', { class: 'row' }, el('button', { class: 'btn btn-primary', text: 'Selesai', onclick: function () { back.remove(); } }))));
      document.body.appendChild(back);
    }
    load();
  }

  /* ---------- Akun ---------- */
  function viewAkun(v) {
    v.append(el('section', { class: 'hero' }, el('div', null, el('h2', { text: S.user ? S.user.nama : 'Akun' }),
      el('p', { text: S.user ? '@' + S.user.username + ' · ' + (S.user.role === 'admin' ? 'Admin' : 'Staf') : '' }))));
    var o = el('input', { type: 'password', id: 'pw-o', autocomplete: 'current-password', required: true });
    var n = el('input', { type: 'password', id: 'pw-n', autocomplete: 'new-password', required: true, minlength: 6 });
    var n2 = el('input', { type: 'password', id: 'pw-n2', autocomplete: 'new-password', required: true });
    var out = el('div');
    var btn = el('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'Simpan password' });
    v.append(el('div', { class: 'card', style: 'max-width:520px' }, el('h3', { text: 'Ganti password' }),
      el('form', { onsubmit: function (e) {
        e.preventDefault(); out.replaceChildren();
        if (n.value !== n2.value) { out.replaceChildren(el('div', { class: 'form-msg err', text: 'Ulangi password baru tidak sama' })); return; }
        btn.disabled = true;
        api('changePassword', { oldPassword: o.value, newPassword: n.value }).then(function () {
          out.replaceChildren(el('div', { class: 'form-msg ok', text: 'Password berhasil diganti' }));
          o.value = n.value = n2.value = ''; btn.disabled = false;
        }).catch(function (err) { out.replaceChildren(el('div', { class: 'form-msg err', text: err.message })); btn.disabled = false; });
      } },
        el('div', { class: 'field' }, el('label', { for: 'pw-o', text: 'Password lama' }), o),
        el('div', { class: 'field' }, el('label', { for: 'pw-n', text: 'Password baru' }), n, el('small', { text: 'Minimal 6 karakter' })),
        el('div', { class: 'field' }, el('label', { for: 'pw-n2', text: 'Ulangi password baru' }), n2),
        btn, out)),
      el('button', { class: 'btn btn-danger section', text: 'Keluar dari akun ini', onclick: logout }));
  }

  /* =================== Analisa PICA & laporan WA =================== */
  function rpPlain(v) { return 'Rp' + nf.format(Math.round(v || 0)); }
  function numPlain(v) { return nf.format(Math.round(v || 0)); }
  function pctDot(v) { return v == null || isNaN(v) ? '-' : (v * 100).toFixed(2) + '%'; }
  function daysIn(ym) { var p = ym.split('-').map(Number); return new Date(Date.UTC(p[0], p[1], 0)).getUTCDate(); }
  function prevSameDay(iso) {
    var p = dParts(iso), y = p.y, m = p.m - 1;
    if (m < 1) { m = 12; y--; }
    var ym = y + '-' + pad2(m);
    return ym + '-' + pad2(Math.min(p.d, daysIn(ym)));
  }
  function sumUpto(mon, tgl, mode) {
    var key = mode === 'netto' ? 'netto' : 'bruto';
    var o = { sales: 0, trx: 0, qty: 0, hari: 0, trafficTrx: 0, traffic: 0 };
    (mon.harian || []).forEach(function (h) {
      if (h.tanggal > tgl) return;
      o.sales += h[key]; o.trx += h.trx; o.qty += h.qty; o.hari++;
      var t = (mon.traffic || {})[h.tanggal];
      if (t) { o.traffic += t; o.trafficTrx += h.trx; }
    });
    o.basket = o.trx ? o.sales / o.trx : null;
    o.upt = o.trx ? o.qty / o.trx : null;
    o.cr = o.traffic ? o.trafficTrx / o.traffic : null;
    return o;
  }
  function chg(a, b) { return a == null || b == null || !b ? null : a / b - 1; }

  /** Teks laporan WA sesuai format toko. */
  function buildWA(mon, h, mode, extra) {
    var sm = DSR.summarize(mon, mode);
    var key = mode === 'netto' ? 'netto' : 'bruto';
    var p = dParts(mon.tanggal);
    var sales = h[key];
    var cr = h.traffic ? h.trx / h.traffic : null;
    var lines = [
      CFG.STORE + '- Eiger Store A Yani Kertasura',
      pad2(p.d) + '/' + pad2(p.m) + '/' + p.y,
      '',
      'Daily Sales : ' + rpPlain(sales),
      'Target Harian  : ' + rpPlain(sm.daily.target),
      'CR :' + pctDot(cr),
      'BS: ' + numPlain(h.trx ? sales / h.trx : 0),
      'Wholesale: ' + numPlain(h.wholesale[key]),
      'EA :' + numPlain(h.ea[key]),
      'Disc Employee : ' + numPlain(h.empDisc),
      'promo : IDR' + numPlain(h.promo),
      '',
      'Kumulatif 1-' + daysIn(mon.bulan) + ' ' + BULAN[p.m - 1].toUpperCase() + ' ' + p.y + ' :',
      'TARGET : ' + numPlain(sm.monthly.target),
      'ACH      : ' + rpPlain(sm.monthly.sales) + '/' + pctDot(sm.monthly.ach)
    ];
    if (extra) {
      var sisa = daysIn(mon.bulan) - p.d;
      var need = sm.monthly.target != null ? Math.max(0, sm.monthly.target - sm.monthly.sales) : null;
      lines.push('',
        'Transaksi : ' + h.trx + ' | UPT : ' + (h.trx ? (h.qty / h.trx).toFixed(2) : '-') + (h.traffic ? ' | Traffic : ' + h.traffic : ''),
        'Ach s/d tgl ' + p.d + ' : ' + pctDot(sm.kum.ach) + ' (target ' + rpPlain(sm.kum.target) + ')',
        sisa > 0 && need != null ? 'Butuh per hari : ' + rpPlain(need / sisa) + ' (sisa ' + sisa + ' hari)' : 'Butuh per hari : -');
      if (h.produk.length) {
        lines.push('', 'Top produk :');
        h.produk.slice(0, 3).forEach(function (x, i) { lines.push((i + 1) + '. ' + x[0] + ' (' + rpPlain(mode === 'netto' ? x[3] : x[2]) + ')'); });
      }
      if (h.ra.length) {
        var top = h.ra.slice().sort(function (a, b) { return (mode === 'netto' ? b[2] - a[2] : b[1] - a[1]); })[0];
        lines.push('Top RA : ' + titleCase(top[0]) + ' (' + rpPlain(mode === 'netto' ? top[2] : top[1]) + ')');
      }
    }
    return lines.join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = el('textarea', { style: 'position:fixed;left:-9999px' }); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); res(); } catch (e) { rej(e); } finally { ta.remove(); }
    });
  }

  function waCard(mon, h) {
    var extra = store.get('waExtra') !== '0';
    var pre = el('pre', { class: 'wa-pre' });
    var cb = el('input', { type: 'checkbox', id: 'wa-x' }); cb.checked = extra;
    function draw() { pre.textContent = buildWA(mon, h, S.mode, cb.checked); }
    cb.addEventListener('change', function () { store.set('waExtra', cb.checked ? '1' : '0'); draw(); });
    draw();
    return el('div', { class: 'card wa-card', id: 'wa' },
      el('div', { class: 'card-head' }, el('div', null, el('h3', { text: 'Laporan WhatsApp' }), el('p', { class: 'sub', text: (S.mode === 'netto' ? 'Netto' : 'Bruto') + ' · CR = transaksi ÷ traffic dari sheet SOH' + (h.traffic ? '' : ' (traffic tanggal ini belum tercatat)') })),
        el('span', { class: 'wa-badge' }, icon('whatsapp'))),
      pre,
      el('label', { class: 'check', for: 'wa-x' }, cb, 'Tambahkan data lain (transaksi, UPT, butuh per hari, top produk & RA)'),
      el('div', { class: 'wa-actions' },
        el('button', { class: 'btn btn-primary', type: 'button', onclick: function () {
          copyText(pre.textContent).then(function () { toast('Laporan disalin, tinggal tempel di WhatsApp'); }, function () { toast('Gagal menyalin, salin manual dari kotak di atas', true); });
        } }, icon('copy'), 'Salin teks'),
        el('a', { class: 'btn btn-wa', target: '_blank', rel: 'noopener', href: '#', onclick: function (e) {
          e.currentTarget.href = 'https://wa.me/?text=' + encodeURIComponent(pre.textContent);
        } }, icon('whatsapp'), 'Kirim ke WhatsApp')));
  }

  function hideable(key, title, sub, content) {
    var hidden = {};
    try { hidden = JSON.parse(store.get('picaHide') || '{}'); } catch (e) {}
    var body = el('div', { class: 'pica-body' + (hidden[key] ? ' hide' : '') }, content);
    var btn = el('button', { type: 'button', class: 'mini-btn', text: hidden[key] ? 'Tampilkan' : 'Sembunyikan' });
    btn.addEventListener('click', function () {
      hidden[key] = !hidden[key];
      store.set('picaHide', JSON.stringify(hidden));
      body.classList.toggle('hide', hidden[key]);
      btn.textContent = hidden[key] ? 'Tampilkan' : 'Sembunyikan';
    });
    return el('div', { class: 'card section pica-card' },
      el('div', { class: 'card-head' }, el('div', null, el('h3', { text: title }), sub ? el('p', { class: 'sub', style: 'margin-bottom:0', text: sub }) : null), btn),
      body);
  }

  function viewPica(v) {
    v.append(el('section', { class: 'hero hero-sm' },
      el('div', null, el('h2', { text: 'Analisa PICA · ' + CFG.STORE_NAME }), el('p', { id: 'pica-sub', text: 'Problem Identification & Corrective Action' })),
      el('div', { class: 'hero-right' }, el('b', { text: APP }), el('br'), el('span', { text: 'diambil ' + nowJkt() + (S.user ? ' · ' + S.user.nama : '') }))));
    var tools = el('div', { class: 'toolbar2' }), body = el('div', null, skel(3));
    v.append(tools, body);
    var tanggal = S.picaTgl || '';

    function load() {
      body.replaceChildren(skel(3));
      api('monitoring', { tanggal: tanggal }).then(function (mon) {
        tanggal = mon.tanggal; S.picaTgl = tanggal;
        var pt = prevSameDay(tanggal);
        return Promise.all([
          Promise.resolve(mon),
          api('monitoring', { tanggal: pt }).catch(function () { return null; }),
          loadLap(mon.bulan).catch(function () { return null; }),
          api('laporan', { bulan: pt.slice(0, 7) }).catch(function () { return null; }),
          (S.stok ? Promise.resolve(S.stok) : api('stok').then(function (d) { S.stok = d; return d; })).catch(function () { return null; }),
          api('area').catch(function () { return null; }),
          api('hari', { tanggal: tanggal }).catch(function () { return null; }),
          Promise.resolve(pt)
        ]);
      }).then(function (r) { draw.apply(null, r); }).catch(function (e) { body.replaceChildren(errBox(e)); });
    }

    function draw(mon, prev, lap, lapPrev, stok, area, hari, pt) {
      var dates = mon.harian.map(function (h) { return h.tanggal; }).filter(function (d) { return d <= mon.dataSampai; });
      if (dates.indexOf(tanggal) < 0) dates.push(tanggal);
      var dsel = el('select', { class: 'sel', 'aria-label': 'Tanggal laporan' });
      dates.sort().reverse().forEach(function (t) { var o = el('option', { value: t, text: dDayName(t) + ', ' + dShort(t) }); if (t === tanggal) o.selected = true; dsel.append(o); });
      dsel.addEventListener('change', function () { tanggal = dsel.value; S.picaTgl = tanggal; load(); });
      tools.replaceChildren(dsel, modeSeg(function () { draw(mon, prev, lap, lapPrev, stok, area, hari, pt); }));

      var mode = S.mode, sm = DSR.summarize(mon, mode), p = dParts(tanggal);
      var cur = sumUpto(mon, tanggal, mode), pre = prev ? sumUpto(prev, pt, mode) : null;
      var sisa = daysIn(mon.bulan) - p.d;
      var need = sm.monthly.target != null ? Math.max(0, sm.monthly.target - sm.monthly.sales) : null;
      var needDay = sisa > 0 && need != null ? need / sisa : null;
      $('#pica-sub').textContent = 'Problem Identification & Corrective Action · kumulatif 1–' + p.d + ' ' + BUL3[p.m - 1] + ' · ' + (mode === 'netto' ? 'Netto' : 'Bruto');

      var card = function (cls, label, val, note) { return el('div', { class: 'pc ' + cls }, el('span', { text: label }), el('b', { text: val }), el('small', { text: note })); };
      var cards = el('div', { class: 'pica-cards' },
        card('pc-' + achClass(sm.kum.ach), 'Pencapaian kumulatif', fPct(sm.kum.ach), fRpShort(sm.kum.sales) + ' vs target ' + fRpShort(sm.kum.target)),
        card('pc-' + achClass(sm.daily.ach), 'Pencapaian harian', fPct(sm.daily.ach), fRpShort(sm.daily.sales) + ' vs target ' + fRpShort(sm.daily.target)),
        card('pc-dark', 'Butuh per hari', needDay == null ? (sisa > 0 ? '—' : 'Bulan selesai') : fRpShort(needDay), sisa > 0 ? 'sisa ' + sisa + ' hari · gap ' + fRpShort(need) : 'akhir bulan'));

      var row = function (label, a, b, fmt, extra) {
        var c = chg(a, b);
        return el('tr', null, el('td', { text: label }), el('td', { class: 'n', text: fmt(a) + (extra || '') }), el('td', { class: 'n', text: b == null ? '—' : fmt(b) }),
          el('td', { class: 'n ' + (c == null ? '' : c >= 0 ? 'c-good' : 'c-bad'), text: c == null ? '—' : (c >= 0 ? '▲ ' : '▼ ') + fPct(Math.abs(c)) }));
      };
      var crDiff = cur.cr != null && pre && pre.cr != null ? cur.cr - pre.cr : null;
      var tbl = el('div', { class: 'scroll-x' }, el('table', { class: 't t-light' },
        el('thead', null, el('tr', null, ['Indikator', 'Bulan ini (1–' + p.d + ')', 'Bulan lalu (periode sama)', 'Perubahan'].map(function (t, i) { return el('th', { class: i ? 'n' : null, text: t }); }))),
        el('tbody', null,
          row('Sales', cur.sales, pre && pre.sales, fRpShort),
          row('Transaksi', cur.trx, pre && pre.trx, fNum, ' (' + Math.round(cur.trx / Math.max(1, cur.hari)) + '/hari)'),
          row('Basket size', cur.basket, pre && pre.basket, fRpShort),
          row('UPT', cur.upt, pre && pre.upt, fDec),
          el('tr', null, el('td', { text: 'CR (traffic SOH)' }), el('td', { class: 'n', text: cur.cr == null ? 'belum ada data' : fPct(cur.cr) }),
            el('td', { class: 'n', text: pre && pre.cr != null ? fPct(pre.cr) : '—' }),
            el('td', { class: 'n ' + (crDiff == null ? '' : crDiff >= 0 ? 'c-good' : 'c-bad'), text: crDiff == null ? '—' : (crDiff >= 0 ? '▲ ' : '▼ ') + (Math.abs(crDiff) * 100).toFixed(1) + ' poin' })),
          area && area.total ? el('tr', null, el('td', { text: 'Ach. kumulatif vs Jateng 01' }), el('td', { class: 'n', text: area.toko ? fPct(area.toko.achKum) : '—' }),
            el('td', { class: 'n', text: 'area ' + fPct(area.total.achKum) }), el('td', { class: 'n', text: area.peringkat ? 'peringkat ' + area.peringkat + '/' + area.jumlah : '—' })) : null)));
      var tblNote = el('p', { class: 'note', text: (area && area.tanggal ? 'Data area dari laporan regional per ' + area.tanggal + '. ' : '') + 'Bulan lalu dihitung 1–' + dParts(pt).d + ' ' + BUL3[dParts(pt).m - 1] + '.' });

      /* ---------- problem, data dicek, corrective action ---------- */
      var probs = [], cek = [], acts = [];
      var sev = function (level, text) { probs.push({ level: level, text: text }); };
      if (sm.kum.ach != null && sm.kum.ach < 1) sev(sm.kum.ach < 0.85 ? 'Tinggi' : sm.kum.ach < 0.95 ? 'Sedang' : 'Rendah',
        'Pencapaian kumulatif ' + fPct(sm.kum.ach) + ', kurang ' + fRpShort(-sm.kum.diff) + ' dari target s/d tanggal ' + p.d + '.');
      var cTrx = pre ? chg(cur.trx, pre.trx) : null, cBs = pre ? chg(cur.basket, pre.basket) : null, cUpt = pre ? chg(cur.upt, pre.upt) : null;
      if (cTrx != null && cTrx <= -0.05) sev(cTrx <= -0.15 ? 'Tinggi' : 'Sedang', 'Jumlah transaksi turun ' + fPct(-cTrx) + ' vs bulan lalu (' + cur.trx + ' vs ' + pre.trx + '): masalah traffic atau konversi.');
      if (cBs != null && cBs <= -0.05) sev(cBs <= -0.15 ? 'Tinggi' : 'Sedang', 'Basket size turun ' + fPct(-cBs) + ' (' + fRpShort(cur.basket) + ' vs ' + fRpShort(pre.basket) + ').');
      if (cUpt != null && cUpt <= -0.05) sev('Sedang', 'UPT turun ' + fPct(-cUpt) + ' (' + fDec(cur.upt) + ' vs ' + fDec(pre.upt) + '): pembelian per transaksi makin sedikit.');
      if (crDiff != null && crDiff <= -0.05) sev('Sedang', 'CR turun ' + (Math.abs(crDiff) * 100).toFixed(1) + ' poin (' + fPct(cur.cr) + ' vs ' + fPct(pre.cr) + ').');
      else if (cur.cr != null && cur.cr < 0.5) sev('Sedang', 'CR ' + fPct(cur.cr) + ': kurang dari separuh pengunjung yang belanja.');
      if (sm.daily.ach != null && sm.daily.ach < 0.95) sev('Rendah', 'Pencapaian harian ' + dShort(tanggal) + ' ' + fPct(sm.daily.ach) + ' (' + fRpShort(sm.daily.sales) + ' dari ' + fRpShort(sm.daily.target) + ').');
      var tipis = [];
      if (stok) tipis = stok.detail.filter(function (x) { return stokStatus(x) === 'Tipis'; }).sort(function (a, b) { return (b.sales[dParts(tanggal).m - 1] || 0) - (a.sales[dParts(tanggal).m - 1] || 0); });
      if (tipis.length) sev(tipis.length >= 3 ? 'Sedang' : 'Rendah', tipis.length + ' subkategori stoknya tipis (di bawah 2 bulan penjualan): ' + tipis.slice(0, 4).map(function (x) { return titleCase(x.mc4); }).join(', ') + '.');
      var shareDrop = [];
      if (lap && lapPrev && lap.kategori.length && lapPrev.kategori.length) {
        var K = mode === 'bruto' ? 2 : 3;
        var share = function (L) { var t = 0, m = {}; L.kategori.forEach(function (x) { m[x[0]] = (m[x[0]] || 0) + x[K]; t += x[K]; }); Object.keys(m).forEach(function (k) { m[k] = t ? m[k] / t : 0; }); return m; };
        var a = share(lap), b = share(lapPrev);
        Object.keys(b).forEach(function (k) { var d = (a[k] || 0) - b[k]; if (d <= -0.03) shareDrop.push({ k: k, a: a[k] || 0, b: b[k], d: d }); });
        shareDrop.sort(function (x, y) { return x.d - y.d; });
        if (shareDrop.length) sev('Rendah', 'Kontribusi ' + shareDrop.slice(0, 2).map(function (x) { return titleCase(x.k) + ' turun ' + (Math.abs(x.d) * 100).toFixed(1) + ' poin (' + fPct(x.b) + ' → ' + fPct(x.a) + ')'; }).join(', ') + ' vs bulan lalu.');
      }

      if ((cTrx != null && cTrx < 0) || crDiff != null) cek.push(el('li', null, 'Cek data ', el('b', { text: 'traffic / pengunjung' }), ' di DAILY REPORT (people counter) untuk memastikan yang turun pengunjungnya atau konversinya.' + (cur.cr != null ? ' CR bulan ini ' + fPct(cur.cr) + '.' : '')));
      if (tipis.length) cek.push(el('li', null, 'Cek stok ', el('b', { text: 'subkategori tipis' }), ': ' + tipis.slice(0, 5).map(function (x) { return titleCase(x.mc4) + ' (' + fNum(x.qty) + ' pcs, rasio ' + fDec(x.rasio) + ')'; }).join(', ') + '.'));
      if (lap && lap.jam.length) {
        var K2 = mode === 'bruto' ? 2 : 3, byH = {}, byD = {}, perDate = {};
        lap.jam.forEach(function (x) { byH[x[1]] = (byH[x[1]] || 0) + x[K2]; perDate[x[0]] = (perDate[x[0]] || 0) + x[K2]; });
        Object.keys(perDate).forEach(function (t) { var w = weekday(t); (byD[w] = byD[w] || []).push(perDate[t]); });
        var peakH = Object.keys(byH).sort(function (a, b) { return byH[b] - byH[a]; })[0];
        var avgD = Object.keys(byD).map(function (w) { return { w: Number(w), v: byD[w].reduce(function (s, x) { return s + x; }, 0) / byD[w].length }; }).sort(function (a, b) { return a.v - b.v; });
        if (peakH != null && avgD.length) cek.push(el('li', null, 'Jam paling ramai pukul ', el('b', { text: pad2(peakH) + '.00' }), ', hari paling sepi ', el('b', { text: HARI[avgD[0].w] }), ': cocokkan jadwal shift & jumlah RA di lantai.'));
      }
      if (shareDrop.length) cek.push(el('li', null, 'Bandingkan ', el('b', { text: 'stok display vs gudang' }), ' untuk kategori yang kontribusinya turun (' + shareDrop.slice(0, 3).map(function (x) { return titleCase(x.k); }).join(', ') + ') di menu Monitoring Stok.'));
      if (lap && lap.retur.length) cek.push(el('li', null, 'Ada ', el('b', { text: lap.retur.length + ' baris retur/tukar' }), ' bulan ini, cek alasannya di menu Customer & Retur.'));
      if (lap && lap.ra.length) {
        var K3 = mode === 'bruto' ? 2 : 3, ras = {};
        lap.ra.forEach(function (x) { var o = ras[x[0]] || (ras[x[0]] = { s: 0, q: 0, t: 0 }); o.s += x[K3]; o.q += x[4]; o.t += x[5]; });
        var list = Object.keys(ras).filter(function (k) { return ras[k].t >= 10; }).map(function (k) { return { n: k, upt: ras[k].q / ras[k].t, bs: ras[k].s / ras[k].t }; }).sort(function (a, b) { return a.upt - b.upt; });
        if (list.length >= 2 && cur.upt && list[0].upt < cur.upt * 0.92) cek.push(el('li', null, 'UPT terendah: ', el('b', { text: titleCase(list[0].n) }), ' (' + fDec(list[0].upt) + ' vs rata-rata toko ' + fDec(cur.upt) + ').'));
      }
      if (!cek.length) cek.push(el('li', { text: 'Tidak ada data yang perlu dicek khusus.' }));

      var nAct = 0, act = function () { nAct++; var li = el('li'); add(li, Array.prototype.slice.call(arguments)); acts.push(li); };
      if ((cTrx != null && cTrx <= -0.05) || (crDiff != null && crDiff < 0)) act('Aktifkan ', el('b', { text: 'traffic builder' }), ': broadcast WA ke member, promo jam sepi, dan aktivasi di depan toko pada jam ramai.');
      if ((crDiff != null && crDiff < 0) || (cur.cr != null && cur.cr < 0.6)) act('Jalankan ', el('b', { text: 'greeting & approach' }), ' aktif: setiap pengunjung disapa < 30 detik; Store Head pantau konversi per shift.');
      if ((cBs != null && cBs <= -0.05) || (cUpt != null && cUpt <= -0.05)) act('Dorong ', el('b', { text: 'add-on & bundling' }), ' di kasir (aksesoris, headwear, kaus kaki) untuk menaikkan UPT dan basket size.');
      if (tipis.length) act('Ajukan ', el('b', { text: 'transfer antar toko / repeat order' }), ' untuk subkategori yang stoknya tipis.');
      if (needDay != null && needDay > 0) {
        var bs = cur.basket || 1;
        act('Kejar ', el('b', { text: fRpShort(needDay) + '/hari' }), ' selama ' + sisa + ' hari tersisa (≈ ' + Math.ceil(needDay / bs) + ' transaksi/hari dengan basket saat ini; sekarang rata-rata ' + Math.round(cur.trx / Math.max(1, cur.hari)) + ').');
      }
      if (!acts.length) act('Pertahankan performa: pencapaian sudah sesuai target.');

      var aiText = [
        'Analisa PICA toko EIGER ' + CFG.STORE + ' (' + CFG.STORE_NAME + '), tanggal ' + dShort(tanggal) + ', ' + (mode === 'netto' ? 'Netto' : 'Bruto') + '.',
        'Target bulan: ' + rpPlain(sm.monthly.target) + '. Sales kumulatif 1-' + p.d + ': ' + rpPlain(cur.sales) + ' (ach kumulatif ' + pctDot(sm.kum.ach) + ', ach bulanan ' + pctDot(sm.monthly.ach) + ').',
        'Harian: sales ' + rpPlain(sm.daily.sales) + ' vs target ' + rpPlain(sm.daily.target) + ' (' + pctDot(sm.daily.ach) + ').',
        'Bulan ini vs bulan lalu periode sama: transaksi ' + cur.trx + ' vs ' + (pre ? pre.trx : '-') + ', basket ' + numPlain(cur.basket) + ' vs ' + (pre ? numPlain(pre.basket) : '-') + ', UPT ' + (cur.upt ? cur.upt.toFixed(2) : '-') + ' vs ' + (pre && pre.upt ? pre.upt.toFixed(2) : '-') + ', CR ' + pctDot(cur.cr) + ' vs ' + (pre ? pctDot(pre.cr) : '-') + '.',
        'Butuh per hari: ' + (needDay != null ? rpPlain(needDay) : '-') + ' selama ' + sisa + ' hari.',
        'Masalah terdeteksi: ' + (probs.length ? probs.map(function (x) { return '[' + x.level + '] ' + x.text; }).join(' ') : 'tidak ada.'),
        'Tolong buat analisa PICA yang lebih dalam (problem, penyebab, corrective action dengan PIC dan tenggat) untuk tim toko retail outdoor.'
      ].join('\n');

      body.replaceChildren(
        cards,
        hideable('ind', 'Indikator · ' + CFG.STORE_NAME, 'Kumulatif 1–' + p.d + ' ' + BULAN[p.m - 1], [tbl, tblNote]),
        el('div', { class: 'grid grid-2' },
          hideable('prob', 'Problem identification', 'otomatis dari data', probs.length ? el('ul', { class: 'pica-list' }, probs.map(function (x) {
            return el('li', null, el('span', { class: 'sev sev-' + x.level, text: x.level }), el('span', { text: x.text }));
          })) : el('p', { class: 'muted', text: 'Tidak ada masalah besar yang terdeteksi.' })),
          hideable('cek', 'Data yang perlu dicek Store Head', null, el('ul', { class: 'pica-bullets' }, cek))),
        hideable('act', 'Corrective action', 'saran awal berdasarkan masalah di atas', el('ol', { class: 'pica-ol' }, acts)),
        hari ? waCard(mon, hari) : null,
        hideable('ai', 'Analisa AI', 'analisa lebih dalam & corrective action yang disesuaikan', el('div', { class: 'ai-box' },
          el('b', { text: 'Analisa dengan Claude' }),
          el('p', { class: 'muted', text: '1) Klik Salin data untuk Claude · 2) Klik Buka claude.ai · 3) Tempel di kolom chat lalu kirim. Yang disalin hanya angka, tanpa nama customer.' }),
          el('div', { class: 'wa-actions' },
            el('button', { class: 'btn btn-primary', type: 'button', onclick: function () { copyText(aiText).then(function () { toast('Data disalin untuk Claude'); }, function () { toast('Gagal menyalin', true); }); } }, icon('spark'), 'Salin data untuk Claude'),
            el('a', { class: 'btn btn-ghost', href: 'https://claude.ai/new', target: '_blank', rel: 'noopener' }, 'Buka claude.ai ↗')))));
    }
    load();
  }

  /* =====================================================================
   * Tahap 5: stok by bin, cek display, master artikel, New Arrival, unduh Excel
   * ===================================================================== */

  /* ---------- unduh Excel ---------- */
  function xlsxDownload(filename, sheets) {
    if (!window.XLSX) { toast('Pembuat Excel belum termuat, coba lagi', true); return; }
    var wb = XLSX.utils.book_new();
    sheets.forEach(function (sh) {
      var ws = XLSX.utils.aoa_to_sheet(sh.rows);
      var w = (sh.rows[0] || []).map(function (_, c) {
        var m = 8; for (var r = 0; r < Math.min(sh.rows.length, 300); r++) { var v = sh.rows[r][c]; m = Math.max(m, String(v == null ? '' : v).length); }
        return { wch: Math.min(48, m + 2) };
      });
      ws['!cols'] = w;
      if (sh.rows.length > 1) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sh.rows.length - 1, c: Math.max(0, (sh.rows[0] || []).length - 1) } }) };
      XLSX.utils.book_append_sheet(wb, ws, String(sh.name).slice(0, 31));
    });
    XLSX.writeFile(wb, filename.replace(/[\\/:*?"<>|]+/g, '-') + '.xlsx');
    toast('File Excel diunduh');
  }
  function dlBtn(onClick, label) {
    return el('button', { type: 'button', class: 'btn btn-ghost btn-sm dl-btn', onclick: onClick }, icon('download'), label || 'Unduh Excel');
  }
  function stamp() { return todayJkt(); }

  /* ---------- data by bin & master ---------- */
  var SELL_RE = /^S/i;
  function varKey(sku, nama) {
    var s = String(sku || '').trim(), g = s.length > 9 ? s.slice(0, 9) : s;
    var p = String(nama || '').split(','), w = p.length >= 3 ? p[p.length - 2].trim().toUpperCase() : '';
    return g + (w ? '.' + w : '');
  }
  function splitName(nama) {
    var p = String(nama || '').split(',');
    if (p.length >= 3) return { nama: p.slice(0, p.length - 2).join(',').trim(), warna: p[p.length - 2].trim().toUpperCase(), ukuran: p[p.length - 1].trim() };
    return { nama: String(nama || '').trim(), warna: '', ukuran: '' };
  }
  function daysAgo(iso, today) {
    if (!iso) return null;
    var a = Date.parse(iso + 'T00:00:00Z'), b = Date.parse(today + 'T00:00:00Z');
    return isNaN(a) ? null : Math.round((b - a) / 864e5);
  }
  function loadMaster(force) {
    if (S.master && !force) return Promise.resolve(S.master);
    return api('masterMap').then(function (d) {
      var K = d.kolom, byGen = {};
      var get = function (row, k) { return row[K.indexOf(k)]; };
      Object.keys(d.map).forEach(function (v) { var g = get(d.map[v], 'generic'); if (!byGen[g]) byGen[g] = d.map[v]; });
      S.master = {
        info: d.info, today: d.today, naHari: d.naHari, n: Object.keys(d.map).length,
        of: function (varian, generic) {
          var r = d.map[varian] || byGen[generic || String(varian).split('.')[0]];
          if (!r) return null;
          var o = {}; K.forEach(function (k, i) { o[k] = r[i]; });
          o.exact = !!d.map[varian];
          return o;
        },
        all: function () {
          return Object.keys(d.map).map(function (v) { var o = { varian: v }; K.forEach(function (k, i) { o[k] = d.map[v][i]; }); return o; });
        }
      };
      return S.master;
    });
  }
  function loadBin(force) {
    if (S.bin && !force) return Promise.resolve(S.bin);
    return Promise.all([api('binData'), loadMaster(force).catch(function () { return null; }), api('perfData').catch(function () { return null; })]).then(function (x) {
      var d = x[0], M = x[1], P = x[2], K = d.kolom;
      var rows = d.rows.map(function (r) {
        var o = {}; K.forEach(function (k, i) { o[k] = r[i]; });
        ['total', 'available', 'allocated', 'proses'].forEach(function (k) { o[k] = Number(o[k]) || 0; });
        o.sku = String(o.sku); o.generic = String(o.generic && o.generic !== '-' ? o.generic : o.sku.slice(0, 9));
        var sp = splitName(o.nama);
        o.namaG = sp.nama; o.warna = sp.warna; o.ukuran = sp.ukuran;
        o.varian = varKey(o.sku, o.nama);
        o.nonjual = /^(98|81)/.test(o.sku);
        o.damage = o.zona === 'Damage' || /damage/i.test(o.kategori);
        o.sell = !o.damage && (o.zona === 'Sales Area' || SELL_RE.test(String(o.bin)));
        o.wh = !o.damage && !o.sell && o.zona === 'Warehouse';
        return o;
      });
      var B = { upload: d.upload, rows: rows, today: d.today, naHari: d.naHari, M: M, perf: {}, var30: {} };
      B.attr = function (varian, generic) { return M ? M.of(varian, generic) : null; };
      B.isNew = function (a) { var n = a && a.dibuat ? daysAgo(a.dibuat, B.today) : null; return n != null && n >= 0 && n <= B.naHari; };
      if (P) {
        B.var30 = P.var30 || {};
        P.gen.forEach(function (g) { B.perf[g[0]] = { q6: g[1], q30: g[2], first: g[3], last: g[4] }; });
        Object.keys(P.firstBin || {}).forEach(function (g) { var o = B.perf[g] || (B.perf[g] = { q6: 0, q30: 0, first: '', last: '' }); o.bin = P.firstBin[g]; });
      }
      S.bin = B;
      return B;
    });
  }
  /** Ringkas per varian (tanpa barang bukan jual). */
  function byVarian(B) {
    if (B._var) return B._var;
    var V = {};
    B.rows.forEach(function (r) {
      if (r.nonjual) return;
      var o = V[r.varian] || (V[r.varian] = { varian: r.varian, generic: r.generic, nama: r.namaG, warna: r.warna, lv2: r.lv2, lv3: r.lv3, lv4: r.lv4,
        total: 0, sell: 0, wh: 0, dmg: 0, sellAv: 0, whAv: 0, sizes: {}, bins: {}, skus: {} });
      if (r.damage) { o.dmg += r.total; return; }
      o.total += r.total;
      if (r.sell) { o.sell += r.total; o.sellAv += r.available; }
      if (r.wh) { o.wh += r.total; o.whAv += r.available; }
      if (r.ukuran) o.sizes[r.ukuran] = (o.sizes[r.ukuran] || 0) + r.total;
      o.bins[r.bin] = (o.bins[r.bin] || 0) + r.total;
      o.skus[r.sku] = 1;
    });
    var list = Object.keys(V).map(function (k) {
      var o = V[k];
      o.a = B.attr(o.varian, o.generic);
      o.isNew = B.isNew(o.a);
      o.umur = o.a && o.a.dibuat ? daysAgo(o.a.dibuat, B.today) : null;
      return o;
    });
    // performa per generic (PLC × sell through, 6 bulan)
    var GS = {};
    list.forEach(function (o) { GS[o.generic] = (GS[o.generic] || 0) + o.total; });
    var GP = {};
    Object.keys(GS).forEach(function (g) { GP[g] = perfOf(B, g, GS[g]); });
    list.forEach(function (o) { o.perf = GP[o.generic]; });
    B._gperf = GP;
    B._var = list;
    return list;
  }
  var SIZE_ORD = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', 'M/L', 'L/XL', 'NOS'];
  function sizeCmp(a, b) {
    var na = parseFloat(a), nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    var ia = SIZE_ORD.indexOf(String(a).toUpperCase()), ib = SIZE_ORD.indexOf(String(b).toUpperCase());
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a).localeCompare(String(b));
  }
  function binsText(bins) { return Object.keys(bins).sort().map(function (b) { return b + ' (' + bins[b] + ')'; }).join(', '); }
  function naTags(o) {
    return [o.isNew ? el('span', { class: 'na-tag na-new', text: 'NEW' }) : null, o.perf ? perfTag(o.perf) : null];
  }
  var PERF = ['Laku Sekali', 'Laku', 'Cukup Laku', 'Slow', 'Dead Stock'];
  var PERF_CLS = { 'Laku Sekali': 'p1', 'Laku': 'p2', 'Cukup Laku': 'p3', 'Slow': 'p4', 'Dead Stock': 'p5' };
  /** Kriteria performa: PLC (bulan sejak datang di toko) × sell through 6 bulan. */
  function perfOf(B, g, stok) {
    var p = B.perf[g] || {};
    var q = Math.max(0, p.q6 || 0);
    var dates = [p.first, p.bin].filter(Boolean).sort();
    var datang = dates[0] || '';
    var plc = datang ? Math.max(0, daysAgo(datang, B.today)) / 30.44 : null;
    var st = q + stok > 0 ? q / (q + stok) : null;
    var kat;
    if (!q) kat = plc != null && plc > 4 ? 'Dead Stock' : 'Cukup Laku';
    else if (st >= 0.7) kat = 'Laku Sekali';
    else if (st >= 0.5) kat = plc != null && plc <= 4 ? 'Laku Sekali' : 'Laku';
    else if (st > 0.3) kat = plc != null && plc <= 4 ? 'Laku' : 'Cukup Laku';
    else kat = plc != null && plc <= 4 ? 'Cukup Laku' : 'Slow';
    return { kat: kat, plc: plc, st: st, q6: q, q30: p.q30 || 0, stok: stok, datang: datang, tebakan: !p.bin || (p.first && p.first <= '2026-01-07') };
  }
  function perfTag(pf) { return el('span', { class: 'perf-tag ' + PERF_CLS[pf.kat], title: 'PLC ' + (pf.plc == null ? '?' : pf.plc.toFixed(1)) + ' bln · sell through ' + (pf.st == null ? '—' : Math.round(pf.st * 100) + '%') + ' (6 bln)', text: pf.kat }); }
  function noBinCard() {
    return el('div', { class: 'card empty-cta' }, el('span', { class: 'tile' }, icon('upload')),
      el('h3', { text: 'Belum ada data stok by bin' }),
      el('p', { class: 'muted', text: 'Unggah file export stock by bin dari sistem. Siapa saja boleh mengunggah, kapan saja.' }),
      el('a', { class: 'btn btn-primary', href: '#/unggahbin' }, icon('upload'), 'Unggah By Bin'));
  }
  function binInfoLine(B) {
    var u = B.upload;
    return el('p', { class: 'note', style: 'margin:0 0 12px' }, u ? 'Data by bin ' + fTime(u.waktu) + ' oleh ' + u.nama + ' · ' : '',
      B.M && B.M.info ? 'Master artikel: ' + B.M.info.nama + ' (' + fNum(B.M.n) + ' varian)' : el('b', { text: 'Master artikel belum dimuat, label NEW & season belum tampil.' }));
  }
  function optsOf(list, fn) {
    var m = {}; list.forEach(function (x) { var v = fn(x); if (v) m[v] = (m[v] || 0) + 1; });
    return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; });
  }
  function selectEl(label, opts, val, onChange) {
    var s = el('select', { class: 'sel', 'aria-label': label });
    s.append(el('option', { value: '', text: label + ': semua' }));
    opts.forEach(function (o) { var x = el('option', { value: o, text: o }); if (o === val) x.selected = true; s.append(x); });
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }

  function plainSel(label, opts, val, onChange) {
    var s = el('select', { class: 'sel', 'aria-label': label }, opts.map(function (o) { var x = el('option', { value: o[0], text: o[1] }); if (o[0] === val) x.selected = true; return x; }));
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }
  /* ---------- Stok Artikel (New Arrival, performa, season, lokasi) ---------- */
  function viewStokArt(v) {
    pageHead(v, 'Stok Artikel', 'Stok per varian dari data by bin: New Arrival (dari master), performa produk, season & collection.');
    var body = el('div', null, skel(3));
    v.append(body);
    var st = S.saState || (S.saState = { f: 'semua', perf: '', q: '', season: '', coll: '', kat: '', lok: '', sort: 'qty', show: 60 });
    loadBin().then(function (B) {
      if (!B.rows.length) { body.replaceChildren(noBinCard()); return; }
      var all = byVarian(B).filter(function (o) { return o.total > 0; });
      var pcs = function (l) { return l.reduce(function (s, x) { return s + x.total; }, 0); };
      var na = all.filter(function (o) { return o.isNew; });
      var naBelum = na.filter(function (o) { return o.sell === 0 && o.wh > 0; });
      var lama = all.filter(function (o) { return o.umur != null && o.umur > 365 && o.total >= 5; });
      var tot = pcs(all);
      // NEW di master yang tidak ada stoknya di toko (per generic)
      var adaGen = {}; B.rows.forEach(function (r) { if (r.total > 0) adaGen[r.generic] = 1; });
      var naLuar = [];
      if (B.M) {
        var G = {};
        B.M.all().forEach(function (m) {
          if (!B.isNew(m) || adaGen[m.generic] || /^(98|81)/.test(m.generic)) return;
          var g = G[m.generic] || (G[m.generic] = { generic: m.generic, nama: m.nama, warna: [], a: m });
          if (m.warna && g.warna.indexOf(m.warna) < 0) g.warna.push(m.warna);
          if (m.dibuat && (!g.a.dibuat || m.dibuat < g.a.dibuat)) g.a = m;
        });
        naLuar = Object.keys(G).map(function (k) { return G[k]; }).sort(function (x, y) { return String(y.a.dibuat).localeCompare(String(x.a.dibuat)); });
      }
      var list = el('div', { class: 'art-list' }), chips = el('div', { class: 'chips' }), pchips = el('div', { class: 'chips' }), tools = el('div', { class: 'toolbar2' }), countEl = el('span', { class: 'muted num' });
      var search = el('input', { class: 'hb-search', type: 'search', placeholder: 'Cari nama, SKU atau generic…', value: st.q });
      search.addEventListener('input', function () { st.q = search.value; st.show = 60; draw(); });
      var F = { semua: ['Semua', all], na: ['NEW di toko', na], nab: ['NEW belum terdisplay', naBelum], lama: ['Lama, stok ≥5', lama] };
      if (!F[st.f]) st.f = 'semua';
      function filtered() {
        var qq = st.q.trim().toLowerCase();
        return F[st.f][1].filter(function (o) {
          var a = o.a || {};
          if (st.perf && (!o.perf || o.perf.kat !== st.perf)) return false;
          if (st.season && a.season !== st.season) return false;
          if (st.coll && a.collection !== st.coll) return false;
          if (st.kat && o.lv3 !== st.kat) return false;
          if (st.lok === 'display' && !o.sell) return false;
          if (st.lok === 'gudang' && (o.sell || !o.wh)) return false;
          if (qq && (o.nama + ' ' + o.warna + ' ' + o.varian + ' ' + Object.keys(o.skus).join(' ')).toLowerCase().indexOf(qq) < 0) return false;
          return true;
        }).sort(function (x, y) {
          if (st.sort === 'baru') return (x.umur == null ? 99999 : x.umur) - (y.umur == null ? 99999 : y.umur);
          if (st.sort === 'nama') return (x.nama + x.warna).localeCompare(y.nama + y.warna);
          if (st.sort === 'st') return ((x.perf && x.perf.st) || 0) - ((y.perf && y.perf.st) || 0);
          return y.total - x.total;
        });
      }
      function draw() {
        chips.replaceChildren(Object.keys(F).map(function (k) {
          return el('button', { type: 'button', class: 'chip-btn' + (st.f === k ? ' on' : ''), onclick: function () { st.f = k; st.show = 60; draw(); } }, F[k][0], el('span', { text: fNum(F[k][1].length) }));
        }));
        pchips.replaceChildren(el('span', { class: 'chips-lbl', text: 'Performa:' }), [''].concat(PERF).map(function (k) {
          var n = k ? F[st.f][1].filter(function (o) { return o.perf && o.perf.kat === k; }).length : F[st.f][1].length;
          return el('button', { type: 'button', class: 'chip-btn ' + (k ? 'pc-' + PERF_CLS[k] : '') + (st.perf === k ? ' on' : ''), onclick: function () { st.perf = k; st.show = 60; draw(); } }, k || 'Semua', el('span', { text: fNum(n) }));
        }));
        tools.replaceChildren(
          selectEl('Season', optsOf(all, function (o) { return o.a && o.a.season; }), st.season, function (x) { st.season = x; st.show = 60; draw(); }),
          selectEl('Collection', optsOf(all, function (o) { return o.a && o.a.collection; }), st.coll, function (x) { st.coll = x; st.show = 60; draw(); }),
          selectEl('Kategori', optsOf(all, function (o) { return o.lv3; }), st.kat, function (x) { st.kat = x; st.show = 60; draw(); }),
          plainSel('Lokasi', [['', 'Lokasi: semua'], ['display', 'Ada di display'], ['gudang', 'Hanya di gudang']], st.lok, function (x) { st.lok = x; st.show = 60; draw(); }),
          plainSel('Urutkan', [['qty', 'Urutkan: qty terbanyak'], ['baru', 'Urutkan: terbaru dibuat'], ['st', 'Urutkan: sell through terendah'], ['nama', 'Urutkan: nama A–Z']], st.sort, function (x) { st.sort = x; draw(); }));
        var rows = filtered();
        countEl.textContent = fNum(rows.length) + ' varian · ' + fNum(pcs(rows)) + ' pcs';
        list.replaceChildren(rows.length ? rows.slice(0, st.show).map(artRow) : el('div', { class: 'empty', text: 'Tidak ada yang cocok' }),
          rows.length > st.show ? el('button', { class: 'btn btn-ghost btn-block', text: 'Tampilkan ' + Math.min(60, rows.length - st.show) + ' lagi', onclick: function () { st.show += 60; draw(); } }) : null);
      }
      function artRow(o) {
        var a = o.a || {}, pf = o.perf;
        var meta = [a.season, a.collection, titleCase(o.lv3 || ''), titleCase(o.lv4 || ''), a.dibuat ? 'dibuat ' + dShort(a.dibuat) : null].filter(Boolean).join(' · ');
        return el('details', { class: 'art' },
          el('summary', null,
            el('div', { class: 'art-main' },
              el('div', { class: 'art-top' }, el('b', { text: titleCase(o.nama) }), el('span', { class: 'warna', text: o.warna }), naTags(o)),
              el('div', { class: 'muted art-meta', text: meta || o.varian })),
            el('div', { class: 'art-num' }, el('b', { class: 'num', text: fNum(o.total) }),
              el('span', { text: 'display ' + fNum(o.sell) + ' · gudang ' + fNum(o.wh) }))),
          el('div', { class: 'art-det' },
            el('div', { class: 'kv-row' }, el('span', { text: 'Generic' }), el('b', { class: 'mono', text: o.generic })),
            pf ? el('div', { class: 'kv-row' }, el('span', { text: 'Performa generic' }), el('b', { text: pf.kat + ' · sell through ' + (pf.st == null ? '—' : Math.round(pf.st * 100) + '%') + ' · terjual ' + fNum(pf.q6) + ' pcs (6 bln) · stok ' + fNum(pf.stok) })) : null,
            pf ? el('div', { class: 'kv-row' }, el('span', { text: 'PLC (datang di toko)' }), el('b', { text: pf.datang ? fDec(pf.plc) + ' bulan · sejak ' + dShort(pf.datang) + (pf.tebakan ? ' (perkiraan)' : '') : '—' })) : null,
            el('div', { class: 'kv-row' }, el('span', { text: 'Ukuran' }), el('b', { text: Object.keys(o.sizes).sort(sizeCmp).map(function (s) { return s + ': ' + o.sizes[s]; }).join(' · ') || '—' })),
            el('div', { class: 'kv-row' }, el('span', { text: 'Lokasi' }), el('b', { text: binsText(o.bins) })),
            a.gender || a.activity ? el('div', { class: 'kv-row' }, el('span', { text: 'Segmen' }), el('b', { text: [a.gender, a.activity, a.story].filter(Boolean).join(' · ') })) : null,
            a.dc_status ? el('div', { class: 'kv-row' }, el('span', { text: 'Status DC' }), el('b', { text: a.dc_status })) : null,
            a.harga ? el('div', { class: 'kv-row' }, el('span', { text: 'Harga' }), el('b', { class: 'num', text: 'Rp ' + nf.format(a.harga) })) : null,
            o.dmg ? el('div', { class: 'kv-row' }, el('span', { text: 'Damage' }), el('b', { class: 'c-bad', text: fNum(o.dmg) + ' pcs' })) : null));
      }
      function exportX() {
        var rows = filtered();
        xlsxDownload('Stok Artikel ' + CFG.STORE + ' ' + stamp(), [{ name: 'Stok Artikel', rows: [['Generic', 'Varian', 'Nama', 'Warna', 'NEW', 'Performa', 'Sell through 6 bln %', 'Terjual 6 bln', 'PLC bulan', 'Datang di toko', 'Season', 'Collection', 'Kategori', 'Sub kategori', 'Dibuat', 'Total', 'Display', 'Gudang', 'Damage', 'Ukuran', 'Lokasi bin', 'Status DC', 'Harga']].concat(rows.map(function (o) {
          var a = o.a || {}, pf = o.perf || {};
          return [o.generic, o.varian, o.nama, o.warna, o.isNew ? 'NEW' : '', pf.kat || '', pf.st == null ? '' : Math.round(pf.st * 1000) / 10, pf.q6 || 0, pf.plc == null ? '' : Math.round(pf.plc * 10) / 10, pf.datang || '',
            a.season || '', a.collection || '', o.lv3, o.lv4, a.dibuat || '',
            o.total, o.sell, o.wh, o.dmg, Object.keys(o.sizes).map(function (s) { return s + ':' + o.sizes[s]; }).join(' '), binsText(o.bins), a.dc_status || '', a.harga || ''];
        })) }]);
      }
      function exportLuar() {
        xlsxDownload('NEW belum ada di toko ' + CFG.STORE + ' ' + stamp(), [{ name: 'NEW belum ada', rows: [['Generic', 'Nama', 'Warna', 'Dibuat', 'Season', 'Collection', 'Gender', 'Activity', 'MC LV 2', 'MC LV 3', 'MC LV 4', 'Status DC', 'Harga']].concat(naLuar.map(function (g) {
          var a = g.a;
          return [g.generic, g.nama, g.warna.join(', '), a.dibuat || '', a.season || '', a.collection || '', a.gender || '', a.activity || '', a.lv2 || '', a.lv3 || '', a.lv4 || '', a.dc_status || '', a.harga || ''];
        })) }]);
      }
      // ringkasan performa per generic
      var GP = B._gperf || {}, pc = {};
      PERF.forEach(function (k) { pc[k] = { g: 0, pcs: 0 }; });
      Object.keys(GP).forEach(function (g) { var x = GP[g]; if (!x.stok) return; pc[x.kat].g++; pc[x.kat].pcs += x.stok; });
      var gTot = PERF.reduce(function (s, k) { return s + pc[k].g; }, 0);
      var seasons = {};
      all.forEach(function (o) { var k = (o.a && o.a.season) || '(tanpa season)'; seasons[k] = (seasons[k] || 0) + o.total; });
      var sl = Object.keys(seasons).sort(function (a, b) { return seasons[b] - seasons[a]; }).slice(0, 8);
      var luarShow = 20;
      var luarBox = el('div');
      function drawLuar() {
        luarBox.replaceChildren(naLuar.length ? el('div', { class: 'art-list' }, naLuar.slice(0, luarShow).map(function (g) {
          var a = g.a;
          return el('div', { class: 'art flat' }, el('div', { class: 'art-main' },
            el('div', { class: 'art-top' }, el('b', { text: titleCase(g.nama || g.generic) }), el('span', { class: 'na-tag na-new', text: 'NEW' })),
            el('div', { class: 'muted art-meta', text: [g.generic, g.warna.join(', '), titleCase(a.lv3 || ''), titleCase(a.lv4 || ''), a.gender].filter(Boolean).join(' · ') }),
            el('div', { class: 'muted art-meta', text: [a.dibuat ? 'dibuat ' + dShort(a.dibuat) : '', a.season, a.dc_status ? 'DC: ' + a.dc_status : ''].filter(Boolean).join(' · ') })),
            el('div', { class: 'art-num' }, el('b', { class: 'num', text: a.harga ? fRpShort(a.harga) : '—' }), el('span', { text: 'harga' })));
        }), naLuar.length > luarShow ? el('button', { class: 'btn btn-ghost btn-block', text: 'Tampilkan lagi (' + (naLuar.length - luarShow) + ')', onclick: function () { luarShow += 40; drawLuar(); } }) : null)
          : el('p', { class: 'muted', text: B.M ? 'Semua artikel NEW di master sudah ada stoknya di toko.' : 'Master artikel belum dimuat.' }));
      }
      drawLuar();
      body.replaceChildren(
        binInfoLine(B),
        el('div', { class: 'insights' },
          el('div', { class: 'insight' }, el('span', { text: 'Stok barang jual' }), el('b', { text: fNum(tot) + ' pcs' }), el('small', { text: fNum(all.length) + ' varian · ' + fNum(gTot) + ' generic' })),
          el('div', { class: 'insight good' }, el('span', { text: 'NEW di toko (≤' + B.naHari + ' hari)' }), el('b', { text: fNum(na.length) + ' varian' }), el('small', { text: fNum(pcs(na)) + ' pcs · ' + fPct(tot ? pcs(na) / tot : 0) + ' dari stok' })),
          el('div', { class: 'insight warn' }, el('span', { text: 'NEW belum terdisplay' }), el('b', { text: fNum(naBelum.length) + ' varian' }), el('small', { text: 'masih di gudang, prioritas dipajang' })),
          el('div', { class: 'insight' }, el('span', { text: 'NEW belum ada di toko' }), el('b', { text: fNum(naLuar.length) + ' generic' }), el('small', { text: 'bahan request ke DC' }))),
        el('div', { class: 'card section' },
          el('div', { class: 'card-head' }, el('h3', { text: 'Performa produk' }), el('span', { class: 'muted', style: 'font-size:12.5px', text: 'per generic · sell through 6 bulan' })),
          el('div', { class: 'perf-grid' }, PERF.map(function (k) {
            return el('button', { type: 'button', class: 'perf-card ' + PERF_CLS[k] + (st.perf === k ? ' on' : ''), onclick: function () { st.perf = st.perf === k ? '' : k; st.f = 'semua'; st.show = 60; draw(); list.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
              el('span', { text: k }), el('b', { text: fNum(pc[k].g) }), el('small', { text: fNum(pc[k].pcs) + ' pcs · ' + fPct(gTot ? pc[k].g / gTot : 0) }));
          })),
          el('p', { class: 'note', text: 'Sell through = terjual 6 bulan ÷ (terjual + stok sekarang). PLC = bulan sejak barang datang di toko (penjualan pertama di DSR sejak Jan 2026 atau pertama muncul di data by bin). Ketuk kartu untuk menyaring daftar.' })),
        B.M ? el('div', { class: 'card section' }, el('h3', { text: 'Stok per season' }), el('p', { class: 'sub', text: 'pcs per season dari master artikel' }),
          el('div', { class: 'hb' }, sl.map(function (k) { return el('div', { class: 'hb-row' }, el('span', { class: 'hb-lbl', text: k }), bar(seasons[k], seasons[sl[0]], 'hot'), el('b', { class: 'num', text: fNum(seasons[k]) })); }))) : null,
        el('div', { class: 'card section' },
          el('div', { class: 'card-head' }, el('h3', { text: 'Daftar artikel' }), dlBtn(exportX)),
          chips, pchips, tools, search, el('div', { style: 'margin:6px 0 4px' }, countEl), list),
        el('div', { class: 'card section' },
          el('div', { class: 'card-head' }, el('h3', { text: 'NEW belum ada di toko' }), naLuar.length ? dlBtn(exportLuar) : null),
          el('p', { class: 'sub', text: 'Generic NEW di master artikel (dibuat ≤ ' + B.naHari + ' hari) yang belum ada stoknya di toko. Bahan request ke DC.' }),
          luarBox));
      draw();
    }).catch(function (e) { body.replaceChildren(errBox(e)); });
  }

  /* ---------- Scan barcode dari kamera ---------- */
  function loadScript(src) {
    return new Promise(function (ok, no) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var sc = document.createElement('script'); sc.src = src; sc.onload = function () { ok(); }; sc.onerror = function () { no(new Error('Pustaka scan tidak termuat')); };
      document.head.appendChild(sc);
    });
  }
  function openScanner(onCode) {
    var done = false, stream = null, timer = null, h5 = null;
    var video = el('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
    var holder = el('div', { id: 'scan-holder', class: 'scan-holder' });
    var msg = el('p', { class: 'scan-msg', text: 'Arahkan kamera ke barcode di label produk…' });
    var wrap = el('div', { class: 'sheet-wrap vid-wrap' }, el('div', { class: 'vid-box scan-box' },
      el('div', { class: 'sheet-head' }, el('b', { text: 'Scan barcode' }), el('button', { class: 'sheet-x', 'aria-label': 'Tutup', html: IC.x, onclick: function () { stop(); } })),
      holder, msg));
    document.body.appendChild(wrap); document.body.classList.add('no-scroll');
    function stop() {
      done = true;
      if (timer) clearTimeout(timer);
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      if (h5) { try { h5.stop().catch(function () {}); } catch (e) {} }
      wrap.remove(); document.body.classList.remove('no-scroll');
    }
    function got(code) { if (done) return; if (navigator.vibrate) navigator.vibrate(80); stop(); onCode(code); }
    if ('BarcodeDetector' in window) {
      var det;
      try { det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf'] }); } catch (e) { det = null; }
      if (det) {
        holder.append(video);
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
          stream = s; video.srcObject = s;
          (function tick() {
            if (done) return;
            det.detect(video).then(function (r) { if (r && r.length) got(r[0].rawValue); else timer = setTimeout(tick, 250); }, function () { timer = setTimeout(tick, 400); });
          })();
        }).catch(function () { msg.textContent = 'Kamera tidak bisa dibuka. Izinkan akses kamera di browser.'; });
        return;
      }
    }
    // Safari/iPhone: pakai pustaka html5-qrcode
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js').then(function () {
      if (done) return;
      h5 = new window.Html5Qrcode('scan-holder');
      return h5.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 140 } }, function (txt) { got(txt); }, function () {});
    }).catch(function (e) { msg.textContent = 'Kamera tidak bisa dibuka: ' + (e && e.message ? e.message : e); });
  }

  /* ---------- Cari Barang ---------- */
  function viewCari(v) {
    pageHead(v, 'Cari Barang', 'Cari SKU atau nama artikel, langsung terlihat lokasi bin-nya.');
    var body = el('div', null, skel(2));
    v.append(body);
    loadBin().then(function (B) {
      if (!B.rows.length) { body.replaceChildren(noBinCard()); return; }
      byVarian(B);
      var rows = B.rows.filter(function (r) { return r.total > 0; });
      var search = el('input', { class: 'hb-search big', type: 'search', placeholder: 'Ketik nama artikel, SKU atau generic…', autofocus: true, value: S.cariQ || '' });
      var scanBtn = el('button', { type: 'button', class: 'btn btn-primary scan-btn', onclick: function () {
        openScanner(function (code) {
          var c = String(code).trim();
          var hit = rows.filter(function (r) { return r.sku === c || r.generic === c; })[0];
          if (!hit && /^\d{13}$/.test(c)) hit = rows.filter(function (r) { return c.indexOf(r.sku) >= 0 || r.sku.indexOf(c.slice(0, 12)) >= 0; })[0];
          search.value = hit ? hit.sku : c;
          find();
          toast(hit ? 'Ditemukan: ' + hit.nama : 'Kode ' + c + ' tidak ada di stok toko', !hit);
        });
      } }, icon('scan'), 'Scan barcode');
      var out = el('div');
      var bins = optsOf(rows, function (r) { return r.bin; }).sort();
      var binSel = el('select', { class: 'sel', 'aria-label': 'Pilih bin' }, el('option', { value: '', text: 'Lihat isi bin…' }), bins.map(function (b) { return el('option', { value: b, text: b }); }));
      var binOut = el('div');
      function find() {
        var qq = search.value.trim().toLowerCase(); S.cariQ = search.value;
        if (qq.length < 2) { out.replaceChildren(el('p', { class: 'muted', style: 'margin:8px 2px', text: 'Ketik minimal 2 huruf.' })); return; }
        var words = qq.split(/\s+/);
        var hit = rows.filter(function (r) { var t = (r.nama + ' ' + r.sku + ' ' + r.generic).toLowerCase(); return words.every(function (w) { return t.indexOf(w) >= 0; }); });
        var G = {};
        hit.forEach(function (r) { (G[r.varian] = G[r.varian] || { r: r, list: [] }).list.push(r); });
        var keys = Object.keys(G).slice(0, 40);
        out.replaceChildren(keys.length ? keys.map(function (k) {
          var g = G[k], a = B.attr(k, g.r.generic) || {};
          var o = { isNew: B.isNew(a), perf: B._gperf ? B._gperf[g.r.generic] : null };
          var sizes = {};
          g.list.forEach(function (r) { (sizes[r.ukuran || '-'] = sizes[r.ukuran || '-'] || []).push(r); });
          return el('div', { class: 'card find-card' },
            el('div', { class: 'art-top' }, el('b', { text: titleCase(g.r.namaG) }), el('span', { class: 'warna', text: g.r.warna }), naTags(o)),
            el('div', { class: 'muted art-meta', text: [g.r.generic, a.season, titleCase(g.r.lv4 || '')].filter(Boolean).join(' · ') }),
            el('div', { class: 'find-sizes' }, Object.keys(sizes).sort(sizeCmp).map(function (sz) {
              return el('div', { class: 'find-size' }, el('b', { text: sz }),
                el('div', { class: 'bin-chips' }, sizes[sz].map(function (r) {
                  return el('span', { class: 'bin-chip ' + (r.damage ? 'dmg' : r.sell ? 'sell' : 'wh'), title: r.zona + ' · SKU ' + r.sku }, r.bin, el('i', { text: r.total }));
                })));
            })));
        }) : el('div', { class: 'card' }, el('div', { class: 'empty', text: 'Tidak ditemukan' })),
        Object.keys(G).length > 40 ? el('p', { class: 'muted', text: 'Menampilkan 40 dari ' + Object.keys(G).length + ' varian, perjelas pencarian.' }) : null);
      }
      function showBin() {
        var b = binSel.value;
        if (!b) { binOut.replaceChildren(); return; }
        var list = B.rows.filter(function (r) { return r.bin === b && r.total > 0; }).sort(function (x, y) { return x.nama.localeCompare(y.nama); });
        var sum = list.reduce(function (s, r) { return s + r.total; }, 0);
        binOut.replaceChildren(el('div', { class: 'card-head', style: 'margin-top:10px' }, el('b', { text: b + ' · ' + (list[0] ? list[0].zona : '') + ' · ' + fNum(list.length) + ' SKU · ' + fNum(sum) + ' pcs' }),
          dlBtn(function () {
            xlsxDownload('Isi bin ' + b + ' ' + stamp(), [{ name: b, rows: [['Bin', 'Zona', 'SKU', 'Nama', 'Generic', 'Kategori', 'Total', 'Available']].concat(list.map(function (r) { return [r.bin, r.zona, r.sku, r.nama, r.generic, r.lv4, r.total, r.available]; })) }]);
          })),
          el('div', { class: 't-wrap' }, el('table', { class: 't t-sm' }, el('thead', null, el('tr', null, el('th', { text: 'SKU' }), el('th', { text: 'Nama' }), el('th', { class: 'r', text: 'Qty' }))),
            el('tbody', null, list.map(function (r) { return el('tr', null, el('td', { class: 'mono', text: r.sku }), el('td', { text: r.nama }), el('td', { class: 'r num', text: r.total })); })))));
      }
      search.addEventListener('input', find);
      binSel.addEventListener('change', showBin);
      body.replaceChildren(binInfoLine(B),
        el('div', { class: 'card' }, el('div', { class: 'search-row' }, search, scanBtn),
          el('div', { class: 'legend' }, el('span', { class: 'bin-chip sell', text: 'Display' }), el('span', { class: 'bin-chip wh', text: 'Gudang' }), el('span', { class: 'bin-chip dmg', text: 'Damage' }))),
        el('div', { class: 'section' }, out),
        el('div', { class: 'card section' }, el('div', { class: 'card-head' }, el('h3', { text: 'Isi per bin' }), binSel), binOut,
          el('div', { style: 'margin-top:12px' }, dlBtn(function () {
            xlsxDownload('Stok by bin ' + CFG.STORE + ' ' + stamp(), [{ name: 'By Bin', rows: [['Bin', 'Zona', 'SKU', 'Nama', 'Generic', 'Warna', 'Ukuran', 'MC LV 2', 'MC LV 3', 'MC LV 4', 'Total', 'Available', 'Kategori bin']].concat(B.rows.map(function (r) { return [r.bin, r.zona, r.sku, r.nama, r.generic, r.warna, r.ukuran, r.lv2, r.lv3, r.lv4, r.total, r.available, r.kategori]; })) }]);
          }, 'Unduh semua data by bin'))));
      find();
    }).catch(function (e) { body.replaceChildren(errBox(e)); });
  }

  /* ---------- Cek Display ---------- */
  function displayCalc(B) {
    if (B._disp) return B._disp;
    var vars = byVarian(B).filter(function (o) { return o.sellAv > 0 || o.whAv > 0; });
    var G = {};
    vars.forEach(function (o) {
      var g = G[o.generic] || (G[o.generic] = { generic: o.generic, nama: o.nama, lv2: o.lv2, lv3: o.lv3, lv4: o.lv4, vars: [], sell: 0, wh: 0, isNew: false });
      g.vars.push(o); g.sell += o.sellAv; g.wh += o.whAv; if (o.isNew) g.isNew = true;
    });
    var gens = Object.keys(G).map(function (k) { return G[k]; });
    gens.forEach(function (g) {
      g.shown = g.sell > 0;
      g.belum = !g.shown && g.wh > 0;
      g.missingColors = g.vars.filter(function (o) { return o.sellAv === 0 && o.whAv > 0; });
    });
    vars.forEach(function (o) { o.shown = o.sellAv > 0; o.belum = !o.shown && o.whAv > 0; o.genShown = G[o.generic].shown; });
    var R = {
      vars: vars, gens: gens,
      gBelum: gens.filter(function (g) { return g.belum; }), vBelum: vars.filter(function (o) { return o.belum; }),
      gShown: gens.filter(function (g) { return g.shown; }), vShown: vars.filter(function (o) { return o.shown; }),
      double: vars.filter(function (o) { return o.sellAv >= 2; }).sort(function (a, b) { return b.sellAv - a.sellAv; })
    };
    R.pctG = gens.length ? R.gShown.length / gens.length : 0;
    R.pctV = vars.length ? R.vShown.length / vars.length : 0;
    // rekomendasi pengganti untuk kelebihan display
    var used = {};
    var pool = R.vBelum.slice().sort(function (a, b) { return b.whAv - a.whAv; });
    R.double.forEach(function (o) {
      var need = Math.min(3, o.sellAv - 1), rec = [];
      var pick = function (fn, why) {
        pool.forEach(function (c) { if (rec.length >= need || used[c.varian] || !fn(c)) return; used[c.varian] = 1; rec.push({ o: c, why: why }); });
      };
      pick(function (c) { return c.generic === o.generic; }, 'warna lain generic sama');
      pick(function (c) { return !c.genShown && c.lv2 === o.lv2 && c.lv3 === o.lv3 && c.lv4 === o.lv4; }, 'generic belum terdisplay, MC sama');
      pick(function (c) { return c.genShown && c.lv2 === o.lv2 && c.lv3 === o.lv3 && c.lv4 === o.lv4; }, 'warna belum terdisplay, MC sama');
      o.rec = rec;
    });
    B._disp = R;
    return R;
  }
  function pctGauge(label, val, a, b) {
    var ok = val >= 0.95;
    return el('div', { class: 'gauge-card ' + (ok ? 'ok' : 'low') },
      el('div', { class: 'gauge-top' }, el('span', { text: label }), el('b', { class: 'num', text: fPct(val) })),
      el('div', { class: 'gauge-bar' }, el('i', { style: 'width:' + Math.min(100, val * 100).toFixed(1) + '%' }), el('em', { style: 'left:95%' })),
      el('small', { text: fNum(a) + ' dari ' + fNum(b) + ' terdisplay · target 95%' }));
  }
  function viewDisplay(v) {
    pageHead(v, 'Cek Display', 'Barang yang tidak terlihat, tidak akan terjual. Target minimal 95% terdisplay.');
    var body = el('div', null, skel(3));
    v.append(body);
    var st = S.dpState || (S.dpState = { tab: 'belum', per: 'generic', naOnly: false, genShownOnly: false, kurangWarna: false, mc: 'lv3', mcPer: 'generic', mcStatus: '', mcSort: 'low', show: 50 });
    loadBin().then(function (B) {
      if (!B.rows.length) { body.replaceChildren(noBinCard()); return; }
      var R = displayCalc(B);
      var tabsEl = el('div'), pane = el('div');
      function draw() {
        var sg = segmented([['belum', 'Belum terdisplay (' + R.gBelum.length + ')'], ['sudah', 'Sudah terdisplay'], ['double', 'Display double (' + R.double.length + ')'], ['mc', 'Per MC']], st.tab, function (x) { st.tab = x; st.show = 50; draw(); });
        sg.classList.add('seg-tabs');
        tabsEl.replaceChildren(sg);
        pane.replaceChildren(st.tab === 'belum' ? paneBelum() : st.tab === 'sudah' ? paneSudah() : st.tab === 'double' ? paneDouble() : paneMc());
      }
      function more(n, fn) { return n > st.show ? el('button', { class: 'btn btn-ghost btn-block', text: 'Tampilkan lagi', onclick: function () { st.show += 50; fn(); } }) : null; }
      function whBins(o) { var b = {}; Object.keys(o.bins).forEach(function (k) { if (!SELL_RE.test(k)) b[k] = o.bins[k]; }); return binsText(b); }
      function paneBelum() {
        var list;
        if (st.per === 'generic') {
          list = R.gBelum.filter(function (g) { return !st.naOnly || g.isNew; }).sort(function (a, b) { return b.wh - a.wh; });
        } else {
          list = R.vBelum.filter(function (o) { return (!st.naOnly || o.isNew) && (!st.genShownOnly || o.genShown); }).sort(function (a, b) { return b.whAv - a.whAv; });
        }
        var ctl = el('div', { class: 'toolbar2' },
          segmented([['generic', 'Per generic'], ['varian', 'Per varian']], st.per, function (x) { st.per = x; st.show = 50; draw(); }),
          el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: st.naOnly, onchange: function (e) { st.naOnly = e.target.checked; draw(); } }), 'NEW saja'),
          st.per === 'varian' ? el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: st.genShownOnly, onchange: function (e) { st.genShownOnly = e.target.checked; draw(); } }), 'Hanya warna dari generic yang sudah terdisplay') : null,
          dlBtn(function () {
            xlsxDownload('Belum terdisplay ' + CFG.STORE + ' ' + stamp(), [{ name: 'Belum terdisplay', rows: st.per === 'generic'
              ? [['Generic', 'Nama', 'MC LV 2', 'MC LV 3', 'MC LV 4', 'NEW', 'Warna', 'Qty gudang', 'Bin gudang']].concat(list.map(function (g) { return [g.generic, g.nama, g.lv2, g.lv3, g.lv4, g.isNew ? 'NEW' : '', g.vars.map(function (o) { return o.warna; }).join(', '), g.wh, g.vars.map(whBins).join(', ')]; }))
              : [['Varian', 'Nama', 'Warna', 'MC LV 3', 'MC LV 4', 'NEW', 'Generic sudah terdisplay', 'Qty gudang', 'Bin gudang']].concat(list.map(function (o) { return [o.varian, o.nama, o.warna, o.lv3, o.lv4, o.isNew ? 'NEW' : '', o.genShown ? 'ya' : 'tidak', o.whAv, whBins(o)]; })) }]);
          }));
        return el('div', { class: 'card section' }, ctl,
          el('p', { class: 'muted', style: 'margin:4px 0 8px', text: fNum(list.length) + (st.per === 'generic' ? ' generic' : ' varian') + ' ada di gudang tapi belum ada di Selling Area' }),
          el('div', { class: 'art-list' }, list.slice(0, st.show).map(function (x) {
            var isG = st.per === 'generic';
            return el('div', { class: 'art flat' }, el('div', { class: 'art-main' },
              el('div', { class: 'art-top' }, el('b', { text: titleCase(x.nama) }), isG ? null : el('span', { class: 'warna', text: x.warna }), naTags(isG ? { isNew: x.isNew } : x)),
              el('div', { class: 'muted art-meta', text: (isG ? x.generic + ' · warna ' + x.vars.map(function (o) { return o.warna; }).join(', ') : x.varian) + ' · ' + titleCase(x.lv4 || '') }),
              el('div', { class: 'muted art-meta', text: 'Gudang: ' + (isG ? x.vars.map(whBins).join(', ') : whBins(x)) })),
              el('div', { class: 'art-num' }, el('b', { class: 'num', text: fNum(isG ? x.wh : x.whAv) }), el('span', { text: 'pcs di gudang' })));
          }), more(list.length, draw)));
      }
      function paneSudah() {
        var list = R.gShown.filter(function (g) { return !st.kurangWarna || g.missingColors.length; }).sort(function (a, b) { return b.missingColors.length - a.missingColors.length || b.sell - a.sell; });
        var lengkap = R.gShown.filter(function (g) { return !g.missingColors.length; }).length;
        return el('div', { class: 'card section' },
          el('div', { class: 'stats stats-4' },
            el('div', { class: 'stat' }, el('span', { text: 'Generic terdisplay' }), el('b', { text: fNum(R.gShown.length) })),
            el('div', { class: 'stat' }, el('span', { text: 'Qty di display' }), el('b', { text: fNum(R.gShown.reduce(function (s, g) { return s + g.sell; }, 0)) + ' pcs' })),
            el('div', { class: 'stat' }, el('span', { text: 'Warna lengkap' }), el('b', { class: 'c-good', text: fNum(lengkap) })),
            el('div', { class: 'stat' }, el('span', { text: 'Warna belum lengkap' }), el('b', { class: 'c-bad', text: fNum(R.gShown.length - lengkap) }))),
          el('div', { class: 'toolbar2', style: 'margin-top:10px' },
            el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: st.kurangWarna, onchange: function (e) { st.kurangWarna = e.target.checked; st.show = 50; draw(); } }), 'Hanya yang warnanya belum lengkap'),
            dlBtn(function () {
              xlsxDownload('Sudah terdisplay ' + CFG.STORE + ' ' + stamp(), [{ name: 'Sudah terdisplay', rows: [['Generic', 'Nama', 'MC LV 4', 'Warna di display', 'Qty display', 'Bin display', 'Warna belum dipajang', 'Qty gudang']].concat(list.map(function (g) {
                var sv = g.vars.filter(function (o) { return o.sellAv > 0; });
                return [g.generic, g.nama, g.lv4, sv.map(function (o) { return o.warna + ' (' + o.sellAv + ')'; }).join(', '), g.sell,
                  sv.map(function (o) { var b = {}; Object.keys(o.bins).forEach(function (k) { if (SELL_RE.test(k)) b[k] = o.bins[k]; }); return binsText(b); }).join(', '),
                  g.missingColors.map(function (o) { return o.warna + ' (' + o.whAv + ')'; }).join(', '), g.wh];
              })) }]);
            })),
          el('div', { class: 'art-list' }, list.slice(0, st.show).map(function (g) {
            return el('div', { class: 'art flat' }, el('div', { class: 'art-main' },
              el('div', { class: 'art-top' }, el('b', { text: titleCase(g.nama) }), naTags({ isNew: g.isNew }), g.missingColors.length ? el('span', { class: 'tag tag-warn', text: 'warna belum lengkap' }) : el('span', { class: 'tag tag-good', text: 'lengkap' })),
              el('div', { class: 'color-row' }, g.vars.map(function (o) {
                return el('span', { class: 'color-chip ' + (o.sellAv > 0 ? 'on' : o.whAv > 0 ? 'miss' : 'off'), title: o.sellAv > 0 ? 'display ' + o.sellAv + ' · gudang ' + o.whAv : 'gudang ' + o.whAv },
                  o.warna, el('i', { text: o.sellAv > 0 ? o.sellAv : o.whAv }));
              }))),
              el('div', { class: 'art-num' }, el('b', { class: 'num', text: fNum(g.sell) }), el('span', { text: 'display · gudang ' + fNum(g.wh) })));
          }), more(list.length, draw)),
          el('p', { class: 'note', text: 'Biru = warna sudah dipajang (angka = qty display). Oranye = warna masih di gudang (angka = qty gudang).' }));
      }
      function paneDouble() {
        var kel = R.double.reduce(function (s, o) { return s + o.sellAv - 1; }, 0);
        return el('div', { class: 'card section' },
          el('p', { class: 'muted', style: 'margin:0 0 10px', text: 'Idealnya 1 varian cukup 1 qty di display. Kelebihan bisa dikembalikan ke gudang, raknya dipakai untuk barang yang belum terdisplay. Buka baris untuk melihat rekomendasi pengganti.' }),
          el('div', { class: 'stats stats-3' },
            el('div', { class: 'stat' }, el('span', { text: 'Varian di display' }), el('b', { text: fNum(R.vShown.length) })),
            el('div', { class: 'stat' }, el('span', { text: 'Double / lebih' }), el('b', { class: 'c-bad', text: fNum(R.double.length) })),
            el('div', { class: 'stat' }, el('span', { text: 'Total kelebihan' }), el('b', { text: fNum(kel) + ' pcs' }))),
          el('div', { class: 'toolbar2', style: 'margin-top:10px' }, dlBtn(function () {
            var rows = [['Varian', 'Nama', 'Warna', 'MC LV 4', 'Qty display', 'Kelebihan', 'Bin display', 'Rekomendasi pengganti']];
            R.double.forEach(function (o) {
              rows.push([o.varian, o.nama, o.warna, o.lv4, o.sellAv, o.sellAv - 1, Object.keys(o.bins).filter(function (k) { return SELL_RE.test(k); }).join(', '),
                o.rec.map(function (r) { return r.o.nama + ' ' + r.o.warna + ' [' + whBins(r.o) + ']'; }).join(' | ')]);
            });
            xlsxDownload('Display double ' + CFG.STORE + ' ' + stamp(), [{ name: 'Display double', rows: rows }]);
          })),
          el('div', { class: 'art-list' }, R.double.slice(0, st.show).map(function (o) {
            return el('details', { class: 'art' }, el('summary', null,
              el('div', { class: 'art-main' }, el('div', { class: 'art-top' }, el('b', { text: titleCase(o.nama) }), el('span', { class: 'warna', text: o.warna }), naTags(o)),
                el('div', { class: 'muted art-meta', text: titleCase(o.lv4 || '') + ' · ' + Object.keys(o.bins).filter(function (k) { return SELL_RE.test(k); }).join(', ') })),
              el('div', { class: 'art-num' }, el('b', { class: 'num c-bad', text: '+' + (o.sellAv - 1) }), el('span', { text: o.sellAv + ' pcs di display' }))),
              el('div', { class: 'art-det' }, o.rec.length ? o.rec.map(function (r) {
                return el('div', { class: 'rec' }, el('span', { class: 'rec-ic' }, icon('swap')),
                  el('div', null, el('b', { text: titleCase(r.o.nama) + ' · ' + r.o.warna }), naTags(r.o),
                    el('div', { class: 'muted', style: 'font-size:12.5px', text: r.why + ' · gudang ' + r.o.whAv + ' pcs · ' + whBins(r.o) })));
              }) : el('p', { class: 'muted', style: 'margin:0', text: 'Tidak ada pengganti dengan MC yang sama.' })));
          }), more(R.double.length, draw)));
      }
      function paneMc() {
        var key = st.mc;
        var M = {};
        var src = st.mcPer === 'generic' ? R.gens : R.vars;
        src.forEach(function (x) {
          var k = (key === 'lv4' ? (x.lv3 + ' › ' + x.lv4) : x.lv3) || '-';
          var m = M[k] || (M[k] = { k: k, total: 0, shown: 0, wh: 0, sell: 0 });
          m.total++; if (x.shown) m.shown++; else if (x.belum) m.wh++;
        });
        var list = Object.keys(M).map(function (k) { var m = M[k]; m.pct = m.total ? m.shown / m.total : 0; return m; })
          .filter(function (m) { return !st.mcStatus || (st.mcStatus === 'low' ? m.pct < 0.95 : m.pct >= 0.95); })
          .sort(function (a, b) { return st.mcSort === 'high' ? b.pct - a.pct : st.mcSort === 'belum' ? b.wh - a.wh : st.mcSort === 'nama' ? a.k.localeCompare(b.k) : a.pct - b.pct; });
        return el('div', { class: 'card section' },
          el('div', { class: 'toolbar2' },
            segmented([['lv3', 'MC LV 3'], ['lv4', 'MC LV 4']], st.mc, function (x) { st.mc = x; draw(); }),
            segmented([['generic', 'Per generic'], ['varian', 'Per varian']], st.mcPer, function (x) { st.mcPer = x; draw(); }),
            segmented([['', 'Semua'], ['low', '< 95%'], ['ok', '≥ 95%']], st.mcStatus, function (x) { st.mcStatus = x; draw(); }),
            (function () {
              var s = el('select', { class: 'sel', 'aria-label': 'Urutkan' }, [['low', '% terendah'], ['high', '% tertinggi'], ['belum', 'Belum terdisplay terbanyak'], ['nama', 'Nama A–Z']].map(function (o) { var x = el('option', { value: o[0], text: 'Urutkan: ' + o[1] }); if (o[0] === st.mcSort) x.selected = true; return x; }));
              s.addEventListener('change', function () { st.mcSort = s.value; draw(); });
              return s;
            })(),
            dlBtn(function () {
              xlsxDownload('Analisa display per MC ' + CFG.STORE + ' ' + stamp(), [{ name: 'Per MC', rows: [['MC', 'Total ' + st.mcPer, 'Terdisplay', 'Belum terdisplay', '% terdisplay']].concat(list.map(function (m) { return [m.k, m.total, m.shown, m.wh, Math.round(m.pct * 1000) / 10]; })) }]);
            })),
          el('div', { class: 'mc-list' }, list.map(function (m) {
            return el('div', { class: 'mc-row' },
              el('div', { class: 'mc-name' }, el('b', { text: titleCase(m.k) }), el('span', { class: 'muted', text: fNum(m.shown) + '/' + fNum(m.total) + ' · ' + fNum(m.wh) + ' belum' })),
              el('div', { class: 'gauge-bar sm ' + (m.pct >= 0.95 ? 'ok' : 'low') }, el('i', { style: 'width:' + (m.pct * 100).toFixed(1) + '%' }), el('em', { style: 'left:95%' })),
              el('b', { class: 'num ' + (m.pct >= 0.95 ? 'c-good' : 'c-bad'), text: fPct(m.pct) }));
          })));
      }
      body.replaceChildren(binInfoLine(B),
        el('div', { class: 'grid grid-2' },
          pctGauge('Generic terdisplay', R.pctG, R.gShown.length, R.gens.length),
          pctGauge('Varian (generic + warna) terdisplay', R.pctV, R.vShown.length, R.vars.length)),
        el('div', { class: 'insights section' },
          el('div', { class: 'insight warn' }, el('span', { text: 'Generic belum terdisplay' }), el('b', { text: fNum(R.gBelum.length) }), el('small', { text: fNum(R.gBelum.filter(function (g) { return g.isNew; }).length) + ' di antaranya NEW' })),
          el('div', { class: 'insight' }, el('span', { text: 'Varian belum terdisplay' }), el('b', { text: fNum(R.vBelum.length) }), el('small', { text: 'termasuk warna lain dari generic yang sudah dipajang' })),
          el('div', { class: 'insight' }, el('span', { text: 'Display double' }), el('b', { text: fNum(R.double.length) + ' varian' }), el('small', { text: 'qty display 2 atau lebih' }))),
        el('div', { class: 'section' }, tabsEl), pane,
        el('p', { class: 'note', text: 'Selling area = zona Sales Area atau bin berawalan S. Dihitung dari Available Qty. Barang bukan jual (kode 98 & 81) dan zona Damage tidak dihitung.' }));
      draw();
    }).catch(function (e) { body.replaceChildren(errBox(e)); });
  }

  /* ---------- Pengumuman ---------- */
  function viewPengumuman(v) {
    pageHead(v, 'Pengumuman', 'Info penting untuk tim. Tekan "Sudah baca" setelah membaca.');
    var form = isAdmin() ? el('div', { class: 'card' }) : null, list = el('div', { class: 'section' }, skel(2));
    v.append(form, list);
    var edit = null;
    function drawForm() {
      if (!form) return;
      var j = el('input', { id: 'pg-j', placeholder: 'Judul pengumuman', value: edit ? edit.judul : '' });
      var i = el('textarea', { id: 'pg-i', class: 'brief-fokus', rows: 5, placeholder: 'Isi pengumuman…' }); i.value = edit ? edit.isi : '';
      var pen = el('input', { type: 'checkbox', checked: edit ? edit.penting : false });
      var ulang = el('input', { type: 'checkbox' });
      var btn = el('button', { class: 'btn btn-primary', type: 'button', text: edit ? 'Simpan perubahan' : 'Kirim pengumuman', onclick: function () {
        btn.disabled = true;
        api('pengSave', { id: edit ? edit.id : '', judul: j.value, isi: i.value, penting: pen.checked, ulangBaca: ulang.checked }).then(function () {
          toast(edit ? 'Pengumuman diperbarui' : 'Pengumuman terkirim ke tim'); edit = null; drawForm(); load(); loadNotif(true);
        }).catch(function (err) { btn.disabled = false; toast(err.message, true); });
      } });
      form.replaceChildren(el('h3', { text: edit ? 'Ubah pengumuman' : 'Tulis pengumuman' }),
        el('div', { class: 'field' }, el('label', { for: 'pg-j', text: 'Judul' }), j),
        el('div', { class: 'field' }, el('label', { for: 'pg-i', text: 'Isi' }), i),
        el('label', { class: 'check' }, pen, 'Penting (muncul di Beranda sampai dibaca)'),
        edit ? el('label', { class: 'check' }, ulang, 'Minta semua membaca ulang') : null,
        el('div', { class: 'inline', style: 'gap:8px;margin-top:12px' }, btn, edit ? el('button', { class: 'btn btn-ghost', type: 'button', text: 'Batal', onclick: function () { edit = null; drawForm(); } }) : null));
    }
    function load() {
      api('pengList').then(function (d) {
        list.replaceChildren(d.list.length ? d.list.map(function (p) {
          var baca = el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Sudah baca', onclick: function () {
            baca.disabled = true;
            api('pengBaca', { id: p.id }).then(function () { toast('Ditandai sudah dibaca'); load(); loadNotif(true); }).catch(function (err) { baca.disabled = false; toast(err.message, true); });
          } });
          return el('div', { class: 'card peng' + (p.dibaca ? '' : ' unread') + (p.penting ? ' penting' : '') + (p.aktif ? '' : ' arsip') },
            el('div', { class: 'card-head' }, el('div', null, el('h3', null, p.penting ? el('span', { class: 'tag tag-bad', text: 'PENTING' }) : null, ' ', p.judul),
              el('p', { class: 'muted', style: 'margin:2px 0 0;font-size:12.5px', text: p.nama + ' · ' + fTime(p.dibuat) + (p.diubah ? ' · diubah ' + fTime(p.diubah) : '') + (p.aktif ? '' : ' · diarsipkan') })),
              p.dibaca ? el('span', { class: 'tag tag-good', text: '✓ sudah baca' }) : baca),
            el('div', { class: 'peng-isi', text: p.isi }),
            p.pembaca ? el('details', { class: 'peng-readers' }, el('summary', { text: 'Dibaca ' + p.jumlahBaca + ' / ' + p.jumlahTim + ' orang' }),
              el('div', { class: 'tags', style: 'margin-top:8px' }, p.pembaca.map(function (r) { return el('span', { class: 'tag ' + (r.waktu ? 'tag-good' : 'tag-warn'), text: r.nama + (r.waktu ? ' · ' + fTime(r.waktu) : ' · belum') }); }))) : null,
            isAdmin() ? el('div', { class: 'inline', style: 'gap:8px;margin-top:10px' },
              el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Ubah', onclick: function () { edit = p; drawForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }),
              el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: p.aktif ? 'Arsipkan' : 'Aktifkan lagi', onclick: function () { api('pengArsip', { id: p.id, aktif: !p.aktif }).then(function () { load(); }).catch(function (err) { toast(err.message, true); }); } })) : null);
        }) : emptyCard('Belum ada pengumuman'));
      }).catch(function (e) { list.replaceChildren(errBox(e)); });
    }
    drawForm(); load();
  }
  function pengBanner() {
    var box = el('div');
    api('pengList').then(function (d) {
      var un = d.list.filter(function (p) { return p.aktif && !p.dibaca && p.penting; });
      if (!un.length) return;
      box.replaceChildren(un.slice(0, 2).map(function (p) {
        return el('a', { class: 'peng-banner', href: '#/pengumuman' }, el('span', { class: 'pb-ic' }, icon('bell')), el('div', null, el('b', { text: p.judul }), el('span', { text: p.isi.slice(0, 120) + (p.isi.length > 120 ? '…' : '') })), el('span', { class: 'duty-link' }, 'Baca', icon('arrow')));
      }));
    }).catch(function () {});
    return box;
  }

  /* ---------- Handover dari foto buku ---------- */
  var HO_SHIFT = ['Pagi → Siang', 'Siang → Closing', 'Closing → Pagi', 'Lainnya'];
  function compressImage(file, maxW) {
    return new Promise(function (ok, no) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, sc = Math.min(1, (maxW || 1800) / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var d = c.toDataURL('image/jpeg', 0.85);
        ok({ b64: d.slice(d.indexOf(',') + 1), preview: d });
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('Foto tidak bisa dibaca')); };
      img.src = url;
    });
  }
  function viewHandover(v) {
    pageHead(v, 'Handover', 'Catatan serah terima shift. Foto halaman buku, tulisan dibaca otomatis jadi teks.');
    var formCard = el('div', { class: 'card' }), list = el('div', { class: 'card section' }, el('div', { class: 'skel', style: 'min-height:80px' }));
    v.append(el('div', { class: 'grid grid-up' }, formCard, list));
    var fotos = [];
    var jam = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date()));
    var shift = jam < 15 ? HO_SHIFT[0] : jam < 21 ? HO_SHIFT[1] : HO_SHIFT[2];
    var tgl = el('input', { type: 'date', id: 'ho-t', value: todayJkt(), max: todayJkt() });
    var isi = el('textarea', { id: 'ho-i', class: 'brief-fokus', rows: 10, placeholder: 'Isi handover… (terisi otomatis dari foto, boleh diedit)' });
    var thumbs = el('div', { class: 'ho-thumbs' });
    var status = el('p', { class: 'muted', style: 'margin:6px 0 0;font-size:13px' });
    var input = el('input', { type: 'file', accept: 'image/*', id: 'ho-f', multiple: true });
    var drop = el('label', { class: 'drop', for: 'ho-f' }, el('span', { class: 'drop-ic' }, icon('file')), el('span', { class: 'drop-txt' }, el('b', { text: 'Foto halaman buku handover' }), el('span', { text: 'Bisa lebih dari satu foto · pastikan terang & lurus' })), input);
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []); input.value = '';
      (function next() {
        var f = files.shift(); if (!f) { status.textContent = fotos.length ? 'Teks hasil scan bisa diperbaiki sebelum disimpan.' : ''; return; }
        status.textContent = 'Membaca tulisan dari foto…';
        compressImage(f, 1800).then(function (img) {
          var th = el('div', { class: 'ho-thumb busy' }, el('img', { src: img.preview, alt: 'Foto handover' }));
          thumbs.append(th);
          return api('hoOcr', { gambar: img.b64 }).then(function (r) {
            th.classList.remove('busy');
            fotos.push(r.foto);
            if (r.teks) isi.value = (isi.value.trim() ? isi.value.trim() + '\n\n' : '') + r.teks;
            else toast('Tulisan di foto tidak terbaca, ketik manual ya', true);
          });
        }).catch(function (err) { toast(err.message, true); }).then(next);
      })();
    });
    var btn = el('button', { class: 'btn btn-orange btn-block', type: 'button', text: 'Simpan handover', onclick: function () {
      btn.disabled = true;
      api('hoSave', { tanggal: tgl.value, shift: shift, isi: isi.value, foto: fotos }).then(function () {
        toast('Handover tersimpan & dikirim ke tim'); fotos = []; isi.value = ''; thumbs.replaceChildren(); status.textContent = ''; btn.disabled = false; loadList();
      }).catch(function (err) { btn.disabled = false; toast(err.message, true); });
    } });
    formCard.append(el('h3', { text: 'Tulis handover' }),
      el('div', { class: 'field' }, el('label', { text: 'Shift' }), segmented(HO_SHIFT.map(function (x) { return [x, x]; }), shift, function (x) { shift = x; })),
      el('div', { class: 'field' }, el('label', { for: 'ho-t', text: 'Tanggal' }), tgl),
      drop, thumbs, status,
      el('div', { class: 'field', style: 'margin-top:12px' }, el('label', { for: 'ho-i', text: 'Isi handover' }), isi),
      btn);
    function loadList() {
      api('hoList').then(function (items) {
        list.replaceChildren(el('h3', { text: 'Handover terakhir' }), items.length ? el('div', { class: 'ho-list' }, items.map(function (h) {
          return el('details', { class: 'art ho-item' }, el('summary', null, el('div', { class: 'art-main' },
            el('div', { class: 'art-top' }, el('b', { text: h.shift }), el('span', { class: 'tag', text: dShort(h.tanggal) })),
            el('div', { class: 'muted art-meta', text: h.nama + ' · ' + fTime(h.waktu) + (h.foto.length ? ' · ' + h.foto.length + ' foto' : '') }),
            el('div', { class: 'ho-prev', text: h.isi.slice(0, 120) + (h.isi.length > 120 ? '…' : '') }))),
            el('div', { class: 'art-det' }, el('div', { class: 'peng-isi', text: h.isi || '(tanpa teks)' }),
              el('small', { class: 'muted', style: 'display:block;margin-top:8px', text: h.pembaca && h.pembaca.length ? 'Dibaca: ' + h.pembaca.join(', ') : 'Belum ada yang menandai sudah baca' }),
              h.foto.length ? el('div', { class: 'ho-thumbs' }, h.foto.map(function (id) {
                return el('a', { class: 'ho-thumb', href: 'https://drive.google.com/file/d/' + id + '/view', target: '_blank', rel: 'noopener' }, el('img', { src: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w600', alt: 'Foto handover', loading: 'lazy' }));
              })) : null));
        })) : el('div', { class: 'empty', text: 'Belum ada handover' }));
      }).catch(function (e) { list.replaceChildren(errBox(e)); });
    }
    loadList();
  }

  /* ---------- Rekap kepatuhan video per RA ---------- */
  function dokRaTxt(r) {
    var o = r.OPENING, c = r.CLOSING, P = [];
    if (o.tugas) P.push('opening ' + o.tepat + '/' + o.tugas + ' tepat' + (o.telat ? ', ' + o.telat + ' telat' : '') + (o.kosong ? ', ' + o.kosong + ' tidak ada' : ''));
    if (c.tugas) P.push('closing ' + c.tepat + '/' + c.tugas + ' tepat' + (c.telat ? ', ' + c.telat + ' telat' : '') + (c.kosong ? ', ' + c.kosong + ' tidak ada' : ''));
    return P.join(' · ') || 'tidak ada tugas';
  }
  function dokRaRows(list) {
    return [['Nama', 'Tugas opening', 'Opening tepat', 'Opening telat', 'Opening tidak ada', 'Tugas closing', 'Closing tepat', 'Closing telat', 'Closing tidak ada']].concat(list.map(function (r) {
      return [r.nama, r.OPENING.tugas, r.OPENING.tepat, r.OPENING.telat, r.OPENING.kosong, r.CLOSING.tugas, r.CLOSING.tepat, r.CLOSING.telat, r.CLOSING.kosong];
    }));
  }
  function dokRaCard(list, title, extra) {
    function cell(x) {
      if (!x.tugas) return el('td', { class: 'r muted', text: '—' });
      var pct = x.tepat / x.tugas;
      return el('td', { class: 'r' }, el('b', { class: 'num ' + (pct >= 0.999 ? 'c-good' : pct >= 0.7 ? '' : 'c-bad'), text: x.tepat + '/' + x.tugas }),
        x.telat || x.kosong ? el('small', { class: 'muted', style: 'display:block;font-size:11px', text: (x.telat ? x.telat + ' telat' : '') + (x.telat && x.kosong ? ' · ' : '') + (x.kosong ? x.kosong + ' kosong' : '') }) : null);
    }
    return el('div', { class: 'card section' }, el('div', { class: 'card-head' }, el('h3', { text: title }), extra || null),
      el('p', { class: 'sub', text: 'Tepat = video ada sebelum jam batas. Shift pagi bertugas opening, shift siang closing.' }),
      list.length ? el('div', { class: 't-wrap' }, el('table', { class: 't t-sm' },
        el('thead', null, el('tr', null, el('th', { text: 'RA' }), el('th', { class: 'r', text: 'Opening' }), el('th', { class: 'r', text: 'Closing' }))),
        el('tbody', null, list.map(function (r) { return el('tr', null, el('td', { text: titleCase(r.nama) }), cell(r.OPENING), cell(r.CLOSING)); })))) : el('div', { class: 'empty', text: 'Belum ada data jadwal untuk periode ini' }));
  }
  function dokRekapBulan(bulan) {
    var box = el('div', null, el('div', { class: 'card section' }, el('div', { class: 'skel', style: 'min-height:60px' })));
    api('dokRekap', { bulan: bulan }).then(function (d) {
      var dl = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: function () { xlsxDownload('Kepatuhan video ' + CFG.STORE + ' ' + d.bulan, [{ name: 'Video per RA', rows: dokRaRows(d.list) }]); } }, icon('download'), 'Excel');
      box.replaceChildren(dokRaCard(d.list, 'Kepatuhan video · ' + BULAN[Number(d.bulan.slice(5)) - 1] + ' ' + d.bulan.slice(0, 4), dl));
    }).catch(function (e) { box.replaceChildren(errBox(e)); });
    return box;
  }

  /* ---------- Handover di Beranda ---------- */
  function hoBeranda() {
    var box = el('div');
    api('hoList').then(function (items) {
      var me = S.user && S.user.username, kemarin = addDays(todayJkt(), -1);
      var h = items.filter(function (x) { return x.tanggal >= kemarin && x.username !== me; })[0];
      if (!h) return;
      var btn = el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Sudah saya baca', onclick: function (e) {
        e.preventDefault(); btn.disabled = true;
        api('hoBaca', { id: h.id }).then(function () { h.dibaca = true; draw(); loadNotif(true); toast('Handover ditandai sudah dibaca'); }).catch(function (err) { btn.disabled = false; toast(err.message, true); });
      } });
      function draw() {
        box.replaceChildren(el('div', { class: 'card ho-home section' + (h.dibaca ? ' read' : '') },
          el('div', { class: 'card-head' }, el('div', null, el('h3', null, icon('clip'), ' Handover ', el('span', { class: 'tag', text: h.shift })),
            el('p', { class: 'muted', style: 'margin:2px 0 0;font-size:12.5px', text: h.nama + ' · ' + fTime(h.waktu) + (h.pembaca.length ? ' · dibaca ' + h.pembaca.length + ' orang' : '') })),
            h.dibaca ? el('span', { class: 'tag tag-good', text: '✓ sudah baca' }) : btn),
          el('div', { class: 'peng-isi' + (h.dibaca ? ' clamp' : ''), text: h.isi || '(lihat foto)' }),
          el('a', { class: 'duty-link', href: '#/handover', style: 'margin-top:8px;display:inline-flex' }, 'Semua handover', icon('arrow'))));
      }
      draw();
    }).catch(function () {});
    return box;
  }

  /* ---------- Papan apresiasi ---------- */
  function apItem(x, onDel) {
    var me = S.user && S.user.username;
    return el('div', { class: 'ap-item' },
      el('div', { class: 'ap-ic' }, icon('star')),
      el('div', { class: 'ap-b' },
        el('div', { class: 'ap-who' }, el('b', { text: x.nama }), ' → ', el('b', { text: x.untukNama })),
        el('p', { text: x.isi }),
        el('small', { class: 'muted', text: fTime(x.waktu) })),
      onDel && (x.username === me || isAdmin()) ? el('button', { class: 'link-btn', type: 'button', text: 'Hapus', onclick: function () { onDel(x); } }) : null);
  }
  function apBeranda() {
    var box = el('div');
    api('apList').then(function (list) {
      var d7 = addDays(todayJkt(), -7);
      var baru = list.filter(function (x) { return x.waktu.slice(0, 10) >= d7; }).slice(0, 3);
      box.replaceChildren(el('div', { class: 'card section ap-home' },
        el('div', { class: 'card-head' }, el('h3', { text: '⭐ Apresiasi tim' }), el('a', { class: 'duty-link', href: '#/apresiasi' }, baru.length ? 'Lihat & tulis' : 'Tulis apresiasi', icon('arrow'))),
        baru.length ? el('div', { class: 'ap-list' }, baru.map(function (x) { return apItem(x); })) : el('p', { class: 'muted', style: 'margin:6px 0 0', text: 'Belum ada apresiasi minggu ini. Jadilah yang pertama berterima kasih ke rekan!' })));
    }).catch(function () {});
    return box;
  }
  function viewApresiasi(v) {
    pageHead(v, 'Apresiasi', 'Ucapan terima kasih terbuka untuk rekan. Tampil di Beranda selama seminggu.');
    var form = el('div', { class: 'card' }), list = el('div', { class: 'card section' }, el('div', { class: 'skel', style: 'min-height:80px' }));
    v.append(el('div', { class: 'grid grid-up' }, form, list));
    api('fbTujuan').then(function (users) {
      var untuk = el('select', { id: 'ap-u' }, el('option', { value: 'tim', text: 'Seluruh tim' }), users.map(function (u) { return el('option', { value: u.username, text: u.nama }); }));
      var isi = el('textarea', { id: 'ap-i', class: 'brief-fokus', rows: 4, maxlength: 500, placeholder: 'Contoh: Terima kasih sudah bantu rapikan gudang kemarin, jadi cepat selesai 🙏' });
      var btn = el('button', { class: 'btn btn-orange btn-block', type: 'button', text: 'Kirim apresiasi', onclick: function () {
        btn.disabled = true;
        api('apKirim', { untuk: untuk.value, isi: isi.value }).then(function () { toast('Apresiasi terkirim ⭐'); isi.value = ''; btn.disabled = false; load(); })
          .catch(function (err) { btn.disabled = false; toast(err.message, true); });
      } });
      form.replaceChildren(el('h3', { text: 'Tulis apresiasi' }),
        el('div', { class: 'field' }, el('label', { for: 'ap-u', text: 'Untuk' }), untuk),
        el('div', { class: 'field' }, el('label', { for: 'ap-i', text: 'Pesan' }), isi),
        el('p', { class: 'muted', style: 'font-size:12.5px;margin:0 0 12px', text: 'Namamu ikut tampil. Untuk kritik atau saran tanpa nama, pakai menu Feedback Anonim.' }), btn);
    }).catch(function (e) { form.replaceChildren(errBox(e)); });
    function load() {
      api('apList').then(function (items) {
        list.replaceChildren(el('h3', { text: 'Apresiasi terbaru' }), items.length ? el('div', { class: 'ap-list' }, items.map(function (x) {
          return apItem(x, function (it) { api('apHapus', { id: it.id }).then(function () { toast('Dihapus'); load(); }).catch(function (err) { toast(err.message, true); }); });
        })) : el('div', { class: 'empty', text: 'Belum ada apresiasi' }));
      }).catch(function (e) { list.replaceChildren(errBox(e)); });
    }
    load();
  }

  /* ---------- Feedback anonim ---------- */
  var FB_HINT = {
    apresiasi: 'Yang sudah bagus dari kamu: …\nDampaknya buat tim/toko: …',
    saran: 'Yang saya perhatikan: …\nAkan lebih baik kalau: …'
  };
  function viewFeedback(v) {
    pageHead(v, 'Feedback Anonim', 'Saran & apresiasi tanpa nama. Pesan dikumpulkan lalu dikirim serentak tiap jam 08.00.');
    var form = el('div', { class: 'card' }), inbox = el('div', { class: 'card section' }, el('div', { class: 'skel', style: 'min-height:80px' }));
    var adminBox = el('div');
    v.append(el('div', { class: 'grid grid-up' }, form, inbox), adminBox);
    var jenis = 'saran';
    api('fbTujuan').then(function (users) {
      var untuk = el('select', { id: 'fb-u' }, el('option', { value: '', text: '— pilih —' }), el('option', { value: 'toko', text: 'Untuk toko (masukan umum ke pengelola)' }), users.map(function (u) { return el('option', { value: u.username, text: u.nama }); }));
      var isi = el('textarea', { id: 'fb-i', class: 'brief-fokus', rows: 6, maxlength: 1500, placeholder: FB_HINT[jenis] });
      var btn = el('button', { class: 'btn btn-orange btn-block', type: 'button', text: 'Kirim tanpa nama', onclick: function () {
        if (!untuk.value) { toast('Pilih penerima dulu', true); return; }
        btn.disabled = true;
        api('fbKirim', { untuk: untuk.value, jenis: jenis, isi: isi.value }).then(function (r) {
          isi.value = ''; btn.disabled = false;
          toast('Terkirim. Sampai ke penerima ' + (r.kirim === todayJkt() ? 'hari ini' : 'besok') + ' jam 08.00');
        }).catch(function (err) { btn.disabled = false; toast(err.message, true); });
      } });
      form.replaceChildren(el('h3', { text: 'Kirim feedback' }),
        el('div', { class: 'fb-safe' }, icon('shield'), el('span', { text: 'Namamu tidak disimpan di mana pun, termasuk oleh admin. Maksimal 3 feedback per hari.' })),
        el('div', { class: 'field' }, el('label', { text: 'Jenis' }), segmented([['saran', '💡 Saran perbaikan'], ['apresiasi', '👍 Apresiasi']], jenis, function (x) { jenis = x; isi.placeholder = FB_HINT[x]; })),
        el('div', { class: 'field' }, el('label', { for: 'fb-u', text: 'Untuk' }), untuk),
        el('div', { class: 'field' }, el('label', { for: 'fb-i', text: 'Pesan' }), isi),
        el('p', { class: 'muted', style: 'font-size:12.5px;margin:0 0 12px', text: 'Tulis perilakunya, bukan orangnya. Hindari detail yang membuat kamu mudah ditebak.' }), btn);
    }).catch(function (e) { form.replaceChildren(errBox(e)); });
    function load() {
      api('fbMasuk').then(function (d) {
        inbox.replaceChildren(el('h3', { text: 'Feedback untukmu' }), d.list.length ? el('div', { class: 'fb-list' }, d.list.map(function (x) {
          var lap = el('button', { class: 'link-btn', type: 'button', text: x.dilaporkan ? 'Sudah dilaporkan' : 'Laporkan', disabled: x.dilaporkan, onclick: function () {
            var alasan = window.prompt('Kenapa dilaporkan? (mis. kasar, menyerang pribadi)');
            if (alasan == null) return;
            lap.disabled = true;
            api('fbLapor', { id: x.id, alasan: alasan }).then(function () { lap.textContent = 'Sudah dilaporkan'; toast('Dilaporkan ke admin'); }).catch(function (err) { lap.disabled = false; toast(err.message, true); });
          } });
          return el('div', { class: 'fb-item ' + x.jenis + (x.dibaca ? '' : ' unread') },
            el('div', { class: 'fb-top' }, el('span', { class: 'tag ' + (x.jenis === 'apresiasi' ? 'tag-good' : 'tag-warn'), text: x.jenis === 'apresiasi' ? '👍 Apresiasi' : '💡 Saran' }),
              x.untuk === 'toko' ? el('span', { class: 'tag', text: 'Untuk toko' }) : null, el('small', { class: 'muted', text: dShort(x.kirim) })),
            el('div', { class: 'peng-isi', text: x.isi }), el('div', { style: 'text-align:right' }, lap));
        })) : el('div', { class: 'empty', text: 'Belum ada feedback untukmu' }));
        loadNotif(true);
        if (d.ringkas) {
          var r = d.ringkas;
          adminBox.replaceChildren(el('div', { class: 'card section' }, el('h3', { text: 'Ringkasan 30 hari (admin)' }),
            el('p', { class: 'sub', text: 'Isi feedback antar rekan tidak bisa dibaca admin, kecuali yang dilaporkan.' }),
            el('div', { class: 'insights' },
              el('div', { class: 'insight good' }, el('span', { text: 'Apresiasi' }), el('b', { text: r.apresiasi })),
              el('div', { class: 'insight warn' }, el('span', { text: 'Saran' }), el('b', { text: r.saran })),
              el('div', { class: 'insight' }, el('span', { text: 'Antar rekan' }), el('b', { text: r.antarRekan })),
              el('div', { class: 'insight' }, el('span', { text: 'Menunggu dikirim' }), el('b', { text: r.menunggu }))),
            d.laporan.length ? el('div', { style: 'margin-top:14px' }, el('h3', { text: 'Dilaporkan' }), d.laporan.map(function (x) {
              return el('div', { class: 'fb-item saran' }, el('div', { class: 'fb-top' }, el('span', { class: 'tag tag-bad', text: 'Dilaporkan' }), el('small', { class: 'muted', text: 'untuk ' + x.untuk + ' · ' + dShort(x.kirim) })),
                el('div', { class: 'peng-isi', text: x.isi }), x.alasan ? el('small', { class: 'muted', text: 'Alasan: ' + x.alasan }) : null);
            })) : null));
        }
      }).catch(function (e) { inbox.replaceChildren(errBox(e)); });
    }
    load();
  }

  /* ---------- Laporan mingguan ---------- */
  function weekList() {
    var t = todayJkt(), p = dParts(t), d = new Date(Date.UTC(p.y, p.m - 1, p.d));
    var dow = (d.getUTCDay() + 6) % 7; // Senin = 0
    var mon = addDays(t, -dow), out = [];
    out.push({ dari: mon, sampai: addDays(t, -1) < mon ? mon : addDays(t, -1), label: 'Minggu ini (sampai kemarin)' });
    for (var i = 1; i <= 10; i++) { var m = addDays(mon, -7 * i); out.push({ dari: m, sampai: addDays(m, 6), label: dShort(m).replace(/ \d{4}$/, '') + ' – ' + dShort(addDays(m, 6)) }); }
    return out;
  }
  function viewMingguan(v) {
    pageHead(v, 'Laporan Mingguan', 'Ringkasan satu minggu (Senin–Minggu) untuk dilaporkan ke atasan. Bisa diunduh Excel, dicetak/PDF, atau disalin ke WA.');
    var weeks = weekList(), wi = S.mgIdx == null ? 1 : S.mgIdx;
    var tools = el('div', { class: 'toolbar2 no-print' }), body = el('div', null, skel(3));
    v.append(tools, body);
    function load() {
      var w = weeks[wi];
      tools.replaceChildren(plainSel('Minggu', weeks.map(function (x, i) { return [String(i), x.label]; }), String(wi), function (x) { wi = Number(x); S.mgIdx = wi; load(); }), modeSeg(function () { load(); }));
      body.replaceChildren(skel(3));
      Promise.all([api('mingguan', { dari: w.dari, sampai: w.sampai }), loadMaster().catch(function () { return null; }), loadBin().catch(function () { return null; })])
        .then(function (x) { draw(x[0], x[1], x[2]); }).catch(function (e) { body.replaceChildren(errBox(e)); });
    }
    function draw(d, M, B) {
      var K = S.mode === 'netto' ? 'netto' : 'bruto', col = K === 'netto' ? 4 : 3, rcol = K === 'netto' ? 2 : 1;
      var sales = d.hari.reduce(function (s, h) { return s + h[K]; }, 0);
      var target = d.hari.reduce(function (s, h) { return s + (h.target || 0); }, 0);
      var trx = d.hari.reduce(function (s, h) { return s + h.trx; }, 0), qty = d.hari.reduce(function (s, h) { return s + h.qty; }, 0);
      var trf = 0, trxT = 0; d.hari.forEach(function (h) { if (h.traffic) { trf += h.traffic; trxT += h.trx; } });
      var cr = trf ? trxT / trf : null;
      var naS = 0;
      if (M && M.info) d.varian.forEach(function (x) { var a = M.of(x[0]); var n = a && a.dibuat ? daysAgo(a.dibuat, M.today) : null; if (n != null && n >= 0 && n <= M.naHari) naS += x[col]; });
      var R = B && B.rows.length ? displayCalc(B) : null;
      var basket = d.kpi[K === 'netto' ? 'basketN' : 'basketB'];
      var lengkapData = d.dataSampai >= d.sampai;
      var rows = [
        ['Sales (' + (K === 'netto' ? 'netto' : 'bruto') + ')', fRpShort(sales), target ? 'target ' + fRpShort(target) + ' · ach ' + fPct(sales / target) : '—'],
        ['Transaksi', fNum(trx), fNum(trx / d.hari.length) + ' per hari'],
        ['UPT', fDec(d.kpi.upt), 'tanpa pembelian partai (' + d.kpi.partai + ' struk)'],
        ['Basket size', rbTxt(basket), ''],
        ['CR (traffic SOH)', cr != null ? fPct(cr) : '—', trf ? 'traffic ' + fNum(trf) : 'traffic belum tercatat'],
        ['Kontribusi NEW', M && M.info ? fPct(sales ? naS / sales : 0) : '—', M && M.info ? fRpShort(naS) : 'master belum dimuat'],
        ['Display (saat ini)', R ? fPct(R.pctG) + ' generic · ' + fPct(R.pctV) + ' varian' : '—', 'target 95%'],
        ['Selisih kas', d.kas.selisih ? d.kas.selisih + '× selisih' : 'tidak ada', d.kas.hitung + '× hitung · kurang ' + fRpShort(d.kas.kurang) + ' · lebih ' + fRpShort(d.kas.lebih)],
        ['Dokumentasi video', d.dok ? d.dok.lengkap + ' / ' + d.dok.hari + ' hari lengkap' : '—', 'opening & closing']
      ];
      function waText() {
        var L = ['📈 LAPORAN MINGGUAN ' + CFG.STORE + ' · EIGER ' + CFG.STORE_NAME, dShort(d.dari) + ' – ' + dShort(d.sampai), ''];
        rows.forEach(function (r) { L.push(r[0] + ' : ' + r[1] + (r[2] ? ' (' + r[2] + ')' : '')); });
        L.push('', '🔥 Top 5 produk:');
        d.varian.slice().sort(function (a, b) { return b[col] - a[col]; }).slice(0, 5).forEach(function (x, i) { L.push((i + 1) + '. ' + titleCase(x[1]) + ' · ' + fRpShort(x[col])); });
        L.push('', '👥 RA:');
        d.ra.slice().sort(function (a, b) { return b[rcol] - a[rcol]; }).forEach(function (r) { L.push('• ' + titleCase(r[0]) + ' ' + fRpShort(r[rcol]) + ' (' + r[4] + ' trx)'); });
        if (d.dokRA && d.dokRA.length) {
          L.push('', '🎥 Video opening/closing:');
          d.dokRA.forEach(function (r) { L.push('• ' + titleCase(r.nama) + ' · ' + dokRaTxt(r)); });
        }
        return L.join('\n');
      }
      function excel() {
        xlsxDownload('Laporan mingguan ' + CFG.STORE + ' ' + d.dari + ' sd ' + d.sampai, [
          { name: 'Ringkasan', rows: [['Indikator', 'Nilai', 'Keterangan']].concat(rows) },
          { name: 'Harian', rows: [['Tanggal', 'Hari', 'Bruto', 'Netto', 'Qty', 'Transaksi', 'Target', 'Ach %', 'Traffic', 'CR %']].concat(d.hari.map(function (h) {
            return [h.tanggal, dDayName(h.tanggal), h.bruto, h.netto, h.qty, h.trx, h.target || '', h.target ? Math.round(h[K] / h.target * 1000) / 10 : '', h.traffic || '', h.traffic ? Math.round(h.trx / h.traffic * 1000) / 10 : ''];
          })) },
          { name: 'Produk', rows: [['Varian', 'Nama', 'Qty', 'Bruto', 'Netto']].concat(d.varian) },
          { name: 'RA', rows: [['Nama', 'Bruto', 'Netto', 'Qty', 'Transaksi']].concat(d.ra) },
          { name: 'Selisih kas', rows: [['Tanggal', 'Nama', 'Pos', 'Selisih', 'Catatan']].concat(d.kas.list) },
          { name: 'Video per RA', rows: dokRaRows(d.dokRA || []) }]);
      }
      var hmax = Math.max.apply(null, d.hari.map(function (h) { return Math.max(h[K], h.target || 0); }).concat([1]));
      body.replaceChildren(
        el('div', { class: 'print-head' }, el('h2', { text: 'Laporan Mingguan · ' + CFG.STORE + ' EIGER ' + CFG.STORE_NAME }), el('p', { text: dLong(d.dari) + ' – ' + dLong(d.sampai) + ' · ' + (K === 'netto' ? 'Netto' : 'Bruto') })),
        !lengkapData ? el('div', { class: 'err-box warn-box' }, 'Data DSR baru sampai ' + dShort(d.dataSampai) + ', minggu ini belum lengkap.') : null,
        el('div', { class: 'wa-actions no-print', style: 'margin:0 0 14px' },
          dlBtn(excel), el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: function () { window.print(); } }, icon('file'), 'Cetak / PDF'),
          el('button', { class: 'btn btn-wa btn-sm', type: 'button', onclick: function () { var t = waText(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Teks laporan disalin'); }, function () { toast('Gagal menyalin', true); }); } }, icon('whatsapp'), 'Salin teks WA')),
        el('div', { class: 'insights' },
          el('div', { class: 'insight ' + (target && sales >= target ? 'good' : 'warn') }, el('span', { text: 'Sales minggu ini' }), el('b', { text: fRpShort(sales) }), el('small', { text: target ? fPct(sales / target) + ' dari target ' + fRpShort(target) : 'target belum ada' })),
          el('div', { class: 'insight' }, el('span', { text: 'Transaksi · UPT' }), el('b', { text: fNum(trx) + ' · ' + fDec(d.kpi.upt) }), el('small', { text: 'basket ' + rbTxt(basket) })),
          el('div', { class: 'insight' }, el('span', { text: 'CR' }), el('b', { text: cr != null ? fPct(cr) : '—' }), el('small', { text: trf ? 'traffic ' + fNum(trf) : 'traffic belum tercatat' }))),
        el('div', { class: 'card section' }, el('h3', { text: 'Ringkasan' }),
          el('div', { class: 'wk-sum' }, rows.map(function (r) { return el('div', { class: 'wk-row' }, el('div', null, el('span', { text: r[0] }), r[2] ? el('small', { text: r[2] }) : null), el('b', { text: r[1] })); }))),
        el('div', { class: 'card section' }, el('h3', { text: 'Per hari' }),
          el('div', { class: 'wk-bars' }, d.hari.map(function (h) {
            var ok = h.target && h[K] >= h.target;
            return el('div', { class: 'wk-day' }, el('div', { class: 'wk-col' }, el('i', { class: ok ? 'ok' : '', style: 'height:' + Math.round(h[K] / hmax * 100) + '%' }), h.target ? el('em', { style: 'bottom:' + Math.round(h.target / hmax * 100) + '%' }) : null),
              el('b', { text: dDayName(h.tanggal) }), el('small', { text: fRpShort(h[K]).replace('Rp ', '') }));
          })),
          el('div', { class: 't-wrap' }, el('table', { class: 't t-sm' },
            el('thead', null, el('tr', null, ['Tanggal', 'Sales', 'Target', 'Ach', 'Trx', 'UPT', 'CR'].map(function (h, i) { return el('th', { class: i ? 'r' : '', text: h }); }))),
            el('tbody', null, d.hari.map(function (h) {
              return el('tr', null, el('td', { text: dDayName(h.tanggal) + ', ' + dShort(h.tanggal).replace(/ \d{4}$/, '') }), el('td', { class: 'r num', text: fRpShort(h[K]) }), el('td', { class: 'r num', text: h.target ? fRpShort(h.target) : '—' }),
                el('td', { class: 'r num ' + (h.target ? (h[K] >= h.target ? 'c-good' : 'c-bad') : ''), text: h.target ? fPct(h[K] / h.target) : '—' }), el('td', { class: 'r num', text: h.trx }),
                el('td', { class: 'r num', text: fDec(h.trx ? h.qty / h.trx : null) }), el('td', { class: 'r num', text: h.traffic ? fPct(h.trx / h.traffic) : '—' }));
            }))))),
        el('div', { class: 'grid grid-2 section' },
          el('div', { class: 'card' }, el('h3', { text: 'Produk terlaris' }), el('ol', { class: 'prod-list' }, d.varian.slice().sort(function (a, b) { return b[col] - a[col]; }).slice(0, 10).map(function (x, i) {
            return el('li', null, el('span', { class: 'rank' + (i < 3 ? ' top' : ''), text: i + 1 }), el('div', { class: 'ra-main' }, el('div', { class: 'ra-top' }, el('b', { class: 'prod-name', text: titleCase(x[1]) }), el('b', { class: 'num', text: fRpShort(x[col]) })), el('div', { class: 'muted', style: 'font-size:12.5px', text: fNum(x[2]) + ' pcs' })));
          }))),
          el('div', { class: 'card' }, el('h3', { text: 'RA' }), el('ol', { class: 'prod-list' }, d.ra.slice().sort(function (a, b) { return b[rcol] - a[rcol]; }).map(function (r, i) {
            return el('li', null, el('span', { class: 'rank' + (i < 3 ? ' top' : ''), text: i + 1 }), el('div', { class: 'ra-main' }, el('div', { class: 'ra-top' }, el('b', { text: titleCase(r[0]) }), el('b', { class: 'num', text: fRpShort(r[rcol]) })), el('div', { class: 'muted', style: 'font-size:12.5px', text: r[4] + ' trx · UPT ' + fDec(r[4] ? r[3] / r[4] : null) })));
          })))),
        d.dokRA && d.dokRA.length ? dokRaCard(d.dokRA, 'Kepatuhan video per RA') : null,
        d.kas.list.length ? el('div', { class: 'card section' }, el('h3', { text: 'Selisih kas minggu ini' }), el('ul', { class: 'calc' }, d.kas.list.map(function (k) { return el('li', null, el('span', { text: dShort(k[0]) + ' · ' + k[1] + ' · ' + posOf(k[2]).label + (k[4] ? ' · ' + k[4] : '') }), el('b', { class: 'num ' + (k[3] < 0 ? 'c-bad' : 'c-good'), text: (k[3] > 0 ? '+' : '') + nf.format(k[3]) })); }))) : null);
    }
    load();
  }

  /* ---------- Target per RA ---------- */
  function raTargetAdmin() {
    var box = el('div', { class: 'card section' }, el('h3', { text: 'Target per RA' }), el('div', { class: 'skel', style: 'margin-top:10px;min-height:60px' }));
    var bulan = todayJkt().slice(0, 7);
    function load() {
      api('raTarget', { bulan: bulan }).then(function (d) {
        var vals = {};
        var names = d.ras.slice();
        Object.keys(d.targets).forEach(function (k) { if (names.indexOf(k) < 0) names.push(k); });
        names.forEach(function (n) { vals[n] = d.targets[n] || 0; });
        var inputs = el('div', { class: 'ra-tg-list' });
        function drawInputs() {
          inputs.replaceChildren(names.length ? names.map(function (n) {
            return el('div', { class: 'ra-tg' }, el('span', { class: 'ra-tg-n', text: titleCase(n) }), rpInput('tg-' + n.replace(/\W+/g, '_'), vals[n], function (x) { vals[n] = x; sumEl.textContent = 'Total ' + fRpShort(sum()) + (d.targetToko ? ' dari target toko ' + fRpShort(d.targetToko) : ''); }));
          }) : el('p', { class: 'muted', text: 'Belum ada nama RA di DSR bulan ini atau bulan lalu.' }));
        }
        function sum() { return names.reduce(function (s, n) { return s + (Number(vals[n]) || 0); }, 0); }
        var sumEl = el('p', { class: 'note' });
        drawInputs();
        sumEl.textContent = 'Total ' + fRpShort(sum()) + (d.targetToko ? ' dari target toko ' + fRpShort(d.targetToko) : '');
        var rata = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Bagi rata dari target toko', disabled: !d.targetToko || !names.length, onclick: function () {
          var each = Math.round(d.targetToko / names.length / 1000) * 1000;
          names.forEach(function (n) { vals[n] = each; }); drawInputs(); sumEl.textContent = 'Total ' + fRpShort(sum()) + ' dari target toko ' + fRpShort(d.targetToko);
        } });
        var save = el('button', { class: 'btn btn-primary', type: 'button', text: 'Simpan target', onclick: function () {
          save.disabled = true;
          api('raTargetSet', { bulan: bulan, list: names.map(function (n) { return { ra: n, target: vals[n] || 0 }; }) }).then(function () { save.disabled = false; toast('Target RA disimpan'); }).catch(function (err) { save.disabled = false; toast(err.message, true); });
        } });
        var bsel = el('input', { type: 'month', value: bulan, class: 'sel', style: 'max-width:180px', onchange: function (e) { if (e.target.value) { bulan = e.target.value; load(); } } });
        var map = el('div', { class: 'ra-map' }, (d.users || []).map(function (u) {
          var sel = el('select', { class: 'sel-sm', 'aria-label': 'Nama di DSR untuk ' + u.nama },
            el('option', { value: '', text: u.namaDsr && !u.manual ? 'Otomatis: ' + titleCase(u.namaDsr) : 'Belum cocok, pilih…' }),
            d.ras.map(function (n) { var o = el('option', { value: n, text: titleCase(n) }); if (n === u.manual) o.selected = true; return o; }));
          sel.addEventListener('change', function () { api('setNamaDsr', { username: u.username, namaDsr: sel.value }).then(function () { toast('Nama di DSR disimpan'); }).catch(function (err) { toast(err.message, true); }); });
          return el('div', { class: 'ra-tg' }, el('span', { class: 'ra-tg-n', text: u.nama }), sel);
        }));
        box.replaceChildren(el('div', { class: 'card-head' }, el('h3', { text: 'Target per RA' }), bsel),
          el('p', { class: 'sub', text: 'Target sales bulanan tiap RA (nama sesuai Sales Person di DSR). Dipakai di RA Performance dan pencapaian pribadi di Beranda.' }),
          inputs, sumEl, el('div', { class: 'inline', style: 'gap:8px;flex-wrap:wrap' }, rata, save),
          el('h3', { text: 'Akun ↔ nama di DSR', style: 'margin-top:18px' }),
          el('p', { class: 'sub', text: 'Supaya tiap orang melihat pencapaiannya sendiri di Beranda.' }), map);
      }).catch(function (err) { box.replaceChildren(el('h3', { text: 'Target per RA' }), errBox(err)); });
    }
    load();
    return box;
  }
  function sayaCard() {
    var box = el('div', { class: 'card saya-card section' }, el('div', { class: 'skel', style: 'min-height:70px' }));
    api('saya').then(function (d) {
      if (!d.nama) { box.remove(); return; }
      var K = S.mode === 'netto' ? 'n' : 'b';
      var list = d.list.slice().sort(function (a, b) { return b[K] - a[K]; });
      var me = list.filter(function (x) { return x.ra === d.nama; })[0] || { b: 0, n: 0, q: 0, trx: 0 };
      var rank = list.indexOf(me) + 1;
      var ach = d.target ? me[K] / d.target : null;
      var butuh = d.target && d.sisaHari > 0 ? Math.max(0, d.target - me[K]) / d.sisaHari : null;
      box.replaceChildren(
        el('div', { class: 'card-head' }, el('h3', { text: 'Pencapaian kamu · ' + bulanLabel(d.bulan) }), el('span', { class: 'tag', text: S.mode === 'netto' ? 'Netto' : 'Bruto' })),
        el('div', { class: 'saya-grid' },
          el('div', { class: 'saya-main' }, el('span', { text: 'Sales' }), el('b', { class: 'num', text: fRpShort(me[K]) }),
            d.target ? el('div', { class: 'saya-bar' }, el('i', { style: 'width:' + Math.min(100, (ach || 0) * 100).toFixed(1) + '%' })) : null,
            el('small', { text: d.target ? fPct(ach) + ' dari target ' + fRpShort(d.target) : 'Target belum diatur admin' })),
          el('div', { class: 'kv' }, el('span', { text: 'Peringkat' }), el('b', { text: rank ? rank + ' / ' + list.length : '—' })),
          el('div', { class: 'kv' }, el('span', { text: 'Transaksi · UPT' }), el('b', { text: fNum(me.trx) + ' · ' + fDec(me.trx ? me.q / me.trx : null) })),
          el('div', { class: 'kv' }, el('span', { text: 'Butuh per hari' }), el('b', { text: butuh != null ? fRpShort(butuh) : '—' }))),
        el('p', { class: 'note', style: 'margin:8px 0 0', text: 'Data sampai ' + dShort(d.dataSampai) + ' · sebagai ' + titleCase(d.nama) }));
    }).catch(function () { box.remove(); });
    return box;
  }

  /* ---------- Saran request barang ---------- */
  function viewSaranReq(v) {
    pageHead(v, 'Saran Request', 'Barang laris yang stoknya tipis atau sudah habis di toko, sebagai bahan request ke DC.');
    var body = el('div', null, skel(3));
    v.append(body);
    var st = S.srState || (S.srState = { f: 'semua', dry: false, kat: '' });
    loadBin().then(function (B) {
      if (!B.rows.length) { body.replaceChildren(noBinCard()); return; }
      var vars = byVarian(B), byKey = {};
      vars.forEach(function (o) { byKey[o.varian] = o; });
      var list = [];
      Object.keys(B.var30).forEach(function (k) {
        if (/^(98|81)/.test(k)) return;
        var q30 = B.var30[k];
        if (q30 < 2) return;
        var o = byKey[k], stok = o ? o.total : 0;
        var perHari = q30 / 30, cover = perHari ? stok / perHari : null;
        if (stok > 2 && cover > 14) return;
        var g = k.split('.')[0], a = (o && o.a) || B.attr(k, g) || {};
        var dc = String(a.dc_status || '');
        list.push({ varian: k, generic: g, nama: (o && o.nama) || a.nama || g, warna: (o && o.warna) || k.split('.')[1] || '', q30: q30, stok: stok, sell: o ? o.sell : 0, wh: o ? o.wh : 0,
          cover: cover, dc: dc, dry: /DRY/i.test(dc), lv3: (o && o.lv3) || a.lv3 || '', lv4: (o && o.lv4) || a.lv4 || '', perf: B._gperf ? B._gperf[g] : null, a: a, sizes: o ? o.sizes : {} });
      });
      list.sort(function (x, y) { return (x.stok === 0) - (y.stok === 0) || y.q30 - x.q30; }).reverse();
      list.sort(function (x, y) { if ((x.stok === 0) !== (y.stok === 0)) return x.stok === 0 ? -1 : 1; return y.q30 - x.q30; });
      var habis = list.filter(function (x) { return !x.stok; }), tipis = list.filter(function (x) { return x.stok; });
      var box = el('div'), chips = el('div', { class: 'chips' }), tools = el('div', { class: 'toolbar2' });
      var F = { semua: ['Semua', list], habis: ['Habis di toko', habis], tipis: ['Stok tipis', tipis] };
      function rows() { return F[st.f][1].filter(function (x) { return (st.dry || !x.dry) && (!st.kat || x.lv3 === st.kat); }); }
      function draw() {
        chips.replaceChildren(Object.keys(F).map(function (k) {
          return el('button', { type: 'button', class: 'chip-btn' + (st.f === k ? ' on' : ''), onclick: function () { st.f = k; draw(); } }, F[k][0], el('span', { text: fNum(F[k][1].filter(function (x) { return st.dry || !x.dry; }).length) }));
        }));
        tools.replaceChildren(selectEl('Kategori', optsOf(list, function (x) { return x.lv3; }), st.kat, function (x) { st.kat = x; draw(); }),
          el('label', { class: 'check', style: 'margin:0' }, el('input', { type: 'checkbox', checked: st.dry, onchange: function (e) { st.dry = e.target.checked; draw(); } }), 'Tampilkan juga status DRY'),
          dlBtn(function () {
            xlsxDownload('Saran request ' + CFG.STORE + ' ' + stamp(), [{ name: 'Saran request', rows: [['Generic', 'Varian', 'Nama', 'Warna', 'Terjual 30 hari', 'Stok', 'Display', 'Gudang', 'Cukup (hari)', 'Status DC', 'Performa', 'Kategori', 'Sub kategori', 'Ukuran tersedia']].concat(rows().map(function (x) {
              return [x.generic, x.varian, x.nama, x.warna, x.q30, x.stok, x.sell, x.wh, x.cover == null ? '' : Math.round(x.cover), x.dc, x.perf ? x.perf.kat : '', x.lv3, x.lv4, Object.keys(x.sizes).sort(sizeCmp).map(function (s) { return s + ':' + x.sizes[s]; }).join(' ')];
            })) }]);
          }));
        var r = rows();
        box.replaceChildren(r.length ? el('div', { class: 'art-list' }, r.slice(0, 150).map(function (x) {
          return el('div', { class: 'art flat' }, el('div', { class: 'art-main' },
            el('div', { class: 'art-top' }, el('b', { text: titleCase(x.nama) }), el('span', { class: 'warna', text: x.warna }), x.perf ? perfTag(x.perf) : null, x.dry ? el('span', { class: 'tag tag-bad', text: 'DRY · tidak dikirim lagi' }) : null),
            el('div', { class: 'muted art-meta', text: [x.generic, titleCase(x.lv4 || ''), x.dc ? 'DC: ' + x.dc : ''].filter(Boolean).join(' · ') }),
            Object.keys(x.sizes).length ? el('div', { class: 'muted art-meta', text: 'Ukuran ada: ' + Object.keys(x.sizes).sort(sizeCmp).map(function (s) { return s + ' ' + x.sizes[s]; }).join(' · ') }) : null),
            el('div', { class: 'art-num' }, el('b', { class: 'num ' + (x.stok ? 'c-warn' : 'c-bad'), text: x.stok ? fNum(x.stok) + ' pcs' : 'Habis' }),
              el('span', { text: 'terjual ' + x.q30 + ' / 30 hari' + (x.cover != null && x.stok ? ' · ±' + Math.round(x.cover) + ' hari' : '') })));
        })) : el('div', { class: 'empty', text: 'Tidak ada saran request. Stok aman 👍' }));
      }
      body.replaceChildren(binInfoLine(B),
        el('div', { class: 'insights' },
          el('div', { class: 'insight warn' }, el('span', { text: 'Laris tapi habis di toko' }), el('b', { text: fNum(habis.filter(function (x) { return !x.dry; }).length) + ' varian' }), el('small', { text: 'terjual ≥ 2 pcs dalam 30 hari, stok 0' })),
          el('div', { class: 'insight' }, el('span', { text: 'Stok tipis' }), el('b', { text: fNum(tipis.filter(function (x) { return !x.dry; }).length) + ' varian' }), el('small', { text: 'stok ≤ 2 atau cukup ≤ 14 hari' })),
          el('div', { class: 'insight' }, el('span', { text: 'Status DRY (disembunyikan)' }), el('b', { text: fNum(list.filter(function (x) { return x.dry; }).length) }), el('small', { text: 'tidak dikirim lagi dari DC' }))),
        el('div', { class: 'card section' }, chips, tools, box),
        el('p', { class: 'note', text: 'Laris = terjual minimal 2 pcs dalam 30 hari terakhir (DSR). Cukup (hari) = stok ÷ rata-rata terjual per hari. Status DC dari master artikel.' }));
      draw();
    }).catch(function (e) { body.replaceChildren(errBox(e)); });
  }

  /* ---------- Unggah By Bin + status master artikel ---------- */
  var BIN_HEAD = { nama: 'SKU Name', sku: 'SKU Code', generic: 'Generic Code', bin: 'Bin Code', zona: 'Zone Code', lv2: 'MC LV 2', lv3: 'MC LV 3', lv4: 'MC LV 4',
    brand: 'Brand', kategori: 'Bin Category', total: 'Total Qty', available: 'Available Qty', allocated: 'Allocated Qty', proses: 'In Process Qty', lokasi: 'Location' };
  var BIN_FIELDS = ['sku', 'nama', 'generic', 'bin', 'zona', 'lv2', 'lv3', 'lv4', 'brand', 'kategori', 'total', 'available', 'allocated', 'proses'];
  function parseBin(aoa) {
    var hi = -1, norm = function (s) { return String(s == null ? '' : s).trim().toLowerCase(); };
    for (var i = 0; i < Math.min(aoa.length, 30); i++) { var r = (aoa[i] || []).map(norm); if (r.indexOf('sku code') >= 0 && r.indexOf('bin code') >= 0) { hi = i; break; } }
    if (hi < 0) throw new Error('Kolom "SKU Code" dan "Bin Code" tidak ditemukan. Pastikan file export stock by bin.');
    var head = aoa[hi].map(norm), idx = {};
    Object.keys(BIN_HEAD).forEach(function (k) { idx[k] = head.indexOf(norm(BIN_HEAD[k])); });
    ['sku', 'nama', 'bin', 'zona', 'total'].forEach(function (k) { if (idx[k] < 0) throw new Error('Kolom "' + BIN_HEAD[k] + '" tidak ada di file'); });
    var rows = [], lokasi = '';
    for (var j = hi + 1; j < aoa.length; j++) {
      var r2 = aoa[j] || [];
      var sku = String(r2[idx.sku] == null ? '' : r2[idx.sku]).trim();
      if (!sku) continue;
      if (!lokasi && idx.lokasi >= 0 && r2[idx.lokasi]) lokasi = String(r2[idx.lokasi]).replace(/\s+/g, ' ').trim();
      rows.push(BIN_FIELDS.map(function (k) {
        var v = idx[k] >= 0 ? r2[idx[k]] : '';
        if (['total', 'available', 'allocated', 'proses'].indexOf(k) >= 0) return Number(String(v == null ? 0 : v).replace(/,/g, '')) || 0;
        return v == null ? '' : String(v).trim();
      }));
    }
    return { rows: rows, lokasi: lokasi };
  }
  function viewUnggahBin(v) {
    v.append(el('section', { class: 'hero hero-sm' },
      el('div', null, el('h2', { text: 'Unggah By Bin' }), el('p', { text: 'Perbarui stok per lokasi bin dari file export stock by bin. Siapa saja boleh, kapan saja.' }))));
    var input = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', id: 'bin-file' });
    var drop = el('label', { class: 'drop', for: 'bin-file' }, el('span', { class: 'drop-ic' }, icon('upload')),
      el('span', { class: 'drop-txt' }, el('b', { text: 'Pilih file by bin' }), el('span', { text: 'export_by_bin_….xlsx · ketuk untuk memilih' })), input);
    var area = el('div'), hist = el('div', { class: 'card section' }, el('h3', { text: 'Riwayat unggahan' }), el('div', { class: 'skel', style: 'margin-top:12px;min-height:60px' }));
    var mcard = el('div', { class: 'card section' }, el('h3', { text: 'Master artikel' }), el('div', { class: 'skel', style: 'margin-top:12px;min-height:60px' }));
    v.append(el('div', { class: 'grid grid-up' },
      el('div', { class: 'card' }, drop, area),
      el('div', { class: 'card card-soft' }, el('h3', { text: 'Cara unggah' }),
        el('ol', { class: 'steps' },
          el('li', null, el('b', { text: 'Export' }), ' stock by bin dari sistem.'),
          el('li', null, el('b', { text: 'Pilih file' }), ' di sini, cek ringkasannya.'),
          el('li', null, el('b', { text: 'Unggah.' }), ' Data stok lama diganti dengan yang terbaru.')),
        el('p', { class: 'note', text: 'Tanggal pertama barang muncul di stok dicatat untuk menghitung umur produk (PLC) di toko.' }))),
      mcard, hist);
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
    input.addEventListener('change', function () { if (input.files[0]) handle(input.files[0]); input.value = ''; });
    function stat(label, val) { return el('div', { class: 'stat' }, el('span', { text: label }), el('b', { text: val })); }
    function handle(file) {
      area.replaceChildren(el('div', { class: 'file-row' }, el('span', { class: 'file-ic' }, icon('file')), el('div', null, el('b', { text: file.name }), el('span', { text: 'Membaca file…' }))));
      if (!window.XLSX) { area.replaceChildren(errBox(new Error('Pembaca Excel belum termuat. Periksa koneksi lalu muat ulang halaman.'))); return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(reader.result), { type: 'array' });
          var aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: null });
          var p = parseBin(aoa);
          if (!p.rows.length) throw new Error('Tidak ada baris stok di file ini.');
          preview(file, p);
        } catch (err) { area.replaceChildren(errBox(err)); }
      };
      reader.readAsArrayBuffer(file);
    }
    function preview(file, p) {
      var zones = {}, skus = {}, pcs = 0, bins = {};
      p.rows.forEach(function (r) { zones[r[4]] = (zones[r[4]] || 0) + r[10]; skus[r[0]] = 1; pcs += r[10]; bins[r[3]] = 1; });
      var okStore = !p.lokasi || p.lokasi.indexOf(CFG.STORE) >= 0;
      var btn = el('button', { class: 'btn btn-orange btn-block', disabled: !okStore }, icon('upload'), 'Unggah sekarang');
      var out = el('div');
      area.replaceChildren(
        el('div', { class: 'file-row' }, el('span', { class: 'file-ic ok' }, icon('file')), el('div', null, el('b', { text: file.name }), el('span', { text: p.lokasi || 'Lokasi tidak tertulis' }))),
        !okStore ? errBox(new Error('File ini bukan stok toko ' + CFG.STORE + '.')) : null,
        el('div', { class: 'stats' }, stat('Baris', fNum(p.rows.length)), stat('SKU', fNum(Object.keys(skus).length)), stat('Total', fNum(pcs) + ' pcs'), stat('Bin', fNum(Object.keys(bins).length))),
        el('div', { class: 'tags', style: 'margin:8px 0 12px' }, Object.keys(zones).map(function (z) { return el('span', { class: 'tag', text: z + ' ' + fNum(zones[z]) }); })),
        btn, out);
      btn.addEventListener('click', function () {
        btn.disabled = true; btn.lastChild.textContent = 'Mengunggah…';
        api('binUpload', { rows: p.rows, lokasi: p.lokasi, fileName: file.name }).then(function (res) {
          S.bin = null; S.master = null;
          area.replaceChildren(el('div', { class: 'done' }, el('span', { class: 'done-ic' }, icon('check')),
            el('h3', { text: 'Stok by bin diperbarui' }),
            el('div', { class: 'stats stats-3' }, stat('SKU', fNum(res.sku)), stat('Total', fNum(res.pcs) + ' pcs'), stat('Varian baru tercatat', res.awal ? 'patokan awal' : fNum(res.varianBaru))),
            el('div', { class: 'grid grid-2', style: 'gap:8px' },
              el('a', { class: 'btn btn-primary btn-block', href: '#/display', text: 'Cek Display' }),
              el('a', { class: 'btn btn-ghost btn-block', href: '#/stokart', text: 'Stok Artikel' }))));
          loadHist();
        }).catch(function (err) { btn.disabled = false; btn.lastChild.textContent = 'Coba unggah lagi'; out.replaceChildren(errBox(err)); });
      });
    }
    function loadHist() {
      api('binUploads').then(function (list) {
        hist.replaceChildren(el('h3', { text: 'Riwayat unggahan' }), list.length ? el('ul', { class: 'hist' }, list.map(function (u) {
          return el('li', null, el('span', { class: 'avatar', text: initials(u.nama) }),
            el('div', { class: 'hist-main' }, el('div', { class: 'hist-top' }, el('b', { text: u.nama }), el('span', { class: 'muted', text: fTime(u.waktu) })),
              el('div', { class: 'tags' }, el('span', { class: 'tag', text: fNum(u.sku) + ' SKU' }), el('span', { class: 'tag', text: fNum(u.pcs) + ' pcs' }))));
        })) : el('div', { class: 'empty', text: 'Belum ada unggahan' }));
      }).catch(function (err) { hist.replaceChildren(el('h3', { text: 'Riwayat unggahan' }), errBox(err)); });
    }
    function loadMasterCard(cek) {
      api('masterStatus', { cekSekarang: !!cek }).then(function (m) {
        var L = m.loaded, P = m.pending;
        mcard.replaceChildren(el('div', { class: 'card-head' }, el('h3', { text: 'Master artikel' }),
          el('button', { class: 'btn btn-ghost btn-sm', onclick: function (e) { e.target.disabled = true; loadMasterCard(true); } }, icon('refresh'), 'Cek file baru')),
          el('p', { class: 'note', style: 'margin-top:0', text: 'Diambil otomatis dari folder Drive MASTER ARTIKEL (dicek tiap hari). Dipakai untuk label NEW, season dan collection.' }),
          L ? el('div', { class: 'kv-row' }, el('span', { text: 'Terpasang' }), el('b', { text: L.folder + ' · ' + L.nama + ' · ' + fNum(L.varian) + ' varian · ' + fTime(L.waktu) })) : el('div', { class: 'kv-row' }, el('span', { text: 'Terpasang' }), el('b', { text: 'belum ada' })),
          P ? el('div', { class: 'kv-row' }, el('span', { text: 'File baru' }), el('b', { class: 'c-warn', text: P.folder + ' · ' + P.nama + ' (' + (P.size / 1048576).toFixed(1) + ' MB)' + (P.ready ? ' · siap dimuat' : ' · sedang disiapkan, ±2 menit') })) : null,
          m.proses ? el('p', { class: 'muted', text: 'Sedang dimuat oleh ' + m.proses.nama + '…' }) : null,
          m.error ? el('p', { class: 'c-bad', style: 'font-size:13px', text: 'Gagal terakhir ' + fTime(m.error.waktu) + ': ' + m.error.pesan }) : null,
          P && P.ready && m.admin ? el('button', { class: 'btn btn-primary', onclick: function () { masterSync(true); } }, icon('download'), 'Muat master sekarang') : null,
          P && !m.admin ? el('p', { class: 'muted', text: 'Akan dimuat otomatis saat admin membuka web di komputer.' }) : null);
      }).catch(function (err) { mcard.replaceChildren(el('h3', { text: 'Master artikel' }), errBox(err)); });
    }
    S.onMasterDone = function () { if (current() === 'unggahbin') loadMasterCard(); };
    loadHist(); loadMasterCard();
  }

  /* ---------- Sinkron master artikel di latar (admin, komputer) ---------- */
  var masterBusy = false;
  function masterProgress(txt, pct) {
    var p = $('#master-prog');
    if (txt == null) { if (p) p.remove(); return; }
    if (!p) { p = el('div', { id: 'master-prog', class: 'master-prog' }, el('span', { class: 'mp-spin' }), el('span', { class: 'mp-t' }), el('i')); document.body.appendChild(p); }
    p.querySelector('.mp-t').textContent = txt;
    p.querySelector('i').style.width = Math.round((pct || 0) * 100) + '%';
  }
  function masterSync(manual) {
    if (masterBusy || !isAdmin()) return;
    if (!window.MasterXlsx || !MasterXlsx.supported()) { if (manual) toast('Browser ini belum mendukung pembacaan file besar. Pakai Chrome terbaru di komputer.', true); return; }
    masterBusy = true;
    var file, claim;
    masterProgress('Master artikel: menyiapkan…', 0.02);
    api('masterClaim').then(function (c) {
      claim = c; file = c.file;
      var parts = [], i = 0;
      function next() {
        if (i >= c.chunks) return Promise.resolve();
        masterProgress('Master artikel: mengambil file ' + (i + 1) + '/' + c.chunks + '…', 0.05 + 0.45 * i / c.chunks);
        var tries = 0;
        function get() {
          return api('masterChunk', { id: file.id, i: i }).then(function (r) {
            if (!r || typeof r.data !== 'string') throw new Error('Respons potongan file kosong');
            return r;
          }).catch(function (err) { if (++tries < 3) return new Promise(function (ok) { setTimeout(ok, 1500 * tries); }).then(get); throw err; });
        }
        return get().then(function (r) { parts.push(MasterXlsx.b64ToBytes(r.data)); i++; return next(); });
      }
      return next().then(function () {
        var n = parts.reduce(function (s, p) { return s + p.length; }, 0), u8 = new Uint8Array(n), o = 0;
        parts.forEach(function (p) { u8.set(p, o); o += p.length; });
        var gens = {}; c.generics.forEach(function (g) { gens[g] = 1; });
        var limit = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
        return MasterXlsx.processMaster(u8, {
          keep: function (g, terbaru) { return gens[g] || (terbaru && terbaru >= limit); },
          onProgress: function (p) { masterProgress('Master artikel: membaca ' + Math.round(p * 100) + '%…', 0.5 + 0.35 * p); }
        });
      });
    }).then(function (res) {
      var rows = res.rows, size = 2500, parts = Math.max(1, Math.ceil(rows.length / size)), k = 0;
      function send() {
        if (k >= parts) return Promise.resolve();
        masterProgress('Master artikel: menyimpan ' + (k + 1) + '/' + parts + '…', 0.85 + 0.15 * k / parts);
        return api('masterSave', { id: file.id, part: k, rows: rows.slice(k * size, (k + 1) * size), selesai: k === parts - 1, artikel: res.artikel }).then(function () { k++; return send(); });
      }
      return send().then(function () {
        masterProgress(null); masterBusy = false;
        S.master = null; S.bin = null; S.lap = {};
        toast('Master artikel diperbarui · ' + fNum(rows.length) + ' varian');
        loadNotif(true);
        if (S.onMasterDone) S.onMasterDone();
        if (/^(stokart|display|cari|produk)$/.test(current())) render();
      });
    }).catch(function (err) {
      masterProgress(null); masterBusy = false;
      if (claim) api('masterFail', { pesan: err.message || String(err) }).catch(function () {});
      if (manual || claim) toast('Master artikel gagal dimuat: ' + (err.message || err), true);
    });
  }
  function masterAuto() {
    if (S.masterAutoDone || !isAdmin() || window.innerWidth < 960) return;
    S.masterAutoDone = true;
    setTimeout(function () {
      api('masterStatus').then(function (m) { if (m.pending && m.pending.ready && !m.proses) masterSync(false); }).catch(function () {});
    }, 4000);
  }

  /* ---------- New Arrival di Produk & Promo ---------- */
  function naSalesCard(d, K) {
    var box = el('div', { class: 'card section' }, el('h3', { text: 'New Arrival & segmen' }), el('div', { class: 'skel', style: 'margin-top:10px;min-height:80px' }));
    loadMaster().then(function (M) {
      if (!M.info) { box.replaceChildren(el('h3', { text: 'New Arrival & segmen' }), el('p', { class: 'muted', text: 'Master artikel belum dimuat. Label New Arrival dan pecahan gender, activity, season akan tampil setelah master dimuat.' })); return; }
      var col = K === 2 ? 2 : 3;
      var list = (d.varian || []).map(function (x) {
        var a = M.of(x[0]) || {};
        var umur = a.dibuat ? daysAgo(a.dibuat, M.today) : null;
        return { varian: x[0], q: x[1], s: x[col], a: a, isNew: umur != null && umur >= 0 && umur <= M.naHari };
      });
      var total = list.reduce(function (s, x) { return s + x.s; }, 0);
      var na = list.filter(function (x) { return x.isNew; });
      var naS = na.reduce(function (s, x) { return s + x.s; }, 0);
      var prodName = {}; d.produk.forEach(function (p) { prodName[String(p[0]).slice(0, 9)] = p[1]; });
      var seg = S.naSeg || 'gender';
      var segBox = el('div');
      function drawSeg() {
        var G = {};
        list.forEach(function (x) { var k = (x.a && x.a[seg]) || '(tidak ada)'; G[k] = (G[k] || 0) + x.s; });
        var ks = Object.keys(G).sort(function (a, b) { return G[b] - G[a]; }).slice(0, 8);
        segBox.replaceChildren(el('div', { class: 'hb' }, ks.map(function (k) {
          return el('div', { class: 'hb-row' }, el('span', { class: 'hb-lbl', text: k }), bar(G[k], G[ks[0]], 'hot'), el('b', { class: 'num', text: fPct(total ? G[k] / total : 0) }));
        })));
      }
      var topNa = na.slice().sort(function (a, b) { return b.s - a.s; }).slice(0, 10);
      box.replaceChildren(
        el('div', { class: 'card-head' }, el('h3', { text: 'New Arrival & segmen' }), dlBtn(function () {
          xlsxDownload('Sales per varian ' + bulanLabel(d.bulan), [{ name: 'Per varian', rows: [['Varian', 'Nama', 'NEW', 'Season', 'Collection', 'Gender', 'Activity', 'Dibuat', 'Qty', 'Sales']].concat(list.sort(function (a, b) { return b.s - a.s; }).map(function (x) {
            return [x.varian, x.a.nama || prodName[x.varian.split('.')[0]] || '', x.isNew ? 'NEW' : '', x.a.season || '', x.a.collection || '', x.a.gender || '', x.a.activity || '', x.a.dibuat || '', x.q, x.s];
          })) }]);
        })),
        el('div', { class: 'insights' },
          el('div', { class: 'insight good' }, el('span', { text: 'Kontribusi New Arrival' }), el('b', { text: fPct(total ? naS / total : 0) }), el('small', { text: fRpShort(naS) + ' · ' + fNum(na.length) + ' varian NEW terjual' })),
          el('div', { class: 'insight' }, el('span', { text: 'Artikel lama' }), el('b', { text: fPct(total ? 1 - naS / total : 0) }), el('small', { text: 'dibuat lebih dari ' + M.naHari + ' hari lalu' }))),
        el('div', { class: 'grid grid-2', style: 'margin-top:12px' },
          el('div', null, el('h4', { class: 'mini-h', text: 'New Arrival terlaris' }),
            topNa.length ? el('ol', { class: 'prod-list' }, topNa.map(function (x, i) {
              return el('li', null, el('span', { class: 'rank' + (i < 3 ? ' top' : ''), text: i + 1 }),
                el('div', { class: 'ra-main' }, el('div', { class: 'ra-top' }, el('b', { class: 'prod-name', text: titleCase(x.a.nama || prodName[x.varian.split('.')[0]] || x.varian) + ' · ' + (x.varian.split('.')[1] || '') }), el('b', { class: 'num', text: fRpShort(x.s) })),
                  el('div', { class: 'muted', style: 'font-size:12.5px', text: fNum(x.q) + ' pcs · ' + [x.a.season, x.a.collection].filter(Boolean).join(' · ') })));
            })) : el('p', { class: 'muted', text: 'Belum ada New Arrival terjual bulan ini.' })),
          el('div', null, el('h4', { class: 'mini-h', text: 'Sales per segmen' }),
            segmented([['gender', 'Gender'], ['activity', 'Activity'], ['season', 'Season'], ['collection', 'Collection']], seg, function (x) { seg = S.naSeg = x; drawSeg(); }),
            el('div', { style: 'margin-top:12px' }, segBox))));
      drawSeg();
    }).catch(function (e) { box.replaceChildren(el('h3', { text: 'New Arrival & segmen' }), errBox(e)); });
    return box;
  }

  /* ---------- Briefing pagi ---------- */
  var BRIEF_SECS = [['sales', 'Sales kemarin'], ['bulan', 'Posisi bulan ini'], ['tugas', 'Bertugas hari ini'], ['na', 'New Arrival belum dipajang'],
    ['display', 'Display'], ['top', 'Produk terlaris kemarin'], ['fokus', 'Fokus hari ini']];
  function rpTxt(v) { return 'Rp ' + nf.format(Math.round(v || 0)); }
  function rbTxt(v) { return v == null ? '—' : 'Rp ' + nf.format(Math.round(v / 1000)) + 'rb'; }
  function monTxt(ym) { var p = String(ym).split('-'); return BUL3[Number(p[1]) - 1] + ' ' + p[0]; }
  function shortFirst(n) { return titleCase(String(n).split(/\s+/)[0] || n); }

  /** Fokus otomatis berdasarkan analisa PICA. */
  function briefFokus(ctx) {
    var out = [], k = ctx.kpi, cur = k.bulanIni, lal = k.bulanLalu, rk = k.rekor, T = ctx.target;
    var bKey = S.mode === 'netto' ? 'basketN' : 'basketB';
    function gap(v, ref) { return ref && v != null ? (ref - v) / ref : 0; }
    if (cur.upt != null) {
      var refs = [], g = 0;
      if (lal.upt != null && cur.upt < lal.upt) { refs.push('bulan lalu ' + fDec(lal.upt)); g = Math.max(g, gap(cur.upt, lal.upt)); }
      if (rk.upt && cur.upt < rk.upt.nilai) { refs.push('rekor ' + fDec(rk.upt.nilai) + ' ' + monTxt(rk.upt.bulan)); g = Math.max(g, gap(cur.upt, rk.upt.nilai)); }
      if (T.upt && cur.upt < T.upt) { refs.push('target ' + fDec(T.upt)); g = Math.max(g, gap(cur.upt, T.upt)); }
      if (refs.length) out.push({ g: g + 0.001, t: 'UPT ' + fDec(cur.upt) + ' → CROSS-SELLING\n   (' + refs.join(' · ') + ')\n   Tawarkan item pelengkap (kaos kaki, topi, pouch, botol) di setiap transaksi, min. 2 item/struk.' });
    }
    if (cur[bKey] != null) {
      var refs2 = [], g2 = 0;
      if (lal[bKey] != null && cur[bKey] < lal[bKey]) { refs2.push('bulan lalu ' + rbTxt(lal[bKey])); g2 = Math.max(g2, gap(cur[bKey], lal[bKey])); }
      if (rk[bKey] && cur[bKey] < rk[bKey].nilai) { refs2.push('rekor ' + rbTxt(rk[bKey].nilai) + ' ' + monTxt(rk[bKey].bulan)); g2 = Math.max(g2, gap(cur[bKey], rk[bKey].nilai)); }
      if (T.basket && cur[bKey] < T.basket) { refs2.push('target ' + rbTxt(T.basket)); g2 = Math.max(g2, gap(cur[bKey], T.basket)); }
      if (refs2.length) out.push({ g: g2, t: 'Basket ' + rbTxt(cur[bKey]) + ' → UP-SELLING\n   (' + refs2.join(' · ') + ')\n   Arahkan ke varian lebih tinggi & New Arrival, jelaskan keunggulan bahan dan fitur, tawarkan paket promo.' });
    }
    if (ctx.sm && ctx.sm.kum.ach != null && ctx.sm.kum.ach < 1 && ctx.butuh > 0) {
      out.push({ g: 1 - ctx.sm.kum.ach, t: 'Kejar target: ach kumulatif ' + fPct(ctx.sm.kum.ach) + ', butuh ' + fRpShort(ctx.butuh) + '/hari.' + (ctx.targetHari ? ' Target hari ini ' + fRpShort(ctx.targetHari) + ', bagi per shift.' : '') });
    }
    if (ctx.cr && ctx.crLalu && ctx.cr < ctx.crLalu) {
      out.push({ g: gap(ctx.cr, ctx.crLalu), t: 'CR ' + fPct(ctx.cr) + ' (bulan lalu ' + fPct(ctx.crLalu) + ') → sapa setiap pengunjung dalam 30 detik, tanyakan kebutuhan, ajak mencoba produk.' });
    }
    out.sort(function (a, b) { return b.g - a.g; });
    var list = out.slice(0, 3).map(function (x) { return x.t; });
    if (list.length < 3 && ctx.naBelum) list.push('Pajang ' + ctx.naBelum + ' varian NEW yang masih di gudang' + (ctx.dbl ? ', rapikan ' + ctx.dbl + ' display double.' : '.'));
    if (!list.length) list.push('Semua indikator aman, pertahankan! Fokus pelayanan dan tawarkan New Arrival ke setiap pengunjung.');
    return list.map(function (t, i) { return (i + 1) + '. ' + t; }).join('\n');
  }

  function viewBriefing(v) {
    pageHead(v, 'Briefing Pagi', 'Teks briefing otomatis untuk dikirim ke grup WhatsApp tim.');
    var body = el('div', null, skel(3));
    v.append(body);
    var hide = {}; try { hide = JSON.parse(store.get('briefHide') || '{}'); } catch (e) { hide = {}; }
    var today = todayJkt();
    api('briefing').then(function (B) {
      var kem = B.kemarin;
      var monP = loadMon(kem).catch(function () { return null; });
      var monT = today.slice(0, 7) === kem.slice(0, 7) ? monP : api('monitoring', { tanggal: today }).catch(function () { return null; });
      return Promise.all([monP, monT, loadJadwal().catch(function () { return null; }), loadBin().catch(function () { return null; })]).then(function (x) { draw(B, x[0], x[1], x[2], x[3]); });
    }).catch(function (e) { body.replaceChildren(errBox(e)); });

    function draw(B, mon, monToday, jad, bin) {
      var kem = B.kemarin, H = B.hari, K = S.mode === 'netto' ? 'netto' : 'bruto';
      var adaData = B.dataSampai >= kem && H.trx > 0;
      var sm = mon ? DSR.summarize(Object.assign({}, mon, { tanggal: kem }), S.mode) : null;
      var targetHari = null, butuh = null, sisaHari = null;
      if (monToday && monToday.target && monToday.bobot && monToday.bobot[today]) targetHari = Math.round(monToday.target * monToday.bobot[today].harian);
      if (sm && sm.monthly.target) {
        var p = dParts(kem), dim = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
        sisaHari = dim - p.d;
        butuh = sisaHari > 0 ? Math.max(0, (sm.monthly.target - sm.monthly.sales) / sisaHari) : 0;
      }
      var trafficMap = (mon && mon.traffic) || {};
      var cr = H.traffic ? H.trx / H.traffic : null;
      // CR bulan berjalan vs bulan lalu (bila traffic tercatat)
      var crM = null, crL = null; // CR bulan lalu belum tersedia (traffic baru dicatat)
      if (mon) {
        var tt = 0, tx = 0;
        mon.harian.forEach(function (h) { if (h.tanggal <= kem && trafficMap[h.tanggal]) { tt += trafficMap[h.tanggal]; tx += h.trx; } });
        crM = tt ? tx / tt : null;
      }
      var R = bin && bin.rows.length ? displayCalc(bin) : null;
      var naBelum = R ? R.vBelum.filter(function (o) { return o.isNew; }).sort(function (a, b) { return b.whAv - a.whAv; }) : [];
      var ctx = { kpi: B.kpi, target: B.target, sm: sm, butuh: butuh, targetHari: targetHari, cr: crM, crLalu: crL, naBelum: naBelum.length, dbl: R ? R.double.length : 0 };
      var fokusAuto = briefFokus(ctx);
      var fokusEl = el('textarea', { class: 'brief-fokus', rows: 10 });
      fokusEl.value = S.briefFokus && S.briefFokus.day === today ? S.briefFokus.text : fokusAuto;

      function build() {
        var L = [];
        L.push('☀️ BRIEFING PAGI · ' + dLong(today));
        L.push(CFG.STORE + ' · EIGER Store ' + CFG.STORE_NAME);
        if (!hide.sales) {
          L.push('', '📊 SALES KEMARIN (' + dLong(kem).split(',')[0] + ', ' + dShort(kem).replace(/ \d{4}$/, '') + ')');
          if (!adaData) L.push('⚠️ DSR kemarin belum diunggah');
          else {
            L.push('Sales   : ' + rpTxt(H[K]) + (sm && sm.daily.ach != null ? ' (ach ' + fPct(sm.daily.ach) + ' dari target harian)' : ''));
            L.push('Trx     : ' + H.trx + ' · UPT ' + fDec(H.trx ? H.qty / H.trx : null) + ' · Basket ' + rpTxt(H.trx ? H[K] / H.trx : 0));
            if (cr != null) L.push('CR      : ' + fPct(cr) + ' (traffic ' + H.traffic + ')');
            var top = H.ra.slice().sort(function (a, b) { return b[K === 'netto' ? 2 : 1] - a[K === 'netto' ? 2 : 1]; }).slice(0, 2);
            if (top.length) L.push('Top RA  : ' + top.map(function (r) { return shortFirst(r[0]) + ' ' + fRpShort(r[K === 'netto' ? 2 : 1]); }).join(' · '));
          }
        }
        if (!hide.bulan && sm) {
          var p = dParts(kem);
          L.push('', '🎯 POSISI BULAN INI');
          L.push('Kumulatif 1–' + p.d + ' ' + BUL3[p.m - 1] + ' : ' + fRpShort(sm.kum.sales) + (sm.kum.target ? ' / target ' + fRpShort(sm.kum.target) + ' (' + fPct(sm.kum.ach) + ')' : ''));
          if (sm.monthly.target) L.push('Target bulan       : ' + fRpShort(sm.monthly.target) + ' (' + fPct(sm.monthly.ach) + ')');
          if (butuh != null && sisaHari > 0) L.push('Butuh per hari     : ' + fRpShort(butuh) + ' (' + sisaHari + ' hari lagi)');
          if (targetHari) L.push('Target hari ini    : ' + fRpShort(targetHari));
          var c = B.kpi.bulanIni;
          L.push('UPT ' + fDec(c.upt) + ' · Basket ' + rbTxt(c[S.mode === 'netto' ? 'basketN' : 'basketB']) + ' (tanpa pembelian partai)');
        }
        if (!hide.tugas && jad) {
          var i = (jad.tanggal || []).indexOf(today);
          if (i >= 0) {
            var g = groupShift(jad, i);
            L.push('', '👥 BERTUGAS HARI INI');
            g.codes.forEach(function (cd) { L.push((SHIFT_SHORT[cd] || SHIFT_NAME[cd] || cd).padEnd(6) + ': ' + g.by[cd].map(shortName).join(', ')); });
          }
        }
        if (!hide.na && R) {
          L.push('', '🆕 NEW ARRIVAL BELUM DIPAJANG (' + naBelum.length + ' varian)');
          if (!naBelum.length) L.push('Semua NEW sudah terpajang 👍');
          naBelum.slice(0, 5).forEach(function (o) {
            var b = Object.keys(o.bins).filter(function (k) { return !SELL_RE.test(k); });
            L.push('• ' + titleCase(o.nama) + ' ' + o.warna + (b.length ? ' · ' + b.slice(0, 2).join(', ') : ''));
          });
          if (naBelum.length > 5) L.push('• … (' + (naBelum.length - 5) + ' lainnya, lihat web)');
        }
        if (!hide.display && R) {
          L.push('', '🧺 DISPLAY');
          L.push('Terdisplay : generic ' + fPct(R.pctG) + ' · varian ' + fPct(R.pctV) + ' (target 95%)');
          if (R.double.length) L.push('Display double : ' + R.double.length + ' varian, bisa dirapikan');
        }
        if (!hide.top && adaData && H.varian && H.varian.length) {
          var col = K === 'netto' ? 4 : 3;
          var tops = H.varian.slice().sort(function (a, b) { return b[col] - a[col]; }).slice(0, 3);
          L.push('', '🔥 PRODUK TERLARIS KEMARIN');
          L.push(tops.map(function (x, i) { return (i + 1) + '. ' + titleCase(x[1]); }).join(' · '));
        }
        if (!hide.fokus && fokusEl.value.trim()) L.push('', '📌 FOKUS HARI INI', fokusEl.value.trim());
        L.push('', 'Semangat tim! 💪');
        return L.join('\n');
      }

      var pre = el('pre', { class: 'wa-pre brief-pre' });
      function upd() { pre.textContent = build(); }
      fokusEl.addEventListener('input', function () { S.briefFokus = { day: today, text: fokusEl.value }; upd(); });
      var checks = el('div', { class: 'brief-checks' }, BRIEF_SECS.map(function (s) {
        return el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !hide[s[0]], onchange: function (e) {
          if (e.target.checked) delete hide[s[0]]; else hide[s[0]] = 1;
          store.set('briefHide', JSON.stringify(hide)); upd();
        } }), s[1]);
      }));
      var copyBtn = el('button', { class: 'btn btn-primary', type: 'button', onclick: function () {
        var t = build();
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Teks briefing disalin'); }, function () {
          var ta = el('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Teks briefing disalin'); } catch (e) { toast('Gagal menyalin', true); } ta.remove();
        });
      } }, icon('copy'), 'Salin teks');
      var waBtn = el('button', { class: 'btn btn-wa', type: 'button', onclick: function () { window.open('https://wa.me/?text=' + encodeURIComponent(build()), '_blank', 'noopener'); } }, icon('whatsapp'), 'Kirim ke WhatsApp');
      var k = B.kpi;
      body.replaceChildren(
        !adaData ? el('div', { class: 'err-box warn-box' }, '⚠️ DSR tanggal ' + dShort(kem) + ' belum diunggah, jadi sales kemarin belum ada. ', el('a', { href: '#/unggah', text: 'Unggah DSR sekarang →' })) : null,
        !bin || !bin.rows.length ? el('p', { class: 'note', text: 'Data by bin belum ada, bagian New Arrival & Display dilewati. Unggah di Inventory → Unggah By Bin.' }) : null,
        el('div', { class: 'grid grid-up' },
          el('div', { class: 'card' },
            el('div', { class: 'card-head' }, el('h3', { text: 'Teks briefing' }), modeSeg(function () { draw(B, mon, monToday, jad, bin); })),
            pre,
            el('div', { class: 'wa-actions' }, copyBtn, waBtn)),
          el('div', null,
            el('div', { class: 'card' }, el('h3', { text: 'Fokus hari ini' }),
              el('p', { class: 'sub', text: 'Terisi otomatis dari analisa PICA. Boleh diubah sebelum disalin.' }),
              fokusEl,
              el('button', { class: 'btn btn-ghost btn-sm', type: 'button', style: 'margin-top:8px', onclick: function () { fokusEl.value = fokusAuto; S.briefFokus = null; upd(); } }, icon('refresh'), 'Kembalikan otomatis')),
            el('div', { class: 'card section' }, el('h3', { text: 'Patokan fokus' }),
              el('div', { class: 'kv-row' }, el('span', { text: 'UPT bulan ini' }), el('b', { text: fDec(k.bulanIni.upt) })),
              el('div', { class: 'kv-row' }, el('span', { text: 'UPT bulan lalu (periode sama)' }), el('b', { text: fDec(k.bulanLalu.upt) })),
              el('div', { class: 'kv-row' }, el('span', { text: 'Rekor UPT' }), el('b', { text: k.rekor.upt ? fDec(k.rekor.upt.nilai) + ' · ' + monTxt(k.rekor.upt.bulan) : '—' })),
              el('div', { class: 'kv-row' }, el('span', { text: 'Target UPT' }), el('b', { text: fDec(B.target.upt) })),
              el('div', { class: 'kv-row' }, el('span', { text: 'Basket bulan ini' }), el('b', { text: rbTxt(k.bulanIni[S.mode === 'netto' ? 'basketN' : 'basketB']) })),
              el('div', { class: 'kv-row' }, el('span', { text: 'Basket bulan lalu' }), el('b', { text: rbTxt(k.bulanLalu[S.mode === 'netto' ? 'basketN' : 'basketB']) })),
              el('div', { class: 'kv-row' }, el('span', { text: 'Rekor basket' }), el('b', { text: k.rekor[S.mode === 'netto' ? 'basketN' : 'basketB'] ? rbTxt(k.rekor[S.mode === 'netto' ? 'basketN' : 'basketB'].nilai) + ' · ' + monTxt(k.rekor[S.mode === 'netto' ? 'basketN' : 'basketB'].bulan) : '—' })),
              el('div', { class: 'kv-row' }, el('span', { text: 'Target basket' }), el('b', { text: B.target.basket ? rbTxt(B.target.basket) : 'tidak diisi' })),
              el('p', { class: 'note', text: 'UPT & basket tanpa pembelian partai (wholesale atau ≥ ' + k.partaiMin + ' pcs per struk: ' + k.bulanIni.partai + ' struk bulan ini). Target diatur di halaman Admin.' })),
            el('div', { class: 'card section' }, el('h3', { text: 'Bagian yang ditampilkan' }), checks))));
      upd();
    }
  }

  /* ---------- Dokumentasi video opening/closing ---------- */
  function upPost(url, body) {
    return fetch(url, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('Mesin upload tidak merespons (' + r.status + ')'); return r.json(); },
        function () { throw new Error('Koneksi terputus'); })
      .then(function (res) { if (!res.ok) throw new Error(res.error || 'Unggah gagal'); return res.data; });
  }
  function blobB64(blob) {
    return new Promise(function (ok, no) {
      var fr = new FileReader();
      fr.onload = function () { var s = String(fr.result); ok(s.slice(s.indexOf(',') + 1)); };
      fr.onerror = function () { no(new Error('File tidak bisa dibaca')); };
      fr.readAsDataURL(blob);
    });
  }
  /** Unggah video: coba langsung ke Drive (cepat), bila diblokir browser pakai jalur server (cadangan). */
  function uploadVideo(file, jenis, tanggal, onProg, ctl) {
    var ext = (String(file.name).match(/\.(\w{2,5})$/) || [, 'mp4'])[1].toLowerCase();
    var T, sesi, mode = 'langsung', total = file.size;
    return api('dokTiket', { jenis: jenis, tanggal: tanggal }).then(function (t) {
      T = t;
      if (total > t.max) throw new Error('Video ' + Math.round(total / 1048576) + ' MB, maksimal ' + Math.round(t.max / 1048576) + ' MB. Rekam ulang dengan resolusi 720p atau potong videonya.');
      return upPost(t.url, { action: 'start', tiket: t.tiket, size: total, mime: file.type || 'video/mp4', ext: ext });
    }).then(function (s) {
      sesi = s.sesi;
      var offset = 0, fails = 0;
      function step() {
        if (ctl.batal) throw new Error('Unggahan dibatalkan');
        onProg(offset / total, mode);
        var size = mode === 'langsung' ? 16 * 1048576 : 8 * 1048576;
        var end = Math.min(total, offset + size);
        var part = file.slice(offset, end);
        var p = mode === 'langsung'
          ? fetch(sesi, { method: 'PUT', headers: { 'Content-Range': 'bytes ' + offset + '-' + (end - 1) + '/' + total }, body: part }).then(function (r) {
            if (r.status === 308) { var rg = r.headers.get('Range'); return { next: rg ? Number(rg.split('-')[1]) + 1 : end }; }
            if (r.ok) return r.json().then(function (f) { return upPost(T.url, { action: 'selesai', tiket: T.tiket, id: f.id }); });
            throw new Error('Drive menolak (' + r.status + ')');
          })
          : blobB64(part).then(function (b64) { return upPost(T.url, { action: 'chunk', tiket: T.tiket, offset: offset, data: b64 }); });
        return p.then(function (r) {
          fails = 0;
          if (r.done) { onProg(1, mode); return r; }
          offset = r.next; return step();
        }, function (err) {
          if (ctl.batal) throw err;
          if (mode === 'langsung' && offset === 0) { mode = 'server'; return step(); } // browser tidak mengizinkan langsung → jalur server
          if (++fails > 4) throw err;
          return new Promise(function (ok) { setTimeout(ok, 2000 * fails); })
            .then(function () { return upPost(T.url, { action: 'cek', tiket: T.tiket }); })
            .then(function (r) { if (r.done) return r; offset = r.next; return step(); }, function () { return step(); });
        });
      }
      return step();
    }).then(function (r) {
      api('dokSelesai', { jenis: jenis, tanggal: tanggal, nama: r.nama, size: r.size }).catch(function () {});
      return r;
    });
  }
  function fmtMB(b) { return (b / 1048576).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' MB'; }
  function dokStatusEl(d) {
    var today = d.today;
    var it = d.items.filter(function (x) { return x.tanggal === today; });
    var now = d.sekarang.split(':'), menit = Number(now[0]) * 60 + Number(now[1]);
    function one(j, batas) {
      var v = it.filter(function (x) { return x.jenis === j; });
      var late = !v.length && batas && menit >= batas;
      return el('div', { class: 'dok-st ' + (v.length ? 'ok' : late ? 'late' : 'wait') },
        el('span', { class: 'dok-st-ic' }, icon(v.length ? 'check' : late ? 'alert' : 'video')),
        el('div', null, el('b', { text: j === 'OPENING' ? 'Opening' : 'Closing' }),
          el('span', { text: v.length ? v.map(function (x) { return shortFirst(x.oleh) + ' ' + x.jam; }).join(', ') : late ? 'Belum ada, lewat batas ' + pad2(Math.floor(batas / 60)) + '.' + pad2(batas % 60) : 'Belum diunggah' })));
    }
    return el('div', { class: 'dok-status' }, one('OPENING', d.batasOpen), one('CLOSING', d.batasClose));
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function playVideo(x) {
    closeMenu();
    var wrap = el('div', { class: 'sheet-wrap vid-wrap', onclick: function (e) { if (e.target === wrap) { wrap.remove(); document.body.classList.remove('no-scroll'); } } },
      el('div', { class: 'vid-box' },
        el('div', { class: 'sheet-head' }, el('b', { text: (x.jenis === 'OPENING' ? 'Opening' : 'Closing') + ' · ' + dShort(x.tanggal) + ' · ' + x.jam + ' · ' + x.oleh }),
          el('button', { class: 'sheet-x', 'aria-label': 'Tutup', html: IC.x, onclick: function () { wrap.remove(); document.body.classList.remove('no-scroll'); } })),
        el('iframe', { class: 'vid-frame', src: 'https://drive.google.com/file/d/' + x.id + '/preview', allow: 'autoplay; fullscreen', allowfullscreen: true }),
        el('a', { class: 'btn btn-ghost btn-sm', href: 'https://drive.google.com/file/d/' + x.id + '/view', target: '_blank', rel: 'noopener', style: 'margin:10px 16px 14px' }, 'Buka di Google Drive ↗')));
    document.body.classList.add('no-scroll');
    document.body.appendChild(wrap);
  }

  function viewDokumentasi(v) {
    pageHead(v, 'Dokumentasi', 'Video opening & closing toko, tersimpan rapi di folder Drive per bulan.');
    var statusBox = el('div', null, el('div', { class: 'skel' }));
    var upBox = el('div', { class: 'card' });
    var listBox = el('div', { class: 'card section' }, el('div', { class: 'skel', style: 'min-height:80px' }));
    v.append(el('div', { class: 'grid grid-up' }, el('div', { class: 'dok-left' }, statusBox, upBox), listBox));
    v.append(dokRekapBulan(todayJkt().slice(0, 7)));
    var bulan = S.dokBulan || '';
    var jenis = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date())) < 15 ? 'OPENING' : 'CLOSING';
    var qj = (location.hash.match(/[?&]jenis=(OPENING|CLOSING)/) || [])[1]; if (qj) jenis = qj;
    var busy = false, tanggal = '';

    function load() {
      api('dokList', { bulan: bulan }).then(function (d) { bulan = d.bulan; S.dokBulan = bulan; draw(d); }).catch(function (e) { listBox.replaceChildren(errBox(e)); statusBox.replaceChildren(); });
    }
    function drawUpload(d) {
      if (busy) return;
      if (!d.siap) { upBox.replaceChildren(el('h3', { text: 'Unggah video' }), el('p', { class: 'muted', text: 'Mesin upload belum disambungkan. Admin: buka halaman Admin → Mesin upload.' })); return; }
      var input = el('input', { type: 'file', accept: 'video/*', id: 'vid-file' });
      var drop = el('label', { class: 'drop', for: 'vid-file' }, el('span', { class: 'drop-ic' }, icon('video')),
        el('span', { class: 'drop-txt' }, el('b', { text: 'Pilih atau rekam video' }), el('span', { text: 'Maksimal ' + d.maxMb + ' MB · disarankan 720p, 1–2 menit' })), input);
      var area = el('div');
      var minD = addDays(d.today, -(isAdmin() ? 366 : (d.mundur || 7)));
      var dateInp = el('input', { type: 'date', id: 'vid-date', value: tanggal || d.today, max: d.today, min: minD });
      var dateNote = el('small', { class: 'muted' });
      function noteDate() {
        tanggal = dateInp.value || d.today;
        dateNote.textContent = tanggal === d.today ? 'Hari ini' : dLong(tanggal) + ' · unggah susulan';
      }
      dateInp.addEventListener('change', function () {
        if (!dateInp.value || dateInp.value > d.today) dateInp.value = d.today;
        if (dateInp.value < minD) { dateInp.value = minD; toast('Tanggal paling lama ' + (isAdmin() ? 366 : (d.mundur || 7)) + ' hari ke belakang', true); }
        noteDate();
      });
      noteDate();
      upBox.replaceChildren(el('h3', { text: 'Unggah video' }),
        el('div', { style: 'margin:10px 0 12px' }, segmented([['OPENING', 'Opening'], ['CLOSING', 'Closing']], jenis, function (x) { jenis = x; })),
        el('div', { class: 'field dok-date-field' }, el('label', { for: 'vid-date', text: 'Tanggal dokumentasi' }), dateInp, dateNote),
        drop, area);
      input.addEventListener('change', function () {
        var f = input.files[0]; input.value = '';
        if (!f) return;
        if (!/^video\//.test(f.type || 'video/')) { area.replaceChildren(errBox(new Error('File ini bukan video'))); return; }
        if (f.size > d.maxMb * 1048576) { area.replaceChildren(errBox(new Error('Video ' + fmtMB(f.size) + ', maksimal ' + d.maxMb + ' MB. Rekam ulang dengan resolusi 720p atau potong videonya.'))); return; }
        var ctl = { batal: false };
        var bar = el('div', { class: 'progress' }, el('i'));
        var txt = el('span', { class: 'muted', text: 'Menyiapkan…' });
        var cancel = el('button', { class: 'btn btn-ghost btn-sm', text: 'Batalkan', onclick: function () { ctl.batal = true; cancel.disabled = true; } });
        busy = true;
        area.replaceChildren(el('div', { class: 'file-row' }, el('span', { class: 'file-ic' }, icon('video')),
          el('div', null, el('b', { text: (jenis === 'OPENING' ? 'Opening' : 'Closing') + ' · ' + dShort(tanggal) + ' · ' + f.name }), el('span', { text: fmtMB(f.size) }))),
          bar, el('div', { class: 'up-row' }, txt, cancel),
          el('p', { class: 'note', text: 'Biarkan halaman ini tetap terbuka sampai selesai.' }));
        var tgUp = tanggal;
        uploadVideo(f, jenis, tgUp, function (p, mode) {
          bar.firstChild.style.width = Math.round(p * 100) + '%';
          txt.textContent = 'Mengunggah ' + Math.round(p * 100) + '% · ' + fmtMB(f.size * p) + ' / ' + fmtMB(f.size) + (mode === 'server' ? ' · jalur server' : '');
        }, ctl).then(function (r) {
          busy = false;
          area.replaceChildren(el('div', { class: 'done' }, el('span', { class: 'done-ic' }, icon('check')), el('h3', { text: 'Video tersimpan' }),
            el('p', { class: 'muted', text: r.nama })));
          toast('Video ' + jenis.toLowerCase() + ' tersimpan');
          if (tgUp.slice(0, 7) !== bulan) bulan = tgUp.slice(0, 7);
          setTimeout(load, 800);
        }).catch(function (err) {
          busy = false;
          area.replaceChildren(errBox(err));
        });
      });
    }
    function draw(d) {
      statusBox.replaceChildren(el('div', { class: 'card' }, el('h3', { text: 'Hari ini · ' + dLong(d.today) }), dokStatusEl(d)));
      drawUpload(d);
      var byDay = {};
      d.items.forEach(function (x) { (byDay[x.tanggal] = byDay[x.tanggal] || []).push(x); });
      var p = String(d.bulan).split('-').map(Number), dim = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
      var lastDay = d.bulan === d.today.slice(0, 7) ? Number(d.today.slice(8, 10)) : dim;
      var lengkap = 0, bolong = [];
      var firstDay = d.items.length ? Math.min.apply(null, d.items.map(function (x) { return Number(x.tanggal.slice(8)); })) : lastDay + 1;
      var hitung = Math.max(0, lastDay - firstDay + 1);
      for (var i = firstDay; i <= lastDay; i++) {
        var t = d.bulan + '-' + pad2(i), l = byDay[t] || [];
        var o = l.some(function (x) { return x.jenis === 'OPENING'; }), c = l.some(function (x) { return x.jenis === 'CLOSING'; });
        if (o && c) lengkap++; else if (t < d.today) bolong.push(t);
      }
      var per = {}; d.items.forEach(function (x) { per[x.oleh] = (per[x.oleh] || 0) + 1; });
      var days = Object.keys(byDay).sort().reverse();
      listBox.replaceChildren(
        el('div', { class: 'card-head' }, el('h3', { text: 'Riwayat ' + bulanLabel(d.bulan) }), monthSel(d.bulanTersedia.length ? d.bulanTersedia : [d.bulan], d.bulan, function (m) { bulan = m; load(); })),
        el('div', { class: 'stats stats-3', style: 'margin:10px 0' },
          el('div', { class: 'stat' }, el('span', { text: 'Hari lengkap' }), el('b', { class: 'c-good', text: lengkap + ' / ' + hitung })),
          el('div', { class: 'stat' }, el('span', { text: 'Hari bolong' }), el('b', { class: bolong.length ? 'c-bad' : '', text: String(bolong.length) })),
          el('div', { class: 'stat' }, el('span', { text: 'Total video' }), el('b', { text: String(d.items.length) }))),
        bolong.length ? el('p', { class: 'note', text: 'Belum lengkap: ' + bolong.map(function (t) { return Number(t.slice(8)); }).join(', ') }) : null,
        Object.keys(per).length ? el('div', { class: 'tags', style: 'margin-bottom:10px' }, Object.keys(per).sort(function (a, b) { return per[b] - per[a]; }).map(function (n) { return el('span', { class: 'tag', text: titleCase(n) + ' · ' + per[n] }); })) : null,
        days.length ? el('div', { class: 'dok-list' }, days.map(function (t) {
          return el('div', { class: 'dok-day' }, el('div', { class: 'dok-date' }, el('b', { text: String(Number(t.slice(8))) }), el('span', { text: dDayName(t) })),
            el('div', { class: 'dok-vids' }, byDay[t].map(function (x) {
              return el('button', { type: 'button', class: 'dok-vid ' + x.jenis.toLowerCase(), onclick: function () { playVideo(x); } },
                icon('video'), el('span', null, el('b', { text: x.jenis === 'OPENING' ? 'Opening' : 'Closing' }), el('small', { text: titleCase(x.oleh) + ' · ' + x.jam + ' · ' + fmtMB(x.size) })));
            })));
        })) : el('div', { class: 'empty', text: 'Belum ada video di bulan ini' }));
    }
    load();
  }

  Object.assign(VIEWS, {
    beranda: viewBeranda, briefing: viewBriefing, mingguan: viewMingguan, pengumuman: viewPengumuman, handover: viewHandover, feedback: viewFeedback, apresiasi: viewApresiasi, dokumentasi: viewDokumentasi, monitoring: viewMonitoring, trend: viewTrend, ra: viewRA, produk: viewProduk, customer: viewCustomer,
    stok: viewStok, stokart: viewStokArt, saranreq: viewSaranReq, display: viewDisplay, cari: viewCari, unggahbin: viewUnggahBin, kas: viewKas, 'kas-rekap': viewKasRekap, unggah: viewUnggah,
    jadwal: viewJadwal, request: viewRequest, tukar: viewTukar, simpanan: viewSimpanan,
    akun: viewAkun, admin: viewAdmin, aktivitas: viewAktivitas, pica: viewPica
  });
  render();
})();
