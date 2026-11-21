'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isPaused } from '@/lib/contract'
import { useNetwork } from '@/components/providers/network-provider'
import { usePageVisibility } from '@/hooks/use-page-visibility'

const POLL_INTERVAL_MS = 60_000

/**
 * Polls the streaming contract's `is_paused()` flag every 60s, so the UI can
 * warn before a write fails on-chain with `ContractPaused` (issue #1144).
 *
 * Polling stops while the tab is hidden (via {@link usePageVisibility}) and
 * resumes — with an immediate re-check — when it becomes visible again, so a
 * backgrounded tab doesn't keep polling needlessly.
 */
export function useContractPaused(): boolean {
  const { network } = useNetwork()
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (timerRef.current) return // already running
    const check = () => {
      isPaused(network).then(setPaused)
    }
    check() // immediate check on (re)start, so resuming from a hidden tab is instant
    timerRef.current = setInterval(check, POLL_INTERVAL_MS)
  }, [network])

  useEffect(() => {
    startPolling()
    return stopPolling
  }, [startPolling, stopPolling])

  usePageVisibility({
    onHidden: stopPolling,
    onVisible: startPolling,
  })

  return paused
}
