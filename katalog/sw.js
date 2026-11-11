/* Service worker katalog EIGER Kartasura: halaman tetap terbuka cepat dan saat sinyal lemah.
 * Berkas halaman: tampilkan salinan tersimpan dulu, perbarui diam-diam di belakang.
 * Data stok (API) tidak disimpan di sini; katalog sudah menyimpan data terakhir sendiri. */
var VERSI = 'katalog-v3';
var INTI = ['./', 'index.html', 'katalog.css', 'katalog.js', 'assets/config.js', 'ikon-192.png', 'ikon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSI).then(function (c) { return c.addAll(INTI).catch(function () { /* sebagian gagal tidak apa */ }); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSI; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var url = new URL(r.url);
  if (url.origin !== location.origin) return; // gambar & API dari luar dibiarkan lewat jaringan
  if (url.pathname.indexOf('/data/') >= 0 || url.pathname.indexOf('/p/') === 0) return; // data & halaman pratinjau produk langsung dari jaringan // salinan data selalu diambil baru (halaman menyimpan data terakhir sendiri)
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(function (res) {
      if (res.ok && (url.pathname === '/' || /\/index\.html$/.test(url.pathname))) { var salin = res.clone(); caches.open(VERSI).then(function (c) { c.put('index.html', salin); }); }
      return res;
    }).catch(function () { return caches.match('index.html').then(function (x) { return x || caches.match('./'); }); }));
    return;
  }
  e.respondWith(caches.open(VERSI).then(function (c) {
    return c.match(r).then(function (lama) {
      var baru = fetch(r).then(function (res) { if (res.ok) c.put(r, res.clone()); return res; }).catch(function () { return lama; });
      return lama || baru;
    });
  }));
});
