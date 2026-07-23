/* ============================================================
   sw.js — Europe Trip Planner service worker
   ------------------------------------------------------------
   Makes the planner an installable, offline-capable app.

   Strategy per resource class:
   - App shell (html/css/js/vendor/icons) ..... network-first,
     cache fallback. Mirrors the "always get the latest build"
     no-cache metas: online you always run fresh code; offline
     the last-seen build boots from cache.
   - Google Fonts (css + woff2) ............... stale-while-revalidate.
   - Map tiles (OSM / Carto) .................. cache-first, capped,
     so previously seen map areas render offline.
   - Nominatim geocoding + sync backends ...... untouched (network
     only) — live APIs must never serve stale answers.
   ============================================================ */
'use strict';

const VERSION = 'v48';
const SHELL_CACHE = `planner-shell-${VERSION}`;
const FONT_CACHE = 'planner-fonts';
const TILE_CACHE = 'planner-tiles';
const TILE_CACHE_MAX = 400; // ~ a few city zoom levels; trimmed FIFO

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './vendor/topojson/topojson.min.js',
  './vendor/topojson/countries-110m.json',
  './vendor/topojson/countries-50m.json',
  './vendor/supabase/supabase.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

const TILE_HOSTS = ['tile.openstreetmap.org', 'basemaps.cartocdn.com'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('planner-shell-') && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* network-first: fresh when online, cached build offline */
async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // ignoreSearch: app assets are requested with ?v=N cache-busters
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // offline navigation to any in-scope URL → boot the app shell
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

/* opaque responses (no-cors <img> tiles, <link> font css) report ok:false
   but are exactly what the page will consume — cacheable */
function cacheable(res) {
  return res && (res.ok || res.type === 'opaque');
}

/* cache-first with FIFO trim — map tiles are immutable enough */
async function tileCacheFirst(req) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (cacheable(res)) {
    await cache.put(req, res.clone());
    trimCache(cache); // fire and forget
  }
  return res;
}

async function trimCache(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length <= TILE_CACHE_MAX) return;
    await Promise.all(keys.slice(0, keys.length - TILE_CACHE_MAX).map((k) => cache.delete(k)));
  } catch (err) { /* trimming is best-effort */ }
}

/* stale-while-revalidate for font css + woff2 */
async function staleWhileRevalidate(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (cacheable(res)) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || refresh;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req));
    return;
  }
  if (TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
    e.respondWith(tileCacheFirst(req));
    return;
  }
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  // everything else (nominatim, open-meteo weather, sync backends, external links): network only
});
