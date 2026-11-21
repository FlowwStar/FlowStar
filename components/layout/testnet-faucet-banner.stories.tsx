import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, mocked, userEvent, within } from 'storybook/test'
import { useNetwork } from '@/components/providers/network-provider'
import { useWallet } from '@/hooks/use-wallet'
import { getNetworkConfig, getXlmBalance } from '@/lib/stellar'
import { TestnetFaucetBanner } from './testnet-faucet-banner'

const MOCK_ADDRESS = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI'

// Connected testnet wallet with an unfunded (0 XLM) account — the state in
// which the banner is shown.
function mockUnfundedTestnetWallet() {
  mocked(useNetwork).mockReturnValue({
    network: 'testnet',
    setNetwork: () => {},
    config: { ...getNetworkConfig('testnet'), streamContractId: '' },
    isMockMode: true,
  })
  mocked(useWallet).mockReturnValue({
    address: MOCK_ADDRESS,
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
  mocked(getXlmBalance).mockResolvedValue(0n)
}

const meta = {
  title: 'Layout/TestnetFaucetBanner',
  component: TestnetFaucetBanner,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    onClose: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
  beforeEach: mockUnfundedTestnetWallet,
} satisfies Meta<typeof TestnetFaucetBanner>

export default meta
type Story = StoryObj<typeof meta>

// Visible — connected on testnet with a 0 XLM balance.
export const Visible: Story = {}

// Funding in progress — Friendbot request is pending, so the button shows a
// spinner and both actions are disabled.
export const FundingInProgress: Story = {
  beforeEach: () => {
    const originalFetch = globalThis.fetch
    // Keep the Friendbot request pending forever so the in-progress state stays on screen.
    globalThis.fetch = () => new Promise<Response>(() => {})
    return () => {
      globalThis.fetch = originalFetch
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Fund with Friendbot' }))
    await expect(await canvas.findByRole('button', { name: /Funding\.\.\./ })).toBeDisabled()
  },
}
