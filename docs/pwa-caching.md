# PWA Caching Strategy

FlowStar ships a hand-written service worker (`public/sw.js`) that provides offline support for the app shell. This document explains what gets cached, the fetch strategies used, and how to clear the cache when needed.

## What is cached

The service worker manages a single versioned cache named `flowstar-v1`. On installation it pre-caches a small **app shell**:

| URL             | Purpose                                           |
| --------------- | ------------------------------------------------- |
| `/app`          | Main application entry point                      |
| `/offline.html` | Fallback page shown when the network is unavailable |
| `/manifest.json`| PWA manifest                                      |
| `/icon.svg`     | App icon                                          |

**Live stream data is not cached by the service worker.** Stream state is fetched from the Soroban RPC endpoint directly from the client and cached separately in `localStorage` by `hooks/use-streams.ts`. The service worker does not intercept RPC requests (they are cross-origin).

## Fetch strategies

### Navigation requests (HTML pages)

**Network-first with offline fallback.**

1. Try the network. On success, store a fresh copy in the cache and return the response.
2. On network failure, return the cached version of the requested URL if available.
3. If neither is available, return `/offline.html`.

This ensures the app is always up-to-date when online, while still loading from cache when the user is offline.

### Static assets (`/_next/static/`, `/icon*`)

**Cache-first.**

1. Return the cached version if present.
2. If not cached, fetch from the network, store in the cache, and return.

Next.js content-hashes all files under `/_next/static/`, so a stale cache entry is never served for a changed file — a new deployment produces new hashes, which are cache misses, triggering a fresh network fetch.

### All other requests

The service worker does not intercept non-navigation, non-static-asset GET requests. Cross-origin requests (Soroban RPC, Sentry, analytics) are also not intercepted (`url.origin !== self.location.origin` guard).

## Cache versioning

The cache name `flowstar-v1` is defined at the top of `public/sw.js`. On activation, the service worker deletes all caches whose name does not match the current version. To invalidate the cache on the next deployment, increment the version string:

```js
// public/sw.js
const CACHE_VERSION = 'flowstar-v2'
```

This causes the new service worker to delete the old `flowstar-v1` cache as soon as it activates.

## How to clear the cache

### From the browser DevTools

1. Open DevTools → **Application** tab.
2. Under **Storage**, click **Clear site data** to remove all caches, service workers, and localStorage at once.
   — or —
3. Under **Cache** → **Cache Storage**, expand `flowstar-v1` and delete individual entries, or right-click the cache name and choose **Delete**.

### From the browser Settings

In Chrome/Edge: **Settings → Privacy and security → Clear browsing data → Cached images and files**.

### Via the app UI

The **Settings** page has a **Clear local data** button (`components/settings/clear-local-data.tsx`). It clears `localStorage` (stream cache, hidden-streams list, notification state). It does **not** clear the service-worker cache; use the DevTools steps above for that.

### Programmatically (from the console)

```js
// Delete all FlowStar caches:
caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))

// Unregister the service worker entirely:
navigator.serviceWorker.getRegistrations()
  .then(registrations => Promise.all(registrations.map(r => r.unregister())))
```

## Registration

The service worker is registered by `components/pwa/service-worker-register.tsx`, a client component mounted in the root layout. Registration is skipped outside the browser and in environments that do not support service workers (e.g., older browsers, non-secure contexts). Registration failures are silently swallowed so they never break the app.

## Offline behavior

When the user is offline:

- **Dashboard and stream detail pages**: if the browser has a cached version of the page, it is served from cache. Stream data shown will be the last localStorage snapshot from `use-streams.ts`.
- **Uncached pages** (e.g., a URL never visited before): the service worker returns `/offline.html`.
- **New stream creation, withdrawals, cancellations**: these require a live Soroban RPC connection and will fail with a network error when offline. No local queuing is implemented.

## Known limitations

- The offline page (`/offline.html`) is included in the app shell pre-cache but the file must exist in `public/` at build time. If it is missing, the `install` event's `cache.addAll` call will fail and the service worker will not install.
- The app does not use a build-time manifest or Workbox, so the app-shell list in `sw.js` must be kept in sync with the actual URLs manually.
- The cache-first strategy for static assets means a user who has an old service worker installed will continue to receive old static assets until the new service worker activates. Next.js's content-hashing mitigates this for `/_next/static/` files, but `/icon.svg` and `/manifest.json` are not hashed.
