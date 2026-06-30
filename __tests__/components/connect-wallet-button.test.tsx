import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConnectWalletButton } from '@/components/layout/connect-wallet-button'

const mockUseWallet = vi.hoisted(() =>
  vi.fn(() => ({
    address: null,
    isConnected: false,
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    walletId: null,
  }))
)

vi.mock('@/hooks/use-wallet', () => ({ useWallet: mockUseWallet }))

vi.mock('@/components/providers/wallet-provider', () => ({
  WALLET_OPTIONS: [
    { id: 'freighter', name: 'Freighter', detail: 'Browser extension · stellar.org' },
    { id: 'xbull', name: 'xBull', detail: 'Extension & web' },
  ],
}))

describe('ConnectWalletButton — disconnected', () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnected: false,
      connecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      walletId: null,
    })
  })

  it('renders "Connect wallet" button', () => {
    render(<ConnectWalletButton />)
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  it('opens wallet selection dialog on click', async () => {
    render(<ConnectWalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    await waitFor(() =>
      expect(screen.getByText(/choose a stellar wallet/i)).toBeInTheDocument()
    )
  })

  it('lists wallet options in dialog', async () => {
    render(<ConnectWalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    await waitFor(() => {
      expect(screen.getByText('Freighter')).toBeInTheDocument()
      expect(screen.getByText('xBull')).toBeInTheDocument()
    })
  })

  it('calls connect with wallet id when option is clicked', async () => {
    const connect = vi.fn()
    mockUseWallet.mockReturnValue({
      address: null, isConnected: false, connecting: false, connect, disconnect: vi.fn(), walletId: null,
    })
    render(<ConnectWalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    await waitFor(() => screen.getByText('Freighter'))
    fireEvent.click(screen.getByText('Freighter').closest('button')!)
    expect(connect).toHaveBeenCalledWith('freighter')
  })

  it('disables wallet buttons while connecting', async () => {
    mockUseWallet.mockReturnValue({
      address: null, isConnected: false, connecting: true, connect: vi.fn(), disconnect: vi.fn(), walletId: null,
    })
    render(<ConnectWalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    await waitFor(() => screen.getByText('Freighter'))
    expect(screen.getByText('Freighter').closest('button')).toBeDisabled()
  })
})

describe('ConnectWalletButton — connected', () => {
  const ADDR = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB'

  beforeEach(() => {
    mockUseWallet.mockReturnValue({
      address: ADDR,
      isConnected: true,
      connecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      walletId: 'freighter',
    })
  })

  it('renders shortened address instead of connect button', () => {
    render(<ConnectWalletButton />)
    expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument()
    // Shortened address is shown inside the dropdown trigger button
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows disconnect option in dropdown', async () => {
    render(<ConnectWalletButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText(/disconnect/i)).toBeInTheDocument())
  })

  it('calls disconnect when disconnect is clicked', async () => {
    const disconnect = vi.fn()
    mockUseWallet.mockReturnValue({
      address: ADDR, isConnected: true, connecting: false, connect: vi.fn(), disconnect, walletId: 'freighter',
    })
    render(<ConnectWalletButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => screen.getByText(/disconnect/i))
    fireEvent.click(screen.getByText(/disconnect/i))
    expect(disconnect).toHaveBeenCalled()
  })

  it('shows copy address option', async () => {
    render(<ConnectWalletButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText(/copy address/i)).toBeInTheDocument())
  })
})
