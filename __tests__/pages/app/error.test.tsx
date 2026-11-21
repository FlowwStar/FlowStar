import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import RouteError from '@/app/app/error'

const router = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('RouteError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the in-app fallback copy and dashboard link', () => {
    render(<RouteError error={new Error('route failed')} reset={vi.fn()} />)

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('route failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  })

  it('forwards reset to the shared error page', () => {
    const reset = vi.fn()
    render(<RouteError error={new Error('route failed')} reset={reset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(reset).toHaveBeenCalledOnce()
  })
})
