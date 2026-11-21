'use client'
import { useEffect, useRef } from 'react'

/**
 * Subscribes to the Page Visibility API.
 *
 * Calls `onVisible` when the document becomes visible (tab refocused /
 * browser restored) and `onHidden` when it becomes hidden.
 *
 * - Safe in SSR — no DOM access until `useEffect` runs in the browser.
 * - Works correctly with multiple FlowStar tabs: each tab's document fires
 *   its own `visibilitychange` event independently.
 * - The event listener is registered once and kept stable; callback identity
 *   changes are handled through refs so no teardown/re-register cycle occurs.
 */
export function usePageVisibility({
  onVisible,
  onHidden,
}: {
  onVisible?: () => void
  onHidden?: () => void
}) {
  // Keep a live ref to each callback so we never need to re-register the
  // DOM listener just because the caller re-renders with a new function ref.
  const onVisibleRef = useRef(onVisible)
  const onHiddenRef = useRef(onHidden)
  onVisibleRef.current = onVisible
  onHiddenRef.current = onHidden

  useEffect(() => {
    const handleChange = () => {
      if (document.hidden) {
        onHiddenRef.current?.()
      } else {
        onVisibleRef.current?.()
      }
    }

    document.addEventListener('visibilitychange', handleChange)
    return () => document.removeEventListener('visibilitychange', handleChange)
  }, []) // intentionally empty — refs keep callbacks current without re-running
}
