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
  var BULAN_PENUH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
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
  function fAwal(q) { return { k3: '', k4: '', q: q || '', gds: [], urut: 'pilihan', arah: 'naik', promo: false, baru: false, akt: '', hrg: [], wrs: [], uks: [], kol: '', uk: false }; }
  var F = fAwal();
  var tampil = PER_HALAMAN, hasil = [];

  function promoAktif() { return !!(D && D.promoSampai && D.promoSampai >= hariIni()); }
  function prItem(it) { return promoAktif() && it.pr ? it.pr : null; }
  function prWarna(w) { return promoAktif() && w[3] ? w[3] : null; }
  /* alamat foto dari mesin bisa dipendekkan (awalan CDN dibuang, folder foto varian = '~') */
  var CDN = 'https://d1yutv2xslo29o.cloudfront.net/';
  function fotoPenuh(u) { u = String(u || ''); return !u || /^https?:/.test(u) ? u : CDN + u.replace(/^~/, 'product/variant/media/web/'); }
  function fotoBersih(it) {
    if (!it._f) it._f = (it.f || []).map(fotoPenuh).filter(function (u) { return u && !/\/(thumbnail|small)\//.test(u); });
    return it._f;
  }
  /** Versi 360 px dari CDN eigeradventure untuk kartu & foto kecil (foto asli 1000 px hanya di halaman detail). */
  // versi small hanya tersedia untuk foto varian bernama hash (product/variant/media/web/<32 hex>.webp)
  function fotoKecil(u) { return /\/product\/variant\/media\/web\/[0-9a-f]{32}\.webp$/.test(u) ? u.replace('/media/web/', '/media/web/small/') : u; }
  /** Foto kecil gagal → pakai foto asli; foto asli juga gagal → panggil gagal() (mis. tampilkan kotak tanpa foto). */
  function gagalKecil() { var a = this.getAttribute('data-asli'); if (a && this.src !== a) { this.removeAttribute('data-asli'); this.src = a; return; } if (this._gagal) this._gagal(); }
  function imgKecil(u, alt, gagal) {
    var src = fotoKecil(u);
    var x = el('img', { src: src, 'data-asli': src !== u ? u : null, alt: alt || '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
    x._gagal = gagal || null;
    x.addEventListener('error', gagalKecil);
    return x;
  }
  function promoTokoAktif() { var t = hariIni(); return (D.promoToko || []).filter(function (p) { return !p.selesai || p.selesai >= t; }); }

  /* ---------- data ---------- */
  /* Urutan muat data supaya katalog tampil secepat mungkin:
   * 1) data terakhir di HP (localStorage) → langsung tampil;
   * 2) salinan data di situs ini (data/katalog.json, dibuat workflow tiap 30 menit) → cepat dari server GitHub;
   * 3) data langsung dari mesin Basecamp di belakang layar, hanya bila salinan lebih tua dari 20 menit. */
  var SALINAN_MAKS_DETIK = 20 * 60;
  function ambil() {
    var lama = null, kini = '';
    try { kini = localStorage.getItem(SIMPAN) || ''; lama = JSON.parse(kini || 'null'); } catch (e) { lama = null; }
    if (lama && lama.items) { D = lama; mulai(); } else { kini = ''; rangka(); }
    function pakai(data, dariSalinan) {
      if (!data || !data.items) return;
      // salinan situs tidak boleh menimpa data yang lebih baru di HP
      if (dariSalinan && D && D.diperbarui && data.diperbarui && data.diperbarui < D.diperbarui) return;
      var baru = JSON.stringify(data);
      if (baru === kini) return;
      try { localStorage.setItem(SIMPAN, baru); } catch (e) { /* penuh, abaikan */ }
      kini = baru; D = data; mulai(true);
    }
    function langsung() {
      if (!CFG.API_URL) { if (!D) gagal(); return; }
      fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'katalog' }), redirect: 'follow' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (res) { if (!res.ok) throw new Error(res.error || 'Data tidak tersedia'); pakai(res.data, false); })
        .catch(function () { if (!D) gagal(); });
    }
    fetch('data/katalog.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (x) {
        if (x && x.d) pakai(x.d, true);
        if (!x || !x.t || Date.now() / 1000 - x.t > SALINAN_MAKS_DETIK || !D) langsung();
      })
      .catch(langsung);
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
  function mulai(segar) {
    ADA_I = D.items.some(function (x) { return x.i; });
    var yLama = scrollY, bukaLama = dlg.open;
    $('#update').textContent = D.diperbarui ? 'Stok per ' + tglUpdate(D.diperbarui) : '';
    gambarInfoToko();
    gambarPanduanAwal();
    hitungDaftar();
    gambarBanner();
    gambarKategori();
    gambarKoleksi();
    gambarStrip();
    gambarTerakhir();
    gambarPopuler();
    gambarMenuAtas();
    gambarBandingBar();
    tandaiTab();
    saring(true);
    // pembaruan data di belakang layar tidak boleh mengganggu: halaman detail yang terbuka tidak dibuka ulang
    if (segar && bukaLama) return;
    bukaDariHash();
    if (segar) scrollTo({ top: yLama });
  }

  var bannerTimer;
  function gambarBanner() {
    var slides = [];
    var nPromo = D.items.filter(prItem).length;
    var maxD = D.items.reduce(function (m, it) { var p = prItem(it); return p ? Math.max(m, p.d) : m; }, 0);
    if (nPromo) slides.push(el('button', { class: 'slide s-oranye', type: 'button', onclick: function () { pilihPromo(true); } },
      el('small', { text: 'Promo ' + (D.promoSampai ? BULAN_PENUH[Number(D.promoSampai.slice(5, 7)) - 1] + ' ' : '') + 'di toko' }), el('b', { text: 'Diskon s/d ' + maxD + '%' }),
      el('span', { text: nPromo + ' artikel promo tersedia di toko, berlaku s/d ' + tglPendek(D.promoSampai) + '.' }), el('em', { text: 'Lihat barang promo' })));
    var warna = ['', 's-hijau', 's-ungu', ''];
    var slidePromo = [];
    promoTokoAktif().filter(function (p) { return p.mulai <= hariIni(); }).slice(0, 1).forEach(function (p, i) {
      var st = statusPromo(p.mulai, p.selesai);
      slidePromo.push(el('button', { class: 'slide ' + warna[(i + 1) % warna.length], type: 'button', onclick: function () { bukaPromo(p); } },
        el('small', { text: (String(p.jenis || 'Promo').toUpperCase() === 'EAC' ? 'EAC' : judul(p.jenis || 'Promo')) + ' · ' + st.teks }),
        el('b', { text: p.judul.replace(/^(Promo Banking|EAC|Promo)\s*:\s*/i, '') }),
        el('span', { text: (p.ket || p.syarat || '').split(/\s*•\s*/)[0] }), el('em', { text: 'Lihat syarat' })));
    });
    // banner kampanye resmi dari eigeradventure.com, diselipkan setelah slide promo pertama
    var kampanye = (D.banner || []).map(function (b) {
      return el('button', { class: 'slide s-foto', type: 'button', 'aria-label': b.n || 'Kampanye EIGER', onclick: function () { cariKampanye(b); } },
        el('picture', null, el('source', { media: '(min-width: 700px)', srcset: b.d }), el('img', { src: b.m, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' })),
        el('span', { class: 'slide-sumber', text: 'eigeradventure.com · harga & promo online bisa beda dengan toko' }));
    });
    // maksimal 4 slide: promo toko → kampanye → promo umum → kampanye
    slides = slides.concat(kampanye.slice(0, 1), slidePromo, kampanye.slice(1, 2)).filter(Boolean).slice(0, 4);
    $('#banner').classList.toggle('ada-foto', kampanye.length > 0);
    if (!slides.length) slides.push(el('div', { class: 'slide' }, el('small', { text: 'EIGER Store A. Yani Kartasura' }), el('b', { text: 'Siap jalan dari Kartasura' }),
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
    F = fAwal(pilih);
    $('#q').value = pilih; tandaiTab(); gambarKategori(); saring(); scrollTo({ top: 0 });
  }

  function ikonKat(teks, isiIkon, kelas, aktif, klik) {
    return el('button', { class: 'kat', type: 'button', 'aria-pressed': String(!!aktif), onclick: klik },
      el('span', { class: 'kat-ikon' + (kelas ? ' ' + kelas : '') }, isiIkon), el('span', { text: teks }));
  }
  /* ikon garis seragam per sub-kategori (fallback: ikon kategori induk) */
  var IKON_K4 = {
    BACKPACK: '<path d="M8 7V5a4 4 0 0 1 8 0v2"/><rect x="5" y="7" width="14" height="14" rx="3"/><path d="M9 13h6v4H9Z"/>',
    CARRIER: '<path d="M9 4h6l1 3v14H8V7Z"/><path d="M8 11h8M10 4V2.5M14 4V2.5"/><path d="M10 15h4"/>',
    'SHOULDER BAG': '<path d="M7 9 12 3l5 6"/><rect x="4" y="9" width="16" height="11" rx="2"/><path d="M4 13h16"/>',
    'SLING BAG': '<path d="M5 3l12 12"/><rect x="11" y="10" width="9" height="10" rx="2"/>',
    'WAIST BAG': '<path d="M2 12h3M19 12h3"/><rect x="5" y="8" width="14" height="9" rx="4"/><path d="M8 12h8"/>',
    POUCH: '<rect x="4" y="7" width="16" height="11" rx="3"/><path d="M4 10h16M14 5h4"/>',
    CASES: '<rect x="4" y="6" width="16" height="13" rx="2"/><path d="M9 6V4h6v2M4 12h16"/>',
    DUFFLE: '<rect x="3" y="9" width="18" height="10" rx="4"/><path d="M8 9a4 4 0 0 1 8 0M3 14h18"/>',
    'MOTORCYCLE BAG': '<rect x="4" y="8" width="16" height="10" rx="2"/><path d="M8 8V6h8v2M12 8v10"/>',
    TOP: '<path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z"/>',
    SHIRT: '<path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3-4 4Z"/><path d="M12 7v14"/>',
    JACKET: '<path d="M8 3 3 7v12h4V10l1 11h8l1-11v9h4V7l-5-4-4 3Z"/><path d="M12 6v15"/>',
    VEST: '<path d="M8 3 5 6v15h6V9L8 3ZM16 3l3 3v15h-6V9l3-6Z"/>',
    SWEATER: '<path d="M8 3 3 7v12h4V10v11h10V10v9h4V7l-5-4a4 4 0 0 1-8 0Z"/><path d="M7 18h10"/>',
    PANTS: '<path d="M6 3h12l1 18h-5l-2-11-2 11H5Z"/><path d="M6 7h12"/>',
    SHORTS: '<path d="M5 5h14l1 11h-6l-2-5-2 5H4Z"/><path d="M5 8h14"/>',
    RAINWEAR: '<path d="M12 3a8 8 0 0 0-8 8h16a8 8 0 0 0-8-8ZM12 11v7a2 2 0 0 1-4 0"/>',
    BASELAYER: '<path d="M8 3 5 5v16h14V5l-3-2a4 4 0 0 1-8 0Z"/>',
    SHOES: '<path d="M3 17v-5l3-1 2-5h3l1 4 4 2 5 1a2 2 0 0 1 1 2v2Z"/><path d="M3 17v2h19v-2"/>',
    SANDAL: '<path d="M7 3c-3 0-4 4-4 9s1 9 4 9 4-4 4-9-1-9-4-9Z"/><path d="M4 9h6M17 3c-3 0-4 4-4 9s1 9 4 9 4-4 4-9-1-9-4-9ZM14 9h6"/>',
    SOCK: '<path d="M8 3h7v9l3 3a3 3 0 0 1-4 5l-6-5Z"/><path d="M8 6h7"/>',
    SHOELACE: '<path d="M4 18c4-8 8 4 12-4s4-6 4-6"/><path d="M4 18l-1 3M20 8l1-3"/>',
    CAPS: '<path d="M4 15a8 8 0 0 1 16 0Z"/><path d="M12 15h10v2H12Z"/>',
    HATS: '<path d="M7 13c0-5 2-8 5-8s5 3 5 8"/><path d="M2 14c3 2 17 2 20 0"/>',
    BEANIES: '<path d="M5 15a7 7 0 0 1 14 0Z"/><rect x="4" y="15" width="16" height="4" rx="1"/><circle cx="12" cy="5" r="1.5"/>',
    BANDANA: '<path d="M3 6h18L12 20Z"/><path d="M7 6l5 7 5-7"/>',
    WALLET: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h5M3 9h18"/>',
    WATCHES: '<circle cx="12" cy="12" r="5"/><path d="M12 10v2l1.5 1M9 7l1-4h4l1 4M9 17l1 4h4l1-4"/>',
    BELTS: '<path d="M2 10h20v4H2Z"/><rect x="13" y="8" width="5" height="8" rx="1"/>',
    SUNGLASSES: '<circle cx="7" cy="13" r="3.5"/><circle cx="17" cy="13" r="3.5"/><path d="M10.5 13h3M3.5 12 5 7M20.5 12 19 7"/>',
    'CHAIN ACCESSORIES': '<rect x="3" y="9" width="9" height="6" rx="3"/><rect x="12" y="9" width="9" height="6" rx="3"/>',
    'WATER STORAGE': '<path d="M10 2h4v3h-4ZM9 5h6l1 3v13H8V8Z"/><path d="M8 12h8"/>',
    KITCHENWARE: '<path d="M4 10h14v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M18 11h3M9 6c0-1 1-1 1-2M13 6c0-1 1-1 1-2"/>',
    TENTS: '<path d="M3 20 12 4l9 16Z"/><path d="M12 4v16M8.5 20 12 13l3.5 7"/>',
    'SLEEPING BAG': '<rect x="6" y="3" width="12" height="18" rx="5"/><circle cx="12" cy="8" r="2"/>',
    'MAT & COT': '<rect x="3" y="9" width="18" height="6" rx="3"/><path d="M8 9v6M13 9v6"/>',
    GLOVES: '<path d="M7 21v-6L5 11l1-1 2 2V5a1 1 0 0 1 2 0v5V3a1 1 0 0 1 2 0v7V4a1 1 0 0 1 2 0v7V6a1 1 0 0 1 2 0v9l-2 6Z"/>',
    'LIGHTING EQUIPMENT': '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11v1h6v-1a6 6 0 0 0-3-11Z"/>',
    TOWEL: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14M5 16h14"/>',
    CHAIR: '<path d="M6 4v9h12V4M6 13l-2 8M18 13l2 8M8 13l8 8M16 13l-8 8"/>'
  };
  var AKTIVITAS = [
    { id: 'mendaki', nama: 'Mendaki', ikon: '<path d="M3 20 10 7l4 6 2-3 5 10Z"/><path d="m8.5 10 1.5 1.5L11.5 10"/>', cocok: function (it) { return /hike|hiking|trek|climb|mountain|summit/i.test(it.ac); } },
    { id: 'camping', nama: 'Camping', ikon: '<path d="M3 20 12 4l9 16Z"/><path d="M12 4v16M8.5 20 12 13l3.5 7"/>', cocok: function (it) { return /camp/i.test(it.ac) || it.k3 === 'EQUIPMENT' && /TENT|SLEEPING|MAT|CHAIR|KITCHEN/.test(it.k4); } },
    { id: 'traveling', nama: 'Traveling', ikon: '<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V4h6v3M9 11v5M15 11v5"/>', cocok: function (it) { return /travel|touring|commute/i.test(it.ac); } },
    { id: 'harian', nama: 'Harian', ikon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', cocok: function (it) { return /daily|lifestyle/i.test(it.ac); } },
    { id: 'berkendara', nama: 'Berkendara', ikon: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-7h5l3 7M9 7h3"/>', cocok: function (it) { return /ride|riding|cycl/i.test(it.ac) || it.k4 === 'MOTORCYCLE BAG'; } },
    { id: 'hujan', nama: 'Hujan', ikon: '<path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3 3 0 0 1 0 6Z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>', cocok: function (it) { return /RAINWEAR|BAG COVER/.test(it.k4) || /\b(rain|poncho|storm|waterproof)\b/i.test(it.n); } },
    { id: 'olahraga', nama: 'Lari & olahraga', ikon: '<circle cx="14" cy="4" r="2"/><path d="M10 21l2-6-3-3 3-5 3 3h3M6 12l3-5"/>', cocok: function (it) { return /run|training/i.test(it.ac); } },
    { id: 'anak', nama: 'Anak', ikon: '<circle cx="12" cy="6" r="3"/><path d="M8 21v-5l-2-3 3-3h6l3 3-2 3v5"/>', cocok: function (it) { return genderNama(it.gd) === 'Anak'; } }
  ];
  function aktivitasDari(id) { return AKTIVITAS.filter(function (a) { return a.id === id; })[0]; }
  function gambarKategori() {
    var hit3 = {}, hit4 = {};
    D.items.forEach(function (it) { hit3[it.k3] = (hit3[it.k3] || 0) + 1; var k = it.k3 + '|' + it.k4; hit4[k] = (hit4[k] || 0) + 1; });
    var k3s = Object.keys(hit3).sort(function (a, b) { return ((KAT[a] || {}).urut || 9) - ((KAT[b] || {}).urut || 9); });
    var maxD = D.items.reduce(function (m, it) { var p = prItem(it); return p ? Math.max(m, p.d) : m; }, 0);
    var isi = [];
    if (maxD) isi.push(ikonKat('Barang promo', maxD + '%', 'promo', F.promo, function () { pilihPromo(!F.promo); }));
    isi.push(ikonKat('Baru di toko', svg('<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7Z"/>'), 'baru', F.baru, function () { F.baru = !F.baru; gulirKeDaftar(); saring(); gambarKategori(); }));
    k3s.forEach(function (k) {
      isi.push(ikonKat(katNama(k), svg((KAT[k] || {}).ikon || IKON_SEMUA), '', F.k3 === k && !F.k4, function () { pilihKat(k, ''); }));
    });
    // sub-kategori terbanyak ikut tampil, ikonnya garis seragam
    Object.keys(hit4).filter(function (k) { var p = k.split('|'); return subNama(p[1]) !== katNama(p[0]); }).sort(function (a, b) { return hit4[b] - hit4[a]; }).slice(0, 12).forEach(function (k) {
      var p = k.split('|');
      isi.push(ikonKat(subNama(p[1]), svg(IKON_K4[p[1]] || (KAT[p[0]] || {}).ikon || IKON_SEMUA), '', F.k3 === p[0] && F.k4 === p[1], function () { pilihKat(p[0], p[1]); }));
    });
    isiUlang($('#kategori'), isi);
    var akt = $('#aktivitas');
    if (akt) isiUlang(akt, AKTIVITAS.map(function (a) {
      var n = D.items.filter(a.cocok).length;
      if (n < 3) return null;
      return el('button', { class: 'akt', type: 'button', 'aria-pressed': String(F.akt === a.id), onclick: function () { F.akt = F.akt === a.id ? '' : a.id; gambarKategori(); saring(); gulirKeDaftar(); } },
        svg(a.ikon), el('span', null, el('b', { text: a.nama }), el('small', { text: n + ' barang' })));
    }));
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
        el('div', { class: 'gb' }, imgKecil(fotoBersih(it)[0], namaTampil(it.n)), labelDiskon(p.d)),
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
  /* ---- pencarian pintar ----
   * 1) kata/frasa kategori (topi, jaket, kaos kaki, tas gunung, ...) menyaring kategori, bukan dicocokkan ke potongan nama;
   * 2) kata lain: harus ada di teks barang, atau sinonimnya sama dengan satu kata utuh (cap ≠ "esCAPe");
   * 3) salah ketik ringan hanya bila pencarian biasa tidak menemukan apa-apa, hanya untuk kata ≥ 5 huruf, hanya ke nama barang. */
  var KATA_KATEGORI = [
    [/\bkaos kaki\b|\bkaus kaki\b|\bsocks?\b/, { k4: ['SOCK', 'SOCKS'] }, 'Kaos kaki'],
    [/\bsarung tangan\b|\bgloves?\b/, { k4: ['GLOVES', 'GLOVE'] }, 'Sarung tangan'],
    [/\b(jas|mantel) hujan\b|\bponc?ho\b|\brain ?coat\b/, { k4: ['RAINWEAR'] }, 'Jas hujan'],
    [/\bsleeping ?bag\b|\bkantong tidur\b/, { k4: ['SLEEPING BAG'] }, 'Sleeping bag'],
    [/\bikat pinggang\b|\bsabuk\b|\bbelt\b/, { k4: ['BELTS', 'BELT'] }, 'Ikat pinggang'],
    [/\btas (gunung|carrier|kerir|keril|carier)\b|\bcarr?ier\b|\bkerir\b|\bkeril\b/, { k4: ['CARRIER'], uji: tasCarrier }, 'Carrier'],
    [/\btas (pinggang|pinggul)\b|\bwaist ?bag\b/, { k4: ['WAIST BAG'] }, 'Tas pinggang'],
    [/\btas (selempang|slempang)\b|\bsling ?bag\b/, { k4: ['SLING BAG', 'SHOULDER BAG'] }, 'Tas selempang'],
    [/\btas (punggung|sekolah|kuliah)\b|\bransel\b|\bbackpack\b/, { k4: ['BACKPACK', 'DAYPACK'] }, 'Ransel'],
    [/\btas motor\b/, { k4: ['MOTORCYCLE BAG'] }, 'Tas motor'],
    [/\brain ?cover\b|\bcover tas\b/, { k4: ['BAG COVER', 'RAIN COVER'] }, 'Rain cover'],
    [/\bsandal jepit\b|\bsandal\b|\bsendal\b|\bsandals\b/, { k4: ['SANDAL', 'SANDALS', 'SLIPPER'] }, 'Sandal'],
    [/\bsepatu\b|\bshoes?\b|\bsneakers?\b/, { k4: ['SHOES', 'BOOTS'] }, 'Sepatu'],
    [/\bkupluk\b|\bbeanies?\b/, { k4: ['BEANIES', 'BEANIE'] }, 'Kupluk'],
    [/\btopi\b|\bcaps?\b|\bhats?\b|\bsnapback\b/, { k4: ['CAPS', 'CAP', 'HATS', 'HAT', 'BEANIES', 'BEANIE'] }, 'Topi'],
    [/\bhijab\b|\bjilbab\b|\bkerudung\b/, { k4: ['HIJAB'] }, 'Hijab'],
    [/\bjaket\b|\bjackets?\b|\bjkt\b/, { k4: ['JACKET'] }, 'Jaket'],
    [/\bkemeja\b|\bshirts?\b/, { k4: ['SHIRT'] }, 'Kemeja'],
    [/\bkaos\b|\bkaus\b|\bt ?shirt\b|\btees?\b/, { k4: ['TOP', 'T-SHIRT'] }, 'Kaos & atasan'],
    [/\bcelana pendek\b|\bshorts?\b/, { k4: ['SHORTS'] }, 'Celana pendek'],
    [/\bcelana\b|\bpants?\b|\bjogger\b/, { k4: ['PANTS', 'SHORTS'] }, 'Celana'],
    [/\brompi\b|\bvest\b/, { k4: ['VEST'] }, 'Rompi'],
    [/\bsweater\b|\bhoodie\b/, { k4: ['SWEATER', 'HOODIE'] }, 'Sweater & hoodie'],
    [/\bbaselayer\b|\bmanset\b/, { k4: ['BASELAYER'] }, 'Baselayer'],
    [/\bdompet\b|\bwallets?\b/, { k4: ['WALLET', 'WALLETS'] }, 'Dompet'],
    [/\bbotol\b|\btumbler\b|\bbottle\b/, { k4: ['WATER STORAGE', 'BOTTLE'] }, 'Botol minum'],
    [/\btenda\b|\btents?\b/, { k4: ['TENTS', 'TENT'] }, 'Tenda'],
    [/\bmatras\b|\bvelbed\b/, { k4: ['MAT & COT', 'MATTRESS'] }, 'Matras'],
    [/\bsenter\b|\bheadlamp\b|\blampu( kepala)?\b/, { k4: ['LIGHTING EQUIPMENT', 'LIGHTING'] }, 'Senter & lampu'],
    [/\bjam( tangan)?\b|\bwatch(es)?\b/, { k4: ['WATCHES', 'WATCH'] }, 'Jam tangan'],
    [/\bkacamata\b|\bsunglass(es)?\b/, { k4: ['SUNGLASSES'] }, 'Kacamata'],
    [/\bhanduk\b|\btowel\b/, { k4: ['TOWEL'] }, 'Handuk'],
    [/\bkursi\b|\bchair\b/, { k4: ['CHAIR'] }, 'Kursi lipat'],
    [/\bkompor\b|\bnesting\b|\balat masak\b|\bmug\b|\bgelas\b/, { k4: ['KITCHENWARE', 'COOKWARE', 'COOKING'] }, 'Alat masak & minum'],
    [/\bpisau\b|\bknife\b/, { k4: ['KNIVES'] }, 'Pisau'],
    [/\bbandana\b|\bbuff\b/, { k4: ['BANDANA', 'BUFF'] }, 'Bandana & buff'],
    [/\bpouch\b/, { k4: ['POUCH'] }, 'Pouch'],
    [/\btas\b|\bbags?\b/, { k3: ['BAGS'] }, 'Tas']
  ];
  /** Carrier = sub-kategori CARRIER, atau ransel berkapasitas ≥ 35 liter (angka di nama, mis. "Eliptic Solaris 45"). */
  function tasCarrier(it) {
    if (it.k4 === 'CARRIER') return true;
    if (it.k3 !== 'BAGS' || it.k4 !== 'BACKPACK') return false;
    if (/carrier/i.test(it.n)) return true;
    var m = String(it.n).match(/(?:^|\s)(\d{2,3})\s*(?:\+\s*\d+\s*)?l?(?=\s|$)/i);
    return !!m && Number(m[1]) >= 35 && Number(m[1]) <= 120;
  }
  var SINONIM = {
    cewek: ['wanita'], cewe: ['wanita'], perempuan: ['wanita'], women: ['wanita'], ladies: ['wanita'],
    cowok: ['pria'], cowo: ['pria'], laki: ['pria'], men: ['pria'], bocah: ['anak'], kids: ['anak'], junior: ['jr', 'anak'],
    gunung: ['mountain', 'mountaineering', 'hiking', 'mendaki', 'trekking'], mendaki: ['hiking', 'mountain', 'mountaineering', 'trekking'], hiking: ['hiking', 'mendaki', 'mountaineering'],
    kemping: ['camp', 'camping'], kemah: ['camp', 'camping'], camping: ['camp', 'camping'], hujan: ['rain', 'waterproof'], motor: ['riding', 'motorcycle'],
    hitam: ['black'], putih: ['white'], hijau: ['green', 'olive', 'army'], biru: ['blue', 'navy'], merah: ['red', 'maroon'], abu: ['grey', 'gray', 'charcoal'],
    coklat: ['cokelat', 'brown'], cokelat: ['brown'], kuning: ['yellow'], ungu: ['purple'], pink: ['merah muda']
  };
  var KATA_KOSONG = { murah: 1, bagus: 1, keren: 1, baru: 0, original: 1, ori: 1, eiger: 1, yang: 1, untuk: 1, buat: 1, dan: 1 };
  function teksCari(it) {
    if (it._t == null) {
      it._t = (it.n + ' ' + it.g + ' ' + katNama(it.k3) + ' ' + subNama(it.k4) + ' ' + it.ac + ' ' + genderNama(it.gd) + ' ' +
        it.w.map(function (w) { return warnaInfo(w[0])[0]; }).join(' ')).toLowerCase();
      it._k = it._t.split(/[^a-z0-9]+/).filter(Boolean);
      it._kn = String(it.n).toLowerCase().split(/[^a-z0-9]+/).filter(function (k) { return k.length >= 4; });
    }
    return it._t;
  }
  function jarak(a, b, maks) {
    if (Math.abs(a.length - b.length) > maks) return maks + 1;
    var prev = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i], min = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < min) min = cur[j];
      }
      if (min > maks) return maks + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  /** Urai kata pencarian → { kat: [{k3,k4,nama}], kata: [{k, alt}] } (disimpan per teks). */
  var cacheKata = {};
  function kataCari(q) {
    if (cacheKata[q]) return cacheKata[q];
    var x = ' ' + q.toLowerCase().replace(/[^a-z0-9.&\- ]+/g, ' ').replace(/\s+/g, ' ') + ' ', kat = [];
    KATA_KATEGORI.forEach(function (k) {
      var m = x.match(k[0]);
      if (!m) return;
      // nama barang yang memang memuat kata ini (mis. "Sling Bag Explore") tetap ditemukan lewat nama
      kat.push({ k3: k[1].k3 || [], k4: k[1].k4 || [], uji: k[1].uji, nama: k[2], kata: m[0].trim() });
      x = x.replace(k[0], ' ');
    });
    var kata = x.split(/\s+/).filter(function (k) { return k && KATA_KOSONG[k] !== 1; }).map(function (k) { return { k: k, alt: SINONIM[k] || [] }; });
    return (cacheKata[q] = { kat: kat, kata: kata });
  }
  var CARI_LONGGAR = false;
  function cocokKat(it, kat) { return kat.some(function (c) { return c.uji ? c.uji(it) : c.k3.indexOf(it.k3) >= 0 || c.k4.indexOf(it.k4) >= 0; }); }
  function cocokCari(it, q) {
    if (!q) return true;
    var P = kataCari(q), teks = teksCari(it);
    if (P.kat.length && !cocokKat(it, P.kat)) {
      // di luar kategori: hanya bila nama barangnya sendiri memuat frasa kategori itu (mis. "Pouch" di nama tas)
      var nama = String(it.n).toLowerCase();
      if (!P.kat.some(function (c) { return c.kata.length >= 4 && nama.indexOf(c.kata) >= 0; })) return false;
    }
    return P.kata.every(function (w) {
      if (teks.indexOf(w.k) >= 0) return true;
      if (w.alt.some(function (a) { return it._k.indexOf(a) >= 0 || it._k.indexOf(a + 's') >= 0 || (a.indexOf(' ') > 0 && teks.indexOf(a) >= 0); })) return true;
      if (!CARI_LONGGAR || w.k.length < 5 || /^\d+$/.test(w.k)) return false;
      var maks = w.k.length >= 8 ? 2 : 1;
      return it._kn.some(function (t) { return jarak(w.k, t, maks) <= maks || (t.length > w.k.length && jarak(w.k, t.slice(0, w.k.length), 1) <= 1); });
    });
  }
  /** Skor kecocokan untuk urutan "Terkait" saat mencari: kata ada di nama > kategori > sinonim/salah ketik. */
  function skorCari(it, q) {
    var P = kataCari(q), nama = String(it.n).toLowerCase(), s = 0;
    P.kata.forEach(function (w) { if (nama.indexOf(w.k) >= 0) s += 3; else if (teksCari(it).indexOf(w.k) >= 0) s += 1; });
    if (P.kat.length && cocokKat(it, P.kat)) s += 2;
    if (P.kat.some(function (c) { return nama.indexOf(c.kata) >= 0; })) s += 1;
    return s;
  }
  /* ================= saring & urutkan (gaya eigeradventure: tombol tarik-turun berisi kotak pilihan + jumlah) ================= */
  var HARGA = [['h1', 'Di bawah 200 rb', 0, 200000], ['h2', '200–500 rb', 200000, 500000], ['h3', '500 rb–1 jt', 500000, 1000000], ['h4', 'Di atas 1 jt', 1000000, 1e12]];
  var KEL_WARNA = [
    ['hitam', 'Hitam', '#1E1E1E', /^(hitam|charcoal)/i], ['putih', 'Putih & krem', '#F4F1EA', /^(putih|off white|krem|beige|pasir)/i],
    ['abu', 'Abu-abu', '#8A8F93', /^(abu|silver|taupe)/i], ['biru', 'Biru & navy', '#2E5C9A', /^(biru|navy|denim|cyan|teal|tosca|turquoise)/i],
    ['hijau', 'Hijau & olive', '#4E6B3A', /^(hijau|olive|army|mint|lime|sage|loreng)/i], ['coklat', 'Cokelat & khaki', '#8A6A45', /^(cokelat|khaki|tan|mocha|kopi|bronze)/i],
    ['merah', 'Merah & maroon', '#B8312F', /^(merah(?! muda)|maroon|wine|terracotta)/i], ['kuning', 'Kuning & oranye', '#E0A12B', /^(kuning|mustard|oranye|peach)/i],
    ['pink', 'Pink & ungu', '#C67BA0', /^(merah muda|ungu|lilac|magenta)/i]
  ];
  var URUT = [['pilihan', 'Terkait'], ['baru', 'Terbaru'], ['diskon', 'Diskon terbesar'], ['harga-naik', 'Harga termurah'], ['harga-turun', 'Harga termahal']];
  /** Pria / Wanita ikut menampilkan barang unisex (tas, perlengkapan); Unisex & Anak tepat. */
  function cocokGender(it, g) { var x = genderNama(it.gd); return x === g || ((g === 'Pria' || g === 'Wanita') && x === 'Unisex'); }
  function hargaKini(it) { var p = prItem(it); return p ? p.n : (it.hm || it.h || 0); }
  function kelWarna(kode) { var n = warnaInfo(kode)[0]; var k = KEL_WARNA.filter(function (x) { return x[3].test(n); })[0]; return k ? k[0] : ''; }
  function warnaItem(it) {
    if (!it._wr) { it._wr = []; it.w.forEach(function (w) { var k = kelWarna(w[0]); if (k && it._wr.indexOf(k) < 0) it._wr.push(k); }); }
    return it._wr;
  }
  function ukItem(it) {
    if (!it._uk) { it._uk = []; it.w.forEach(function (w) { w[1].forEach(function (u) { if (u[1] && it._uk.indexOf(u[0]) < 0) it._uk.push(u[0]); }); }); }
    return it._uk;
  }
  /** Lolos semua saringan kecuali satu kelompok (dipakai untuk menghitung jumlah per pilihan). */
  function lolos(it, kecuali) {
    var q = F.q.trim().toLowerCase(), K = F.kol ? (D.koleksi || []).filter(function (k) { return k.id === F.kol; })[0] : null;
    var A = F.akt ? aktivitasDari(F.akt) : null;
    if (kecuali !== 'kat' && ((F.k3 && it.k3 !== F.k3) || (F.k4 && it.k4 !== F.k4))) return false;
    if (kecuali !== 'gd' && F.gds.length && !F.gds.some(function (g) { return cocokGender(it, g); })) return false;
    if (kecuali !== 'promo' && F.promo && !prItem(it)) return false;
    if (kecuali !== 'baru' && F.baru && !it.b) return false;
    if (kecuali !== 'akt' && A && !A.cocok(it)) return false;
    if (kecuali !== 'hrg' && F.hrg.length) { var hk = hargaKini(it); if (!HARGA.some(function (r) { return F.hrg.indexOf(r[0]) >= 0 && hk >= r[2] && hk < r[3]; })) return false; }
    if (kecuali !== 'wr' && F.wrs.length && !warnaItem(it).some(function (k) { return F.wrs.indexOf(k) >= 0; })) return false;
    if (kecuali !== 'uk' && F.uks.length && !ukItem(it).some(function (u) { return F.uks.indexOf(u) >= 0; })) return false;
    if (K && K.g.indexOf(it.g) < 0) return false;
    if (F.uk && !cocokUkuranku(it)) return false;
    return cocokCari(it, q);
  }
  function jumlahSaring() { return F.gds.length + F.hrg.length + F.wrs.length + F.uks.length + (F.akt ? 1 : 0) + (F.k3 ? 1 : 0) + (F.promo ? 1 : 0) + (F.baru ? 1 : 0); }
  /* kelompok saringan: [id, label, opsi()] — opsi: [{v, t, warna?}] ; pilih(v) ; aktif(v) */
  function kelompok() {
    var gds = {}; D.items.forEach(function (it) { var g = genderNama(it.gd); if (g) gds[g] = 1; });
    var uks = {}; D.items.forEach(function (it) { ukItem(it).forEach(function (u) { uks[u] = 1; }); });
    var k3s = {}; D.items.forEach(function (it) { (k3s[it.k3] = k3s[it.k3] || {})[it.k4] = 1; });
    var toggle = function (arr, v) { var i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); };
    return [
      { id: 'gd', nama: 'Gender', opsi: ['Pria', 'Wanita', 'Unisex', 'Anak'].filter(function (g) { return gds[g]; }).map(function (g) { return { v: g, t: g }; }),
        cocok: cocokGender, aktif: function (v) { return F.gds.indexOf(v) >= 0; }, pilih: function (v) { toggle(F.gds, v); }, isi: function () { return F.gds.length; }, hapus: function () { F.gds = []; } },
      { id: 'hrg', nama: 'Harga', opsi: HARGA.map(function (r) { return { v: r[0], t: r[1] }; }),
        cocok: function (it, v) { var r = HARGA.filter(function (x) { return x[0] === v; })[0], hk = hargaKini(it); return hk >= r[2] && hk < r[3]; }, aktif: function (v) { return F.hrg.indexOf(v) >= 0; }, pilih: function (v) { toggle(F.hrg, v); }, isi: function () { return F.hrg.length; }, hapus: function () { F.hrg = []; } },
      { id: 'wr', nama: 'Warna', opsi: KEL_WARNA.map(function (k) { return { v: k[0], t: k[1], warna: k[2] }; }),
        cocok: function (it, v) { return warnaItem(it).indexOf(v) >= 0; }, aktif: function (v) { return F.wrs.indexOf(v) >= 0; }, pilih: function (v) { toggle(F.wrs, v); }, isi: function () { return F.wrs.length; }, hapus: function () { F.wrs = []; } },
      { id: 'uk', nama: 'Ukuran', lebar: true, opsi: Object.keys(uks).sort(function (a, b) {
          var g = function (u) { return u === 'NOS' ? 0 : URUT_UK.indexOf(u) >= 0 ? 1 : /^\d+(\.\d+)?$/.test(u) ? 2 : 3; };
          return (g(a) - g(b)) || urutUk(a, b);
        }).map(function (u) { return { v: u, t: u === 'NOS' ? 'All size' : u }; }),
        cocok: function (it, v) { return ukItem(it).indexOf(v) >= 0; }, aktif: function (v) { return F.uks.indexOf(v) >= 0; }, pilih: function (v) { toggle(F.uks, v); }, isi: function () { return F.uks.length; }, hapus: function () { F.uks = []; } },
      { id: 'akt', nama: 'Aktivitas', opsi: AKTIVITAS.map(function (a) { return { v: a.id, t: a.nama }; }),
        cocok: function (it, v) { return aktivitasDari(v).cocok(it); }, aktif: function (v) { return F.akt === v; }, pilih: function (v) { F.akt = F.akt === v ? '' : v; gambarKategori(); }, isi: function () { return F.akt ? 1 : 0; }, hapus: function () { F.akt = ''; gambarKategori(); } },
      { id: 'kat', nama: 'Kategori', lebar: true, opsi: Object.keys(k3s).sort(function (a, b) { return ((KAT[a] || {}).urut || 9) - ((KAT[b] || {}).urut || 9); }).reduce(function (o, k3) {
          o.push({ v: k3 + '|', t: 'Semua ' + katNama(k3).toLowerCase(), judul: katNama(k3) });
          Object.keys(k3s[k3]).sort(function (a, b) { return subNama(a) < subNama(b) ? -1 : 1; }).forEach(function (k4) { o.push({ v: k3 + '|' + k4, t: subNama(k4) }); });
          return o;
        }, []),
        cocok: function (it, v) { var p = v.split('|'); return it.k3 === p[0] && (!p[1] || it.k4 === p[1]); }, aktif: function (v) { return v === F.k3 + '|' + F.k4; },
        pilih: function (v) { var p = v.split('|'); if (v === F.k3 + '|' + F.k4) { F.k3 = ''; F.k4 = ''; } else { F.k3 = p[0]; F.k4 = p[1]; } gambarKategori(); }, isi: function () { return F.k3 ? 1 : 0; }, hapus: function () { F.k3 = ''; F.k4 = ''; gambarKategori(); } }
    ];
  }
  function hitungOpsi(K) {
    var dasar = D.items.filter(function (it) { return lolos(it, K.id); });
    return K.opsi.map(function (o) { return dasar.filter(function (it) { return K.cocok(it, o.v); }).length; });
  }
  function isiOpsi(K, ulang) {
    var n = hitungOpsi(K);
    return el('div', { class: 'opsi-grid' + (K.lebar ? ' lebar' : '') + (K.id === 'kat' ? ' kat' : '') }, K.opsi.map(function (o, i) {
      if (!n[i] && !K.aktif(o.v)) return null;
      return [o.judul ? el('b', { class: 'opsi-judul', text: o.judul }) : null,
        el('button', { type: 'button', class: 'opsi', 'aria-pressed': String(K.aktif(o.v)), onclick: function () { K.pilih(o.v); saring(); ulang(); } },
          o.warna ? el('i', { class: 'opsi-warna', style: 'background:' + o.warna }) : null,
          el('span', { text: o.t }), el('small', { text: '(' + n[i] + ')' }))];
    }));
  }
  /* tarik-turun satu kelompok (komputer: menempel di bawah tombol; HP: lembar dari bawah) */
  var popKini = null;
  function tutupPop() { if (popKini) { popKini.el.remove(); popKini.tombol.setAttribute('aria-expanded', 'false'); popKini = null; } }
  function bukaPop(K, tombol) {
    var sama = popKini && popKini.id === K.id; tutupPop(); if (sama) return;
    var pop = el('div', { class: 'pop-saring', role: 'dialog', 'aria-label': K.nama });
    function gambar() {
      var KK = kelompok().filter(function (x) { return x.id === K.id; })[0];
      isiUlang(pop, el('div', { class: 'pop-kepala' }, el('b', { text: KK.nama }), el('button', { class: 'pop-x', type: 'button', 'aria-label': 'Tutup', text: '×', onclick: tutupPop })),
        el('div', { class: 'pop-isi' }, isiOpsi(KK, gambar)),
        el('div', { class: 'pop-kaki' },
          el('button', { class: 'tombol garis kecil', type: 'button', text: 'Hapus', disabled: !KK.isi(), onclick: function () { KK.hapus(); saring(); gambar(); } }),
          el('button', { class: 'tombol kecil', type: 'button', text: 'Lihat ' + hasil.length + ' barang', onclick: function () { tutupPop(); gulirKeDaftar(); } })));
    }
    gambar();
    document.body.appendChild(pop);
    tombol.setAttribute('aria-expanded', 'true');
    popKini = { id: K.id, el: pop, tombol: tombol };
    letakPop();
  }
  function letakPop() {
    if (!popKini) return;
    var r = popKini.tombol.getBoundingClientRect(), p = popKini.el;
    if (innerWidth < 700) { p.classList.add('bawah'); p.style.left = p.style.top = ''; return; }
    p.classList.remove('bawah');
    p.style.top = Math.round(r.bottom + 8) + 'px';
    p.style.left = Math.round(Math.max(12, Math.min(r.left, innerWidth - p.offsetWidth - 12))) + 'px';
  }
  addEventListener('resize', letakPop);
  addEventListener('scroll', function () { if (popKini && innerWidth >= 700) letakPop(); }, { passive: true });
  document.addEventListener('pointerdown', function (e) { if (popKini && !popKini.el.contains(e.target) && !popKini.tombol.contains(e.target)) tutupPop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') tutupPop(); });

  /** Panel lengkap "Filter": semua kelompok sekaligus. */
  function bukaPanelSaring() {
    tutupPop();
    var pertama = true;
    function gambar() {
      var ulang = !pertama; pertama = false;
      bukaLembar([kepalaLembar('Filter'), el('div', { class: 'panel-saring' },
        el('div', { class: 'panel-blok' }, el('b', { text: 'Tampilkan' }), el('div', { class: 'opsi-grid' },
          el('button', { type: 'button', class: 'opsi', 'aria-pressed': String(F.promo), onclick: function () { F.promo = !F.promo; gambarKategori(); saring(); gambar(); } }, el('span', { text: 'Barang promo' })),
          el('button', { type: 'button', class: 'opsi', 'aria-pressed': String(F.baru), onclick: function () { F.baru = !F.baru; gambarKategori(); saring(); gambar(); } }, el('span', { text: 'Baru di toko' })),
          ukAda() ? el('button', { type: 'button', class: 'opsi', 'aria-pressed': String(!!F.uk), onclick: function () { F.uk = !F.uk; saring(); gambar(); } }, el('span', { text: 'Ukuranku: ' + ringkasUk() })) : null)),
        el('div', { class: 'panel-blok' }, el('b', { text: 'Urutkan' }), el('div', { class: 'opsi-grid' }, URUT.map(function (u) {
          return el('button', { type: 'button', class: 'opsi', 'aria-pressed': String(urutKini() === u[0]), onclick: function () { pakaiUrut(u[0]); gambar(); } }, el('span', { text: u[1] }));
        }))),
        kelompok().map(function (K) { return el('div', { class: 'panel-blok' }, el('b', { text: K.nama }), isiOpsi(K, gambar)); }),
        el('div', { class: 'panel-kaki' },
          el('button', { class: 'tombol garis', type: 'button', text: 'Hapus semua', onclick: function () { hapusSemuaSaring(); gambar(); } }),
          el('button', { class: 'tombol', type: 'button', text: 'Lihat ' + hasil.length + ' barang', onclick: function () { tutup(); gulirKeDaftar(); } })))], 'sempit lembar-filter', ulang);
    }
    gambar();
    if (location.hash !== '#filter') history.pushState(null, '', '#filter');
  }
  function hapusSemuaSaring() { var q = F.q, u = F.urut, a = F.arah; F = fAwal(q); F.urut = u; F.arah = a; gambarKategori(); saring(); }
  function urutKini() { return F.urut === 'harga' ? 'harga-' + F.arah : F.urut; }
  function pakaiUrut(v) { if (/^harga-/.test(v)) { F.urut = 'harga'; F.arah = v.slice(6); } else F.urut = v; tandaiTab(); saring(); }

  function gambarSaring() {
    var ks = kelompok(), n = jumlahSaring();
    var tombol = [el('button', { class: 'saring-tombol utama', type: 'button', onclick: bukaPanelSaring },
      svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'), 'Filter', n ? el('i', { class: 'saring-n', text: String(n) }) : null)];
    var punyaUk = ukAda();
    tombol.push(el('button', { class: 'saring-tombol' + (F.uk ? ' aktif' : ''), type: 'button', 'aria-pressed': String(!!F.uk), onclick: function () { if (!punyaUk) { bukaUkuranku(); return; } F.uk = !F.uk; saring(); } },
      svg('<path d="M3 7h18v10H3Z"/><path d="M7 7v4M11 7v3M15 7v4M19 7v3"/>'), punyaUk ? 'Ukuranku' : 'Atur ukuranku'));
    ks.forEach(function (K) {
      var isi = K.isi();
      tombol.push(el('button', { class: 'saring-tombol' + (isi ? ' aktif' : ''), type: 'button', 'data-k': K.id, 'aria-haspopup': 'dialog', 'aria-expanded': String(!!(popKini && popKini.id === K.id)), onclick: function (e) { bukaPop(K, e.currentTarget); } },
        K.nama, isi ? el('i', { class: 'saring-n', text: String(isi) }) : null, svg('<path d="m6 9 6 6 6-6"/>')));
    });
    isiUlang($('#saring'), tombol);
    // pilihan yang aktif sebagai chip yang bisa dihapus
    var chips = [];
    var tambahChip = function (t, hapus) { chips.push(el('button', { class: 'chip-aktif', type: 'button', onclick: function () { hapus(); saring(); } }, t, el('span', { 'aria-hidden': 'true', text: '×' }))); };
    if (F.kol) tambahChip(((D.koleksi || []).filter(function (k) { return k.id === F.kol; })[0] || { j: 'Koleksi' }).j, function () { F.kol = ''; });
    if (F.promo) tambahChip('Barang promo', function () { F.promo = false; gambarKategori(); });
    if (F.baru) tambahChip('Baru di toko', function () { F.baru = false; gambarKategori(); });
    if (F.uk) tambahChip('Ukuranku: ' + ringkasUk(), function () { F.uk = false; });
    ks.forEach(function (K) { K.opsi.forEach(function (o) { if (K.aktif(o.v)) tambahChip(K.id === 'kat' ? (F.k4 ? subNama(F.k4) : katNama(F.k3)) : o.t, function () { K.pilih(o.v); }); }); });
    if (chips.length > 1) chips.push(el('button', { class: 'chip-hapus-semua', type: 'button', text: 'Hapus semua', onclick: hapusSemuaSaring }));
    var box = $('#saringAktif');
    if (box) { isiUlang(box, chips); box.hidden = !chips.length; }
    if (popKini) { var K0 = ks.filter(function (x) { return x.id === popKini.id; })[0]; if (K0) { var t = $('#saring [data-k="' + K0.id + '"]'); if (t) { popKini.tombol = t; t.setAttribute('aria-expanded', 'true'); letakPop(); } } }
  }
  function saring(tetap) {
    var q = F.q.trim().toLowerCase();
    var K = F.kol ? (D.koleksi || []).filter(function (k) { return k.id === F.kol; })[0] : null;
    var A = F.akt ? aktivitasDari(F.akt) : null;
    var menyaring = !!(q || jumlahSaring() || K || F.uk);
    $('#beranda').hidden = !!(q || F.k3 || F.promo || F.baru || F.akt || K || F.gds.length || F.wrs.length || F.uks.length || F.hrg.length || F.uk);
    $('#judulDaftar').textContent = q ? 'Hasil pencarian "' + F.q.trim() + '"' : F.uk && !(K || F.promo || F.baru || F.k3 || A) ? 'Tersedia di ukuranku' : K ? K.j : F.promo ? 'Barang promo' : F.baru ? 'Baru di toko' : F.k3 ? (F.k4 ? subNama(F.k4) : katNama(F.k3)) + (F.gds.length === 1 ? ' ' + F.gds[0].toLowerCase() : '') : A ? 'Untuk ' + A.nama.toLowerCase() : F.gds.length === 1 ? 'Untuk ' + F.gds[0].toLowerCase() : 'Rekomendasi untukmu';
    CARI_LONGGAR = false;
    hasil = D.items.filter(function (it) { return lolos(it, ''); });
    if (q && !hasil.length) { CARI_LONGGAR = true; hasil = D.items.filter(function (it) { return lolos(it, ''); }); } // salah ketik ringan
    var P = q ? kataCari(q) : null;
    if (K && F.urut === 'pilihan') hasil.sort(function (a, b) { return K.g.indexOf(a.g) - K.g.indexOf(b.g); });
    if (q.length >= 3 && !hasil.length) catatCariKosong(q);
    var h = hargaKini;
    var dk = function (it) { var p = prItem(it); return p ? p.d : 0; };
    var ada = function (it) { return fotoBersih(it).length ? 1 : 0; };
    var urut = {
      pilihan: function (a, b) { return (ada(b) - ada(a)) || ((dk(b) ? 1 : 0) - (dk(a) ? 1 : 0)) || (b.b - a.b) || (a.n < b.n ? -1 : 1); },
      baru: function (a, b) { return (b.b - a.b) || (ada(b) - ada(a)) || (a.n < b.n ? -1 : 1); },
      diskon: function (a, b) { return (dk(b) - dk(a)) || (ada(b) - ada(a)) || (a.n < b.n ? -1 : 1); },
      harga: function (a, b) { var x = h(a) || 9e9, y = h(b) || 9e9; return F.arah === 'naik' ? x - y : (h(b) || 0) - (h(a) || 0); }
    }[F.urut];
    if (!(K && F.urut === 'pilihan')) hasil.sort(urut);
    if (q && F.urut === 'pilihan') {
      var sk = {}; hasil.forEach(function (it) { sk[it.g] = skorCari(it, q); });
      hasil.sort(function (a, b) { return (sk[b.g] - sk[a.g]) || urut(a, b); });
    }
    tampil = tetap ? Math.max(tampil, PER_HALAMAN) : PER_HALAMAN;
    gambarSaring();
    $('#hitung').textContent = hasil.length + ' barang' + (menyaring ? ' cocok' : ' tersedia di toko') +
      (P && P.kat.length ? ' · kategori ' + P.kat.map(function (c) { return c.nama; }).join(', ') : '') + (CARI_LONGGAR && hasil.length ? ' · termasuk ejaan mirip' : '');
    gambarGrid();
  }
  function labelDiskon(d) { return el('span', { class: 'label-diskon' }, d + '%', el('small', { text: 'OFF' })); }
  /** Ukuran terbatas: barang berukuran yang tinggal sedikit ukuran tersedia (tanpa menyebut jumlah stok). */
  function ukuranTerbatas(it) {
    var semua = {}, ada = {};
    it.w.forEach(function (w) { w[1].forEach(function (u) { if (u[0] === 'NOS') return; semua[u[0]] = 1; if (u[1]) ada[u[0]] = 1; }); });
    var ns = Object.keys(semua).length, na = Object.keys(ada).length;
    return ns >= 4 && na > 0 && na <= 2;
  }
  function kartu(it) {
    var pr = prItem(it), fotos = fotoBersih(it), foto = fotos[0];
    var gb = el('div', { class: 'gb' });
    var ganti = function () { isiUlang(gb, el('div', { class: 'tanpa-foto' }, svg((KAT[it.k3] || {}).ikon || IKON_SEMUA), el('b', { text: namaTampil(it.n) }))); tandai(); };
    var tandai = function () {
      if (pr) gb.append(labelDiskon(pr.d));
      if (it.b) gb.append(el('span', { class: 'label-baru', text: 'Baru' }));
      var bawah = [it.wg ? el('span', { class: 'tanda-garansi', title: 'Garansi seumur hidup' }, svg(IKON_PERISAI), 'Garansi seumur hidup') : null,
        ukuranTerbatas(it) ? el('span', { class: 'tanda-terbatas', text: 'Ukuran terbatas' }) : null].filter(Boolean);
      if (bawah.length) gb.append(el('span', { class: 'tanda-bawah' }, bawah));
    };
    if (foto) {
      gb.append(imgKecil(foto, namaTampil(it.n), ganti));
      if (fotos[1]) gb.append(el('img', { class: 'gb-2', 'data-src': fotoKecil(fotos[1]), alt: '', decoding: 'async', referrerpolicy: 'no-referrer', 'aria-hidden': 'true' }));
      tandai();
    } else ganti();
    var harga = pr ? [hargaEl(pr.n), pr.h > pr.n ? el('span', { class: 'coret', text: rp(pr.h) }) : null]
      : it.h ? [hargaEl(it.hm || it.h)] : [el('span', { class: 'harga tanya', text: 'Tanya harga' })];
    return el('button', { class: 'kartu', type: 'button', onclick: function () { buka(it); }, onpointerenter: function (e) {
      if (e.pointerType !== 'mouse') return;
      var b = gb.querySelector('.gb-2[data-src]'); if (b) { b.src = b.getAttribute('data-src'); b.removeAttribute('data-src'); b.onerror = function () { b.remove(); }; }
      siapkanInfo(it);
    } }, gb,
      el('div', { class: 'isi' },
        el('h3', { class: 'nama', text: namaTampil(it.n) }),
        el('div', { class: 'baris-harga' }, harga),
        ringkasVarian(it)));
  }
  /** Titik warna + ukuran yang tersedia (gabungan semua warna) untuk kartu produk. */
  function ringkasVarian(it) {
    var titik = it.w.slice(0, 3).map(function (w) { var x = warnaInfo(w[0]); return el('i', { style: 'background:' + x[1], title: x[0] }); });
    if (it.w.length > 3) titik.push(el('em', { text: '+' + (it.w.length - 3) }));
    var uk = [];
    it.w.forEach(function (w) { w[1].forEach(function (u) { if (u[1] && u[0] !== 'NOS' && uk.indexOf(u[0]) < 0) uk.push(u[0]); }); });
    uk.sort(urutUk);
    var maks = uk.some(function (u) { return u.length > 3; }) ? 2 : 4;
    var chipUk = uk.slice(0, maks).map(function (u) { return el('b', { text: u }); });
    if (uk.length > maks) chipUk.push(el('em', { text: '+' + (uk.length - maks) }));
    return el('div', { class: 'ringkas' },
      chipUk.length ? el('span', { class: 'ukuran-ada', 'aria-label': 'Ukuran tersedia: ' + uk.join(', ') }, chipUk) : el('span'),
      el('span', { class: 'titik-warna', 'aria-label': it.w.length + ' warna' }, titik));
  }
  var URUT_UK = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL'];
  function urutUk(a, b) {
    var x = URUT_UK.indexOf(a), y = URUT_UK.indexOf(b), na = parseFloat(a), nb = parseFloat(b);
    if (x >= 0 && y >= 0) return x - y;
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a < b ? -1 : 1;
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
    tandaLagi();
  }
  /** Tambah halaman berikutnya ke bawah daftar (tanpa menggambar ulang kartu yang sudah ada). */
  function muatLagi() {
    if (tampil >= hasil.length) return;
    var dari = tampil;
    tampil += PER_HALAMAN;
    tambah($('#grid'), hasil.slice(dari, tampil).map(kartu));
    tandaLagi();
  }
  /* "Lihat lainnya" terbuka otomatis saat pelanggan menggulir sampai bawah; tombol tetap ada sebagai cadangan */
  var pengamatLagi = 'IntersectionObserver' in window ? new IntersectionObserver(function (xs) {
    if (xs.some(function (x) { return x.isIntersecting; })) muatLagi();
  }, { rootMargin: '600px 0px' }) : null;
  function tandaLagi() {
    var s = hasil.length - tampil, box = $('#lagi');
    isiUlang(box, s > 0 ? [el('span', { class: 'memuat', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
      el('button', { class: 'tombol garis', type: 'button', text: 'Lihat ' + Math.min(s, PER_HALAMAN) + ' barang lainnya', onclick: muatLagi })]
      : (hasil.length > PER_HALAMAN ? el('p', { class: 'habis-semua', text: 'Sudah semua · ' + hasil.length + ' barang' }) : null));
    if (pengamatLagi) { pengamatLagi.disconnect(); if (s > 0) pengamatLagi.observe(box); }
  }

  /* urutkan: tombol "Berdasarkan" dengan daftar pilihan */
  function tandaiTab() {
    var b = $('#tombolUrut'); if (!b) return;
    var u = URUT.filter(function (x) { return x[0] === urutKini(); })[0];
    isiUlang(b, el('span', { class: 'urut-label', text: 'Berdasarkan:' }), el('b', { text: u ? u[1] : 'Terkait' }), svg('<path d="m6 9 6 6 6-6"/>'));
  }
  $('#tombolUrut').addEventListener('click', function (e) {
    if (!D) return;
    var t = e.currentTarget;
    var sama = popKini && popKini.id === 'urut'; tutupPop(); if (sama) return;
    var pop = el('div', { class: 'pop-saring pop-urut', role: 'listbox', 'aria-label': 'Urutkan' }, URUT.map(function (u) {
      return el('button', { type: 'button', role: 'option', class: 'urut-opsi', 'aria-selected': String(urutKini() === u[0]), text: u[1], onclick: function () { tutupPop(); pakaiUrut(u[0]); } });
    }));
    document.body.appendChild(pop);
    t.setAttribute('aria-expanded', 'true');
    popKini = { id: 'urut', el: pop, tombol: t };
    letakPop();
    if (innerWidth >= 700) pop.style.left = Math.round(Math.min(t.getBoundingClientRect().right - pop.offsetWidth, innerWidth - pop.offsetWidth - 12)) + 'px';
  });

  /* ---------- lembar: detail produk ---------- */
  var dlg = $('#lembar');
  function bukaLembar(isi, sempit, tetapGulir) {
    var y = $('#lembarIsi').scrollTop;
    dlg.className = 'lembar' + (sempit === true ? ' sempit' : sempit ? ' ' + sempit : '');
    if (sempit !== 'lembar-produk') { galeriKini = null; teksProdukKini = ''; }
    isiUlang($('#lembarIsi'), isi);
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    $('#lembarIsi').scrollTop = tetapGulir ? y : 0;
  }
  function kepalaLembar(teks) {
    return el('div', { class: 'lembar-atas' }, el('button', { class: 'kembali', type: 'button', 'aria-label': 'Kembali', onclick: tutup }, svg(IKON_KEMBALI)), el('b', { text: teks }));
  }
  var detailTimer, galeriKini = null;
  /** Galeri foto produk: geser (sentuh / seret mouse), tombol ‹ ›, foto kecil, panah keyboard. Berputar:
   *  setelah foto terakhir kembali ke foto pertama, dan sebaliknya. */
  function buatGaleri(it, fotos) {
    var n = fotos.length, fi = 0;
    var utama = el('div', { class: 'galeri-utama' }, n ? fotos.map(function (f, i) {
      return el('div', null, el('img', { src: f, alt: namaTampil(it.n) + ' foto ' + (i + 1), loading: i ? 'lazy' : 'eager', decoding: 'async', draggable: 'false', referrerpolicy: 'no-referrer' }));
    }) : el('div', null, el('div', { class: 'tanpa-foto' }, svg((KAT[it.k3] || {}).ikon || IKON_SEMUA), el('b', { text: namaTampil(it.n) }))));
    var no = n > 1 ? el('span', { class: 'galeri-no', text: '1/' + n }) : null;
    var mini = n > 1 ? el('div', { class: 'galeri-mini' }, fotos.map(function (f, i) {
      return el('button', { type: 'button', 'aria-label': 'Foto ' + (i + 1), 'aria-pressed': String(!i), onclick: function () { ke(i); } },
        imgKecil(f, ''));
    })) : null;
    function tandai(i) {
      fi = i;
      if (no) no.textContent = (i + 1) + '/' + n;
      if (!mini) return;
      [].forEach.call(mini.children, function (b, j) { b.setAttribute('aria-pressed', String(j === i)); });
      var b = mini.children[i], tegak = mini.scrollHeight > mini.clientHeight + 2;
      if (tegak) { if (b.offsetTop < mini.scrollTop || b.offsetTop + b.offsetHeight > mini.scrollTop + mini.clientHeight) mini.scrollTo({ top: b.offsetTop - mini.clientHeight / 2 + b.offsetHeight / 2, behavior: 'smooth' }); }
      else if (b.offsetLeft < mini.scrollLeft || b.offsetLeft + b.offsetWidth > mini.scrollLeft + mini.clientWidth) mini.scrollTo({ left: b.offsetLeft - mini.clientWidth / 2 + b.offsetWidth / 2, behavior: 'smooth' });
    }
    // saat bergeser karena tombol/keyboard, posisi antara diabaikan sampai tujuan tercapai
    var tujuan = null, tujuanT;
    function ke(i, langsung) {
      if (n < 2) return;
      i = (i % n + n) % n;
      tujuan = langsung ? null : i;
      clearTimeout(tujuanT); tujuanT = setTimeout(function () { tujuan = null; }, 900);
      utama.scrollTo({ left: i * utama.clientWidth, behavior: langsung ? 'auto' : 'smooth' });
      tandai(i);
    }
    utama.addEventListener('scroll', function () {
      var i = Math.round(utama.scrollLeft / Math.max(1, utama.clientWidth));
      if (tujuan != null) { if (i === tujuan && Math.abs(utama.scrollLeft - i * utama.clientWidth) < 2) tujuan = null; return; }
      if (i !== fi && i >= 0 && i < n) tandai(i);
    }, { passive: true });
    // seret dengan mouse (komputer)
    var x0 = null;
    utama.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || n < 2 || e.button) return;
      x0 = e.clientX; utama.classList.add('menyeret');
      try { utama.setPointerCapture(e.pointerId); } catch (x) { /* abaikan */ }
    });
    utama.addEventListener('pointerup', function (e) {
      if (x0 == null) return;
      var dx = e.clientX - x0; x0 = null; utama.classList.remove('menyeret');
      if (dx < -40) ke(fi + 1); else if (dx > 40) ke(fi - 1);
    });
    // sentuh: geser lagi di foto terakhir → kembali ke foto pertama (dan sebaliknya)
    var t0 = null;
    utama.addEventListener('touchstart', function (e) { t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, i: fi }; }, { passive: true });
    utama.addEventListener('touchend', function (e) {
      if (!t0 || n < 2) return;
      var t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y, i0 = t0.i; t0 = null;
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
      setTimeout(function () {
        if (i0 === n - 1 && fi === n - 1 && dx < 0) ke(0);
        else if (i0 === 0 && fi === 0 && dx > 0) ke(n - 1);
      }, 60);
    }, { passive: true });
    var panah = n > 1 ? el('div', { class: 'galeri-panah' },
      el('button', { type: 'button', 'aria-label': 'Foto sebelumnya', onclick: function () { ke(fi - 1); } }, svg('<path d="m15 5-7 7 7 7"/>')),
      el('button', { type: 'button', 'aria-label': 'Foto berikutnya', onclick: function () { ke(fi + 1); } }, svg('<path d="m9 5 7 7-7 7"/>'))) : null;
    var geserMini = function (arah) { mini.scrollBy({ top: arah * mini.clientHeight * 0.7, left: arah * mini.clientWidth * 0.7, behavior: 'smooth' }); };
    var samping = mini ? el('div', { class: 'galeri-samping' },
      el('button', { class: 'mini-naik', type: 'button', 'aria-label': 'Foto kecil sebelumnya', onclick: function () { geserMini(-1); } }, svg('<path d="m6 15 6-6 6 6"/>')),
      mini,
      el('button', { class: 'mini-turun', type: 'button', 'aria-label': 'Foto kecil berikutnya', onclick: function () { geserMini(1); } }, svg('<path d="m6 9 6 6 6-6"/>'))) : null;
    var catatan = it.fm && n ? el('span', { class: 'galeri-catatan', text: 'Foto model serupa · warna & detail bisa sedikit berbeda' }) : null;
    var node = el('div', { class: 'galeri' + (n > 1 ? ' banyak' : '') }, samping, el('div', { class: 'galeri-panggung' }, utama, catatan, no, panah));
    return { node: node, ke: ke, maju: function () { ke(fi + 1); }, mundur: function () { ke(fi - 1); } };
  }
  document.addEventListener('keydown', function (e) {
    if (!galeriKini || !dlg.open || (dlg2 && dlg2.open) || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); galeriKini.maju(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); galeriKini.mundur(); }
  });

  /* bilah tipis menempel di atas (komputer) saat tombol tanya sudah tergulir lewat */
  var pengamatTempel = null;
  function pasangTempel(it, fotos, harga, kosong) {
    if (pengamatTempel) { pengamatTempel.disconnect(); pengamatTempel = null; }
    var atas = $('#lembarIsi .lembar-atas'), bb = $('#lembarIsi .bar-beli');
    if (!atas || !bb || !('IntersectionObserver' in window)) return;
    var asli = bb.querySelector('.tanya');
    var cta = kosong ? el('button', { class: 'tanya', type: 'button', text: 'Kabari saya', onclick: function () { var f = $('.form-kabari input'); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.focus(); } } })
      : el('a', { class: 'tanya', href: asli && asli.href || waLink('Halo EIGER Kartasura, saya mau tanya ' + namaTampil(it.n) + ' (kode ' + it.g + ').'), target: '_blank', rel: 'noopener', onclick: function () { catat(it.g, 't'); } }, svg(IKON_WA), 'Tanya stok');
    var tempel = el('div', { class: 'bilah-tempel', 'aria-hidden': 'true' },
      fotos[0] ? imgKecil(fotos[0], '') : null,
      el('div', { class: 'tempel-teks' }, el('b', { text: namaTampil(it.n) }), el('span', { text: harga ? rp(harga) : 'Tanya harga' })), cta);
    atas.appendChild(tempel);
    pengamatTempel = new IntersectionObserver(function (xs) {
      var x = xs[0], lewat = !x.isIntersecting;
      tempel.classList.toggle('tampil', lewat); tempel.setAttribute('aria-hidden', String(!lewat));
    }, { root: $('#lembarIsi') });
    pengamatTempel.observe(bb);
    aturTempelKanan();
  }
  /* kartu kanan menempel; bila lebih tinggi dari layar, ia menempel di bagian bawahnya supaya tombol tetap terjangkau */
  function aturTempelKanan() {
    var info = $('#lembarIsi .lembar-produk .produk > .info') || $('.lembar-produk .produk > .info'), box = $('#lembarIsi');
    if (!info || !box) return;
    info.style.top = innerWidth >= 900 ? Math.min(72, box.clientHeight - info.offsetHeight - 16) + 'px' : '';
  }
  addEventListener('resize', aturTempelKanan);
  function buka(it, dariHash) {
    var wi = Math.max(0, it.w.findIndex(function (w) { return prWarna(w); })), uk = '';
    var tersedia = function (w) { return w[1].filter(function (u) { return u[1]; }); };
    var pilihAwalUk = function () {
      var t = tersedia(it.w[wi]);
      if (t.length === 1) return t[0][0];
      var mine = ukurankuUntuk(it);
      var cocok = t.filter(function (u) { return mine.indexOf(u[0]) >= 0; });
      return cocok.length === 1 ? cocok[0][0] : '';
    };
    // warna yang tersedia di ukuranku didahulukan
    if (ukurankuUntuk(it).length) {
      var wu = it.w.findIndex(function (w) { return tersedia(w).some(function (u) { return ukurankuUntuk(it).indexOf(u[0]) >= 0; }); });
      if (wu >= 0 && !prWarna(it.w[wi])) wi = wu;
    }
    uk = pilihAwalUk();
    var fotos = fotoBersih(it);
    var sudah = false, warnaTerakhir = -1, galeri = null;
    catatLihat(it.g);
    function gambar() {
      var ulang = sudah; sudah = true;
      var w = it.w[wi], wi2 = warnaInfo(w[0]), pw = prWarna(w);
      var satuUkuran = w[1].length === 1 && w[1][0][0] === 'NOS';
      var pilihU = w[1].filter(function (u) { return u[0] === uk; })[0];
      var kosong = !!(pilihU && !pilihU[1]);
      function statusStok() {
        var ada = w[1].filter(function (u) { return u[1]; });
        if (satuUkuran || (pilihU && pilihU[1])) return el('div', { class: 'status-stok ada' }, el('i'), satuUkuran ? 'Tersedia di toko' : 'Ukuran ' + uk + ' tersedia di toko');
        if (kosong) return el('div', { class: 'status-stok habis' }, el('i'), 'Ukuran ' + uk + ' sedang kosong · bisa minta dikabari');
        return el('div', { class: 'status-stok ada' }, el('i'), 'Tersedia ' + ada.length + ' ukuran: ' + ada.map(function (u) { return u[0]; }).join(', '));
      }
      var hargaNormal = w[2] || it.h;
      var teks = 'Halo EIGER Kartasura, saya mau tanya ' + namaTampil(it.n) + ' (kode ' + it.g + '), warna ' + wi2[0].toLowerCase() +
        (uk && uk !== 'NOS' ? ', ukuran ' + uk : '') + (pw ? ', harga promo ' + rp(pw[1]) : '') + '. Apakah masih tersedia di toko?';
      teksProdukKini = teks;
      // galeri dibuat ulang hanya saat produk dibuka / warna diganti (mulai lagi dari foto pertama)
      if (!galeri || warnaTerakhir !== wi) { galeri = buatGaleri(it, fotos); warnaTerakhir = wi; }
      galeriKini = galeri;
      var hm = el('span', { class: 'hm' });
      var blokHarga = el('div', { class: 'blok blok-harga' },
        el('div', { class: 'harga-besar' }, pw ? [hargaEl(pw[1]), pw[2] > pw[1] ? el('span', { class: 'coret', text: rp(pw[2]) }) : null, el('span', { class: 'persen', text: pw[0] + '% OFF' })]
          : hargaNormal ? hargaEl(hargaNormal) : el('span', { class: 'harga tanya', text: 'Tanya harga di toko' })),
        statusStok(),
        pw ? el('div', { class: 'pita-promo' }, el('span', { text: '⚡ Promo toko · ' + statusPromo('', D.promoSampai).teks }), hm) : null);
      var promoUmum = promoTokoAktif().filter(function (p) { return p.mulai <= hariIni() && /non promo|all item/i.test(p.produk || ''); });
      var wadahInfo = el('div', { class: 'info-produk' });
      var dibanding = bacaBanding().indexOf(it.g) >= 0;
      var label = [genderNama(it.gd), it.ac ? judul(it.ac) : '', subNama(it.k4)].filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      var kanan = el('div', { class: 'info' },
        el('div', { class: 'blok blok-nama' },
          el('div', { class: 'label-produk' }, label.map(function (l) { return el('span', { text: l }); }),
            pw ? el('em', { class: 'label-diskon-teks', text: 'Diskon ' + pw[0] + '%' }) : it.b ? el('em', { class: 'label-baru-teks', text: 'Baru di toko' }) : null),
          el('h1', { text: namaTampil(it.n) }),
          el('div', { class: 'sub', text: katNama(it.k3) + ' › ' + subNama(it.k4) + ' · Kode ' + it.g }),
          el('div', { class: 'aksi-nama' },
            it.wg ? el('span', { class: 'garansi-kecil' }, svg(IKON_PERISAI), 'Garansi seumur hidup') : null,
            el('button', { class: 'tombol-banding' + (dibanding ? ' aktif' : ''), type: 'button', 'aria-pressed': String(dibanding), onclick: function () { toggleBanding(it); gambar(); } },
              svg('<path d="M8 4v16M16 4v16M4 8h8M12 16h8"/>'), dibanding ? 'Dibandingkan (' + bacaBanding().length + ')' : 'Bandingkan'),
            dibanding && bacaBanding().length > 1 ? el('button', { class: 'tautan-panduan', type: 'button', text: 'Lihat perbandingan ›', onclick: bukaBanding }) : null)),
        blokHarga,
        el('div', { class: 'blok' }, el('h3', null, 'Warna: ', el('span', { text: wi2[0] })),
          el('div', { class: 'pilihan pilihan-warna' }, it.w.map(function (x, i) {
            return el('button', { type: 'button', 'aria-pressed': String(i === wi), onclick: function () {
              wi = i; var t = tersedia(it.w[i]); uk = t.length === 1 ? t[0][0] : (t.some(function (u) { return u[0] === uk; }) ? uk : pilihAwalUk()); gambar();
            } }, el('i', { style: 'background:' + warnaInfo(x[0])[1] }), warnaInfo(x[0])[0], prWarna(x) ? el('em', { text: '-' + prWarna(x)[0] + '%' }) : null);
          }))),
        satuUkuran ? null : el('div', { class: 'blok' }, el('div', { class: 'blok-kepala' }, el('h3', null, 'Ukuran: ', el('span', { text: uk ? uk + (kosong ? ' (kosong)' : '') : 'pilih ukuran' })),
            it.sg != null && D.panduan && D.panduan[it.sg] ? el('button', { class: 'tautan-panduan', type: 'button', onclick: function () { bukaPanduan(it); } }, svg('<path d="M3 17 17 3l4 4L7 21Z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>'), 'Panduan ukuran') : null),
          el('div', { class: 'pilihan pilihan-ukuran' }, w[1].map(function (u) {
            var milikku = ukurankuUntuk(it).indexOf(u[0]) >= 0;
            return el('button', { type: 'button', class: (u[1] ? '' : 'uk-kosong') + (milikku ? ' uk-ku' : ''), 'aria-pressed': String(uk === u[0]), 'aria-label': u[0] + (u[1] ? '' : ', kosong') + (milikku ? ', ukuranku' : ''),
              text: u[0] === 'NOS' ? 'All size' : u[0], onclick: function () { uk = u[0]; gambar(); } });
          })),
          el('div', { class: 'legenda-ukuran' }, el('span', null, el('i', { class: 'ada' }), 'Tersedia di toko'), el('span', null, el('i', { class: 'habis' }), 'Kosong · ketuk untuk dikabari'),
            ukurankuUntuk(it).length ? el('span', null, el('i', { class: 'ku' }), 'Ukuranku') : null),
          kosong ? formKabari(it, w[0], uk) : null),
        !pw && promoUmum.length ? el('div', { class: 'blok' }, el('h3', { text: 'Promo yang bisa dipakai' }),
          el('div', { class: 'promo-berlaku' }, promoUmum.slice(0, 4).map(function (p) {
            return el('div', { class: 'voucher-kecil' }, el('b', { text: p.jenis || 'Promo' }), el('span', { text: p.judul }));
          }), el('button', { class: 'sk', type: 'button', style: 'align-self:flex-start', text: 'Lihat semua promo ›', onclick: bukaDaftarPromo }))) : null,
        el('div', { class: 'bar-beli' },
          el('button', { class: 'bagikan', type: 'button', onclick: function () {
            // link per produk: halaman kecil berisi foto, nama & harga untuk pratinjau WhatsApp, lalu membuka produk ini
            var url = location.hostname === SITUS_RESMI ? 'https://' + SITUS_RESMI + '/p/' + it.g + '/' : location.href.split('#')[0] + '#artikel-' + it.g;
            if (navigator.share) navigator.share({ title: namaTampil(it.n), url: url }).catch(function () {});
            else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('Link disalin'); }, function () { toast(url); });
          } }, svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'), 'Bagikan'),
          el('button', { class: 'chat tambah', type: 'button', onclick: function () {
            if (!satuUkuran && !uk) { toast('Pilih ukuran dulu'); return; }
            tambahDaftar(it, w[0], satuUkuran ? 'NOS' : uk);
          } }, svg(IKON_DAFTAR_TAMBAH), 'Daftar'),
          kosong ? el('button', { class: 'tanya', type: 'button', text: 'Kabari saya saat tersedia', onclick: function () { var f = $('.form-kabari input'); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.focus(); } } })
            : el('a', { class: 'tanya', href: waLink(teks), target: '_blank', rel: 'noopener', onclick: function () { catat(it.g, 't'); } }, svg(IKON_WA), uk || satuUkuran ? 'Tanya stok via WhatsApp' : 'Tanya ketersediaan')),
        el('div', { class: 'kartu-ambil' },
          el('div', null, svg(IKON_LOKASI), el('span', null, el('b', { text: 'Ambil langsung di toko' }), el('small', { text: 'EIGER Store A. Yani Kartasura · ' + jamToko().teks }))),
          el('div', null, svg(IKON_PERISAI), el('span', null, el('b', { text: 'Bayar hanya di kasir toko' }), el('small', { text: 'Kami tidak pernah meminta transfer ke rekening pribadi.' })))));
      var rinci = el('div', { class: 'rinci' },
        wadahInfo,
        el('div', { class: 'blok' }, el('h3', { text: 'Spesifikasi' }),
          el('dl', { class: 'detail-baris dl-spek' }, el('dt', { text: 'Kategori' }), el('dd', { text: katNama(it.k3) + ' › ' + subNama(it.k4) }),
            it.ac ? [el('dt', { text: 'Aktivitas' }), el('dd', { text: judul(it.ac) })] : null,
            genderNama(it.gd) ? [el('dt', { text: 'Untuk' }), el('dd', { text: genderNama(it.gd) })] : null,
            el('dt', { text: 'Kode artikel' }), el('dd', { text: it.g }),
            el('dt', { text: 'Lokasi' }), el('dd', { text: 'EIGER Store A. Yani Kartasura' }))),
        blokPasangan(it),
        blokSerupa(it));
      var jejak = el('nav', { class: 'jejak', 'aria-label': 'Lokasi halaman' },
        el('button', { type: 'button', text: 'Beranda', onclick: function () { tutup(); } }), el('span', { text: '/' }),
        el('button', { type: 'button', text: katNama(it.k3), onclick: function () { tutup(); F = fAwal(); $('#q').value = ''; pilihKat(it.k3, ''); } }), el('span', { text: '/' }),
        el('button', { type: 'button', text: subNama(it.k4), onclick: function () { tutup(); F = fAwal(); $('#q').value = ''; pilihKat(it.k3, it.k4); } }), el('span', { text: '/' }),
        el('b', { text: namaTampil(it.n) }));
      bukaLembar([kepalaLembar('Detail produk'), jejak, el('div', { class: 'produk' }, galeri.node, kanan, rinci)], 'lembar-produk', ulang);
      if (!ulang) galeri.ke(0, true);
      pasangTempel(it, fotos, pw ? pw[1] : hargaNormal, kosong);
      ambilInfo(it.g, function (x) { if (wadahInfo.isConnected) isiInfo(wadahInfo, $('.dl-spek'), x); });
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
    var per = {};
    D.items.forEach(function (it) { (per[it.k3] = per[it.k3] || {})[it.k4] = ((per[it.k3] || {})[it.k4] || 0) + 1; });
    var k3s = Object.keys(per).sort(function (a, b) { return ((KAT[a] || {}).urut || 9) - ((KAT[b] || {}).urut || 9); });
    bukaLembar([kepalaLembar('Kategori'),
      el('h3', { class: 'sub-judul', text: 'Untuk aktivitas' }),
      el('div', { class: 'kategori-lembar' }, AKTIVITAS.filter(function (a) { return D.items.filter(a.cocok).length >= 3; }).map(function (a) {
        return ikonKat(a.nama, svg(a.ikon), 'akt-ikon', false, function () { tutup(); F = fAwal(); F.akt = a.id; $('#q').value = ''; gambarKategori(); saring(); gulirKeDaftar(); });
      })),
      k3s.map(function (k3) {
      return [el('h3', { class: 'sub-judul', text: katNama(k3) }),
        el('div', { class: 'kategori-lembar' }, ikonKat('Semua', svg((KAT[k3] || {}).ikon || IKON_SEMUA), 'semua', false, function () { tutup(); pilihKat(k3, ''); }),
          Object.keys(per[k3]).sort(function (a, b) { return per[k3][b] - per[k3][a]; }).map(function (k4) {
            return ikonKat(subNama(k4), svg(IKON_K4[k4] || (KAT[k3] || {}).ikon || IKON_SEMUA), '', false, function () { tutup(); F.k3 = ''; pilihKat(k3, k4); });
          }))];
    })], true);
    if (location.hash !== '#kategori') history.pushState(null, '', '#kategori');
  }

  function tutup() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', function () {
    clearInterval(detailTimer);
    if (/^#(artikel-|promo|kategori|daftar|banding|ukuranku|filter)/.test(location.hash)) history.pushState(null, '', location.pathname + location.search);
    if (/^\/p\/\d{9}\/?$/.test(location.pathname)) history.pushState(null, '', '/' + location.search.replace(/^\?$/, ''));
    tandaiMenu('beranda');
    galeriKini = null; teksProdukKini = '';
    if (lihatBerubah) gambarTerakhir();
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) tutup(); });
  // halaman produk /p/<kode>/ (untuk Google & link bagikan): katalog dibuka langsung di produk itu
  var ARTIKEL_AWAL = document.body.getAttribute('data-artikel') || '';
  function bukaDariHash() {
    if (!D) return;
    var seo = document.getElementById('seoProduk'); if (seo) seo.remove();
    var h = location.hash, m = h.match(/^#artikel-(\d{9})$/);
    if (!m && ARTIKEL_AWAL) { m = [0, ARTIKEL_AWAL]; ARTIKEL_AWAL = ''; }
    if (m) { var it = D.items.filter(function (x) { return x.g === m[1]; })[0]; if (it) buka(it, true); else toast('Barang ini sedang tidak tersedia di toko'); return; }
    if (h === '#promo') { bukaDaftarPromo(); return; }
    if (h === '#kategori') { bukaKategori(); return; }
    if (h === '#daftar') { bukaDaftar(); return; }
    if (h === '#banding') { bukaBanding(); return; }
    if (h === '#ukuranku') { bukaUkuranku(); return; }
    if (h === '#filter') { bukaPanelSaring(); return; }
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


  /* ---- foto alam (Unsplash License) untuk latar koleksi ---- */
  var LATAR = { merbabu: '1575573685828-7c1e20f05124', awan: '1685360594641-91fb52833b3b', senja: '1651890044335-a55d59f5b167',
    hijau: '1647067379984-9e0e069b097a', puncak: '1724076150462-8fcb67d8abb3', malam: '1501600696725-895c50e7ae0a' };
  function fotoLatar(k, w) { return 'https://images.unsplash.com/photo-' + (LATAR[k] || LATAR.merbabu) + '?w=' + (w || 700) + '&q=65&auto=format&fit=crop'; }

  /* ---- koleksi pilihan toko (disusun staf di Basecamp) ---- */
  function gambarKoleksi() {
    var xs = D.koleksi || [], box = $('#koleksiKotak');
    if (!box) return;
    box.hidden = !xs.length;
    var G = {};
    D.items.forEach(function (it) { G[it.g] = it; });
    isiUlang($('#koleksi'), xs.map(function (k) {
      var foto = k.g.map(function (g) { return G[g] && fotoBersih(G[g])[0]; }).filter(Boolean).slice(0, 3);
      return el('button', { class: 'koleksi', type: 'button', style: "background-image:linear-gradient(100deg,rgba(10,26,79,.88) 0%,rgba(10,26,79,.55) 55%,rgba(10,26,79,.15) 100%),url('" + fotoLatar(k.bg) + "')",
        onclick: function () { F = fAwal(); F.kol = k.id; $('#q').value = ''; tandaiTab(); gambarKategori(); saring(); gulirKeDaftar(); } },
        el('span', { class: 'koleksi-teks' }, el('b', { text: k.j }), k.s ? el('span', { text: k.s }) : null, el('small', { text: k.g.length + ' barang ›' })),
        foto.length ? el('span', { class: 'koleksi-foto' }, foto.map(function (f) { return imgKecil(f, ''); })) : null);
    }));
  }

  /* ---- pencarian yang tidak menemukan barang: dicatat anonim untuk bahan order toko ---- */
  var cariTerkirim = {}, cariT;
  function catatCariKosong(q) {
    clearTimeout(cariT);
    cariT = setTimeout(function () {
      var k = String(q).trim().toLowerCase();
      if (k.length < 3 || cariTerkirim[k] || F.q.trim().toLowerCase() !== k || hasil.length) return;
      cariTerkirim[k] = 1; antreCatat.push([k, 'c']); kirimCatat();
    }, 1800);
  }

  /* ---- pasang sebagai aplikasi di layar utama HP ---- */
  var mintaPasang = null;
  var sudahAplikasi = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if ('serviceWorker' in navigator && location.hostname === 'eigerkartasura.github.io') {
    addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* abaikan */ }); });
  }
  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); mintaPasang = e; if (D) gambarInfoToko(); });
  addEventListener('appinstalled', function () { mintaPasang = null; sudahAplikasi = true; toast('Katalog terpasang di layar utama'); if (D) gambarInfoToko(); });
  function bisaPasang() { return !sudahAplikasi && (!!mintaPasang || iOS); }
  function pasangAplikasi() {
    if (mintaPasang) { mintaPasang.prompt(); mintaPasang.userChoice.then(function () { mintaPasang = null; if (D) gambarInfoToko(); }); return; }
    bukaLembar([kepalaLembar('Pasang di layar utama'), el('div', { class: 'aman' },
      el('p', { text: 'Buka katalog seperti aplikasi, langsung dari ikon EIGER Kartasura di layar utama HP.' }),
      el('ol', { class: 'langkah langkah-pasang' },
        el('li', null, el('b', { text: 'Ketuk tombol Bagikan' }), el('span', { text: 'Ikon kotak dengan panah ke atas di bawah layar Safari.' })),
        el('li', null, el('b', { text: 'Pilih "Tambahkan ke Layar Utama"' }), el('span', { text: 'Gulir daftar pilihan bila belum terlihat.' })),
        el('li', null, el('b', { text: 'Ketuk "Tambah"' }), el('span', { text: 'Ikon katalog muncul di layar utama.' }))))], true);
  }

  /* ---- daftar tanya: beberapa barang sekaligus dalam satu pesan WhatsApp ---- */
  var KUNCI_DAFTAR = 'katalog2299.daftar';
  function bacaDaftar() { try { var x = JSON.parse(localStorage.getItem(KUNCI_DAFTAR) || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } }
  function simpanDaftar(x) { try { localStorage.setItem(KUNCI_DAFTAR, JSON.stringify(x.slice(0, 30))); } catch (e) { /* penuh */ } hitungDaftar(); }
  function hitungDaftar() {
    var n = bacaDaftar().length;
    [].forEach.call(document.querySelectorAll('.lencana-daftar'), function (b) { b.textContent = n > 9 ? '9+' : String(n); b.hidden = !n; });
    if (typeof perbaruiWaMelayang === 'function') perbaruiWaMelayang();
  }
  function tambahDaftar(it, warna, uk) {
    var x = bacaDaftar();
    if (x.some(function (d) { return d.g === it.g && d.w === warna && d.u === uk; })) { toast('Sudah ada di daftar'); return; }
    x.push({ g: it.g, w: warna, u: uk });
    simpanDaftar(x);
    toast('Ditambahkan ke daftar tanya (' + x.length + ')');
  }
  function barisDaftar() {
    var x = bacaDaftar(), G = {};
    D.items.forEach(function (it) { G[it.g] = it; });
    return x.map(function (d, i) {
      var it = G[d.g], w = it && it.w.filter(function (y) { return y[0] === d.w; })[0];
      var u = w && w[1].filter(function (y) { return y[0] === d.u; })[0];
      var pw = w && prWarna(w), harga = pw ? pw[1] : (w && w[2]) || (it && it.h) || 0;
      return { d: d, i: i, it: it, ada: !!(u && u[1]), harga: harga, promo: !!pw };
    });
  }
  function teksDaftar(baris) {
    if (!baris.length) return '';
    var t = 'Halo EIGER Kartasura, saya mau tanya ketersediaan barang berikut:\n';
    baris.forEach(function (b, k) {
      t += '\n' + (k + 1) + '. ' + (b.it ? namaTampil(b.it.n) : 'Kode ' + b.d.g) + ' (kode ' + b.d.g + ')\n   Warna ' + warnaInfo(b.d.w)[0].toLowerCase() +
        (b.d.u && b.d.u !== 'NOS' ? ', ukuran ' + b.d.u : '') + (b.harga ? ', ' + rp(b.harga) + (b.promo ? ' (promo)' : '') : '');
    });
    return t + '\n\nTerima kasih.';
  }
  function bukaDaftar() {
    var baris = barisDaftar();
    function teks() { return teksDaftar(baris); }
    bukaLembar([kepalaLembar('Daftar tanya'),
      el('div', { class: 'daftar-isi' },
        baris.length ? [
          el('p', { class: 'ket', text: 'Kumpulkan barang yang ingin ditanyakan, lalu kirim sekaligus dalam satu pesan WhatsApp ke toko. Daftar ini hanya tersimpan di HP Anda.' }),
          baris.map(function (b) {
            var f = b.it && fotoBersih(b.it)[0];
            return el('div', { class: 'baris-daftar' },
              el('button', { class: 'gb-kecil', type: 'button', 'aria-label': 'Buka ' + (b.it ? namaTampil(b.it.n) : b.d.g), onclick: function () { if (b.it) buka(b.it); } },
                f ? imgKecil(f, '') : svg(IKON_SEMUA)),
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
  /* ---------- info resmi produk (deskripsi, fitur, teknologi) dari eigeradventure ---------- */
  var INFO = {}, INFO_KUNCI = 'katalog2299.info', INFO_UMUR = 3 * 864e5;
  function ambilInfo(g, cb) {
    if (INFO[g] !== undefined) { cb(INFO[g]); return; }
    var simpan = {};
    try { simpan = JSON.parse(localStorage.getItem(INFO_KUNCI) || '{}') || {}; } catch (e) { simpan = {}; }
    var s = simpan[g];
    if (s && Date.now() - s[0] < INFO_UMUR) { INFO[g] = s[1]; cb(s[1]); return; }
    // mesin sudah menandai artikel yang punya info (it.i); yang tidak bertanda tidak perlu diminta
    var it = D && D.items.filter(function (x) { return x.g === g; })[0];
    if (ADA_I && it && !it.i) { INFO[g] = null; cb(null); return; }
    if (antreInfo[g]) { antreInfo[g].push(cb); return; }
    antreInfo[g] = [cb];
    function selesai(x) {
      INFO[g] = x || null;
      simpan[g] = [Date.now(), INFO[g]];
      var k = Object.keys(simpan);
      if (k.length > 80) k.sort(function (a, b) { return simpan[a][0] - simpan[b][0]; }).slice(0, k.length - 80).forEach(function (y) { delete simpan[y]; });
      try { localStorage.setItem(INFO_KUNCI, JSON.stringify(simpan)); } catch (e) { /* penuh */ }
      var cbs = antreInfo[g]; delete antreInfo[g];
      cbs.forEach(function (f) { f(INFO[g]); });
    }
    function langsung() {
      if (!CFG.API_URL) { delete antreInfo[g]; return; }
      fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'katalogInfo', g: g }), redirect: 'follow' })
        .then(function (r) { return r.json(); })
        .then(function (res) { if (res.ok) selesai(res.data); else delete antreInfo[g]; })
        .catch(function () { delete antreInfo[g]; });
    }
    // salinan statis di situs ini (cepat); bila belum ada, minta ke mesin
    fetch('data/info/' + g + '.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(selesai).catch(langsung);
  }
  var antreInfo = {}, ADA_I = false;
  function siapkanInfo(it) { if (it && it.i && INFO[it.g] === undefined) ambilInfo(it.g, function () {}); }
  function barisTeks(t) { return String(t || '').split('\n').map(function (b) { return b.trim(); }).filter(Boolean); }
  function poinTeks(t) { return barisTeks(t).map(function (b) { return b.replace(/^(?:[•\-–*]|\d{1,2}[.)])\s*/, ''); }).filter(Boolean); }
  function lipat(judulTeks, isi, terbuka) {
    var d = el('details', { class: 'lipat' }, el('summary', null, el('span', { text: judulTeks }), svg('<path d="m6 9 6 6 6-6"/>')), el('div', { class: 'lipat-isi' }, isi));
    if (terbuka) d.open = true;
    return d;
  }
  function isiInfo(wadah, dl, x) {
    if (!x) { isiUlang(wadah); return; }
    var bagian = [];
    var desk = barisTeks(x.d);
    if (desk.length) {
      var p = el('div', { class: 'desk' }, desk.map(function (b) { return el('p', { text: b }); }));
      var tombol = el('button', { class: 'selengkapnya', type: 'button', text: 'Baca selengkapnya', onclick: function () {
        var buka = p.classList.toggle('penuh'); tombol.textContent = buka ? 'Tutup' : 'Baca selengkapnya';
      } });
      bagian.push(el('div', { class: 'blok' }, el('h3', { text: 'Deskripsi produk' }),
        x.w ? el('div', { class: 'lencana-garansi' }, svg('<path d="M12 3 4 6v6c0 5 3.4 8.5 8 9 4.6-.5 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>'), el('span', null, el('b', { text: 'Garansi seumur hidup' }), ' untuk produk ini')) : null,
        p, tombol));
      requestAnimationFrame(function () { if (p.scrollHeight <= p.clientHeight + 4) tombol.remove(); });
    } else if (x.w) {
      bagian.push(el('div', { class: 'blok' }, el('div', { class: 'lencana-garansi' }, svg('<path d="M12 3 4 6v6c0 5 3.4 8.5 8 9 4.6-.5 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>'), el('span', null, el('b', { text: 'Garansi seumur hidup' }), ' untuk produk ini'))));
    }
    var fitur = poinTeks(x.f);
    if (fitur.length) bagian.push(el('div', { class: 'blok' }, el('h3', { text: 'Fitur & keunggulan' }),
      el('ul', { class: 'fitur' }, fitur.slice(0, 14).map(function (f) { return el('li', null, svg('<path d="m5 12 5 5 9-10"/>'), el('span', { text: f })); }))));
    var tek = (x.t || []).filter(function (t) { return t && t.t; });
    if (tek.length) bagian.push(el('div', { class: 'blok' }, el('h3', { text: 'Teknologi' }),
      el('div', { class: 'teknologi' }, tek.map(function (t) {
        return el('div', { class: 'tek' },
          t.i ? el('img', { src: t.i, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: function () { this.remove(); } }) : el('span', { class: 'tek-ikon', text: t.t.charAt(0) }),
          el('div', null, el('b', { text: t.t }), t.d ? el('span', { text: t.d }) : null));
      }))));
    var mat = poinTeks(x.m), rawat = poinTeks(x.p);
    if (mat.length || rawat.length) bagian.push(el('div', { class: 'blok blok-lipat' },
      mat.length ? lipat('Material', el('ul', { class: 'poin' }, mat.map(function (b) { return el('li', { text: b }); })), true) : null,
      rawat.length ? lipat('Cara perawatan', el('ul', { class: 'poin' }, rawat.map(function (b) { return el('li', { text: b }); }))) : null));
    if (bagian.length) bagian.push(el('p', { class: 'sumber-info', text: 'Info produk dari eigeradventure.com. Ketersediaan & harga mengikuti toko.' }));
    isiUlang(wadah, bagian);
    if (dl && !dl.querySelector('.dari-info')) {
      var dm = poinTeks(x.dm).join(', '), b = Number(x.b);
      var kode = dl.querySelector('dt:nth-last-of-type(2)');
      var tambahan = [];
      if (dm) tambahan.push(el('dt', { class: 'dari-info', text: 'Dimensi' }), el('dd', { text: dm }));
      if (b > 0) tambahan.push(el('dt', { class: 'dari-info', text: 'Berat paket' }), el('dd', { text: b >= 1000 ? nf.format(b / 1000) + ' kg' : nf.format(b) + ' gram' }));
      tambahan.forEach(function (n) { dl.insertBefore(n, kode); });
    }
  }

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
        return el('button', { class: 'mini', type: 'button', onclick: function () { buka(x); }, onpointerenter: function () { siapkanInfo(x); } },
          el('div', { class: 'gb' }, imgKecil(fotoBersih(x)[0], namaTampil(x.n)), p ? labelDiskon(p.d) : null),
          el('span', { class: 'mini-nama', text: namaTampil(x.n) }),
          hargaDari(x) ? hargaEl(hargaDari(x)) : el('span', { class: 'harga tanya', text: 'Tanya harga' }));
      })));
  }

  /* ---- info toko: alamat, jam buka (status buka/tutup), peta, WhatsApp resmi ---- */
  function jamToko() {
    var I = D.infoToko || {};
    var jBuka = (I.buka || '08:30').split(':').map(Number), jTutup = (I.tutup || '21:45').split(':').map(Number);
    var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })), m = now.getHours() * 60 + now.getMinutes();
    var mBuka = jBuka[0] * 60 + jBuka[1], mTutup = jTutup[0] * 60 + jTutup[1], buka = m >= mBuka && m < mTutup;
    var jam = function (a) { return dua(a[0]) + '.' + dua(a[1]); };
    return { buka: buka, teks: buka ? 'Buka · tutup ' + jam(jTutup) : 'Tutup · buka ' + jam(jBuka) + (m >= mTutup ? ' besok' : '') };
  }
  function waTampil() { return '0' + String(D.wa || '6281120022574').replace(/^62/, '').replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3'); }
  /** Info toko ringkas satu baris; detail lengkap di lembar "Info toko". */
  function gambarInfoToko() {
    var I = D.infoToko || {}, box = $('#infoToko');
    if (!box) return;
    var J = jamToko();
    isiUlang(box,
      el('span', { class: 'status-buka' + (J.buka ? '' : ' tutup') }, el('i'), J.teks),
      I.maps ? el('a', { class: 'info-link', href: I.maps, target: '_blank', rel: 'noopener' }, svg(IKON_LOKASI), 'Petunjuk arah') : null,
      I.ulasan ? el('a', { class: 'info-link info-rating', href: I.ulasan, target: '_blank', rel: 'noopener' }, el('span', { class: 'bintang', 'aria-hidden': 'true', text: '★' }), (I.rating ? I.rating + ' · ' : '') + 'Ulasan Google') : null,
      el('button', { class: 'info-link', type: 'button', onclick: bukaInfoToko }, 'Info toko ›'),
      bisaPasang() ? el('button', { class: 'info-link info-pasang', type: 'button', onclick: pasangAplikasi }, svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'), 'Pasang aplikasi') : null,
      el('span', { class: 'info-update', id: 'update', text: D.diperbarui ? 'Stok per ' + tglUpdate(D.diperbarui) : '' }));
  }
  function bukaInfoToko() {
    var I = D.infoToko || {}, J = jamToko();
    bukaLembar([kepalaLembar('Info toko'), el('div', { class: 'aman' },
      el('b', { class: 'info-nama', text: 'EIGER Store A. Yani Kartasura' }),
      el('dl', { class: 'detail-baris' },
        el('dt', { text: 'Status' }), el('dd', null, el('span', { class: 'status-buka' + (J.buka ? '' : ' tutup') }, el('i'), J.teks)),
        el('dt', { text: 'Jam buka' }), el('dd', { text: I.jam || 'Setiap hari 08.30–21.45' }),
        el('dt', { text: 'Alamat' }), el('dd', { text: I.alamat || 'Kartasura, Sukoharjo' }),
        el('dt', { text: 'WhatsApp' }), el('dd', { text: waTampil() + ' (resmi)' }),
        el('dt', { text: 'Stok' }), el('dd', { text: D.diperbarui ? 'Data per ' + tglUpdate(D.diperbarui) : '-' })),
      I.ulasan ? el('a', { class: 'kartu-ulasan', href: I.ulasan, target: '_blank', rel: 'noopener' },
        el('b', { class: 'angka-rating', text: I.rating || '★' }),
        el('span', null, el('span', { class: 'bintang-5', 'aria-hidden': 'true', text: '★★★★★' }), el('small', { text: (I.jmlUlasan ? I.jmlUlasan + ' ulasan pelanggan di Google' : 'Ulasan pelanggan di Google') }), el('em', { text: 'Baca ulasan ›' }))) : null,
      el('div', { class: 'kartu-eac' },
        el('b', { text: 'Belanja sebagai member EAC (Eiger Adventure Club)' }),
        el('ul', null,
          el('li', { text: 'Daftar gratis lewat aplikasi EIGER Adventure (Google Play / App Store), akun langsung jadi member EAC.' }),
          el('li', { text: 'Di kasir, tunjukkan QR member dari menu Membership sebelum membayar agar poin tercatat.' }),
          el('li', { text: 'Dapat poin setiap belanja, promo khusus member, dan poin bisa dipakai memotong harga atau ditukar voucher.' })),
        el('small', { text: 'Pendaftaran hanya lewat aplikasi, tidak bisa di toko. Ketentuan mengikuti EIGER Adventure.' })),
      el('div', { class: 'info-aksi' },
        I.maps ? el('a', { class: 'tombol garis kecil', href: I.maps, target: '_blank', rel: 'noopener' }, svg(IKON_LOKASI), 'Petunjuk arah') : null,
        el('a', { class: 'tombol kecil', href: waLink('Halo EIGER Kartasura, saya mau tanya.'), target: '_blank', rel: 'noopener' }, svg(IKON_WA), 'WhatsApp toko'),
        el('button', { class: 'tombol garis kecil', type: 'button', onclick: bukaAman }, svg(IKON_PERISAI), 'Cek katalog resmi'),
        bisaPasang() ? el('button', { class: 'tombol garis kecil', type: 'button', onclick: pasangAplikasi }, 'Pasang aplikasi') : null))], true);
  }

  /* ---- panduan singkat untuk pengunjung pertama (sekali saja) ---- */
  function gambarPanduanAwal() {
    var box = $('#panduanAwal');
    if (!box) return;
    var sudah = false;
    try { sudah = localStorage.getItem('katalog2299.paham') === '1'; } catch (e) { sudah = false; }
    box.hidden = sudah;
    if (sudah) return;
    isiUlang(box,
      el('div', { class: 'panduan-awal-kepala' }, el('b', { text: 'Cara pakai katalog' }),
        el('button', { class: 'info-link', type: 'button', text: 'Mengerti', onclick: function () { try { localStorage.setItem('katalog2299.paham', '1'); } catch (e) { /* abaikan */ } box.hidden = true; } })),
      el('ol', { class: 'langkah' },
        el('li', null, el('b', { text: 'Pilih barang' }), el('span', { text: 'Cari atau buka kategori.' })),
        el('li', null, el('b', { text: 'Pilih warna & ukuran' }), el('span', { text: 'Ukuran dicoret sedang kosong. Ketuk untuk minta dikabari.' })),
        el('li', null, el('b', { text: 'Tanya stok' }), el('span', { text: 'Kirim ke WhatsApp toko, satu atau beberapa barang sekaligus.' }))));
  }

  /* ---- saran pencarian: riwayat + pencarian populer ---- */
  var KUNCI_CARI = 'katalog2299.cari';
  function riwayatCari() { try { var x = JSON.parse(localStorage.getItem(KUNCI_CARI) || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } }
  function simpanCari(q) {
    q = String(q || '').trim(); if (q.length < 2) return;
    var x = riwayatCari().filter(function (y) { return y.toLowerCase() !== q.toLowerCase(); });
    x.unshift(q);
    try { localStorage.setItem(KUNCI_CARI, JSON.stringify(x.slice(0, 6))); } catch (e) { /* abaikan */ }
  }
  function gambarSaranCari() {
    var box = $('#saranCari');
    if (!box || !D) return;
    var hit = {};
    D.items.forEach(function (it) { hit[it.k4] = (hit[it.k4] || 0) + 1; });
    var populer = Object.keys(hit).sort(function (a, b) { return hit[b] - hit[a]; }).slice(0, 10).map(subNama).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 8);
    var pakai = function (q) { $('#q').value = q; F.q = q; simpanCari(q); saring(); $('#q').blur(); box.hidden = true; gulirKeDaftar(); };
    var r = riwayatCari();
    isiUlang(box,
      r.length ? [el('div', { class: 'saran-kepala' }, el('b', { text: 'Terakhir dicari' }),
        el('button', { class: 'info-link', type: 'button', text: 'Hapus', onmousedown: function (e) { e.preventDefault(); try { localStorage.removeItem(KUNCI_CARI); } catch (x) { /* abaikan */ } gambarSaranCari(); } })),
        el('div', { class: 'saran-chip' }, r.map(function (q) { return el('button', { class: 'chip', type: 'button', text: q, onmousedown: function (e) { e.preventDefault(); pakai(q); } }); }))] : null,
      el('div', { class: 'saran-kepala' }, el('b', { text: 'Sering dicari' })),
      el('div', { class: 'saran-chip' },
        promoAktif() ? el('button', { class: 'chip chip-promo', type: 'button', text: 'Barang promo', onmousedown: function (e) { e.preventDefault(); box.hidden = true; $('#q').blur(); pilihPromo(true); } }) : null,
        populer.map(function (q) { return el('button', { class: 'chip', type: 'button', text: q, onmousedown: function (e) { e.preventDefault(); pakai(q); } }); })));
  }
  (function pasangSaranCari() {
    var q = $('#q'), box = $('#saranCari');
    if (!box) return;
    q.addEventListener('focus', function () { if (!D) return; gambarSaranCari(); box.hidden = !!q.value.trim(); });
    q.addEventListener('input', function () { box.hidden = !!q.value.trim(); });
    q.addEventListener('blur', function () { setTimeout(function () { box.hidden = true; }, 120); if (q.value.trim() && hasil.length) simpanCari(q.value); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { box.hidden = true; q.blur(); } });
  })();

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

  /* ================= kenyamanan belanja ================= */

  /* ---- baru kamu lihat ---- */
  var KUNCI_LIHAT = 'katalog2299.lihat';
  function bacaLihat() { try { var x = JSON.parse(localStorage.getItem(KUNCI_LIHAT) || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } }
  function catatLihat(g) {
    var x = bacaLihat().filter(function (y) { return y !== g; });
    x.unshift(g);
    try { localStorage.setItem(KUNCI_LIHAT, JSON.stringify(x.slice(0, 16))); } catch (e) { /* abaikan */ }
    lihatBerubah = true;
  }
  var lihatBerubah = false;
  function gambarTerakhir() {
    var box = $('#terakhirKotak');
    if (!box || !D) return;
    lihatBerubah = false;
    var G = {};
    D.items.forEach(function (it) { G[it.g] = it; });
    var xs = bacaLihat().map(function (g) { return G[g]; }).filter(Boolean).slice(0, 12);
    box.hidden = !xs.length;
    isiUlang($('#terakhirRel'), xs.map(function (it) {
      var p = prItem(it), f = fotoBersih(it)[0], h = hargaKini(it);
      return el('button', { class: 'mini', type: 'button', onclick: function () { buka(it); }, onpointerenter: function () { siapkanInfo(it); } },
        el('div', { class: 'gb' }, f ? imgKecil(f, namaTampil(it.n)) : el('div', { class: 'tanpa-foto' }, svg((KAT[it.k3] || {}).ikon || IKON_SEMUA)), p ? labelDiskon(p.d) : null),
        el('span', { class: 'mini-nama', text: namaTampil(it.n) }),
        h ? hargaEl(h) : el('span', { class: 'harga tanya', text: 'Tanya harga' }));
    }));
  }
  (function () {
    var hapus = $('#terakhirHapus');
    if (hapus) hapus.addEventListener('click', function () { try { localStorage.removeItem(KUNCI_LIHAT); } catch (e) { /* abaikan */ } gambarTerakhir(); });
  })();

  /* ---- ukuranku: pelanggan menyimpan ukuran baju, celana, sepatu ---- */
  var KUNCI_UK = 'katalog2299.ukuranku';
  function bacaUk() { try { var x = JSON.parse(localStorage.getItem(KUNCI_UK) || 'null'); return x && typeof x === 'object' ? { b: x.b || [], c: x.c || [], s: x.s || [] } : { b: [], c: [], s: [] }; } catch (e) { return { b: [], c: [], s: [] }; } }
  function ukAda() { var u = bacaUk(); return u.b.length + u.c.length + u.s.length > 0; }
  function ukTersediaSemua(it) {
    var ada = [];
    it.w.forEach(function (w) { w[1].forEach(function (u) { if (u[1] && u[0] !== 'NOS' && ada.indexOf(u[0]) < 0) ada.push(u[0]); }); });
    return ada;
  }
  function grupUk(it) {
    if (it.k3 === 'FOOTWEAR' && !/SOCK|SHOELACE/.test(it.k4)) return 's';
    if (it.k3 !== 'APPAREL') return '';
    var semua = [];
    it.w.forEach(function (w) { w[1].forEach(function (u) { if (u[0] !== 'NOS') semua.push(u[0]); }); });
    if (!semua.length) return '';
    return semua.every(function (u) { return /^\d{2}$/.test(u); }) ? 'c' : 'b';
  }
  /** Ukuran milik pelanggan yang berlaku untuk barang ini (baju / celana / sepatu). */
  function ukurankuUntuk(it) { var g = grupUk(it); return g ? bacaUk()[g] : []; }
  function cocokUkuranku(it) {
    var mine = ukurankuUntuk(it);
    return mine.length > 0 && ukTersediaSemua(it).some(function (u) { return mine.indexOf(u) >= 0; });
  }
  function ringkasUk() { var u = bacaUk(); return [].concat(u.b, u.c, u.s).join(' · '); }
  function bukaUkuranku() {
    var pilih = bacaUk(), opsi = { b: {}, c: {}, s: {} };
    D.items.forEach(function (it) { var g = grupUk(it); if (!g) return; it.w.forEach(function (w) { w[1].forEach(function (u) { if (u[0] !== 'NOS') opsi[g][u[0]] = 1; }); }); });
    var JUDUL = { b: ['Baju & jaket', 'Kaos, kemeja, jaket, celana berukuran huruf'], c: ['Celana (ukuran angka)', 'Lingkar pinggang'], s: ['Sepatu & sandal', 'Ukuran EU'] };
    function grup(k) {
      var xs = Object.keys(opsi[k]).sort(urutUk);
      if (!xs.length) return null;
      return el('div', { class: 'uk-grup' }, el('b', { text: JUDUL[k][0] }), el('small', { text: JUDUL[k][1] }),
        el('div', { class: 'pilihan pilihan-ukuran' }, xs.map(function (u) {
          var on = pilih[k].indexOf(u) >= 0;
          return el('button', { type: 'button', 'aria-pressed': String(on), text: u, onclick: function (e) {
            var i = pilih[k].indexOf(u); if (i >= 0) pilih[k].splice(i, 1); else pilih[k].push(u);
            e.currentTarget.setAttribute('aria-pressed', String(i < 0));
          } });
        })));
    }
    bukaLembar([kepalaLembar('Ukuranku'), el('div', { class: 'aman ukuranku' },
      el('p', { class: 'ket', text: 'Pilih ukuran yang biasa Anda pakai. Katalog lalu hanya menampilkan barang yang ukuran Anda tersedia di toko. Tersimpan di HP ini saja.' }),
      grup('b'), grup('c'), grup('s'),
      el('div', { class: 'daftar-aksi' },
        el('button', { class: 'tombol garis', type: 'button', text: 'Hapus ukuranku', onclick: function () {
          try { localStorage.removeItem(KUNCI_UK); } catch (e) { /* abaikan */ } F.uk = false; tutup(); saring(); toast('Ukuranku dihapus');
        } }),
        el('button', { class: 'tombol', type: 'button', text: 'Tampilkan ukuranku', onclick: function () {
          try { localStorage.setItem(KUNCI_UK, JSON.stringify(pilih)); } catch (e) { /* abaikan */ }
          F.uk = ukAda(); tutup(); saring(); gulirKeDaftar();
          if (F.uk) toast(hasil.length + ' barang tersedia di ukuran Anda');
        } })))], true);
    if (location.hash !== '#ukuranku') history.pushState(null, '', '#ukuranku');
  }

  /* ---- bandingkan 2–3 barang ---- */
  var KUNCI_BANDING = 'katalog2299.banding', MAKS_BANDING = 3;
  function bacaBanding() { try { var x = JSON.parse(localStorage.getItem(KUNCI_BANDING) || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } }
  function simpanBanding(x) { try { localStorage.setItem(KUNCI_BANDING, JSON.stringify(x.slice(0, MAKS_BANDING))); } catch (e) { /* abaikan */ } gambarBandingBar(); }
  function toggleBanding(it) {
    var x = bacaBanding(), i = x.indexOf(it.g);
    if (i >= 0) { x.splice(i, 1); simpanBanding(x); toast('Dihapus dari perbandingan'); return; }
    if (x.length >= MAKS_BANDING) { toast('Maksimal ' + MAKS_BANDING + ' barang. Hapus salah satu dulu.'); return; }
    x.push(it.g); simpanBanding(x);
    toast(x.length > 1 ? x.length + ' barang siap dibandingkan' : 'Pilih 1–2 barang lain untuk dibandingkan');
  }
  function gambarBandingBar() {
    var bar = $('#bandingBar');
    if (!bar || !D) return;
    var G = {};
    D.items.forEach(function (it) { G[it.g] = it; });
    var x = bacaBanding().filter(function (g) { return G[g]; });
    bar.hidden = !x.length;
    isiUlang(bar,
      el('span', { class: 'banding-foto' }, x.map(function (g) { var f = fotoBersih(G[g])[0]; return f ? imgKecil(f, '') : el('i'); })),
      el('button', { class: 'banding-buka', type: 'button', onclick: function () { if (x.length < 2) toast('Pilih minimal 2 barang'); else bukaBanding(); } },
        x.length < 2 ? 'Pilih 1 barang lagi' : 'Bandingkan ' + x.length + ' barang'),
      el('button', { class: 'banding-tutup', type: 'button', 'aria-label': 'Kosongkan perbandingan', text: '×', onclick: function () { simpanBanding([]); } }));
  }
  function bukaBanding() {
    var G = {};
    D.items.forEach(function (it) { G[it.g] = it; });
    var xs = bacaBanding().map(function (g) { return G[g]; }).filter(Boolean);
    if (!xs.length) { tutup(); return; }
    var info = function (it) { return INFO[it.g] || null; };
    var menunggu = xs.filter(function (it) { return it.i && INFO[it.g] === undefined; });
    menunggu.forEach(function (it) { ambilInfo(it.g, function () { if (dlg.open && location.hash === '#banding') bukaBanding(); }); });
    var warna = function (it) { return it.w.map(function (w) { return warnaInfo(w[0])[0]; }).join(', '); };
    var baris = [
      ['Harga', function (it) { var p = prItem(it), h = hargaKini(it); return h ? el('span', null, hargaEl(h), p ? el('em', { class: 'banding-diskon', text: ' -' + p.d + '%' }) : null) : 'Tanya harga'; }],
      ['Ukuran tersedia', function (it) { var u = ukTersediaSemua(it).sort(urutUk); return u.length ? u.join(', ') : 'All size'; }],
      ['Warna', warna],
      ['Kategori', function (it) { return subNama(it.k4); }],
      ['Untuk', function (it) { return genderNama(it.gd) || '–'; }],
      ['Aktivitas', function (it) { return it.ac ? judul(it.ac) : '–'; }],
      ['Garansi', function (it) { var x = info(it); return it.wg || (x && x.w) ? 'Seumur hidup' : '–'; }],
      ['Material', function (it) { var x = info(it); return x ? (poinTeks(x.m).join('; ') || '–') : (it.i ? '…' : '–'); }],
      ['Berat paket', function (it) { var x = info(it), b = x && Number(x.b); return b > 0 ? (b >= 1000 ? nf.format(b / 1000) + ' kg' : nf.format(b) + ' gram') : (it.i && !x ? '…' : '–'); }],
      ['Dimensi', function (it) { var x = info(it); return x ? (poinTeks(x.dm).join(', ') || '–') : (it.i ? '…' : '–'); }],
      ['Teknologi', function (it) { var x = info(it); return x ? ((x.t || []).map(function (t) { return t.t; }).join(', ') || '–') : (it.i ? '…' : '–'); }],
      ['Fitur utama', function (it) { var x = info(it); if (!x) return it.i ? '…' : '–'; var f = poinTeks(x.f).slice(0, 4); return f.length ? el('ul', null, f.map(function (t) { return el('li', { text: t }); })) : '–'; }]
    ];
    var tabel = el('div', { class: 'banding-tabel', style: '--kolom:' + xs.length },
      el('div', { class: 'banding-sel kepala' }),
      xs.map(function (it) {
        var f = fotoBersih(it)[0];
        return el('div', { class: 'banding-sel kepala' },
          el('button', { class: 'banding-hapus', type: 'button', 'aria-label': 'Hapus ' + namaTampil(it.n), text: '×', onclick: function () { var y = bacaBanding().filter(function (g) { return g !== it.g; }); simpanBanding(y); if (y.length) bukaBanding(); else tutup(); } }),
          el('button', { class: 'banding-produk', type: 'button', onclick: function () { buka(it); } },
            el('div', { class: 'gb' }, f ? imgKecil(f, namaTampil(it.n)) : el('div', { class: 'tanpa-foto' }, svg((KAT[it.k3] || {}).ikon || IKON_SEMUA))),
            el('b', { text: namaTampil(it.n) }), el('small', { text: 'Lihat detail ›' })));
      }),
      baris.map(function (b) {
        return [el('div', { class: 'banding-sel label', text: b[0] })].concat(xs.map(function (it) {
          var v = b[1](it);
          return el('div', { class: 'banding-sel' }, typeof v === 'string' ? el('span', { text: v }) : v);
        }));
      }));
    bukaLembar([kepalaLembar('Bandingkan barang'), el('div', { class: 'banding' },
      xs.length < 2 ? el('p', { class: 'ket', text: 'Tambahkan 1–2 barang lagi lewat tombol "Bandingkan" di halaman produk.' }) : null,
      el('div', { class: 'banding-gulir' }, tabel),
      el('div', { class: 'daftar-aksi' },
        el('button', { class: 'tombol garis', type: 'button', text: 'Kosongkan', onclick: function () { simpanBanding([]); tutup(); } }),
        el('a', { class: 'tombol', target: '_blank', rel: 'noopener', href: waLink('Halo EIGER Kartasura, saya sedang membandingkan:\n' + xs.map(function (it, i) { return (i + 1) + '. ' + namaTampil(it.n) + ' (kode ' + it.g + ')'; }).join('\n') + '\n\nBoleh minta saran mana yang cocok dan apakah tersedia di toko?') },
          svg(IKON_WA), 'Minta saran toko')))], 'lembar-banding', location.hash === '#banding');
    if (location.hash !== '#banding') history.pushState(null, '', '#banding');
  }

  /* ---- WhatsApp pintar: isi pesan mengikuti barang yang sedang dilihat / daftar tanya ---- */
  var teksProdukKini = '';
  function waPintar() {
    if (teksProdukKini && dlg.open) return waLink(teksProdukKini);
    var t = D ? teksDaftar(barisDaftar()) : '';
    return waLink(t || 'Halo EIGER Kartasura, saya mau tanya barang.');
  }
  ['#waAtas', '#waBawah', '#waMelayang'].forEach(function (s) {
    var a = $(s); if (!a) return;
    a.addEventListener('click', function () { a.href = waPintar(); });
  });
  function perbaruiWaMelayang() {
    var a = $('#waMelayang'); if (!a) return;
    var n = D ? bacaDaftar().length : 0;
    var lab = a.querySelector('span');
    if (lab) lab.textContent = n ? 'Tanya ' + n + ' barang' : 'Chat toko';
  }

  /* ---- menu atas komputer: Pria / Wanita / Anak / kategori, dengan daftar sub-kategori saat kursor diarahkan ---- */
  function terapkan(isi) { tutup(); tutupPop(); F = fAwal(); $('#q').value = ''; Object.keys(isi).forEach(function (k) { F[k] = isi[k]; }); tandaiTab(); gambarKategori(); saring(); gulirKeDaftar(); }
  function gambarMenuAtas() {
    var nav = $('#menuAtas');
    if (!nav || !D) return;
    var per = function (saring) {
      var o = {};
      D.items.forEach(function (it) { if (!saring(it)) return; (o[it.k3] = o[it.k3] || {})[it.k4] = ((o[it.k3] || {})[it.k4] || 0) + 1; });
      return o;
    };
    var urutK3 = function (a, b) { return ((KAT[a] || {}).urut || 9) - ((KAT[b] || {}).urut || 9); };
    function mega(o, dasar) {
      return el('div', { class: 'mega' }, el('div', { class: 'mega-in' }, Object.keys(o).sort(urutK3).map(function (k3) {
        var k4s = Object.keys(o[k3]).sort(function (a, b) { return o[k3][b] - o[k3][a]; });
        return el('div', { class: 'mega-kol' },
          el('button', { class: 'mega-judul', type: 'button', text: katNama(k3), onclick: function () { terapkan(Object.assign({ k3: k3 }, dasar)); } }),
          k4s.slice(0, 9).map(function (k4) {
            return el('button', { type: 'button', onclick: function () { terapkan(Object.assign({ k3: k3, k4: k4 }, dasar)); } }, subNama(k4), el('small', { text: String(o[k3][k4]) }));
          }));
      })));
    }
    var isi = [];
    ['Pria', 'Wanita', 'Anak'].forEach(function (g) {
      var o = per(function (it) { return cocokGender(it, g); });
      if (!Object.keys(o).length) return;
      isi.push(el('div', { class: 'menu-item' }, el('button', { class: 'menu-atas-btn', type: 'button', text: g, onclick: function () { terapkan({ gds: [g] }); } }), mega(o, { gds: [g] })));
    });
    Object.keys(per(function () { return true; })).sort(urutK3).forEach(function (k3) {
      var o = per(function (it) { return it.k3 === k3; });
      isi.push(el('div', { class: 'menu-item' }, el('button', { class: 'menu-atas-btn', type: 'button', text: katNama(k3), onclick: function () { terapkan({ k3: k3 }); } }), mega(o, {})));
    });
    if (D.items.some(prItem)) isi.push(el('div', { class: 'menu-item' }, el('button', { class: 'menu-atas-btn promo', type: 'button', text: 'Promo', onclick: function () { terapkan({ promo: true, urut: 'diskon' }); } })));
    isi.push(el('div', { class: 'menu-item' }, el('button', { class: 'menu-atas-btn', type: 'button', text: 'Baru di toko', onclick: function () { terapkan({ baru: true }); } })));
    isiUlang(nav, el('div', { class: 'menu-atas-in' }, isi));
    ukurAtas();
  }

  /* ---- paling banyak dilihat minggu ini (dari catatan anonim) ---- */
  function gambarPopuler() {
    var box = $('#populerKotak');
    if (!box) return;
    var G = {};
    D.items.forEach(function (it) { G[it.g] = it; });
    var xs = (D.populer || []).map(function (g) { return G[g]; }).filter(function (it) { return it && fotoBersih(it).length; }).slice(0, 12);
    box.hidden = xs.length < 4;
    isiUlang($('#populerRel'), xs.map(function (it, i) {
      var p = prItem(it), h = hargaKini(it);
      return el('button', { class: 'mini mini-populer', type: 'button', onclick: function () { buka(it); }, onpointerenter: function () { siapkanInfo(it); } },
        el('div', { class: 'gb' }, imgKecil(fotoBersih(it)[0], namaTampil(it.n)), el('span', { class: 'peringkat', text: String(i + 1) }), p ? labelDiskon(p.d) : null),
        el('span', { class: 'mini-nama', text: namaTampil(it.n) }),
        h ? hargaEl(h) : el('span', { class: 'harga tanya', text: 'Tanya harga' }));
    }));
  }

  /* ---- cocok dipakai bersama: pasangan per sub-kategori ---- */
  var PASANGAN = {
    CARRIER: ['BAG COVER', 'RAIN COVER', 'WATER STORAGE', 'LIGHTING EQUIPMENT', 'SLEEPING BAG', 'MAT & COT', 'KITCHENWARE', 'RAINWEAR'],
    BACKPACK: ['BAG COVER', 'RAIN COVER', 'WATER STORAGE', 'POUCH', 'WALLET', 'CAPS'],
    DAYPACK: ['BAG COVER', 'WATER STORAGE', 'POUCH', 'CAPS', 'RAINWEAR'],
    'SLING BAG': ['WALLET', 'POUCH', 'CAPS', 'WATER STORAGE'], 'WAIST BAG': ['WALLET', 'POUCH', 'CAPS'],
    'MOTORCYCLE BAG': ['RAINWEAR', 'GLOVES', 'RIDING EQUIPMENT', 'BAG COVER'],
    SHOES: ['SOCK', 'SOCKS', 'GAITER', 'SHOELACE', 'PANTS', 'CAPS'], SANDAL: ['SOCK', 'CAPS', 'SHORTS', 'TOP'], BOOTS: ['SOCK', 'GAITER', 'PANTS'],
    JACKET: ['PANTS', 'CAPS', 'BEANIES', 'GLOVES', 'TOP', 'BUFF'], RAINWEAR: ['BAG COVER', 'CAPS', 'PANTS', 'SHOES'],
    TOP: ['PANTS', 'SHORTS', 'CAPS', 'SANDAL', 'JACKET'], SHIRT: ['PANTS', 'SHORTS', 'CAPS', 'BELTS'], PANTS: ['TOP', 'SHIRT', 'BELTS', 'SHOES', 'JACKET'],
    SHORTS: ['TOP', 'SANDAL', 'CAPS'], VEST: ['TOP', 'PANTS', 'CAPS'], BASELAYER: ['JACKET', 'PANTS', 'BEANIES'],
    TENTS: ['SLEEPING BAG', 'MAT & COT', 'LIGHTING EQUIPMENT', 'KITCHENWARE', 'CHAIR'], 'SLEEPING BAG': ['TENTS', 'MAT & COT', 'SLEEPING ACCS', 'LIGHTING EQUIPMENT'],
    KITCHENWARE: ['WATER STORAGE', 'TENTS', 'CHAIR', 'LIGHTING EQUIPMENT'], 'WATER STORAGE': ['BACKPACK', 'DAYPACK', 'KITCHENWARE'],
    CAPS: ['TOP', 'SUNGLASSES', 'BUFF'], HATS: ['TOP', 'SUNGLASSES', 'BUFF'], WALLET: ['BELTS', 'SLING BAG', 'WATCHES']
  };
  function blokPasangan(it) {
    var mau = PASANGAN[it.k4];
    if (!mau) return null;
    var gd = genderNama(it.gd);
    var calon = D.items.filter(function (x) { return x.g !== it.g && mau.indexOf(x.k4) >= 0 && fotoBersih(x).length; });
    // satu barang per sub-kategori, utamakan aktivitas & gender yang sama
    var skor = function (x) { return (x.ac && x.ac === it.ac ? 2 : 0) + (gd && genderNama(x.gd) === gd ? 1 : 0) + (prItem(x) ? 0.5 : 0); };
    var pilih = [];
    mau.forEach(function (k4) {
      var xs = calon.filter(function (x) { return x.k4 === k4; }).sort(function (a, b) { return skor(b) - skor(a); });
      if (xs[0]) pilih.push(xs[0]);
      if (xs[1] && pilih.length < 4) pilih.push(xs[1]);
    });
    pilih = pilih.filter(function (x, i) { return pilih.indexOf(x) === i; }).slice(0, 8);
    if (pilih.length < 2) return null;
    return el('div', { class: 'blok' }, el('h3', { text: 'Cocok dipakai bersama' }),
      el('div', { class: 'strip-rel serupa' }, pilih.map(function (x) {
        var p = prItem(x), h = hargaKini(x);
        return el('button', { class: 'mini', type: 'button', onclick: function () { buka(x); }, onpointerenter: function () { siapkanInfo(x); } },
          el('div', { class: 'gb' }, imgKecil(fotoBersih(x)[0], namaTampil(x.n)), p ? labelDiskon(p.d) : null),
          el('span', { class: 'mini-sub', text: subNama(x.k4) }),
          el('span', { class: 'mini-nama', text: namaTampil(x.n) }),
          h ? hargaEl(h) : el('span', { class: 'harga tanya', text: 'Tanya harga' }));
      })));
  }

  /* ---- bilah atas menyusut saat digulir (HP) & tombol kembali ke atas ---- */
  (function () {
    var naik = el('button', { class: 'ke-atas', type: 'button', 'aria-label': 'Kembali ke atas', hidden: true, onclick: function () { scrollTo({ top: 0, behavior: 'smooth' }); } }, svg('<path d="m6 15 6-6 6 6"/>'));
    document.body.appendChild(naik);
    var susut = false, t = 0;
    addEventListener('scroll', function () {
      var y = scrollY;
      naik.hidden = y < 1400;
      var s = susut ? y > 40 : y > 140;
      if (s !== susut && Date.now() - t > 250) { susut = s; t = Date.now(); document.body.classList.toggle('menyusut', s); setTimeout(ukurAtas, 220); }
    }, { passive: true });
  })();

  /* ---------- menu bawah & kontrol ---------- */
  function tandaiMenu(m) { [].forEach.call(document.querySelectorAll('.menu-bawah button'), function (b) { if (b.getAttribute('data-m') === m) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }
  document.querySelector('.menu-bawah').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !D) return;
    var m = b.getAttribute('data-m'); tandaiMenu(m);
    if (m === 'beranda') { tutup(); F = fAwal(); $('#q').value = ''; tandaiTab(); gambarKategori(); saring(); scrollTo({ top: 0, behavior: 'smooth' }); }
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
