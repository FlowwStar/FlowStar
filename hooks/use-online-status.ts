'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks browser connectivity via the `online`/`offline` window events
 * (issue #150). Defaults to `true` so SSR/first paint never flashes an
 * incorrect offline state.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
