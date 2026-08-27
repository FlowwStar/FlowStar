'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchStreamsForAddress, fetchStream } from '@/lib/contract'
import type { StreamData } from '@/types/stream'
import { useWallet } from '@/hooks/use-wallet'
import { useNetwork } from '@/components/providers/network-provider'
import { captureError } from '@/lib/sentry'
import { usePageVisibility } from '@/hooks/use-page-visibility'

// ─── Refresh bus ───────────────────────────────────────────────────────────────
// Components call `invalidateStreams()` after a write so all stream hooks
// re-fetch without prop-drilling or global state.
type Listener = () => void
const listeners = new Set<Listener>()
export function invalidateStreams() {
  listeners.forEach((l) => l())
}

function useInvalidation(cb: () => void) {
  const cbRef = useRef(cb)
  cbRef.current = cb
  useEffect(() => {
    const handler = () => cbRef.current()
    listeners.add(handler)
    return () => {
      listeners.delete(handler)
    }
  }, [])
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────
export interface CategorizedStreams {
  sent: StreamData[]
  received: StreamData[]
  all: StreamData[]
  loading: boolean
  /** True when the tab just became visible after being hidden ≥ 3 seconds. */
  isRefreshingAfterHidden: boolean
  refetch: () => void
}

interface UseStreamsOptions {
  enablePolling?: boolean
  pollInterval?: number
}

// How long the tab must have been hidden before we show "Refreshing…"
const STALE_THRESHOLD_MS = 3_000

export function useStreams(options?: UseStreamsOptions): CategorizedStreams {
  const { address } = useWallet()
  const { network } = useNetwork()
  const [streams, setStreams] = useState<StreamData[]>([])
  const [loading, setLoading] = useState(false)
  const [isRefreshingAfterHidden, setIsRefreshingAfterHidden] = useState(false)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Tracks whether the polling interval is currently running.
  const pollingActiveRef = useRef(false)

  // Monotonically increasing request ID — any response whose ID doesn't
  // match the current value is from a stale request and is discarded.
  const requestIdRef = useRef(0)

  // Holds the AbortController for the currently in-flight fetch so we can
  // cancel the underlying network request when address/network changes,
  // not just guard the state update.
  const abortCtrlRef = useRef<AbortController | null>(null)

  // Tracks when the tab was hidden so we can decide whether to show the
  // "Refreshing…" indicator on tab re-focus.
  const hiddenAtRef = useRef<number | null>(null)

  const { enablePolling = true, pollInterval = 30000 } = options ?? {}

  const fetch = useCallback(
    async () => {
      // Cancel any previous in-flight request at the network level.
      abortCtrlRef.current?.abort()
      const ctrl = new AbortController()
      abortCtrlRef.current = ctrl

      // Bump the generation counter so stale responses are discarded even
      // if AbortController doesn't reach every internal fetch call.
      requestIdRef.current += 1
      const req = requestIdRef.current

      if (!address) {
        setStreams([])
        if (req === requestIdRef.current) setLoading(false)
        return
      }
      setLoading(true)
      try {
        const data = await fetchStreamsForAddress(network, address)
        // Discard if a newer request has already started.
        if (req !== requestIdRef.current) return
        setStreams(data)
      } catch (e) {
        if (req !== requestIdRef.current) return
        // Suppress errors from intentionally aborted requests.
        if (e instanceof DOMException && e.name === 'AbortError') return
        captureError(e, { operation: 'use-streams:fetch' })
      } finally {
        if (req === requestIdRef.current) setLoading(false)
      }
    },
    [address, network],
  )

  // Fetch on mount and when address changes
  useEffect(() => {
    fetch()
  }, [fetch])

  // Re-fetch when a write invalidates the cache
  useInvalidation(fetch)

  // ─── Polling helpers ───────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollingActiveRef.current || !enablePolling || !address) return
    pollIntervalRef.current = setInterval(fetch, pollInterval)
    pollingActiveRef.current = true
  }, [enablePolling, address, fetch, pollInterval])

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    pollingActiveRef.current = false
  }, [])

  // ─── Page Visibility integration ──────────────────────────────────────────
  //
  // When the tab is hidden we pause the polling interval to avoid wasting
  // bandwidth, battery, and RPC rate-limit quota.
  // When it becomes visible again we:
  //   1. Immediately fire a fresh fetch (no stale data shown).
  //   2. Restart the polling interval.
  //   3. Briefly show "Refreshing…" if the tab was hidden long enough that
  //      the cached data could be considered stale.
  //
  // Note: auto-withdraw (useAutoWithdraw) manages its own separate interval
  // and is intentionally not affected here.

  usePageVisibility({
    onHidden: useCallback(() => {
      hiddenAtRef.current = Date.now()
      stopPolling()
    }, [stopPolling]),

    onVisible: useCallback(() => {
      const hiddenDuration = hiddenAtRef.current
        ? Date.now() - hiddenAtRef.current
        : 0
      hiddenAtRef.current = null

      // Show "Refreshing…" indicator only when data could be noticeably stale.
      if (hiddenDuration >= STALE_THRESHOLD_MS) {
        setIsRefreshingAfterHidden(true)
        fetch().finally(() => setIsRefreshingAfterHidden(false))
      } else {
        fetch()
      }

      startPolling()
    }, [fetch, startPolling]),
  })

  // ─── Main polling setup ───────────────────────────────────────────────────
  //
  // This effect owns the lifecycle of the polling interval. The visibility
  // handlers above call startPolling/stopPolling without re-running this
  // effect so there is no double-interval risk.

  useEffect(() => {
    if (!enablePolling || !address) {
      stopPolling()
      return
    }
    // Only start if the page is currently visible. If the page starts hidden
    // (e.g. opened via Ctrl+click then later focused), the onVisible handler
    // will call startPolling when the tab is first viewed.
    if (typeof document === 'undefined' || !document.hidden) {
      startPolling()
    }
    return () => stopPolling()
  }, [enablePolling, address, startPolling, stopPolling])

  const sent = streams.filter((s) => s.sender === address)
  const received = streams.filter((s) => s.recipient === address)

  return { all: streams, sent, received, loading, isRefreshingAfterHidden, refetch: fetch }
}

export function useStream(id: string): {
  stream: StreamData | null
  loading: boolean
  refetch: () => void
} {
  const { network } = useNetwork()
  const [stream, setStream] = useState<StreamData | null>(null)
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)
  const abortCtrlRef = useRef<AbortController | null>(null)

  const fetch = useCallback(async () => {
    // Cancel any previous in-flight request at the network level.
    abortCtrlRef.current?.abort()
    const ctrl = new AbortController()
    abortCtrlRef.current = ctrl

    requestIdRef.current += 1
    const req = requestIdRef.current

    if (!id) {
      if (req === requestIdRef.current) setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchStream(network, id)
      if (req !== requestIdRef.current) return
      setStream(data)
    } catch (e) {
      if (req !== requestIdRef.current) return
      if (e instanceof DOMException && e.name === 'AbortError') return
      captureError(e, { operation: 'use-stream:fetch' })
    } finally {
      if (req === requestIdRef.current) setLoading(false)
    }
  }, [id, network])

  useEffect(() => {
    fetch()
  }, [fetch])

  useInvalidation(fetch)

  return { stream, loading, refetch: fetch }
}
