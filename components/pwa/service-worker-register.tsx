'use client'

import { useEffect } from 'react'

/**
 * Registers the app-shell service worker (public/sw.js) on mount. Renders
 * nothing — purely a side effect. Skipped outside the browser and when the
 * platform doesn't support service workers (issue #150).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    // Service workers require a secure context (https, or localhost in dev).
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failures (e.g. unsupported browser, blocked storage)
      // shouldn't break the app — it just runs without offline support.
    })
  }, [])

  return null
}
