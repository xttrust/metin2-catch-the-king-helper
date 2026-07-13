// Cache-first service worker: the whole app works offline after first load.
// Bump VERSION on every deploy to invalidate old caches.
const VERSION = 'ctk-v5';

const ASSETS = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'css/style.css',
  'js/ui/main.js',
  'js/ui/board.js',
  'js/ui/fx.js',
  'js/ui/panels.js',
  'js/ui/picker.js',
  'js/ui/review.js',
  'js/ui/stats-view.js',
  'js/stats/store.js',
  'js/i18n/i18n.js',
  'js/i18n/en.js',
  'js/i18n/de.js',
  'js/i18n/ro.js',
  'js/engine/rules.js',
  'js/engine/bitboard.js',
  'js/engine/game.js',
  'js/engine/belief.js',
  'js/engine/rng.js',
  'js/solver/heuristic.js',
  'js/solver/rollout.js',
  'js/solver/endgame.js',
  'js/solver/solver.js',
  'js/solver/worker.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          // Runtime-cache fonts and other same-origin assets.
          const url = new URL(e.request.url);
          if (res.ok && (url.origin === location.origin || url.host.includes('fonts.g'))) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(e.request, copy));
          }
          return res;
        })
    )
  );
});
