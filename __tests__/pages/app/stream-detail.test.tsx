/**
 * Tests for app/app/stream/[id]/page.tsx — Stream detail page composition (#771)
 *
 * Strategy
 * ─────────
 * StreamPage renders StreamDetail, which is the largest single page in the
 * app (withdraw/cancel dialogs, share menu, auto-withdraw, timeline). Its job:
 *   1. Loading state — show StreamDetailSkeleton while `useStream` resolves
 *   2. Not-found state — show "Stream not found" message for a bad/missing ID
 *   3. Found state — render header card, details section, timeline, charts,
 *      and action buttons wired to the stream data
 *   4. Connect prompt for unauthenticated visitors
 *   5. Withdraw / Cancel buttons for the right parties
 *
 * We test the two states required by the issue (found stream / not-found ID)
 * and the most important composition assertions — skeleton, not-found message,
 * stream detail sections, and party-specific action buttons.
 *
 * Mocked boundaries
 * ─────────────────
 * • useStream            — primary data source; controls loading + stream
 * • useWallet            — wallet address / connection state
 * • useContract          — withdraw / cancel / cleanup
 * • useNow               — stable timestamp
 * • useNetwork           — testnet
 * • useUndoableCancel / useIsStreamCancelling — cancel-undo state
 * • useAutoWithdraw      — auto-withdraw settings
 * • useTokenPrice        — returns null price (no USD display needed)
 * • next/navigation      — router stub
 * • next/link            — thin <a> stub
 * • All heavy child components — stubbed with sentinels
 * • lib/contract         — bumpStreamTtl no-op
 * • lib/address-book     — getFederationNameForAddress returns null
 * • lib/stellar          — explorerUrl returns a test URL
 *
 * Following the pattern established in __tests__/pages/app/settings.test.tsx
 * (the reference for page-level composition tests).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { StreamData, TokenInfo } from '@/types/stream'
import { Suspense } from 'react'

// ─── Static constants ─────────────────────────────────────────────────────────

const SENDER_ADDRESS = 'GSENDER111AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const RECIPIENT_ADDRESS = 'GRCPT222AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const OTHER_ADDRESS = 'GOTHER333AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const NOW_SEC = 1_700_050_000

const USDC: TokenInfo = { address: 'CUSDC', symbol: 'USDC', decimals: 6 }

// ─── Mock holders ─────────────────────────────────────────────────────────────

const mockUseStream = vi.fn()
const mockUseWallet = vi.fn()
const mockUseContract = vi.fn()
const mockUseNetwork = vi.fn()
const mockUseUndoableCancel = vi.fn()
const mockUseIsStreamCancelling = vi.fn()
const mockUseAutoWithdraw = vi.fn()
const mockUseTokenPrice = vi.fn()

const mockRouterPush = vi.fn()

// ─── vi.mock declarations ─────────────────────────────────────────────────────

vi.mock('@/hooks/use-streams', () => ({
  useStream: (id: string) => mockUseStream(id),
}))

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: () => mockUseWallet(),
}))

vi.mock('@/hooks/use-contract', () => ({
  useContract: () => mockUseContract(),
}))

vi.mock('@/hooks/use-now', () => ({
  useNow: () => NOW_SEC,
}))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => mockUseNetwork(),
}))

vi.mock('@/hooks/use-undo-cancel', () => ({
  useUndoableCancel: () => mockUseUndoableCancel(),
  useIsStreamCancelling: (id: string) => mockUseIsStreamCancelling(id),
}))

vi.mock('@/hooks/use-auto-withdraw', () => ({
  useAutoWithdraw: () => mockUseAutoWithdraw(),
}))

vi.mock('@/hooks/use-token-price', () => ({
  useTokenPrice: () => mockUseTokenPrice(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// ─── Heavy child component stubs ─────────────────────────────────────────────

vi.mock('@/components/streams/unlock-chart', () => ({
  UnlockChart: () => <div data-testid="unlock-chart" />,
}))

vi.mock('@/components/streams/stream-timeline', () => ({
  StreamTimeline: () => <div data-testid="stream-timeline" />,
}))

vi.mock('@/components/streams/stream-status-badge', () => ({
  StreamStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="stream-status-badge">{status}</span>
  ),
}))

vi.mock('@/components/streams/download-receipt-button', () => ({
  DownloadReceiptButton: () => <button data-testid="download-receipt-btn">Download receipt</button>,
}))

vi.mock('@/components/streams/qr-share-dialog', () => ({
  QrShareDialog: () => <div data-testid="qr-share-dialog" />,
}))

vi.mock('@/components/ui/progress-bar', () => ({
  ProgressBar: () => <div data-testid="progress-bar" />,
}))

vi.mock('@/components/ui/token-amount', () => ({
  TokenAmount: ({
    amount,
    token,
  }: {
    amount: bigint
    token: { symbol: string; decimals: number }
  }) => (
    <span data-testid="token-amount">
      {(Number(amount) / 10 ** token.decimals).toFixed(2)} {token.symbol}
    </span>
  ),
}))

vi.mock('@/components/ui/countdown-timer', () => ({
  CountdownTimer: () => <div data-testid="countdown-timer" />,
}))

vi.mock('@/components/ui/accessible-countdown-timer', () => ({
  AccessibleCountdownTimer: () => <div data-testid="accessible-countdown-timer" />,
}))

vi.mock('@/components/ui/accessible-unlock-amount', () => ({
  AccessibleUnlockAmount: () => <div data-testid="accessible-unlock-amount" />,
}))

vi.mock('@/components/ui/fee-estimate-dialog', () => ({
  FeeEstimateDialog: () => <div data-testid="fee-estimate-dialog" />,
}))

vi.mock('@/components/layout/connect-wallet-button', () => ({
  ConnectWalletButton: () => <button data-testid="connect-wallet-btn">Connect wallet</button>,
}))

// ─── Lib stubs ────────────────────────────────────────────────────────────────

vi.mock('@/lib/contract', () => ({
  bumpStreamTtl: vi.fn(),
}))

vi.mock('@/lib/address-book', () => ({
  getFederationNameForAddress: vi.fn(() => null),
}))

vi.mock('@/lib/stellar', () => ({
  explorerUrl: vi.fn(() => 'https://stellar.expert/testnet/account/test'),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ─── Import after all mocks ───────────────────────────────────────────────────

import StreamPage from '@/app/app/stream/[id]/page'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStream(overrides: Partial<StreamData> = {}): StreamData {
  return {
    id: 'stream-abc',
    sender: SENDER_ADDRESS,
    recipient: RECIPIENT_ADDRESS,
    token: USDC,
    depositedAmount: 1_000_000_000n,
    withdrawnAmount: 0n,
    startTime: BigInt(NOW_SEC - 1000),
    endTime: BigInt(NOW_SEC + 1000),
    cliffTime: BigInt(NOW_SEC - 1000),
    cliffAmount: 0n,
    amountPerSecond: 500_000n,
    linearAmount: 1_000_000_000n,
    duration: 2000n,
    cancelled: false,
    ...overrides,
  }
}

/** Render the page component with a resolved params Promise. */
// StreamPage unwraps `params` with React's `use()`, which suspends, so it
// needs a Suspense boundary to render once the promise resolves.
async function renderPage(id: string) {
  let result!: ReturnType<typeof render>
  await act(async () => {
    result = render(
      <Suspense fallback={null}>
        <StreamPage params={Promise.resolve({ id })} />
      </Suspense>,
    )
  })
  return result
}

// ─── Default mock setup ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()

  mockUseWallet.mockReturnValue({
    address: SENDER_ADDRESS,
    isConnected: true,
    reconnecting: false,
  })

  mockUseNetwork.mockReturnValue({
    network: 'testnet',
    config: { streamContractId: 'CCONTRACT123' },
  })

  mockUseContract.mockReturnValue({
    withdraw: vi.fn(),
    cancel: vi.fn(),
    cleanup: vi.fn(),
    pending: false,
    error: null,
  })

  mockUseUndoableCancel.mockReturnValue({
    scheduleCancel: vi.fn(),
  })

  mockUseIsStreamCancelling.mockReturnValue(false)

  mockUseAutoWithdraw.mockReturnValue({
    settings: {
      enabled: false,
      strategy: 'time-based',
      intervalHours: 24,
      thresholdPercentage: 50,
      minAmountRaw: '0',
      maxSafetyLimitRaw: '0',
    },
    updateSettings: vi.fn(),
    lastAutoWithdraw: null,
    autoWithdrawPending: false,
    withdrawalHistory: [],
  })

  mockUseTokenPrice.mockReturnValue({ usdPrice: null })

  // Default: stream loaded with data
  mockUseStream.mockReturnValue({
    stream: makeStream(),
    loading: false,
    refetch: vi.fn(),
  })
})

// ─── Loading state ────────────────────────────────────────────────────────────

describe('loading state', () => {
  beforeEach(() => {
    mockUseStream.mockReturnValue({ stream: null, loading: true, refetch: vi.fn() })
  })

  it('renders the skeleton while loading', async () => {
    const { container } = await renderPage('stream-abc')
    // The skeleton has animate-pulse class on its root
    await waitFor(() => {
      expect(container.querySelector('.animate-pulse')).toBeTruthy()
    })
  })

  it('does not render the header card content while loading', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.queryByTestId('stream-status-badge')).not.toBeInTheDocument()
    })
  })
})

// ─── Not-found state ──────────────────────────────────────────────────────────

describe('not-found state (bad ID)', () => {
  beforeEach(() => {
    mockUseStream.mockReturnValue({ stream: null, loading: false, refetch: vi.fn() })
  })

  it('renders the "Stream not found" message', async () => {
    await renderPage('nonexistent-id')
    await waitFor(() => {
      expect(screen.getByText(/stream not found/i)).toBeInTheDocument()
    })
  })

  it('renders the not-found body text', async () => {
    await renderPage('nonexistent-id')
    await waitFor(() => {
      expect(screen.getByText(/this stream may not exist or may have expired/i)).toBeInTheDocument()
    })
  })

  it('renders a "Back to dashboard" link for the not-found state', async () => {
    await renderPage('nonexistent-id')
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /back to dashboard/i })
      expect(link).toHaveAttribute('href', '/app')
    })
  })

  it('does not render the stream header card for a missing stream', async () => {
    await renderPage('nonexistent-id')
    await waitFor(() => {
      expect(screen.queryByTestId('stream-status-badge')).not.toBeInTheDocument()
      expect(screen.queryByTestId('unlock-chart')).not.toBeInTheDocument()
    })
  })
})

// ─── Found state — composition ────────────────────────────────────────────────

describe('found state — page composition', () => {
  it('renders the back link to the dashboard', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /dashboard/i })
      expect(link).toHaveAttribute('href', '/app')
    })
  })

  it('renders the stream status badge', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByTestId('stream-status-badge')).toBeInTheDocument()
    })
  })

  it('renders the live unlock counter (AccessibleUnlockAmount)', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByTestId('accessible-unlock-amount')).toBeInTheDocument()
    })
  })

  it('renders the progress bar', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
    })
  })

  it('renders the UnlockChart section', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByTestId('unlock-chart')).toBeInTheDocument()
    })
  })

  it('renders the StreamTimeline section', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByTestId('stream-timeline')).toBeInTheDocument()
    })
  })

  it('renders the Details section heading', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByText('Details')).toBeInTheDocument()
    })
  })

  it('renders the Share button', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /share stream/i })).toBeInTheDocument()
    })
  })

  it('renders the download receipt button', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByTestId('download-receipt-btn')).toBeInTheDocument()
    })
  })
})

// ─── Sender-specific actions ──────────────────────────────────────────────────

describe('sender actions', () => {
  beforeEach(() => {
    // Active stream that the sender can cancel
    mockUseStream.mockReturnValue({
      stream: makeStream({
        sender: SENDER_ADDRESS,
        recipient: RECIPIENT_ADDRESS,
        cancelled: false,
      }),
      loading: false,
      refetch: vi.fn(),
    })
    mockUseWallet.mockReturnValue({
      address: SENDER_ADDRESS,
      isConnected: true,
      reconnecting: false,
    })
  })

  it('renders the "Cancel stream" button for the sender', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel stream/i })).toBeInTheDocument()
    })
  })

  it('renders the "Duplicate stream" button for the sender', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /duplicate stream/i })).toBeInTheDocument()
    })
  })

  it('does not render the "Withdraw" button for the sender', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^withdraw/i })).not.toBeInTheDocument()
    })
  })
})

// ─── Recipient-specific actions ───────────────────────────────────────────────

describe('recipient actions', () => {
  beforeEach(() => {
    // Active stream where wallet is the recipient with withdrawable balance
    mockUseStream.mockReturnValue({
      stream: makeStream({
        sender: OTHER_ADDRESS,
        recipient: RECIPIENT_ADDRESS,
        withdrawnAmount: 0n,
        amountPerSecond: 500_000n,
        startTime: BigInt(NOW_SEC - 1000),
        endTime: BigInt(NOW_SEC + 1000),
      }),
      loading: false,
      refetch: vi.fn(),
    })
    mockUseWallet.mockReturnValue({
      address: RECIPIENT_ADDRESS,
      isConnected: true,
      reconnecting: false,
    })
  })

  it('renders the "Withdraw" button for the recipient with withdrawable balance', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /withdraw/i })).toBeInTheDocument()
    })
  })

  it('does not render the "Cancel stream" button for the recipient', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel stream/i })).not.toBeInTheDocument()
    })
  })
})

// ─── Unauthenticated visitor ──────────────────────────────────────────────────

describe('unauthenticated visitor', () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({
      address: undefined,
      isConnected: false,
      reconnecting: false,
    })
  })

  it('renders the connect-wallet prompt for unauthenticated visitors', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(
        screen.getByText(/connect your wallet to withdraw, cancel, or interact/i),
      ).toBeInTheDocument()
    })
  })

  it('renders the ConnectWalletButton inside the connect prompt', async () => {
    await renderPage('stream-abc')
    await waitFor(() => {
      expect(screen.getByTestId('connect-wallet-btn')).toBeInTheDocument()
    })
  })
})
