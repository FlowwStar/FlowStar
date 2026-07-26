'use client'

import { useState, useEffect } from 'react'

const KEY = 'flowstar-show-usd'

/**
 * React hook exposing the user's preference for showing USD-equivalent
 * values alongside token amounts (e.g. in dashboard cards).
 *
 * The preference persists to `localStorage` under `flowstar-show-usd`, and
 * the hook returns a `[show, toggle]` tuple shaped like useState for
 * ergonomic drop-in use in existing stateful components:
 *   const [showUsd, setShowUsd] = useShowUsd();
 *
 * Default is `true` until `localStorage` reports otherwise. Both the read
 * and the write happen entirely on the client — there is no server-side
 * preference store backing this hook yet.
 */
export function useShowUsd(): [boolean, (v: boolean) => void] {
  const [show, setShow] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    if (stored !== null) setShow(stored !== 'false')
  }, [])

  function toggle(v: boolean) {
    setShow(v)
    localStorage.setItem(KEY, String(v))
  }

  return [show, toggle]
}
