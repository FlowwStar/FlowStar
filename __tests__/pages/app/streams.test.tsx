/**
 * Tests for app/app/streams/page.tsx — Streams list page composition (#766)
 *
 * Strategy
 * ─────────
 * StreamsRoute is a page-level composition component. Its job is to:
 *   1. Gate the page behind RequireWallet
 *   2. Render search, token, sort and status filter controls
 *   3. Render the bulk-select toggle (and bulk-action bar when selections exist)
 *   4. Render the stream list (VirtualStreamList) or EmptyStreams sentinel,
 *      all wired to a mocked useStreams
 *   5. Render the Active / Archived tab switcher
 *
 * We test composition and wallet gating. Heavy child components (VirtualStreamList,
 * EmptyStreams, StreamGanttView, ArchivedStreamsTab) are stubbed; tested separately.
 *
 * Mocked boundaries
 * ─────────────────
 * • useStreams                — primary data source (all streams array)
 * • useArchivedStreams        — archived stream IDs
 * • useWallet                — wallet address / connection state
 * • useContract              — withdraw / cancel / cleanup
 * • useNow                   — stable timestamp
 * • useHiddenStreams          — empty by default
 * • useStreamsViewPreference  — list view by default
 * • useBulkSelect            — selection state
 * • useBulkActions           — bulk-action state
 * • next/navigation          — router + searchParams stubs
 * • RequireWallet            — controlled by wallet mock
 * • VirtualStreamList        — renders stream ids as sentinels
 * • EmptyStreams              — sentinel
 * • StreamGanttView          — sentinel
 * • lib/export               — no-ops (no file-download side-effects)
 *
 * Following the pattern established in __tests__/pages/app/settings.test.tsx.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { StreamData, TokenInfo } from '@/types/stream'

// ─── Static constants ─────────────────────────────────────────────────────────

const WALLET_ADDRESS = 'GSENDER111AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const RECIPIENT_ADDRESS = 'GRCPT222AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const NOW_SEC = 1_700_050_000

const USDC: TokenInfo = { address: 'CUSDC', symbol: 'USDC', decimals: 6 }

// ─── Mock holders ─────────────────────────────────────────────────────────────

const mockUseStreams = vi.fn()
const mockUseWallet = vi.fn()
const mockUseContract = vi.fn()
const mockUseHiddenStreams = vi.fn()
const mockUseStreamsViewPreference = vi.fn()
const mockUseBulkSelect = vi.fn()
const mockUseBulkActions = vi.fn()
const mockUseArchivedStreams = vi.fn()

// ─── vi.mock declarations ─────────────────────────────────────────────────────

vi.mock('@/hooks/use-streams', () => ({
  useStreams: () => mockUseStreams(),
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

vi.mock('@/hooks/use-hidden-streams', () => ({
  useHiddenStreams: () => mockUseHiddenStreams(),
}))

vi.mock('@/hooks/use-streams-view-preference', () => ({
  useStreamsViewPreference: () => mockUseStreamsViewPreference(),
}))

vi.mock('@/hooks/use-bulk-select', () => ({
  useBulkSelect: () => mockUseBulkSelect(),
}))

vi.mock('@/hooks/use-bulk-actions', () => ({
  useBulkActions: () => mockUseBulkActions(),
}))

vi.mock('@/hooks/use-archived-streams', () => ({
  useArchivedStreams: () => mockUseArchivedStreams(),
}))

// Stub next/navigation with controllable searchParams
const mockRouterReplace = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => mockSearchParams,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Stub RequireWallet — passes through when wallet is connected, shows gate otherwise
vi.mock('@/components/layout/require-wallet', () => ({
  RequireWallet: ({ children }: { children: React.ReactNode }) => {
    const { isConnected, reconnecting } = mockUseWallet()
    if (reconnecting) return null
    if (!isConnected) return <div data-testid="wallet-gate">Connect your wallet</div>
    return <>{children}</>
  },
}))

// Stream list stubs
vi.mock('@/components/streams/virtual-stream-list', () => ({
  VirtualStreamList: ({ streams }: { streams: StreamData[] }) => (
    <div data-testid="virtual-stream-list">
      {streams.map((s) => (
        <div key={s.id} data-testid={`stream-row-${s.id}`} />
      ))}
    </div>
  ),
}))

vi.mock('@/components/streams/empty-state', () => ({
  EmptyStreams: () => <div data-testid="empty-streams">No streams yet</div>,
}))

vi.mock('@/components/streams/stream-gantt-view', () => ({
  StreamGanttView: () => <div data-testid="gantt-view">Gantt view</div>,
}))

// No-op export utilities to prevent file-download side-effects
vi.mock('@/lib/export', () => ({
  streamsToCSV: vi.fn(() => ''),
  downloadCSV: vi.fn(),
}))

// ─── Import after all mocks ───────────────────────────────────────────────────

import StreamsRoute from '@/app/app/streams/page'

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

function defaultStreamsResult(overrides: Partial<ReturnType<typeof mockUseStreams>> = {}) {
  return {
    all: [],
    sent: [],
    received: [],
    loading: false,
    isRefreshingAfterHidden: false,
    stale: false,
    lastUpdated: null,
    refetch: vi.fn(),
    ...overrides,
  }
}

function defaultBulkSelect(overrides = {}) {
  return {
    selected: new Set<string>(),
    selectedItems: [],
    allSelected: false,
    toggle: vi.fn(),
    toggleAll: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  }
}

function defaultBulkActions(overrides = {}) {
  return {
    status: 'idle' as const,
    results: [],
    succeeded: 0,
    failed: 0,
    runBulk: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  }
}

// ─── Default mock setup (reset before each test) ─────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchParams.forEach((_, key) => mockSearchParams.delete(key))

  mockUseWallet.mockReturnValue({
    address: WALLET_ADDRESS,
    isConnected: true,
    reconnecting: false,
  })

  mockUseContract.mockReturnValue({
    withdraw: vi.fn(),
    cancel: vi.fn(),
    cleanup: vi.fn(),
    pending: false,
  })

  mockUseHiddenStreams.mockReturnValue({
    hiddenIds: new Set<string>(),
    blockedSenders: new Set<string>(),
    hideStream: vi.fn(),
  })

  mockUseStreamsViewPreference.mockReturnValue({
    view: 'list',
    setView: vi.fn(),
  })

  mockUseBulkSelect.mockReturnValue(defaultBulkSelect())
  mockUseBulkActions.mockReturnValue(defaultBulkActions())

  mockUseArchivedStreams.mockReturnValue({
    sent: [],
    received: [],
    loading: false,
    refetch: vi.fn(),
  })

  mockUseStreams.mockReturnValue(defaultStreamsResult())
})

// ─── Wallet gating ────────────────────────────────────────────────────────────

describe('wallet gating', () => {
  it('shows wallet gate when not connected', () => {
    mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: false, address: undefined })
    render(<StreamsRoute />)
    expect(screen.getByTestId('wallet-gate')).toBeInTheDocument()
  })

  it('renders nothing while reconnecting', () => {
    mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: true, address: undefined })
    const { container } = render(<StreamsRoute />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders page content when wallet is connected', () => {
    render(<StreamsRoute />)
    expect(screen.queryByTestId('wallet-gate')).not.toBeInTheDocument()
  })
})

// ─── Page header and structure ────────────────────────────────────────────────

describe('page header and structure', () => {
  it('renders the "Streams" page heading', () => {
    render(<StreamsRoute />)
    expect(screen.getByRole('heading', { name: /streams/i })).toBeInTheDocument()
  })

  it('renders the page description', () => {
    render(<StreamsRoute />)
    expect(screen.getByText(/all streams you've sent or received/i)).toBeInTheDocument()
  })

  it('renders the Download CSV button', () => {
    render(<StreamsRoute />)
    expect(screen.getByRole('button', { name: /download csv/i })).toBeInTheDocument()
  })
})

// ─── Active / Archived tab switcher ──────────────────────────────────────────

describe('Active / Archived tabs', () => {
  it('renders the Active tab button', () => {
    render(<StreamsRoute />)
    expect(screen.getByRole('button', { name: /^active$/i })).toBeInTheDocument()
  })

  it('renders the Archived tab button', () => {
    render(<StreamsRoute />)
    expect(screen.getByRole('button', { name: /archived/i })).toBeInTheDocument()
  })

  it('Active tab is selected by default (aria-pressed=true)', () => {
    render(<StreamsRoute />)
    const activeBtn = screen.getByRole('button', { name: /^active$/i })
    expect(activeBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('switching to Archived tab renders the archived content area', async () => {
    const user = userEvent.setup()
    render(<StreamsRoute />)
    await user.click(screen.getByRole('button', { name: /archived/i }))
    // Archived tab shows the empty message since mock returns no archived streams
    expect(
      screen.getByText(/no archived streams yet/i),
    ).toBeInTheDocument()
  })
})

// ─── Filter controls ──────────────────────────────────────────────────────────

describe('filter controls', () => {
  it('renders the search input', () => {
    render(<StreamsRoute />)
    expect(screen.getByTestId('streams-search-input')).toBeInTheDocument()
  })

  it('renders token filter pills (All tokens, XLM, USDC, EURC)', () => {
    render(<StreamsRoute />)
    expect(screen.getByRole('button', { name: /all tokens/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^xlm$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^usdc$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^eurc$/i })).toBeInTheDocument()
  })

  it('renders the status filter pills', () => {
    render(<StreamsRoute />)
    // The status filter renders "All", "Streaming", "Scheduled", "Completed", "Cancelled"
    // "All" appears twice (token + status), both should be present
    const allButtons = screen.getAllByRole('button', { name: /^all$/i })
    expect(allButtons.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /streaming/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /scheduled/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /completed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelled/i })).toBeInTheDocument()
  })

  it('renders the sort select', () => {
    render(<StreamsRoute />)
    expect(screen.getByTestId('streams-sort-select')).toBeInTheDocument()
  })
})

// ─── Bulk-select toggle ───────────────────────────────────────────────────────

describe('bulk-select toggle', () => {
  it('renders the bulk-select toggle button', () => {
    render(<StreamsRoute />)
    expect(screen.getByTestId('bulk-select-toggle')).toBeInTheDocument()
  })

  it('bulk-select toggle is disabled when there are no streams', () => {
    mockUseStreams.mockReturnValue(defaultStreamsResult({ all: [] }))
    render(<StreamsRoute />)
    expect(screen.getByTestId('bulk-select-toggle')).toBeDisabled()
  })

  it('bulk-select toggle is enabled when streams are present', () => {
    const s = makeStream({ id: 'test-stream' })
    mockUseStreams.mockReturnValue(defaultStreamsResult({ all: [s] }))
    render(<StreamsRoute />)
    expect(screen.getByTestId('bulk-select-toggle')).not.toBeDisabled()
  })
})

// ─── Stream list / empty state ────────────────────────────────────────────────

describe('stream list and empty state', () => {
  it('shows EmptyStreams when there are no streams and no filters', () => {
    mockUseStreams.mockReturnValue(defaultStreamsResult({ all: [] }))
    render(<StreamsRoute />)
    expect(screen.getByTestId('empty-streams')).toBeInTheDocument()
    expect(screen.queryByTestId('virtual-stream-list')).not.toBeInTheDocument()
  })

  it('renders VirtualStreamList when streams are present', () => {
    const s1 = makeStream({ id: 'abc' })
    const s2 = makeStream({ id: 'def' })
    mockUseStreams.mockReturnValue(defaultStreamsResult({ all: [s1, s2] }))
    render(<StreamsRoute />)
    expect(screen.getByTestId('virtual-stream-list')).toBeInTheDocument()
    expect(screen.queryByTestId('empty-streams')).not.toBeInTheDocument()
  })

  it('renders one sentinel row per stream in VirtualStreamList', () => {
    const streams = ['id-1', 'id-2', 'id-3'].map((id) => makeStream({ id }))
    mockUseStreams.mockReturnValue(defaultStreamsResult({ all: streams }))
    render(<StreamsRoute />)
    expect(screen.getByTestId('stream-row-id-1')).toBeInTheDocument()
    expect(screen.getByTestId('stream-row-id-2')).toBeInTheDocument()
    expect(screen.getByTestId('stream-row-id-3')).toBeInTheDocument()
  })
})

// ─── View toggles ─────────────────────────────────────────────────────────────

describe('view toggle buttons', () => {
  it('renders List, Compact and Timeline view buttons', () => {
    render(<StreamsRoute />)
    expect(screen.getByRole('button', { name: /list view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /compact view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /timeline view/i })).toBeInTheDocument()
  })

  it('renders the show-hidden toggle button', () => {
    render(<StreamsRoute />)
    expect(screen.getByTestId('show-hidden-toggle')).toBeInTheDocument()
  })
})
