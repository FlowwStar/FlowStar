'use client'

import { useEffect, useRef, useCallback } from 'react'

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

interface DraftEntry<T> {
  data: T
  savedAt: number
}

export function useFormDraft<T>(
  key: string,
  value: T,
  onChange: (draft: T) => void,
  enabled = true,
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRestoringRef = useRef(false)

  const storageKey = `flowstar_draft_${key}`

  const save = useCallback(
    (data: T) => {
      try {
        const entry: DraftEntry<T> = { data, savedAt: Date.now() }
        localStorage.setItem(storageKey, JSON.stringify(entry))
      } catch {
        // storage quota exceeded or unavailable — silently skip
      }
    },
    [storageKey],
  )

  const discard = useCallback(() => {
    localStorage.removeItem(storageKey)
  }, [storageKey])

  const loadDraft = useCallback((): { data: T; savedAt: number } | null => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      const entry: DraftEntry<T> = JSON.parse(raw)
      if (Date.now() - entry.savedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(storageKey)
        return null
      }
      return entry
    } catch {
      return null
    }
  }, [storageKey])

  const restore = useCallback(() => {
    const entry = loadDraft()
    if (!entry) return
    isRestoringRef.current = true
    onChange(entry.data)
    setTimeout(() => {
      isRestoringRef.current = false
    }, 0)
  }, [loadDraft, onChange])

  // Debounced auto-save on value changes
  useEffect(() => {
    if (!enabled || isRestoringRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(value), 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, enabled, save])

  return { loadDraft, restore, discard }
}

export function clearExpiredDrafts(prefix = 'flowstar_draft_') {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(prefix)) continue
      try {
        const raw = localStorage.getItem(k)
        if (!raw) continue
        const entry: DraftEntry<unknown> = JSON.parse(raw)
        if (Date.now() - entry.savedAt > DRAFT_TTL_MS) {
          keysToRemove.push(k)
        }
      } catch {
        keysToRemove.push(k!)
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k))
  } catch {
    // localStorage unavailable
  }
}
