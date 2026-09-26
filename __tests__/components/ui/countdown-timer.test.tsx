import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { CountdownTimer } from '@/components/ui/countdown-timer'

// ─── time helpers ─────────────────────────────────────────────────────────────

const SECONDS_PER_DAY = 86_400
const SECONDS_PER_HOUR = 3_600
const SECONDS_PER_MINUTE = 60

/** Returns a frozen unix timestamp (seconds) so tests are deterministic. */
function frozenNow(): number {
  return Math.floor(Date.now() / 1000)
}

// ─── mock useNow to return a controllable value ───────────────────────────────

let mockNow = frozenNow()

vi.mock('@/hooks/use-now', () => ({
  useNow: () => mockNow,
}))

// ─── CountdownTimer ───────────────────────────────────────────────────────────

describe('CountdownTimer', () => {
  beforeEach(() => {
    // Reset to a stable "now" before every test
    mockNow = frozenNow()
  })

  // ─── far-future target ──────────────────────────────────────────────────────

  describe('far-future target (days away)', () => {
    it('shows remaining days when target is many days in the future', () => {
      const target = BigInt(mockNow + 5 * SECONDS_PER_DAY + 3 * SECONDS_PER_HOUR)
      render(<CountdownTimer target={target} />)
      expect(screen.getByText(/5d/)).toBeInTheDocument()
    })

    it('includes hours in the output alongside days', () => {
      const target = BigInt(mockNow + 5 * SECONDS_PER_DAY + 3 * SECONDS_PER_HOUR)
      render(<CountdownTimer target={target} />)
      expect(screen.getByText(/3h/)).toBeInTheDocument()
    })

    it('does not show the ended label for a far-future target', () => {
      const target = BigInt(mockNow + 10 * SECONDS_PER_DAY)
      render(<CountdownTimer target={target} />)
      expect(screen.queryByText('Ended')).not.toBeInTheDocument()
    })

    it('uses tabular-nums font-mono class for digit alignment', () => {
      const target = BigInt(mockNow + 2 * SECONDS_PER_DAY)
      render(<CountdownTimer target={target} />)
      const span = screen.getByText(/2d/)
      expect(span).toHaveClass('font-mono')
      expect(span).toHaveClass('tabular-nums')
    })
  })

  // ─── imminent target (seconds away) ────────────────────────────────────────

  describe('imminent target (seconds away)', () => {
    it('shows seconds when target is less than a minute away', () => {
      const target = BigInt(mockNow + 45)
      render(<CountdownTimer target={target} />)
      expect(screen.getByText(/45s/)).toBeInTheDocument()
    })

    it('shows minutes when target is a few minutes away', () => {
      const target = BigInt(mockNow + 7 * SECONDS_PER_MINUTE + 30)
      render(<CountdownTimer target={target} />)
      expect(screen.getByText(/7m/)).toBeInTheDocument()
    })

    it('shows hours and minutes when target is a couple of hours away', () => {
      const target = BigInt(mockNow + 2 * SECONDS_PER_HOUR + 15 * SECONDS_PER_MINUTE)
      render(<CountdownTimer target={target} />)
      expect(screen.getByText(/2h/)).toBeInTheDocument()
      expect(screen.getByText(/15m/)).toBeInTheDocument()
    })

    it('does not show the ended label when target is still in the future', () => {
      const target = BigInt(mockNow + 30)
      render(<CountdownTimer target={target} />)
      expect(screen.queryByText('Ended')).not.toBeInTheDocument()
    })
  })

  // ─── expired target ─────────────────────────────────────────────────────────

  describe('expired target (past timestamp)', () => {
    it('displays the default "Ended" label when target has passed', () => {
      const target = BigInt(mockNow - 60) // 1 minute in the past
      render(<CountdownTimer target={target} />)
      expect(screen.getByText('Ended')).toBeInTheDocument()
    })

    it('shows "Ended" when target equals now exactly', () => {
      const target = BigInt(mockNow)
      render(<CountdownTimer target={target} />)
      expect(screen.getByText('Ended')).toBeInTheDocument()
    })

    it('shows a custom endedLabel when provided', () => {
      const target = BigInt(mockNow - 1)
      render(<CountdownTimer target={target} endedLabel="Stream complete" />)
      expect(screen.getByText('Stream complete')).toBeInTheDocument()
    })

    it('does not show countdown text when expired', () => {
      const target = BigInt(mockNow - SECONDS_PER_DAY)
      render(<CountdownTimer target={target} />)
      // Must NOT render any day/hour/minute/second time parts
      expect(screen.queryByText(/\d+d/)).not.toBeInTheDocument()
      expect(screen.queryByText(/\d+h/)).not.toBeInTheDocument()
      expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()
    })
  })

  // ─── onStateChange callback ─────────────────────────────────────────────────

  describe('onStateChange callback', () => {
    it('does not call onStateChange on initial render when already active', () => {
      const onStateChange = vi.fn()
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<CountdownTimer target={target} onStateChange={onStateChange} />)
      expect(onStateChange).not.toHaveBeenCalled()
    })

    it('does not call onStateChange on initial render when already expired', () => {
      const onStateChange = vi.fn()
      const target = BigInt(mockNow - SECONDS_PER_HOUR)
      render(<CountdownTimer target={target} onStateChange={onStateChange} />)
      expect(onStateChange).not.toHaveBeenCalled()
    })

    it('fires onStateChange with "expired" when timer crosses zero', () => {
      const onStateChange = vi.fn()
      const target = BigInt(mockNow + 1) // currently active

      const { rerender } = render(
        <CountdownTimer target={target} onStateChange={onStateChange} />,
      )

      // Simulate time advancing past the target
      act(() => {
        mockNow = Number(target) + 1
      })

      rerender(<CountdownTimer target={target} onStateChange={onStateChange} />)

      expect(onStateChange).toHaveBeenCalledWith('expired')
    })
  })

  // ─── className prop ─────────────────────────────────────────────────────────

  describe('className prop', () => {
    it('applies a custom className', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<CountdownTimer target={target} className="text-red-500" />)
      const span = screen.getByText(/\d+h/)
      expect(span).toHaveClass('text-red-500')
    })

    it('preserves built-in font-mono class when custom className is added', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<CountdownTimer target={target} className="custom" />)
      const span = screen.getByText(/\d+h/)
      expect(span).toHaveClass('font-mono')
      expect(span).toHaveClass('custom')
    })
  })

  // ─── renders as <span> ──────────────────────────────────────────────────────

  it('renders as a <span> element', () => {
    const target = BigInt(mockNow + SECONDS_PER_HOUR)
    const { container } = render(<CountdownTimer target={target} />)
    expect(container.querySelector('span')).toBeInTheDocument()
  })
})
