/**
 * Tests for app/app/dashboard.tsx — Dashboard component
 *
 * Strategy
 * ─────────
 * Dashboard is a page-level composition component. Its job is to:
 *   1. Delegate data fetching to useStreams / useContract / useNow
 *   2. Render the correct UI state (loading, empty, populated)
 *   3. Wire sent / received / all arrays to the correct tab panels
 *
 * We test the composition, not the children. Heavy child components that
 * bring their own hooks (DashboardStats, VirtualStreamList, StreamCard,
 * TestnetFaucetBanner) are replaced with lightweight stubs so tests stay
 * fast and focused on the dashboard's own logic.
 *
 * Mocked boundaries
 * ─────────────────
 * • useStreams          — primary data source; controls loading + stream arrays
 * • useContract         — provides withdrawAll / pending
 * • useNow              — stable timestamp so getWithdrawableAmount is deterministic
 * • useHiddenStreams     — returns empty sets (no hidden/blocked streams by default)
 * • useWallet           — returns a connected wallet address
 * • useNetwork          — returns 'testnet'
 * • next/link           — thin <a> stub (no Next.js router required)
 * • DashboardStats      — stubbed; tested separately in dashboard-stats.test.tsx
 * • DashboardStatsSkeleton — stubbed
 * • VirtualStreamList   — renders each stream's id so tab filtering is verifiable
 * • EmptyStreams         — renders a labelled sentinel element
 * • TestnetFaucetBanner — no-op (requires network calls)
 * • StreamCardSkeleton  — renders a simple sentinel element
 * • SectionErrorBoundary / ComponentErrorBoundary — pass-through wrappers
 * • lib/sentry          — no-op to silence captureError in error boundaries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { StreamData, TokenInfo } from '@/types/stream'

// ─── Static constants ─────────────────────────────────────────────────────────

const WALLET_ADDRESS = 'GSENDER111AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const RECIPIENT_ADDRESS = 'GRCPT222AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const OTHER_SENDER = 'GOTHER333AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const NOW_SEC = 1_700_050_000

const USDC: TokenInfo = { address: 'CUSDC', symbol: 'USDC', decimals: 6 }

// ─── Mock: module-level vi.fn() holders ──────────────────────────────────────

const mockUseStreams = vi.fn()
const mockUseContract = vi.fn()
const mockUseWallet = vi.fn()
const mockUseNetwork = vi.fn()
const mockUseHiddenStreams = vi.fn()

// ─── vi.mock declarations (must be at module scope, not inside describe) ──────

vi.mock('@/hooks/use-streams', () => ({
  useStreams: () => mockUseStreams(),
}))

vi.mock('@/hooks/use-contract', () => ({
  useContract: () => mockUseContract(),
}))

vi.mock('@/hooks/use-now', () => ({
  useNow: () => NOW_SEC,
}))

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: () => mockUseWallet(),
}))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => mockUseNetwork(),
}))

vi.mock('@/hooks/use-hidden-streams', () => ({
  useHiddenStreams: () => mockUseHiddenStreams(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// ─── Child component stubs ────────────────────────────────────────────────────

// DashboardStats has its own test file; stub it to keep this test focused
// purely on the dashboard's composition logic.
vi.mock('@/components/streams/dashboard-stats', () => ({
  DashboardStats: () => <div data-testid="dashboard-stats" />,
  DashboardStatsSkeleton: () => <div data-testid="dashboard-stats-skeleton" />,
}))

// VirtualStreamList: render a testid per stream so tab-filter tests can count
// which streams are visible without needing StreamCard internals.
vi.mock('@/components/streams/virtual-stream-list', () => ({
  VirtualStreamList: ({ streams }: { streams: StreamData[] }) => (
    <div data-testid="virtual-stream-list">
      {streams.map((s) => (
        <div key={s.id} data-testid={`stream-card-${s.id}`} />
      ))}
    </div>
  ),
}))

vi.mock('@/components/streams/empty-state', () => ({
  EmptyStreams: () => <div data-testid="empty-streams">No streams yet</div>,
}))

vi.mock('@/components/layout/testnet-faucet-banner', () => ({
  TestnetFaucetBanner: () => null,
}))

// StreamCardSkeleton is rendered inline in dashboard.tsx (not via VirtualStreamList)
vi.mock('@/components/streams/stream-card', () => ({
  StreamCardSkeleton: () => <div data-testid="stream-card-skeleton" />,
}))

// Error boundaries: pass children through in tests
vi.mock('@/components/error-boundary/section-error-boundary', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/error-boundary/component-error-boundary', () => ({
  ComponentErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn(),
}))

// ─── Import the component under test (after all vi.mock calls) ────────────────

import React from 'react'
import { Dashboard } from '@/app/app/dashboard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStream(overrides: Partial<StreamData> = {}): StreamData {
  return {
    id: 'stream-default',
    sender: WALLET_ADDRESS,
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

/** Minimal useStreams return value for the given arrays. */
function streamsResult(
  overrides: Partial<ReturnType<typeof mockUseStreams>> = {},
) {
  return {
    sent: [],
    received: [],
    all: [],
    loading: false,
    isRefreshingAfterHidden: false,
    stale: false,
    lastUpdated: null,
    refetch: vi.fn(),
    ...overrides,
  }
}

// ─── Default mock return values (reset before each test) ─────────────────────

beforeEach(() => {
  vi.clearAllMocks()

  mockUseWallet.mockReturnValue({
    address: WALLET_ADDRESS,
    isConnected: true,
    reconnecting: false,
  })
  mockUseNetwork.mockReturnValue({ network: 'testnet' })
  mockUseContract.mockReturnValue({ withdrawAll: vi.fn(), pending: false })
  mockUseHiddenStreams.mockReturnValue({
    hiddenIds: new Set<string>(),
    blockedSenders: new Set<string>(),
  })
  mockUseStreams.mockReturnValue(streamsResult())
})

// ─── Loading state ────────────────────────────────────────────────────────────

describe('loading state', () => {
  beforeEach(() => {
    mockUseStreams.mockReturnValue(streamsResult({ loading: true }))
  })

  it('renders the stats skeleton while loading', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('dashboard-stats-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-stats')).not.toBeInTheDocument()
  })

  it('renders stream card skeletons in all three tab panels while loading', () => {
    render(<Dashboard />)
    // Each tab panel (all / receiving / sending) renders 2 skeletons when
    // loading=true. The "all" tab is the default active tab, so at least its
    // skeletons are in the DOM.
    const skeletons = screen.getAllByTestId('stream-card-skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
  })

  it('does not render EmptyStreams while loading', () => {
    render(<Dashboard />)
    expect(screen.queryByTestId('empty-streams')).not.toBeInTheDocument()
  })

  it('does not render the stream list while loading', () => {
    render(<Dashboard />)
    expect(screen.queryByTestId('virtual-stream-list')).not.toBeInTheDocument()
  })
})

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('empty state (no streams)', () => {
  beforeEach(() => {
    mockUseStreams.mockReturnValue(
      streamsResult({ sent: [], received: [], all: [], loading: false }),
    )
  })

  it('renders DashboardStats (not the skeleton) once loaded', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('dashboard-stats')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-stats-skeleton')).not.toBeInTheDocument()
  })

  it('shows EmptyStreams in the default "All" tab when there are no streams', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('empty-streams')).toBeInTheDocument()
  })

  it('shows zero counts in all tab labels', () => {
    render(<Dashboard />)
    expect(screen.getByRole('tab', { name: /all \(0\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /receiving \(0\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /sending \(0\)/i })).toBeInTheDocument()
  })

  it('renders the page heading and subtitle', () => {
    render(<Dashboard />)
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText(/your active and historical token streams/i)).toBeInTheDocument()
  })

  it('renders the "New stream" button linking to /app/create', () => {
    render(<Dashboard />)
    const link = screen.getByRole('link', { name: /new stream/i })
    expect(link).toHaveAttribute('href', '/app/create')
  })
})

// ─── Populated state ──────────────────────────────────────────────────────────

describe('populated state', () => {
  const sent1 = makeStream({ id: 'sent-1', sender: WALLET_ADDRESS, recipient: RECIPIENT_ADDRESS })
  const sent2 = makeStream({ id: 'sent-2', sender: WALLET_ADDRESS, recipient: RECIPIENT_ADDRESS })
  const recv1 = makeStream({ id: 'recv-1', sender: OTHER_SENDER, recipient: WALLET_ADDRESS })
  const allStreams = [sent1, sent2, recv1]

  beforeEach(() => {
    mockUseStreams.mockReturnValue(
      streamsResult({
        sent: [sent1, sent2],
        received: [recv1],
        all: allStreams,
        loading: false,
      }),
    )
  })

  it('renders the stream list instead of EmptyStreams', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('virtual-stream-list')).toBeInTheDocument()
    expect(screen.queryByTestId('empty-streams')).not.toBeInTheDocument()
  })

  it('shows correct total count in the "All" tab label', () => {
    render(<Dashboard />)
    expect(screen.getByRole('tab', { name: /all \(3\)/i })).toBeInTheDocument()
  })

  it('shows correct sent count in the "Sending" tab label', () => {
    render(<Dashboard />)
    expect(screen.getByRole('tab', { name: /sending \(2\)/i })).toBeInTheDocument()
  })

  it('shows correct received count in the "Receiving" tab label', () => {
    render(<Dashboard />)
    expect(screen.getByRole('tab', { name: /receiving \(1\)/i })).toBeInTheDocument()
  })

  it('renders all three streams in the default "All" tab', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('stream-card-sent-1')).toBeInTheDocument()
    expect(screen.getByTestId('stream-card-sent-2')).toBeInTheDocument()
    expect(screen.getByTestId('stream-card-recv-1')).toBeInTheDocument()
  })

  it('renders DashboardStats once data is loaded', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('dashboard-stats')).toBeInTheDocument()
  })
})

// ─── Tab-filter views ─────────────────────────────────────────────────────────

describe('tab switching', () => {
  const sentStream = makeStream({ id: 'tab-sent', sender: WALLET_ADDRESS, recipient: RECIPIENT_ADDRESS })
  const recvStream = makeStream({ id: 'tab-recv', sender: OTHER_SENDER, recipient: WALLET_ADDRESS })

  beforeEach(() => {
    mockUseStreams.mockReturnValue(
      streamsResult({
        sent: [sentStream],
        received: [recvStream],
        all: [sentStream, recvStream],
        loading: false,
      }),
    )
  })

  it('"All" tab is active by default and shows both streams', () => {
    render(<Dashboard />)
    const allTab = screen.getByRole('tab', { name: /all \(2\)/i })
    expect(allTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('stream-card-tab-sent')).toBeInTheDocument()
    expect(screen.getByTestId('stream-card-tab-recv')).toBeInTheDocument()
  })

  it('switching to "Sending" shows only the sent stream', async () => {
    const user = userEvent.setup()
    render(<Dashboard />)

    await user.click(screen.getByRole('tab', { name: /sending/i }))

    expect(screen.getByTestId('stream-card-tab-sent')).toBeInTheDocument()
    expect(screen.queryByTestId('stream-card-tab-recv')).not.toBeInTheDocument()
  })

  it('switching to "Receiving" shows only the received stream', async () => {
    const user = userEvent.setup()
    render(<Dashboard />)

    await user.click(screen.getByRole('tab', { name: /receiving/i }))

    expect(screen.getByTestId('stream-card-tab-recv')).toBeInTheDocument()
    expect(screen.queryByTestId('stream-card-tab-sent')).not.toBeInTheDocument()
  })

  it('shows EmptyStreams on the "Receiving" tab when there are no received streams', async () => {
    const user = userEvent.setup()
    mockUseStreams.mockReturnValue(
      streamsResult({
        sent: [sentStream],
        received: [],
        all: [sentStream],
        loading: false,
      }),
    )

    render(<Dashboard />)
    await user.click(screen.getByRole('tab', { name: /receiving \(0\)/i }))

    expect(screen.getByTestId('empty-streams')).toBeInTheDocument()
  })

  it('shows EmptyStreams on the "Sending" tab when there are no sent streams', async () => {
    const user = userEvent.setup()
    mockUseStreams.mockReturnValue(
      streamsResult({
        sent: [],
        received: [recvStream],
        all: [recvStream],
        loading: false,
      }),
    )

    render(<Dashboard />)
    await user.click(screen.getByRole('tab', { name: /sending \(0\)/i }))

    expect(screen.getByTestId('empty-streams')).toBeInTheDocument()
  })

  it('can switch back to "All" after visiting another tab', async () => {
    const user = userEvent.setup()
    render(<Dashboard />)

    await user.click(screen.getByRole('tab', { name: /sending/i }))
    await user.click(screen.getByRole('tab', { name: /all/i }))

    expect(screen.getByTestId('stream-card-tab-sent')).toBeInTheDocument()
    expect(screen.getByTestId('stream-card-tab-recv')).toBeInTheDocument()
  })
})

// ─── Withdraw-all button ──────────────────────────────────────────────────────

describe('"Withdraw all" button visibility', () => {
  it('is hidden when there are no withdrawable received streams', () => {
    // Stream ended before NOW so nothing is withdrawable
    const completedRecv = makeStream({
      id: 'done-recv',
      sender: OTHER_SENDER,
      recipient: WALLET_ADDRESS,
      endTime: BigInt(NOW_SEC - 1),
      withdrawnAmount: 1_000_000_000n,
    })
    mockUseStreams.mockReturnValue(
      streamsResult({ received: [completedRecv], all: [completedRecv], loading: false }),
    )

    render(<Dashboard />)
    expect(screen.queryByTestId('withdraw-all-btn')).not.toBeInTheDocument()
  })

  it('is visible when at least one received stream has unlocked funds', () => {
    // Stream is active: started before NOW, ends after NOW, nothing withdrawn yet
    const activeRecv = makeStream({
      id: 'active-recv',
      sender: OTHER_SENDER,
      recipient: WALLET_ADDRESS,
      startTime: BigInt(NOW_SEC - 500),
      endTime: BigInt(NOW_SEC + 500),
      withdrawnAmount: 0n,
      amountPerSecond: 500_000n,
    })
    mockUseStreams.mockReturnValue(
      streamsResult({ received: [activeRecv], all: [activeRecv], loading: false }),
    )

    render(<Dashboard />)
    expect(screen.getByTestId('withdraw-all-btn')).toBeInTheDocument()
  })
})
