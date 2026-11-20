import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import GlobalError from '@/app/global-error'
import { captureError } from '@/lib/sentry'

vi.mock('@/lib/sentry', () => ({ captureError: vi.fn() }))

describe('GlobalError', () => {
  const error = new Error('root layout exploded')
  const reset = vi.fn()

  beforeEach(() => {
    vi.mocked(captureError).mockClear()
    reset.mockClear()
  })

  it('renders the fallback UI and reports the error', () => {
    render(<GlobalError error={error} reset={reset} />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(
      screen.getByText('An unexpected error occurred. Please try again or contact support.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(captureError).toHaveBeenCalledOnce()
    expect(captureError).toHaveBeenCalledWith(error, { operation: 'global-error' })
  })

  it('wires the retry button to reset', () => {
    render(<GlobalError error={error} reset={reset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(reset).toHaveBeenCalledOnce()
  })
})
