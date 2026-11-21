import type { Meta, StoryObj } from '@storybook/react'
import { StreamPreview } from './stream-preview'

const meta = {
  title: 'Streams/StreamPreview',
  component: StreamPreview,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
  args: {
    amount: '1000',
    token: {
      address: 'CBBT7UGKPGP7EOUDJYVWGXQKD4CWPVD54PH43D5F7WAJT3XJVJ2XPMA',
      symbol: 'USDC',
      decimals: 6,
    },
    startDate: '2026-01-01T00:00',
    endDate: '2026-04-01T00:00',
    hasCliff: false,
    cliffDate: '',
    cliffAmount: '',
  },
} satisfies Meta<typeof StreamPreview>

export default meta
type Story = StoryObj<typeof meta>

// Linear stream with a one-month cliff unlocking 250 USDC
export const WithCliff: Story = {
  args: {
    hasCliff: true,
    cliffDate: '2026-02-01T00:00',
    cliffAmount: '250',
  },
}

// Purely linear stream with no cliff
export const WithoutCliff: Story = {}
