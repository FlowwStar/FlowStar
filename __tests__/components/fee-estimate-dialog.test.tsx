import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeeEstimateDialog } from '@/components/ui/fee-estimate-dialog'
import type { FeeBreakdown } from '@/lib/fee-utils'

const sampleFees: FeeBreakdown = {
  minFee: 100_000,
  bufferFee: 15_000,
  totalEstimated: 115_000,
  estimatedUsd: 0.0138,
  priceLastUpdated: Date.now() - 3 * 60 * 1000, // 3 minutes ago
  priceStale: false,
}

describe('FeeEstimateDialog', () => {
  it('renders estimated fee amount and disclaimer', () => {
    render(
      <FeeEstimateDialog
        open={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        fees={sampleFees}
        action="stream creation"
      />
    )

    expect(screen.getByText('Confirm transaction')).toBeInTheDocument()
    expect(screen.getByText('Total estimated fee')).toBeInTheDocument()
    expect(screen.getByText(/0\.0115000/)).toBeInTheDocument()
    expect(screen.getByText(/≈ \$0\.0138/)).toBeInTheDocument()
    expect(screen.getByText(/Price updated 3 min ago/)).toBeInTheDocument()
    expect(
      screen.getByText(/Disclaimer: Fee estimates and USD conversions are approximate\./)
    ).toBeInTheDocument()
  })

  it('indicates fallback price feed when price is stale', () => {
    const staleFees: FeeBreakdown = {
      ...sampleFees,
      priceLastUpdated: Date.now() - 10 * 60 * 1000,
      priceStale: true,
    }

    render(
      <FeeEstimateDialog
        open={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        fees={staleFees}
        action="batch execution"
      />
    )

    expect(screen.getByText(/Price updated 10 min ago \(fallback\)/)).toBeInTheDocument()
  })
})
