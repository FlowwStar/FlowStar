import type { Meta, StoryObj } from '@storybook/react'
import { DashboardStats, DashboardStatsSkeleton } from './dashboard-stats'
import type { StreamData } from '@/types/stream'

const NOW = 1_767_225_600 // 2026-01-01T00:00:00Z
const DAY = 86_400n
const USDC = {
  address: 'CBBT7UGKPGP7EOUDJYVWGXQKD4CWPVD54PH43D5F7WAJT3XJVJ2XPMA',
  symbol: 'USDC',
  decimals: 6,
}

function makeStream(id: string, overrides: Partial<StreamData> = {}): StreamData {
  const startTime = NOW - Number(DAY * 10n)
  const endTime = NOW + Number(DAY * 20n)
  const depositedAmount = 3_000_000_000n
  return {
    id,
    sender: 'GBQ2X7KFY3R4VZ6N5LJ7WQH3M2PD8C9SAUTV4EXAMPLE0WALLET00ADDR',
    recipient: 'GDZSTFXVCDTUJ76ZAV2HA72KYRMF5QJMJBFPMJDHKHXU4LBKCZW75J2Z',
    token: USDC,
    depositedAmount,
    withdrawnAmount: 500_000_000n,
    startTime: BigInt(startTime),
    endTime: BigInt(endTime),
    cliffTime: BigInt(startTime),
    cliffAmount: 0n,
    amountPerSecond: depositedAmount / (DAY * 30n),
    linearAmount: depositedAmount,
    duration: DAY * 30n,
    cancelled: false,
    metadata: { name: 'Monthly payroll', category: 'payroll', memo: '' },
    ...overrides,
  }
}

const meta: Meta<typeof DashboardStats> = {
  title: 'Streams/DashboardStats',
  component: DashboardStats,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

/** Populated dashboard with incoming and outgoing streams. */
export const WithData: Story = {
  args: {
    sent: [makeStream('sent-1')],
    received: [
      makeStream('received-1', { withdrawnAmount: 750_000_000n }),
      makeStream('received-2', { depositedAmount: 1_500_000_000n, withdrawnAmount: 0n }),
    ],
  },
}

/** Loading placeholders shown while stream and price data are being fetched. */
export const Skeleton: Story = {
  render: () => <DashboardStatsSkeleton />,
}
