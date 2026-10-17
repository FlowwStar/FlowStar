import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useStreamHistory } from '@/hooks/use-stream-history'

// Mock the network provider
vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: vi.fn(() => ({
    config: {
      rpcUrl: 'https://rpc.example.com',
      streamContractId: 'CONTRACT123',
    },
    network: 'testnet',
  })),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useStreamHistory - fetchHorizonTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Horizon transactions mapping', () => {
    it('maps Horizon records into history entries', async () => {
      const horizonResponse = {
        _embedded: {
          records: [
            {
              hash: 'abc123',
              ledger: 12345,
              created_at: '2024-01-15T10:30:00Z',
            },
            {
              hash: 'def456',
              ledger: 12346,
              created_at: '2024-01-15T10:31:00Z',
            },
          ],
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => horizonResponse,
      })

      // Call the unexported fetchHorizonTransactions via dynamic import
      const module = await import('@/hooks/use-stream-history')
      const fetchHorizonTransactions = (module as any).fetchHorizonTransactions

      const result = await fetchHorizonTransactions(
        'https://horizon.example.com',
        'CONTRACT123',
        '42',
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        type: 'created',
        txHash: 'abc123',
        ledger: 12345,
        description: 'Transaction on stream #42',
      })
      expect(result[0].timestamp).toBe(new Date('2024-01-15T10:30:00Z').getTime())
      expect(result[1]).toMatchObject({
        type: 'created',
        txHash: 'def456',
        ledger: 12346,
        description: 'Transaction on stream #42',
      })
    })

    it('handles HTTP errors by returning empty array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const module = await import('@/hooks/use-stream-history')
      const fetchHorizonTransactions = (module as any).fetchHorizonTransactions

      const result = await fetchHorizonTransactions(
        'https://horizon.example.com',
        'CONTRACT123',
        '42',
      )

      expect(result).toEqual([])
    })

    it('handles empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ _embedded: { records: [] } }),
      })

      const module = await import('@/hooks/use-stream-history')
      const fetchHorizonTransactions = (module as any).fetchHorizonTransactions

      const result = await fetchHorizonTransactions(
        'https://horizon.example.com',
        'CONTRACT123',
        '42',
      )

      expect(result).toEqual([])
    })

    it('handles missing _embedded field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const module = await import('@/hooks/use-stream-history')
      const fetchHorizonTransactions = (module as any).fetchHorizonTransactions

      const result = await fetchHorizonTransactions(
        'https://horizon.example.com',
        'CONTRACT123',
        '42',
      )

      expect(result).toEqual([])
    })

    it('handles network errors by returning empty array', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'))

      const module = await import('@/hooks/use-stream-history')
      const fetchHorizonTransactions = (module as any).fetchHorizonTransactions

      const result = await fetchHorizonTransactions(
        'https://horizon.example.com',
        'CONTRACT123',
        '42',
      )

      expect(result).toEqual([])
    })

    it('returns empty array when contractId is empty', async () => {
      const module = await import('@/hooks/use-stream-history')
      const fetchHorizonTransactions = (module as any).fetchHorizonTransactions

      const result = await fetchHorizonTransactions(
        'https://horizon.example.com',
        '',
        '42',
      )

      expect(result).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('useStreamHistory hook integration', () => {
    it('fetches and returns events on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            events: [
              {
                type: 'contract',
                ledger: 100,
                ledgerClosedAt: '2024-01-15T10:00:00Z',
                txHash: 'tx123',
                topic: ['stream_created'],
                value: { xdr: 'base64xdr' },
              },
            ],
          },
        }),
      })

      const { result } = renderHook(() => useStreamHistory('stream-1'))

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.events).toHaveLength(1)
      expect(result.current.events[0]).toMatchObject({
        type: 'created',
        txHash: 'tx123',
        ledger: 100,
        description: 'Stream created',
      })
    })
  })
})
