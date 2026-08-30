import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnlockChart } from '@/components/streams/unlock-chart'
import type { StreamData } from '@/types/stream'

vi.mock('@/lib/stream-utils', () => ({
  formatTokenAmount: (raw: bigint) => String(raw),
  SECONDS_PER_DAY: 86400,
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = 1_700_050_000

const baseStream: StreamData = {
  id: '1',
  sender: 'GSENDER1111111111111111111111111111111111111111',
  recipient: 'GRECIPIENT111111111111111111111111111111111111',
  token: { address: 'CXLM', symbol: 'XLM', decimals: 7 },
  depositedAmount: 1_000_000n,
  withdrawnAmount: 0n,
  startTime: 1_700_000_000n,
  endTime: 1_700_100_000n,
  cliffTime: 1_700_000_000n, // cliff == start → no cliff
  cliffAmount: 0n,
  amountPerSecond: 10n,
  linearAmount: 1_000_000n,
  duration: 100_000n,
  cancelled: false,
}

const noCliffStream: StreamData = { ...baseStream }

const cliffStream: StreamData = {
  ...baseStream,
  id: '2',
  cliffTime: 1_700_030_000n, // 30,000 s after start
  cliffAmount: 300_000n,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UnlockChart — no-cliff stream', () => {
  it('renders the SVG chart element', () => {
    render(<UnlockChart stream={noCliffStream} nowSeconds={NOW} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('renders the unlock curve path', () => {
    const { container } = render(<UnlockChart stream={noCliffStream} nowSeconds={NOW} />)
    // The unlock curve is the <path> with stroke and strokeWidth=2
    const curvePath = container.querySelector('path[stroke="currentColor"][stroke-width="2"]')
    expect(curvePath).not.toBeNull()
  })

  it('does NOT render a dashed cliff indicator line', () => {
    const { container } = render(<UnlockChart stream={noCliffStream} nowSeconds={NOW} />)
    const cliffLine = container.querySelector('line[stroke-dasharray="4 3"]')
    expect(cliffLine).toBeNull()
  })

  it('does NOT show the Cliff legend item', () => {
    render(<UnlockChart stream={noCliffStream} nowSeconds={NOW} />)
    expect(screen.queryByText('Cliff')).not.toBeInTheDocument()
  })
})

describe('UnlockChart — cliff stream', () => {
  it('renders the SVG chart element', () => {
    render(<UnlockChart stream={cliffStream} nowSeconds={NOW} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('renders the unlock curve path', () => {
    const { container } = render(<UnlockChart stream={cliffStream} nowSeconds={NOW} />)
    const curvePath = container.querySelector('path[stroke="currentColor"][stroke-width="2"]')
    expect(curvePath).not.toBeNull()
  })

  it('renders a dashed cliff indicator line', () => {
    const { container } = render(<UnlockChart stream={cliffStream} nowSeconds={NOW} />)
    const cliffLine = container.querySelector('line[stroke-dasharray="4 3"]')
    expect(cliffLine).not.toBeNull()
  })

  it('shows the Cliff legend item', () => {
    render(<UnlockChart stream={cliffStream} nowSeconds={NOW} />)
    // The legend renders "Cliff" as a text node in the DOM
    expect(screen.getAllByText('Cliff').length).toBeGreaterThan(0)
  })
})
