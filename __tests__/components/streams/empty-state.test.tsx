import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyStreams } from '@/components/streams/empty-state'

describe('EmptyStreams', () => {
  it('renders default title and description', () => {
    render(<EmptyStreams />)
    expect(screen.getByText('No streams yet')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Create your first stream to start sending tokens that unlock in real time.',
      ),
    ).toBeInTheDocument()
  })

  it('renders custom title when provided', () => {
    const customTitle = 'Custom Title'
    render(<EmptyStreams title={customTitle} />)
    expect(screen.getByText(customTitle)).toBeInTheDocument()
  })

  it('renders custom description when provided', () => {
    const customDescription = 'Custom Description'
    render(<EmptyStreams description={customDescription} />)
    expect(screen.getByText(customDescription)).toBeInTheDocument()
  })

  it('renders both custom title and description', () => {
    const customTitle = 'My Custom Title'
    const customDescription = 'My Custom Description'
    render(<EmptyStreams title={customTitle} description={customDescription} />)
    expect(screen.getByText(customTitle)).toBeInTheDocument()
    expect(screen.getByText(customDescription)).toBeInTheDocument()
  })

  it('renders the "Create a stream" button by default', () => {
    render(<EmptyStreams />)
    expect(screen.getByRole('link', { name: /create a stream/i })).toBeInTheDocument()
  })

  it('hides the "Create a stream" button when showCreate is false', () => {
    render(<EmptyStreams showCreate={false} />)
    expect(screen.queryByRole('link', { name: /create a stream/i })).not.toBeInTheDocument()
  })

  it('renders the create button with link to /app/create', () => {
    render(<EmptyStreams />)
    const link = screen.getByRole('link', { name: /create a stream/i })
    expect(link).toHaveAttribute('href', '/app/create')
  })

  it('renders the icon element', () => {
    const { container } = render(<EmptyStreams />)
    const iconContainer = container.querySelector('span.flex.size-12')
    expect(iconContainer).toBeInTheDocument()
  })

  it('renders all elements with correct structure', () => {
    const { container } = render(<EmptyStreams />)
    const mainDiv = container.querySelector(
      'div.flex.flex-col.items-center.justify-center.rounded-2xl',
    )
    expect(mainDiv).toBeInTheDocument()
  })

  it('renders with border and card styles', () => {
    const { container } = render(<EmptyStreams />)
    const mainDiv = container.querySelector(
      'div.flex.flex-col.items-center.justify-center.rounded-2xl',
    )
    expect(mainDiv?.className).toContain('border')
    expect(mainDiv?.className).toContain('border-dashed')
  })

  it('renders title with font-medium class', () => {
    const { container } = render(<EmptyStreams />)
    const title = screen.getByText('No streams yet')
    expect(title?.className).toContain('font-medium')
  })

  it('renders description with text-muted-foreground', () => {
    const { container } = render(<EmptyStreams />)
    const description = screen.getByText(
      'Create your first stream to start sending tokens that unlock in real time.',
    )
    expect(description?.className).toContain('text-muted-foreground')
  })

  it('button includes Plus icon and text', () => {
    render(<EmptyStreams />)
    const button = screen.getByRole('link', { name: /create a stream/i })
    expect(button.textContent).toContain('Create a stream')
  })
})
