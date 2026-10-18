'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchStreamsForAddress, fetchStream } from '@/lib/contract'
import type { StreamData } from '@/types/stream'
import { useWallet } from '@/hooks/use-wallet'
import { useNetwork } from '@/components/providers/network-provider'
import { captureError } from '@/lib/sentry'
import { usePageVisibility } from '@/hooks/use-page-visibility'
import { readCachedStreams, writeCachedStreams } from '@/lib/streams-cache'

// ─── Refresh bus ───────────────────────────────────────────────────────────────
// Components call `invalidateStreams()` after a write so all stream hooks
// re-fetch without prop-drilling or global state.
type Listener = () => void
const listeners = new Set<Listener>()

/**
 * Signals every mounted {@link useStreams} and {@link useStream} instance to
 * immediately re-fetch stream data from the contract.
 *
 * Call this after any write operation (create, withdraw, cancel, top-up, etc.)
 * so that the UI reflects the updated state without waiting for the next
 * poll tick. Uses a simple in-module listener set — no global state manager
 * or prop-drilling required.
 *
 * @example
 * // Inside a component that just created a stream:
 * await contractCreateStream(...)
 * invalidateStreams()
 */
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
  /** True when `all` is being served from the offline cache rather than a live fetch. */
  stale: boolean
  /** When the cached (or last successful) data was fetched, if known. */
  lastUpdated: number | null
}

interface UseStreamsOptions {
  enablePolling?: boolean
  pollInterval?: number
}

// How long the tab must have been hidden before we show "Refreshing…"
const STALE_THRESHOLD_MS = 3_000

/**
 * Fetches and subscribes to all streams associated with the currently
 * connected wallet address, split into sent and received categories.
 *
 * **Return shape:**
 * - `sent` — streams where the connected wallet is the sender.
 * - `received` — streams where the connected wallet is the recipient.
 * - `all` — unfiltered array of every stream returned by the contract.
 * - `loading` — `true` while the first (or any subsequent) fetch is in
 *   flight and no data is available yet.
 * - `isRefreshingAfterHidden` — `true` for the duration of the re-fetch that
 *   fires when the browser tab becomes visible again after being hidden for at
 *   least 3 seconds. Use this flag to show a non-blocking "Refreshing…"
 *   indicator without wiping out the existing stream list.
 * - `stale` — `true` when `all` is being served from the offline
 *   {@link readCachedStreams} cache rather than a live network response.
 *   This can happen when the browser is offline or when a network-level
 *   fetch fails — FlowStar falls back to the last known data so the user
 *   sees something instead of an empty dashboard.
 * - `lastUpdated` — Unix timestamp (ms) of when the most recent successful
 *   (or cached) fetch completed, or `null` if no data has been loaded yet.
 * - `refetch` — Imperative callback to trigger an immediate re-fetch; also
 *   called automatically on mount, on address/network change, when
 *   {@link invalidateStreams} fires, when the tab regains focus, and on
 *   every poll tick.
 *
 * **Polling:** Enabled by default every 30 seconds. Polling is paused while
 * the tab is hidden and resumes on visibility. Pass `enablePolling: false` or
 * a custom `pollInterval` (ms) via `options` to override.
 *
 * @param options - Optional configuration for the polling behaviour.
 * @param options.enablePolling  - Whether to poll for updates (default `true`).
 * @param options.pollInterval   - Polling interval in ms (default `30000`).
 * @returns A {@link CategorizedStreams} object.
 */
export function useStreams(options?: UseStreamsOptions): CategorizedStreams {
  const { address } = useWallet()
  const { network } = useNetwork()
  const [streams, setStreams] = useState<StreamData[]>([])
  const [loading, setLoading] = useState(false)
  const [isRefreshingAfterHidden, setIsRefreshingAfterHidden] = useState(false)
  // True while `streams` is serving the offline cache instead of a live fetch.
  const [stale, setStale] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

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
        setStale(false)
        setLastUpdated(null)
        if (req === requestIdRef.current) setLoading(false)
        return
      }

      // Offline (or the request will fail shortly): serve cached stream data
      // immediately with a stale indicator instead of an empty dashboard
      // (issue #150).
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const cached = readCachedStreams(network, address)
        if (cached) {
          setStreams(cached.streams)
          setStale(true)
          setLastUpdated(cached.fetchedAt)
        }
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const data = await fetchStreamsForAddress(network, address)
        // Discard if a newer request has already started.
        if (req !== requestIdRef.current) return
        setStreams(data)
        setStale(false)
        setLastUpdated(Date.now())
        writeCachedStreams(network, address, data)
      } catch (e) {
        if (req !== requestIdRef.current) return
        // Suppress errors from intentionally aborted requests.
        if (e instanceof DOMException && e.name === 'AbortError') return
        // Network-level failure (e.g. connectivity dropped mid-request) —
        // fall back to whatever we last cached rather than showing nothing.
        const cached = readCachedStreams(network, address)
        if (cached) {
          setStreams(cached.streams)
          setStale(true)
          setLastUpdated(cached.fetchedAt)
        }
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

  // Issue #142: abort whatever request is still in flight when this hook
  // instance unmounts (or `fetch` is about to be replaced because address/
  // network changed), rather than only aborting on the *next* fetch call.
  // Without this, a slow response can land after unmount and still call
  // setState on a component that's gone.
  useEffect(() => {
    return () => {
      abortCtrlRef.current?.abort()
    }
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

  // Re-fetch as soon as connectivity returns, so the stale/cached view
  // refreshes without waiting for the next poll tick.
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('online', fetch)
    return () => window.removeEventListener('online', fetch)
  }, [fetch])

  // Set up polling for real-time updates
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

  return {
    all: streams,
    sent,
    received,
    loading,
    isRefreshingAfterHidden,
    refetch: fetch,
    stale,
    lastUpdated,
  }
}

/**
 * Fetches a single stream by its contract ID and re-fetches whenever
 * {@link invalidateStreams} is called.
 *
 * Unlike {@link useStreams}, this hook does not poll. It fires one fetch on
 * mount and again whenever the stream `id`, the active network, or an
 * invalidation signal changes. Use `refetch` to trigger a manual refresh
 * after a write.
 *
 * **Return shape:**
 * - `stream` — The {@link StreamData} for the given ID, or `null` while
 *   loading or if the stream was not found.
 * - `loading` — `true` while a fetch is in flight.
 * - `refetch` — Imperative callback to trigger an immediate re-fetch.
 *
 * @param id - The contract stream ID to fetch.
 * @returns An object with `stream`, `loading`, and `refetch`.
 */
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

  // Issue #142: abort any in-flight request on unmount/id change instead of
  // only on the next fetch call, so a late response can't update state after
  // this hook instance is gone.
  useEffect(() => {
    return () => {
      abortCtrlRef.current?.abort()
    }
  }, [fetch])

  useInvalidation(fetch)

  return { stream, loading, refetch: fetch }
}
