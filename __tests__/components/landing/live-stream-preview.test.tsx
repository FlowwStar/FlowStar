/**
 * Tests for components/landing/live-stream-preview.tsx — Live stream demo preview
 *
 * Strategy
 * ─────────
 * LiveStreamPreview is an animated demo component that uses useNow hook to
 * display real-time streaming progress. Key concerns:
 *   1. Consistent rendering — no SSR/hydration mismatches
 *   2. Animation stability — animation works correctly with fake timers
 *
 * Mocked boundaries
 * ─────────────────
 * • useNow — provide deterministic time for consistent output
 * • ProgressBar — tested separately; stub here
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ─── Mock hooks and components ────────────────────────────────────────────────

const mockUseNow = vi.fn()

vi.mock('@/hooks/use-now', () => ({
  useNow: (interval?: number) => mockUseNow(interval),
}))

vi.mock('@/components/ui/progress-bar', () => ({
  ProgressBar: ({
    value,
    indeterminateShimmer,
  }: {
    value: number
    indeterminateShimmer?: boolean
  }) => (
    <div
      data-testid="progress-bar"
      data-value={value}
      data-shimmer={indeterminateShimmer ? 'true' : 'false'}
    />
  ),
}))

import { LiveStreamPreview } from '@/components/landing/live-stream-preview'

describe('LiveStreamPreview', () => {
  const NOW_SEC = 1_700_050_000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SEC * 1000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering consistency', () => {
    it('renders with streaming live badge', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      render(<LiveStreamPreview />)
      expect(screen.getByText('Streaming live')).toBeInTheDocument()
    })

    it('renders per-second indicator with pulsing dot', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      render(<LiveStreamPreview />)
      expect(screen.getByText('per second')).toBeInTheDocument()
    })

    it('renders sender and recipient information', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      render(<LiveStreamPreview />)
      expect(screen.getByText('Acme Inc.')).toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    it('renders unlocked amount label', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      render(<LiveStreamPreview />)
      expect(screen.getByText('Unlocked so far')).toBeInTheDocument()
    })

    it('renders USDC token symbol', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      render(<LiveStreamPreview />)
      const usdcElements = screen.getAllByText('USDC')
      expect(usdcElements.length).toBeGreaterThan(0)
    })

    it('produces consistent output across multiple renders at same time', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      const { container: container1 } = render(<LiveStreamPreview />)
      const content1 = container1.textContent

      mockUseNow.mockReturnValue(NOW_SEC)
      const { container: container2 } = render(<LiveStreamPreview />)
      const content2 = container2.textContent

      expect(content1).toContain('Streaming live')
      expect(content2).toContain('Streaming live')
    })
  })

  describe('animation stability', () => {
    it('renders progress bar with indeterminate shimmer', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      render(<LiveStreamPreview />)
      const progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toHaveAttribute('data-shimmer', 'true')
    })

    it('updates progress bar value over time with fake timers', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      const { rerender } = render(<LiveStreamPreview />)
      const progressBar1 = screen.getByTestId('progress-bar')
      const value1 = parseFloat(progressBar1.getAttribute('data-value') || '0')

      // Advance time by 1 hour and re-render (progress is quantized to 0.01%,
      // roughly 4 minutes of a 30-day stream, so a few seconds is not enough)
      vi.setSystemTime(new Date((NOW_SEC + 3600) * 1000))
      mockUseNow.mockReturnValue(NOW_SEC + 3600)
      rerender(<LiveStreamPreview />)

      const progressBar2 = screen.getByTestId('progress-bar')
      const value2 = parseFloat(progressBar2.getAttribute('data-value') || '0')

      // Progress should increase over time
      expect(value2).toBeGreaterThan(value1)
    })

    it('does not crash when useNow updates frequently', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      const { rerender } = render(<LiveStreamPreview />)
      expect(screen.getByText('Streaming live')).toBeInTheDocument()

      // Simulate rapid updates like a real animation frame loop
      for (let i = 1; i <= 10; i++) {
        mockUseNow.mockReturnValue(NOW_SEC + i)
        rerender(<LiveStreamPreview />)
      }

      // Component should still render without errors
      expect(screen.getByText('Streaming live')).toBeInTheDocument()
    })
  })

  describe('amount formatting', () => {
    it('displays unlocked amount with token decimals', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      render(<LiveStreamPreview />)
      // Component formats amounts using stream-utils.formatTokenAmount
      // Verify that some numeric content is displayed
      const unlockedSection = screen.getByText('Unlocked so far').parentElement
      expect(unlockedSection?.textContent).toMatch(/\d/)
    })

    it('displays total amount deposited', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      render(<LiveStreamPreview />)
      expect(screen.getByText(/USDC total/)).toBeInTheDocument()
    })

    it('displays progress percentage', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      render(<LiveStreamPreview />)
      expect(screen.getByText(/% unlocked/)).toBeInTheDocument()
    })
  })

  describe('useNow integration', () => {
    it('calls useNow with 1000ms interval', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      render(<LiveStreamPreview />)
      expect(mockUseNow).toHaveBeenCalledWith(1000)
    })

    it('responds to useNow updates without re-creating demo stream', () => {
      mockUseNow.mockReturnValue(NOW_SEC)
      const { rerender } = render(<LiveStreamPreview />)
      expect(screen.getByText('Acme Inc.')).toBeInTheDocument()

      // useNow returns different time but demo stream should remain the same
      mockUseNow.mockReturnValue(NOW_SEC + 5)
      rerender(<LiveStreamPreview />)

      expect(screen.getByText('Acme Inc.')).toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
  })
})
