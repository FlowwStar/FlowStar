import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: vi.fn(() => ({
    network: 'testnet',
    config: { rpcUrl: 'https://rpc.testnet.example', streamContractId: 'CCONTRACT' },
  })),
}))

import { useStreamHistory } from '@/hooks/use-stream-history'
import type { TimelineEvent } from '@/hooks/use-stream-history'

const originalFetch = global.fetch

describe('useStreamHistory', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('basic hook behavior', () => {
    it('returns initial state with empty events and loading false', () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ result: { events: [] } }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory(''))
      expect(result.current.events).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(typeof result.current.refetch).toBe('function')
    })

    it('does nothing when streamId is empty', async () => {
      const { result } = renderHook(() => useStreamHistory(''))
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      expect(result.current.events).toEqual([])
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('sets loading to true during fetch', async () => {
      let resolvePromise: (value: any) => void
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(global.fetch).mockReturnValue(fetchPromise as any)

      const { result } = renderHook(() => useStreamHistory('1'))

      // Should be loading initially
      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      // Resolve the fetch
      resolvePromise!({
        ok: true,
        json: async () => ({ result: { events: [] } }),
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    it('refetch re-triggers the load', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ result: { events: [] } }),
      } as Response)
      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))
      const callsBefore = vi.mocked(global.fetch).mock.calls.length
      await result.current.refetch()
      expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  describe('event type decoding', () => {
    it('decodes "created" event type from stream_created topic', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 100,
                ledgerClosedAt: '2024-01-15T10:00:00Z',
                txHash: 'abc123',
                topic: ['stream_created'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events).toHaveLength(1)
      expect(result.current.events[0].type).toBe('created')
      expect(result.current.events[0].description).toBe('Stream created')
    })

    it('decodes "created" event type from create topic', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 101,
                ledgerClosedAt: '2024-01-15T10:00:00Z',
                txHash: 'def456',
                topic: ['create', 'stream'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events[0].type).toBe('created')
    })

    it('decodes "withdrawal" event type', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 102,
                ledgerClosedAt: '2024-01-15T11:00:00Z',
                txHash: 'ghi789',
                topic: ['withdraw'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events[0].type).toBe('withdrawal')
      expect(result.current.events[0].description).toBe('Withdrawal from stream')
    })

    it('decodes "topup" event type from topup topic', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 103,
                ledgerClosedAt: '2024-01-15T12:00:00Z',
                txHash: 'jkl012',
                topic: ['topup'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events[0].type).toBe('topup')
      expect(result.current.events[0].description).toBe('Stream topped up')
    })

    it('decodes "topup" event type from top_up topic', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 104,
                ledgerClosedAt: '2024-01-15T12:00:00Z',
                txHash: 'mno345',
                topic: ['top_up'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events[0].type).toBe('topup')
    })

    it('decodes "topup" event type from deposit topic', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 105,
                ledgerClosedAt: '2024-01-15T12:00:00Z',
                txHash: 'pqr678',
                topic: ['deposit'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events[0].type).toBe('topup')
    })

    it('decodes "transfer" event type', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 106,
                ledgerClosedAt: '2024-01-15T13:00:00Z',
                txHash: 'stu901',
                topic: ['transfer'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events[0].type).toBe('transfer')
      expect(result.current.events[0].description).toBe('Stream transferred to new recipient')
    })

    it('decodes "cancellation" event type', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 107,
                ledgerClosedAt: '2024-01-15T14:00:00Z',
                txHash: 'vwx234',
                topic: ['cancel'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events[0].type).toBe('cancellation')
      expect(result.current.events[0].description).toBe('Stream cancelled')
    })

    it('filters out events with unrecognized topic types', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 108,
                ledgerClosedAt: '2024-01-15T15:00:00Z',
                txHash: 'yz567',
                topic: ['unknown_event'],
                value: { xdr: '' },
              },
              {
                type: 'contract',
                ledger: 109,
                ledgerClosedAt: '2024-01-15T15:01:00Z',
                txHash: 'abc890',
                topic: ['stream_created'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events).toHaveLength(1)
      expect(result.current.events[0].type).toBe('created')
    })

    it('handles case-insensitive topic matching', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 110,
                ledgerClosedAt: '2024-01-15T16:00:00Z',
                txHash: 'def123',
                topic: ['WITHDRAW', 'Stream'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events[0].type).toBe('withdrawal')
    })
  })

  describe('event formatting', () => {
    it('includes all required timeline event properties', async () => {
      const ledgerClosedAt = '2024-01-15T10:00:00Z'
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 100,
                ledgerClosedAt,
                txHash: 'abc123',
                topic: ['stream_created'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      const event = result.current.events[0]
      expect(event).toHaveProperty('type')
      expect(event).toHaveProperty('txHash')
      expect(event).toHaveProperty('timestamp')
      expect(event).toHaveProperty('ledger')
      expect(event).toHaveProperty('description')

      expect(event.type).toBe('created')
      expect(event.txHash).toBe('abc123')
      expect(event.timestamp).toBe(new Date(ledgerClosedAt).getTime())
      expect(event.ledger).toBe(100)
      expect(event.description).toBe('Stream created')
    })

    it('handles missing ledgerClosedAt by using current time', async () => {
      const beforeTest = Date.now()

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 100,
                txHash: 'abc123',
                topic: ['stream_created'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      const afterTest = Date.now()
      const event = result.current.events[0]

      expect(event.timestamp).toBeGreaterThanOrEqual(beforeTest)
      expect(event.timestamp).toBeLessThanOrEqual(afterTest)
    })

    it('handles missing txHash with empty string', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 100,
                ledgerClosedAt: '2024-01-15T10:00:00Z',
                topic: ['stream_created'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events[0].txHash).toBe('')
    })
  })

  describe('event accumulation and sorting', () => {
    it('accumulates multiple events from RPC response', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 100,
                ledgerClosedAt: '2024-01-15T10:00:00Z',
                txHash: 'tx1',
                topic: ['stream_created'],
                value: { xdr: '' },
              },
              {
                type: 'contract',
                ledger: 101,
                ledgerClosedAt: '2024-01-15T11:00:00Z',
                txHash: 'tx2',
                topic: ['topup'],
                value: { xdr: '' },
              },
              {
                type: 'contract',
                ledger: 102,
                ledgerClosedAt: '2024-01-15T12:00:00Z',
                txHash: 'tx3',
                topic: ['withdraw'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events).toHaveLength(3)
      expect(result.current.events[0].type).toBe('withdrawal')
      expect(result.current.events[1].type).toBe('topup')
      expect(result.current.events[2].type).toBe('created')
    })

    it('sorts events by timestamp in descending order (newest first)', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 100,
                ledgerClosedAt: '2024-01-15T10:00:00Z',
                txHash: 'tx1',
                topic: ['stream_created'],
                value: { xdr: '' },
              },
              {
                type: 'contract',
                ledger: 103,
                ledgerClosedAt: '2024-01-15T13:00:00Z',
                txHash: 'tx4',
                topic: ['cancel'],
                value: { xdr: '' },
              },
              {
                type: 'contract',
                ledger: 101,
                ledgerClosedAt: '2024-01-15T11:00:00Z',
                txHash: 'tx2',
                topic: ['topup'],
                value: { xdr: '' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      const timestamps = result.current.events.map((e) => e.timestamp)
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1])
      }

      expect(result.current.events[0].type).toBe('cancellation')
      expect(result.current.events[1].type).toBe('topup')
      expect(result.current.events[2].type).toBe('created')
    })

    it('handles empty events array from RPC', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events).toEqual([])
    })

    it('handles missing result.events in RPC response', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {},
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events).toEqual([])
    })

    it('handles missing result in RPC response', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events).toEqual([])
    })
  })

  describe('error handling', () => {
    it('falls back to an empty event list on RPC failure', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))
      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      expect(result.current.events).toEqual([])
    })

    it('handles malformed JSON response gracefully', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      } as unknown as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events).toEqual([])
    })

    it('handles network timeout', async () => {
      vi.mocked(global.fetch).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100)),
      )

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 })

      expect(result.current.events).toEqual([])
    })

    it('handles HTTP error responses', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events).toEqual([])
    })

    it('handles missing contractId gracefully', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ result: { events: [] } }),
      } as Response)

      // The hook should still call fetch with empty contractId
      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.events).toEqual([])
    })
  })

  describe('RPC integration', () => {
    it('calls RPC endpoint with correct parameters', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ result: { events: [] } }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(global.fetch).toHaveBeenCalledWith(
        'https://rpc.testnet.example',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"method":"getEvents"'),
        }),
      )

      const callArgs = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]?.body as string)

      expect(body.jsonrpc).toBe('2.0')
      expect(body.id).toBe(1)
      expect(body.method).toBe('getEvents')
      expect(body.params.startLedger).toBe(1)
      expect(body.params.filters).toEqual([
        {
          type: 'contract',
          contractIds: ['CCONTRACT'],
        },
      ])
      expect(body.params.pagination.limit).toBe(200)
    })

    it('processes RPC response with all event fields', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            events: [
              {
                type: 'contract',
                ledger: 12345,
                ledgerClosedAt: '2024-01-15T10:30:45Z',
                txHash: 'abcdef123456',
                topic: ['withdraw', 'stream', '1'],
                value: { xdr: 'sample_xdr_data' },
              },
            ],
          },
        }),
      } as Response)

      const { result } = renderHook(() => useStreamHistory('1'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      const event = result.current.events[0]
      expect(event.ledger).toBe(12345)
      expect(event.txHash).toBe('abcdef123456')
      expect(event.timestamp).toBe(new Date('2024-01-15T10:30:45Z').getTime())
    })
  })

  describe('hook re-rendering and dependency changes', () => {
    it('reloads events when streamId changes', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ result: { events: [] } }),
      } as Response)

      const { result, rerender } = renderHook(({ id }) => useStreamHistory(id), {
        initialProps: { id: '1' },
      })

      await waitFor(() => expect(result.current.loading).toBe(false))
      const firstCallCount = vi.mocked(global.fetch).mock.calls.length

      rerender({ id: '2' })

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThan(firstCallCount)
    })

    it('does not reload when streamId stays the same', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ result: { events: [] } }),
      } as Response)

      const { result, rerender } = renderHook(({ id }) => useStreamHistory(id), {
        initialProps: { id: '1' },
      })

      await waitFor(() => expect(result.current.loading).toBe(false))
      const callCount = vi.mocked(global.fetch).mock.calls.length

      rerender({ id: '1' })

      // Small delay to ensure no additional calls
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(vi.mocked(global.fetch).mock.calls.length).toBe(callCount)
    })
  })
})
