/* Basecamp 2299 — service worker: selalu versi terbaru + notifikasi push */
'use strict';
var CACHE = 'bc2299-v1';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

// Network-first: selalu ambil versi terbaru, pakai cache hanya bila offline.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match('./'); }); }));
});

/* ---- penyimpanan kecil (IndexedDB) untuk token & id notifikasi yang sudah tampil ---- */
function db() {
  return new Promise(function (ok, no) {
    var r = indexedDB.open('bc2299', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
    r.onsuccess = function () { ok(r.result); };
    r.onerror = function () { no(r.error); };
  });
}
function kvGet(k) { return db().then(function (d) { return new Promise(function (ok) { var q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = function () { ok(q.result); }; q.onerror = function () { ok(null); }; }); }); }
function kvSet(k, v) { return db().then(function (d) { return new Promise(function (ok) { var t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = ok; t.onerror = ok; }); }); }

var ICON = 'assets/icon-180.png', BADGE = 'assets/favicon-64.png';

self.addEventListener('push', function (e) {
  e.waitUntil(Promise.all([kvGet('token'), kvGet('api'), kvGet('shown')]).then(function (v) {
    var token = v[0], api = v[1], shown = v[2] || [];
    var ambil = token && api ? fetch(api, { method: 'POST', body: JSON.stringify({ action: 'notif', token: token }) })
      .then(function (r) { return r.json(); }).then(function (j) { return j.ok ? j.data : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return ambil.then(function (d) {
      if (!d) return self.registration.showNotification('Basecamp 2299', { body: 'Ada notifikasi baru. Ketuk untuk membuka.', icon: ICON, badge: BADGE, tag: 'bc-umum', data: { link: '#/beranda' } });
      try { if (self.navigator.setAppBadge) { if (d.unread) self.navigator.setAppBadge(d.unread); else self.navigator.clearAppBadge(); } } catch (x) {}
      var baru = d.items.filter(function (x) { return (x.live || !x.dibaca) && shown.indexOf(x.id) < 0; });
      var simpan = kvSet('shown', d.items.map(function (x) { return x.id; }).concat(shown).slice(0, 300));
      var tampil;
      if (!baru.length) tampil = self.registration.showNotification('Basecamp 2299', { body: d.unread ? d.unread + ' notifikasi belum dibaca' : 'Ada pembaruan', icon: ICON, badge: BADGE, tag: 'bc-ringkas', data: { link: '#/beranda' } });
      else tampil = Promise.all(baru.slice(0, 3).map(function (x) {
        return self.registration.showNotification(x.judul, { body: x.isi || '', icon: ICON, badge: BADGE, tag: x.id, data: { link: x.link || '#/beranda' } });
      })).then(function () {
        if (baru.length > 3) return self.registration.showNotification('Basecamp 2299', { body: '+' + (baru.length - 3) + ' notifikasi lain', icon: ICON, badge: BADGE, tag: 'bc-lain', data: { link: '#/beranda' } });
      });
      return Promise.all([simpan, tampil]);
    });
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var link = (e.notification.data && e.notification.data.link) || '#/beranda';
  var url = new URL('./' + link, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf(self.registration.scope) === 0) { list[i].navigate(url); return list[i].focus(); } }
    return self.clients.openWindow(url);
  }));
});

// halaman mengirim token terbaru (atau menghapusnya saat keluar)
self.addEventListener('message', function (e) {
  var m = e.data || {};
  if (m.type === 'sesi') e.waitUntil(Promise.all([kvSet('token', m.token || null), kvSet('api', m.api || null)]));
});
