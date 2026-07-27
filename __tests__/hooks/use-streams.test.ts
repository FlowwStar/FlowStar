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
