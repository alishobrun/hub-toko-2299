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
  var S = { token: null, user: null, menunggu: 0, mode: 'bruto', fmt: 'penuh', mon: null, jadwal: null, info: null };

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
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M3 9h18M9 20v-6h6v6"/></svg>'
  };
  function icon(name, cls) { return el('span', { class: 'ic' + (cls ? ' ' + cls : ''), html: IC[name], 'aria-hidden': 'true' }); }

  /* ---------- router & menu ---------- */
  var GROUPS = [
    { id: 'beranda', label: 'Beranda', icon: 'home', items: [{ icon: 'home', id: 'beranda', label: 'Beranda' }] },
    { id: 'sales', label: 'Sales', icon: 'chart', items: [
      { icon: 'gauge', id: 'monitoring', label: 'Monitoring Sales', desc: 'Achievement, UPT & basket' },
      { icon: 'clip', id: 'pica', label: 'Analisa PICA', desc: 'Problem & corrective action, salin WA' },
      { icon: 'trend', id: 'trend', label: 'Sales Trend', desc: 'Per jam & per hari' },
      { icon: 'award', id: 'ra', label: 'RA Performance', desc: 'Sales per orang' },
      { icon: 'tag', id: 'produk', label: 'Produk & Promo', desc: 'Kategori, terlaris & promo' },
      { icon: 'heart', id: 'customer', label: 'Customer & Retur', desc: 'Member & barang kembali' }] },
    { id: 'inventory', label: 'Inventory', icon: 'box', items: [
      { icon: 'box', id: 'stok', label: 'Monitoring Stok', desc: 'Stok, rasio & display dari SOH' }] },
    { id: 'kasg', label: 'Kas', icon: 'cash', items: [
      { icon: 'cash', id: 'kas', label: 'Cek Kas', desc: 'Till, Store Safe, Floating, Petty' },
      { icon: 'scale', id: 'kas-rekap', label: 'Rekap Selisih', desc: 'Selisih kas per orang' }] },
    { id: 'data', label: 'Data', icon: 'upload', items: [
      { icon: 'upload', id: 'unggah', label: 'Unggah DSR', desc: 'Perbarui data penjualan' }] },
    { id: 'tim', label: 'Tim', icon: 'users', items: [
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
    VIEWS[m.r.id]($('#view'));
    window.scrollTo(0, 0);
  }

  var menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } document.querySelectorAll('.tabs a[aria-expanded=true]').forEach(function (a) { a.setAttribute('aria-expanded', 'false'); }); }
  document.addEventListener('click', function (e) { if (menuEl && !e.target.closest('.menu-pop') && !e.target.closest('.tabs a')) closeMenu(); });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  function visibleItems(g) { return g.items.filter(function (x) { return !x.admin || isAdmin(); }); }

  function shell(m) {
    var badge = function (id) { return id === 'admin' && S.menunggu ? el('span', { class: 'badge', text: S.menunggu }) : null; };
    var side = el('nav', null, GROUPS.map(function (g) {
      var items = visibleItems(g);
      if (g.id === 'beranda') return el('a', { href: '#/beranda', 'aria-current': m.r.id === 'beranda' ? 'page' : null }, icon(g.icon), 'Beranda');
      return el('div', { class: 'side-group' + (g === m.g ? ' open' : '') },
        el('div', { class: 'side-head' }, icon(g.icon), g.label),
        items.map(function (x) { return el('a', { href: '#/' + x.id, class: 'sub', 'aria-current': x.id === m.r.id ? 'page' : null }, icon(x.icon), el('span', { text: x.label }), badge(x.id)); }));
    }));
    var tabs = el('nav', { class: 'tabs' }, GROUPS.map(function (g) {
      var single = g.id === 'beranda';
      var a = el('a', { href: single ? '#/beranda' : '#', class: g === m.g ? 'active' : null, 'aria-current': g === m.g ? 'page' : null,
        'aria-haspopup': single ? null : 'true', 'aria-expanded': single ? null : 'false' },
        g.label, single ? null : el('span', { class: 'caret', text: '▾' }), g.id === 'tim' && S.menunggu && isAdmin() ? el('span', { class: 'dot' }) : null);
      if (!single) a.addEventListener('click', function (e) {
        e.preventDefault();
        var open = a.getAttribute('aria-expanded') === 'true';
        closeMenu();
        if (open) return;
        a.setAttribute('aria-expanded', 'true');
        menuEl = el('div', { class: 'menu-pop', role: 'menu' }, visibleItems(g).map(function (x) {
          return el('a', { href: '#/' + x.id, role: 'menuitem', class: x.id === m.r.id ? 'on' : null },
            el('span', { class: 'mp-ic' }, icon(x.icon)),
            el('span', { class: 'mp-txt' }, el('b', null, x.label, badge(x.id)), x.desc ? el('span', { text: x.desc }) : null));
        }));
        $('.topbar').appendChild(menuEl);
      });
      return a;
    }));
    var refreshBtn = el('button', { class: 'icon-btn', title: 'Muat ulang data', 'aria-label': 'Muat ulang data', html: IC.refresh, onclick: function () {
      S.mon = null; S.jadwal = null; S.info = null; S.lap = {}; S.cust = null; S.stok = null; S.tim = null; render(); toast('Data dimuat ulang');
    } });
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
            el('span', { class: 'page-title', text: m.r.id === 'beranda' ? '' : m.r.label }),
            el('span', { class: 'user-name', text: S.user ? S.user.nama : '' }),
            el('span', { class: 'chip' }, icon('store'), CFG.STORE),
            refreshBtn,
            el('button', { class: 'btn-out', text: 'Keluar', onclick: logout })),
          tabs),
        el('main', { class: 'view', id: 'view' }),
        el('footer', { class: 'credit' }, APP + ' · Dibuat oleh ', el('b', { text: 'Ali Muhammad Shobrun' }))));
  }

  function logout() {
    var t = S.token;
    setSession(null, null);
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
      el('div', null, el('h1', { text: APP }), el('p', { text: (CFG.TAGLINE || 'Store Management') + ' · EIGER ' + CFG.STORE_NAME })));
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
      var changed = !S.user || S.user.role !== u.role || S.menunggu !== (u.menunggu || 0);
      S.user = { username: u.username, nama: u.nama, role: u.role };
      S.menunggu = u.menunggu || 0;
      store.set('user', JSON.stringify(S.user));
      if (changed) {
        var nav = document.querySelectorAll('a[href="#/admin"]');
        if (!nav.length && S.user.role === 'admin') render();
        nav.forEach(function (a) {
          var b = a.querySelector('.badge');
          if (S.menunggu && !b) a.appendChild(el('span', { class: 'badge', text: S.menunggu }));
          else if (b) { if (S.menunggu) b.textContent = S.menunggu; else b.remove(); }
        });
      }
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
    var row = el('div', { class: 'grid grid-2 section' });
    var duty = el('div', { class: 'card' }, el('h3', { text: 'Bertugas hari ini' }), el('p', { class: 'sub', text: dLong(todayJkt()) }), el('div', { class: 'skel' }));
    var chartCard = el('div', { class: 'card' }, el('h3', { text: 'Sales harian bulan ini' }), el('p', { class: 'sub', text: 'Batang = sales, garis putus-putus = target harian' }), el('div', { class: 'skel' }));
    row.append(chartCard, duty);
    v.append(row);
    v.append(el('div', { class: 'quick section' },
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
      duty.replaceChildren(el('h3', { text: 'Bertugas hari ini' }), el('p', { class: 'sub', text: dLong(j.hariIni || todayJkt()) + (j.tab ? ' · tab ' + j.tab : '') }), dutyBlock(j, j.hariIni || todayJkt()));
    }).catch(function (err) { duty.lastChild.replaceWith(errBox(err)); });
  }

  var SHIFT_NAME = { PD: 'Pagi (PD)', NS: 'NS', MC: 'MC', MD: 'Middle (MD)', SC: 'SC', SB: 'Siang (SB)', OFF: 'Libur', CT: 'Cuti' };
  var SHIFT_ORDER = ['PD', 'NS', 'MC', 'MD', 'SC', 'SB', 'OFF', 'CT'];
  function dutyBlock(j, day) {
    var i = (j.tanggal || []).indexOf(day);
    if (i < 0) return el('div', { class: 'empty', text: 'Tanggal ini tidak ada di tab jadwal terbaru' });
    var by = {};
    j.staf.forEach(function (s) { var c = s.shift[i] || '—'; (by[c] = by[c] || []).push(s.nama); });
    var codes = Object.keys(by).sort(function (a, b) { return (SHIFT_ORDER.indexOf(a) + 1 || 50) - (SHIFT_ORDER.indexOf(b) + 1 || 50); });
    return el('div', { class: 'duty' }, codes.map(function (c) {
      return el('div', { class: 'duty-col' + (c === 'OFF' || c === 'CT' ? ' off' : '') },
        el('h4', { text: SHIFT_NAME[c] || c }), el('ul', null, by[c].map(function (n) { return el('li', { text: titleCase(n) }); })));
    }));
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
    var bulan = S.raBulan || '', lingkup = 'bulan', tanggal = '';
    function load() { loadLap(bulan).then(function (d) { bulan = d.bulan; S.raBulan = bulan; draw(d); }).catch(function (e) { body.replaceChildren(errBox(e)); }); }
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
        el('ul', { class: 'ra-list' }, list.map(function (x, i) {
          return el('li', null,
            el('span', { class: 'rank' + (i < 3 ? ' top' : ''), text: i + 1 }),
            el('div', { class: 'ra-main' },
              el('div', { class: 'ra-top' }, el('b', { text: titleCase(x.nama) }), el('b', { class: 'num', text: fRpShort(x.s) })),
              bar(x.s, max, i === 0 ? 'hot' : ''),
              el('div', { class: 'tags' },
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
        el('div', { class: 'card section' },
          el('div', { class: 'card-head' }, el('h3', { text: 'Produk terlaris' }),
            segmented([['20', 'Top 20'], ['50', 'Top 50'], ['100', 'Top 100']], String(topN), function (x) { topN = Number(x); drawProd(); })),
          search, prodList));
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
          el('p', { class: 'sub', text: 'Tipis = rasio < 2 bulan · Lambat = rasio > 6 bulan' }), chips, search, list));
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

  /* ---------- Admin ---------- */
  function viewAdmin(v) {
    v.append(el('section', { class: 'hero' }, el('div', null, el('h2', { text: 'Admin · Akun Tim' }), el('p', { text: 'Setujui pendaftaran, nonaktifkan akun, atau reset password.' }))));
    var box = el('div', null, el('div', { class: 'skel' }));
    var setCard = el('div', { class: 'card section' }, el('h3', { text: 'Pengaturan kas' }), el('div', { class: 'skel', style: 'margin-top:12px;min-height:60px' }));
    v.append(box, setCard);
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
      setCard.replaceChildren(el('h3', { text: 'Pengaturan kas' }),
        el('p', { class: 'sub', text: 'Angka standar yang dipakai di menu Cek Kas.' }),
        row('modal_till', 'set-modal', 'Modal till (Float To Till)'),
        row('floating_cash', 'set-float', 'Floating Cash (modal besar)'));
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
        S.menunggu = pending.length;
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

  Object.assign(VIEWS, {
    beranda: viewBeranda, monitoring: viewMonitoring, trend: viewTrend, ra: viewRA, produk: viewProduk, customer: viewCustomer,
    stok: viewStok, kas: viewKas, 'kas-rekap': viewKasRekap, unggah: viewUnggah,
    jadwal: viewJadwal, request: viewRequest, tukar: viewTukar, simpanan: viewSimpanan,
    akun: viewAkun, admin: viewAdmin, aktivitas: viewAktivitas, pica: viewPica
  });
  render();
})();
