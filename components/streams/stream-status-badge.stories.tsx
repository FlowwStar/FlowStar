import type { Meta, StoryObj } from '@storybook/react'
import type { StreamStatus } from '@/types/stream'
import { StreamStatusBadge } from './stream-status-badge'

const statuses: StreamStatus[] = ['streaming', 'scheduled', 'completed', 'cancelled']

const meta = {
  title: 'Streams/StreamStatusBadge',
  component: StreamStatusBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: statuses,
    },
  },
} satisfies Meta<typeof StreamStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Streaming: Story = {
  args: { status: 'streaming' },
}

export const Scheduled: Story = {
  args: { status: 'scheduled' },
}

export const Completed: Story = {
  args: { status: 'completed' },
}

export const Cancelled: Story = {
  args: { status: 'cancelled' },
}
