'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchStreamsForAddress, fetchStream } from '@/lib/contract'
import type { StreamData } from '@/types/stream'
import { useWallet } from '@/hooks/use-wallet'

// ─── Refresh bus ─────────────────────────────────────────────────────────────
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
    return () => { listeners.delete(handler) }
  }, [])
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export interface CategorizedStreams {
  sent: StreamData[]
  received: StreamData[]
  all: StreamData[]
  loading: boolean
  refetch: () => void
}

export function useStreams(): CategorizedStreams {
  const { address } = useWallet()
  const [streams, setStreams] = useState<StreamData[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!address) { setStreams([]); return }
    setLoading(true)
    try {
      const data = await fetchStreamsForAddress(address)
      setStreams(data)
    } catch (e) {
      console.error('useStreams fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [address])

  // Fetch on mount and when address changes
  useEffect(() => { fetch() }, [fetch])

  // Re-fetch when a write invalidates the cache
  useInvalidation(fetch)

  const sent = streams.filter((s) => s.sender === address)
  const received = streams.filter((s) => s.recipient === address)

  return { all: streams, sent, received, loading, refetch: fetch }
}

export function useStream(id: string): { stream: StreamData | null; loading: boolean; refetch: () => void } {
  const [stream, setStream] = useState<StreamData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await fetchStream(id)
      setStream(data)
    } catch (e) {
      console.error('useStream fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetch() }, [fetch])
  useInvalidation(fetch)

  return { stream, loading, refetch: fetch }
}
