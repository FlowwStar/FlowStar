/**
 * Tests for components/streams/upcoming-renewals-card.tsx (issue #1145).
 *
 * `getUpcomingRenewals` / `createRenewalPreset` already existed in
 * lib/recurring.ts, fully tested, but nothing in the UI rendered them. This
 * card is the first consumer, so these tests exercise it against the real
 * lib/recurring + lib/stellar implementations (via real localStorage),
 * mocking only the Next.js router and network context.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { saveRecurringRule, getRecurringRules, type RecurringRule } from '@/lib/recurring'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => ({ network: 'testnet' }),
}))

import { UpcomingRenewalsCard } from '@/components/streams/upcoming-renewals-card'

const RECIPIENT = 'GRECIPIENT1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const USDC_ADDRESS = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    cadence: 'monthly',
    nextRunAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    lastCreatedAt: Date.now(),
    streamId: 'stream-1',
    recipient: RECIPIENT,
    tokenSymbol: 'USDC',
    amount: '10000000', // 1 USDC at 7 decimals
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  mockPush.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('UpcomingRenewalsCard', () => {
  it('renders nothing when there are no upcoming renewals', () => {
    render(<UpcomingRenewalsCard />)
    expect(screen.queryByTestId('upcoming-renewals-card')).not.toBeInTheDocument()
  })

  it('renders a row per upcoming renewal with amount, token symbol and cadence', () => {
    saveRecurringRule(makeRule())
    render(<UpcomingRenewalsCard />)

    expect(screen.getByTestId('upcoming-renewals-card')).toBeInTheDocument()
    const rows = screen.getAllByTestId('upcoming-renewal-row')
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText(/1 USDC/)).toBeInTheDocument()
    expect(within(rows[0]).getByText(/Monthly/)).toBeInTheDocument()
  })

  it('excludes overdue rules (nextRunAt already in the past)', () => {
    saveRecurringRule(makeRule({ streamId: 'past', nextRunAt: Date.now() - 1000 }))
    render(<UpcomingRenewalsCard />)
    expect(screen.queryByTestId('upcoming-renewals-card')).not.toBeInTheDocument()
  })

  it('"Create now" opens /app/create prefilled with recipient, resolved token address and a human-readable amount', async () => {
    const user = userEvent.setup()
    saveRecurringRule(makeRule())
    render(<UpcomingRenewalsCard />)

    await user.click(screen.getByRole('button', { name: 'Create now' }))

    expect(mockPush).toHaveBeenCalledTimes(1)
    const url = mockPush.mock.calls[0][0] as string
    expect(url).toMatch(/^\/app\/create\?/)

    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('recipient')).toBe(RECIPIENT)
    expect(params.get('token')).toBe(USDC_ADDRESS)
    expect(params.get('amount')).toBe('1')
  })

  it('"Create now" reschedules the rule forward from today instead of leaving it due "soon"', async () => {
    const user = userEvent.setup()
    const rule = makeRule({ nextRunAt: Date.now() + 1000 })
    saveRecurringRule(rule)
    render(<UpcomingRenewalsCard />)

    await user.click(screen.getByRole('button', { name: 'Create now' }))

    const stored = getRecurringRules()
    expect(stored).toHaveLength(1)
    expect(stored[0].streamId).toBe(rule.streamId)
    expect(stored[0].nextRunAt).toBeGreaterThan(rule.nextRunAt)
  })

  it('"Remove" deletes the rule and the row disappears', async () => {
    const user = userEvent.setup()
    saveRecurringRule(makeRule())
    render(<UpcomingRenewalsCard />)

    await user.click(screen.getByRole('button', { name: /remove this renewal/i }))

    expect(screen.queryByTestId('upcoming-renewal-row')).not.toBeInTheDocument()
    expect(getRecurringRules()).toHaveLength(0)
  })

  it('falls back to the raw stored amount when the token symbol can no longer be resolved', () => {
    saveRecurringRule(makeRule({ tokenSymbol: 'UNKNOWNTOK', amount: '42' }))
    render(<UpcomingRenewalsCard />)

    const row = screen.getByTestId('upcoming-renewal-row')
    expect(within(row).getByText(/42 UNKNOWNTOK/)).toBeInTheDocument()
  })
})
