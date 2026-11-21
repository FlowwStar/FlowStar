import type { Meta, StoryObj } from '@storybook/react'
import { mocked } from 'storybook/test'
import { NetworkProvider } from '@/components/providers/network-provider'
import { useStreamHistory, type TimelineEvent } from '@/hooks/use-stream-history'
import { StreamTimeline } from './stream-timeline'

// `useStreamHistory` is module-mocked in .storybook/preview.ts; each story
// supplies the events for its stream state.
const HOUR = 60 * 60 * 1000
const NOW = new Date('2026-01-15T12:00:00Z').getTime()

function txHash(seed: number): string {
  return seed.toString(16).padStart(2, '0').repeat(32)
}

const created: TimelineEvent = {
  type: 'created',
  txHash: txHash(1),
  timestamp: NOW - 72 * HOUR,
  ledger: 1_000_000,
  description: 'Stream created',
}

function withdrawal(seed: number, hoursAgo: number, amount: string): TimelineEvent {
  return {
    type: 'withdrawal',
    txHash: txHash(seed),
    timestamp: NOW - hoursAgo * HOUR,
    ledger: 1_000_000 + seed * 100,
    description: 'Withdrawal from stream',
    amount,
  }
}

// Events are newest first, matching what `useStreamHistory` returns.
const EVENTS: Record<'scheduled' | 'streaming' | 'completed' | 'cancelled', TimelineEvent[]> = {
  scheduled: [created],
  streaming: [
    withdrawal(3, 12, '150 USDC'),
    {
      type: 'topup',
      txHash: txHash(2),
      timestamp: NOW - 48 * HOUR,
      ledger: 1_000_200,
      description: 'Stream topped up',
      amount: '500 USDC',
    },
    created,
  ],
  completed: [
    withdrawal(6, 1, '250 USDC'),
    withdrawal(5, 24, '250 USDC'),
    withdrawal(4, 48, '250 USDC'),
    withdrawal(3, 60, '250 USDC'),
    created,
  ],
  cancelled: [
    {
      type: 'cancellation',
      txHash: txHash(4),
      timestamp: NOW - 6 * HOUR,
      ledger: 1_000_400,
      description: 'Stream cancelled',
    },
    withdrawal(3, 24, '120 USDC'),
    created,
  ],
}

function historyStory(state: keyof typeof EVENTS): Story {
  return {
    beforeEach: () => {
      mocked(useStreamHistory).mockReturnValue({
        events: EVENTS[state],
        loading: false,
        refetch: async () => {},
      })
    },
  }
}

const meta = {
  title: 'Streams/StreamTimeline',
  component: StreamTimeline,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    streamId: '42',
  },
  decorators: [
    (Story) => (
      <NetworkProvider>
        <div className="mx-auto max-w-2xl">
          <Story />
        </div>
      </NetworkProvider>
    ),
  ],
} satisfies Meta<typeof StreamTimeline>

export default meta
type Story = StoryObj<typeof meta>

// Created but not yet started: only the creation event
export const Scheduled: Story = historyStory('scheduled')

// Actively streaming: creation, a top-up and a withdrawal
export const Streaming: Story = historyStory('streaming')

// Fully withdrawn: enough events to show the collapse toggle
export const Completed: Story = historyStory('completed')

// Cancelled by the sender after a partial withdrawal
export const Cancelled: Story = historyStory('cancelled')
