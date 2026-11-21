/**
 * Page-level composition tests for app/app/create/page.tsx  (#767)
 *
 * Strategy
 * ─────────
 * CreatePage composes exactly two things:
 *   1. <RequireWallet>  — gates content behind a wallet connection
 *   2. <CreateForm>     — the actual stream-creation form
 *
 * The test concern here is composition: does the page render the wallet gate
 * when the wallet is disconnected, and the form when it is connected? We are
 * NOT retesting CreateForm's internal validation (covered by create-form.test.tsx)
 * or RequireWallet's internals (covered by require-wallet.test.tsx).
 *
 * Mocked boundaries
 * ─────────────────
 * • useWallet           — controls connected / disconnected / reconnecting state
 * • ConnectWalletButton — thin stub (no wallet provider required)
 * • CreateForm          — stubbed; its own validation tests live in create-form.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import CreatePage from '@/app/app/create/page'

// ─── Mock: useWallet ──────────────────────────────────────────────────────────

const mockUseWallet = vi.fn()

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: () => mockUseWallet(),
}))

// ─── Mock: ConnectWalletButton (used inside RequireWallet) ────────────────────

vi.mock('@/components/layout/connect-wallet-button', () => ({
  ConnectWalletButton: () => <button data-testid="connect-btn">Connect wallet</button>,
}))

// ─── Mock: CreateForm (composition boundary) ─────────────────────────────────

vi.mock('@/app/app/create/create-form', () => ({
  CreateForm: () => <div data-testid="create-form">Create form content</div>,
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreatePage — page-level composition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the wallet gate (connect prompt) when wallet is disconnected', () => {
    mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: false })

    render(<CreatePage />)

    expect(screen.getByText('Connect your wallet')).toBeInTheDocument()
    expect(screen.getByTestId('connect-btn')).toBeInTheDocument()
  })

  it('does not render the create form when wallet is disconnected', () => {
    mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: false })

    render(<CreatePage />)

    expect(screen.queryByTestId('create-form')).not.toBeInTheDocument()
  })

  it('renders the create form when wallet is connected', () => {
    mockUseWallet.mockReturnValue({ isConnected: true, reconnecting: false })

    render(<CreatePage />)

    expect(screen.getByTestId('create-form')).toBeInTheDocument()
  })

  it('does not render the wallet gate when wallet is connected', () => {
    mockUseWallet.mockReturnValue({ isConnected: true, reconnecting: false })

    render(<CreatePage />)

    expect(screen.queryByText('Connect your wallet')).not.toBeInTheDocument()
    expect(screen.queryByTestId('connect-btn')).not.toBeInTheDocument()
  })

  it('renders nothing (blank) while the wallet is reconnecting', () => {
    mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: true })

    const { container } = render(<CreatePage />)

    // RequireWallet returns null during reconnect — the page should be empty.
    expect(container).toBeEmptyDOMElement()
  })

  it('shows descriptive text in the connect prompt', () => {
    mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: false })

    render(<CreatePage />)

    expect(screen.getByText(/Connect a Stellar wallet to view your streams/i)).toBeInTheDocument()
  })
})
