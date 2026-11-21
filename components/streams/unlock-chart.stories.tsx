import type { Meta, StoryObj } from '@storybook/react'
import type { StreamData } from '@/types/stream'
import { UnlockChart } from './unlock-chart'

const DAY = 86_400n
// Fixed "now" so the stories render deterministically.
const NOW = 1_767_225_600 // 2026-01-01T00:00:00Z

const START = BigInt(NOW) - 30n * DAY
const DURATION = 90n * DAY
const DEPOSITED = 10_000n * 10n ** 7n

const baseStream: StreamData = {
  id: '42',
  sender: 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI',
  recipient: 'GCKFBEIYV2U22IO2BJ4KVJOIP7XPWQGQFKKWXR6DOSJBV7STMAQSMTGG',
  token: {
    address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    symbol: 'XLM',
    decimals: 7,
  },
  depositedAmount: DEPOSITED,
  withdrawnAmount: 1_500n * 10n ** 7n,
  startTime: START,
  endTime: START + DURATION,
  cliffTime: START,
  cliffAmount: 0n,
  amountPerSecond: DEPOSITED / DURATION,
  linearAmount: DEPOSITED,
  duration: DURATION,
  cancelled: false,
}

// 2,500 XLM released at a 14-day cliff, the rest unlocking linearly after it.
const CLIFF_AMOUNT = 2_500n * 10n ** 7n
const CLIFF_TIME = START + 14n * DAY
const cliffStream: StreamData = {
  ...baseStream,
  cliffTime: CLIFF_TIME,
  cliffAmount: CLIFF_AMOUNT,
  linearAmount: DEPOSITED - CLIFF_AMOUNT,
  amountPerSecond: (DEPOSITED - CLIFF_AMOUNT) / (START + DURATION - CLIFF_TIME),
}

const meta = {
  title: 'Streams/UnlockChart',
  component: UnlockChart,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UnlockChart>

export default meta
type Story = StoryObj<typeof meta>

// With cliff — dashed cliff marker and a step in the unlock curve.
export const WithCliff: Story = {
  args: {
    stream: cliffStream,
    nowSeconds: NOW,
  },
}

// Without cliff — purely linear unlock from start to end.
export const WithoutCliff: Story = {
  args: {
    stream: baseStream,
    nowSeconds: NOW,
  },
}

// Cancelled — a cancelled stream with part of the balance already withdrawn.
export const Cancelled: Story = {
  args: {
    stream: { ...cliffStream, id: '43', cancelled: true },
    nowSeconds: NOW,
  },
}
