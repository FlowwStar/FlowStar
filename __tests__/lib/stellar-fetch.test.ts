import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkAccountInfo,
  getXlmBalance,
  HORIZON_REQUEST_TIMEOUT_MS,
} from '@/lib/stellar'

const originalFetch = global.fetch

describe('Horizon fetches in lib/stellar.ts (Issue #1035)', () => {
  const TEST_ADDRESS = 'GBWEDYWFGPNPAWCYOKWMCRPTR4IMV4SNZ7CVOZHPUXGHVXXPJSCFKVXQ'

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('HORIZON_REQUEST_TIMEOUT_MS', () => {
    it('exports a 30s timeout constant aligned with contract request timeout', () => {
      expect(HORIZON_REQUEST_TIMEOUT_MS).toBe(30_000)
    })
  })

  describe('checkAccountInfo', () => {
    it('passes AbortSignal timeout to fetch and handles timeout error', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(
        new Error('The operation was aborted due to timeout'),
      )

      const result = await checkAccountInfo(TEST_ADDRESS, 'testnet')

      expect(result).toEqual({
        exists: false,
        funded: false,
        transactionCount: 0,
        error: 'Network error',
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/accounts/${TEST_ADDRESS}`),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      )
    })

    it('returns existing account info on 200 response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [1, 2, 3] }),
      } as Response)

      const result = await checkAccountInfo(TEST_ADDRESS, 'testnet')
      expect(result).toEqual({
        exists: true,
        funded: true,
        transactionCount: 3,
      })
    })

    it('returns exists=false on 404 response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      const result = await checkAccountInfo(TEST_ADDRESS, 'testnet')
      expect(result).toEqual({
        exists: false,
        funded: false,
        transactionCount: 0,
      })
    })
  })

  describe('getXlmBalance', () => {
    it('passes AbortSignal timeout to fetch and handles timeout by returning null', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(
        new Error('The operation was aborted due to timeout'),
      )

      const result = await getXlmBalance(TEST_ADDRESS, 'testnet')
      expect(result).toBeNull()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/accounts/${TEST_ADDRESS}`),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      )
    })

    it('returns stroops balance on successful response with native asset', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            { asset_type: 'credit_alphanum4', balance: '100.0' },
            { asset_type: 'native', balance: '25.5' },
          ],
        }),
      } as Response)

      const result = await getXlmBalance(TEST_ADDRESS, 'testnet')
      // 25.5 XLM = 255,000,000 stroops
      expect(result).toBe(255_000_000n)
    })

    it('returns null when response is not ok', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

      const result = await getXlmBalance(TEST_ADDRESS, 'testnet')
      expect(result).toBeNull()
    })
  })
})
