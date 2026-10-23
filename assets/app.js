/* Hub Toko 2299 — aplikasi web (tanpa framework). */
(function () {
  'use strict';

  var CFG = window.HUB_CONFIG || {};
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
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M3 9h18M9 20v-6h6v6"/></svg>'
  };
  function icon(name) { return el('span', { html: IC[name], style: 'display:contents' }); }

  /* ---------- router ---------- */
  var ROUTES = [
    { id: 'beranda', label: 'Beranda', icon: 'home' },
    { id: 'monitoring', label: 'Monitoring Sales', icon: 'chart' },
    { id: 'unggah', label: 'Unggah DSR', icon: 'upload' },
    { id: 'jadwal', label: 'Jadwal', icon: 'cal' },
    { id: 'admin', label: 'Admin', icon: 'users', admin: true },
    { id: 'akun', label: 'Akun', icon: 'user' }
  ];
  function current() { return (location.hash.replace(/^#\/?/, '') || 'beranda').split('?')[0]; }
  function go(id) { if (current() === id) render(); else location.hash = '#/' + id; }
  window.addEventListener('hashchange', render);

  function render() {
    var app = $('#app');
    if (!CFG.API_URL) { app.replaceChildren(viewSetup()); return; }
    var r = current();
    if (!S.token) { app.replaceChildren(viewLogin()); return; }
    if (r === 'login') { location.hash = '#/beranda'; return; }
    var route = ROUTES.filter(function (x) { return x.id === r; })[0] || ROUTES[0];
    if (route.admin && (!S.user || S.user.role !== 'admin')) route = ROUTES[0];
    if (!S.meChecked) { S.meChecked = true; refreshMe(); }
    app.replaceChildren(shell(route));
    var view = $('#view');
    ({ beranda: viewBeranda, monitoring: viewMonitoring, unggah: viewUnggah, jadwal: viewJadwal, admin: viewAdmin, akun: viewAkun })[route.id](view);
    window.scrollTo(0, 0);
  }

  function shell(route) {
    var items = ROUTES.filter(function (x) { return !x.admin || (S.user && S.user.role === 'admin'); });
    var link = function (x, withIcon) {
      return el('a', { href: '#/' + x.id, 'aria-current': x.id === route.id ? 'page' : null },
        withIcon ? icon(x.icon) : null, x.label,
        x.id === 'admin' && S.menunggu ? el('span', { class: 'badge', text: S.menunggu }) : null);
    };
    var refreshBtn = el('button', { class: 'icon-btn', title: 'Muat ulang data', 'aria-label': 'Muat ulang data', html: IC.refresh, onclick: function () {
      S.mon = null; S.jadwal = null; S.info = null; render(); toast('Data dimuat ulang');
    } });
    return el('div', { class: 'shell' },
      el('aside', { class: 'side' },
        el('div', { class: 'brand' }, el('div', { class: 'logo', html: IC.logo.replace('fill="#fff"', 'fill="#0F2A7A"') }),
          el('div', null, el('b', { text: 'Hub Toko ' + CFG.STORE }), el('span', { text: CFG.STORE_NAME }))),
        el('nav', null, items.map(function (x) { return link(x, true); })),
        el('div', { class: 'side-foot', text: 'Rumus sales sama dengan Integrated Hub Jateng 01' })),
      el('div', null,
        el('header', { class: 'topbar' },
          el('div', { class: 'topbar-in' },
            el('a', { class: 'brand-sm', href: '#/beranda' }, el('span', { class: 'logo', html: IC.logo }), 'Hub ' + CFG.STORE),
            el('span', { class: 'user-name', text: S.user ? S.user.nama : '' }),
            el('span', { class: 'chip' }, icon('store'), CFG.STORE),
            refreshBtn,
            el('button', { class: 'btn-out', text: 'Keluar', onclick: logout })),
          el('nav', { class: 'tabs' }, items.map(function (x) { return link(x, false); }))),
        el('main', { class: 'view', id: 'view' })));
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
    return el('div', { class: 'auth-brand' }, el('div', { class: 'logo', html: IC.logo }),
      el('div', null, el('h1', { text: 'Hub Toko ' + CFG.STORE }), el('p', { text: 'EIGER ' + CFG.STORE_NAME + ' · Store Hub' })));
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
      el('div', { class: 'auth-foot', text: 'Khusus tim toko ' + CFG.STORE })));
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
    var W = 760, H = 240, ml = 44, mr = 8, mt = 12, mb = 24;
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
    wrap.appendChild(svg); wrap.appendChild(tip);
    return wrap;
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
      el('a', { href: '#/jadwal' }, icon('cal'), 'Jadwal', el('span', { text: 'Shift tim' })),
      el('a', { href: '#/akun' }, icon('user'), 'Akun', el('span', { text: 'Ganti password' }))));

    loadInfo().then(function (info) {
      var h = $('#hero-info');
      if (!h) return;
      h.replaceChildren();
      if (info.unggahTerakhir) {
        var u = info.unggahTerakhir;
        h.append('Data sampai ', el('b', { text: dShort(info.dataSampai) }), el('br'),
          'Unggahan terakhir ' + u.waktu.slice(0, 16) + ' oleh ' + u.nama);
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
      el('div', { class: 'hero-right' }, el('b', { text: 'Hub Toko ' + CFG.STORE }), el('br'), el('span', { text: 'diambil ' + nowJkt() + (S.user ? ' · ' + S.user.nama : '') })));
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
        el('div', { class: 'card section', style: 'padding:0;overflow:hidden' }, el('div', { class: 'scroll-x' }, monTable(sm))),
        el('div', { class: 'legend' },
          el('span', null, el('i', { class: 'bg-good' }), '≥100%'), el('span', null, el('i', { class: 'bg-warn' }), '95–100%'), el('span', null, el('i', { class: 'bg-bad' }), '<95%')),
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
    v.append(el('section', { class: 'hero' },
      el('div', null, el('h2', { text: 'Unggah DSR' }), el('p', { text: 'File Item DSR Report dari sistem (format .xlsx). Data yang sudah ada tidak akan dobel.' }))));
    var input = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', id: 'dsr-file' });
    var drop = el('label', { class: 'drop', for: 'dsr-file' }, icon('upload'), el('b', { text: 'Pilih file DSR' }),
      el('span', { class: 'muted', text: 'Ketuk untuk memilih, atau seret file ke sini' }), input);
    var area = el('div');
    var hist = el('div', { class: 'card section' }, el('h3', { text: 'Riwayat unggahan' }), el('div', { class: 'skel', style: 'margin-top:12px' }));
    v.append(el('div', { class: 'card' }, drop, area), hist);

    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
    input.addEventListener('change', function () { if (input.files[0]) handle(input.files[0]); });

    function handle(file) {
      area.replaceChildren(el('p', { class: 'muted', style: 'margin-top:14px', text: 'Membaca ' + file.name + '…' }));
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
      var btn = el('button', { class: 'btn btn-orange btn-block', text: 'Unggah ' + fNum(rows.length) + ' baris', disabled: !okStore });
      var bar = el('div', { class: 'progress hide' }, el('i'));
      var out = el('div');
      area.replaceChildren(
        el('div', { style: 'margin-top:16px' },
          el('h3', { text: file.name, style: 'margin:0;font-size:16px;word-break:break-all' }),
          el('p', { class: 'muted', style: 'margin:4px 0 0', text: parsed.lokasi || 'Lokasi tidak tertulis di file' }),
          !okStore ? errBox(new Error('File ini bukan DSR toko ' + CFG.STORE + '.')) : null,
          el('div', { class: 'stats' },
            stat('Periode', dShort(dates[0]) + ' – ' + dShort(dates[dates.length - 1])),
            stat('Baris / invoice', fNum(rows.length) + ' / ' + fNum(Object.keys(inv).length)),
            stat('Sales bruto', fRpShort(bruto)), stat('Sales netto', fRpShort(netto))),
          parsed.bad ? el('p', { class: 'muted', text: parsed.bad + ' baris dilewati karena tanggalnya tidak terbaca.' }) : null,
          el('p', { class: 'note', text: 'Nama, nomor HP dan email customer tidak dikirim. Yang disimpan hanya kode customer acak dan nama untuk rekap belanja.' }),
          btn, bar, out));
      btn.addEventListener('click', function () {
        btn.disabled = true; btn.textContent = 'Menyiapkan…'; bar.classList.remove('hide');
        prepareRows(rows).then(function (arrs) {
          btn.textContent = 'Mengunggah…';
          bar.firstChild.style.width = '35%';
          var slow = setTimeout(function () { bar.firstChild.style.width = '75%'; }, 4000);
          return api('upload', { rows: arrs, lokasi: parsed.lokasi, fileName: file.name }).then(function (res) {
            clearTimeout(slow);
            bar.firstChild.style.width = '100%';
            S.mon = null; S.info = null;
            btn.textContent = 'Selesai';
            out.replaceChildren(el('div', { class: 'form-msg ok' },
              el('b', { text: 'Berhasil. ' }), fNum(res.baru) + ' invoice baru, ' + fNum(res.diperbarui) + ' diperbarui, ' + fNum(res.sama) + ' sudah ada (tidak dobel).'),
              el('a', { class: 'btn btn-primary btn-block', href: '#/monitoring', text: 'Lihat Monitoring Sales' }));
            loadHist();
          }, function (err) { clearTimeout(slow); throw err; });
        }).catch(function (err) {
          bar.classList.add('hide'); btn.disabled = false; btn.textContent = 'Coba unggah lagi';
          out.replaceChildren(errBox(err));
        });
      });
    }

    function stat(label, val) { return el('div', { class: 'stat' }, el('span', { text: label }), el('b', { text: val })); }

    function loadHist() {
      api('uploads').then(function (list) {
        hist.replaceChildren(el('h3', { text: 'Riwayat unggahan' }), el('p', { class: 'sub', text: '30 unggahan terakhir' }),
          list.length ? el('ul', { class: 'list' }, list.map(function (u) {
            return el('li', null,
              el('div', null, el('b', { text: u.nama }), el('div', { class: 'muted', style: 'font-size:13px', text: u.waktu.slice(0, 16) + ' · ' + dShort(u.dari) + ' – ' + dShort(u.sampai) })),
              el('div', { class: 'num', style: 'text-align:right;font-size:13px' }, el('div', { text: '+' + fNum(u.baru) + ' baru' }),
                el('div', { class: 'muted', text: fNum(u.diperbarui) + ' diperbarui · ' + fNum(u.sama) + ' sama' })));
          })) : el('div', { class: 'empty', text: 'Belum ada unggahan' }));
      }).catch(function (err) { hist.replaceChildren(el('h3', { text: 'Riwayat unggahan' }), errBox(err)); });
    }
    loadHist();
  }

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
    v.append(box);
    function load() {
      api('users').then(function (users) {
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
            el('ul', { class: 'list' }, others.map(function (u) {
              var me = S.user && u.username === S.user.username;
              return el('li', null, userInfo(u), me ? el('span', { class: 'muted', style: 'font-size:13px', text: 'Anda' }) : el('div', { class: 'actions' },
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

  render();
})();
