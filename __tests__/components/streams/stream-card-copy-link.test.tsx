import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StreamCard } from '@/components/streams/stream-card'
import type { StreamData } from '@/types/stream'

// Issue #918: coverage for the copy-link quick action
// (handleCopyLink in components/streams/stream-card.tsx).

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const WALLET = 'GWALLET111'
const OTHER = 'GOTHER222'
const NOW = 1_700_050_000

vi.mock('@/hooks/use-now', () => ({ useNow: vi.fn(() => NOW) }))
vi.mock('@/hooks/use-wallet', () => ({ useWallet: vi.fn(() => ({ address: WALLET })) }))
vi.mock('@/hooks/use-token-price', () => ({
  useTokenPrice: vi.fn(() => ({ usdPrice: null, loading: false })),
  formatUsd: (n: number) => `$${n}`,
}))

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }))

vi.mock('@/hooks/use-hidden-streams', () => ({
  useHiddenStreams: () => ({
    isBlocked: () => false,
    isPinned: () => false,
    hideStream: vi.fn(),
    unhideStream: vi.fn(),
    blockSender: vi.fn(),
    unblockSender: vi.fn(),
    pinStream: vi.fn(),
    unpinStream: vi.fn(),
  }),
}))

const TOKEN = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }

function makeStream(overrides?: Partial<StreamData>): StreamData {
  return {
    id: 'stream-abc',
    sender: OTHER,
    recipient: WALLET,
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

const mockWriteText = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: mockWriteText },
    configurable: true,
  })
  Object.defineProperty(window, 'location', {
    value: { origin: 'https://app.flowstar.io' },
    writable: true,
  })
})

describe('StreamCard — copy link', () => {
  it('writes <origin>/app/stream/<id> to the clipboard', () => {
    render(<StreamCard stream={makeStream()} />)
    fireEvent.click(screen.getByTestId('stream-card-copy-link-stream-abc'))
    expect(mockWriteText).toHaveBeenCalledWith('https://app.flowstar.io/app/stream/stream-abc')
    expect(toastSuccess).toHaveBeenCalledWith('Link copied to clipboard')
  })

  it('does not navigate the card link when copy-link is clicked', () => {
    render(<StreamCard stream={makeStream()} />)
    const link = screen.getByRole('link')
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
    const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault')

    fireEvent.click(screen.getByTestId('stream-card-copy-link-stream-abc'))

    // The quick-action's own click handler calls preventDefault/stopPropagation,
    // which is what stops the surrounding <Link> from navigating.
    expect(mockWriteText).toHaveBeenCalledTimes(1)
    expect(link).toHaveAttribute('href', '/app/stream/stream-abc')
    preventDefaultSpy.mockRestore()
  })

  it('shows the check icon briefly, then resets to the link icon', async () => {
    render(<StreamCard stream={makeStream()} />)
    const button = screen.getByTestId('stream-card-copy-link-stream-abc')
    expect(button.querySelector('svg')).not.toBeNull()

    fireEvent.click(button)

    // Immediately after the click, the check icon is shown.
    await waitFor(() => {
      expect(button.innerHTML).toContain('check')
    })

    // After the reset timeout, it reverts to the link icon.
    await waitFor(
      () => {
        expect(button.innerHTML).not.toContain('check')
      },
      { timeout: 2000 },
    )
  })
})
