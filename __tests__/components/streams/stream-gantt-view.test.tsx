import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreamGanttView } from '@/components/streams/stream-gantt-view'
import type { StreamData } from '@/types/stream'

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: vi.fn(() => ({ address: 'GOUTGOING1111111111111111111111111111111111111111111' })),
}))

const TOKEN = { address: 'CCUSDC', symbol: 'USDC', decimals: 7 }

function makeStream(overrides?: Partial<StreamData>): StreamData {
  return {
    id: 'stream-1',
    sender: 'GOUTGOING1111111111111111111111111111111111111111111111',
    recipient: 'GRECEIVING2222222222222222222222222222222222222222222222',
    token: TOKEN,
    depositedAmount: 10_000_000n,
    withdrawnAmount: 0n,
    startTime: 1_000n,
    endTime: 6_000n,
    cliffTime: 1_500n,
    cliffAmount: 0n,
    amountPerSecond: 2_000n,
    linearAmount: 10_000_000n,
    duration: 5_000n,
    cancelled: false,
    metadata: { name: 'Alpha', category: 'payroll', memo: 'memo' },
    ...overrides,
  }
}

describe('StreamGanttView', () => {
  it('renders one bar per stream and positions each bar based on its start and end times', () => {
    const streams = [
      makeStream({ id: 'stream-1', startTime: 1_000n, endTime: 3_000n, cliffTime: 1_500n }),
      makeStream({
        id: 'stream-2',
        sender: 'GOTHER1111111111111111111111111111111111111111111111',
        recipient: 'GOUTGOING1111111111111111111111111111111111111111111111',
        startTime: 2_000n,
        endTime: 8_000n,
        cliffTime: 3_000n,
        metadata: { name: 'Beta', category: 'payroll', memo: 'memo' },
      }),
    ]

    const nowSeconds = 4_000
    const { container } = render(<StreamGanttView streams={streams} nowSeconds={nowSeconds} />)

    const bars = container.querySelectorAll('.group\\/bar')
    expect(bars).toHaveLength(2)

    const rawMin = Math.min(...streams.map((s) => Number(s.startTime)), nowSeconds)
    const rawMax = Math.max(...streams.map((s) => Number(s.endTime)), nowSeconds)
    const pad = Math.max((rawMax - rawMin) * 0.05, 3600)
    const rangeStart = rawMin - pad
    const rangeEnd = rawMax + pad
    const rangeSpan = Math.max(rangeEnd - rangeStart, 1)
    const pct = (value: number) => ((value - rangeStart) / rangeSpan) * 100

    const [first, second] = Array.from(bars)

    expect(first).toHaveStyle({ left: `${pct(Number(streams[0].startTime))}%` })
    expect(first).toHaveStyle({
      width: `${pct(Number(streams[0].endTime)) - pct(Number(streams[0].startTime))}%`,
    })

    expect(second).toHaveStyle({ left: `${pct(Number(streams[1].startTime))}%` })
    expect(second).toHaveStyle({
      width: `${pct(Number(streams[1].endTime)) - pct(Number(streams[1].startTime))}%`,
    })

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Streaming')).toBeInTheDocument()
  })
})
