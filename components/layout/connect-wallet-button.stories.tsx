import type { Meta, StoryObj } from '@storybook/react'
import { fn, mocked } from 'storybook/test'
import { useWallet } from '@/hooks/use-wallet'
import { ConnectWalletButton } from './connect-wallet-button'

// `useWallet` is module-mocked in .storybook/preview.ts; each story sets the
// wallet context value it needs.
type WalletState = ReturnType<typeof useWallet>

const MOCK_ADDRESS = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI'

function mockWallet(overrides: Partial<WalletState> = {}): WalletState {
  return {
    address: null,
    walletId: null,
    connecting: false,
    reconnecting: false,
    isConnected: false,
    networkMismatch: false,
    walletNetwork: null,
    connect: fn(async () => {}),
    disconnect: fn(),
    signTransaction: fn(async (xdr: string) => xdr),
    ...overrides,
  }
}

const meta = {
  title: 'Layout/ConnectWalletButton',
  component: ConnectWalletButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ConnectWalletButton>

export default meta
type Story = StoryObj<typeof meta>

// No wallet connected: shows the "Connect wallet" button and wallet picker
export const Disconnected: Story = {
  beforeEach: () => {
    mocked(useWallet).mockReturnValue(mockWallet())
  },
}

// Wallet connected: shows the shortened address with the account menu
export const Connected: Story = {
  beforeEach: () => {
    mocked(useWallet).mockReturnValue(
      mockWallet({
        address: MOCK_ADDRESS,
        walletId: 'freighter',
        isConnected: true,
        walletNetwork: 'TESTNET',
      }),
    )
  },
}

// Auto-reconnecting a previously used wallet on page load
export const Reconnecting: Story = {
  beforeEach: () => {
    mocked(useWallet).mockReturnValue(mockWallet({ reconnecting: true }))
  },
}
