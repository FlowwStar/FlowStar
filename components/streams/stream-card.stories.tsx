import type { Meta, StoryObj } from '@storybook/react'
import { fn, mocked } from 'storybook/test'
import { useWallet } from '@/hooks/use-wallet'
import type { StreamData } from '@/types/stream'
import { StreamCard } from './stream-card'

const NOW = 1_767_225_600 // 2026-01-01T00:00:00Z
const DAY = 86_400n
const ME = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI'
const SENDER = 'GCKFBEIYV2U22IO2BJ4KVJOIP7XPWQGQFKKWXR6DOSJBV7STMAQSMTGG'
const RECIPIENT = ME
const USDC = {
  address: 'CBBT7UGKPGP7EOUDJYVWGXQKD4CWPVD54PH43D5F7WAJT3XJVJ2XPMA',
  symbol: 'USDC',
  decimals: 6,
}

type WalletState = ReturnType<typeof useWallet>

function mockWallet(address: string): WalletState {
  return {
    address,
    walletId: 'freighter',
    connecting: false,
    reconnecting: false,
    isConnected: true,
    networkMismatch: false,
    walletNetwork: 'TESTNET',
    connect: fn(async () => {}),
    disconnect: fn(),
    signTransaction: fn(async (xdr: string) => xdr),
  }
}

function makeStream(id = 'stream-42', overrides: Partial<StreamData> = {}): StreamData {
  const startTime = BigInt(NOW - Number(DAY * 10n))
  const endTime = BigInt(NOW + Number(DAY * 20n))
  const depositedAmount = 3_000_000_000n
  return {
    id,
    sender: SENDER,
    recipient: RECIPIENT,
    token: USDC,
    depositedAmount,
    withdrawnAmount: 500_000_000n,
    startTime,
    endTime,
    cliffTime: startTime,
    cliffAmount: 0n,
    amountPerSecond: depositedAmount / (DAY * 30n),
    linearAmount: depositedAmount,
    duration: DAY * 30n,
    cancelled: false,
    metadata: { name: 'Monthly payroll', category: 'payroll', memo: 'January payment' },
    ...overrides,
  }
}

const meta = {
  title: 'Streams/StreamCard',
  component: StreamCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    mocked(useWallet).mockReturnValue(mockWallet(ME))
    localStorage.removeItem('flowstar:pinned-streams')
  },
} satisfies Meta<typeof StreamCard>

export default meta
type Story = StoryObj<typeof meta>

/** Incoming stream — the current wallet is the recipient. */
export const Incoming: Story = {
  args: {
    stream: makeStream(),
  },
}

/** Outgoing stream — the current wallet is the sender. */
export const Outgoing: Story = {
  beforeEach: () => {
    mocked(useWallet).mockReturnValue(mockWallet(SENDER))
  },
  args: {
    stream: makeStream(),
  },
}

/** Dense single-row card for high-volume stream lists. */
export const Compact: Story = {
  args: {
    stream: makeStream(),
    compact: true,
  },
}

/** Incoming stream with the pinned indicator and highlighted border. */
export const Pinned: Story = {
  beforeEach: () => {
    localStorage.setItem('flowstar:pinned-streams', JSON.stringify(['stream-42']))
  },
  args: {
    stream: makeStream(),
  },
}

/** Selection mode with a checked stream selector. */
export const Selectable: Story = {
  args: {
    stream: makeStream(),
    selectable: true,
    selected: true,
    onToggleSelect: fn(),
  },
}
