import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TestnetFaucetBanner } from '@/components/layout/testnet-faucet-banner'

const mockUseWallet = vi.fn()
const mockUseNetwork = vi.fn()
const mockGetXlmBalance = vi.fn()

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: () => mockUseWallet(),
}))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => mockUseNetwork(),
}))

vi.mock('@/lib/stellar', () => ({
  getXlmBalance: (...args: any[]) => mockGetXlmBalance(...args),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('TestnetFaucetBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseWallet.mockReturnValue({ address: 'GABCDEF1234567890', isConnected: true })
    mockUseNetwork.mockReturnValue({ network: 'testnet' })
    mockGetXlmBalance.mockResolvedValue(0n)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('renders nothing when not on testnet', () => {
    mockUseNetwork.mockReturnValue({ network: 'mainnet' })
    const { container } = render(<TestnetFaucetBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when wallet is not connected', () => {
    mockUseWallet.mockReturnValue({ address: 'GABCDEF', isConnected: false })
    const { container } = render(<TestnetFaucetBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing while loading balance', async () => {
    mockGetXlmBalance.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = render(<TestnetFaucetBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the banner when on testnet with zero balance', async () => {
    await act(async () => {
      render(<TestnetFaucetBanner />)
    })

    expect(screen.getByText('Your testnet account needs funding')).toBeInTheDocument()
    expect(screen.getByText('Fund with Friendbot')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
  })

  it('does not render the banner when balance is non-zero', async () => {
    mockGetXlmBalance.mockResolvedValue(100_000_000n) // 10 XLM
    const { container } = render(<TestnetFaucetBanner />)

    await act(async () => {})

    expect(container).toBeEmptyDOMElement()
  })

  it('dismisses when Dismiss button is clicked', async () => {
    await act(async () => {
      render(<TestnetFaucetBanner />)
    })

    expect(screen.getByText('Your testnet account needs funding')).toBeInTheDocument()

    await act(async () => {
      screen.getByText('Dismiss').click()
    })

    expect(screen.queryByText('Your testnet account needs funding')).not.toBeInTheDocument()
  })

  it('shows success message after funding', async () => {
    // Mock successful fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('') }))

    await act(async () => {
      render(<TestnetFaucetBanner />)
    })

    await act(async () => {
      screen.getByText('Fund with Friendbot').click()
    })

    // After funding, the button should show "Funding..." briefly, then success
    // The success message appears after the mock delay
    await act(async () => {
      vi.advanceTimersByTime(5000) // CONFIRMATION_DELAY_MS + network request
    })

    expect(screen.getByText('Account funded successfully! Reloading...')).toBeInTheDocument()
  })

  it('shows error message on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, text: () => Promise.resolve('Friendbot rate limited') }),
    )

    await act(async () => {
      render(<TestnetFaucetBanner />)
    })

    await act(async () => {
      screen.getByText('Fund with Friendbot').click()
    })

    await act(async () => {})

    expect(screen.getByText('Friendbot rate limited')).toBeInTheDocument()
  })

  it('calls onClose after successful funding auto-dismiss', async () => {
    const onClose = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('') }))

    await act(async () => {
      render(<TestnetFaucetBanner onClose={onClose} />)
    })

    // Click fund button
    await act(async () => {
      screen.getByText('Fund with Friendbot').click()
    })

    // Advance past CONFIRMATION_DELAY_MS so the inner setTimeout(resolve, 3000) fires
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    // Advance past AUTO_DISMISS_DELAY_MS so the outer setTimeout fires onClose
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(onClose).toHaveBeenCalled()
  })
})
