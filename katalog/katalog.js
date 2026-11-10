/* Katalog EIGER Kartasura — halaman publik untuk pelanggan.
 * Data dari aksi `katalog` di mesin Basecamp (Apps Script): tanpa jumlah stok,
 * hanya ukuran tersedia / kosong per warna. */
(function () {
  'use strict';

  var CFG = window.HUB_CONFIG || {};
  var SIMPAN = 'katalog2299.data';
  var PER_HALAMAN = 24;

  /* ---------- kamus tampilan ---------- */
  var KAT = {
    BAGS: { nama: 'Tas', urut: 1, ikon: '<path d="M7 8V6a5 5 0 0 1 10 0v2"/><rect x="4" y="8" width="16" height="13" rx="3"/><path d="M8 13h8M9 17h6"/>' },
    APPAREL: { nama: 'Pakaian', urut: 2, ikon: '<path d="M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3a4 4 0 0 1-8 0Z"/>' },
    FOOTWEAR: { nama: 'Sepatu & sandal', urut: 3, ikon: '<path d="M3 17v-5l3-1 2-5h3l1 4 4 2 5 1a2 2 0 0 1 1 2v2Z"/><path d="M3 17v2h19v-2"/>' },
    EQUIPMENT: { nama: 'Perlengkapan outdoor', urut: 4, ikon: '<path d="M3 20 12 4l9 16Z"/><path d="M12 4v16M8.5 20 12 13l3.5 7"/>' },
    HEADWEAR: { nama: 'Topi', urut: 5, ikon: '<path d="M4 15a8 8 0 0 1 16 0Z"/><path d="M2 15h20v2H2Z"/><path d="M12 7V5"/>' },
    ACCESSORIES: { nama: 'Aksesoris', urut: 6, ikon: '<rect x="3" y="7" width="18" height="12" rx="3"/><path d="M16 13h2M3 11h18"/>' }
  };
  var IKON_SEMUA = '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>';
  var SUB = {
    BACKPACK: 'Ransel', CARRIER: 'Carrier', DAYPACK: 'Daypack', 'SLING BAG': 'Sling bag', 'SHOULDER BAG': 'Tas bahu', 'WAIST BAG': 'Tas pinggang',
    'HAND BAG': 'Tas tangan', 'TOTE BAG': 'Tote bag', DUFFLE: 'Duffel', 'DUFFLE BAG': 'Duffel', POUCH: 'Pouch', 'LAPTOP BAG': 'Tas laptop', 'TRAVEL BAG': 'Tas travel',
    JACKET: 'Jaket', PANTS: 'Celana panjang', SHORTS: 'Celana pendek', SHIRT: 'Kemeja', TOP: 'Kaos & atasan', 'T-SHIRT': 'Kaos', VEST: 'Rompi',
    RAINWEAR: 'Jas hujan', BASELAYER: 'Baselayer', GOWN: 'Gamis', SWEATER: 'Sweater', HOODIE: 'Hoodie', POLO: 'Polo',
    SHOES: 'Sepatu', SANDAL: 'Sandal', SANDALS: 'Sandal', SOCK: 'Kaos kaki', SOCKS: 'Kaos kaki', SLIPPER: 'Sandal jepit', BOOTS: 'Sepatu boot',
    TENTS: 'Tenda', TENT: 'Tenda', 'SLEEPING BAG': 'Sleeping bag', MATTRESS: 'Matras', COOKWARE: 'Alat masak', COOKING: 'Alat masak',
    'WATER STORAGE': 'Botol minum', BOTTLE: 'Botol minum', LIGHTING: 'Senter & lampu', CHAIR: 'Kursi lipat', TOWEL: 'Handuk',
    'INSECT PROTECTION': 'Anti nyamuk', 'TREKKING POLE': 'Trekking pole', HAMMOCK: 'Hammock', 'RAIN COVER': 'Rain cover',
    CAPS: 'Topi', CAP: 'Topi', HAT: 'Topi rimba', HATS: 'Topi rimba', BEANIES: 'Kupluk', BEANIE: 'Kupluk', BALACLAVA: 'Balaclava', BUFF: 'Buff & masker',
    BELTS: 'Ikat pinggang', BELT: 'Ikat pinggang', WALLET: 'Dompet', WALLETS: 'Dompet', GLOVES: 'Sarung tangan', GLOVE: 'Sarung tangan',
    CASES: 'Case & tas kecil', 'MOTORCYCLE BAG': 'Tas motor', LUGGAGE: 'Koper', 'SPECIAL PURPOSE BAG': 'Tas khusus',
    'CHAIN ACCESSORIES': 'Gantungan & rantai', 'GADGET ACCESSORIES': 'Aksesoris gadget', 'BAGS ACCESSORIES': 'Aksesoris tas',
    'TRAVEL ACCESSORIES': 'Aksesoris travel', WATCHES: 'Jam tangan', JEWELRY: 'Gelang & perhiasan', BANDS: 'Gelang',
    KITCHENWARE: 'Alat masak', 'LIGHTING EQUIPMENT': 'Senter & lampu', 'MAT & COT': 'Matras & velbed', POLE: 'Trekking pole',
    'BAG COVER': 'Cover tas', 'CLIMBING EQUIPMENT': 'Alat panjat', COMPASS: 'Kompas', 'EMERGENCY EQUIPMENT': 'Perlengkapan darurat',
    KNIVES: 'Pisau lipat', 'RIDING EQUIPMENT': 'Perlengkapan riding', 'SANITARY EQUIPMENT': 'Perlengkapan mandi', 'SLEEPING ACCS': 'Aksesoris tidur',
    TABLE: 'Meja lipat', TOOLS: 'Peralatan', SHOELACE: 'Tali sepatu', BANDANA: 'Bandana', HIJAB: 'Hijab', SCARF: 'Syal',
    KEYCHAIN: 'Gantungan kunci', GAITER: 'Gaiter', SUNGLASSES: 'Kacamata', WATCH: 'Jam tangan', STRAP: 'Strap', MASK: 'Masker'
  };
  var WARNA = {
    BLK: ['Hitam', '#1E1E1E'], BLA: ['Hitam', '#1E1E1E'], WHT: ['Putih', '#F7F7F5'], OWH: ['Off white', '#EFEBE0'], CRM: ['Krem', '#EADFC6'],
    NAV: ['Navy', '#1F2A4A'], BLU: ['Biru', '#2E5C9A'], LBL: ['Biru muda', '#8DB5DA'], DBL: ['Biru tua', '#1D3466'], TEA: ['Teal', '#1F7A78'], TOS: ['Tosca', '#2AA198'],
    GRE: ['Hijau', '#3D7A4A'], GRN: ['Hijau', '#3D7A4A'], DGN: ['Hijau tua', '#27452F'], OLI: ['Olive', '#5B6236'], ARM: ['Army', '#4B5320'], MIN: ['Mint', '#A9DCC6'], LIM: ['Lime', '#B5CF3A'],
    GRY: ['Abu-abu', '#8A8F93'], LGR: ['Abu muda', '#C4C8CA'], DGR: ['Abu tua', '#4E5357'], CHA: ['Charcoal', '#3A3D40'], SIL: ['Silver', '#BFC3C7'],
    BRW: ['Cokelat', '#6B4A2E'], BRO: ['Cokelat', '#6B4A2E'], DBR: ['Cokelat tua', '#4A3020'], LBR: ['Cokelat muda', '#A07A55'], KHK: ['Khaki', '#B9A77A'], TAN: ['Tan', '#C19A6B'],
    SAN: ['Pasir', '#D2B98B'], BEI: ['Beige', '#D8C8A8'], MOC: ['Mocha', '#7B5B47'], CAM: ['Loreng', 'linear-gradient(135deg,#5B6236 0 33%,#8A7A4F 33% 66%,#3C4A2C 66%)'],
    RED: ['Merah', '#B8312F'], MAR: ['Maroon', '#6E1F2A'], ORA: ['Oranye', '#E0742B'], YEL: ['Kuning', '#E8C130'], MUS: ['Mustard', '#C9A13B'],
    PNK: ['Merah muda', '#E6A1B5'], PIN: ['Merah muda', '#E6A1B5'], PUR: ['Ungu', '#6A4C93'], LIL: ['Lilac', '#B7A3CF'], NOS: ['Satu warna', '#9AA39D'],
    CRE: ['Krem', '#EADFC6'], TER: ['Terracotta', '#B5583A'], TAU: ['Taupe', '#8B7D6B'], LGY: ['Abu muda', '#C4C8CA'], MGY: ['Abu-abu', '#8A8F93'],
    BGE: ['Beige', '#D8C8A8'], DKH: ['Khaki tua', '#8C7B4F'], DOL: ['Olive tua', '#454A28'], CYN: ['Cyan', '#2CB5C9'], TUR: ['Turquoise', '#30B5A8'],
    WNE: ['Wine', '#6B2232'], COF: ['Kopi', '#5A3D2B'], PEC: ['Peach', '#F2B595'], SGE: ['Sage', '#9CAF88'], MAG: ['Magenta', '#B5267A'],
    BRZ: ['Bronze', '#8C6239'], DEN: ['Denim', '#3E5C86'], DPU: ['Ungu tua', '#4B2E63'], DPI: ['Merah muda tua', '#C0577A'], LGE: ['Hijau muda', '#9CC59A']
  };


  /* ---------- util ---------- */
  function $(s) { return document.querySelector(s); }
  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'svg') e.innerHTML = v; // hanya ikon statis milik halaman ini
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) tambah(e, arguments[i]);
    return e;
  }
  function tambah(p, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { tambah(p, x); }); return; }
    p.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  function isiUlang(node) { node.textContent = ''; tambah(node, Array.prototype.slice.call(arguments, 1)); }
  function svg(path) { return el('span', { 'aria-hidden': 'true', style: 'display:contents', svg: '<svg viewBox="0 0 24 24">' + path + '</svg>' }); }
  var nf = new Intl.NumberFormat('id-ID');
  function rp(n) { return 'Rp' + nf.format(Math.round(n)); }
  function hargaEl(n, kelas) { return el('span', { class: 'harga' + (kelas ? ' ' + kelas : '') }, el('small', { text: 'Rp' }), nf.format(Math.round(n))); }
  function judul(s) { s = String(s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function namaTampil(s) {
    return String(s || '').trim().toLowerCase().replace(/(^|[\s\-(\/])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\bWs\b/g, 'WS').replace(/\b(\d+)l\b/gi, '$1L').replace(/\b(\d+)p\b/gi, '$1P');
  }
  function katNama(k3) { return (KAT[k3] && KAT[k3].nama) || judul(k3); }
  function subNama(k4) { return SUB[k4] || judul(k4); }
  function warnaInfo(kode) { return WARNA[kode] || [kode, '#B9C0BB']; }
  function genderNama(g) {
    g = String(g || '').toLowerCase();
    if (!g) return '';
    if (/kid|anak|child|junior|boy|girl/.test(g)) return 'Anak';
    if (/unisex/.test(g)) return 'Unisex';
    if (/wom|ladies|female|wanita/.test(g)) return 'Wanita';
    if (/\bmen\b|^men|male|pria/.test(g)) return 'Pria';
    return judul(g);
  }
  var toastT;
  function toast(t) {
    var x = $('.toast') || document.body.appendChild(el('div', { class: 'toast', role: 'status' }));
    x.textContent = t; x.classList.add('tampil');
    clearTimeout(toastT); toastT = setTimeout(function () { x.classList.remove('tampil'); }, 2600);
  }
  var BUL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function tglUpdate(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
    return m ? Number(m[3]) + ' ' + BUL[Number(m[2]) - 1] + (m[4] ? ', ' + m[4] + '.' + m[5] : '') : '';
  }
  function hariIni() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()); }
  function tambahHari(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function tglPendek(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? Number(p[2]) + ' ' + BUL[Number(p[1]) - 1] : ''; }
  function statusPromo(mulai, selesai) {
    var t = hariIni();
    if (mulai && mulai > t) return { teks: mulai === tambahHari(t, 1) ? 'Mulai besok' : 'Mulai ' + tglPendek(mulai), kelas: 'nanti' };
    if (selesai && selesai === t) return { teks: 'Berakhir hari ini', kelas: 'akhir' };
    if (selesai && selesai === tambahHari(t, 1)) return { teks: 'Berakhir besok', kelas: 'akhir' };
    return { teks: 'Berlaku s/d ' + tglPendek(selesai), kelas: '' };
  }
  /** Sisa waktu sampai akhir hari tanggal iso (WIB): [hari, jam, menit, detik]. */
  function sisa(iso) {
    var akhir = Date.parse(iso + 'T23:59:59+07:00'), d = Math.max(0, Math.floor((akhir - Date.now()) / 1000));
    return [Math.floor(d / 86400), Math.floor(d % 86400 / 3600), Math.floor(d % 3600 / 60), d % 60];
  }
  function dua(n) { return (n < 10 ? '0' : '') + n; }
  function waLink(teks) { return 'https://wa.me/' + (D && D.wa || '6281120022574') + '?text=' + encodeURIComponent(teks); }

  var IKON_JENIS = {
    EVENT: '<path d="M4 7h16v13H4Z"/><path d="M4 11h16M8 3v4M16 3v4"/><path d="m12 13.5 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3Z"/>',
    BANKING: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    EAC: '<circle cx="12" cy="9" r="5"/><path d="m9 13-2 8 5-3 5 3-2-8"/>',
    REGULER: '<path d="M3 12V4h8l10 10-8 8Z"/><circle cx="7.5" cy="8.5" r="1.5"/>'
  };
  var IKON_LOKASI = '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>';
  var IKON_WA = '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/>';
  var IKON_KEMBALI = '<path d="M15 5l-7 7 7 7"/>';

  /* ---------- keadaan ---------- */
  var D = null;
  var F = { k3: '', k4: '', q: '', gd: '', urut: 'pilihan', arah: 'naik', promo: false, baru: false };
  var tampil = PER_HALAMAN, hasil = [];

  function promoAktif() { return !!(D && D.promoSampai && D.promoSampai >= hariIni()); }
  function prItem(it) { return promoAktif() && it.pr ? it.pr : null; }
  function prWarna(w) { return promoAktif() && w[3] ? w[3] : null; }
  function fotoBersih(it) { return (it.f || []).filter(function (u) { return !/\/(thumbnail|small)\//.test(u); }); }
  function promoTokoAktif() { var t = hariIni(); return (D.promoToko || []).filter(function (p) { return !p.selesai || p.selesai >= t; }); }

  /* ---------- data ---------- */
  function ambil() {
    var lama = null;
    try { lama = JSON.parse(localStorage.getItem(SIMPAN) || 'null'); } catch (e) { lama = null; }
    if (lama && lama.items) { D = lama; mulai(); } else rangka();
    if (!CFG.API_URL) return;
    fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'katalog' }), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || 'Data tidak tersedia');
        var baru = JSON.stringify(res.data);
        try { localStorage.setItem(SIMPAN, baru); } catch (e) { /* penuh, abaikan */ }
        if (lama && JSON.stringify(lama) === baru) return;
        D = res.data; mulai();
      })
      .catch(function () { if (!D) gagal(); });
  }
  function rangka() {
    isiUlang($('#grid'), Array.from({ length: 12 }, function () {
      return el('div', { class: 'rangka', 'aria-hidden': 'true' }, el('div', { class: 'gb' }), el('div', { class: 'isi' }, el('i'), el('i', { style: 'width:60%' }), el('i', { style: 'width:40%' })));
    }));
  }
  function gagal() {
    isiUlang($('#grid'), el('div', { class: 'kosong' }, el('b', { text: 'Katalog belum bisa dimuat' }),
      el('p', { text: 'Periksa koneksi internet, lalu muat ulang. Anda tetap bisa bertanya langsung ke toko lewat WhatsApp.' }),
      el('button', { class: 'tombol', type: 'button', text: 'Muat ulang', onclick: function () { location.reload(); } })));
  }

  /* ---------- beranda ---------- */
  function mulai() {
    $('#update').textContent = D.diperbarui ? 'Stok per ' + tglUpdate(D.diperbarui) : '';
    gambarInfoToko();
    hitungDaftar();
    gambarBanner();
    gambarKategori();
    gambarStrip();
    saring();
    bukaDariHash();
  }

  var bannerTimer;
  function gambarBanner() {
    var slides = [];
    var nPromo = D.items.filter(prItem).length;
    var maxD = D.items.reduce(function (m, it) { var p = prItem(it); return p ? Math.max(m, p.d) : m; }, 0);
    if (nPromo) slides.push(el('button', { class: 'slide s-oranye', type: 'button', onclick: function () { pilihPromo(true); } },
      el('small', { text: 'PROMO NOVEMBER DI TOKO' }), el('b', { text: 'Diskon s/d ' + maxD + '%' }),
      el('span', { text: nPromo + ' artikel promo tersedia di toko, berlaku s/d ' + tglPendek(D.promoSampai) + '.' }), el('em', { text: 'Lihat barang promo' })));
    var warna = ['', 's-hijau', 's-ungu', ''];
    promoTokoAktif().filter(function (p) { return p.mulai <= hariIni(); }).slice(0, 4).forEach(function (p, i) {
      var st = statusPromo(p.mulai, p.selesai);
      slides.push(el('button', { class: 'slide ' + warna[i % warna.length], type: 'button', onclick: function () { bukaPromo(p); } },
        el('small', { text: String(p.jenis || 'Promo').toUpperCase() + ' · ' + st.teks.toUpperCase() }),
        el('b', { text: p.judul.replace(/^(Promo Banking|EAC|Promo)\s*:\s*/i, '') }),
        el('span', { text: (p.ket || p.syarat || '').split(/\s*•\s*/)[0] }), el('em', { text: 'Lihat syarat' })));
    });
    // banner kampanye resmi dari eigeradventure.com, diselipkan setelah slide promo pertama
    var kampanye = (D.banner || []).map(function (b) {
      return el('button', { class: 'slide s-foto', type: 'button', 'aria-label': b.n || 'Kampanye EIGER', onclick: function () { cariKampanye(b); } },
        el('picture', null, el('source', { media: '(min-width: 700px)', srcset: b.d }), el('img', { src: b.m, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' })),
        el('span', { class: 'slide-sumber', text: 'eigeradventure.com · harga & promo online bisa beda dengan toko' }));
    });
    slides.splice.apply(slides, [Math.min(1, slides.length), 0].concat(kampanye));
    $('#banner').classList.toggle('ada-foto', kampanye.length > 0);
    if (!slides.length) slides.push(el('div', { class: 'slide' }, el('small', { text: 'EIGER STORE A. YANI KARTASURA' }), el('b', { text: 'Siap jalan dari Kartasura' }),
      el('span', { text: 'Cek barang yang tersedia di toko, lalu tanya langsung lewat WhatsApp.' })));
    var rel = $('#bannerRel'), titik = $('#bannerTitik');
    isiUlang(rel, slides);
    isiUlang(titik, slides.length > 1 ? slides.map(function (_, i) { return el('i', { class: i ? '' : 'aktif' }); }) : null);
    var ke = 0;
    rel.onscroll = function () {
      var i = Math.round(rel.scrollLeft / rel.clientWidth);
      if (i !== ke) { ke = i; [].forEach.call(titik.children, function (t, j) { t.className = j === i ? 'aktif' : ''; }); }
    };
    clearInterval(bannerTimer);
    if (slides.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) bannerTimer = setInterval(function () {
      if (document.hidden || dlg.open) return;
      rel.scrollTo({ left: ((ke + 1) % slides.length) * rel.clientWidth, behavior: 'smooth' });
    }, 4500);
  }

  /** Ketuk banner kampanye → cari barang yang serupa di toko (bukan pindah ke toko online). */
  function cariKampanye(b) {
    var seg = String(b.u || '').split('/').filter(Boolean).pop() || b.n || '';
    var kata = seg.toLowerCase().replace(/[-_]+/g, ' ').replace(/\b(collection|koleksi|series|final|release|new|color|launch|for|your|first|the|and|full|banner|\d+[a-z]?)\b/g, ' ').replace(/\s+/g, ' ').trim();
    var coba = [kata, kata.split(' ')[0]].filter(Boolean);
    var pilih = coba.filter(function (q) { return D.items.some(function (it) { return cocokCari(it, q); }); })[0];
    if (!pilih) { toast('Barang kampanye ini belum ada di toko. Tanya lewat WhatsApp ya.'); return; }
    F = { k3: '', k4: '', q: pilih, gd: '', urut: 'pilihan', arah: 'naik', promo: false, baru: false };
    $('#q').value = pilih; tandaiTab(); gambarKategori(); saring(); scrollTo({ top: 0 });
  }

  function wakilFoto() {
    var w = {};
    D.items.forEach(function (it) {
      var f = fotoBersih(it)[0]; if (!f) return;
      var k = it.k3 + '|' + it.k4;
      if (!w[it.k3] || (it.b && !w[it.k3].b)) w[it.k3] = { f: f, b: it.b };
      if (!w[k]) w[k] = { f: f };
    });
    return w;
  }
  function ikonKat(teks, isiIkon, kelas, aktif, klik) {
    return el('button', { class: 'kat', type: 'button', 'aria-pressed': String(!!aktif), onclick: klik },
      el('span', { class: 'kat-ikon' + (kelas ? ' ' + kelas : '') }, isiIkon), el('span', { text: teks }));
  }
  function gambarKategori() {
    var W = wakilFoto(), hit3 = {}, hit4 = {};
    D.items.forEach(function (it) { hit3[it.k3] = (hit3[it.k3] || 0) + 1; var k = it.k3 + '|' + it.k4; hit4[k] = (hit4[k] || 0) + 1; });
    var k3s = Object.keys(hit3).sort(function (a, b) { return ((KAT[a] || {}).urut || 9) - ((KAT[b] || {}).urut || 9); });
    var maxD = D.items.reduce(function (m, it) { var p = prItem(it); return p ? Math.max(m, p.d) : m; }, 0);
    var isi = [];
    if (maxD) isi.push(ikonKat('Barang promo', maxD + '%', 'promo', F.promo, function () { pilihPromo(!F.promo); }));
    isi.push(ikonKat('Baru di toko', svg('<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7Z"/>'), 'semua', F.baru, function () { F.baru = !F.baru; gulirKeDaftar(); saring(); gambarKategori(); }));
    k3s.forEach(function (k) {
      isi.push(ikonKat(katNama(k), W[k] ? el('img', { src: W[k].f, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : svg((KAT[k] || {}).ikon || IKON_SEMUA), '', F.k3 === k && !F.k4,
        function () { pilihKat(k, ''); }));
    });
    // sub-kategori terbanyak ikut tampil sebagai ikon, seperti marketplace
    Object.keys(hit4).filter(function (k) { var p = k.split('|'); return subNama(p[1]) !== katNama(p[0]); }).sort(function (a, b) { return hit4[b] - hit4[a]; }).slice(0, 12).forEach(function (k) {
      var p = k.split('|');
      isi.push(ikonKat(subNama(p[1]), W[k] ? el('img', { src: W[k].f, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : svg((KAT[p[0]] || {}).ikon || IKON_SEMUA), '', F.k3 === p[0] && F.k4 === p[1],
        function () { pilihKat(p[0], p[1]); }));
    });
    isiUlang($('#kategori'), isi);
  }
  function pilihKat(k3, k4) {
    var sama = F.k3 === k3 && F.k4 === k4;
    F.k3 = sama ? '' : k3; F.k4 = sama ? '' : k4;
    gambarKategori(); saring(); gulirKeDaftar();
  }
  function pilihPromo(on) {
    F.promo = on; if (on) { F.urut = 'diskon'; tandaiTab(); }
    gambarKategori(); saring(); gulirKeDaftar();
  }
  function gulirKeDaftar() {
    var d = $('#daftar'), y = d.getBoundingClientRect().top + scrollY - $('#atas').offsetHeight;
    if (Math.abs(scrollY - y) > 4) scrollTo({ top: y, behavior: 'smooth' });
  }

  var stripTimer;
  function gambarStrip() {
    var xs = D.items.filter(function (it) { return prItem(it) && fotoBersih(it).length; })
      .sort(function (a, b) { return prItem(b).d - prItem(a).d; }).slice(0, 18);
    $('#stripPromo').hidden = !xs.length;
    isiUlang($('#stripRel'), xs.map(function (it) {
      var p = prItem(it);
      return el('button', { class: 'mini', type: 'button', onclick: function () { buka(it); } },
        el('div', { class: 'gb' }, el('img', { src: fotoBersih(it)[0], alt: namaTampil(it.n), loading: 'lazy', referrerpolicy: 'no-referrer' }), labelDiskon(p.d)),
        hargaEl(p.n), el('span', { class: 'label-hemat', text: 'Hemat ' + p.d + '%' }));
    }));
    clearInterval(stripTimer);
    if (!xs.length || !D.promoSampai) return;
    var jam = function () {
      var s = sisa(D.promoSampai), box = $('#hitungMundur');
      isiUlang(box, s[0] ? [el('b', { text: s[0] }), 'hari'] : null, el('b', { text: dua(s[1]) }), ':', el('b', { text: dua(s[2]) }), ':', el('b', { text: dua(s[3]) }));
    };
    jam(); stripTimer = setInterval(jam, 1000);
  }
  $('#stripSemua').addEventListener('click', function () { pilihPromo(true); });

  /* ---------- daftar produk ---------- */
  function cocokCari(it, q) {
    if (!q) return true;
    var teks = (it.n + ' ' + it.g + ' ' + katNama(it.k3) + ' ' + subNama(it.k4) + ' ' + it.k4 + ' ' + it.ac + ' ' + genderNama(it.gd) + ' ' +
      it.w.map(function (w) { return warnaInfo(w[0])[0]; }).join(' ')).toLowerCase();
    return q.split(/\s+/).every(function (k) { return teks.indexOf(k) >= 0; });
  }
  function gambarSaring() {
    var chips = [];
    if (F.promo) chips.push(el('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', text: 'Barang promo ✕', onclick: function () { pilihPromo(false); } }));
    if (F.baru) chips.push(el('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', text: 'Baru di toko ✕', onclick: function () { F.baru = false; gambarKategori(); saring(); } }));
    if (F.k3) chips.push(el('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', text: (F.k4 ? subNama(F.k4) : katNama(F.k3)) + ' ✕', onclick: function () { F.k3 = ''; F.k4 = ''; gambarKategori(); saring(); } }));
    var gds = {};
    D.items.forEach(function (it) { var g = genderNama(it.gd); if (g) gds[g] = 1; });
    ['Pria', 'Wanita', 'Unisex', 'Anak'].filter(function (g) { return gds[g]; }).forEach(function (g) {
      chips.push(el('button', { class: 'chip', type: 'button', 'aria-pressed': String(F.gd === g), text: g, onclick: function () { F.gd = F.gd === g ? '' : g; saring(); } }));
    });
    if (F.k3 && !F.k4) {
      var hit = {};
      D.items.forEach(function (it) { if (it.k3 === F.k3 && it.k4) hit[it.k4] = (hit[it.k4] || 0) + 1; });
      Object.keys(hit).sort(function (a, b) { return hit[b] - hit[a]; }).forEach(function (k) {
        chips.push(el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', text: subNama(k), onclick: function () { F.k4 = k; gambarKategori(); saring(); } }));
      });
    }
    isiUlang($('#saring'), chips);
  }
  function saring() {
    var q = F.q.trim().toLowerCase();
    var menyaring = !!(q || F.k3 || F.promo || F.baru || F.gd);
    $('#beranda').hidden = !!(q || F.k3 || F.promo || F.baru);
    $('#judulDaftar').textContent = q ? 'Hasil pencarian "' + F.q.trim() + '"' : F.promo ? 'Barang promo' : F.baru ? 'Baru di toko' : F.k3 ? (F.k4 ? subNama(F.k4) : katNama(F.k3)) : 'Rekomendasi untukmu';
    hasil = D.items.filter(function (it) {
      return (!F.k3 || it.k3 === F.k3) && (!F.k4 || it.k4 === F.k4) && (!F.gd || genderNama(it.gd) === F.gd) && (!F.promo || prItem(it)) && (!F.baru || it.b) && cocokCari(it, q);
    });
    var h = function (it) { var p = prItem(it); return p ? p.n : (it.hm || it.h || 0); };
    var dk = function (it) { var p = prItem(it); return p ? p.d : 0; };
    var ada = function (it) { return fotoBersih(it).length ? 1 : 0; };
    var urut = {
      pilihan: function (a, b) { return (ada(b) - ada(a)) || ((dk(b) ? 1 : 0) - (dk(a) ? 1 : 0)) || (b.b - a.b) || (a.n < b.n ? -1 : 1); },
      baru: function (a, b) { return (b.b - a.b) || (ada(b) - ada(a)) || (a.n < b.n ? -1 : 1); },
      diskon: function (a, b) { return (dk(b) - dk(a)) || (ada(b) - ada(a)) || (a.n < b.n ? -1 : 1); },
      harga: function (a, b) { var x = h(a) || 9e9, y = h(b) || 9e9; return F.arah === 'naik' ? x - y : (h(b) || 0) - (h(a) || 0); }
    }[F.urut];
    hasil.sort(urut);
    tampil = PER_HALAMAN;
    gambarSaring();
    $('#hitung').textContent = menyaring ? hasil.length + ' produk' : '';
    gambarGrid();
  }
  function labelDiskon(d) { return el('span', { class: 'label-diskon' }, d + '%', el('small', { text: 'OFF' })); }
  function kartu(it) {
    var pr = prItem(it), foto = fotoBersih(it)[0];
    var gb = el('div', { class: 'gb' });
    var ganti = function () { isiUlang(gb, el('div', { class: 'tanpa-foto' }, svg((KAT[it.k3] || {}).ikon || IKON_SEMUA), el('b', { text: namaTampil(it.n) }))); tandai(); };
    var tandai = function () { if (pr) gb.append(labelDiskon(pr.d)); if (it.b) gb.append(el('span', { class: 'label-baru', text: 'Baru' })); };
    if (foto) { var img = el('img', { src: foto, alt: namaTampil(it.n), loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' }); img.addEventListener('error', ganti); gb.append(img); tandai(); }
    else ganti();
    var harga = pr ? [hargaEl(pr.n), pr.h > pr.n ? el('span', { class: 'coret', text: rp(pr.h) }) : null]
      : it.h ? [hargaEl(it.hm || it.h)] : [el('span', { class: 'harga tanya', text: 'Tanya harga' })];
    return el('button', { class: 'kartu', type: 'button', onclick: function () { buka(it); } }, gb,
      el('div', { class: 'isi' },
        el('h3', { class: 'nama', text: namaTampil(it.n) }),
        pr ? el('span', { class: 'tag-promo', text: 'Promo s/d ' + tglPendek(D.promoSampai) }) : null,
        el('div', { class: 'baris-harga' }, harga),
        el('div', { class: 'lokasi' }, el('span', null, it.w.length + ' warna'), el('span', null, svg(IKON_LOKASI), 'Kartasura'))));
  }
  function gambarGrid() {
    var g = $('#grid');
    if (!hasil.length) {
      isiUlang(g, el('div', { class: 'kosong' }, el('b', { text: F.q ? 'Produk "' + F.q.trim() + '" tidak ditemukan' : 'Belum ada barang di pilihan ini' }),
        el('p', { text: 'Coba kata lain atau kategori lain. Barang yang dicari mungkin bisa dipesan, tanyakan saja ke toko.' }),
        el('a', { class: 'tombol', href: waLink('Halo EIGER Kartasura, saya mencari ' + (F.q.trim() || 'barang') + '. Apakah ada di toko?'), target: '_blank', rel: 'noopener', text: 'Tanya ke toko' })));
      isiUlang($('#lagi'));
      return;
    }
    isiUlang(g, hasil.slice(0, tampil).map(kartu));
    var s = hasil.length - tampil;
    isiUlang($('#lagi'), s > 0 ? el('button', { class: 'tombol garis', type: 'button', text: 'Lihat lainnya', onclick: function () { tampil += PER_HALAMAN; gambarGrid(); } }) : null);
  }

  /* tab urutan */
  function tandaiTab() {
    [].forEach.call($('#tabUrut').children, function (b) {
      var u = b.getAttribute('data-u');
      b.setAttribute('aria-selected', String(u === F.urut));
      if (u === 'harga') b.className = 'tab-harga' + (F.urut === 'harga' ? (F.arah === 'naik' ? ' naik' : ' turun') : '');
    });
  }
  $('#tabUrut').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !D) return;
    var u = b.getAttribute('data-u');
    if (u === 'harga') F.arah = F.urut === 'harga' && F.arah === 'naik' ? 'turun' : 'naik';
    F.urut = u; tandaiTab(); saring();
  });

  /* ---------- lembar: detail produk ---------- */
  var dlg = $('#lembar');
  function bukaLembar(isi, sempit, tetapGulir) {
    var y = $('#lembarIsi').scrollTop;
    dlg.className = 'lembar' + (sempit ? ' sempit' : '');
    isiUlang($('#lembarIsi'), isi);
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    $('#lembarIsi').scrollTop = tetapGulir ? y : 0;
  }
  function kepalaLembar(teks) {
    return el('div', { class: 'lembar-atas' }, el('button', { class: 'kembali', type: 'button', 'aria-label': 'Kembali', onclick: tutup }, svg(IKON_KEMBALI)), el('b', { text: teks }));
  }
  var detailTimer;
  function buka(it, dariHash) {
    var wi = Math.max(0, it.w.findIndex(function (w) { return prWarna(w); })), uk = '', fi = 0;
    var tersedia = function (w) { return w[1].filter(function (u) { return u[1]; }); };
    var t0 = tersedia(it.w[wi]); if (t0.length === 1) uk = t0[0][0];
    var fotos = fotoBersih(it);
    var sudah = false;
    function gambar() {
      var ulang = sudah; sudah = true;
      var w = it.w[wi], wi2 = warnaInfo(w[0]), pw = prWarna(w);
      var satuUkuran = w[1].length === 1 && w[1][0][0] === 'NOS';
      var pilihU = w[1].filter(function (u) { return u[0] === uk; })[0];
      var kosong = !!(pilihU && !pilihU[1]);
      var hargaNormal = w[2] || it.h;
      var teks = 'Halo EIGER Kartasura, saya mau tanya ' + namaTampil(it.n) + ' (kode ' + it.g + '), warna ' + wi2[0].toLowerCase() +
        (uk && uk !== 'NOS' ? ', ukuran ' + uk : '') + (pw ? ', harga promo ' + rp(pw[1]) : '') + '. Apakah masih tersedia di toko?';
      var galeri = el('div', { class: 'galeri' },
        el('div', { class: 'galeri-utama' }, fotos.length ? fotos.map(function (f, i) {
          return el('div', null, el('img', { src: f, alt: namaTampil(it.n) + ' foto ' + (i + 1), loading: i ? 'lazy' : 'eager', referrerpolicy: 'no-referrer' }));
        }) : el('div', null, el('div', { class: 'tanpa-foto' }, svg((KAT[it.k3] || {}).ikon || IKON_SEMUA), el('b', { text: namaTampil(it.n) })))),
        fotos.length > 1 ? el('span', { class: 'galeri-no', text: (fi + 1) + '/' + fotos.length }) : null,
        fotos.length > 1 ? el('div', { class: 'galeri-mini' }, fotos.map(function (f, i) {
          return el('button', { type: 'button', 'aria-label': 'Foto ' + (i + 1), 'aria-pressed': String(i === fi), onclick: function () { fi = i; var g = $('.galeri-utama'); g.scrollTo({ left: i * g.clientWidth, behavior: 'smooth' }); } },
            el('img', { src: f, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }));
        })) : null);
      var hm = el('span', { class: 'hm' });
      var blokHarga = el('div', { class: 'blok blok-harga' },
        el('div', { class: 'harga-besar' }, pw ? [hargaEl(pw[1]), pw[2] > pw[1] ? el('span', { class: 'coret', text: rp(pw[2]) }) : null, el('span', { class: 'persen', text: pw[0] + '% OFF' })]
          : hargaNormal ? hargaEl(hargaNormal) : el('span', { class: 'harga tanya', text: 'Tanya harga di toko' })),
        pw ? el('div', { class: 'pita-promo' }, el('span', { text: '⚡ PROMO TOKO · ' + statusPromo('', D.promoSampai).teks }), hm) : null);
      var promoUmum = promoTokoAktif().filter(function (p) { return p.mulai <= hariIni() && /non promo|all item/i.test(p.produk || '') ; });
      bukaLembar([kepalaLembar('Detail produk'),
        el('div', { class: 'produk' }, galeri,
          el('div', { class: 'info' },
            el('div', { class: 'blok blok-nama' }, el('h1', { text: namaTampil(it.n) }),
              el('div', { class: 'sub', text: katNama(it.k3) + ' › ' + subNama(it.k4) + (genderNama(it.gd) ? ' · ' + genderNama(it.gd) : '') + ' · Kode ' + it.g })),
            blokHarga,
            el('div', { class: 'blok' }, el('h3', null, 'Warna: ', el('span', { text: wi2[0] })),
              el('div', { class: 'pilihan' }, it.w.map(function (x, i) {
                return el('button', { type: 'button', 'aria-pressed': String(i === wi), onclick: function () {
                  wi = i; var t = tersedia(it.w[i]); uk = t.length === 1 ? t[0][0] : (t.some(function (u) { return u[0] === uk; }) ? uk : ''); gambar();
                } }, el('i', { style: 'background:' + warnaInfo(x[0])[1] }), warnaInfo(x[0])[0], prWarna(x) ? el('em', { text: '-' + prWarna(x)[0] + '%' }) : null);
              }))),
            satuUkuran ? null : el('div', { class: 'blok' }, el('div', { class: 'blok-kepala' }, el('h3', null, 'Ukuran: ', el('span', { text: uk ? uk + (kosong ? ' (kosong)' : '') : 'pilih ukuran' })),
                it.sg != null && D.panduan && D.panduan[it.sg] ? el('button', { class: 'sk', type: 'button', text: 'Panduan ukuran ›', onclick: function () { bukaPanduan(it); } }) : null),
              el('div', { class: 'pilihan' }, w[1].map(function (u) {
                return el('button', { type: 'button', class: u[1] ? '' : 'kosong', 'aria-pressed': String(uk === u[0]), 'aria-label': u[0] + (u[1] ? '' : ', kosong'),
                  text: u[0] === 'NOS' ? 'All size' : u[0], onclick: function () { uk = u[0]; gambar(); } });
              })),
              kosong ? formKabari(it, w[0], uk) : el('p', { class: 'ket', text: 'Ukuran bergaris putus-putus sedang kosong di toko. Pilih untuk minta dikabari saat tersedia.' })),
            !pw && promoUmum.length ? el('div', { class: 'blok' }, el('h3', { text: 'Promo yang bisa dipakai' }),
              el('div', { class: 'promo-berlaku' }, promoUmum.slice(0, 4).map(function (p) {
                return el('div', { class: 'voucher-kecil' }, el('b', { text: p.jenis || 'Promo' }), el('span', { text: p.judul }));
              }), el('button', { class: 'sk', type: 'button', style: 'align-self:flex-start', text: 'Lihat semua promo ›', onclick: bukaDaftarPromo }))) : null,
            el('div', { class: 'blok' }, el('h3', { text: 'Spesifikasi' }),
              el('dl', { class: 'detail-baris' }, el('dt', { text: 'Kategori' }), el('dd', { text: katNama(it.k3) + ' › ' + subNama(it.k4) }),
                it.ac ? [el('dt', { text: 'Aktivitas' }), el('dd', { text: judul(it.ac) })] : null,
                genderNama(it.gd) ? [el('dt', { text: 'Untuk' }), el('dd', { text: genderNama(it.gd) })] : null,
                el('dt', { text: 'Kode artikel' }), el('dd', { text: it.g }),
                el('dt', { text: 'Lokasi' }), el('dd', { text: 'EIGER Store A. Yani Kartasura' }))),
            blokSerupa(it),
            el('p', { class: 'aman-kecil' }, svg(IKON_PERISAI), 'Pembayaran hanya di kasir toko. Kami tidak pernah meminta transfer ke rekening pribadi.'),
            el('div', { class: 'bar-beli' },
              el('button', { class: 'bagikan', type: 'button', onclick: function () {
                var url = location.href.split('#')[0] + '#artikel-' + it.g;
                if (navigator.share) navigator.share({ title: namaTampil(it.n), url: url }).catch(function () {});
                else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('Link disalin'); }, function () { toast(url); });
              } }, svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'), 'Bagikan'),
              el('button', { class: 'chat tambah', type: 'button', onclick: function () {
                if (!satuUkuran && !uk) { toast('Pilih ukuran dulu'); return; }
                tambahDaftar(it, w[0], satuUkuran ? 'NOS' : uk);
              } }, svg(IKON_DAFTAR_TAMBAH), 'Daftar'),
              kosong ? el('button', { class: 'tanya', type: 'button', text: 'Kabari saya saat tersedia', onclick: function () { var f = $('.form-kabari input'); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.focus(); } } })
                : el('a', { class: 'tanya', href: waLink(teks), target: '_blank', rel: 'noopener', text: uk || satuUkuran ? 'Tanya Stok via WhatsApp' : 'Tanya Ketersediaan', onclick: function () { catat(it.g, 't'); } }))))
      ], false, ulang);
      var g = $('.galeri-utama');
      if (g) {
        if (fi) g.scrollLeft = fi * g.clientWidth;
        g.onscroll = function () {
          var i = Math.round(g.scrollLeft / g.clientWidth); if (i === fi) return; fi = i;
          var no = $('.galeri-no'); if (no) no.textContent = (i + 1) + '/' + fotos.length;
          [].forEach.call(document.querySelectorAll('.galeri-mini button'), function (b, j) { b.setAttribute('aria-pressed', String(j === i)); });
        };
      }
      clearInterval(detailTimer);
      if (pw) { var jalan = function () { var s = sisa(D.promoSampai); isiUlang(hm, 'Sisa ', s[0] ? [el('b', { text: s[0] + 'h' })] : null, el('b', { text: dua(s[1]) }), ':', el('b', { text: dua(s[2]) }), ':', el('b', { text: dua(s[3]) })); }; jalan(); detailTimer = setInterval(jalan, 1000); }
    }
    gambar();
    catat(it.g, 'l');
    if (!dariHash && location.hash !== '#artikel-' + it.g) history.pushState(null, '', '#artikel-' + it.g);
  }

  /* ---------- lembar: daftar promo (voucher) ---------- */
  function voucher(p, buka1) {
    var j = String(p.jenis || 'REGULER').toUpperCase(), st = statusPromo(p.mulai, p.selesai);
    var ket = (p.ket || '').split(/\s*•\s*/).filter(Boolean);
    var detail = ket.length ? el('ul', { class: 'voucher-ket', hidden: !buka1 }, ket.map(function (k) { return el('li', { text: k }); }),
      p.produk ? el('li', { text: 'Berlaku untuk: ' + p.produk.replace(/\s*\((list|exc)[^)]*\)/gi, '') }) : null) : null;
    return el('article', { class: 'voucher ' + j.toLowerCase() },
      el('div', { class: 'voucher-kiri' }, svg(IKON_JENIS[j] || IKON_JENIS.REGULER), { EAC: 'EAC', BANKING: 'Banking', EVENT: 'Event' }[j] || 'Promo'),
      el('div', { class: 'voucher-kanan' }, el('b', { text: p.judul }),
        p.syarat ? el('span', { class: 'syarat', text: p.syarat }) : null,
        el('div', { class: 'voucher-bawah' }, el('span', { class: 'status ' + st.kelas, text: st.teks }),
          detail ? el('button', { class: 'sk', type: 'button', text: 'S&K', onclick: function () { detail.hidden = !detail.hidden; } }) : null)),
      detail);
  }
  function bukaDaftarPromo() {
    var xs = promoTokoAktif();
    var nPromo = D.items.filter(prItem).length;
    bukaLembar([kepalaLembar('Promo di toko'),
      el('div', { class: 'voucher-daftar' },
        nPromo ? el('button', { class: 'slide s-oranye', type: 'button', style: 'min-height:0;border-radius:3px;padding:16px', onclick: function () { tutup(); pilihPromo(true); } },
          el('b', { style: 'font-size:18px', text: nPromo + ' barang harga promo' }), el('span', { text: 'Berlaku s/d ' + tglPendek(D.promoSampai) + '. Ketuk untuk melihat.' })) : null,
        xs.length ? xs.map(function (p) { return voucher(p); }) : el('div', { class: 'kosong' }, el('b', { text: 'Belum ada promo toko' })))], true);
    if (location.hash !== '#promo') history.pushState(null, '', '#promo');
  }
  function bukaPromo(p) {
    bukaLembar([kepalaLembar('Syarat promo'), el('div', { class: 'voucher-daftar' }, voucher(p, true),
      el('button', { class: 'tombol garis', type: 'button', text: 'Lihat semua promo', onclick: bukaDaftarPromo }))], true);
    if (location.hash !== '#promo') history.pushState(null, '', '#promo');
  }

  /* ---------- lembar: semua kategori ---------- */
  function bukaKategori() {
    var W = wakilFoto(), per = {};
    D.items.forEach(function (it) { (per[it.k3] = per[it.k3] || {})[it.k4] = ((per[it.k3] || {})[it.k4] || 0) + 1; });
    var k3s = Object.keys(per).sort(function (a, b) { return ((KAT[a] || {}).urut || 9) - ((KAT[b] || {}).urut || 9); });
    bukaLembar([kepalaLembar('Kategori'), k3s.map(function (k3) {
      return [el('h3', { class: 'sub-judul', text: katNama(k3) }),
        el('div', { class: 'kategori-lembar' }, ikonKat('Semua', svg((KAT[k3] || {}).ikon || IKON_SEMUA), 'semua', false, function () { tutup(); pilihKat(k3, ''); }),
          Object.keys(per[k3]).sort(function (a, b) { return per[k3][b] - per[k3][a]; }).map(function (k4) {
            var w = W[k3 + '|' + k4];
            return ikonKat(subNama(k4), w ? el('img', { src: w.f, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : svg((KAT[k3] || {}).ikon || IKON_SEMUA), '', false, function () { tutup(); F.k3 = ''; pilihKat(k3, k4); });
          }))];
    })], true);
    if (location.hash !== '#kategori') history.pushState(null, '', '#kategori');
  }

  function tutup() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', function () {
    clearInterval(detailTimer);
    if (/^#(artikel-|promo|kategori|daftar)/.test(location.hash)) history.pushState(null, '', location.pathname + location.search);
    tandaiMenu('beranda');
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) tutup(); });
  function bukaDariHash() {
    if (!D) return;
    var h = location.hash, m = h.match(/^#artikel-(\d{9})$/);
    if (m) { var it = D.items.filter(function (x) { return x.g === m[1]; })[0]; if (it) buka(it, true); else toast('Barang ini sedang tidak tersedia di toko'); return; }
    if (h === '#promo') { bukaDaftarPromo(); return; }
    if (h === '#kategori') { bukaKategori(); return; }
    if (h === '#daftar') { bukaDaftar(); return; }
    if (dlg.open) dlg.close();
  }
  window.addEventListener('popstate', bukaDariHash);


  /* ================= fitur tambahan ================= */
  var IKON_PERISAI = '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6Z"/><path d="m9 12 2 2 4-4"/>';
  var IKON_DAFTAR = '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>';
  var IKON_DAFTAR_TAMBAH = '<path d="M4 6h10M4 12h10M4 18h7"/><path d="M18 14v6M15 17h6"/>';
  var IKON_JAM = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
  var SITUS_RESMI = 'eigerkartasura.github.io';

  /* ---- jejak anonim: artikel dibuka / ditanya (untuk statistik toko, tanpa data pribadi) ---- */
  var antreCatat = [], sudahLihat = {}, catatT;
  function catat(g, jenis) {
    if (jenis === 'l') { if (sudahLihat[g]) return; sudahLihat[g] = 1; }
    antreCatat.push([g, jenis]);
    clearTimeout(catatT); catatT = setTimeout(kirimCatat, 4000);
  }
  function kirimCatat() {
    if (!antreCatat.length || !CFG.API_URL) return;
    var e = antreCatat.splice(0, 25);
    try { fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'katalogCatat', e: e }), keepalive: true, mode: 'no-cors' }).catch(function () {}); } catch (x) { /* abaikan */ }
    if (antreCatat.length) catatT = setTimeout(kirimCatat, 1000);
  }
  addEventListener('pagehide', kirimCatat);
  document.addEventListener('visibilitychange', function () { if (document.hidden) kirimCatat(); });
  try { if (/[?&]dari=qr\b/.test(location.search)) { antreCatat.push(['qr', 's']); catatT = setTimeout(kirimCatat, 1500); history.replaceState(null, '', location.pathname + location.hash); } } catch (x) { /* abaikan */ }

  /* ---- daftar tanya: beberapa barang sekaligus dalam satu pesan WhatsApp ---- */
  var KUNCI_DAFTAR = 'katalog2299.daftar';
  function bacaDaftar() { try { var x = JSON.parse(localStorage.getItem(KUNCI_DAFTAR) || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } }
  function simpanDaftar(x) { try { localStorage.setItem(KUNCI_DAFTAR, JSON.stringify(x.slice(0, 30))); } catch (e) { /* penuh */ } hitungDaftar(); }
  function hitungDaftar() {
    var n = bacaDaftar().length;
    [].forEach.call(document.querySelectorAll('.lencana-daftar'), function (b) { b.textContent = n > 9 ? '9+' : String(n); b.hidden = !n; });
  }
  function tambahDaftar(it, warna, uk) {
    var x = bacaDaftar();
    if (x.some(function (d) { return d.g === it.g && d.w === warna && d.u === uk; })) { toast('Sudah ada di daftar'); return; }
    x.push({ g: it.g, w: warna, u: uk });
    simpanDaftar(x);
    toast('Ditambahkan ke daftar tanya (' + x.length + ')');
  }
  function bukaDaftar() {
    var x = bacaDaftar(), G = {};
    D.items.forEach(function (it) { G[it.g] = it; });
    var baris = x.map(function (d, i) {
      var it = G[d.g], w = it && it.w.filter(function (y) { return y[0] === d.w; })[0];
      var u = w && w[1].filter(function (y) { return y[0] === d.u; })[0];
      var pw = w && prWarna(w), harga = pw ? pw[1] : (w && w[2]) || (it && it.h) || 0;
      return { d: d, i: i, it: it, ada: !!(u && u[1]), harga: harga, promo: !!pw };
    });
    function teks() {
      var t = 'Halo EIGER Kartasura, saya mau tanya ketersediaan barang berikut:\n';
      baris.forEach(function (b, k) {
        t += '\n' + (k + 1) + '. ' + (b.it ? namaTampil(b.it.n) : 'Kode ' + b.d.g) + ' (kode ' + b.d.g + ')\n   Warna ' + warnaInfo(b.d.w)[0].toLowerCase() +
          (b.d.u && b.d.u !== 'NOS' ? ', ukuran ' + b.d.u : '') + (b.harga ? ', ' + rp(b.harga) + (b.promo ? ' (promo)' : '') : '');
      });
      return t + '\n\nTerima kasih.';
    }
    bukaLembar([kepalaLembar('Daftar tanya'),
      el('div', { class: 'daftar-isi' },
        baris.length ? [
          el('p', { class: 'ket', text: 'Kumpulkan barang yang ingin ditanyakan, lalu kirim sekaligus dalam satu pesan WhatsApp ke toko. Daftar ini hanya tersimpan di HP Anda.' }),
          baris.map(function (b) {
            var f = b.it && fotoBersih(b.it)[0];
            return el('div', { class: 'baris-daftar' },
              el('button', { class: 'gb-kecil', type: 'button', 'aria-label': 'Buka ' + (b.it ? namaTampil(b.it.n) : b.d.g), onclick: function () { if (b.it) buka(b.it); } },
                f ? el('img', { src: f, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : svg(IKON_SEMUA)),
              el('div', { class: 'baris-daftar-isi' },
                el('b', { text: b.it ? namaTampil(b.it.n) : 'Kode ' + b.d.g }),
                el('span', { text: warnaInfo(b.d.w)[0] + (b.d.u && b.d.u !== 'NOS' ? ' · ' + b.d.u : '') }),
                b.it ? el('span', { class: b.ada ? 'ok' : 'habis', text: b.ada ? (b.harga ? rp(b.harga) + (b.promo ? ' · promo' : '') : 'Tersedia') : 'Ukuran ini sedang kosong' })
                  : el('span', { class: 'habis', text: 'Sudah tidak ada di toko' })),
              el('button', { class: 'hapus-daftar', type: 'button', 'aria-label': 'Hapus dari daftar', text: '×', onclick: function () {
                var y = bacaDaftar(); y.splice(b.i, 1); simpanDaftar(y); bukaDaftar();
              } }));
          }),
          el('div', { class: 'daftar-aksi' },
            el('button', { class: 'tombol garis', type: 'button', text: 'Kosongkan', onclick: function () { simpanDaftar([]); bukaDaftar(); } }),
            el('a', { class: 'tombol', href: waLink(teks()), target: '_blank', rel: 'noopener', onclick: function () { baris.forEach(function (b) { catat(b.d.g, 't'); }); } }, svg(IKON_WA), 'Kirim ' + baris.length + ' barang ke WhatsApp'))
        ] : el('div', { class: 'kosong' }, el('b', { text: 'Daftar tanya masih kosong' }),
          el('p', { text: 'Buka barang, pilih warna dan ukuran, lalu ketuk "Daftar". Setelah terkumpul, kirim semuanya sekaligus ke WhatsApp toko.' }),
          el('button', { class: 'tombol', type: 'button', text: 'Lihat barang', onclick: tutup })))], true);
    if (location.hash !== '#daftar') history.pushState(null, '', '#daftar');
  }

  /* ---- kabari saya: ukuran kosong → pelanggan meninggalkan nama & nomor WhatsApp ---- */
  function formKabari(it, warna, uk) {
    var pesan = el('p', { class: 'kabari-pesan', role: 'status' });
    var nama = el('input', { type: 'text', name: 'nama', autocomplete: 'name', maxlength: '40', placeholder: 'Nama Anda', required: true, 'aria-label': 'Nama' });
    var wa = el('input', { type: 'tel', name: 'wa', autocomplete: 'tel', inputmode: 'tel', maxlength: '16', placeholder: '0812xxxxxxxx', required: true, 'aria-label': 'Nomor WhatsApp' });
    var jebakan = el('input', { type: 'text', name: 'situs', tabindex: '-1', autocomplete: 'off', class: 'jebakan', 'aria-hidden': 'true' });
    try { var lama = JSON.parse(localStorage.getItem('katalog2299.kontak') || 'null'); if (lama) { nama.value = lama.nama || ''; wa.value = lama.wa || ''; } } catch (e) { /* abaikan */ }
    var kirim = el('button', { class: 'tombol', type: 'submit', text: 'Kabari saya' });
    return el('form', { class: 'form-kabari', onsubmit: function (e) {
      e.preventDefault();
      pesan.className = 'kabari-pesan'; pesan.textContent = '';
      if (nama.value.trim().length < 2) { pesan.className = 'kabari-pesan salah'; pesan.textContent = 'Isi nama Anda.'; nama.focus(); return; }
      if (!/^(\+?62|0)8\d{8,12}$/.test(wa.value.replace(/[\s-]/g, ''))) { pesan.className = 'kabari-pesan salah'; pesan.textContent = 'Nomor WhatsApp tidak valid. Contoh: 0812xxxxxxxx'; wa.focus(); return; }
      kirim.disabled = true; kirim.textContent = 'Mengirim…';
      fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'katalogTunggu', nama: nama.value, wa: wa.value, g: it.g, warna: warna, ukuran: uk, situs: jebakan.value }), redirect: 'follow' })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          if (!r.ok) throw new Error(r.error || 'Gagal mengirim');
          try { localStorage.setItem('katalog2299.kontak', JSON.stringify({ nama: nama.value.trim(), wa: wa.value.trim() })); } catch (e) { /* abaikan */ }
          pesan.className = 'kabari-pesan ok';
          pesan.textContent = r.data && r.data.sudah ? 'Anda sudah terdaftar untuk ukuran ini. Kami kabari lewat WhatsApp saat tersedia.' : 'Terima kasih. Tim toko akan mengabari lewat WhatsApp saat ukuran ' + uk + ' tersedia.';
          kirim.textContent = 'Terdaftar';
        })
        .catch(function (x) { pesan.className = 'kabari-pesan salah'; pesan.textContent = x.message; kirim.disabled = false; kirim.textContent = 'Kabari saya'; });
    } },
      el('b', { text: 'Ukuran ' + uk + ' sedang kosong' }),
      el('span', { text: 'Tinggalkan nama dan nomor WhatsApp. Tim toko akan mengabari saat ukuran ini datang.' }),
      el('div', { class: 'kabari-baris' }, nama, wa), jebakan, kirim, pesan,
      el('small', { text: 'Nomor hanya dipakai toko untuk mengabari barang ini.' }));
  }

  /* ---- panduan ukuran resmi (gambar dari eigeradventure.com) ---- */
  var dlg2 = document.getElementById('lembar2');
  function bukaPanduan(it) {
    var url = D.panduan[it.sg];
    isiUlang($('#lembar2Isi'),
      el('div', { class: 'lembar-atas' }, el('button', { class: 'kembali', type: 'button', 'aria-label': 'Tutup', onclick: function () { dlg2.close(); } }, svg(IKON_KEMBALI)), el('b', { text: 'Panduan ukuran' })),
      el('div', { class: 'panduan' },
        it.sgu ? el('p', { class: 'ket', text: 'Panduan umum untuk ' + subNama(it.k4).toLowerCase() + '. Ukuran tiap model bisa sedikit berbeda; tanyakan ke toko bila ragu.' }) : null,
        el('img', { src: url, alt: 'Tabel panduan ukuran ' + namaTampil(it.n), referrerpolicy: 'no-referrer' }),
        el('p', { class: 'ket', text: 'Sumber: eigeradventure.com' })));
    if (dlg2.showModal) dlg2.showModal(); else dlg2.setAttribute('open', '');
  }
  if (dlg2) dlg2.addEventListener('click', function (e) { if (e.target === dlg2) dlg2.close(); });

  /* ---- barang serupa: sub-kategori sama, harga berdekatan, ada foto ---- */
  function blokSerupa(it) {
    var h0 = (prItem(it) || {}).n || it.hm || it.h || 0;
    var hargaDari = function (x) { var p = prItem(x); return p ? p.n : (x.hm || x.h || 0); };
    var calon = D.items.filter(function (x) { return x.g !== it.g && x.k3 === it.k3 && fotoBersih(x).length; });
    var sama = calon.filter(function (x) { return x.k4 === it.k4; });
    var pakai = (sama.length >= 4 ? sama : calon).slice().sort(function (a, b) {
      return ((a.k4 === it.k4 ? 0 : 1) - (b.k4 === it.k4 ? 0 : 1)) || (Math.abs(hargaDari(a) - h0) - Math.abs(hargaDari(b) - h0));
    }).slice(0, 10);
    if (!pakai.length) return null;
    return el('div', { class: 'blok' }, el('h3', { text: 'Barang serupa di toko' }),
      el('div', { class: 'strip-rel serupa' }, pakai.map(function (x) {
        var p = prItem(x);
        return el('button', { class: 'mini', type: 'button', onclick: function () { buka(x); } },
          el('div', { class: 'gb' }, el('img', { src: fotoBersih(x)[0], alt: namaTampil(x.n), loading: 'lazy', referrerpolicy: 'no-referrer' }), p ? labelDiskon(p.d) : null),
          el('span', { class: 'mini-nama', text: namaTampil(x.n) }),
          hargaDari(x) ? hargaEl(hargaDari(x)) : el('span', { class: 'harga tanya', text: 'Tanya harga' }));
      })));
  }

  /* ---- info toko: alamat, jam buka (status buka/tutup), peta, WhatsApp resmi ---- */
  function gambarInfoToko() {
    var I = D.infoToko || {}, box = $('#infoToko');
    if (!box) return;
    var jBuka = (I.buka || '08:30').split(':').map(Number), jTutup = (I.tutup || '21:45').split(':').map(Number);
    var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })), m = now.getHours() * 60 + now.getMinutes();
    var mBuka = jBuka[0] * 60 + jBuka[1], mTutup = jTutup[0] * 60 + jTutup[1], bukaSkrg = m >= mBuka && m < mTutup;
    var jam = function (a) { return dua(a[0]) + '.' + dua(a[1]); };
    var wa = String(D.wa || '6281120022574'), waTampil = '0' + wa.replace(/^62/, '').replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3');
    isiUlang(box,
      el('div', { class: 'info-baris' },
        el('span', { class: 'status-buka' + (bukaSkrg ? '' : ' tutup'), text: bukaSkrg ? 'Buka sekarang' : 'Tutup' }),
        el('span', null, svg(IKON_JAM), bukaSkrg ? 'Tutup pukul ' + jam(jTutup) : 'Buka pukul ' + jam(jBuka) + (m >= mTutup ? ' besok' : '')),
        el('span', { class: 'info-update', id: 'update', text: D.diperbarui ? 'Stok per ' + tglUpdate(D.diperbarui) : '' })),
      el('div', { class: 'info-baris' }, el('span', null, svg(IKON_LOKASI), I.alamat || 'EIGER Store A. Yani Kartasura, Sukoharjo')),
      el('div', { class: 'info-aksi' },
        I.maps ? el('a', { class: 'tombol garis kecil', href: I.maps, target: '_blank', rel: 'noopener' }, svg(IKON_LOKASI), 'Petunjuk arah') : null,
        el('a', { class: 'tombol kecil', href: waLink('Halo EIGER Kartasura, saya mau tanya.'), target: '_blank', rel: 'noopener' }, svg(IKON_WA), 'WhatsApp toko'),
        el('button', { class: 'tombol garis kecil', type: 'button', onclick: bukaAman }, svg(IKON_PERISAI), 'Cek katalog resmi')),
      el('p', { class: 'info-jam', text: (I.jam || '') + ' · WhatsApp resmi ' + waTampil }));
  }
  function bukaAman() {
    var wa = String(D.wa || '6281120022574'), waTampil = '0' + wa.replace(/^62/, '').replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3');
    bukaLembar([kepalaLembar('Katalog resmi'), el('div', { class: 'aman' },
      el('div', { class: 'aman-kepala' }, svg(IKON_PERISAI), el('b', { text: 'Pastikan Anda di katalog resmi EIGER Store A. Yani Kartasura' })),
      el('ul', null,
        el('li', null, 'Alamat resmi katalog hanya ', el('b', { text: SITUS_RESMI }), '. Periksa di kolom alamat browser.'),
        el('li', null, 'WhatsApp resmi toko hanya ', el('b', { text: waTampil }), '.'),
        el('li', { text: 'Pembayaran hanya di kasir toko. Kami tidak pernah meminta transfer ke rekening pribadi, pulsa, atau kode OTP.' }),
        el('li', { text: 'Harga promo yang sah adalah yang tertera di katalog ini dan di kasir. Waspadai tawaran harga jauh lebih murah di luar katalog.' }),
        el('li', { text: 'Ragu? Datang atau telepon langsung ke toko di Jl. A. Yani Km 7 Kartasura.' })),
      location.hostname === SITUS_RESMI ? el('p', { class: 'aman-ok' }, svg(IKON_PERISAI), 'Halaman ini adalah katalog resmi.') : null)], true);
  }
  // halaman dibuka di alamat lain (salinan / bingkai) → peringatan jelas, dan tidak boleh dibingkai situs lain
  (function jagaSitus() {
    try { if (window.top !== window.self) window.top.location = 'https://' + SITUS_RESMI + '/'; } catch (e) { /* abaikan */ }
    var h = location.hostname;
    if (h === SITUS_RESMI || h === 'localhost' || h === '127.0.0.1' || h === '') return;
    var bar = el('div', { class: 'bukan-resmi', role: 'alert' }, svg(IKON_PERISAI),
      el('span', null, 'Halaman ini bukan katalog resmi EIGER Kartasura. Katalog resmi hanya di ', el('a', { href: 'https://' + SITUS_RESMI + '/', text: SITUS_RESMI }), '. Jangan transfer uang dari halaman ini.'));
    document.body.prepend(bar);
  })();

  /* ---------- menu bawah & kontrol ---------- */
  function tandaiMenu(m) { [].forEach.call(document.querySelectorAll('.menu-bawah button'), function (b) { if (b.getAttribute('data-m') === m) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }
  document.querySelector('.menu-bawah').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !D) return;
    var m = b.getAttribute('data-m'); tandaiMenu(m);
    if (m === 'beranda') { tutup(); F = { k3: '', k4: '', q: '', gd: '', urut: 'pilihan', arah: 'naik', promo: false, baru: false }; $('#q').value = ''; tandaiTab(); gambarKategori(); saring(); scrollTo({ top: 0, behavior: 'smooth' }); }
    if (m === 'kategori') bukaKategori();
    if (m === 'promo') bukaDaftarPromo();
    if (m === 'daftar') bukaDaftar();
  });
  var tunda;
  $('#q').addEventListener('input', function (e) { clearTimeout(tunda); tunda = setTimeout(function () { F.q = e.target.value; if (D) saring(); }, 200); });
  $('#q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.target.blur(); gulirKeDaftar(); } });
  function ukurAtas() { document.documentElement.style.setProperty('--atas-h', $('#atas').offsetHeight + 'px'); }
  ukurAtas(); addEventListener('resize', ukurAtas);
  $('#daftarAtas').addEventListener('click', function () { if (D) bukaDaftar(); });
  var waUmum = 'https://wa.me/6281120022574?text=' + encodeURIComponent('Halo EIGER Kartasura, saya mau tanya barang.');
  $('#waAtas').href = waUmum; $('#waBawah').href = waUmum;

  ambil();
})();
