import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AppError from '@/app/error'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('AppError page', () => {
  const mockReset = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders network-agnostic RPC unavailable copy when an RPC network error occurs', () => {
    const error = new Error('Failed to fetch from RPC endpoint: timeout 503')
    render(<AppError error={error} reset={mockReset} />)

    expect(screen.getByText('Stellar RPC is temporarily unavailable')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The app could not reach the Stellar RPC server. This is usually temporary — please try again in a few moments.',
      ),
    ).toBeInTheDocument()

    // Acceptance criteria check: no hardcoded "testnet" in the copy
    expect(screen.queryByText(/testnet/i)).not.toBeInTheDocument()
  })

  it('renders wallet rejection copy when user denies transaction', () => {
    const error = new Error('User rejected the transaction signature')
    render(<AppError error={error} reset={mockReset} />)

    expect(screen.getByText('Transaction was rejected in your wallet')).toBeInTheDocument()
    expect(
      screen.getByText(
        'It looks like you (or your wallet) rejected the transaction. If this was accidental, try sending again.',
      ),
    ).toBeInTheDocument()
  })

  it('renders default fallback copy for unexpected errors', () => {
    const error = new Error('Some unexpected internal error')
    render(<AppError error={error} reset={mockReset} />)

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Some unexpected internal error')).toBeInTheDocument()
  })

  it('triggers reset callback when Try again button is clicked', () => {
    const error = new Error('ECONNREFUSED: server down')
    render(<AppError error={error} reset={mockReset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('triggers router.refresh when Refresh button is clicked', () => {
    const error = new Error('ECONNREFUSED: server down')
    render(<AppError error={error} reset={mockReset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })
})
