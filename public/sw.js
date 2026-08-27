// FlowStar service worker — app-shell caching for offline access (issue #150).
//
// Strategy:
// - Navigations (HTML pages): network-first, falling back to the cached
//   shell (or the dedicated offline page) when the network is unavailable.
//   This keeps the app fresh online while still working offline.
// - Static assets (_next/static, icons, manifest): cache-first, since these
//   are content-hashed / rarely change and are safe to serve from cache.
//
// Live stream data itself is fetched over Soroban RPC directly from the
// client and is cached separately in localStorage (see hooks/use-streams.ts)
// so the dashboard can render a stale-but-usable view offline.

const CACHE_VERSION = 'flowstar-v1'
const APP_SHELL = ['/app', '/offline.html', '/manifest.json', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigations — network-first with offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(
          () =>
            caches.match(request).then((cached) => cached) ||
            caches.match('/offline.html'),
        ),
    )
    return
  }

  // Static assets — cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icon')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
            return response
          }),
      ),
    )
  }
})
