import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTokenPrice, usePortfolioValue, formatUsd } from '@/hooks/use-token-price'
import type { StreamData } from '@/types/stream'

const originalFetch = global.fetch

describe('formatUsd', () => {
  it('formats sub-dollar values with 4 decimals', () => {
    expect(formatUsd(0.1234)).toBe('$0.1234')
  })

  it('formats normal values with 2 decimals', () => {
    expect(formatUsd(12.3)).toBe('$12.30')
  })

  it('formats large values with thousands separators', () => {
    expect(formatUsd(12345.678)).toBe('$12,345.68')
  })
})

describe('useTokenPrice', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns a fixed $1 price for stablecoins without fetching', async () => {
    const { result } = renderHook(() => useTokenPrice('USDC'))
    await waitFor(() => {
      expect(result.current.usdPrice).toBe(1)
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns null price for unknown, non-XLM symbols', async () => {
    const { result } = renderHook(() => useTokenPrice('SOME_UNKNOWN_TOKEN'))
    await waitFor(() => {
      expect(result.current.usdPrice).toBeNull()
      expect(result.current.loading).toBe(false)
    })
  })

  it('fetches and returns the XLM price', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ price: 0.42 }),
    } as Response)
    const { result } = renderHook(() => useTokenPrice('XLM'))
    await waitFor(() => {
      expect(result.current.usdPrice).toBe(0.42)
      expect(result.current.loading).toBe(false)
    })
  })

  it('caches the fetched price', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ price: 0.45 }),
    } as Response)

    const { result, unmount } = renderHook(() => useTokenPrice('XLM'))
    await waitFor(() => {
      expect(result.current.usdPrice).toBe(0.45)
    })
    
    unmount()

    // Second call should use cache, not call fetch
    const { result: result2 } = renderHook(() => useTokenPrice('XLM'))
    await waitFor(() => {
      expect(result2.current.usdPrice).toBe(0.45)
    })
    
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('handles error fallback by retaining the previous price if available', async () => {
    // 1. Initial successful fetch
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ price: 0.50 }),
    } as Response)

    const { result, unmount } = renderHook(() => useTokenPrice('XLM'))
    await waitFor(() => {
      expect(result.current.usdPrice).toBe(0.50)
    })
    unmount()

    // 2. Mock Date.now to simulate time passing beyond the cache threshold
    const realDateNow = Date.now.bind(global.Date)
    const futureTime = realDateNow() + 5 * 60 * 1000 + 1000
    global.Date.now = vi.fn(() => futureTime)

    // 3. Make the next fetch fail
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

    const { result: result2 } = renderHook(() => useTokenPrice('XLM'))
    
    await waitFor(() => {
      expect(result2.current.loading).toBe(false)
    })

    // The price should still be 0.50 from the previous successful fetch
    expect(result2.current.usdPrice).toBe(0.50)

    // Cleanup
    global.Date.now = realDateNow
  })
})

describe('usePortfolioValue', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ price: 0.5 }),
    } as Response)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns totalUsd=0 for an empty stream list', async () => {
    const { result } = renderHook(() => usePortfolioValue([]))
    expect(result.current.totalUsd).toBe(0)
    expect(result.current.loading).toBe(false)
  })

  it('sums locked USDC value across streams', async () => {
    const streams: StreamData[] = [
      {
        id: '1',
        sender: 'GSENDER',
        recipient: 'GRECIPIENT',
        token: { address: 'CUSDC', symbol: 'USDC', decimals: 7 },
        depositedAmount: 10_000_0000000n,
        withdrawnAmount: 0n,
        startTime: 0n,
        endTime: 9999999999n,
        cliffTime: 0n,
        cliffAmount: 0n,
        amountPerSecond: 1n,
        linearAmount: 10_000_0000000n,
        duration: 9999999999n,
        cancelled: false,
      },
    ]
    const { result } = renderHook(() => usePortfolioValue(streams))
    await waitFor(() => {
      expect(result.current.totalUsd).toBe(10_000)
    })
  })

  it('shows USD value for known tokens and ignores unknown tokens', async () => {
    const streams: StreamData[] = [
      {
        id: '1',
        sender: 'GSENDER',
        recipient: 'GRECIPIENT',
        token: { address: 'CUSDC', symbol: 'USDC', decimals: 7 },
        depositedAmount: 5_000_0000000n,
        withdrawnAmount: 0n,
        startTime: 0n,
        endTime: 9999999999n,
        cliffTime: 0n,
        cliffAmount: 0n,
        amountPerSecond: 1n,
        linearAmount: 5_000_0000000n,
        duration: 9999999999n,
        cancelled: false,
      },
      {
        id: '2',
        sender: 'GSENDER',
        recipient: 'GRECIPIENT',
        token: { address: 'CUSTOM_TOKEN', symbol: 'CUSTOM', decimals: 6 },
        depositedAmount: 1_000_000000n,
        withdrawnAmount: 0n,
        startTime: 0n,
        endTime: 9999999999n,
        cliffTime: 0n,
        cliffAmount: 0n,
        amountPerSecond: 1n,
        linearAmount: 1_000_000000n,
        duration: 9999999999n,
        cancelled: false,
      },
    ]
    const { result } = renderHook(() => usePortfolioValue(streams))
    await waitFor(() => {
      // Should show 5000 USD from USDC, not null despite unknown CUSTOM token
      expect(result.current.totalUsd).toBe(5_000)
    })
  })

  it('returns null when all streams use unknown tokens', async () => {
    const streams: StreamData[] = [
      {
        id: '1',
        sender: 'GSENDER',
        recipient: 'GRECIPIENT',
        token: { address: 'CUSTOM_TOKEN', symbol: 'CUSTOM', decimals: 6 },
        depositedAmount: 1_000_000000n,
        withdrawnAmount: 0n,
        startTime: 0n,
        endTime: 9999999999n,
        cliffTime: 0n,
        cliffAmount: 0n,
        amountPerSecond: 1n,
        linearAmount: 1_000_000000n,
        duration: 9999999999n,
        cancelled: false,
      },
    ]
    const { result } = renderHook(() => usePortfolioValue(streams))
    await waitFor(() => {
      expect(result.current.totalUsd).toBeNull()
    })
  })
})
