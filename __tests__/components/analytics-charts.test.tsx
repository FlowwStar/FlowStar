import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalyticsCharts, ChartSkeleton } from '@/components/analytics/charts'
import type { StreamStatus } from '@/types/stream'

const emptySnapshot = {
  series: [],
  topTokens: [],
  tokenShares: [],
  totalVolume: 0n,
  statusBreakdown: [],
  topRecipients: [],
  unlockProgress: { unlocked: 0n, deposited: 0n },
}

const populatedSnapshot = {
  series: [
    { label: 'Jan', count: 5, volume: 1000 },
    { label: 'Feb', count: 8, volume: 1500 },
    { label: 'Mar', count: 12, volume: 2200 },
  ],
  topTokens: [
    {
      symbol: 'USDC',
      amount: 500_000_000n,
      count: 10,
      decimals: 6,
    },
    {
      symbol: 'XLM',
      amount: 1_000_000_000n,
      count: 8,
      decimals: 7,
    },
  ],
  tokenShares: [
    {
      symbol: 'USDC',
      amount: 500_000_000n,
      count: 10,
      decimals: 6,
    },
    {
      symbol: 'XLM',
      amount: 1_000_000_000n,
      count: 8,
      decimals: 7,
    },
  ],
  totalVolume: 1_500_000_000n,
  statusBreakdown: [
    { status: 'streaming' as StreamStatus, count: 5 },
    { status: 'completed' as StreamStatus, count: 10 },
    { status: 'scheduled' as StreamStatus, count: 2 },
    { status: 'cancelled' as StreamStatus, count: 1 },
  ],
  topRecipients: [
    {
      address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB',
      federationName: null,
      count: 5,
      totals: [
        { symbol: 'USDC', amount: 100_000_000n, decimals: 6 },
      ],
    },
    {
      address: 'GXYZABCDEFGHIJKLMNOPQRSTUVW0987654321XY',
      federationName: 'alice*stellar.org',
      count: 3,
      totals: [
        { symbol: 'XLM', amount: 50_000_000n, decimals: 7 },
        { symbol: 'USDC', amount: 25_000_000n, decimals: 6 },
      ],
    },
  ],
  unlockProgress: { unlocked: 300_000_000n, deposited: 1_000_000_000n },
}

describe('AnalyticsCharts', () => {
  it('renders with an empty snapshot', () => {
    const { container } = render(<AnalyticsCharts {...emptySnapshot} />)
    
    expect(screen.getByText(/streaming volume over time/i)).toBeInTheDocument()
    expect(screen.getByText(/token distribution/i)).toBeInTheDocument()
    expect(screen.getByText(/stream status breakdown/i)).toBeInTheDocument()
    expect(screen.getByText(/top recipients/i)).toBeInTheDocument()
    expect(screen.getByText(/top tokens by volume/i)).toBeInTheDocument()
    expect(screen.getByText(/unlock progress/i)).toBeInTheDocument()
    
    // Should show empty state messages
    expect(container.textContent).toContain('No streaming activity')
  })

  it('renders with populated data', () => {
    const { container } = render(<AnalyticsCharts {...populatedSnapshot} />)
    
    // Token symbols should be visible
    expect(screen.getAllByText('USDC').length).toBeGreaterThan(0)
    expect(screen.getAllByText('XLM').length).toBeGreaterThan(0)
    
    // Status breakdown should render
    expect(screen.getByText(/streaming/i)).toBeInTheDocument()
    
    // Recipients should render
    expect(screen.getByText(/alice\*stellar\.org/i)).toBeInTheDocument()
    
    // Should not show empty state messages
    expect(container.textContent).not.toContain('No streaming activity')
  })

  it('formats token amounts in top tokens list', () => {
    render(<AnalyticsCharts {...populatedSnapshot} />)
    
    // USDC with 6 decimals: 500_000_000 = 500
    expect(screen.getByText(/500/)).toBeInTheDocument()
    
    // XLM with 7 decimals: 1_000_000_000 = 100
    expect(screen.getByText(/100/)).toBeInTheDocument()
  })

  it('shows recipient count labels', () => {
    render(<AnalyticsCharts {...populatedSnapshot} />)
    
    expect(screen.getByText(/5 streams/i)).toBeInTheDocument()
    expect(screen.getByText(/3 streams/i)).toBeInTheDocument()
  })

  it('calculates and displays unlock progress percentage', () => {
    render(<AnalyticsCharts {...populatedSnapshot} />)
    
    // unlocked: 300_000_000, deposited: 1_000_000_000 = 30%
    expect(screen.getByText(/30\.0%/)).toBeInTheDocument()
  })

  it('displays shortened addresses for recipients without federation names', () => {
    render(<AnalyticsCharts {...populatedSnapshot} />)
    
    // First recipient has no federation name, so should show shortened address
    expect(screen.getByText(/GABCD…90AB/)).toBeInTheDocument()
  })

  it('displays federation names when available', () => {
    render(<AnalyticsCharts {...populatedSnapshot} />)
    
    expect(screen.getByText(/alice\*stellar\.org/i)).toBeInTheDocument()
  })

  it('shows empty state for zero unlock progress', () => {
    const snapshot = {
      ...emptySnapshot,
      unlockProgress: { unlocked: 0n, deposited: 0n },
    }
    render(<AnalyticsCharts {...snapshot} />)
    
    expect(screen.getByText(/no streams to track/i)).toBeInTheDocument()
  })
})

describe('ChartSkeleton', () => {
  it('renders placeholders', () => {
    const { container } = render(<ChartSkeleton />)
    
    const placeholders = container.querySelectorAll('.animate-pulse')
    expect(placeholders.length).toBeGreaterThan(0)
  })

  it('renders main chart placeholder', () => {
    const { container } = render(<ChartSkeleton />)
    
    const mainChart = container.querySelector('.h-64.animate-pulse')
    expect(mainChart).toBeInTheDocument()
  })

  it('renders grid layout placeholders', () => {
    const { container } = render(<ChartSkeleton />)
    
    // Should have multiple grid sections with placeholders
    const grids = container.querySelectorAll('.grid')
    expect(grids.length).toBeGreaterThan(0)
  })

  it('does not contain any text content', () => {
    const { container } = render(<ChartSkeleton />)
    
    expect(container.textContent).toBe('')
  })
})
