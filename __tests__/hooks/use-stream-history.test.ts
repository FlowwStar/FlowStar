import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: vi.fn(() => ({
    network: 'testnet',
    config: { rpcUrl: 'https://rpc.testnet.example', streamContractId: 'CCONTRACT' },
  })),
}))

import { useStreamHistory } from '@/hooks/use-stream-history'

const originalFetch = global.fetch

describe('useStreamHistory', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('does nothing when streamId is empty', async () => {
    const { result } = renderHook(() => useStreamHistory(''))
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.events).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('loads and decodes events from the RPC response', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          events: [
            {
              type: 'contract',
              ledger: 100,
              ledgerClosedAt: new Date().toISOString(),
              txHash: 'abc123',
              topic: ['stream_created'],
              value: { xdr: '' },
            },
          ],
        },
      }),
    } as Response)

    const { result } = renderHook(() => useStreamHistory('1'))
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.events).toHaveLength(1)
    expect(result.current.events[0].type).toBe('created')
  })

  it('falls back to an empty event list on RPC failure', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useStreamHistory('1'))
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.events).toEqual([])
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
