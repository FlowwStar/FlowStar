import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreamStatusBadge } from '@/components/streams/stream-status-badge'
import type { StreamStatus } from '@/types/stream'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the outer badge <span> for a given status.
 * We query by the label text — for "streaming" the outer span also contains
 * the pulse-dot child span, so we walk up to the first <span> ancestor that
 * carries the base layout class.
 */
function getBadge(status: StreamStatus): HTMLElement {
  const labels: Record<StreamStatus, string> = {
    streaming: 'Streaming',
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  // getByText with exact:false finds the deepest node whose text content
  // includes the label.  closest('span') gives us the wrapping badge element.
  return screen.getByText(labels[status], { exact: false }).closest('span') as HTMLElement
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StreamStatusBadge', () => {
  // ── Label text ─────────────────────────────────────────────────────────────

  it('renders label "Streaming" for status streaming', () => {
    render(<StreamStatusBadge status="streaming" />)
    expect(screen.getByText('Streaming')).toBeInTheDocument()
  })

  it('renders label "Scheduled" for status scheduled', () => {
    render(<StreamStatusBadge status="scheduled" />)
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
  })

  it('renders label "Completed" for status completed', () => {
    render(<StreamStatusBadge status="completed" />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('renders label "Cancelled" for status cancelled', () => {
    render(<StreamStatusBadge status="cancelled" />)
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  // ── Colour / style classes per status ──────────────────────────────────────

  it('streaming: badge has bg-primary/10 and text-primary classes', () => {
    render(<StreamStatusBadge status="streaming" />)
    const badge = getBadge('streaming')
    expect(badge).toHaveClass('bg-primary/10')
    expect(badge).toHaveClass('text-primary')
  })

  it('scheduled: badge has bg-chart-3/15 and text-chart-2 classes', () => {
    render(<StreamStatusBadge status="scheduled" />)
    const badge = getBadge('scheduled')
    expect(badge).toHaveClass('bg-chart-3/15')
    expect(badge).toHaveClass('text-chart-2')
  })

  it('completed: badge has bg-secondary and text-muted-foreground classes', () => {
    render(<StreamStatusBadge status="completed" />)
    const badge = getBadge('completed')
    expect(badge).toHaveClass('bg-secondary')
    expect(badge).toHaveClass('text-muted-foreground')
  })

  it('cancelled: badge has bg-destructive/15 and text-destructive classes', () => {
    render(<StreamStatusBadge status="cancelled" />)
    const badge = getBadge('cancelled')
    expect(badge).toHaveClass('bg-destructive/15')
    expect(badge).toHaveClass('text-destructive')
  })

  // ── Base layout classes present on every status ────────────────────────────

  it.each<StreamStatus>(['streaming', 'scheduled', 'completed', 'cancelled'])(
    'status "%s" always carries rounded-full, text-xs, and font-medium',
    (status) => {
      render(<StreamStatusBadge status={status} />)
      const badge = getBadge(status)
      expect(badge).toHaveClass('rounded-full')
      expect(badge).toHaveClass('text-xs')
      expect(badge).toHaveClass('font-medium')
    },
  )

  // ── Animated pulse dot — only present for "streaming" ─────────────────────

  it('streaming: renders an animate-pulse dot inside the badge', () => {
    const { container } = render(<StreamStatusBadge status="streaming" />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it.each<StreamStatus>(['scheduled', 'completed', 'cancelled'])(
    'status "%s": does NOT render an animate-pulse dot',
    (status) => {
      const { container } = render(<StreamStatusBadge status={status} />)
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
    },
  )

  // ── className prop forwarding ──────────────────────────────────────────────

  it('forwards an extra className onto the badge element', () => {
    render(<StreamStatusBadge status="completed" className="mt-2 extra-class" />)
    const badge = getBadge('completed')
    expect(badge).toHaveClass('mt-2')
    expect(badge).toHaveClass('extra-class')
  })

  it('base classes are preserved when a custom className is supplied', () => {
    render(<StreamStatusBadge status="cancelled" className="custom" />)
    const badge = getBadge('cancelled')
    expect(badge).toHaveClass('rounded-full')
    expect(badge).toHaveClass('bg-destructive/15')
  })

  it('renders without a className prop without throwing', () => {
    expect(() => render(<StreamStatusBadge status="scheduled" />)).not.toThrow()
  })
})
