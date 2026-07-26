import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildNextRunAt,
  createRenewalPreset,
  getRecurringRules,
  getUpcomingRenewals,
  removeRecurringRule,
  saveRecurringRule,
  type RecurringRule,
} from '@/lib/recurring'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    cadence: 'monthly',
    nextRunAt: Date.now() + 1000,
    lastCreatedAt: Date.now(),
    streamId: 'stream-1',
    recipient: 'GRECIPIENT',
    tokenSymbol: 'USDC',
    amount: '1000',
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

// ─── buildNextRunAt ───────────────────────────────────────────────────────────

describe('buildNextRunAt', () => {
  it('adds exactly 7 days for weekly cadence', () => {
    const start = new Date('2026-01-10T12:00:00Z').getTime()
    const next = buildNextRunAt(start, 'weekly')
    expect(next - start).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('adds a real calendar month for monthly cadence', () => {
    const start = new Date('2026-01-15T00:00:00').getTime()
    const next = new Date(buildNextRunAt(start, 'monthly'))
    expect(next.getMonth()).toBe(1) // February
    expect(next.getDate()).toBe(15)
  })

  it('adds a real calendar quarter (3 months) for quarterly cadence', () => {
    const start = new Date('2026-01-15T00:00:00').getTime()
    const next = new Date(buildNextRunAt(start, 'quarterly'))
    expect(next.getMonth()).toBe(3) // April
    expect(next.getDate()).toBe(15)
  })

  it('does not drift to a fixed 30 days for monthly cadence', () => {
    // Jan has 31 days; a fixed +30d would land on Feb 10 instead of Feb 15.
    const start = new Date('2026-01-15T00:00:00').getTime()
    const next = buildNextRunAt(start, 'monthly')
    const thirtyDaysLater = start + 30 * 24 * 60 * 60 * 1000
    expect(next).not.toBe(thirtyDaysLater)
  })

  it('clamps Jan 31 + 1 month to the last day of February (non-leap year)', () => {
    const start = new Date('2025-01-31T00:00:00').getTime()
    const next = new Date(buildNextRunAt(start, 'monthly'))
    expect(next.getMonth()).toBe(1) // February
    expect(next.getDate()).toBe(28) // 2025 is not a leap year
  })

  it('clamps Jan 31 + 1 month to Feb 29 on a leap year', () => {
    const start = new Date('2024-01-31T00:00:00').getTime()
    const next = new Date(buildNextRunAt(start, 'monthly'))
    expect(next.getMonth()).toBe(1) // February
    expect(next.getDate()).toBe(29) // 2024 is a leap year
  })

  it('clamps Nov 30 + 1 quarter to Feb 28/29 when landing in February', () => {
    const start = new Date('2025-11-30T00:00:00').getTime()
    const next = new Date(buildNextRunAt(start, 'quarterly'))
    expect(next.getMonth()).toBe(1) // February
    expect(next.getDate()).toBe(28)
  })

  it('preserves time-of-day across the month rollover', () => {
    const start = new Date('2026-03-15T09:30:00').getTime()
    const next = new Date(buildNextRunAt(start, 'monthly'))
    expect(next.getHours()).toBe(9)
    expect(next.getMinutes()).toBe(30)
  })
})

// ─── saveRecurringRule / getRecurringRules / removeRecurringRule ─────────────

describe('saveRecurringRule / getRecurringRules', () => {
  it('persists a rule and returns it from getRecurringRules', () => {
    saveRecurringRule(makeRule({ streamId: 'a' }))
    const rules = getRecurringRules()
    expect(rules).toHaveLength(1)
    expect(rules[0].streamId).toBe('a')
  })

  it('returns an empty array when nothing is stored', () => {
    expect(getRecurringRules()).toEqual([])
  })

  it('replaces an existing rule for the same streamId instead of duplicating', () => {
    saveRecurringRule(makeRule({ streamId: 'a', amount: '100' }))
    saveRecurringRule(makeRule({ streamId: 'a', amount: '200' }))
    const rules = getRecurringRules()
    expect(rules).toHaveLength(1)
    expect(rules[0].amount).toBe('200')
  })

  it('caps stored rules at 25 entries', () => {
    for (let i = 0; i < 30; i += 1) {
      saveRecurringRule(makeRule({ streamId: `stream-${i}` }))
    }
    expect(getRecurringRules()).toHaveLength(25)
  })

  it('returns [] when stored JSON is malformed', () => {
    window.localStorage.setItem('flowstar:recurring-streams', '{not valid json')
    expect(getRecurringRules()).toEqual([])
  })
})

describe('removeRecurringRule', () => {
  it('removes only the matching rule', () => {
    saveRecurringRule(makeRule({ streamId: 'a' }))
    saveRecurringRule(makeRule({ streamId: 'b' }))
    removeRecurringRule('a')
    const rules = getRecurringRules()
    expect(rules).toHaveLength(1)
    expect(rules[0].streamId).toBe('b')
  })
})

// ─── getUpcomingRenewals ──────────────────────────────────────────────────────

describe('getUpcomingRenewals', () => {
  it('excludes rules whose nextRunAt is in the past', () => {
    saveRecurringRule(makeRule({ streamId: 'past', nextRunAt: Date.now() - 1000 }))
    saveRecurringRule(makeRule({ streamId: 'future', nextRunAt: Date.now() + 1000 }))
    const upcoming = getUpcomingRenewals()
    expect(upcoming.map((r) => r.streamId)).toEqual(['future'])
  })

  it('sorts remaining rules by nextRunAt ascending', () => {
    saveRecurringRule(makeRule({ streamId: 'later', nextRunAt: Date.now() + 5000 }))
    saveRecurringRule(makeRule({ streamId: 'sooner', nextRunAt: Date.now() + 1000 }))
    const upcoming = getUpcomingRenewals()
    expect(upcoming.map((r) => r.streamId)).toEqual(['sooner', 'later'])
  })
})

// ─── createRenewalPreset ──────────────────────────────────────────────────────

describe('createRenewalPreset', () => {
  it('builds and persists a preset from a stream', () => {
    const stream = {
      id: 'stream-9',
      recipient: 'GRECIPIENT9',
      token: { symbol: 'XLM' },
      depositedAmount: 500n,
    }
    const preset = createRenewalPreset(stream, 'weekly')
    expect(preset.streamId).toBe('stream-9')
    expect(preset.recipient).toBe('GRECIPIENT9')
    expect(preset.tokenSymbol).toBe('XLM')
    expect(preset.amount).toBe('500')
    expect(preset.cadence).toBe('weekly')

    const stored = getRecurringRules()
    expect(stored).toHaveLength(1)
    expect(stored[0].streamId).toBe('stream-9')
  })

  it('sets nextRunAt in the future relative to lastCreatedAt', () => {
    const stream = {
      id: 'stream-10',
      recipient: 'GRECIPIENT10',
      token: { symbol: 'XLM' },
      depositedAmount: 1n,
    }
    const preset = createRenewalPreset(stream, 'monthly')
    expect(preset.nextRunAt).toBeGreaterThan(preset.lastCreatedAt)
  })
})
