'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useContract } from '@/hooks/use-contract'

/** Default countdown before a scheduled cancellation is actually submitted. */
export const CANCEL_UNDO_DELAY_MS = 10000

// ─── Shared "cancelling" store ──────────────────────────────────────────────
// A tiny module-level pub/sub so any stream card (dashboard, streams list,
// detail page) can reactively show a "Cancelling…" state for a stream that
// has a pending undoable cancellation in flight, without prop-drilling.

type Listener = () => void
const cancellingIds = new Set<string>()
const listeners = new Set<Listener>()

function setCancelling(id: string, value: boolean) {
  const changed = value ? !cancellingIds.has(id) : cancellingIds.has(id)
  if (value) cancellingIds.add(id)
  else cancellingIds.delete(id)
  if (changed) listeners.forEach((l) => l())
}

/** Whether a stream currently has a pending (undoable) cancellation in flight. */
export function isStreamCancelling(id: string): boolean {
  return cancellingIds.has(id)
}

/** Reactive hook mirroring {@link isStreamCancelling} for a given stream id. */
export function useIsStreamCancelling(id: string): boolean {
  const [cancelling, setLocal] = useState(() => cancellingIds.has(id))
  useEffect(() => {
    setLocal(cancellingIds.has(id))
    const handler = () => setLocal(cancellingIds.has(id))
    listeners.add(handler)
    return () => {
      listeners.delete(handler)
    }
  }, [id])
  return cancelling
}

// ─── Undoable cancel hook ────────────────────────────────────────────────────

interface PendingCancel {
  timeout: ReturnType<typeof setTimeout>
  interval: ReturnType<typeof setInterval>
}

/**
 * Schedules a stream cancellation with a "Gmail-style" undo delay instead of
 * submitting the cancel transaction immediately. While the countdown runs:
 * - the stream shows a "Cancelling…" state (via {@link useIsStreamCancelling})
 * - a toast displays the remaining seconds with an "Undo" action
 * - the actual `cancel` transaction fires only once the countdown expires
 *
 * If the component that scheduled the cancellation unmounts before the
 * countdown finishes (e.g. the user navigates away from the stream page),
 * the cancellation is aborted as a safe default.
 */
export function useUndoableCancel(delayMs: number = CANCEL_UNDO_DELAY_MS) {
  const { cancel } = useContract()
  const pendingRef = useRef<Map<string, PendingCancel>>(new Map())

  const abortCancel = useCallback((streamId: string) => {
    const entry = pendingRef.current.get(streamId)
    if (!entry) return false
    clearTimeout(entry.timeout)
    clearInterval(entry.interval)
    pendingRef.current.delete(streamId)
    setCancelling(streamId, false)
    toast.dismiss(`cancel-undo-${streamId}`)
    return true
  }, [])

  // Safe default: abort any in-flight countdown started by this component
  // if it unmounts (e.g. navigating away from the stream detail page).
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((entry, streamId) => {
        clearTimeout(entry.timeout)
        clearInterval(entry.interval)
        setCancelling(streamId, false)
      })
      pendingRef.current.clear()
    }
  }, []);

  const scheduleCancel = useCallback(
    (streamId: string) => {
      // Only one pending cancellation per stream at a time.
      if (pendingRef.current.has(streamId)) return

      setCancelling(streamId, true)
      const toastId = `cancel-undo-${streamId}`
      let secondsLeft = Math.ceil(delayMs / 1000)

      const render = () => {
        toast(`Stream will be cancelled in ${secondsLeft}s`, {
          id: toastId,
          duration: delayMs + 1000,
          action: {
            label: 'Undo',
            onClick: () => {
              abortCancel(streamId)
              toast.info('Cancellation aborted')
            },
          },
        })
      }
      render()

      const interval = setInterval(() => {
        secondsLeft -= 1
        if (secondsLeft > 0) render()
      }, 1000)

      const timeout = setTimeout(async () => {
        clearInterval(interval)
        pendingRef.current.delete(streamId)
        toast.dismiss(toastId)
        try {
          await cancel(streamId)
        } finally {
          setCancelling(streamId, false)
        }
      }, delayMs)

      pendingRef.current.set(streamId, { timeout, interval })
    },
    [abortCancel, cancel, delayMs],
  )

  return { scheduleCancel, abortCancel }
}
