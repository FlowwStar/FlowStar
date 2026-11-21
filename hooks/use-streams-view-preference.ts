'use client'

import { useState, useEffect, useCallback } from 'react'

const KEY = 'flowstar:streams-view'

export type StreamsView = 'list' | 'compact' | 'timeline'

/**
 * Persists the user's preferred streams page layout ("list", "compact", or
 * "timeline") in localStorage (issue #149, #832). Defaults to "list" on first
 * render/SSR and hydrates from storage in an effect, matching the pattern in
 * `useShowUsd`.
 */
export function useStreamsViewPreference(): {
  view: StreamsView
  setView: (v: StreamsView) => void
} {
  const [view, setViewState] = useState<StreamsView>('list')

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    if (stored === 'list' || stored === 'compact' || stored === 'timeline') setViewState(stored)
  }, [])

  const setView = useCallback((v: StreamsView) => {
    setViewState(v)
    localStorage.setItem(KEY, v)
  }, [])

  return { view, setView }
}
