import type { StreamData } from '@/types/stream'

/**
 * localStorage cache of the last successfully fetched stream list per
 * address/network, so the dashboard can render something useful when
 * offline instead of an empty/loading state (issue #150).
 *
 * `StreamData` amounts/timestamps are `bigint`, which `JSON.stringify`
 * can't serialize directly — we round-trip them through strings tagged
 * with a `n:` prefix.
 */

interface CachedEntry {
  streams: StreamData[]
  fetchedAt: number
}

function cacheKey(network: string, address: string): string {
  return `flowstar:streams-cache:${network}:${address}`
}

function replacer(_key: string, value: unknown) {
  return typeof value === 'bigint' ? `n:${value.toString()}` : value
}

function reviver(_key: string, value: unknown) {
  return typeof value === 'string' && /^n:-?\d+$/.test(value) ? BigInt(value.slice(2)) : value
}

export function readCachedStreams(network: string, address: string): CachedEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(cacheKey(network, address))
    if (!raw) return null
    return JSON.parse(raw, reviver) as CachedEntry
  } catch {
    return null
  }
}

export function writeCachedStreams(network: string, address: string, streams: StreamData[]) {
  if (typeof window === 'undefined') return
  try {
    const entry: CachedEntry = { streams, fetchedAt: Date.now() }
    window.localStorage.setItem(cacheKey(network, address), JSON.stringify(entry, replacer))
  } catch {
    // Storage may be full or unavailable (private browsing) — caching is
    // best-effort, never block the live fetch path on it.
  }
}
