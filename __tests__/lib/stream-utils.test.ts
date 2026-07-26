import { describe, it, expect } from 'vitest'
import {
  getUnlockedAmount,
  getWithdrawableAmount,
  getLockedAmount,
  getStreamStatus,
  getStreamProgress,
  formatTokenAmount,
  formatCompactAmount,
  parseTokenAmount,
  formatRate,
  shortenAddress,
  formatTimeRemaining,
  formatDateTime,
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

// ---------------------------------------------------------------------------
// formatCompactAmount
// ---------------------------------------------------------------------------

/**
 * Normalise a compact-notation string so that assertions work regardless of
 * whether the runtime uses a regular space, thin space (\u2009), or narrow
 * no-break space (\u202f) between the number and the suffix.  Intl output is
 * implementation-dependent; stripping all whitespace makes comparisons stable.
 */
function normalizeCompact(s: string): string {
  // Remove every kind of whitespace/separator that Intl may inject
  return s.replace(/[\s\u00a0\u2009\u202f]/g, '')
}

describe('formatCompactAmount', () => {
  // 1 token at 7 decimals = 10_000_000n raw units
  const D = 7

  it('formats zero as "0"', () => {
    expect(normalizeCompact(formatCompactAmount(0n, D))).toBe('0')
  })

  it('formats values under 1 000 with no K/M suffix', () => {
    // 999 tokens
    expect(normalizeCompact(formatCompactAmount(9_990_000_000n, D))).toBe('999')
  })

  it('formats exactly 1 000 tokens as "1K"', () => {
    expect(normalizeCompact(formatCompactAmount(10_000_000_000n, D))).toBe('1K')
  })

  it('formats 1 200 tokens as "1.2K"', () => {
    expect(normalizeCompact(formatCompactAmount(12_000_000_000n, D))).toBe('1.2K')
  })

  it('formats 999 900 tokens as "999.9K"', () => {
    expect(normalizeCompact(formatCompactAmount(9_999_000_000_000n, D))).toBe('999.9K')
  })

  it('formats exactly 1 000 000 tokens as "1M"', () => {
    expect(normalizeCompact(formatCompactAmount(10_000_000_000_000n, D))).toBe('1M')
  })

  it('formats 3 400 000 tokens as "3.4M"', () => {
    expect(normalizeCompact(formatCompactAmount(34_000_000_000_000n, D))).toBe('3.4M')
  })

  it('rounds to 1 decimal place — rounds up', () => {
    // 1 250 tokens → 1.3K
    expect(normalizeCompact(formatCompactAmount(12_500_000_000n, D))).toBe('1.3K')
  })

  it('rounds to 1 decimal place — rounds down', () => {
    // 1 240 tokens → 1.2K
    expect(normalizeCompact(formatCompactAmount(12_400_000_000n, D))).toBe('1.2K')
  })

  it('handles negative values', () => {
    // -1 000 tokens → "-1K"
    expect(normalizeCompact(formatCompactAmount(-10_000_000_000n, D))).toBe('-1K')
  })

  it('works with 2-decimal precision', () => {
    // 100 tokens at 2 decimals = 10 000 raw
    expect(normalizeCompact(formatCompactAmount(10_000n, 2))).toBe('100')
    // 1 000 tokens at 2 decimals = 100 000 raw
    expect(normalizeCompact(formatCompactAmount(100_000n, 2))).toBe('1K')
  })

  it('boundary: value just below 1 000 000 is either "999.9K" or "1M" (Intl rounding)', () => {
    // 999 999.9 tokens — Intl may round up to 1M
    const result = normalizeCompact(formatCompactAmount(9_999_999_000_000n, D))
    expect(['999.9K', '1000K', '1M']).toContain(result)
  })
})

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

/**
 * toLocaleString('en-US', ...) output is stable across Node/jsdom when the
 * locale is explicitly pinned, but punctuation details (comma after year,
 * narrow-no-break space before AM/PM) can vary by ICU version.  We use
 * targeted regex patterns against individual parts rather than full-string
 * equality to stay robust.
 */
describe('formatDateTime', () => {
  it('accepts a plain number timestamp and returns a non-empty string', () => {
    const result = formatDateTime(1705323900)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('accepts a bigint timestamp and produces the same output as the number equivalent', () => {
    expect(formatDateTime(1705323900n)).toBe(formatDateTime(1705323900))
  })

  it('formats epoch 0 — contains Jan, 1, and 1970', () => {
    const result = formatDateTime(0)
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/1/)
    expect(result).toMatch(/1970/)
  })

  it('formats epoch 0 as bigint without throwing', () => {
    expect(() => formatDateTime(0n)).not.toThrow()
    const result = formatDateTime(0n)
    expect(result).toMatch(/1970/)
  })

  it('formats a known mid-range timestamp — Jan 15, 2024', () => {
    // 1 705 323 900 = 2024-01-15 (UTC)
    const result = formatDateTime(1705323900)
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/15/)
    expect(result).toMatch(/2024/)
  })

  it('formats a far-future timestamp (year 2100)', () => {
    // 4 107 542 400 = 2100-03-14 00:00:00 UTC
    const result = formatDateTime(4107542400)
    expect(result).toMatch(/2100/)
    expect(result).toMatch(/Mar/)
  })

  it('includes an AM or PM marker (12-hour format)', () => {
    const result = formatDateTime(1705323900)
    expect(result).toMatch(/AM|PM/)
  })

  it('includes 2-digit minutes', () => {
    // Any valid output must contain ":<two digits>" before AM/PM
    const result = formatDateTime(1705323900)
    expect(result).toMatch(/:\d{2}/)
  })

  it('contains a short month abbreviation (3 letters)', () => {
    const result = formatDateTime(1685608200) // 2023-06-01
    expect(result).toMatch(/\b[A-Z][a-z]{2}\b/)
  })

  it('contains the 4-digit year', () => {
    const result = formatDateTime(1685608200)
    expect(result).toMatch(/2023/)
  })

  it('output is consistent — same input always produces same output', () => {
    const ts = 1700000000
    expect(formatDateTime(ts)).toBe(formatDateTime(ts))
  })
})
