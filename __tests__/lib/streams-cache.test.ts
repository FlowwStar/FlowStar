import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readCachedStreams, writeCachedStreams } from '@/lib/streams-cache'
import type { StreamData } from '@/types/stream'

const stream: StreamData = {
  id: '42',
  sender: 'G SENDER',
  recipient: 'G RECIPIENT',
  token: { address: 'C TOKEN', symbol: 'TKN', decimals: 7 },
  depositedAmount: 1000n,
  withdrawnAmount: 25n,
  startTime: 100n,
  endTime: 200n,
  cliffTime: 100n,
  cliffAmount: 0n,
  amountPerSecond: 10n,
  linearAmount: 1000n,
  duration: 100n,
  cancelled: false,
}

describe('streams cache', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('writes and reads streams with bigint fields restored', () => {
    writeCachedStreams('testnet', 'G ADDRESS', [stream])

    expect(readCachedStreams('testnet', 'G ADDRESS')).toEqual({
      streams: [stream],
      fetchedAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
    })
    expect(readCachedStreams('mainnet', 'G ADDRESS')).toBeNull()
  })

  it('preserves the original fetchedAt so callers can detect stale data', () => {
    writeCachedStreams('testnet', 'G ADDRESS', [stream])
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'))

    const cached = readCachedStreams('testnet', 'G ADDRESS')
    expect(cached?.fetchedAt).toBe(new Date('2026-01-01T00:00:00.000Z').getTime())
    expect(Date.now() - (cached?.fetchedAt ?? 0)).toBeGreaterThan(24 * 60 * 60 * 1000 - 1)
  })

  it('returns null and does not throw when window is unavailable', () => {
    vi.stubGlobal('window', undefined)

    expect(readCachedStreams('testnet', 'G ADDRESS')).toBeNull()
    expect(() => writeCachedStreams('testnet', 'G ADDRESS', [stream])).not.toThrow()
  })

  it('returns null for missing or corrupt cache entries', () => {
    expect(readCachedStreams('testnet', 'G ADDRESS')).toBeNull()
    localStorage.setItem('flowstar:streams-cache:testnet:G ADDRESS', 'not-json')
    expect(readCachedStreams('testnet', 'G ADDRESS')).toBeNull()
  })
})
