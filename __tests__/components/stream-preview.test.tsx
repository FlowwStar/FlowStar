import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreamPreview } from '@/components/streams/stream-preview'
import type { TokenInfo } from '@/types/stream'

vi.mock('@/lib/stream-utils', () => ({
  formatTokenAmount: (raw: bigint, decimals: number) => (Number(raw) / 10 ** decimals).toFixed(2),
  SECONDS_PER_DAY: 86400,
}))

const TOKEN: TokenInfo = { address: 'CUSD', symbol: 'USDC', decimals: 7 }

// Helper: ISO date strings for a known window
const START = '2025-01-01T00:00:00Z'
const END = '2025-01-31T00:00:00Z' // 30 days
const CLIFF = '2025-01-15T00:00:00Z' // 14 days in

function baseProps(overrides?: Record<string, unknown>) {
  return {
    amount: '1000',
    token: TOKEN,
    startDate: START,
    endDate: END,
    hasCliff: false,
    cliffDate: START,
    cliffAmount: '',
    ...overrides,
  }
}

describe('StreamPreview', () => {
  describe('empty / placeholder state', () => {
    it('shows placeholder when amount is zero', () => {
      render(<StreamPreview {...baseProps({ amount: '0' })} />)
      expect(screen.getByText(/Fill in the form to see a preview/)).toBeInTheDocument()
    })

    it('shows placeholder when end date is before start date', () => {
      render(<StreamPreview {...baseProps({ endDate: '2024-12-01T00:00:00Z' })} />)
      expect(screen.getByText(/Fill in the form to see a preview/)).toBeInTheDocument()
    })
  })

  describe('no-cliff stream', () => {
    it('renders the "Stream preview" heading', () => {
      render(<StreamPreview {...baseProps()} />)
      expect(screen.getByText('Stream preview')).toBeInTheDocument()
    })

    it('shows total duration of 30 days', () => {
      render(<StreamPreview {...baseProps()} />)
      expect(screen.getByText('30 days')).toBeInTheDocument()
    })

    it('shows unlock rate in per-day format', () => {
      render(<StreamPreview {...baseProps()} />)
      // 1000 / 30 days ≈ 33.33 /day
      expect(screen.getByText(/\/day/)).toBeInTheDocument()
    })

    it('does NOT show cliff amount or cliff wait', () => {
      render(<StreamPreview {...baseProps()} />)
      expect(screen.queryByText('Cliff amount')).not.toBeInTheDocument()
      expect(screen.queryByText('Cliff wait')).not.toBeInTheDocument()
    })

    it('does NOT show low rate warning for normal streams', () => {
      render(<StreamPreview {...baseProps()} />)
      expect(screen.queryByText(/Unlock rate is very low/)).not.toBeInTheDocument()
    })

    it('shows Start and End in the timeline', () => {
      render(<StreamPreview {...baseProps()} />)
      expect(screen.getByText('Start')).toBeInTheDocument()
      // End label includes the duration
      expect(screen.getByText(/End \(30 days\)/)).toBeInTheDocument()
    })
  })

  describe('cliff stream', () => {
    it('shows cliff amount when hasCliff is true and cliffAmount is provided', () => {
      render(
        <StreamPreview
          {...baseProps({
            hasCliff: true,
            cliffDate: CLIFF,
            cliffAmount: '200',
          })}
        />,
      )
      expect(screen.getByText('Cliff amount')).toBeInTheDocument()
      expect(screen.getByText(/200/)).toBeInTheDocument()
    })

    it('shows cliff wait duration', () => {
      render(
        <StreamPreview
          {...baseProps({
            hasCliff: true,
            cliffDate: CLIFF,
            cliffAmount: '200',
          })}
        />,
      )
      expect(screen.getByText('Cliff wait')).toBeInTheDocument()
      // 14 days
      expect(screen.getByText('14 days')).toBeInTheDocument()
    })

    it('shows Cliff label in the timeline', () => {
      render(
        <StreamPreview
          {...baseProps({
            hasCliff: true,
            cliffDate: CLIFF,
            cliffAmount: '200',
          })}
        />,
      )
      expect(screen.getByText(/Cliff \(14 days\)/)).toBeInTheDocument()
    })
  })

  describe('low rate warning', () => {
    it('shows warning when per-hour rate is below 1', () => {
      // Small amount over 30 days: 0.001 total -> perHour = 0.001 / 30 / 24 ≈ 0.0000014
      render(<StreamPreview {...baseProps({ amount: '0.001' })} />)
      expect(screen.getByText(/Unlock rate is very low/)).toBeInTheDocument()
    })
  })
})
