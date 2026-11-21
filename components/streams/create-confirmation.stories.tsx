import type { Meta, StoryObj } from '@storybook/react'
import { CreateConfirmation } from './create-confirmation'

const now = BigInt(Math.floor(Date.now() / 1000))

const meta = {
  title: 'Streams/CreateConfirmation',
  component: CreateConfirmation,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    open: true,
    onConfirm: () => {},
    onCancel: () => {},
    pending: false,
    feeEstimate: '0.0123456',
    recipient: 'GDZSTFXVCDTUJ76ZAV2HA72KYRMF5QJMJBFPMJDHKHXU4LBKCZW75J2Z',
    token: {
      address: 'CBBT7UGKPGP7EOUDJYVWGXQKD4CWPVD54PH43D5F7WAJT3XJVJ2XPMA',
      symbol: 'USDC',
      decimals: 6,
    },
    totalAmount: 1_000_000_000n, // 1000 USDC
    startTime: now,
    endTime: now + 86400n * 30n, // 30 days
    cliffTime: now,
    cliffAmount: 0n,
    amountPerSecond: 1_000_000_000n / (86400n * 30n),
  },
} satisfies Meta<typeof CreateConfirmation>

export default meta
type Story = StoryObj<typeof meta>

// Ready to confirm and sign
export const Ready: Story = {}

// Transaction submission in progress
export const Pending: Story = {
  args: {
    pending: true,
  },
}
