/**
 * Tests for app/app/analytics/page.tsx — Analytics page composition (#770)
 *
 * Strategy
 * ─────────
 * AnalyticsPage is a page-level composition component. Its job is to:
 *   1. Read streams from useStreams (with loading flag) and build a snapshot
 *   2. Render four stat cards: Total volume, Active streams, Total streams, Avg duration
 *   3. Render loading skeletons inside the stat cards while data is loading
 *      (fix #674 — the `loading` flag was previously unused)
 *   4. Render AnalyticsCharts (via dynamic import, stubbed here) with snapshot data
 *   5. Render the Network context card listing available tokens
 *
 * We test composition and the loading-skeleton fix.
 * Heavy children (AnalyticsCharts) are stubbed; tested separately.
 *
 * Mocked boundaries
 * ─────────────────
 * • useStreams          — primary data source; controls loading + stream arrays
 * • useNetwork          — returns a static 'testnet' network
 * • next/dynamic        — strips the dynamic import wrapper so AnalyticsCharts
 *                         can be replaced by a simple stub
 * • AnalyticsCharts     — stubbed sentinel
 * • SectionErrorBoundary — pass-through
 * • lib/stellar         — getAllTokens returns a fixed token list
 * • lib/address-book    — getFederationNameForAddress returns null
 * • next/link           — thin <a> stub
 *
 * Following the pattern established in __tests__/pages/app/settings.test.tsx.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { StreamData, TokenInfo } from '@/types/stream'

// ─── Static constants ─────────────────────────────────────────────────────────

const NOW_SEC = 1_700_050_000
const USDC: TokenInfo = { address: 'CUSDC', symbol: 'USDC', decimals: 6 }

// ─── Mock holders ─────────────────────────────────────────────────────────────

const mockUseStreams = vi.fn()
const mockUseNetwork = vi.fn()

// ─── vi.mock declarations ─────────────────────────────────────────────────────

vi.mock('@/hooks/use-streams', () => ({
  useStreams: () => mockUseStreams(),
}))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => mockUseNetwork(),
}))

// Stub next/dynamic so AnalyticsCharts renders synchronously in tests
vi.mock('next/dynamic', () => ({
  default: () => {
    // Return the stub immediately (ignores async loading)
    return function DynamicStub() {
      return <div data-testid="analytics-charts" />
    }
  },
}))

vi.mock('@/components/analytics/charts', () => ({
  AnalyticsCharts: () => <div data-testid="analytics-charts" />,
}))

vi.mock('@/components/error-boundary/section-error-boundary', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/stellar', () => ({
  getAllTokens: vi.fn(() => [
    { address: 'CXLM', symbol: 'XLM', decimals: 7 },
    { address: 'CUSDC', symbol: 'USDC', decimals: 6 },
    { address: 'CEURC', symbol: 'EURC', decimals: 6 },
  ]),
  explorerUrl: vi.fn(() => 'https://stellar.expert/testnet/contract/test'),
}))

vi.mock('@/lib/address-book', () => ({
  getFederationNameForAddress: vi.fn(() => null),
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

// ─── Import after all mocks ───────────────────────────────────────────────────

import AnalyticsPage from '@/app/app/analytics/page'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStream(overrides: Partial<StreamData> = {}): StreamData {
  return {
    id: 'stream-default',
    sender: 'GSENDER111AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    recipient: 'GRCPT222AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
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

function defaultStreamsResult(overrides: Partial<{ all: StreamData[]; loading: boolean }> = {}) {
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

// ─── Default mock setup (reset before each test) ─────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // The page filters by `Date.now()`; pin it to the fixtures' NOW_SEC.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW_SEC * 1000)

  mockUseNetwork.mockReturnValue({ network: 'testnet' })
  mockUseStreams.mockReturnValue(defaultStreamsResult())
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Loading state (fix #674) ─────────────────────────────────────────────────

describe('loading state — fix #674', () => {
  beforeEach(() => {
    mockUseStreams.mockReturnValue(defaultStreamsResult({ loading: true }))
  })

  it('renders loading skeleton in the Total volume stat card', () => {
    render(<AnalyticsPage />)
    // The skeleton is a <span> with animate-pulse; we find the stat card by title
    const card = screen.getByText('Total volume streamed').closest('[data-slot="card"]')!
    // When loading, the value cell renders a skeleton span instead of a number
    const skeleton = card?.querySelector('span.animate-pulse')
    expect(skeleton).toBeTruthy()
  })

  it('renders loading skeleton in the Active streams stat card', () => {
    render(<AnalyticsPage />)
    const card = screen.getByText('Active streams').closest('[data-slot="card"]')!
    expect(card?.querySelector('span.animate-pulse')).toBeTruthy()
  })

  it('renders loading skeleton in the Total streams stat card', () => {
    render(<AnalyticsPage />)
    const card = screen.getByText('Total streams created').closest('[data-slot="card"]')!
    expect(card?.querySelector('span.animate-pulse')).toBeTruthy()
  })

  it('renders loading skeleton in the Average duration stat card', () => {
    render(<AnalyticsPage />)
    const card = screen.getByText('Average duration').closest('[data-slot="card"]')!
    expect(card?.querySelector('span.animate-pulse')).toBeTruthy()
  })
})

// ─── Empty dataset ────────────────────────────────────────────────────────────

describe('empty dataset (loaded, no streams)', () => {
  it('renders the page heading', () => {
    render(<AnalyticsPage />)
    expect(screen.getByRole('heading', { name: /platform analytics/i })).toBeInTheDocument()
  })

  it('renders the page subheading', () => {
    render(<AnalyticsPage />)
    expect(screen.getByText(/public signals that highlight traction/i)).toBeInTheDocument()
  })

  it('renders the "Back to dashboard" link', () => {
    render(<AnalyticsPage />)
    const link = screen.getByRole('link', { name: /back to dashboard/i })
    expect(link).toHaveAttribute('href', '/app')
  })

  it('renders all four stat card titles', () => {
    render(<AnalyticsPage />)
    expect(screen.getByText('Total volume streamed')).toBeInTheDocument()
    expect(screen.getByText('Active streams')).toBeInTheDocument()
    expect(screen.getByText('Total streams created')).toBeInTheDocument()
    expect(screen.getByText('Average duration')).toBeInTheDocument()
  })

  it('renders stat card values of 0 / 0.0d when no streams', () => {
    render(<AnalyticsPage />)
    // Active count and Total streams should both show 0
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(2)
    // Average duration should show 0.0d
    expect(screen.getByText('0.0d')).toBeInTheDocument()
  })

  it('renders the Network context card', () => {
    render(<AnalyticsPage />)
    expect(screen.getByText('Network context')).toBeInTheDocument()
  })

  it('renders available token badges in the Network context card', () => {
    render(<AnalyticsPage />)
    expect(screen.getByText('XLM')).toBeInTheDocument()
    expect(screen.getByText('USDC')).toBeInTheDocument()
    expect(screen.getByText('EURC')).toBeInTheDocument()
  })
})

// ─── Populated dataset ────────────────────────────────────────────────────────

describe('populated dataset', () => {
  const activeStream = makeStream({ id: 'stream-a' })
  const cancelledStream = makeStream({
    id: 'stream-b',
    cancelled: true,
    endTime: BigInt(NOW_SEC + 5000),
  })

  beforeEach(() => {
    mockUseStreams.mockReturnValue(
      defaultStreamsResult({ all: [activeStream, cancelledStream], loading: false }),
    )
  })

  it('renders non-zero Total streams count', () => {
    render(<AnalyticsPage />)
    // Both streams are in the all-time range ("30d" default filters by startTime >= cutoff)
    // The makeStream default startTime is relative to NOW_SEC so it falls within 30 days
    // We check that at least one of the numeric values is non-zero
    const twoText = screen.queryByText('2')
    const oneText = screen.queryByText('1')
    expect(twoText ?? oneText).toBeTruthy()
  })

  it('renders the AnalyticsCharts component', () => {
    render(<AnalyticsPage />)
    // The stub or the dynamic-wrapped real component renders with this testid
    expect(screen.getByTestId('analytics-charts')).toBeInTheDocument()
  })

  it('does not render loading skeletons when data is loaded', () => {
    render(<AnalyticsPage />)
    const skeletons = document.querySelectorAll('span.animate-pulse')
    expect(skeletons.length).toBe(0)
  })
})

// ─── Range selector ───────────────────────────────────────────────────────────

describe('range selector', () => {
  it('renders a time-range select control', () => {
    render(<AnalyticsPage />)
    // The Select renders with a visible "30 days" default value
    expect(screen.getByText('30 days')).toBeInTheDocument()
  })
})
