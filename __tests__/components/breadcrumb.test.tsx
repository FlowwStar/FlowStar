import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Breadcrumb } from '@/components/layout/breadcrumb'

let mockPathname = '/app'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('Breadcrumb', () => {
  it('renders nothing on the dashboard root /app', () => {
    mockPathname = '/app'
    const { container } = render(<Breadcrumb />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a breadcrumb for /app/streams', () => {
    mockPathname = '/app/streams'
    render(<Breadcrumb />)

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(nav).toBeInTheDocument()

    // Dashboard (linked) + Streams (current page)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent('Dashboard')
    expect(links[0]).toHaveAttribute('href', '/app')

    expect(screen.getByText('Streams')).toHaveAttribute('aria-current', 'page')
  })

  it('renders a breadcrumb for /app/streams/create', () => {
    mockPathname = '/app/streams/create'
    render(<Breadcrumb />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent('Dashboard')
    expect(links[1]).toHaveTextContent('Streams')

    expect(screen.getByText('Create Stream')).toHaveAttribute('aria-current', 'page')
  })

  it('renders a breadcrumb for /app/analytics', () => {
    mockPathname = '/app/analytics'
    render(<Breadcrumb />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent('Dashboard')

    expect(screen.getByText('Analytics')).toHaveAttribute('aria-current', 'page')
  })

  it('renders fallback label for unknown path segments (e.g. a stream ID)', () => {
    mockPathname = '/app/stream/abc123'
    render(<Breadcrumb />)

    // Dashboard (link) + Stream (link) + Stream #abc123 (current)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent('Dashboard')
    expect(links[1]).toHaveTextContent('Stream')

    expect(screen.getByText('Stream #abc123')).toHaveAttribute('aria-current', 'page')
  })

  it('shows fallback label for an unrecognized segment', () => {
    mockPathname = '/app/unknown-segment'
    render(<Breadcrumb />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent('Dashboard')

    expect(screen.getByText('Stream #unknown-segment')).toHaveAttribute('aria-current', 'page')
  })

  it('renders separators between breadcrumb items', () => {
    mockPathname = '/app/streams/create'
    render(<Breadcrumb />)

    // ChevronRight icons act as separators — there should be one between each pair
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    const separators = nav.querySelectorAll('[aria-hidden]')
    expect(separators.length).toBeGreaterThanOrEqual(2)
  })
})
