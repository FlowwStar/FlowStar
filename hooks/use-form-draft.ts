'use client'

import { useEffect, useRef, useCallback } from 'react'

/** Drafts older than this (24h) are treated as expired and removed on read. */
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

/** Shape stored in localStorage under `flowstar_draft_<key>`. */
interface DraftEntry<T> {
  data: T
  /** `Date.now()` at save time, used for TTL expiry. */
  savedAt: number
}

/**
 * Auto-saves a form's value to localStorage and lets the caller restore it
 * later.
 *
 * Draft-save contract:
 * - While `enabled`, every change to `value` schedules a save 500ms later.
 *   Further changes within that window reset the timer (debounce).
 * - Drafts are stored under `flowstar_draft_<key>` with a `savedAt`
 *   timestamp and expire after 24 hours.
 * - Saving is best-effort. If `localStorage.setItem` throws (quota exceeded,
 *   private browsing, storage disabled), that draft is dropped and the hook
 *   keeps working. `onSaveError` is called once per failure streak, not on
 *   every failed save, and is re-armed after the next successful save
 *   (#676). If `onSaveError` is omitted, failures stay silent.
 * - `restore()` passes the stored draft to `onChange` and skips the
 *   auto-save that the resulting `value` change would otherwise trigger.
 * - `enabled = false` only turns off auto-save. `loadDraft`, `restore`, and
 *   `discard` still work.
 *
 * Pass a stable (memoized) `onSaveError`. A new function on every render
 * re-runs the save effect on every render.
 *
 * @param key - Unique draft name for this form; prefixed with `flowstar_draft_`.
 * @param value - Current form value to auto-save. Must be JSON-serializable.
 * @param onChange - Called with the draft data by `restore()`.
 * @param enabled - Whether auto-save is active. Defaults to `true`.
 * @param onSaveError - Optional callback for when saving starts failing.
 * @returns
 * - `loadDraft()`: the stored `{ data, savedAt }`, or `null` if there is no
 *   draft or it is expired or unreadable. Expired drafts are removed.
 * - `restore()`: applies the stored draft via `onChange`; does nothing if
 *   there is none.
 * - `discard()`: deletes the stored draft. Unlike the other methods it does
 *   not catch storage errors.
 */
export function useFormDraft<T>(
  key: string,
  value: T,
  onChange: (draft: T) => void,
  enabled = true,
  // Issue #676: draft-save failures (quota exceeded, private browsing) used
  // to be silently discarded — the caller can surface this however fits
  // (toast, inline notice, ...). Only fires once per failure streak, not on
  // every debounced save, so it stays a lightweight one-time warning rather
  // than spamming the user.
  onSaveError?: () => void,
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRestoringRef = useRef(false)
  const hasWarnedRef = useRef(false)

  const storageKey = `flowstar_draft_${key}`

  const save = useCallback(
    (data: T) => {
      try {
        const entry: DraftEntry<T> = { data, savedAt: Date.now() }
        localStorage.setItem(storageKey, JSON.stringify(entry))
        hasWarnedRef.current = false
      } catch {
        // storage quota exceeded or unavailable — the draft itself is still
        // silently skipped (nothing else we can do), but the user is now
        // told their progress isn't being saved.
        if (!hasWarnedRef.current) {
          hasWarnedRef.current = true
          onSaveError?.()
        }
      }
    },
    [storageKey, onSaveError],
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

/**
 * Removes every draft under `prefix` that is past the 24-hour TTL or can't be
 * parsed. Safe to call when localStorage is unavailable, because all errors
 * are swallowed. Intended to run once on mount of a form that uses
 * {@link useFormDraft}.
 *
 * @param prefix - Key prefix to scan. Defaults to the prefix `useFormDraft` uses.
 */
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
