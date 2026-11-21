import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, renderHook, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Mocks — declared before any imports of modules under test ────────────────

// Contract integration
vi.mock('@/lib/contract', () => ({
  setSignTransaction: vi.fn(),
}))

// Sentry user tracking
vi.mock('@/lib/sentry', () => ({
  setSentryUser: vi.fn(),
}))

// Network provider — always returns testnet
vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => ({ network: 'testnet' }),
}))

// Stellar network config
vi.mock('@/lib/stellar', () => ({
  getNetworkConfig: vi.fn((_network: string) => ({
    passphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org',
  })),
}))

// ─── Freighter API mock ───────────────────────────────────────────────────────
// The adapter uses dynamic import(), so we mock the package itself.
const mockFreighterIsConnected = vi.fn()
const mockFreighterRequestAccess = vi.fn()
const mockFreighterGetAddress = vi.fn()
const mockFreighterSignTransaction = vi.fn()
const mockFreighterGetNetwork = vi.fn()

vi.mock('@stellar/freighter-api', () => ({
  isConnected: () => mockFreighterIsConnected(),
  requestAccess: () => mockFreighterRequestAccess(),
  getAddress: () => mockFreighterGetAddress(),
  signTransaction: (xdr: string, opts: unknown) => mockFreighterSignTransaction(xdr, opts),
  getNetwork: () => mockFreighterGetNetwork(),
}))

// ─── Albedo mock ──────────────────────────────────────────────────────────────
const mockAlbedoPublicKey = vi.fn()
const mockAlbedoTx = vi.fn()

vi.mock('@albedo-link/intent', () => ({
  default: {
    publicKey: (opts: unknown) => mockAlbedoPublicKey(opts),
    tx: (opts: unknown) => mockAlbedoTx(opts),
  },
}))

// ─── WalletConnect mocks (prevent real network calls) ─────────────────────────
vi.mock('@walletconnect/sign-client', () => ({
  SignClient: { init: vi.fn().mockResolvedValue({}) },
}))
vi.mock('@walletconnect/modal', () => ({
  WalletConnectModal: vi.fn().mockImplementation(() => ({
    openModal: vi.fn(),
    closeModal: vi.fn(),
  })),
}))

// ─── Import modules under test AFTER mocks ────────────────────────────────────
import { WalletProvider, useWalletContext, ADAPTERS, WALLET_OPTIONS } from '@/components/providers/wallet-provider'
import { setSignTransaction } from '@/lib/contract'
import { setSentryUser } from '@/lib/sentry'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_ADDRESS = 'GABCDE1234567890TESTADDRESSSTELLARXLM00'

function renderWithProvider(ui: React.ReactNode) {
  return render(<WalletProvider>{ui}</WalletProvider>)
}

/** Consumer component that exposes the wallet context via data-testid attributes. */
function WalletConsumer() {
  const ctx = useWalletContext()
  return (
    <div>
      <span data-testid="address">{ctx.address ?? 'null'}</span>
      <span data-testid="wallet-id">{ctx.walletId ?? 'null'}</span>
      <span data-testid="is-connected">{String(ctx.isConnected)}</span>
      <span data-testid="reconnecting">{String(ctx.reconnecting)}</span>
      <span data-testid="connecting">{String(ctx.connecting)}</span>
      <span data-testid="network-mismatch">{String(ctx.networkMismatch)}</span>
      <span data-testid="wallet-network">{ctx.walletNetwork ?? 'null'}</span>
      <button onClick={() => ctx.connect('freighter')}>connect-freighter</button>
      <button onClick={() => ctx.connect('albedo')}>connect-albedo</button>
      <button onClick={() => ctx.disconnect()}>disconnect</button>
    </div>
  )
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('WalletProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    // Default Freighter: not connected, no network
    mockFreighterIsConnected.mockResolvedValue({ isConnected: false })
    mockFreighterGetAddress.mockResolvedValue({ address: '' })
    mockFreighterRequestAccess.mockResolvedValue(undefined)
    mockFreighterGetNetwork.mockResolvedValue({ network: 'TESTNET', error: undefined })
    mockFreighterSignTransaction.mockResolvedValue({ signedTxXdr: 'signed-xdr', error: undefined })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('renders children', async () => {
      renderWithProvider(<span>child</span>)
      await act(async () => {})
      expect(screen.getByText('child')).toBeInTheDocument()
    })

    it('starts with address = null', async () => {
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})
      expect(screen.getByTestId('address').textContent).toBe('null')
    })

    it('starts with walletId = null', async () => {
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})
      expect(screen.getByTestId('wallet-id').textContent).toBe('null')
    })

    it('starts with isConnected = false', async () => {
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})
      expect(screen.getByTestId('is-connected').textContent).toBe('false')
    })

    it('sets reconnecting to false after mount when no saved walletId', async () => {
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})
      expect(screen.getByTestId('reconnecting').textContent).toBe('false')
    })

    it('starts with networkMismatch = false', async () => {
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})
      expect(screen.getByTestId('network-mismatch').textContent).toBe('false')
    })
  })

  // ─── connect flow ───────────────────────────────────────────────────────────

  describe('connect flow', () => {
    beforeEach(() => {
      mockFreighterIsConnected.mockResolvedValue({ isConnected: true })
      mockFreighterGetAddress.mockResolvedValue({ address: TEST_ADDRESS })
      mockFreighterRequestAccess.mockResolvedValue(undefined)
    })

    it('sets address after successful Freighter connect', async () => {
      const user = userEvent.setup()
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})

      await user.click(screen.getByRole('button', { name: 'connect-freighter' }))

      await waitFor(() => {
        expect(screen.getByTestId('address').textContent).toBe(TEST_ADDRESS)
      })
    })

    it('sets walletId to "freighter" after connect', async () => {
      const user = userEvent.setup()
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})

      await user.click(screen.getByRole('button', { name: 'connect-freighter' }))

      await waitFor(() => {
        expect(screen.getByTestId('wallet-id').textContent).toBe('freighter')
      })
    })

    it('sets isConnected to true after connect', async () => {
      const user = userEvent.setup()
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})

      await user.click(screen.getByRole('button', { name: 'connect-freighter' }))

      await waitFor(() => {
        expect(screen.getByTestId('is-connected').textContent).toBe('true')
      })
    })

    it('persists walletId to localStorage after connect', async () => {
      const user = userEvent.setup()
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})

      await user.click(screen.getByRole('button', { name: 'connect-freighter' }))

      await waitFor(() => {
        expect(localStorage.getItem('walletId')).toBe('freighter')
      })
    })

    it('calls setSentryUser with the address after connect', async () => {
      const user = userEvent.setup()
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})

      await user.click(screen.getByRole('button', { name: 'connect-freighter' }))

      await waitFor(() => {
        expect(setSentryUser).toHaveBeenCalledWith(TEST_ADDRESS)
      })
    })
  })

  // ─── disconnect flow ────────────────────────────────────────────────────────

  describe('disconnect flow', () => {
    beforeEach(() => {
      mockFreighterIsConnected.mockResolvedValue({ isConnected: true })
      mockFreighterGetAddress.mockResolvedValue({ address: TEST_ADDRESS })
      mockFreighterRequestAccess.mockResolvedValue(undefined)
    })

    async function connectFreighter() {
      const user = userEvent.setup()
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})
      await user.click(screen.getByRole('button', { name: 'connect-freighter' }))
      await waitFor(() =>
        expect(screen.getByTestId('is-connected').textContent).toBe('true'),
      )
      return user
    }

    it('clears address on disconnect', async () => {
      const user = await connectFreighter()
      await user.click(screen.getByRole('button', { name: 'disconnect' }))
      expect(screen.getByTestId('address').textContent).toBe('null')
    })

    it('clears walletId on disconnect', async () => {
      const user = await connectFreighter()
      await user.click(screen.getByRole('button', { name: 'disconnect' }))
      expect(screen.getByTestId('wallet-id').textContent).toBe('null')
    })

    it('sets isConnected to false on disconnect', async () => {
      const user = await connectFreighter()
      await user.click(screen.getByRole('button', { name: 'disconnect' }))
      expect(screen.getByTestId('is-connected').textContent).toBe('false')
    })

    it('removes walletId from localStorage on disconnect', async () => {
      const user = await connectFreighter()
      await user.click(screen.getByRole('button', { name: 'disconnect' }))
      expect(localStorage.getItem('walletId')).toBeNull()
    })

    it('calls setSentryUser(null) on disconnect', async () => {
      const user = await connectFreighter()
      await user.click(screen.getByRole('button', { name: 'disconnect' }))
      expect(setSentryUser).toHaveBeenCalledWith(null)
    })
  })

  // ─── persisted connection restore on mount ──────────────────────────────────

  describe('persisted-connection restore on mount', () => {
    it('auto-reconnects when walletId is stored in localStorage', async () => {
      mockFreighterIsConnected.mockResolvedValue({ isConnected: true })
      mockFreighterGetAddress.mockResolvedValue({ address: TEST_ADDRESS })
      mockFreighterRequestAccess.mockResolvedValue(undefined)

      localStorage.setItem('walletId', 'freighter')

      renderWithProvider(<WalletConsumer />)

      await waitFor(() => {
        expect(screen.getByTestId('address').textContent).toBe(TEST_ADDRESS)
      })

      expect(screen.getByTestId('wallet-id').textContent).toBe('freighter')
      expect(screen.getByTestId('is-connected').textContent).toBe('true')
    })

    it('reconnecting is false after restore completes', async () => {
      mockFreighterIsConnected.mockResolvedValue({ isConnected: true })
      mockFreighterGetAddress.mockResolvedValue({ address: TEST_ADDRESS })
      mockFreighterRequestAccess.mockResolvedValue(undefined)

      localStorage.setItem('walletId', 'freighter')

      renderWithProvider(<WalletConsumer />)

      await waitFor(() => {
        expect(screen.getByTestId('reconnecting').textContent).toBe('false')
      })
    })

    it('clears localStorage and stays disconnected when reconnect fails', async () => {
      mockFreighterIsConnected.mockResolvedValue({ isConnected: false })
      mockFreighterGetAddress.mockResolvedValue({ address: '', error: 'Not connected' })

      localStorage.setItem('walletId', 'freighter')

      renderWithProvider(<WalletConsumer />)

      await waitFor(() => {
        expect(screen.getByTestId('reconnecting').textContent).toBe('false')
      })

      expect(localStorage.getItem('walletId')).toBeNull()
      expect(screen.getByTestId('is-connected').textContent).toBe('false')
    })

    it('stays disconnected when no walletId is saved', async () => {
      renderWithProvider(<WalletConsumer />)

      await waitFor(() => {
        expect(screen.getByTestId('reconnecting').textContent).toBe('false')
      })

      expect(screen.getByTestId('is-connected').textContent).toBe('false')
    })
  })

  // ─── network-mismatch detection ─────────────────────────────────────────────

  describe('network-mismatch detection', () => {
    it('networkMismatch is false when walletId is not freighter', async () => {
      // Albedo connect
      mockAlbedoPublicKey.mockResolvedValue({ pubkey: TEST_ADDRESS })

      const user = userEvent.setup()
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})

      await user.click(screen.getByRole('button', { name: 'connect-albedo' }))

      await waitFor(() => {
        expect(screen.getByTestId('is-connected').textContent).toBe('true')
      })

      expect(screen.getByTestId('network-mismatch').textContent).toBe('false')
    })

    it('networkMismatch is false when walletNetwork matches app network', async () => {
      // Freighter on testnet — app network is also testnet
      mockFreighterIsConnected.mockResolvedValue({ isConnected: true })
      mockFreighterGetAddress.mockResolvedValue({ address: TEST_ADDRESS })
      mockFreighterRequestAccess.mockResolvedValue(undefined)
      mockFreighterGetNetwork.mockResolvedValue({ network: 'TESTNET', error: undefined })

      const user = userEvent.setup()
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})

      await user.click(screen.getByRole('button', { name: 'connect-freighter' }))

      await waitFor(() => {
        expect(screen.getByTestId('is-connected').textContent).toBe('true')
      })

      // Give the network poll time to run
      await waitFor(() => {
        expect(screen.getByTestId('wallet-network').textContent).toBe('TESTNET')
      })

      expect(screen.getByTestId('network-mismatch').textContent).toBe('false')
    })

    it('networkMismatch is true when Freighter is on mainnet but app is testnet', async () => {
      mockFreighterIsConnected.mockResolvedValue({ isConnected: true })
      mockFreighterGetAddress.mockResolvedValue({ address: TEST_ADDRESS })
      mockFreighterRequestAccess.mockResolvedValue(undefined)
      // Freighter reports mainnet
      mockFreighterGetNetwork.mockResolvedValue({ network: 'PUBLIC', error: undefined })

      const user = userEvent.setup()
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})

      await user.click(screen.getByRole('button', { name: 'connect-freighter' }))

      await waitFor(() => {
        expect(screen.getByTestId('is-connected').textContent).toBe('true')
      })

      await waitFor(() => {
        expect(screen.getByTestId('network-mismatch').textContent).toBe('true')
      })
    })

    it('networkMismatch is false when disconnected', async () => {
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})
      expect(screen.getByTestId('network-mismatch').textContent).toBe('false')
    })
  })

  // ─── useWalletContext outside provider ──────────────────────────────────────

  describe('useWalletContext outside WalletProvider', () => {
    it('throws when used outside WalletProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useWalletContext())
      }).toThrow('useWallet must be used within a WalletProvider')

      consoleError.mockRestore()
    })
  })

  // ─── setSignTransaction integration ─────────────────────────────────────────

  describe('setSignTransaction integration', () => {
    it('calls setSignTransaction on mount', async () => {
      renderWithProvider(<WalletConsumer />)
      await act(async () => {})
      expect(setSignTransaction).toHaveBeenCalled()
    })
  })
})

// ─── WALLET_OPTIONS ───────────────────────────────────────────────────────────

describe('WALLET_OPTIONS', () => {
  it('exports four wallet options', () => {
    expect(WALLET_OPTIONS).toHaveLength(4)
  })

  it('includes freighter', () => {
    expect(WALLET_OPTIONS.some((o) => o.id === 'freighter')).toBe(true)
  })

  it('includes xbull', () => {
    expect(WALLET_OPTIONS.some((o) => o.id === 'xbull')).toBe(true)
  })

  it('includes lobstr', () => {
    expect(WALLET_OPTIONS.some((o) => o.id === 'lobstr')).toBe(true)
  })

  it('includes albedo', () => {
    expect(WALLET_OPTIONS.some((o) => o.id === 'albedo')).toBe(true)
  })

  it('each option has id, name, and detail fields', () => {
    for (const option of WALLET_OPTIONS) {
      expect(option.id).toBeTruthy()
      expect(option.name).toBeTruthy()
      expect(option.detail).toBeTruthy()
    }
  })
})

// ─── ADAPTERS registry ────────────────────────────────────────────────────────

describe('ADAPTERS registry', () => {
  it('exports adapters for freighter, xbull, lobstr, and albedo', () => {
    expect(ADAPTERS).toHaveProperty('freighter')
    expect(ADAPTERS).toHaveProperty('xbull')
    expect(ADAPTERS).toHaveProperty('lobstr')
    expect(ADAPTERS).toHaveProperty('albedo')
  })

  it('each adapter has connect, signTransaction, and isAvailable methods', () => {
    for (const [, adapter] of Object.entries(ADAPTERS)) {
      expect(typeof adapter.connect).toBe('function')
      expect(typeof adapter.signTransaction).toBe('function')
      expect(typeof adapter.isAvailable).toBe('function')
    }
  })

  it('albedo adapter isAvailable returns true (web-based, always available)', () => {
    expect(ADAPTERS.albedo.isAvailable()).toBe(true)
  })

  it('lobstr adapter isAvailable returns true (WalletConnect fallback)', () => {
    expect(ADAPTERS.lobstr.isAvailable()).toBe(true)
  })
})
