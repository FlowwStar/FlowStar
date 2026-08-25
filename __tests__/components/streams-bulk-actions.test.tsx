import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { StreamData } from '@/types/stream'

// ── Hoisted fixtures / mocks ────────────────────────────────────────────────

const NOW = 1_000_000

const STREAMS = vi.hoisted((): StreamData[] => [
  {
    id: 'withdrawable-1',
    sender: 'GOTHER',
    recipient: 'GSENDER',
    token: { address: 'CUSDC', symbol: 'USDC', decimals: 7 },
    depositedAmount: 1_100n,
    withdrawnAmount: 0n,
    startTime: BigInt(1_000_000 - 100),
    endTime: BigInt(1_000_000 + 1_000),
    cliffTime: BigInt(1_000_000 - 100),
    cliffAmount: 0n,
    amountPerSecond: 1n,
    linearAmount: 1_100n,
    duration: 1_100n,
    cancelled: false,
  },
  {
    id: 'cancellable-1',
    sender: 'GSENDER',
    recipient: 'GOTHER',
    token: { address: 'CUSDC', symbol: 'USDC', decimals: 7 },
    depositedAmount: 1_100n,
    withdrawnAmount: 0n,
    startTime: BigInt(1_000_000 - 100),
    endTime: BigInt(1_000_000 + 1_000),
    cliffTime: BigInt(1_000_000 - 100),
    cliffAmount: 0n,
    amountPerSecond: 1n,
    linearAmount: 1_100n,
    duration: 1_100n,
    cancelled: false,
  },
])

const mockWithdraw = vi.hoisted(() => vi.fn(() => Promise.resolve('tx-hash')))
const mockCancel = vi.hoisted(() => vi.fn(() => Promise.resolve('tx-hash')))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: () => ({ address: 'GSENDER', isConnected: true, reconnecting: false }),
}))

vi.mock('@/hooks/use-streams', () => ({
  useStreams: () => ({ all: STREAMS }),
}))

vi.mock('@/hooks/use-now', () => ({
  useNow: () => 1_000_000,
}))

vi.mock('@/hooks/use-contract', () => ({
  useContract: () => ({ withdraw: mockWithdraw, cancel: mockCancel }),
}))

vi.mock('@/components/streams/stream-card', () => ({
  StreamCard: ({
    stream,
    selectable,
    selected,
    onToggleSelect,
  }: {
    stream: StreamData
    selectable?: boolean
    selected?: boolean
    onToggleSelect?: (id: string) => void
  }) => (
    <div data-testid={`stream-card-${stream.id}`}>
      {selectable && (
        <input
          type="checkbox"
          aria-label={`Select stream ${stream.id}`}
          data-testid={`stream-card-select-${stream.id}`}
          checked={!!selected}
          onChange={() => onToggleSelect?.(stream.id)}
        />
      )}
      {stream.id}
    </div>
  ),
}))

import StreamsRoute from '@/app/app/streams/page'

describe('Streams page bulk select + bulk actions', () => {
  beforeEach(() => {
    mockWithdraw.mockClear()
    mockCancel.mockClear()
  })

  it('withdraws only the selected streams the wallet can withdraw from', async () => {
    render(<StreamsRoute />)

    fireEvent.click(screen.getByTestId('bulk-select-toggle'))
    fireEvent.click(screen.getByTestId('stream-card-select-withdrawable-1'))
    fireEvent.click(screen.getByTestId('stream-card-select-cancellable-1'))

    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent('2 selected')
    // Only one of the two selected streams is withdrawable by this wallet.
    expect(screen.getByTestId('bulk-withdraw-button')).toHaveTextContent('Withdraw (1)')

    fireEvent.click(screen.getByTestId('bulk-withdraw-button'))

    await waitFor(() => {
      expect(screen.getByTestId('bulk-results')).toHaveTextContent('1 succeeded, 0 failed')
    })

    expect(mockWithdraw).toHaveBeenCalledTimes(1)
    expect(mockWithdraw).toHaveBeenCalledWith('withdrawable-1', 100n)
    expect(mockCancel).not.toHaveBeenCalled()
  })

  it('cancels only the selected streams the wallet can cancel', async () => {
    render(<StreamsRoute />)

    fireEvent.click(screen.getByTestId('bulk-select-toggle'))
    fireEvent.click(screen.getByTestId('stream-card-select-withdrawable-1'))
    fireEvent.click(screen.getByTestId('stream-card-select-cancellable-1'))

    expect(screen.getByTestId('bulk-cancel-button')).toHaveTextContent('Cancel (1)')

    fireEvent.click(screen.getByTestId('bulk-cancel-button'))

    await waitFor(() => {
      expect(screen.getByTestId('bulk-results')).toHaveTextContent('1 succeeded, 0 failed')
    })

    expect(mockCancel).toHaveBeenCalledTimes(1)
    expect(mockCancel).toHaveBeenCalledWith('cancellable-1')
    expect(mockWithdraw).not.toHaveBeenCalled()
  })

  it('exiting select mode clears the selection and results', () => {
    render(<StreamsRoute />)

    fireEvent.click(screen.getByTestId('bulk-select-toggle'))
    fireEvent.click(screen.getByTestId('stream-card-select-withdrawable-1'))
    expect(screen.getByTestId('bulk-selected-count')).toHaveTextContent('1 selected')

    fireEvent.click(screen.getByTestId('bulk-select-toggle'))

    expect(screen.queryByTestId('bulk-selected-count')).not.toBeInTheDocument()
    expect(screen.getByTestId('bulk-select-toggle')).toHaveTextContent('Select')
  })
})
