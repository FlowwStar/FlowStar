import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreamCard } from '@/components/streams/stream-card'
import type { StreamData } from '@/types/stream'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/hooks/use-now', () => ({ useNow: vi.fn(() => 1_700_050_000) }))
vi.mock('@/hooks/use-wallet', () => ({ useWallet: vi.fn(() => ({ address: 'GSENDER111' })) }))

const TOKEN = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }
const NOW = 1_700_050_000

function makeStream(overrides?: Partial<StreamData>): StreamData {
  return {
    id: 'stream-abc',
    sender: 'GSENDER111',
    recipient: 'GRCPT222',
    token: TOKEN,
    depositedAmount: 100_000_000n,
    withdrawnAmount: 0n,
    startTime: BigInt(NOW - 3600),
    endTime: BigInt(NOW + 3600),
    cliffTime: BigInt(NOW - 3600),
    cliffAmount: 0n,
    amountPerSecond: 27_777n,
    linearAmount: 100_000_000n,
    duration: 7200n,
    cancelled: false,
    ...overrides,
  }
}

describe('StreamCard', () => {
  it('renders link to stream detail page', () => {
    render(<StreamCard stream={makeStream()} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/app/stream/stream-abc')
  })

  it('shows Streaming badge for active stream', () => {
    render(<StreamCard stream={makeStream()} />)
    expect(screen.getByText('Streaming')).toBeInTheDocument()
  })

  it('shows Completed badge for ended stream', () => {
    render(<StreamCard stream={makeStream({ endTime: BigInt(NOW - 100) })} />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('shows Cancelled badge for cancelled stream', () => {
    render(<StreamCard stream={makeStream({ cancelled: true })} />)
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('shows Scheduled badge for not-yet-started stream', () => {
    render(
      <StreamCard
        stream={makeStream({
          startTime: BigInt(NOW + 3600),
          endTime: BigInt(NOW + 7200),
          cliffTime: BigInt(NOW + 3600),
        })}
      />,
    )
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
  })

  it('shows "Sending to" label for outgoing stream', () => {
    render(<StreamCard stream={makeStream()} />)
    expect(screen.getByText('Sending to')).toBeInTheDocument()
  })

  it('shows "Receiving from" label for incoming stream', () => {
    render(<StreamCard stream={makeStream({ sender: 'GOTHER', recipient: 'GSENDER111' })} />)
    expect(screen.getByText('Receiving from')).toBeInTheDocument()
  })

  it('renders a progress bar with aria attributes', () => {
    render(<StreamCard stream={makeStream()} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeInTheDocument()
    expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
  })

  it('has aria-label describing direction, amount, and status', () => {
    render(<StreamCard stream={makeStream()} />)
    const label = screen.getByRole('link').getAttribute('aria-label') ?? ''
    expect(label).toContain('Sending')
    expect(label).toContain('USDC')
    expect(label).toContain('streaming')
  })

  it('shows token symbol', () => {
    render(<StreamCard stream={makeStream()} />)
    expect(screen.getAllByText('USDC').length).toBeGreaterThan(0)
  })

  it('shows "Ended" label for completed/cancelled streams', () => {
    render(<StreamCard stream={makeStream({ endTime: BigInt(NOW - 100) })} />)
    expect(screen.getByText('Ended')).toBeInTheDocument()
  })
})
