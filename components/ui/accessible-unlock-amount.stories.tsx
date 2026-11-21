import type { Meta, StoryObj } from '@storybook/react'
import { AccessibleUnlockAmount } from './accessible-unlock-amount'

const meta = {
  title: 'UI/AccessibleUnlockAmount',
  component: AccessibleUnlockAmount,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AccessibleUnlockAmount>

export default meta
type Story = StoryObj<typeof meta>

const base = {
  amount: 125_000_000n,
  decimals: 6,
  symbol: 'USDC',
}

export const Active: Story = {
  args: base,
}

export const CliffReached: Story = {
  args: {
    ...base,
    amount: 250_000_000n,
    isCliffReached: true,
  },
}

export const Completed: Story = {
  args: {
    ...base,
    amount: 1_000_000_000n,
    isCompleted: true,
  },
}

export const HiddenPauseButton: Story = {
  args: {
    ...base,
    hideButton: true,
  },
}
