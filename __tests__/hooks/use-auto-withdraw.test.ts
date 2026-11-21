import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/contract', () => ({
  withdrawFromStream: vi.fn(),
}))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: vi.fn(() => ({ network: 'testnet' })),
}))

// Mock stream-utils — keep original getWithdrawableAmount
vi.mock('@/lib/stream-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stream-utils')>()
  return { ...actual, getWithdrawableAmount: vi.fn(() => 500n) }
})

import { withdrawFromStream } from '@/lib/contract'
import { getWithdrawableAmount } from '@/lib/stream-utils'
import { useAutoWithdraw } from '@/hooks/use-auto-withdraw'
import type { StreamData } from '@/types/stream'

// ── Fixtures ────────────────────────────────────────────────────────────────

const TOKEN = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }

function makeStream(overrides: Partial<StreamData> = {}): StreamData {
  return {
    id: 'stream-1',
    sender: 'GSENDER',
    recipient: 'GRECIPIENT',
    token: TOKEN,
    depositedAmount: 10_000n,
    withdrawnAmount: 0n,
    startTime: 0n,
    endTime: 9_999_999n,
    cliffTime: 0n,
    cliffAmount: 0n,
    amountPerSecond: 1n,
    linearAmount: 10_000n,
    duration: 9_999_999n,
    cancelled: false,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useAutoWithdraw', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    localStorage.clear()
    vi.mocked(withdrawFromStream).mockResolvedValue('tx-hash-123')
    vi.mocked(getWithdrawableAmount).mockReturnValue(500n)
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  // ── initial state ──────────────────────────────────────────────────────────

  it('starts with disabled auto-withdraw and default settings', () => {
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))
    expect(result.current.settings.enabled).toBe(false)
    expect(result.current.settings.strategy).toBe('time-based')
    expect(result.current.settings.intervalHours).toBe(24)
  })

  it('starts with empty withdrawal history', () => {
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))
    expect(result.current.withdrawalHistory).toHaveLength(0)
  })

  it('handles null stream gracefully', () => {
    const { result } = renderHook(() => useAutoWithdraw(null))
    expect(result.current.settings.enabled).toBe(false)
  })

  // ── updateSettings ─────────────────────────────────────────────────────────

  it('updates settings and persists to localStorage', () => {
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))
    act(() => {
      result.current.updateSettings({ enabled: true, intervalHours: 12 })
    })
    expect(result.current.settings.enabled).toBe(true)
    expect(result.current.settings.intervalHours).toBe(12)

    const stored = JSON.parse(localStorage.getItem('flowstar:auto-withdraw:stream-1')!)
    expect(stored.enabled).toBe(true)
    expect(stored.intervalHours).toBe(12)
  })

  it('does nothing when stream is null', () => {
    const { result } = renderHook(() => useAutoWithdraw(null))
    act(() => {
      result.current.updateSettings({ enabled: true })
    })
    expect(result.current.settings.enabled).toBe(false)
  })

  // ── localStorage persistence ───────────────────────────────────────────────

  it('loads persisted settings from localStorage on mount', () => {
    localStorage.setItem(
      'flowstar:auto-withdraw:stream-1',
      JSON.stringify({ enabled: true, intervalHours: 6 }),
    )
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))
    expect(result.current.settings.enabled).toBe(true)
    expect(result.current.settings.intervalHours).toBe(6)
  })

  it('falls back to defaults when localStorage has invalid JSON', () => {
    localStorage.setItem('flowstar:auto-withdraw:stream-1', 'not-json}}}')
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))
    expect(result.current.settings.enabled).toBe(false)
  })

  // ── addWithdrawalHistory ───────────────────────────────────────────────────

  it('prepends new entry to withdrawal history', () => {
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))
    act(() => {
      result.current.addWithdrawalHistory({ timestamp: 1000, amount: '500', txHash: 'tx1' })
    })
    expect(result.current.withdrawalHistory).toHaveLength(1)
    expect(result.current.withdrawalHistory[0].txHash).toBe('tx1')
  })

  it('caps withdrawal history at 100 entries', () => {
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))
    act(() => {
      for (let i = 0; i < 105; i++) {
        result.current.addWithdrawalHistory({ timestamp: i, amount: '1' })
      }
    })
    expect(result.current.withdrawalHistory.length).toBeLessThanOrEqual(100)
  })

  // ── auto-withdraw interval ─────────────────────────────────────────────────

  it('does not call withdrawFromStream when disabled', async () => {
    renderHook(() => useAutoWithdraw(makeStream()))
    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 60 * 1000) // 25 hours
    })
    expect(withdrawFromStream).not.toHaveBeenCalled()
  })

  it('calls withdrawFromStream after interval when enabled', async () => {
    vi.mocked(withdrawFromStream).mockResolvedValue('tx-abc')
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))

    act(() => {
      result.current.updateSettings({ enabled: true, intervalHours: 1 })
    })

    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000 + 100) // 1 hour + buffer
      await Promise.resolve() // flush microtasks
    })

    expect(withdrawFromStream).toHaveBeenCalledWith('stream-1', 500n, 'testnet')
  })

  it('records successful withdrawal in history', async () => {
    vi.mocked(withdrawFromStream).mockResolvedValue('tx-success')
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))

    act(() => {
      result.current.updateSettings({ enabled: true, intervalHours: 1 })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 100)
    })

    expect(result.current.withdrawalHistory.length).toBeGreaterThan(0)
    expect(result.current.withdrawalHistory[0].txHash).toBe('tx-success')
  })

  it('records error in history on withdrawal failure', async () => {
    vi.mocked(withdrawFromStream).mockRejectedValue(new Error('network timeout'))
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))

    act(() => {
      result.current.updateSettings({ enabled: true, intervalHours: 1 })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 100)
    })

    expect(result.current.withdrawalHistory.length).toBeGreaterThan(0)
    expect(result.current.withdrawalHistory[0].error).toContain('network timeout')
  })

  it('skips withdrawal when stream is cancelled', async () => {
    renderHook(() => useAutoWithdraw(makeStream({ cancelled: true })))
    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 60 * 1000)
    })
    expect(withdrawFromStream).not.toHaveBeenCalled()
  })

  it('skips withdrawal when withdrawable amount is 0', async () => {
    vi.mocked(getWithdrawableAmount).mockReturnValue(0n)
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))
    act(() => {
      result.current.updateSettings({ enabled: true, intervalHours: 1 })
    })
    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000 + 100)
      await Promise.resolve()
    })
    expect(withdrawFromStream).not.toHaveBeenCalled()
  })

  // ── calculateWithdrawAmount strategies ────────────────────────────────────

  it('threshold-based: skips withdrawal when below threshold', async () => {
    // withdrawable (500n) < threshold (5000n = 50% of 10000n deposited)
    vi.mocked(getWithdrawableAmount).mockReturnValue(500n)
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))

    act(() => {
      result.current.updateSettings({
        enabled: true,
        intervalHours: 1,
        strategy: 'threshold-based',
        thresholdPercentage: 50,
      })
    })

    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000 + 100)
      await Promise.resolve()
    })

    expect(withdrawFromStream).not.toHaveBeenCalled()
  })

  it('min-amount: skips withdrawal when below minAmountRaw', async () => {
    vi.mocked(getWithdrawableAmount).mockReturnValue(100n)
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))

    act(() => {
      result.current.updateSettings({
        enabled: true,
        intervalHours: 1,
        minAmountRaw: '500', // require 500 minimum
      })
    })

    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000 + 100)
      await Promise.resolve()
    })

    expect(withdrawFromStream).not.toHaveBeenCalled()
  })

  it('maxSafetyLimit caps the withdrawal amount', async () => {
    vi.mocked(getWithdrawableAmount).mockReturnValue(1000n)
    vi.mocked(withdrawFromStream).mockResolvedValue('tx-capped')
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))

    act(() => {
      result.current.updateSettings({
        enabled: true,
        intervalHours: 1,
        maxSafetyLimitRaw: '200', // cap at 200
      })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 100)
    })

    expect(withdrawFromStream).toHaveBeenCalledWith('stream-1', 200n, 'testnet')
  })

  // ── gas-optimized strategy ─────────────────────────────────────────────────

  it('gas-optimized: skips withdrawal when last withdrawal was less than 1 day ago', async () => {
    vi.mocked(getWithdrawableAmount).mockReturnValue(500n)
    const recentTimestamp = Date.now() - 12 * 60 * 60 * 1000 // 12 hours ago
    localStorage.setItem(
      'flowstar:auto-withdraw:stream-1',
      JSON.stringify({
        enabled: true,
        strategy: 'gas-optimized',
        intervalHours: 1,
        withdrawalHistory: [{ timestamp: recentTimestamp, amount: '100', txHash: 'tx-old' }],
      }),
    )
    renderHook(() => useAutoWithdraw(makeStream()))

    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000 + 100)
      await Promise.resolve()
    })

    expect(withdrawFromStream).not.toHaveBeenCalled()
  })

  it('gas-optimized: executes withdrawal when last withdrawal was more than 1 day ago', async () => {
    vi.mocked(getWithdrawableAmount).mockReturnValue(500n)
    vi.mocked(withdrawFromStream).mockResolvedValue('tx-gas-opt')
    const oldTimestamp = Date.now() - 2 * 24 * 60 * 60 * 1000 // 2 days ago
    localStorage.setItem(
      'flowstar:auto-withdraw:stream-1',
      JSON.stringify({
        enabled: true,
        strategy: 'gas-optimized',
        intervalHours: 1,
        withdrawalHistory: [{ timestamp: oldTimestamp, amount: '100', txHash: 'tx-old' }],
      }),
    )
    renderHook(() => useAutoWithdraw(makeStream()))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 100)
    })

    expect(withdrawFromStream).toHaveBeenCalledWith('stream-1', 500n, 'testnet')
  })

  it('gas-optimized: executes withdrawal when there is no prior history (Infinity days since last)', async () => {
    vi.mocked(getWithdrawableAmount).mockReturnValue(500n)
    vi.mocked(withdrawFromStream).mockResolvedValue('tx-first')
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))

    act(() => {
      result.current.updateSettings({
        enabled: true,
        strategy: 'gas-optimized',
        intervalHours: 1,
      })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 100)
    })

    expect(withdrawFromStream).toHaveBeenCalledWith('stream-1', 500n, 'testnet')
  })

  // ── max strategy ───────────────────────────────────────────────────────────

  it('max: withdraws the full withdrawable amount', async () => {
    vi.mocked(getWithdrawableAmount).mockReturnValue(9000n)
    vi.mocked(withdrawFromStream).mockResolvedValue('tx-max')
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))

    act(() => {
      result.current.updateSettings({
        enabled: true,
        strategy: 'max',
        intervalHours: 1,
      })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 100)
    })

    expect(withdrawFromStream).toHaveBeenCalledWith('stream-1', 9000n, 'testnet')
  })

  // ── time-based strategy (default) ─────────────────────────────────────────

  it('time-based: withdraws the full withdrawable amount on schedule', async () => {
    vi.mocked(getWithdrawableAmount).mockReturnValue(750n)
    vi.mocked(withdrawFromStream).mockResolvedValue('tx-time')
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))

    act(() => {
      result.current.updateSettings({
        enabled: true,
        strategy: 'time-based',
        intervalHours: 1,
      })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 100)
    })

    expect(withdrawFromStream).toHaveBeenCalledWith('stream-1', 750n, 'testnet')
  })

  // ── threshold-based: at or above threshold ─────────────────────────────────

  it('threshold-based: executes withdrawal when above threshold', async () => {
    // withdrawable (6000n) >= threshold (5000n = 50% of 10000n deposited)
    vi.mocked(getWithdrawableAmount).mockReturnValue(6000n)
    vi.mocked(withdrawFromStream).mockResolvedValue('tx-threshold')
    const { result } = renderHook(() => useAutoWithdraw(makeStream()))

    act(() => {
      result.current.updateSettings({
        enabled: true,
        intervalHours: 1,
        strategy: 'threshold-based',
        thresholdPercentage: 50,
      })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 100)
    })

    expect(withdrawFromStream).toHaveBeenCalledWith('stream-1', 6000n, 'testnet')
  })
})
