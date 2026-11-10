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
  function ikon(path, kelas) { return el('span', { class: kelas || '', 'aria-hidden': 'true', svg: '<svg viewBox="0 0 24 24">' + path + '</svg>' }); }
  var nf = new Intl.NumberFormat('id-ID');
  function rp(n) { return 'Rp' + nf.format(Math.round(n)); }
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
  function hargaTeks(it) {
    if (!it.h) return null;
    return it.hm ? rp(it.hm) + ' – ' + nf.format(it.h) : rp(it.h);
  }
  function waLink(teks) { return 'https://wa.me/' + (D && D.wa || '6281120022574') + '?text=' + encodeURIComponent(teks); }
  var toastT;
  function toast(t) {
    var x = $('.toast') || document.body.appendChild(el('div', { class: 'toast', role: 'status' }));
    x.textContent = t; x.classList.add('tampil');
    clearTimeout(toastT); toastT = setTimeout(function () { x.classList.remove('tampil'); }, 2600);
  }
  function tglUpdate(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
    if (!m) return '';
    var B = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return Number(m[3]) + ' ' + B[Number(m[2]) - 1] + ' ' + m[1] + (m[4] ? ', pukul ' + m[4] + '.' + m[5] : '');
  }

  /* ---------- keadaan ---------- */
  var D = null;                 // data katalog
  var F = { k3: '', k4: '', q: '', gd: '', urut: 'baru' };
  var tampil = PER_HALAMAN, hasil = [];

  /* ---------- data ---------- */
  function ambil() {
    var lama = null;
    try { lama = JSON.parse(localStorage.getItem(SIMPAN) || 'null'); } catch (e) { lama = null; }
    if (lama && lama.items) { D = lama; mulai(); }
    else rangka();
    if (!CFG.API_URL) { gagal('Alamat data katalog belum diatur.'); return; }
    fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'katalog' }), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || 'Data tidak tersedia');
        var baru = JSON.stringify(res.data);
        try { localStorage.setItem(SIMPAN, baru); } catch (e) { /* penyimpanan penuh, tidak masalah */ }
        if (lama && JSON.stringify(lama) === baru) return;
        D = res.data; mulai();
      })
      .catch(function () { if (!D) gagal(); });
  }

  function rangka() {
    isiUlang($('#grid'), Array.from({ length: 8 }, function () {
      return el('div', { class: 'rangka', 'aria-hidden': 'true' }, el('div', { class: 'foto' }), el('div', { class: 'isi' }, el('span', { style: 'width:50%' }), el('span'), el('span', { style: 'width:40%' })));
    }));
    $('#hitung').textContent = 'Memuat katalog…';
  }
  function gagal(pesan) {
    $('#hitung').textContent = '';
    isiUlang($('#grid'), el('div', { class: 'kosong' }, el('b', { text: 'Katalog belum bisa dimuat' }),
      el('p', { text: pesan || 'Periksa koneksi internet, lalu muat ulang. Anda tetap bisa bertanya langsung ke toko lewat WhatsApp.' }),
      el('button', { class: 'tombol', type: 'button', text: 'Muat ulang', onclick: function () { location.reload(); } })));
  }

  /* ---------- tampilan utama ---------- */
  function mulai() {
    $('#update').textContent = D.diperbarui ? 'Stok diperbarui ' + tglUpdate(D.diperbarui) : '';
    var gds = {};
    D.items.forEach(function (it) { var g = genderNama(it.gd); if (g) gds[g] = 1; });
    var sel = $('#gender'), cur = F.gd;
    isiUlang(sel, el('option', { value: '', text: 'Semua' }));
    ['Pria', 'Wanita', 'Unisex', 'Anak'].concat(Object.keys(gds)).filter(function (g, i, a) { return gds[g] && a.indexOf(g) === i; })
      .forEach(function (g) { sel.append(el('option', { value: g, text: g })); });
    sel.value = cur;
    sel.closest('label').hidden = sel.options.length < 3;
    gambarKategori();
    saring();
    bukaDariHash();
  }

  function gambarKategori() {
    var hit = {};
    D.items.forEach(function (it) { hit[it.k3] = (hit[it.k3] || 0) + 1; });
    var ks = Object.keys(hit).sort(function (a, b) { return ((KAT[a] || {}).urut || 9) - ((KAT[b] || {}).urut || 9); });
    var tile = function (k, nama, n, path) {
      return el('button', { class: 'kat', type: 'button', 'aria-pressed': String(F.k3 === k), onclick: function () {
        F.k3 = F.k3 === k && k ? '' : k; F.k4 = '';
        gambarKategori(); saring();
        var a = $('#alat'); if (a.getBoundingClientRect().top < 0) a.scrollIntoView({ behavior: 'smooth' });
      } }, ikon(path), el('b', { text: nama }), el('small', { text: n + ' artikel' }));
    };
    isiUlang($('#kategori'), tile('', 'Semua barang', D.items.length, IKON_SEMUA),
      ks.map(function (k) { return tile(k, katNama(k), hit[k], (KAT[k] || {}).ikon || IKON_SEMUA); }));
  }

  function gambarSub(dasar) {
    var box = $('#sub');
    if (!F.k3) { isiUlang(box); box.hidden = true; return; }
    var hit = {};
    dasar.forEach(function (it) { if (it.k4) hit[it.k4] = (hit[it.k4] || 0) + 1; });
    var ks = Object.keys(hit).sort(function (a, b) { return hit[b] - hit[a]; });
    box.hidden = ks.length < 2;
    var chip = function (k, t) {
      return el('button', { class: 'chip', type: 'button', 'aria-pressed': String(F.k4 === k), text: t, onclick: function () { F.k4 = k; saring(); } });
    };
    isiUlang(box, chip('', 'Semua ' + katNama(F.k3).toLowerCase()), ks.map(function (k) { return chip(k, subNama(k) + ' (' + hit[k] + ')'); }));
  }

  function cocokCari(it, q) {
    if (!q) return true;
    var teks = (it.n + ' ' + it.g + ' ' + katNama(it.k3) + ' ' + subNama(it.k4) + ' ' + it.k4 + ' ' + it.ac + ' ' + genderNama(it.gd) + ' ' +
      it.w.map(function (w) { return warnaInfo(w[0])[0]; }).join(' ')).toLowerCase();
    return q.split(/\s+/).every(function (k) { return teks.indexOf(k) >= 0; });
  }

  function saring() {
    var q = F.q.trim().toLowerCase();
    var dasar = D.items.filter(function (it) { return (!F.k3 || it.k3 === F.k3) && (!F.gd || genderNama(it.gd) === F.gd) && cocokCari(it, q); });
    gambarSub(dasar);
    hasil = dasar.filter(function (it) { return !F.k4 || it.k4 === F.k4; });
    var h = function (it) { return it.hm || it.h || 0; };
    var sorter = {
      baru: function (a, b) { return (b.b - a.b) || (a.n < b.n ? -1 : 1); },
      nama: function (a, b) { return a.n < b.n ? -1 : 1; },
      murah: function (a, b) { return (h(a) || 9e9) - (h(b) || 9e9); },
      mahal: function (a, b) { return h(b) - h(a); }
    }[F.urut];
    hasil.sort(sorter);
    tampil = PER_HALAMAN;
    $('#hitung').textContent = hasil.length ? hasil.length + ' artikel tersedia' + (F.k4 ? ' di ' + subNama(F.k4).toLowerCase() : F.k3 ? ' di ' + katNama(F.k3).toLowerCase() : '') : '';
    gambarGrid();
  }

  function gambarGrid() {
    var g = $('#grid');
    if (!hasil.length) {
      isiUlang(g, el('div', { class: 'kosong' }, el('b', { text: F.q ? 'Tidak ada barang yang cocok dengan "' + F.q.trim() + '"' : 'Belum ada barang di pilihan ini' }),
        el('p', { text: 'Coba kata lain atau pilih kategori lain. Barang yang Anda cari mungkin bisa dipesan, tanyakan saja ke toko.' }),
        el('a', { class: 'tombol', href: waLink('Halo EIGER Kartasura, saya mencari ' + (F.q.trim() || 'barang') + '. Apakah ada di toko?'), target: '_blank', rel: 'noopener', text: 'Tanya ke toko' })));
      isiUlang($('#lagi'));
      return;
    }
    isiUlang(g, hasil.slice(0, tampil).map(kartu));
    var sisa = hasil.length - tampil;
    isiUlang($('#lagi'), sisa > 0 ? el('button', { class: 'tombol garis', type: 'button', text: 'Tampilkan ' + Math.min(sisa, PER_HALAMAN) + ' artikel lagi', onclick: function () {
      tampil += PER_HALAMAN; gambarGrid();
    } }) : null);
  }

  /** Buang versi thumbnail/kecil dari foto yang sama. */
  function fotoBersih(it) { return (it.f || []).filter(function (u) { return !/\/(thumbnail|small)\//.test(u); }); }
  function fotoAtauIkon(it, src, alt) {
    var box = el('div', { class: 'foto' });
    var ganti = function () { isiUlang(box, ikon((KAT[it.k3] || {}).ikon || IKON_SEMUA, 'ikon')); };
    if (src) {
      var img = el('img', { src: src, alt: alt || '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
      img.addEventListener('error', ganti);
      box.append(img);
    } else ganti();
    return box;
  }

  function kartu(it) {
    var foto = fotoAtauIkon(it, fotoBersih(it)[0], namaTampil(it.n));
    if (it.b) foto.append(el('span', { class: 'baru', text: 'Baru' }));
    var ht = hargaTeks(it);
    var titik = it.w.slice(0, 5).map(function (w) { return el('i', { style: 'background:' + warnaInfo(w[0])[1], title: warnaInfo(w[0])[0] }); });
    return el('button', { class: 'kartu', type: 'button', onclick: function () { buka(it); } }, foto,
      el('div', { class: 'isi' },
        el('span', { class: 'jenis', text: katNama(it.k3) + ' / ' + subNama(it.k4) }),
        el('h3', { class: 'nama', text: namaTampil(it.n) }),
        el('div', { class: 'titik', 'aria-label': it.w.length + ' warna' }, titik, it.w.length > 5 ? el('small', { text: '+' + (it.w.length - 5) }) : null),
        el('span', { class: 'harga' + (ht ? '' : ' tanya'), text: ht || 'Tanya harga di toko' })));
  }

  /* ---------- detail artikel ---------- */
  var dlg = $('#lembar');
  function buka(it, dariHash) {
    var wi = 0, uk = '', fi = 0;
    var tersedia = function (w) { return w[1].filter(function (u) { return u[1]; }); };
    var ukTersedia = tersedia(it.w[0]);
    if (ukTersedia.length === 1) uk = ukTersedia[0][0];
    var isi = $('#lembarIsi');
    var fotos = fotoBersih(it);

    function gambar() {
      var w = it.w[wi], wInfo = warnaInfo(w[0]);
      var hargaW = w[2] ? rp(w[2]) : hargaTeks(it);
      var satuUkuran = w[1].length === 1 && w[1][0][0] === 'NOS';
      var teks = 'Halo EIGER Kartasura, saya mau tanya ' + namaTampil(it.n) + ' (kode ' + it.g + ')' +
        ', warna ' + wInfo[0].toLowerCase() + (uk && uk !== 'NOS' ? ', ukuran ' + uk : '') + '. Apakah masih tersedia di toko?';
      var utama = fotoAtauIkon(it, fotos[fi], namaTampil(it.n));
      utama.className = 'foto utama';
      isiUlang(isi, 
        el('div', { class: 'galeri' },
          el('button', { class: 'tutup', type: 'button', 'aria-label': 'Tutup', onclick: tutup, svg: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>' }),
          utama,
          fotos.length > 1 ? el('div', { class: 'mini' }, fotos.map(function (src, i) {
            return el('button', { type: 'button', 'aria-label': 'Foto ' + (i + 1), 'aria-pressed': String(i === fi), onclick: function () { fi = i; gambar(); } },
              el('img', { src: src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }));
          })) : null),
        el('div', { class: 'detail' },
          el('div', null,
            el('span', { class: 'jenis', text: katNama(it.k3) + ' / ' + subNama(it.k4) + (genderNama(it.gd) ? ' / ' + genderNama(it.gd) : '') }),
            el('h2', { id: 'dNama', text: namaTampil(it.n) }),
            el('span', { class: 'kode', text: 'Kode artikel ' + it.g })),
          el('span', { class: 'harga' + (hargaW ? '' : ' tanya'), text: hargaW || 'Tanya harga di toko' }),
          el('div', { class: 'blok' }, el('h3', null, 'Warna ', el('span', { text: wInfo[0] })),
            el('div', { class: 'warna' }, it.w.map(function (x, i) {
              return el('button', { type: 'button', 'aria-pressed': String(i === wi), onclick: function () {
                wi = i; var t = tersedia(it.w[i]); uk = t.length === 1 ? t[0][0] : (t.some(function (u) { return u[0] === uk; }) ? uk : ''); gambar();
              } }, el('i', { style: 'background:' + warnaInfo(x[0])[1] }), warnaInfo(x[0])[0]);
            }))),
          satuUkuran ? null : el('div', { class: 'blok' }, el('h3', null, 'Ukuran ', el('span', { text: uk ? uk : 'pilih ukuran' })),
            el('div', { class: 'ukuran' }, w[1].map(function (u) {
              return el('button', { type: 'button', disabled: !u[1], 'aria-pressed': String(uk === u[0]), 'aria-label': u[0] + (u[1] ? '' : ', kosong'),
                text: u[0] === 'NOS' ? 'All size' : u[0], onclick: function () { uk = u[0]; gambar(); } });
            })),
            el('p', { class: 'ket', text: 'Ukuran yang dicoret sedang kosong di toko.' })),
          el('a', { class: 'tombol-wa', href: waLink(teks), target: '_blank', rel: 'noopener' },
            ikon('<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/>'),
            uk || satuUkuran ? 'Tanya di WhatsApp' : 'Tanya ketersediaan di WhatsApp'),
          el('button', { class: 'bagikan', type: 'button', text: 'Salin link barang ini', onclick: function () {
            var url = location.href.split('#')[0] + '#artikel-' + it.g;
            if (navigator.share) navigator.share({ title: namaTampil(it.n), url: url }).catch(function () {});
            else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('Link disalin'); }, function () { toast(url); });
            else toast(url);
          } })));
    }
    gambar();
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    isi.scrollTop = 0;
    if (!dariHash && location.hash !== '#artikel-' + it.g) history.pushState(null, '', '#artikel-' + it.g);
  }
  function tutup() {
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener('close', function () { if (/^#artikel-/.test(location.hash)) history.pushState(null, '', location.pathname + location.search); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) tutup(); });
  function bukaDariHash() {
    var m = location.hash.match(/^#artikel-(\d{9})$/);
    if (!m || !D) { if (dlg.open) dlg.close(); return; }
    var it = D.items.filter(function (x) { return x.g === m[1]; })[0];
    if (it) buka(it, true);
    else toast('Barang ini sedang tidak tersedia di toko');
  }
  window.addEventListener('popstate', bukaDariHash);

  /* ---------- kontrol ---------- */
  var tunda;
  $('#q').addEventListener('input', function (e) { clearTimeout(tunda); tunda = setTimeout(function () { F.q = e.target.value; if (D) saring(); }, 180); });
  $('#gender').addEventListener('change', function (e) { F.gd = e.target.value; saring(); });
  $('#urut').addEventListener('change', function (e) { F.urut = e.target.value; saring(); });
  var alat = $('#alat');
  if (window.IntersectionObserver) {
    var penanda = el('div', { style: 'height:1px' }); alat.parentNode.insertBefore(penanda, alat);
    new IntersectionObserver(function (es) { alat.classList.toggle('lekat', !es[0].isIntersecting); }).observe(penanda);
  }
  var waUmum = 'https://wa.me/6281120022574?text=' + encodeURIComponent('Halo EIGER Kartasura, saya mau tanya barang.');
  $('#waFab').href = waUmum; $('#waKaki').href = waUmum;

  ambil();
})();
