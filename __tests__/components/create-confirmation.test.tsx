import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreateConfirmation } from '@/components/streams/create-confirmation'
import type { TokenInfo } from '@/types/stream'

vi.mock('@/lib/stream-utils', () => ({
  formatDateTime: (t: bigint) => `DATE(${t})`,
  formatTokenAmount: (raw: bigint, decimals: number) => `${raw}@${decimals}`,
  formatRate: (amountPerSecond: bigint, decimals: number, symbol: string) => ({
    perDay: `${amountPerSecond}@${decimals} ${symbol}/day`,
  }),
  shortenAddress: (address: string) => `SHORT(${address})`,
}))

vi.mock('@/lib/fee-utils', () => ({
  calculateFeeBreakdown: (minFee: number) => ({
    minFee,
    bufferFee: 15,
    totalEstimated: minFee + 15,
  }),
  TYPICAL_FEES: { createStream: { typical: 80000 } },
}))

vi.mock('@/hooks/use-token-price', () => ({
  useTokenPrice: () => ({ usdPrice: 0.1 }),
}))

const TOKEN: TokenInfo = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }

function baseProps(overrides?: Partial<React.ComponentProps<typeof CreateConfirmation>>) {
  return {
    open: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    pending: false,
    feeEstimate: null,
    recipient: 'GRECIPIENT222222222222222222222222222222222222',
    token: TOKEN,
    totalAmount: 1_000_000_000n,
    startTime: 1_700_000_000n,
    endTime: 1_700_086_400n,
    cliffTime: 1_700_000_000n,
    cliffAmount: 0n,
    amountPerSecond: 11_574n,
    ...overrides,
  }
}

describe('CreateConfirmation', () => {
  it('renders the confirmation summary for a representative stream', () => {
    render(<CreateConfirmation {...baseProps()} />)

    expect(screen.getByText('Confirm stream creation')).toBeInTheDocument()
    expect(
      screen.getByText('SHORT(GRECIPIENT222222222222222222222222222222222222)'),
    ).toBeInTheDocument()
    expect(screen.getByText('USDC')).toBeInTheDocument()
    expect(screen.getByText('1000000000@7 USDC')).toBeInTheDocument()
    expect(screen.getByText('11574@7 USDC/day')).toBeInTheDocument()
    expect(screen.getByText('DATE(1700000000)')).toBeInTheDocument()
    expect(screen.getByText('DATE(1700086400)')).toBeInTheDocument()
  })

  it('does not show a cliff row when the cliff is at the start time', () => {
    render(<CreateConfirmation {...baseProps({ cliffTime: 1_700_000_000n })} />)
    expect(screen.queryByText('Cliff')).not.toBeInTheDocument()
  })

  it('shows the cliff row with its amount when the cliff is after the start time', () => {
    render(
      <CreateConfirmation
        {...baseProps({ cliffTime: 1_700_003_600n, cliffAmount: 50_000_000n })}
      />,
    )
    expect(screen.getByText('Cliff')).toBeInTheDocument()
    expect(screen.getByText('DATE(1700003600)')).toBeInTheDocument()
    expect(screen.getByText(/50000000@7/)).toBeInTheDocument()
  })

  it('renders the network fee breakdown', () => {
    render(<CreateConfirmation {...baseProps({ feeEstimate: '0.008' })} />)
    // 0.008 XLM * 1e7 = 80000 stroops -> total 80015 stroops
    expect(screen.getByText('0.0080000 XLM')).toBeInTheDocument()
    expect(screen.getByText('0.0000015 XLM')).toBeInTheDocument()
    expect(screen.getByText('0.0080015 XLM')).toBeInTheDocument()
  })

  it('calls onConfirm when "Confirm & sign" is clicked', () => {
    const onConfirm = vi.fn()
    render(<CreateConfirmation {...baseProps({ onConfirm })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & sign' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when "Back" is clicked', () => {
    const onCancel = vi.fn()
    render(<CreateConfirmation {...baseProps({ onCancel })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('disables actions and shows a pending label while pending', () => {
    render(<CreateConfirmation {...baseProps({ pending: true })} />)
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  })
})
