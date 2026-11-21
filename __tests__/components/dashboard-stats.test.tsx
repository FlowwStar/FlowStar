import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { DashboardStats } from '@/components/streams/dashboard-stats'
import type { StreamData, TokenInfo } from '@/types/stream'

const NOW = 1_700_050_000

vi.mock('@/hooks/use-now', () => ({ useNow: vi.fn(() => NOW) }))

const showUsdMock = vi.fn()
vi.mock('@/hooks/use-show-usd', () => ({ useShowUsd: () => showUsdMock() }))

const usePortfolioValueMock = vi.fn()
vi.mock('@/hooks/use-token-price', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-token-price')>()
  return {
    ...actual,
    usePortfolioValue: (streams: StreamData[]) => usePortfolioValueMock(streams),
  }
})

const USDC: TokenInfo = { address: 'CUSDC', symbol: 'USDC', decimals: 6 }
const XLM: TokenInfo = { address: 'CXLM', symbol: 'XLM', decimals: 7 }

function makeStream(overrides: Partial<StreamData> = {}): StreamData {
  return {
    id: 'stream-1',
    sender: 'GSENDER111',
    recipient: 'GRECIPIENT222',
    token: USDC,
    depositedAmount: 1_000_000_000n,
    withdrawnAmount: 0n,
    startTime: BigInt(NOW - 1000),
    endTime: BigInt(NOW + 1000),
    cliffTime: BigInt(NOW - 1000),
    cliffAmount: 0n,
    amountPerSecond: 500_000n,
    linearAmount: 1_000_000_000n,
    duration: 2000n,
    cancelled: false,
    ...overrides,
  }
}

describe('DashboardStats', () => {
  beforeEach(() => {
    showUsdMock.mockReturnValue([false, vi.fn()])
    usePortfolioValueMock.mockReturnValue({ totalUsd: null, loading: false, stale: false })
  })

  it('shows a dash and zero counts when there are no streams', () => {
    render(<DashboardStats sent={[]} received={[]} />)

    const withdraw = screen.getByTestId('stat-available-to-withdraw')
    expect(within(withdraw).getByText('—')).toBeInTheDocument()
    expect(within(withdraw).getByText('across received streams')).toBeInTheDocument()

    const receiving = screen.getByTestId('stat-receiving')
    expect(within(receiving).getByText('0')).toBeInTheDocument()
    expect(within(receiving).getByText('0 streaming now')).toBeInTheDocument()

    const sending = screen.getByTestId('stat-sending')
    expect(within(sending).getByText('0')).toBeInTheDocument()
    expect(within(sending).getByText('0 streaming now')).toBeInTheDocument()
  })

  it('reports sent and received counts and how many are actively streaming', () => {
    const received = [
      makeStream({ id: 'r1' }), // streaming
      makeStream({ id: 'r2', startTime: BigInt(NOW + 500), endTime: BigInt(NOW + 1500) }), // scheduled
    ]
    const sent = [
      makeStream({ id: 's1' }), // streaming
      makeStream({ id: 's2' }), // streaming
      makeStream({ id: 's3', endTime: BigInt(NOW - 1) }), // completed
    ]

    render(<DashboardStats sent={sent} received={received} />)

    const receiving = screen.getByTestId('stat-receiving')
    expect(within(receiving).getByText('2')).toBeInTheDocument()
    expect(within(receiving).getByText('1 streaming now')).toBeInTheDocument()

    const sending = screen.getByTestId('stat-sending')
    expect(within(sending).getByText('3')).toBeInTheDocument()
    expect(within(sending).getByText('2 streaming now')).toBeInTheDocument()
  })

  it('sums withdrawable amounts within a single token and formats them', () => {
    // Each stream unlocks half of a 6-decimal 1,000 token deposit and has
    // withdrawn nothing, so the pair should sum to "1,000 USDC".
    const received = [
      makeStream({ id: 'r1', startTime: BigInt(NOW - 1000), endTime: BigInt(NOW + 1000) }),
      makeStream({ id: 'r2', startTime: BigInt(NOW - 1000), endTime: BigInt(NOW + 1000) }),
    ]

    render(<DashboardStats sent={[]} received={received} />)

    const withdraw = screen.getByTestId('stat-available-to-withdraw')
    expect(within(withdraw).getByText('1,000')).toBeInTheDocument()
    expect(within(withdraw).getByText('USDC')).toBeInTheDocument()
    expect(within(withdraw).getByText('across received streams')).toBeInTheDocument()
  })

  it('shows the dominant token plus a count of additional tokens when multiple tokens are withdrawable', () => {
    const received = [
      makeStream({
        id: 'r1',
        token: USDC,
        depositedAmount: 1_000_000_000n,
        linearAmount: 1_000_000_000n,
        duration: 1000n,
        startTime: BigInt(NOW - 1000),
        endTime: BigInt(NOW + 1000),
      }),
      makeStream({
        id: 'r2',
        token: XLM,
        depositedAmount: 1_000_000_000n,
        linearAmount: 1_000n,
        duration: 1000n,
        startTime: BigInt(NOW - 1000),
        endTime: BigInt(NOW + 1000),
      }),
    ]

    render(<DashboardStats sent={[]} received={received} />)

    const withdraw = screen.getByTestId('stat-available-to-withdraw')
    expect(within(withdraw).getByText('USDC')).toBeInTheDocument()
    expect(within(withdraw).getByText('+1 more token')).toBeInTheDocument()
  })

  it('shows zero available when the only received stream has not reached its cliff yet', () => {
    const received = [
      makeStream({
        id: 'r1',
        cliffTime: BigInt(NOW + 500),
        startTime: BigInt(NOW - 500),
        endTime: BigInt(NOW + 1500),
      }),
    ]

    render(<DashboardStats sent={[]} received={received} />)

    const withdraw = screen.getByTestId('stat-available-to-withdraw')
    expect(within(withdraw).getByText('0')).toBeInTheDocument()
    expect(within(withdraw).getByText('USDC')).toBeInTheDocument()
  })

  it('shows the portfolio USD total when USD display is enabled', () => {
    showUsdMock.mockReturnValue([true, vi.fn()])
    usePortfolioValueMock.mockReturnValue({ totalUsd: 1234.5, loading: false, stale: false })

    render(<DashboardStats sent={[]} received={[makeStream()]} />)

    const total = screen.getByTestId('stat-total-streaming')
    expect(within(total).getByText('$1,234.50')).toBeInTheDocument()
    expect(within(total).getByText('locked across all streams')).toBeInTheDocument()
  })

  it('shows a dash and a settings hint when USD display is disabled', () => {
    render(<DashboardStats sent={[]} received={[]} />)

    const total = screen.getByTestId('stat-total-streaming')
    expect(within(total).getByText('—')).toBeInTheDocument()
    expect(within(total).getByText('enable USD in settings')).toBeInTheDocument()
  })
})
