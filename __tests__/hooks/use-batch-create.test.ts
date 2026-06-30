import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUseWallet = vi.hoisted(() => vi.fn(() => ({ address: 'GSENDER', isConnected: true })))

vi.mock('@/lib/contract', () => ({
  createStream: vi.fn(),
}))

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: mockUseWallet,
}))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: vi.fn(() => ({ network: 'testnet' })),
}))

vi.mock('@/hooks/use-streams', () => ({
  invalidateStreams: vi.fn(),
}))

import { createStream } from '@/lib/contract'
import { useBatchCreate, type BatchStreamInput } from '@/hooks/use-batch-create'

const TOKEN = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }

const makeStream = (i = 0): BatchStreamInput => ({
  recipient: `GRCPT${i}`,
  token: TOKEN,
  totalAmount: 1000n,
  startTime: 0n,
  endTime: 9999n,
  cliffTime: 0n,
  cliffAmount: 0n,
})

describe('useBatchCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseWallet.mockReturnValue({ address: 'GSENDER', isConnected: true })
    vi.mocked(createStream).mockResolvedValue('stream-id-1')
  })

  it('throws when wallet not connected', async () => {
    mockUseWallet.mockReturnValue({ address: null, isConnected: false } as any)
    const { result } = renderHook(() => useBatchCreate())
    await expect(
      act(() => result.current.createBatch([makeStream()], { batchDelay: 0 }))
    ).rejects.toThrow('Wallet not connected')
  })

  it('throws for empty streams array', async () => {
    const { result } = renderHook(() => useBatchCreate())
    await expect(
      act(() => result.current.createBatch([], { batchDelay: 0 }))
    ).rejects.toThrow('No streams to create')
  })

  it('throws when batch exceeds 100 streams', async () => {
    const { result } = renderHook(() => useBatchCreate())
    const streams = Array.from({ length: 101 }, (_, i) => makeStream(i))
    await expect(
      act(() => result.current.createBatch(streams, { batchDelay: 0 }))
    ).rejects.toThrow('Batch size exceeds maximum')
  })

  it('creates streams and tracks progress', async () => {
    vi.mocked(createStream)
      .mockResolvedValueOnce('id-1')
      .mockResolvedValueOnce('id-2')

    const { result } = renderHook(() => useBatchCreate())
    let final: any
    await act(async () => {
      final = await result.current.createBatch([makeStream(0), makeStream(1)], { batchDelay: 0 })
    })

    expect(final.completed).toBe(2)
    expect(final.failed).toBe(0)
    expect(final.successIds).toEqual(['id-1', 'id-2'])
    expect(final.isRunning).toBe(false)
  })

  it('records errors for failed streams without stopping', async () => {
    vi.mocked(createStream)
      .mockResolvedValueOnce('id-1')
      .mockRejectedValueOnce(new Error('rejected'))

    const { result } = renderHook(() => useBatchCreate())
    let final: any
    await act(async () => {
      final = await result.current.createBatch([makeStream(0), makeStream(1)], { batchDelay: 0 })
    })

    expect(final.completed).toBe(1)
    expect(final.failed).toBe(1)
    expect(final.errors.get(1)).toBe('rejected')
  })

  it('exposes a cancel function', () => {
    const { result } = renderHook(() => useBatchCreate())
    expect(typeof result.current.cancel).toBe('function')
  })
})
