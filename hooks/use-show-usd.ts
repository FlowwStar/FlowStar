'use client'

import { useState, useEffect } from 'react'

const KEY = 'flowstar-show-usd'

/**
 * Hook that tracks whether token amounts should be displayed in USD.
 *
 * Returns a `[show, toggle]` tuple:
 * - `show` — `true` if USD display is enabled, `false` otherwise. Defaults to
 *   `true` on first use (i.e. USD is shown until the user opts out).
 * - `toggle` — setter that updates the preference both in React state and in
 *   `localStorage` (key: `"flowstar-show-usd"`), so the choice persists across
 *   page reloads and browser sessions.
 *
 * The persisted value is read from `localStorage` inside a `useEffect`, so the
 * initial render always uses the default (`true`) before hydrating the stored
 * preference. This avoids SSR/hydration mismatches.
 *
 * @returns A tuple of `[show: boolean, toggle: (v: boolean) => void]`.
 *
 * @example
 * const [showUsd, setShowUsd] = useShowUsd();
 * // showUsd === true by default
 * setShowUsd(false); // hides USD display and persists the preference
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
