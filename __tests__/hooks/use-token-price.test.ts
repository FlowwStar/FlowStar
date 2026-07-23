import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchXlmUsdPrice } from '@/hooks/use-token-price'

describe('fetchXlmUsdPrice', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed price on a valid response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ price: '0.42' }),
      }),
    )
    await expect(fetchXlmUsdPrice()).resolves.toBe(0.42)
  })

  it('rejects when the response has no numeric price field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    )
    await expect(fetchXlmUsdPrice()).rejects.toThrow()
  })

  it('rejects when the price field is not a number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ price: 'not-a-number' }),
      }),
    )
    await expect(fetchXlmUsdPrice()).rejects.toThrow()
  })
})
