import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, renderHook } from '@testing-library/react'
import React from 'react'

// ─── Mock stellar getNetworkConfig ────────────────────────────────────────────
// Controlled via `mockContractId` so individual tests can flip isMockMode.
let mockContractId = ''

vi.mock('@/lib/stellar', () => ({
  getNetworkConfig: vi.fn((network: string) => ({
    name: network,
    passphrase:
      network === 'mainnet'
        ? 'Public Global Stellar Network ; September 2015'
        : 'Test SDF Network ; September 2015',
    rpcUrl: `https://soroban-${network}.stellar.org`,
    horizonUrl: `https://horizon-${network}.stellar.org`,
    streamContractId: mockContractId,
    knownTokens: [],
  })),
}))

// Import AFTER mocks are declared
import { NetworkProvider, useNetwork } from '@/components/providers/network-provider'

// ─── localStorage helpers ─────────────────────────────────────────────────────
const NETWORK_KEY = 'flowstar:network'

function renderWithProvider(ui: React.ReactNode) {
  return render(<NetworkProvider>{ui}</NetworkProvider>)
}

// ─── Consumer component for integration tests ─────────────────────────────────
function NetworkConsumer() {
  const { network, isMockMode, config, setNetwork } = useNetwork()
  return (
    <div>
      <span data-testid="network">{network}</span>
      <span data-testid="mock-mode">{String(isMockMode)}</span>
      <span data-testid="rpc-url">{config.rpcUrl}</span>
      <button onClick={() => setNetwork('mainnet')}>switch-mainnet</button>
      <button onClick={() => setNetwork('testnet')}>switch-testnet</button>
    </div>
  )
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('NetworkProvider — default values', () => {
  beforeEach(() => {
    mockContractId = ''
    localStorage.clear()
  })

  it('provides "testnet" as the default network', async () => {
    renderWithProvider(<NetworkConsumer />)
    // After mount the useEffect runs; wait for it
    await act(async () => {})
    expect(screen.getByTestId('network').textContent).toBe('testnet')
  })

  it('renders children without crashing', () => {
    renderWithProvider(<span data-testid="child">hello</span>)
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})

describe('NetworkProvider — isMockMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('isMockMode is true when streamContractId is empty string', async () => {
    mockContractId = ''
    renderWithProvider(<NetworkConsumer />)
    await act(async () => {})
    expect(screen.getByTestId('mock-mode').textContent).toBe('true')
  })

  it('isMockMode is false when streamContractId is non-empty', async () => {
    mockContractId = 'CBNDCZTRFNTDAPQLPK2ESOKO4XFMSC4PX37QE75BBYFOYIEWIPMHAKFV'
    renderWithProvider(<NetworkConsumer />)
    await act(async () => {})
    expect(screen.getByTestId('mock-mode').textContent).toBe('false')
  })
})

describe('NetworkProvider — context values are consumed correctly', () => {
  beforeEach(() => {
    mockContractId = 'CONTRACT_ID'
    localStorage.clear()
  })

  it('exposes the network name via context', async () => {
    renderWithProvider(<NetworkConsumer />)
    await act(async () => {})
    expect(screen.getByTestId('network').textContent).toBe('testnet')
  })

  it('exposes config.rpcUrl that matches the active network', async () => {
    renderWithProvider(<NetworkConsumer />)
    await act(async () => {})
    expect(screen.getByTestId('rpc-url').textContent).toBe('https://soroban-testnet.stellar.org')
  })
})

describe('NetworkProvider — setNetwork', () => {
  beforeEach(() => {
    mockContractId = 'CONTRACT_ID'
    localStorage.clear()
  })

  it('switches network to mainnet when setNetwork("mainnet") is called', async () => {
    renderWithProvider(<NetworkConsumer />)
    await act(async () => {})

    await act(async () => {
      screen.getByText('switch-mainnet').click()
    })

    expect(screen.getByTestId('network').textContent).toBe('mainnet')
  })

  it('switches config.rpcUrl when network changes', async () => {
    renderWithProvider(<NetworkConsumer />)
    await act(async () => {})

    await act(async () => {
      screen.getByText('switch-mainnet').click()
    })

    expect(screen.getByTestId('rpc-url').textContent).toBe('https://soroban-mainnet.stellar.org')
  })

  it('can switch back to testnet after switching to mainnet', async () => {
    renderWithProvider(<NetworkConsumer />)
    await act(async () => {})

    await act(async () => {
      screen.getByText('switch-mainnet').click()
    })
    expect(screen.getByTestId('network').textContent).toBe('mainnet')

    await act(async () => {
      screen.getByText('switch-testnet').click()
    })
    expect(screen.getByTestId('network').textContent).toBe('testnet')
  })
})

describe('NetworkProvider — localStorage persistence', () => {
  beforeEach(() => {
    mockContractId = ''
    localStorage.clear()
  })

  it('persists the chosen network to localStorage on setNetwork', async () => {
    renderWithProvider(<NetworkConsumer />)
    await act(async () => {})

    await act(async () => {
      screen.getByText('switch-mainnet').click()
    })

    expect(localStorage.getItem(NETWORK_KEY)).toBe('mainnet')
  })

  it('reads a previously saved network from localStorage on mount', async () => {
    localStorage.setItem(NETWORK_KEY, 'mainnet')
    renderWithProvider(<NetworkConsumer />)

    // Wait for the useEffect that reads localStorage
    await act(async () => {})

    expect(screen.getByTestId('network').textContent).toBe('mainnet')
  })

  it('ignores an invalid value stored in localStorage', async () => {
    localStorage.setItem(NETWORK_KEY, 'invalid-network')
    renderWithProvider(<NetworkConsumer />)
    await act(async () => {})

    // Should fall back to the default 'testnet'
    expect(screen.getByTestId('network').textContent).toBe('testnet')
  })

  it('updates localStorage when switching network a second time', async () => {
    renderWithProvider(<NetworkConsumer />)
    await act(async () => {})

    await act(async () => {
      screen.getByText('switch-mainnet').click()
    })
    expect(localStorage.getItem(NETWORK_KEY)).toBe('mainnet')

    await act(async () => {
      screen.getByText('switch-testnet').click()
    })
    expect(localStorage.getItem(NETWORK_KEY)).toBe('testnet')
  })
})

describe('useNetwork — error boundary (used outside provider)', () => {
  // Suppress the expected console.error from React about uncaught errors in tests
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws when useNetwork is called outside a NetworkProvider', () => {
    expect(() => renderHook(() => useNetwork())).toThrow(
      'useNetwork must be used within a NetworkProvider',
    )
  })

  it('does NOT throw when useNetwork is called inside a NetworkProvider', () => {
    expect(() =>
      renderHook(() => useNetwork(), {
        wrapper: ({ children }) => <NetworkProvider>{children}</NetworkProvider>,
      }),
    ).not.toThrow()
  })
})

describe('useNetwork — hook return shape', () => {
  beforeEach(() => {
    mockContractId = 'SOME_CONTRACT'
    localStorage.clear()
  })

  it('returns an object with network, setNetwork, config, and isMockMode', async () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: ({ children }) => <NetworkProvider>{children}</NetworkProvider>,
    })

    await act(async () => {})

    expect(result.current).toHaveProperty('network')
    expect(result.current).toHaveProperty('setNetwork')
    expect(result.current).toHaveProperty('config')
    expect(result.current).toHaveProperty('isMockMode')
  })

  it('setNetwork is a function', async () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: ({ children }) => <NetworkProvider>{children}</NetworkProvider>,
    })

    await act(async () => {})

    expect(typeof result.current.setNetwork).toBe('function')
  })

  it('config contains the expected shape (rpcUrl, passphrase, etc.)', async () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: ({ children }) => <NetworkProvider>{children}</NetworkProvider>,
    })

    await act(async () => {})

    expect(result.current.config).toMatchObject({
      rpcUrl: expect.any(String),
      passphrase: expect.any(String),
      streamContractId: expect.any(String),
    })
  })
})
