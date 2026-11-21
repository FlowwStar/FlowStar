import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Brand, APP_NAME } from '@/components/brand'

// Next.js Link → plain anchor so href assertions work in jsdom
vi.mock('next/link', () => ({
  default: ({ href, children, className, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}))

// lucide-react Waves → simple svg stub
vi.mock('lucide-react', () => ({
  Waves: ({ className, strokeWidth }: any) => (
    <svg data-testid="waves-icon" className={className} strokeWidth={strokeWidth} />
  ),
}))

describe('Brand', () => {
  // ─── smoke test ────────────────────────────────────────────────────────────

  it('renders the logo icon', () => {
    render(<Brand />)
    expect(screen.getByTestId('waves-icon')).toBeInTheDocument()
  })

  it('renders the wordmark text by default', () => {
    render(<Brand />)
    expect(screen.getByText(APP_NAME)).toBeInTheDocument()
  })

  it('wraps everything in an anchor tag', () => {
    render(<Brand />)
    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  // ─── href prop ─────────────────────────────────────────────────────────────

  it('defaults href to "/"', () => {
    render(<Brand />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/')
  })

  it('uses a custom href when provided', () => {
    render(<Brand href="/app" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/app')
  })

  // ─── showWordmark prop ──────────────────────────────────────────────────────

  it('hides the wordmark when showWordmark=false', () => {
    render(<Brand showWordmark={false} />)
    expect(screen.queryByText(APP_NAME)).not.toBeInTheDocument()
  })

  it('shows the wordmark when showWordmark=true (explicit)', () => {
    render(<Brand showWordmark={true} />)
    expect(screen.getByText(APP_NAME)).toBeInTheDocument()
  })

  it('still renders the icon when wordmark is hidden', () => {
    render(<Brand showWordmark={false} />)
    expect(screen.getByTestId('waves-icon')).toBeInTheDocument()
  })

  // ─── className prop ─────────────────────────────────────────────────────────

  it('applies a custom className to the root link', () => {
    render(<Brand className="my-custom-class" />)
    expect(screen.getByRole('link')).toHaveClass('my-custom-class')
  })

  it('merges custom className with default layout classes', () => {
    render(<Brand className="extra" />)
    const link = screen.getByRole('link')
    expect(link).toHaveClass('flex')
    expect(link).toHaveClass('items-center')
    expect(link).toHaveClass('extra')
  })

  // ─── APP_NAME constant ──────────────────────────────────────────────────────

  it('exports APP_NAME as "FlowStar"', () => {
    expect(APP_NAME).toBe('FlowStar')
  })

  // ─── icon container styling ─────────────────────────────────────────────────

  it('renders the icon inside a rounded container with primary bg', () => {
    const { container } = render(<Brand />)
    const iconWrapper = container.querySelector('.bg-primary')
    expect(iconWrapper).toBeInTheDocument()
    expect(iconWrapper).toHaveClass('rounded-lg')
  })

  // ─── wordmark typography ────────────────────────────────────────────────────

  it('renders wordmark with tracking-tight class', () => {
    render(<Brand />)
    const wordmark = screen.getByText(APP_NAME)
    expect(wordmark).toHaveClass('tracking-tight')
  })

  // ─── accessibility ──────────────────────────────────────────────────────────

  it('the root element is a link (accessible via role)', () => {
    render(<Brand />)
    const link = screen.getByRole('link')
    expect(link.tagName.toLowerCase()).toBe('a')
  })

  it('renders a single link — no duplicate anchors', () => {
    render(<Brand />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})
