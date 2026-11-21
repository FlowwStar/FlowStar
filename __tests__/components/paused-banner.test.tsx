import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { PausedBanner } from '@/components/layout/paused-banner'

// Issue #1144: dismissible-per-session "contract paused" banner.

const mockUseContractPaused = vi.fn()

vi.mock('@/hooks/use-contract-paused', () => ({
  useContractPaused: () => mockUseContractPaused(),
}))

describe('PausedBanner', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    mockUseContractPaused.mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when the contract is not paused', async () => {
    const { container } = render(<PausedBanner />)
    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the banner when the contract is paused', async () => {
    mockUseContractPaused.mockReturnValue(true)
    render(<PausedBanner />)
    await act(async () => {})
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/temporarily paused by its admin/i)).toBeInTheDocument()
  })

  it('dismisses when the Dismiss button is clicked', async () => {
    mockUseContractPaused.mockReturnValue(true)
    render(<PausedBanner />)
    await act(async () => {})
    expect(screen.getByRole('status')).toBeInTheDocument()

    await act(async () => {
      screen.getByText('Dismiss').click()
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem('flowstar:paused-banner-dismissed')).toBe('1')
  })

  it('stays dismissed across remounts within the same session', async () => {
    window.sessionStorage.setItem('flowstar:paused-banner-dismissed', '1')
    mockUseContractPaused.mockReturnValue(true)
    render(<PausedBanner />)
    await act(async () => {})
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
