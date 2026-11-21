import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RequireWallet } from '@/components/layout/require-wallet'

const mockUseWallet = vi.fn()

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: () => mockUseWallet(),
}))

vi.mock('@/components/layout/connect-wallet-button', () => ({
  ConnectWalletButton: () => <button data-testid="connect-btn">Connect wallet</button>,
}))

describe('RequireWallet', () => {
  it('renders children when wallet is connected', () => {
    mockUseWallet.mockReturnValue({ isConnected: true, reconnecting: false })

    render(
      <RequireWallet>
        <div data-testid="protected-content">Secret content</div>
      </RequireWallet>,
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.getByText('Secret content')).toBeInTheDocument()
  })

  it('renders the connect prompt when wallet is not connected', () => {
    mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: false })

    render(
      <RequireWallet>
        <div data-testid="protected-content">Secret content</div>
      </RequireWallet>,
    )

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByText('Connect your wallet')).toBeInTheDocument()
    expect(screen.getByTestId('connect-btn')).toBeInTheDocument()
  })

  it('renders nothing while reconnecting', () => {
    mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: true })

    const { container } = render(
      <RequireWallet>
        <div data-testid="protected-content">Secret content</div>
      </RequireWallet>,
    )

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.queryByText('Connect your wallet')).not.toBeInTheDocument()
  })

  it('shows descriptive text in the connect prompt', () => {
    mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: false })

    render(
      <RequireWallet>
        <div>Content</div>
      </RequireWallet>,
    )

    expect(screen.getByText(/Connect a Stellar wallet to view your streams/)).toBeInTheDocument()
  })

  it('renders the Wallet icon area in the connect prompt', () => {
    mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: false })

    render(
      <RequireWallet>
        <div>Content</div>
      </RequireWallet>,
    )

    expect(screen.getByText('Connect your wallet')).toBeInTheDocument()
    // The Wallet icon is rendered as an SVG inside the prompt
    expect(screen.getByTestId('connect-btn')).toBeInTheDocument()
  })
})
