import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccessibleUnlockAmount } from '@/components/ui/accessible-unlock-amount'

describe('AccessibleUnlockAmount', () => {
  it('renders the unlocked amount and symbol', () => {
    render(<AccessibleUnlockAmount amount={100_000_000n} decimals={7} symbol="USDC" />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('USDC')).toBeInTheDocument()
  })

  it('sets an aria-label describing the unlocked amount', () => {
    render(<AccessibleUnlockAmount amount={100_000_000n} decimals={7} symbol="USDC" />)
    expect(screen.getByLabelText('10 USDC unlocked')).toBeInTheDocument()
  })

  it('renders the display with aria-live off to avoid announcement spam', () => {
    render(<AccessibleUnlockAmount amount={100_000_000n} decimals={7} symbol="USDC" />)
    expect(screen.getByLabelText('10 USDC unlocked')).toHaveAttribute('aria-live', 'off')
  })

  it('announces the current amount on demand when the button is clicked', () => {
    render(<AccessibleUnlockAmount amount={100_000_000n} decimals={7} symbol="USDC" />)
    fireEvent.click(screen.getByRole('button', { name: 'Announce current unlocked amount' }))
    expect(screen.getByRole('status')).toHaveTextContent('Current unlocked amount: 10 USDC')
  })

  it('includes the change relative to the previous amount when announcing', () => {
    render(
      <AccessibleUnlockAmount
        amount={100_000_000n}
        previousAmount={90_000_000n}
        decimals={7}
        symbol="USDC"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Announce current unlocked amount' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Current unlocked amount: 10 USDC (change: 1 USDC)',
    )
  })

  it('hides the announce button when hideButton is true', () => {
    render(<AccessibleUnlockAmount amount={100_000_000n} decimals={7} symbol="USDC" hideButton />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('announces and reports a cliff-reached state change', () => {
    const onStateChange = vi.fn()
    const { rerender } = render(
      <AccessibleUnlockAmount
        amount={100_000_000n}
        decimals={7}
        symbol="USDC"
        isCliffReached={false}
        onStateChange={onStateChange}
      />,
    )

    rerender(
      <AccessibleUnlockAmount
        amount={100_000_000n}
        decimals={7}
        symbol="USDC"
        isCliffReached
        onStateChange={onStateChange}
      />,
    )

    expect(onStateChange).toHaveBeenCalledWith('cliff-reached')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Cliff period ended. 10 USDC now available.',
    )
  })

  it('announces and reports a completed state change', () => {
    const onStateChange = vi.fn()
    const { rerender } = render(
      <AccessibleUnlockAmount
        amount={100_000_000n}
        decimals={7}
        symbol="USDC"
        isCompleted={false}
        onStateChange={onStateChange}
      />,
    )

    rerender(
      <AccessibleUnlockAmount
        amount={100_000_000n}
        decimals={7}
        symbol="USDC"
        isCompleted
        onStateChange={onStateChange}
      />,
    )

    expect(onStateChange).toHaveBeenCalledWith('completed')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Stream completed. Total unlocked: 10 USDC.',
    )
  })
})
