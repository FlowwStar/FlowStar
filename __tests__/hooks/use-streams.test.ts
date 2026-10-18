import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { StreamData } from '@/types/stream'

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/contract', () => ({
  fetchStreamsForAddress: vi.fn(),
  fetchStream: vi.fn(),
}))

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: vi.fn(() => ({ address: 'GABC123' })),
}))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: vi.fn(() => ({ network: 'testnet' })),
}))

import { fetchStreamsForAddress } from '@/lib/contract'
import { useWallet } from '@/hooks/use-wallet'
import { useStreams, invalidateStreams } from '@/hooks/use-streams'

const mockStream: StreamData = {
  id: '1',
  sender: 'GABC123',
  recipient: 'GXYZ789',
  token: { address: 'TOKEN', symbol: 'USDC', decimals: 7 },
  depositedAmount: 1000n,
  withdrawnAmount: 100n,
  startTime: 0n,
  endTime: 9999999999n,
  cliffTime: 0n,
  cliffAmount: 0n,
  amountPerSecond: 1n,
  linearAmount: 1000n,
  duration: 9999999999n,
  cancelled: false,
}

describe('useStreams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchStreamsForAddress).mockResolvedValue([mockStream])
  })

  it('fetches streams on mount', async () => {
    const { result } = renderHook(() => useStreams({ enablePolling: false }))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.all).toHaveLength(1)
    expect(fetchStreamsForAddress).toHaveBeenCalledWith('testnet', 'GABC123')
  })

  it('categorizes streams into sent and received', async () => {
    const received: StreamData = { ...mockStream, id: '2', sender: 'GOTHER', recipient: 'GABC123' }
    vi.mocked(fetchStreamsForAddress).mockResolvedValue([mockStream, received])

    const { result } = renderHook(() => useStreams({ enablePolling: false }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.sent).toHaveLength(1)
    expect(result.current.received).toHaveLength(1)
  })

  it('returns empty arrays when wallet not connected', async () => {
    vi.mocked(useWallet).mockReturnValue({ address: null } as any)
    const { result } = renderHook(() => useStreams({ enablePolling: false }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.all).toHaveLength(0)
  })

  it('handles fetch error gracefully', async () => {
    vi.mocked(fetchStreamsForAddress).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useStreams({ enablePolling: false }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.all).toHaveLength(0)
  })

  it('exposes a refetch function', async () => {
    const { result } = renderHook(() => useStreams({ enablePolling: false }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(typeof result.current.refetch).toBe('function')
  })
})

describe('invalidateStreams', () => {
  it('triggers refetch in subscribed hooks', async () => {
    vi.mocked(fetchStreamsForAddress).mockResolvedValue([mockStream])

    const { result } = renderHook(() => useStreams({ enablePolling: false }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchStreamsForAddress).toHaveBeenCalledTimes(1)

    // Update mock to return different data
    const updatedStream = { ...mockStream, id: '2' }
    vi.mocked(fetchStreamsForAddress).mockResolvedValue([mockStream, updatedStream])

    // Call invalidateStreams
    invalidateStreams()

    // Wait for refetch to complete
    await waitFor(() => {
      expect(fetchStreamsForAddress).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expect(result.current.all).toHaveLength(2)
    })
  })

  it('clears cache by triggering fresh fetch', async () => {
    vi.mocked(fetchStreamsForAddress).mockResolvedValue([mockStream])

    const { result } = renderHook(() => useStreams({ enablePolling: false }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const initialCallCount = vi.mocked(fetchStreamsForAddress).mock.calls.length

    invalidateStreams()

    await waitFor(() => {
      expect(fetchStreamsForAddress).toHaveBeenCalledTimes(initialCallCount + 1)
    })
  })

  it('notifies multiple subscribed hooks', async () => {
    vi.mocked(fetchStreamsForAddress).mockResolvedValue([mockStream])

    const { result: result1 } = renderHook(() => useStreams({ enablePolling: false }))
    const { result: result2 } = renderHook(() => useStreams({ enablePolling: false }))

    await waitFor(() => {
      expect(result1.current.loading).toBe(false)
      expect(result2.current.loading).toBe(false)
    })

    const callCountBefore = vi.mocked(fetchStreamsForAddress).mock.calls.length

    invalidateStreams()

    // Both hooks should refetch
    await waitFor(() => {
      expect(fetchStreamsForAddress).toHaveBeenCalledTimes(callCountBefore + 2)
    })
  })
})

describe('useStream (single stream)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('transitions from loading to loaded state', async () => {
    const { fetchStream } = await import('@/lib/contract')
    vi.mocked(fetchStream).mockResolvedValue(mockStream)

    const { useStream } = await import('@/hooks/use-streams')
    const { result } = renderHook(() => useStream('1'))

    expect(result.current.loading).toBe(true)
    expect(result.current.stream).toBe(null)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.stream).toEqual(mockStream)
  })

  it('returns null stream for unknown id', async () => {
    const { fetchStream } = await import('@/lib/contract')
    vi.mocked(fetchStream).mockResolvedValue(null)

    const { useStream } = await import('@/hooks/use-streams')
    const { result } = renderHook(() => useStream('unknown-id'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.stream).toBe(null)
  })

  it('refetch reloads the stream', async () => {
    const { fetchStream } = await import('@/lib/contract')
    vi.mocked(fetchStream).mockResolvedValue(mockStream)

    const { useStream } = await import('@/hooks/use-streams')
    const { result } = renderHook(() => useStream('1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(fetchStream).toHaveBeenCalledTimes(1)

    // Update mock
    const updatedStream = { ...mockStream, withdrawnAmount: 200n }
    vi.mocked(fetchStream).mockResolvedValue(updatedStream)

    // Call refetch
    result.current.refetch()

    await waitFor(() => {
      expect(fetchStream).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expect(result.current.stream?.withdrawnAmount).toBe(200n)
    })
  })

  it('handles fetch errors gracefully', async () => {
    const { fetchStream } = await import('@/lib/contract')
    vi.mocked(fetchStream).mockRejectedValue(new Error('Network error'))

    const { useStream } = await import('@/hooks/use-streams')
    const { result } = renderHook(() => useStream('1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.stream).toBe(null)
  })

  it('does not fetch when id is empty', async () => {
    const { fetchStream } = await import('@/lib/contract')

    const { useStream } = await import('@/hooks/use-streams')
    const { result } = renderHook(() => useStream(''))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(fetchStream).not.toHaveBeenCalled()
    expect(result.current.stream).toBe(null)
  })
})
