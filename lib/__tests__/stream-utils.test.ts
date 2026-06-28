import { describe, it, expect } from 'vitest'
import {
  getUnlockedAmount,
  getWithdrawableAmount,
  getStreamProgress,
  formatTokenAmount,
  parseTokenAmount,
  formatTimeRemaining,
} from '../stream-utils'
import type { StreamData } from '../../types/stream'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOKEN = { address: 'CXLM', symbol: 'XLM', decimals: 7 }

function makeStream(overrides: Partial<StreamData> = {}): StreamData {
  return {
    id: '1',
    sender: 'GA',
    recipient: 'GB',
    token: TOKEN,
    depositedAmount: 1_000_0000000n, // 1000 XLM in stroops
    withdrawnAmount: 0n,
    startTime: 1000n,
    endTime: 2000n,
    cliffTime: 1000n,
    cliffAmount: 0n,
    amountPerSecond: 10_000_000n, // 1 XLM/s
    cancelled: false,
    ...overrides,
  }
}

// ─── getUnlockedAmount ────────────────────────────────────────────────────────

describe('getUnlockedAmount', () => {
  it('returns 0 before cliff', () => {
    const s = makeStream({ cliffTime: 1500n })
    expect(getUnlockedAmount(s, 1200)).toBe(0n)
  })

  it('returns 0 at exactly start when cliff is start', () => {
    const s = makeStream()
    expect(getUnlockedAmount(s, 1000)).toBe(0n)
  })

  it('returns partial amount mid-stream', () => {
    const s = makeStream()
    // elapsed = 1100 - 1000 = 100s × 10_000_000 stroops/s = 1_000_000_000
    expect(getUnlockedAmount(s, 1100)).toBe(1_000_000_000n)
  })

  it('returns full depositedAmount at end', () => {
    const s = makeStream()
    expect(getUnlockedAmount(s, 2000)).toBe(s.depositedAmount)
  })

  it('caps at depositedAmount after end', () => {
    const s = makeStream()
    expect(getUnlockedAmount(s, 9999)).toBe(s.depositedAmount)
  })

  it('includes cliffAmount at cliff', () => {
    const s = makeStream({ cliffAmount: 100_000_000n, cliffTime: 1200n, startTime: 1000n })
    // At exactly cliffTime: elapsed = 1200 - 1000 = 200s; linear = 200 * 10_000_000 = 2_000_000_000
    // unlocked = 100_000_000 + 2_000_000_000 = 2_100_000_000
    expect(getUnlockedAmount(s, 1200)).toBe(2_100_000_000n)
  })
})

// ─── getWithdrawableAmount ────────────────────────────────────────────────────

describe('getWithdrawableAmount', () => {
  it('returns 0 before cliff', () => {
    const s = makeStream({ cliffTime: 1500n })
    expect(getWithdrawableAmount(s, 1200)).toBe(0n)
  })

  it('accounts for partial withdrawals', () => {
    const s = makeStream({ withdrawnAmount: 500_000_000n })
    // at t=1100, unlocked = 1_000_000_000; already withdrawn 500_000_000
    expect(getWithdrawableAmount(s, 1100)).toBe(500_000_000n)
  })

  it('returns 0 for cancelled stream with fully withdrawn amounts', () => {
    const s = makeStream({
      cancelled: true,
      withdrawnAmount: 1_000_0000000n,
    })
    expect(getWithdrawableAmount(s, 1100)).toBe(0n)
  })

  it('never returns negative', () => {
    const s = makeStream({ withdrawnAmount: 9_999_999_999n })
    const result = getWithdrawableAmount(s, 1001)
    expect(result).toBeGreaterThanOrEqual(0n)
  })
})

// ─── getStreamProgress ────────────────────────────────────────────────────────

describe('getStreamProgress', () => {
  it('returns 0 for zero deposit', () => {
    const s = makeStream({ depositedAmount: 0n })
    expect(getStreamProgress(s, 1100)).toBe(0)
  })

  it('returns 0 before cliff', () => {
    const s = makeStream({ cliffTime: 1500n })
    expect(getStreamProgress(s, 1200)).toBe(0)
  })

  it('returns 0.5 at midpoint', () => {
    const s = makeStream()
    // at t=1500: elapsed=500s, unlocked=5_000_000_000 / deposited=10_000_000_000 = 0.5
    expect(getStreamProgress(s, 1500)).toBeCloseTo(0.5, 4)
  })

  it('returns 1 at end', () => {
    expect(getStreamProgress(makeStream(), 2000)).toBe(1)
  })
})

// ─── formatTokenAmount ────────────────────────────────────────────────────────

describe('formatTokenAmount', () => {
  it('formats zero', () => {
    expect(formatTokenAmount(0n, 7)).toBe('0')
  })

  it('formats 1 XLM (7 decimals)', () => {
    expect(formatTokenAmount(10_000_000n, 7)).toBe('1')
  })

  it('formats fractional amount', () => {
    expect(formatTokenAmount(15_000_000n, 7)).toBe('1.5')
  })

  it('trims trailing zeros', () => {
    expect(formatTokenAmount(10_500_000n, 7)).toBe('1.05')
  })

  it('handles large numbers', () => {
    expect(formatTokenAmount(1_000_000_0000000n, 7)).toBe('1,000,000')
  })

  it('handles negative amounts', () => {
    expect(formatTokenAmount(-10_000_000n, 7)).toBe('-1')
  })

  it('respects maxFractionDigits=0', () => {
    expect(formatTokenAmount(15_000_000n, 7, 0)).toBe('1')
  })

  it('handles 0 decimals token', () => {
    expect(formatTokenAmount(42n, 0)).toBe('42')
  })
})

// ─── parseTokenAmount ─────────────────────────────────────────────────────────

describe('parseTokenAmount', () => {
  it('parses integer string', () => {
    expect(parseTokenAmount('100', 7)).toBe(1_000_000_000n)
  })

  it('parses decimal string', () => {
    expect(parseTokenAmount('1.5', 7)).toBe(15_000_000n)
  })

  it('strips commas', () => {
    expect(parseTokenAmount('1,000', 7)).toBe(10_000_000_000n)
  })

  it('returns 0 for empty string', () => {
    expect(parseTokenAmount('', 7)).toBe(0n)
  })

  it('truncates extra decimals', () => {
    expect(parseTokenAmount('1.12345678', 7)).toBe(11_234_567n)
  })

  it('handles 0 decimals', () => {
    expect(parseTokenAmount('42', 0)).toBe(42n)
  })
})

// ─── formatTimeRemaining ──────────────────────────────────────────────────────

describe('formatTimeRemaining', () => {
  it('returns "Ended" for past timestamp', () => {
    expect(formatTimeRemaining(BigInt(1000), 2000)).toBe('Ended')
  })

  it('returns "Ended" for equal timestamp', () => {
    expect(formatTimeRemaining(BigInt(1000), 1000)).toBe('Ended')
  })

  it('shows seconds for sub-minute durations', () => {
    const result = formatTimeRemaining(BigInt(1045), 1000)
    expect(result).toContain('45s')
  })

  it('shows minutes for sub-hour durations', () => {
    const result = formatTimeRemaining(BigInt(1000 + 90), 1000)
    expect(result).toContain('1m')
  })

  it('shows days for multi-day durations', () => {
    const result = formatTimeRemaining(BigInt(1000 + 2 * 86400), 1000)
    expect(result).toContain('2d')
  })

  it('does not show seconds when days are present', () => {
    const result = formatTimeRemaining(BigInt(1000 + 2 * 86400 + 30), 1000)
    expect(result).not.toContain('s')
  })
})
