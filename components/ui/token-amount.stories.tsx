import type { Meta, StoryObj } from '@storybook/react'
import { TokenAmount } from '@/components/ui/token-amount'
import type { TokenInfo } from '@/types/stream'

const meta: Meta<typeof TokenAmount> = {
  title: 'UI/TokenAmount',
  component: TokenAmount,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof meta>

const mockUSDC: TokenInfo = {
  symbol: 'USDC',
  decimals: 6,
  address: 'GBBD47UZQ', // truncated for example
}

const mockEUR: TokenInfo = {
  symbol: 'EUR',
  decimals: 2,
  address: 'CEUR5CRBJZ',
}

const mockWBTC: TokenInfo = {
  symbol: 'WBTC',
  decimals: 8,
  address: 'CWBTC52345',
}

export const SmallAmount: Story = {
  args: {
    amount: BigInt(100000), // 0.1 USDC
    token: mockUSDC,
  },
}

export const StandardAmount: Story = {
  args: {
    amount: BigInt(1000000), // 1 USDC
    token: mockUSDC,
  },
}

export const LargeAmount: Story = {
  args: {
    amount: BigInt(1234567890000), // 1,234,567.89 USDC
    token: mockUSDC,
  },
}

export const CompactSmall: Story = {
  args: {
    amount: BigInt(1200000), // 1.2 USDC
    token: mockUSDC,
    compact: true,
  },
}

export const CompactLarge: Story = {
  args: {
    amount: BigInt(1200000000), // 1.2B USDC in compact
    token: mockUSDC,
    compact: true,
  },
}

export const VeryLargeWithCompact: Story = {
  args: {
    amount: BigInt(5400000000000), // 5.4T in compact notation
    token: mockUSDC,
    compact: true,
  },
}

export const DifferentToken: Story = {
  args: {
    amount: BigInt(12345), // 123.45 EUR
    token: mockEUR,
  },
}

export const Bitcoin: Story = {
  args: {
    amount: BigInt(50000000), // 0.5 WBTC
    token: mockWBTC,
  },
}

export const WithoutSymbol: Story = {
  args: {
    amount: BigInt(1000000),
    token: mockUSDC,
    showSymbol: false,
  },
}

export const CustomMaxFractionDigits: Story = {
  args: {
    amount: BigInt(1234567),
    token: mockUSDC,
    maxFractionDigits: 2,
  },
}

function TokenAmountComparison() {
  const amounts = [
    { label: '0.001 USDC', amount: BigInt(1000) },
    { label: '0.1 USDC', amount: BigInt(100000) },
    { label: '1 USDC', amount: BigInt(1000000) },
    { label: '100 USDC', amount: BigInt(100000000) },
    { label: '1000 USDC', amount: BigInt(1000000000) },
    { label: '1,000,000 USDC', amount: BigInt(1000000000000) },
  ]

  return (
    <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Amount Formatting Comparison
      </p>
      {amounts.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{item.label}</span>
          <div className="space-x-4">
            <span className="inline-block w-32 text-right">
              <TokenAmount amount={item.amount} token={mockUSDC} />
            </span>
            <span className="inline-block w-20 text-right text-xs text-muted-foreground">
              <TokenAmount amount={item.amount} token={mockUSDC} compact showSymbol={false} />
              {' USDC'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export const Comparison: Story = {
  render: () => <TokenAmountComparison />,
}
