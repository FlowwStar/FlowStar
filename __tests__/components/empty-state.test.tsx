import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyStreams } from '@/components/streams/empty-state'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('EmptyStreams', () => {
  it('renders the default title and description', () => {
    render(<EmptyStreams />)
    expect(screen.getByText('No streams yet')).toBeInTheDocument()
    expect(
      screen.getByText(/Create your first stream to start sending tokens that unlock in real time/),
    ).toBeInTheDocument()
  })

  it('renders a custom title', () => {
    render(<EmptyStreams title="No results" />)
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  it('renders a custom description', () => {
    render(<EmptyStreams description="Nothing to show right now." />)
    expect(screen.getByText('Nothing to show right now.')).toBeInTheDocument()
  })

  it('shows the create button by default', () => {
    render(<EmptyStreams />)
    const button = screen.getByRole('link', { name: /create a stream/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('href', '/app/create')
  })

  it('hides the create button when showCreate is false', () => {
    render(<EmptyStreams showCreate={false} />)
    expect(screen.queryByRole('link', { name: /create a stream/i })).not.toBeInTheDocument()
  })
})
