import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreamStatusBadge } from '@/components/streams/stream-status-badge'
import type { StreamStatus } from '@/types/stream'

describe('StreamStatusBadge', () => {
  it('renders "Streaming" label for streaming status', () => {
    render(<StreamStatusBadge status="streaming" />)
    expect(screen.getByText('Streaming')).toBeInTheDocument()
  })

  it('renders "Scheduled" label for scheduled status', () => {
    render(<StreamStatusBadge status="scheduled" />)
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
  })

  it('renders "Completed" label for completed status', () => {
    render(<StreamStatusBadge status="completed" />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('renders "Cancelled" label for cancelled status', () => {
    render(<StreamStatusBadge status="cancelled" />)
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('renders a pulsing dot for streaming status', () => {
    const { container } = render(<StreamStatusBadge status="streaming" />)
    const dot = container.querySelector('span.animate-pulse')
    expect(dot).toBeInTheDocument()
    expect(dot?.className).toContain('size-1.5')
  })

  it('does not render a pulsing dot for non-streaming statuses', () => {
    const statuses: StreamStatus[] = ['scheduled', 'completed', 'cancelled']
    statuses.forEach((status) => {
      const { container } = render(<StreamStatusBadge status={status} />)
      const dot = container.querySelector('span.animate-pulse')
      expect(dot).not.toBeInTheDocument()
    })
  })

  it('applies custom className to the badge', () => {
    const { container } = render(<StreamStatusBadge status="streaming" className="custom-class" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('custom-class')
  })

  it('applies the correct styling for each status', () => {
    const statusStyles: Record<StreamStatus, { bgColor: string; textColor: string }> = {
      streaming: { bgColor: 'bg-primary/10', textColor: 'text-primary' },
      scheduled: { bgColor: 'bg-chart-3/15', textColor: 'text-chart-2' },
      completed: { bgColor: 'bg-secondary', textColor: 'text-muted-foreground' },
      cancelled: { bgColor: 'bg-destructive/15', textColor: 'text-destructive' },
    }

    Object.entries(statusStyles).forEach(([status, { bgColor, textColor }]) => {
      const { container } = render(<StreamStatusBadge status={status as StreamStatus} />)
      const badge = container.querySelector('span')
      expect(badge?.className).toContain(bgColor)
      expect(badge?.className).toContain(textColor)
    })
  })

  it('renders with base styles applied', () => {
    const { container } = render(<StreamStatusBadge status="streaming" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('inline-flex')
    expect(badge?.className).toContain('items-center')
    expect(badge?.className).toContain('gap-1.5')
    expect(badge?.className).toContain('rounded-full')
    expect(badge?.className).toContain('px-2.5')
    expect(badge?.className).toContain('py-1')
    expect(badge?.className).toContain('text-xs')
    expect(badge?.className).toContain('font-medium')
  })
})
