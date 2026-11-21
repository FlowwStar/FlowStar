import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { AccessibleCountdownTimer } from '@/components/ui/accessible-countdown-timer'

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

// ─── AccessibleCountdownTimer ─────────────────────────────────────────────────

describe('AccessibleCountdownTimer', () => {
  beforeEach(() => {
    // Reset to a stable "now" before every test
    mockNow = frozenNow()
  })

  // ─── display text ───────────────────────────────────────────────────────────

  describe('display text (active timer)', () => {
    it('shows remaining days when target is many days in the future', () => {
      const target = BigInt(mockNow + 5 * SECONDS_PER_DAY + 3 * SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.getByText(/5d/)).toBeInTheDocument()
    })

    it('includes hours alongside days in the output', () => {
      const target = BigInt(mockNow + 5 * SECONDS_PER_DAY + 3 * SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.getByText(/3h/)).toBeInTheDocument()
    })

    it('shows seconds when target is less than a minute away', () => {
      const target = BigInt(mockNow + 45)
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.getByText(/45s/)).toBeInTheDocument()
    })

    it('shows minutes when target is a few minutes away', () => {
      const target = BigInt(mockNow + 7 * SECONDS_PER_MINUTE + 30)
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.getByText(/7m/)).toBeInTheDocument()
    })

    it('does not show the ended label for a future target', () => {
      const target = BigInt(mockNow + 10 * SECONDS_PER_DAY)
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.queryByText('Ended')).not.toBeInTheDocument()
    })

    it('uses font-mono tabular-nums classes for digit alignment', () => {
      const target = BigInt(mockNow + 2 * SECONDS_PER_DAY)
      render(<AccessibleCountdownTimer target={target} />)
      const span = screen.getByText(/2d/)
      expect(span).toHaveClass('font-mono')
      expect(span).toHaveClass('tabular-nums')
    })

    it('applies a custom className to the display span', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} className="text-green-500" />)
      const span = screen.getByText(/\d+h/)
      expect(span).toHaveClass('text-green-500')
    })
  })

  // ─── expired target ─────────────────────────────────────────────────────────

  describe('expired target (past timestamp)', () => {
    it('displays the default "Ended" label when target has passed', () => {
      const target = BigInt(mockNow - 60)
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.getByText('Ended')).toBeInTheDocument()
    })

    it('shows "Ended" when target equals now exactly', () => {
      const target = BigInt(mockNow)
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.getByText('Ended')).toBeInTheDocument()
    })

    it('shows a custom endedLabel when provided', () => {
      const target = BigInt(mockNow - 1)
      render(<AccessibleCountdownTimer target={target} endedLabel="Stream complete" />)
      expect(screen.getByText('Stream complete')).toBeInTheDocument()
    })

    it('does not show countdown text when expired', () => {
      const target = BigInt(mockNow - SECONDS_PER_DAY)
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.queryByText(/\d+d/)).not.toBeInTheDocument()
      expect(screen.queryByText(/\d+h/)).not.toBeInTheDocument()
      expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument()
    })
  })

  // ─── aria-label on display span ─────────────────────────────────────────────

  describe('aria-label on display span', () => {
    it('includes "Time remaining:" in aria-label when active', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)
      const span = screen.getByText(/\d+h/)
      expect(span).toHaveAttribute('aria-label')
      expect(span.getAttribute('aria-label')).toMatch(/time remaining:/i)
    })

    it('has aria-live="off" on the display span', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)
      const span = screen.getByText(/\d+h/)
      expect(span).toHaveAttribute('aria-live', 'off')
    })

    it('sets aria-label to ended label when expired', () => {
      const target = BigInt(mockNow - 60)
      render(<AccessibleCountdownTimer target={target} endedLabel="Done" />)
      const span = screen.getByText('Done')
      expect(span.getAttribute('aria-label')).toMatch(/Done/)
    })
  })

  // ─── live announcement region ───────────────────────────────────────────────

  describe('live announcement region', () => {
    it('renders a region with role="status"', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('status region has aria-live="polite"', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)
      const region = screen.getByRole('status')
      expect(region).toHaveAttribute('aria-live', 'polite')
    })

    it('status region has aria-atomic="true"', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)
      const region = screen.getByRole('status')
      expect(region).toHaveAttribute('aria-atomic', 'true')
    })

    it('status region is visually hidden via sr-only class', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)
      const region = screen.getByRole('status')
      expect(region).toHaveClass('sr-only')
    })

    it('starts with empty announcement text', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.getByRole('status').textContent).toBe('')
    })

    it('populates announcement when timer transitions from active to expired', () => {
      const onStateChange = vi.fn()
      const target = BigInt(mockNow + 1) // active

      const { rerender } = render(
        <AccessibleCountdownTimer target={target} onStateChange={onStateChange} />,
      )

      // Simulate time advancing past the target
      act(() => {
        mockNow = Number(target) + 1
      })

      rerender(<AccessibleCountdownTimer target={target} onStateChange={onStateChange} />)

      const region = screen.getByRole('status')
      expect(region.textContent).toMatch(/countdown finished/i)
    })

    it('uses custom endedLabel in the expiry announcement', () => {
      const target = BigInt(mockNow + 1)

      const { rerender } = render(
        <AccessibleCountdownTimer target={target} endedLabel="Vesting complete" />,
      )

      act(() => {
        mockNow = Number(target) + 1
      })

      rerender(<AccessibleCountdownTimer target={target} endedLabel="Vesting complete" />)

      const region = screen.getByRole('status')
      expect(region.textContent).toContain('Vesting complete')
    })

    it('populates announcement when button is clicked', async () => {
      const user = userEvent.setup()
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)

      const btn = screen.getByRole('button', { name: /announce current time remaining/i })
      await user.click(btn)

      const region = screen.getByRole('status')
      expect(region.textContent).toMatch(/time remaining:/i)
    })
  })

  // ─── announce button ─────────────────────────────────────────────────────────

  describe('announce button', () => {
    it('renders the announce button by default', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)
      expect(
        screen.getByRole('button', { name: /announce current time remaining/i }),
      ).toBeInTheDocument()
    })

    it('hides the announce button when hideButton is true', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} hideButton />)
      expect(
        screen.queryByRole('button', { name: /announce current time remaining/i }),
      ).not.toBeInTheDocument()
    })

    it('button title describes its purpose', () => {
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} />)
      const btn = screen.getByRole('button', { name: /announce current time remaining/i })
      expect(btn).toHaveAttribute('title')
    })

    it('announcement says "Ended" when timer expired and button clicked', async () => {
      const user = userEvent.setup()
      const target = BigInt(mockNow - 60)
      render(<AccessibleCountdownTimer target={target} endedLabel="Ended" />)

      const btn = screen.getByRole('button', { name: /announce current time remaining/i })
      await user.click(btn)

      const region = screen.getByRole('status')
      expect(region.textContent).toContain('Ended')
    })
  })

  // ─── onStateChange callback ─────────────────────────────────────────────────

  describe('onStateChange callback', () => {
    it('does not call onStateChange on initial render when already active', () => {
      const onStateChange = vi.fn()
      const target = BigInt(mockNow + SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} onStateChange={onStateChange} />)
      expect(onStateChange).not.toHaveBeenCalled()
    })

    it('does not call onStateChange on initial render when already expired', () => {
      const onStateChange = vi.fn()
      const target = BigInt(mockNow - SECONDS_PER_HOUR)
      render(<AccessibleCountdownTimer target={target} onStateChange={onStateChange} />)
      expect(onStateChange).not.toHaveBeenCalled()
    })

    it('fires onStateChange with "expired" when timer crosses zero', () => {
      const onStateChange = vi.fn()
      const target = BigInt(mockNow + 1) // currently active

      const { rerender } = render(
        <AccessibleCountdownTimer target={target} onStateChange={onStateChange} />,
      )

      act(() => {
        mockNow = Number(target) + 1
      })

      rerender(<AccessibleCountdownTimer target={target} onStateChange={onStateChange} />)

      expect(onStateChange).toHaveBeenCalledWith('expired')
      expect(onStateChange).toHaveBeenCalledTimes(1)
    })
  })
})
