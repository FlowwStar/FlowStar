import type { Meta, StoryObj } from '@storybook/react'
import { mocked } from 'storybook/test'
import { useNetwork } from '@/components/providers/network-provider'
import { getNetworkConfig } from '@/lib/stellar'
import { MockModeBanner } from './mock-mode-banner'

const meta = {
  title: 'Layout/MockModeBanner',
  component: MockModeBanner,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative min-h-[120px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MockModeBanner>

export default meta
type Story = StoryObj<typeof meta>

// Visible — no contract configured, so the app is running against the mock store.
// Note: the banner is dev-only and renders nothing in production builds.
export const Visible: Story = {
  beforeEach: () => {
    mocked(useNetwork).mockReturnValue({
      network: 'testnet',
      setNetwork: () => {},
      config: { ...getNetworkConfig('testnet'), streamContractId: '' },
      isMockMode: true,
    })
  },
}
