'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AppNotification } from '@/hooks/use-notifications'

export type NotificationType = AppNotification['type']

export type NotificationPreferences = Record<NotificationType, boolean>

const STORAGE_KEY = 'flowstar:notification-preferences'

const DEFAULT_PREFERENCES: NotificationPreferences = {
  stream_created: true,
  stream_cancelled: true,
  withdrawal: true,
}

function loadPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw)
    // Merge over defaults so a preference added after a user's last visit
    // (a new NotificationType) defaults to enabled rather than `undefined`.
    return { ...DEFAULT_PREFERENCES, ...parsed }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function savePreferences(prefs: NotificationPreferences): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    return true
  } catch {
    return false
  }
}

/** Returns whether `type` notifications are enabled, reading localStorage directly (safe to call outside React, e.g. from `addNotification`). */
export function isNotificationTypeEnabled(type: NotificationType): boolean {
  return loadPreferences()[type]
}

/** Manages per-type in-app notification preferences, persisted to localStorage. */
export function useNotificationPreferences(onSaveError?: () => void) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    setPreferences(loadPreferences())
  }, [])

  const setPreference = useCallback(
    (type: NotificationType, enabled: boolean) => {
      setPreferences((prev) => {
        const next = { ...prev, [type]: enabled }
        if (!savePreferences(next)) onSaveError?.()
        return next
      })
    },
    [onSaveError],
  )

  return { preferences, setPreference }
}
