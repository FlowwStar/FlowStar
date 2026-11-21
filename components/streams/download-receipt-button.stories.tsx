import type { Meta, StoryObj } from '@storybook/react'
import { Toaster } from 'sonner'
import { DownloadReceiptButton } from './download-receipt-button'
import type { StreamData } from '@/types/stream'

const DAY = 86400n
const now = BigInt(Math.floor(Date.now() / 1000))

function makeStream(partial: Partial<StreamData>): StreamData {
  const startTime = partial.startTime ?? now - DAY * 10n
  const endTime = partial.endTime ?? now + DAY * 20n
  const depositedAmount = partial.depositedAmount ?? 3_000_000_000n
  const duration = endTime - startTime
  return {
    id: '1',
    sender: 'GBQ2X7KFY3R4VZ6N5LJ7WQH3M2PD8C9SAUTV4EXAMPLE0WALLET00ADDR',
    recipient: 'GDZSTFXVCDTUJ76ZAV2HA72KYRMF5QJMJBFPMJDHKHXU4LBKCZW75J2Z',
    token: {
      address: 'CBBT7UGKPGP7EOUDJYVWGXQKD4CWPVD54PH43D5F7WAJT3XJVJ2XPMA',
      symbol: 'USDC',
      decimals: 6,
    },
    depositedAmount,
    withdrawnAmount: 0n,
    startTime,
    endTime,
    cliffTime: startTime,
    cliffAmount: 0n,
    amountPerSecond: depositedAmount / duration,
    linearAmount: depositedAmount,
    duration,
    cancelled: false,
    metadata: { name: 'Q1 Salary', category: 'payroll', memo: 'Monthly payroll stream' },
    ...partial,
  }
}

const meta = {
  title: 'Streams/DownloadReceiptButton',
  component: DownloadReceiptButton,
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
} satisfies Meta<typeof DownloadReceiptButton>

export default meta
type Story = StoryObj<typeof meta>

export const ActiveStream: Story = {
  args: {
    stream: makeStream({ id: '1', withdrawnAmount: 500_000_000n }),
    creationTxHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    withdrawalTxHashes: ['0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0'],
  },
}

export const CompletedStream: Story = {
  args: {
    stream: makeStream({
      id: '2',
      startTime: now - DAY * 40n,
      endTime: now - DAY * 10n,
      withdrawnAmount: 3_000_000_000n,
    }),
    creationTxHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    withdrawalTxHashes: [
      '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0',
      '9a8b7c6d5e4f30211203f4e5d6c7b8a99a8b7c6d5e4f30211203f4e5d6c7b8a9',
    ],
  },
}
