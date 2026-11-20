'use client'

import { useEffect } from 'react'

/**
 * Registers the app-shell service worker (public/sw.js) on mount. Renders
 * nothing — purely a side effect. Skipped outside the browser and when the
 * platform doesn't support service workers (issue #150).
 *
 * The worker URL includes the build id as a query parameter
 * (`/sw.js?v=<NEXT_PUBLIC_BUILD_ID>`). The worker reads this value to derive a
 * per-build cache name, so each deploy gets a fresh cache and the activate
 * handler can delete caches from previous builds (issue #1156). When the build
 * id is unset (e.g. local dev), a stable fallback is used.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    // Service workers require a secure context (https, or localhost in dev).
    const buildId = encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev')
    navigator.serviceWorker.register(`/sw.js?v=${buildId}`).catch(() => {
      // Registration failures (e.g. unsupported browser, blocked storage)
      // shouldn't break the app — it just runs without offline support.
    })
  }, [])

  return null
}