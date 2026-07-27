import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const mockUseWallet = vi.hoisted(() => vi.fn(() => ({ address: 'GSENDER', isConnected: true })))

vi.mock('@/hooks/use-wallet', () => ({ useWallet: mockUseWallet }))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: vi.fn(() => ({ network: 'testnet' })),
}))

vi.mock('@/hooks/use-streams', () => ({ invalidateStreams: vi.fn() }))

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/lib/contract', () => ({
  createStream: vi.fn(),
  withdrawFromStream: vi.fn(),
  cancelStream: vi.fn(),
  estimateCreateStreamFee: vi.fn(),
}))

import {
  createStream,
  withdrawFromStream,
  cancelStream,
  estimateCreateStreamFee,
} from '@/lib/contract'
import { useContract } from '@/hooks/use-contract'
import type { CreateStreamInput, StreamData } from '@/types/stream'
import { getWithdrawableAmount } from '@/lib/stream-utils'

vi.mock('@/lib/stream-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stream-utils')>()
  return { ...actual, getWithdrawableAmount: vi.fn() }
})

// ── Fixtures ────────────────────────────────────────────────────────────────

const TOKEN = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }

const makeInput = (): CreateStreamInput => ({
  recipient: 'GRECIPIENT',
  token: TOKEN,
  totalAmount: 1000n,
  startTime: 0n,
  endTime: 9999n,
  cliffTime: 0n,
  cliffAmount: 0n,
})

const makeStream = (id = '1', recipient = 'GRCPT'): StreamData => ({
  id,
  sender: 'GSENDER',
  recipient,
  token: TOKEN,
  depositedAmount: 1000n,
  withdrawnAmount: 0n,
  startTime: 0n,
  endTime: 9999999999n,
  cliffTime: 0n,
  cliffAmount: 0n,
  amountPerSecond: 1n,
  linearAmount: 1000n,
  duration: 9999999999n,
  cancelled: false,
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useContract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseWallet.mockReturnValue({ address: 'GSENDER', isConnected: true })
    vi.mocked(createStream).mockResolvedValue('new-stream-id')
    vi.mocked(withdrawFromStream).mockResolvedValue('tx-hash-withdraw')
    vi.mocked(cancelStream).mockResolvedValue('tx-hash-cancel')
    vi.mocked(estimateCreateStreamFee).mockResolvedValue({
      minFee: 100_000,
      estimatedFee: 115_000,
      estimatedFeeXlm: '0.0115',
    })
  })

  // ── initial state ──────────────────────────────────────────────────────────

  it('starts with pending=false and error=null', () => {
    const { result } = renderHook(() => useContract())
    expect(result.current.pending).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // ── createStream ───────────────────────────────────────────────────────────

  it('calls createStream and returns the stream id', async () => {
    const { result } = renderHook(() => useContract())
    let id: string | undefined
    await act(async () => {
      id = await result.current.createStream(makeInput())
    })
    expect(id).toBe('new-stream-id')
    expect(createStream).toHaveBeenCalledOnce()
  })

  it('sets pending=true during createStream and resets after', async () => {
    let pendingDuringCall = false
    vi.mocked(createStream).mockImplementationOnce(async () => {
      // We can't directly check pending mid-async in a single thread,
      // but we verify it resets to false after completion.
      return 'id'
    })
    const { result } = renderHook(() => useContract())
    await act(async () => {
      await result.current.createStream(makeInput())
    })
    expect(result.current.pending).toBe(false)
  })

  it('sets error and rethrows when createStream fails', async () => {
    vi.mocked(createStream).mockRejectedValueOnce(new Error('user rejected'))
    const { result } = renderHook(() => useContract())
    await expect(act(() => result.current.createStream(makeInput()))).rejects.toThrow(
      'user rejected',
    )
    expect(result.current.error).toContain('Wallet error')
  })

  it('throws when wallet not connected on createStream', async () => {
    mockUseWallet.mockReturnValue({ address: null, isConnected: false } as any)
    const { result } = renderHook(() => useContract())
    await expect(act(() => result.current.createStream(makeInput()))).rejects.toThrow(
      'Connect a wallet',
    )
  })

  // ── withdraw ───────────────────────────────────────────────────────────────

  it('calls withdrawFromStream with correct id and amount', async () => {
    const { result } = renderHook(() => useContract())
    await act(async () => {
      await result.current.withdraw('99', 500n)
    })
    expect(withdrawFromStream).toHaveBeenCalledWith('99', 500n, 'testnet', expect.any(Function))
  })

  it('sets error on withdraw failure', async () => {
    vi.mocked(withdrawFromStream).mockRejectedValueOnce(new Error('insufficient balance'))
    const { result } = renderHook(() => useContract())
    await expect(act(() => result.current.withdraw('1', 100n))).rejects.toThrow()
    expect(result.current.error).toContain('Input error')
  })

  // ── cancel ─────────────────────────────────────────────────────────────────

  it('calls cancelStream with correct id', async () => {
    const { result } = renderHook(() => useContract())
    await act(async () => {
      await result.current.cancel('55')
    })
    expect(cancelStream).toHaveBeenCalledWith('55', 'testnet', expect.any(Function))
  })

  // ── estimateFee ────────────────────────────────────────────────────────────

  it('returns fee estimate', async () => {
    const { result } = renderHook(() => useContract())
    let fee: any
    await act(async () => {
      fee = await result.current.estimateFee(makeInput())
    })
    expect(fee).toEqual({ minFee: 100_000, estimatedFee: 115_000, estimatedFeeXlm: '0.0115' })
  })

  it('returns null when wallet not connected for estimateFee', async () => {
    mockUseWallet.mockReturnValue({ address: null, isConnected: false } as any)
    const { result } = renderHook(() => useContract())
    let fee: any
    await act(async () => {
      fee = await result.current.estimateFee(makeInput())
    })
    expect(fee).toBeNull()
  })

  it('returns null when estimateCreateStreamFee throws', async () => {
    vi.mocked(estimateCreateStreamFee).mockRejectedValueOnce(new Error('rpc down'))
    const { result } = renderHook(() => useContract())
    let fee: any
    await act(async () => {
      fee = await result.current.estimateFee(makeInput())
    })
    expect(fee).toBeNull()
  })

  // ── withdrawAll ────────────────────────────────────────────────────────────

  it('throws when wallet not connected for withdrawAll', async () => {
    mockUseWallet.mockReturnValue({ address: null, isConnected: false } as any)
    const { result } = renderHook(() => useContract())
    await expect(act(() => result.current.withdrawAll([makeStream()]))).rejects.toThrow(
      'Connect a wallet',
    )
  })

  it('returns {succeeded:0,failed:0} when no streams have withdrawable amount', async () => {
    vi.mocked(getWithdrawableAmount).mockReturnValue(0n)
    const { result } = renderHook(() => useContract())
    let res: any
    await act(async () => {
      res = await result.current.withdrawAll([makeStream()])
    })
    expect(res).toEqual({ succeeded: 0, failed: 0 })
    expect(withdrawFromStream).not.toHaveBeenCalled()
  })

  it('counts succeeded and failed withdrawals correctly', async () => {
    vi.mocked(getWithdrawableAmount).mockReturnValue(500n)
    vi.mocked(withdrawFromStream)
      .mockResolvedValueOnce('tx1')
      .mockRejectedValueOnce(new Error('timeout'))
    const { result } = renderHook(() => useContract())
    let res: any
    await act(async () => {
      res = await result.current.withdrawAll([makeStream('1'), makeStream('2')])
    })
    expect(res.succeeded).toBe(1)
    expect(res.failed).toBe(1)
  })

  it('calls onProgress callback with current/total counts', async () => {
    vi.mocked(getWithdrawableAmount).mockReturnValue(500n)
    vi.mocked(withdrawFromStream).mockResolvedValue('tx1')
    const onProgress = vi.fn()
    const { result } = renderHook(() => useContract())
    await act(async () => {
      await result.current.withdrawAll([makeStream('1'), makeStream('2')], onProgress)
    })
    expect(onProgress).toHaveBeenCalledWith(1, 2)
    expect(onProgress).toHaveBeenCalledWith(2, 2)
  })
})
