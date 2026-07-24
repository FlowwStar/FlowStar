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
})
