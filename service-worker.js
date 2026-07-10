/* service-worker.js — makes the app installable and able to launch offline.
   Strategy: network-first for our own files (so updates always show when
   online), falling back to cache when offline. Cross-origin requests
   (Supabase, CDNs) are left alone and go straight to the network. */

const CACHE = 'paw-v3';   // bump this (v3, v4…) whenever you change files
const SHELL = [
  './',
  './index.html',
  './share.html',
  './css/styles.css',
  './js/config.js',
  './js/validate.js',
  './js/storage.js',
  './js/calendar.js',
  './js/ui.js',
  './js/app.js',
  './js/auth.js',
  './js/share.js',
  './assets/cover.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // only handle our own GET requests; let Supabase/CDN go straight to network
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});