import type { Meta, StoryObj } from "@storybook/react"
import { AccessibleUnlockAmount } from "./accessible-unlock-amount"

const meta = {
  title: "UI/AccessibleUnlockAmount",
  component: AccessibleUnlockAmount,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AccessibleUnlockAmount>

export default meta
type Story = StoryObj<typeof meta>

// Fully unlocked state (100%)
export const FullyUnlocked: Story = {
  render: () => (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Fully unlocked (100%)</p>
      <AccessibleUnlockAmount
        unlockedAmount={10000n}
        totalAmount={10000n}
        tokenSymbol="USDC"
      />
      <p className="text-xs text-muted-foreground">
        Screen reader will announce: "10000 USDC unlocked out of 10000 USDC total"
      </p>
    </div>
  ),
}

// Partially unlocked state (50%)
export const PartiallyUnlocked: Story = {
  render: () => (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Partially unlocked (50%)</p>
      <AccessibleUnlockAmount
        unlockedAmount={5000n}
        totalAmount={10000n}
        tokenSymbol="USDC"
      />
      <p className="text-xs text-muted-foreground">
        Screen reader will announce: "5000 USDC unlocked out of 10000 USDC total"
      </p>
    </div>
  ),
}

// No unlock yet (0%)
export const NoUnlock: Story = {
  render: () => (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">No unlock (0%)</p>
      <AccessibleUnlockAmount
        unlockedAmount={0n}
        totalAmount={10000n}
        tokenSymbol="USDC"
      />
      <p className="text-xs text-muted-foreground">
        Screen reader will announce: "0 USDC unlocked out of 10000 USDC total"
      </p>
    </div>
  ),
}

// Partial unlock with different token
export const PartialUnlockWithEUR: Story = {
  render: () => (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Partially unlocked EUR (25%)</p>
      <AccessibleUnlockAmount
        unlockedAmount={2500n}
        totalAmount={10000n}
        tokenSymbol="EUR"
      />
      <p className="text-xs text-muted-foreground">
        Screen reader will announce: "2500 EUR unlocked out of 10000 EUR total"
      </p>
    </div>
  ),
}

// Quarter unlocked (25%)
export const QuarterUnlocked: Story = {
  render: () => (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Quarter unlocked (25%)</p>
      <AccessibleUnlockAmount
        unlockedAmount={2500n}
        totalAmount={10000n}
        tokenSymbol="USDT"
      />
      <p className="text-xs text-muted-foreground">
        Screen reader will announce: "2500 USDT unlocked out of 10000 USDT total"
      </p>
    </div>
  ),
}

// Three-quarter unlocked (75%)
export const ThreeQuarterUnlocked: Story = {
  render: () => (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Three-quarter unlocked (75%)</p>
      <AccessibleUnlockAmount
        unlockedAmount={7500n}
        totalAmount={10000n}
        tokenSymbol="USDC"
      />
      <p className="text-xs text-muted-foreground">
        Screen reader will announce: "7500 USDC unlocked out of 10000 USDC total"
      </p>
    </div>
  ),
}

// Large amounts
export const LargeAmounts: Story = {
  render: () => (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Large amount - half unlocked</p>
      <AccessibleUnlockAmount
        unlockedAmount={500000000n}
        totalAmount={1000000000n}
        tokenSymbol="USDC"
      />
      <p className="text-xs text-muted-foreground">
        Screen reader will announce: "500000000 USDC unlocked out of 1000000000 USDC total"
      </p>
    </div>
  ),
}

// Comparison of multiple unlock states
export const UnlockComparison: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">0% Unlocked:</p>
        <AccessibleUnlockAmount
          unlockedAmount={0n}
          totalAmount={1000n}
          tokenSymbol="USDC"
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">25% Unlocked:</p>
        <AccessibleUnlockAmount
          unlockedAmount={250n}
          totalAmount={1000n}
          tokenSymbol="USDC"
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">50% Unlocked:</p>
        <AccessibleUnlockAmount
          unlockedAmount={500n}
          totalAmount={1000n}
          tokenSymbol="USDC"
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">75% Unlocked:</p>
        <AccessibleUnlockAmount
          unlockedAmount={750n}
          totalAmount={1000n}
          tokenSymbol="USDC"
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">100% Unlocked:</p>
        <AccessibleUnlockAmount
          unlockedAmount={1000n}
          totalAmount={1000n}
          tokenSymbol="USDC"
        />
      </div>
    </div>
  ),
}
