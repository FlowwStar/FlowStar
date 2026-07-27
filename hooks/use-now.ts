'use client'

import { useEffect, useState } from 'react'

/**
 * Returns the current UNIX time in seconds, updating on an interval.
 * Pass `intervalMs = null` to disable updates (for completed/cancelled streams).
 */
export function useNow(intervalMs: number | null = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    if (intervalMs === null) return
    const id = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
