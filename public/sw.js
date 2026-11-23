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
//
// Cache versioning (issue #1156):
// - The cache name is derived from the build id passed by the registration
//   script (components/pwa/service-worker-register.tsx), which registers
//   `/sw.js?v=<NEXT_PUBLIC_BUILD_ID>`. The worker reads that query param from
//   `self.location.search` and builds `flowstar-<build id>`.
// - When no build id is present (e.g. direct visits in dev), we fall back to
//   a constant version so the worker still functions.
// - On `activate`, every cache whose name does not match the current cache
//   name is deleted, so stale app shells and assets from previous deploys are
//   purged and the new build's shell is used.

const FALLBACK_VERSION = 'dev'

function resolveCacheVersion() {
  try {
    const buildId = new URL(self.location.href).searchParams.get('v')
    if (buildId) return buildId
  } catch {
    // Ignore malformed URLs and fall through to the fallback version.
  }
  return FALLBACK_VERSION
}

const CACHE_VERSION = `flowstar-${resolveCacheVersion()}`
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
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached

          const offline = await caches.match('/offline.html')
          return offline ?? Response.error()
        }),
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
