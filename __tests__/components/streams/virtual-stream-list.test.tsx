import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VirtualStreamList } from '@/components/streams/virtual-stream-list'
import type { StreamData } from '@/types/stream'

// Same mocking convention as stream-card.test.tsx: VirtualStreamList renders
// real StreamCard rows, so its Next.js/router and wallet dependencies need
// the same lightweight stand-ins.
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

function makeStream(id: string, overrides?: Partial<StreamData>): StreamData {
  return {
    id,
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

function linksFor(container: HTMLElement) {
  return Array.from(container.querySelectorAll('a[href^="/app/stream/"]'))
}

describe('VirtualStreamList — small lists (flat rendering)', () => {
  it('renders every given stream when below the virtualization threshold', () => {
    const streams = [makeStream('stream-0'), makeStream('stream-1'), makeStream('stream-2')]
    const { container } = render(<VirtualStreamList streams={streams} />)

    expect(container.querySelector('[data-testid="stream-list-flat"]')).toBeInTheDocument()
    const links = linksFor(container)
    expect(links).toHaveLength(3)
    expect(container.querySelector('a[href="/app/stream/stream-0"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/app/stream/stream-1"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/app/stream/stream-2"]')).toBeInTheDocument()
  })

  it('renders nothing when given an empty stream list', () => {
    const { container } = render(<VirtualStreamList streams={[]} />)

    expect(linksFor(container)).toHaveLength(0)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('renders loading skeletons instead of stream cards when loading', () => {
    const { container } = render(<VirtualStreamList streams={[]} loading skeletonCount={2} />)

    expect(container.querySelector('[data-testid="stream-list-skeleton"]')).toBeInTheDocument()
    expect(linksFor(container)).toHaveLength(0)
  })
})

describe('VirtualStreamList — large lists (virtualized rendering)', () => {
  // 60 streams crosses VIRTUALIZATION_THRESHOLD (50), switching the component
  // over to the @tanstack/react-virtual code path.
  const manyStreams = Array.from({ length: 60 }, (_, i) => makeStream(`stream-${i}`))

  // jsdom never computes real layout: every element reports 0 for both
  // `offsetHeight` and `getBoundingClientRect()`. @tanstack/virtual-core
  // treats a zero-height viewport as "nothing is visible yet" and renders
  // zero rows (see `calculateRange` in @tanstack/virtual-core's
  // `Virtualizer`), and `VirtualStreamList`'s `measureElement` callback
  // (`element.getBoundingClientRect().height`) would otherwise collapse
  // every row's measured height to 0 as soon as it mounts. Stub both so a
  // realistic, stable window of rows actually renders.
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetHeight',
  )
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect

  beforeEach(() => {
    // Scroll container viewport height (read via `offsetHeight`).
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      value: 800,
    })
    // Per-row measured height (read via `getBoundingClientRect().height`) —
    // matches ESTIMATED_CARD_HEIGHT so the dynamic remeasurement pass
    // doesn't shift rows away from their estimated positions.
    Element.prototype.getBoundingClientRect = function () {
      return {
        width: 300,
        height: 160,
        top: 0,
        left: 0,
        right: 300,
        bottom: 160,
        x: 0,
        y: 0,
        toJSON() {},
      } as DOMRect
    }
  })

  afterEach(() => {
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
    }
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
  })

  it('switches to the virtualized container', () => {
    const { container } = render(<VirtualStreamList streams={manyStreams} />)
    expect(container.querySelector('[data-testid="stream-list-virtual"]')).toBeInTheDocument()
  })

  it('renders only the visible window of streams, not the full list', () => {
    const { container } = render(<VirtualStreamList streams={manyStreams} />)

    const links = linksFor(container)
    // jsdom reports a zero-height scroll container, so the virtualizer's
    // visible range collapses to the first row plus its overscan buffer —
    // far fewer than all 60 rows are ever mounted.
    expect(links.length).toBeGreaterThan(0)
    expect(links.length).toBeLessThan(manyStreams.length)

    // The first stream (top of the window) is always rendered...
    expect(container.querySelector('a[href="/app/stream/stream-0"]')).toBeInTheDocument()
    // ...while a stream far outside the window is not.
    expect(container.querySelector('a[href="/app/stream/stream-59"]')).not.toBeInTheDocument()
  })
})
