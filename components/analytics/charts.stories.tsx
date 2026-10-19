import type { Meta, StoryObj } from '@storybook/react'
import { AnalyticsCharts, ChartSkeleton } from './charts'

type AnalyticsChartsProps = React.ComponentProps<typeof AnalyticsCharts>

const mockSeriesData: AnalyticsChartsProps['series'] = [
  { label: 'Jan 1', count: 5, volume: 1500 },
  { label: 'Jan 8', count: 8, volume: 2400 },
  { label: 'Jan 15', count: 12, volume: 3200 },
  { label: 'Jan 22', count: 10, volume: 2800 },
  { label: 'Jan 29', count: 15, volume: 3800 },
]

const mockTokenShares: AnalyticsChartsProps['tokenShares'] = [
  { symbol: 'USDC', amount: 50000000000n, count: 12, decimals: 6 },
  { symbol: 'USDT', amount: 30000000000n, count: 8, decimals: 6 },
  { symbol: 'EUR', amount: 20000000000n, count: 5, decimals: 6 },
]

const mockTopTokens: AnalyticsChartsProps['topTokens'] = [
  { symbol: 'USDC', amount: 50000000000n, count: 12, decimals: 6 },
  { symbol: 'USDT', amount: 30000000000n, count: 8, decimals: 6 },
  { symbol: 'EUR', amount: 20000000000n, count: 5, decimals: 6 },
]

const mockStatusBreakdown: AnalyticsChartsProps['statusBreakdown'] = [
  { status: 'streaming', count: 15 },
  { status: 'completed', count: 8 },
  { status: 'scheduled', count: 3 },
  { status: 'cancelled', count: 2 },
]

const mockTopRecipients: AnalyticsChartsProps['topRecipients'] = [
  {
    address: 'GCZJVEY2HJVCWZQW2IGUBNVQ4FXQMYB7VVKQEMKJ3BMPZX5ZMMK5GO7C',
    federationName: 'alice.stellar.org',
    count: 5,
    totals: [
      { symbol: 'USDC', amount: 25000000000n, decimals: 6 },
      { symbol: 'USDT', amount: 15000000000n, decimals: 6 },
    ],
  },
  {
    address: 'GBXUQR5DNRVAQB46CJMNF4XKLJZL5AOPNOPK3RLVQXPKWCZWUZNAGM3',
    federationName: null,
    count: 3,
    totals: [
      { symbol: 'EUR', amount: 20000000000n, decimals: 6 },
    ],
  },
]

const meta = {
  title: 'Analytics/Charts',
  component: AnalyticsCharts,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AnalyticsCharts>

export default meta
type Story = StoryObj<typeof meta>

/** Full analytics dashboard with populated data. */
export const PopulatedData: Story = {
  args: {
    series: mockSeriesData,
    topTokens: mockTopTokens,
    tokenShares: mockTokenShares,
    totalVolume: 100000000000n,
    statusBreakdown: mockStatusBreakdown,
    topRecipients: mockTopRecipients,
    unlockProgress: { unlocked: 45000000000n, deposited: 100000000000n },
  },
}

/** Analytics dashboard with only a single token (USDC). */
export const SingleToken: Story = {
  args: {
    series: [
      { label: 'Jan 1', count: 5, volume: 1500 },
      { label: 'Jan 8', count: 8, volume: 2400 },
    ],
    topTokens: [
      { symbol: 'USDC', amount: 50000000000n, count: 20, decimals: 6 },
    ],
    tokenShares: [
      { symbol: 'USDC', amount: 50000000000n, count: 20, decimals: 6 },
    ],
    totalVolume: 50000000000n,
    statusBreakdown: [
      { status: 'streaming', count: 15 },
      { status: 'completed', count: 5 },
    ],
    topRecipients: [
      {
        address: 'GCZJVEY2HJVCWZQW2IGUBNVQ4FXQMYB7VVKQEMKJ3BMPZX5ZMMK5GO7C',
        federationName: 'alice.stellar.org',
        count: 20,
        totals: [
          { symbol: 'USDC', amount: 50000000000n, decimals: 6 },
        ],
      },
    ],
    unlockProgress: { unlocked: 25000000000n, deposited: 50000000000n },
  },
}

/** Empty analytics state with no data. */
export const EmptyData: Story = {
  args: {
    series: [],
    topTokens: [],
    tokenShares: [],
    totalVolume: 0n,
    statusBreakdown: [],
    topRecipients: [],
    unlockProgress: { unlocked: 0n, deposited: 0n },
  },
}

/** Loading skeleton for analytics charts. */
export const Loading: Story = {
  render: () => <ChartSkeleton />,
}
