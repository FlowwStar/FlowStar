import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { QrShareDialog } from './qr-share-dialog'
import { SITE_URL } from '@/lib/site'
import { Button } from '@/components/ui/button'
import type { StreamData } from '@/types/stream'

const DAY = 86400n
const now = BigInt(Math.floor(Date.now() / 1000))
const startTime = now - DAY * 10n
const endTime = now + DAY * 20n
const depositedAmount = 3_000_000_000n

const sampleStream: StreamData = {
  id: '42',
  sender: 'GBQ2X7KFY3R4VZ6N5LJ7WQH3M2PD8C9SAUTV4EXAMPLE0WALLET00ADDR',
  recipient: 'GDZSTFXVCDTUJ76ZAV2HA72KYRMF5QJMJBFPMJDHKHXU4LBKCZW75J2Z',
  token: {
    address: 'CBBT7UGKPGP7EOUDJYVWGXQKD4CWPVD54PH43D5F7WAJT3XJVJ2XPMA',
    symbol: 'USDC',
    decimals: 6,
  },
  depositedAmount,
  withdrawnAmount: 500_000_000n,
  startTime,
  endTime,
  cliffTime: startTime,
  cliffAmount: 0n,
  amountPerSecond: depositedAmount / (endTime - startTime),
  linearAmount: depositedAmount,
  duration: endTime - startTime,
  cancelled: false,
}

const meta = {
  title: 'Streams/QrShareDialog',
  component: QrShareDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
} satisfies Meta<typeof QrShareDialog>

export default meta
type Story = StoryObj<typeof meta>

export const OpenWithSampleStream: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    streamUrl: `${SITE_URL}/app/streams/42`,
    stream: sampleStream,
    status: 'streaming',
  },
  render: function Render(args) {
    const [open, setOpen] = useState(args.open)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Share stream</Button>
        <QrShareDialog {...args} open={open} onOpenChange={setOpen} />
      </>
    )
  },
}
