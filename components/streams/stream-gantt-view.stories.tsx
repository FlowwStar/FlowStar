import type { Meta, StoryObj } from '@storybook/react'
import { mocked } from 'storybook/test'
import { useWallet } from '@/hooks/use-wallet'
import type { StreamData } from '@/types/stream'
import { StreamGanttView } from './stream-gantt-view'

const DAY = 86_400
// Fixed "now" so the stories render deterministically.
const NOW = 1_767_225_600 // 2026-01-01T00:00:00Z

const ME = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI'
const ALICE = 'GCKFBEIYV2U22IO2BJ4KVJOIP7XPWQGQFKKWXR6DOSJBV7STMAQSMTGG'
const BOB = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37'

const XLM = {
  address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  symbol: 'XLM',
  decimals: 7,
}

function makeStream(
  id: string,
  overrides: Partial<StreamData> & {
    startOffsetDays: number
    durationDays: number
    cliffDays?: number
  },
): StreamData {
  const { startOffsetDays, durationDays, cliffDays = 0, ...rest } = overrides
  const startTime = BigInt(NOW + startOffsetDays * DAY)
  const duration = BigInt(durationDays * DAY)
  const depositedAmount = 10_000n * 10n ** 7n
  return {
    id,
    sender: ME,
    recipient: ALICE,
    token: XLM,
    depositedAmount,
    withdrawnAmount: 0n,
    startTime,
    endTime: startTime + duration,
    cliffTime: startTime + BigInt(cliffDays * DAY),
    cliffAmount: 0n,
    amountPerSecond: depositedAmount / duration,
    linearAmount: depositedAmount,
    duration,
    cancelled: false,
    ...rest,
  }
}

const meta = {
  title: 'Streams/StreamGanttView',
  component: StreamGanttView,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  beforeEach: () => {
    mocked(useWallet).mockReturnValue({
      address: ME,
      walletId: 'freighter',
      connecting: false,
      reconnecting: false,
      isConnected: true,
      networkMismatch: false,
      walletNetwork: 'TESTNET',
      connect: async () => {},
      disconnect: () => {},
      signTransaction: async (xdr: string) => xdr,
    })
  },
} satisfies Meta<typeof StreamGanttView>

export default meta
type Story = StoryObj<typeof meta>

// Single stream — one active outgoing stream with a cliff.
export const SingleStream: Story = {
  args: {
    nowSeconds: NOW,
    streams: [
      makeStream('1', {
        startOffsetDays: -30,
        durationDays: 90,
        cliffDays: 14,
        metadata: { name: 'Q1 Salary', category: 'payroll', memo: '' },
      }),
    ],
  },
}

// Many overlapping streams — every status, incoming and outgoing, with
// schedules that overlap each other and the "today" line.
export const ManyOverlappingStreams: Story = {
  args: {
    nowSeconds: NOW,
    streams: [
      makeStream('1', {
        startOffsetDays: -60,
        durationDays: 120,
        cliffDays: 30,
        metadata: { name: 'Engineering Payroll', category: 'payroll', memo: '' },
      }),
      makeStream('2', {
        startOffsetDays: -20,
        durationDays: 45,
        sender: BOB,
        recipient: ME,
        metadata: { name: 'Design Grant', category: 'grant', memo: '' },
      }),
      makeStream('3', { startOffsetDays: 10, durationDays: 60, recipient: BOB }),
      makeStream('4', {
        startOffsetDays: -90,
        durationDays: 60,
        metadata: { name: 'Advisor Vesting', category: 'vesting', memo: '' },
      }),
      makeStream('5', {
        startOffsetDays: -40,
        durationDays: 100,
        cliffDays: 20,
        cancelled: true,
        metadata: { name: 'Contractor Retainer', category: 'contract', memo: '' },
      }),
      makeStream('6', {
        startOffsetDays: -5,
        durationDays: 30,
        sender: ALICE,
        recipient: ME,
      }),
      makeStream('7', {
        startOffsetDays: 25,
        durationDays: 90,
        cliffDays: 30,
        metadata: { name: 'Q2 Token Unlock', category: 'vesting', memo: '' },
      }),
    ],
  },
}
