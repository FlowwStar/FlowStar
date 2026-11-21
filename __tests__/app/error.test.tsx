import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AppError from '@/app/error'

const router = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('AppError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the parsed fallback copy and technical details', () => {
    render(<AppError error={new Error('Unhandled failure')} reset={vi.fn()} />)

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Unhandled failure')).toBeInTheDocument()
    expect(screen.getByText('Show technical details')).toBeInTheDocument()
  })

  it('calls reset when Try again is clicked', () => {
    const reset = vi.fn()
    render(<AppError error={new Error('Unhandled failure')} reset={reset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(reset).toHaveBeenCalledOnce()
  })

  it('offers a refresh action and a link back home', () => {
    render(<AppError error={new Error('Unhandled failure')} reset={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(router.refresh).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  })
})
