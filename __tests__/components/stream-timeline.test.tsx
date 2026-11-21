import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StreamTimeline } from '@/components/streams/stream-timeline'
import type { TimelineEvent } from '@/hooks/use-stream-history'

const mockUseStreamHistory = vi.fn()
const mockUseNetwork = vi.fn()

vi.mock('@/hooks/use-stream-history', () => ({
  useStreamHistory: (streamId: string) => mockUseStreamHistory(streamId),
}))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => mockUseNetwork(),
}))

vi.mock('@/lib/stellar', () => ({
  explorerUrl: (network: string, kind: string, hash: string) =>
    `https://explorer/${network}/${kind}/${hash}`,
}))

function makeEvent(overrides?: Partial<TimelineEvent>): TimelineEvent {
  return {
    type: 'created',
    txHash: 'a'.repeat(20),
    timestamp: 1_700_000_000_000,
    ledger: 1,
    description: 'Stream created',
    ...overrides,
  }
}

const refetch = vi.fn()
mockUseNetwork.mockReturnValue({ network: 'testnet' })

describe('StreamTimeline', () => {
  it('shows a loading state', () => {
    mockUseStreamHistory.mockReturnValue({ events: [], loading: true, refetch })
    render(<StreamTimeline streamId="stream-1" />)
    expect(screen.getByText('Loading history…')).toBeInTheDocument()
  })

  it('shows an empty state when there is no history', () => {
    mockUseStreamHistory.mockReturnValue({ events: [], loading: false, refetch })
    render(<StreamTimeline streamId="stream-1" />)
    expect(screen.getByText('No transaction history found for this stream.')).toBeInTheDocument()
  })

  it('renders each event description and amount', () => {
    mockUseStreamHistory.mockReturnValue({
      events: [
        makeEvent({ description: 'Stream created', amount: undefined }),
        makeEvent({
          type: 'withdrawal',
          description: 'Withdrawal from stream',
          amount: '10 USDC',
          txHash: 'b'.repeat(20),
        }),
      ],
      loading: false,
      refetch,
    })
    render(<StreamTimeline streamId="stream-1" />)

    expect(screen.getByText('Stream created')).toBeInTheDocument()
    expect(screen.getByText('Withdrawal from stream')).toBeInTheDocument()
    expect(screen.getByText('Amount: 10 USDC')).toBeInTheDocument()
  })

  it('links the transaction hash to the explorer for the current network', () => {
    mockUseStreamHistory.mockReturnValue({
      events: [makeEvent({ txHash: 'c'.repeat(20) })],
      loading: false,
      refetch,
    })
    render(<StreamTimeline streamId="stream-1" />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `https://explorer/testnet/tx/${'c'.repeat(20)}`)
  })

  it('calls refetch when the refresh button is clicked', () => {
    mockUseStreamHistory.mockReturnValue({ events: [], loading: false, refetch })
    render(<StreamTimeline streamId="stream-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh timeline' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('does not show the show-more toggle with 3 or fewer events', () => {
    mockUseStreamHistory.mockReturnValue({
      events: [makeEvent(), makeEvent(), makeEvent()],
      loading: false,
      refetch,
    })
    render(<StreamTimeline streamId="stream-1" />)
    expect(screen.queryByText(/Collapse/)).not.toBeInTheDocument()
    expect(screen.queryByText(/more events/)).not.toBeInTheDocument()
  })

  it('shows all events and a Collapse control with more than 3 events, then collapses to 3 on click', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ description: `Event ${i}`, txHash: String(i).repeat(20) }),
    )
    mockUseStreamHistory.mockReturnValue({ events, loading: false, refetch })
    render(<StreamTimeline streamId="stream-1" />)

    // All 5 events shown by default, with a control to collapse them.
    events.forEach((e) => expect(screen.getByText(e.description)).toBeInTheDocument())
    const toggle = screen.getByRole('button', { name: /Collapse/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(toggle)

    // Only the first 3 remain, and the toggle now offers to show the rest.
    expect(screen.getByText('Event 0')).toBeInTheDocument()
    expect(screen.getByText('Event 2')).toBeInTheDocument()
    expect(screen.queryByText('Event 3')).not.toBeInTheDocument()
    expect(screen.queryByText('Event 4')).not.toBeInTheDocument()
    const expandButton = screen.getByRole('button', { name: 'Show 2 more events' })
    expect(expandButton).toHaveAttribute('aria-expanded', 'false')
  })
})
