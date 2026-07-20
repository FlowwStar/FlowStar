import { describe, it, expect } from 'vitest'
import {
  getUnlockedAmount,
  getWithdrawableAmount,
  getLockedAmount,
  getStreamStatus,
  getStreamProgress,
  formatTokenAmount,
  parseTokenAmount,
  formatRate,
  shortenAddress,
  formatTimeRemaining,
} from '@/lib/stream-utils'
import type { StreamData } from '@/types/stream'

const TOKEN = { address: 'T', symbol: 'USDC', decimals: 7 }

function makeStream(overrides?: Partial<StreamData>): StreamData {
  return {
    id: '1',
    sender: 'GSEND',
    recipient: 'GRCPT',
    token: TOKEN,
    depositedAmount: 1_000_000_000n, // 100 USDC at 7 decimals
    withdrawnAmount: 0n,
    startTime: 1000n,
    endTime: 2000n,
    cliffTime: 1000n,
    cliffAmount: 0n,
    amountPerSecond: 1_000_000n, // 0.1 USDC/s
    linearAmount: 1_000_000_000n,
    duration: 1000n,
    cancelled: false,
    ...overrides,
  }
}

describe('getUnlockedAmount', () => {
  it('returns 0 before cliff', () => {
    const s = makeStream({ cliffTime: 1500n })
    expect(getUnlockedAmount(s, 1200)).toBe(0n)
  })

  it('returns linear unlock after cliff', () => {
    const s = makeStream()
    // elapsed = 1100 - 1000 = 100s, rate = 1_000_000/s → 100_000_000
    expect(getUnlockedAmount(s, 1100)).toBe(100_000_000n)
  })

  it('returns depositedAmount at or after endTime', () => {
    const s = makeStream()
    expect(getUnlockedAmount(s, 2000)).toBe(s.depositedAmount)
    expect(getUnlockedAmount(s, 9999)).toBe(s.depositedAmount)
  })

  it('includes cliffAmount', () => {
    const s = makeStream({ cliffAmount: 50_000_000n, cliffTime: 1000n })
    // at startTime (cliff passes): cliffAmount + 0 elapsed
    expect(getUnlockedAmount(s, 1000)).toBe(50_000_000n)
  })

  it('never exceeds depositedAmount', () => {
    const s = makeStream({ linearAmount: 999_999_999_000n })
    expect(getUnlockedAmount(s, 1100)).toBe(s.depositedAmount)
  })
})

describe('getWithdrawableAmount', () => {
  it('subtracts withdrawnAmount', () => {
    const s = makeStream({ withdrawnAmount: 50_000_000n })
    expect(getWithdrawableAmount(s, 1050)).toBe(0n)
  })

  it('returns 0 if withdrawnAmount >= unlocked', () => {
    const s = makeStream({ withdrawnAmount: 200_000_000n })
    expect(getWithdrawableAmount(s, 1050)).toBe(0n)
  })
})

describe('getLockedAmount', () => {
  it('is deposited minus unlocked', () => {
    const s = makeStream()
    const locked = getLockedAmount(s, 1100)
    expect(locked).toBe(s.depositedAmount - 100_000_000n)
  })
})

describe('getStreamStatus', () => {
  it('returns cancelled for cancelled stream', () => {
    expect(getStreamStatus(makeStream({ cancelled: true }), 1500)).toBe('cancelled')
  })

  it('returns scheduled before startTime', () => {
    expect(getStreamStatus(makeStream(), 500)).toBe('scheduled')
  })

  it('returns streaming between start and end', () => {
    expect(getStreamStatus(makeStream(), 1500)).toBe('streaming')
  })

  it('returns completed after endTime', () => {
    expect(getStreamStatus(makeStream(), 3000)).toBe('completed')
  })
})

describe('getStreamProgress', () => {
  it('returns 0 before start', () => {
    expect(getStreamProgress(makeStream(), 500)).toBe(0)
  })

  it('returns 0.5 at halfway', () => {
    expect(getStreamProgress(makeStream(), 1500)).toBeCloseTo(0.5)
  })

  it('returns 1 at end', () => {
    expect(getStreamProgress(makeStream(), 2000)).toBe(1)
  })

  it('returns 0 for zero depositedAmount', () => {
    expect(getStreamProgress(makeStream({ depositedAmount: 0n }))).toBe(0)
  })
})

describe('formatTokenAmount', () => {
  it('formats 1 USDC (7 decimals)', () => {
    expect(formatTokenAmount(10_000_000n, 7)).toBe('1')
  })

  it('formats fractional amounts', () => {
    expect(formatTokenAmount(15_000_000n, 7)).toBe('1.5')
  })

  it('handles zero', () => {
    expect(formatTokenAmount(0n, 7)).toBe('0')
  })

  it('handles negative', () => {
    expect(formatTokenAmount(-10_000_000n, 7)).toBe('-1')
  })

  it('respects maxFractionDigits', () => {
    expect(formatTokenAmount(10_123_456n, 7, 2)).toBe('1.01')
  })
})

describe('parseTokenAmount', () => {
  it('parses "1" to smallest unit', () => {
    expect(parseTokenAmount('1', 7)).toBe(10_000_000n)
  })

  it('parses "1.5"', () => {
    expect(parseTokenAmount('1.5', 7)).toBe(15_000_000n)
  })

  it('returns 0 for empty string', () => {
    expect(parseTokenAmount('', 7)).toBe(0n)
  })

  it('strips commas', () => {
    expect(parseTokenAmount('1,000', 7)).toBe(10_000_000_000n)
  })
})

describe('formatRate', () => {
  it('returns best rate with unit', () => {
    // 0.1 USDC/s = 6/min → picks /min (first unit >= 0.01)
    const r = formatRate(1_000_000n, 7, 'USDC')
    expect(r.best).toContain('USDC')
    expect(r.bestUnit).toBe('/min')
  })

  it('picks the first unit where value >= 0.01', () => {
    // 1 stroop/s = 0.0000001 USDC/s = 0.26/mo → picks /mo
    const r = formatRate(1n, 7, 'USDC')
    expect(r.bestUnit).toBe('/mo')
  })

  it('contains all unit fields', () => {
    const r = formatRate(1_000_000n, 7, 'USDC')
    expect(r.perSecond).toBeTruthy()
    expect(r.perHour).toBeTruthy()
    expect(r.perYear).toBeTruthy()
  })
})

describe('shortenAddress', () => {
  it('shortens a long address', () => {
    const addr = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ'
    expect(shortenAddress(addr, 4)).toContain('…')
  })

  it('returns short address unchanged', () => {
    expect(shortenAddress('GABC', 4)).toBe('GABC')
  })
})

describe('formatTimeRemaining', () => {
  it('returns "Ended" for past time', () => {
    expect(formatTimeRemaining(1000n, 2000)).toBe('Ended')
  })

  it('returns days/hours for long duration', () => {
    const result = formatTimeRemaining(BigInt(Math.floor(Date.now() / 1000) + 90061))
    expect(result).toMatch(/\d+d/)
  })
})
