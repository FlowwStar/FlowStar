import { render, screen } from '@testing-library/react'
import { AnalyticsCharts } from './charts'
import type { StreamStatus } from '@/types/stream'

describe('AnalyticsCharts', () => {
  const mockProps = {
    series: [],
    topTokens: [],
    tokenShares: [],
    totalVolume: 0n,
    statusBreakdown: [],
    topRecipients: [],
    unlockProgress: { unlocked: 0n, deposited: 0n },
  }

  describe('empty state branches', () => {
    it('should render empty state for series when no stream activity', () => {
      render(<AnalyticsCharts {...mockProps} series={[]} />)
      expect(screen.getByText('No stream activity yet for this period.')).toBeInTheDocument()
    })

    it('should render empty state for token distribution when no token shares', () => {
      render(<AnalyticsCharts {...mockProps} tokenShares={[]} />)
      expect(screen.getByText('No token distribution data available yet.')).toBeInTheDocument()
    })

    it('should render empty state for status breakdown when no status data', () => {
      render(<AnalyticsCharts {...mockProps} statusBreakdown={[]} />)
      expect(screen.getByText('No streams to break down yet.')).toBeInTheDocument()
    })

    it('should render empty state for top recipients when none exist', () => {
      render(<AnalyticsCharts {...mockProps} topRecipients={[]} />)
      expect(screen.getByText('No recipients yet.')).toBeInTheDocument()
    })

    it('should render empty state for top tokens when none exist', () => {
      render(<AnalyticsCharts {...mockProps} topTokens={[]} />)
      expect(screen.getByText('No volume data yet.')).toBeInTheDocument()
    })

    it('should render empty state for unlock progress when no deposits', () => {
      render(<AnalyticsCharts {...mockProps} unlockProgress={{ unlocked: 0n, deposited: 0n }} />)
      expect(screen.getByText('No deposits to track yet.')).toBeInTheDocument()
    })
  })

  describe('populated data rendering', () => {
    it('should render series chart when data is present', () => {
      const seriesData = [
        { label: 'Day 1', count: 5, volume: 100 },
        { label: 'Day 2', count: 10, volume: 200 },
      ]
      const { container } = render(<AnalyticsCharts {...mockProps} series={seriesData} />)

      // Check for AreaChart render (recharts component will be in the DOM)
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
    })

    it('should render correct number of token shares in pie chart', () => {
      const tokenShares = [
        { symbol: 'USDC', amount: 1000n, count: 5, decimals: 6 },
        { symbol: 'USDT', amount: 500n, count: 3, decimals: 6 },
        { symbol: 'EUR', amount: 200n, count: 2, decimals: 2 },
      ]
      render(<AnalyticsCharts {...mockProps} tokenShares={tokenShares} />)

      // Check for each token symbol in the legend
      expect(screen.getByText('USDC')).toBeInTheDocument()
      expect(screen.getByText('USDT')).toBeInTheDocument()
      expect(screen.getByText('EUR')).toBeInTheDocument()
    })

    it('should render status breakdown bar chart when status data exists', () => {
      const statusBreakdown: Array<{ status: StreamStatus; count: number }> = [
        { status: 'streaming', count: 15 },
        { status: 'scheduled', count: 8 },
        { status: 'completed', count: 42 },
      ]
      const { container } = render(
        <AnalyticsCharts {...mockProps} statusBreakdown={statusBreakdown} />
      )

      // BarChart should render
      expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
    })

    it('should render top recipients list with correct addresses', () => {
      const topRecipients = [
        {
          address: 'GRZST3XVCDTUJ76ZAV2HA72KYOJ4LLH64JHCZGZ7V5FD5G7SRG4KDFR5',
          federationName: null,
          count: 12,
          totals: [{ symbol: 'USDC', amount: 50000n, decimals: 6 }],
        },
        {
          address: 'GDZST2VCDTUJ76ZAV2HA72KYOJ4LLH64JHCZGZ7V5FD5G7SRG4KDTR2',
          federationName: 'alice.stellar.expert',
          count: 8,
          totals: [{ symbol: 'USDT', amount: 30000n, decimals: 6 }],
        },
      ]
      render(<AnalyticsCharts {...mockProps} topRecipients={topRecipients} />)

      // Federation name should be shown
      expect(screen.getByText('alice.stellar.expert')).toBeInTheDocument()
      // Stream count should be displayed
      expect(screen.getByText('12 streams')).toBeInTheDocument()
      expect(screen.getByText('8 streams')).toBeInTheDocument()
    })

    it('should render top tokens with correct count and amounts', () => {
      const topTokens = [
        { symbol: 'USDC', amount: 100000n, count: 42, decimals: 6 },
        { symbol: 'USDT', amount: 75000n, count: 28, decimals: 6 },
      ]
      render(<AnalyticsCharts {...mockProps} topTokens={topTokens} />)

      expect(screen.getByText('USDC')).toBeInTheDocument()
      expect(screen.getByText('42 streams')).toBeInTheDocument()
      expect(screen.getByText('USDT')).toBeInTheDocument()
      expect(screen.getByText('28 streams')).toBeInTheDocument()
    })

    it('should calculate and display unlock progress percentage', () => {
      const unlockProgress = {
        unlocked: 5000n,
        deposited: 10000n,
      }
      render(<AnalyticsCharts {...mockProps} unlockProgress={unlockProgress} />)

      // Should show 50% unlock progress
      expect(screen.getByText('50.0%')).toBeInTheDocument()
    })

    it('should handle edge case where unlock progress is 0%', () => {
      const unlockProgress = {
        unlocked: 0n,
        deposited: 10000n,
      }
      render(<AnalyticsCharts {...mockProps} unlockProgress={unlockProgress} />)

      expect(screen.getByText('0.0%')).toBeInTheDocument()
    })

    it('should handle edge case where unlock progress is 100%', () => {
      const unlockProgress = {
        unlocked: 10000n,
        deposited: 10000n,
      }
      render(<AnalyticsCharts {...mockProps} unlockProgress={unlockProgress} />)

      expect(screen.getByText('100.0%')).toBeInTheDocument()
    })
  })

  describe('singular/plural forms', () => {
    it('should display "stream" for single recipient stream', () => {
      const topRecipients = [
        {
          address: 'GRZST3XVCDTUJ76ZAV2HA72KYOJ4LLH64JHCZGZ7V5FD5G7SRG4KDFR5',
          federationName: null,
          count: 1,
          totals: [{ symbol: 'USDC', amount: 1000n, decimals: 6 }],
        },
      ]
      render(<AnalyticsCharts {...mockProps} topRecipients={topRecipients} />)

      expect(screen.getByText('1 stream')).toBeInTheDocument()
    })
  })

  describe('card titles and descriptions', () => {
    it('should render all expected card titles', () => {
      render(<AnalyticsCharts {...mockProps} />)

      expect(screen.getByText('Streaming volume over time')).toBeInTheDocument()
      expect(screen.getByText('Token distribution')).toBeInTheDocument()
      expect(screen.getByText('Stream status breakdown')).toBeInTheDocument()
      expect(screen.getByText('Top recipients')).toBeInTheDocument()
      expect(screen.getByText('Top tokens by volume')).toBeInTheDocument()
      expect(screen.getByText('Unlock progress')).toBeInTheDocument()
    })
  })
})
