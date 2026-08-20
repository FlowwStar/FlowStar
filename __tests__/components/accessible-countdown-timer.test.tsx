import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AccessibleCountdownTimer } from '@/components/ui/accessible-countdown-timer'

// Fixed "now" for deterministic tests.
const NOW_MS = Date.UTC(2024, 0, 1, 0, 0, 0) // 2024-01-01T00:00:00Z
const NOW_S = Math.floor(NOW_MS / 1000)

describe('AccessibleCountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_MS))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendered time text', () => {
    it('renders the formatted remaining time for an active timer', () => {
      const target = BigInt(NOW_S + 60) // 1 minute remaining
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.getByText(/1m 0s/)).toBeInTheDocument()
    })

    it('renders the default ended label once the target is reached', () => {
      const target = BigInt(NOW_S - 1) // already in the past
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.getByText('Ended')).toBeInTheDocument()
    })

    it('renders a custom endedLabel', () => {
      render(<AccessibleCountdownTimer target={BigInt(NOW_S)} endedLabel="Stream over" />)
      expect(screen.getByText('Stream over')).toBeInTheDocument()
    })
  })

  describe('ARIA live-region attributes', () => {
    it('sets aria-live="off" on the time display to avoid announcement spam', () => {
      render(<AccessibleCountdownTimer target={BigInt(NOW_S + 60)} />)
      const display = screen.getByLabelText(/^Time remaining:/)
      expect(display).toHaveAttribute('aria-live', 'off')
    })

    it('exposes an explicit aria-label with the remaining time', () => {
      const target = BigInt(NOW_S + 60)
      const remaining = '1m 0s'
      render(<AccessibleCountdownTimer target={target} />)
      expect(screen.getByLabelText(`Time remaining: ${remaining}`)).toBeInTheDocument()
    })

    it('uses the ended label in the aria-label when expired', () => {
      render(<AccessibleCountdownTimer target={BigInt(NOW_S - 1)} endedLabel="Stream over" />)
      expect(screen.getByLabelText('Time remaining: Stream over')).toBeInTheDocument()
    })

    it('renders a polite live region for on-demand announcements', () => {
      render(<AccessibleCountdownTimer target={BigInt(NOW_S + 60)} />)
      const region = screen.getByRole('status')
      expect(region).toHaveAttribute('aria-live', 'polite')
      expect(region).toHaveAttribute('aria-atomic', 'true')
      expect(region).toHaveClass('sr-only')
    })

    it('announces the current time when the read button is clicked', () => {
      const target = BigInt(NOW_S + 60)
      render(<AccessibleCountdownTimer target={target} />)

      const button = screen.getByRole('button', { name: /announce current time/i })
      fireEvent.click(button)

      expect(screen.getByRole('status')).toHaveTextContent('Time remaining: 1m 0s')
    })
  })

  describe('read button', () => {
    it('renders an accessible announce button by default', () => {
      render(<AccessibleCountdownTimer target={BigInt(NOW_S + 60)} />)
      const button = screen.getByRole('button', { name: /announce current time/i })
      expect(button).toHaveAttribute('aria-label', 'Announce current time remaining')
    })

    it('is hidden when hideButton is true', () => {
      render(<AccessibleCountdownTimer target={BigInt(NOW_S + 60)} hideButton />)
      expect(
        screen.queryByRole('button', { name: /announce current time/i }),
      ).not.toBeInTheDocument()
    })
  })

  describe('state transitions', () => {
    it('reports an expired state change when the timer elapses', () => {
      const onStateChange = vi.fn()
      const target = BigInt(NOW_S + 5) // elapses 5 seconds after mount

      render(<AccessibleCountdownTimer target={target} onStateChange={onStateChange} />)
      expect(onStateChange).not.toHaveBeenCalled()

      // The useNow(1000) interval ticks past the target.
      act(() => {
        vi.advanceTimersByTime(6000)
      })

      expect(onStateChange).toHaveBeenCalledWith('expired')
    })

    it('does not fire onStateChange for an expired target on initial mount', () => {
      const onStateChange = vi.fn()
      render(<AccessibleCountdownTimer target={BigInt(NOW_S - 10)} onStateChange={onStateChange} />)
      // Initial mount should not fire onStateChange (same state on first render).
      expect(onStateChange).not.toHaveBeenCalled()
    })
  })
})
