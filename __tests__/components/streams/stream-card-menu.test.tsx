import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StreamCard } from '@/components/streams/stream-card'
import type { StreamData } from '@/types/stream'

// Issue #917: coverage for the card menu's hide/block actions
// (handleHideToggle / handleBlockToggle in components/streams/stream-card.tsx).

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

const hidden = vi.hoisted(() => ({
  blocked: new Set<string>(),
  pinned: new Set<string>(),
  hideStream: vi.fn(),
  unhideStream: vi.fn(),
  blockSender: vi.fn(),
  unblockSender: vi.fn(),
  pinStream: vi.fn(),
  unpinStream: vi.fn(),
}))

vi.mock('@/hooks/use-hidden-streams', () => ({
  useHiddenStreams: () => ({
    isBlocked: (address: string) => hidden.blocked.has(address),
    isPinned: (id: string) => hidden.pinned.has(id),
    hideStream: hidden.hideStream,
    unhideStream: hidden.unhideStream,
    blockSender: hidden.blockSender,
    unblockSender: hidden.unblockSender,
    pinStream: hidden.pinStream,
    unpinStream: hidden.unpinStream,
  }),
}))

const TOKEN = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }

function makeStream(overrides?: Partial<StreamData>): StreamData {
  return {
    id: 'stream-abc',
    // Incoming by default: the connected wallet is the recipient.
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

function openMenu(id = 'stream-abc') {
  fireEvent.click(screen.getByTestId(`stream-card-menu-${id}`))
}

beforeEach(() => {
  vi.clearAllMocks()
  hidden.blocked.clear()
  hidden.pinned.clear()
})

describe('StreamCard — hide/block menu visibility', () => {
  it('shows Hide stream and Block sender for incoming streams', () => {
    render(<StreamCard stream={makeStream()} />)
    openMenu()
    expect(screen.getByText('Hide stream')).toBeInTheDocument()
    expect(screen.getByText('Block sender')).toBeInTheDocument()
  })

  it('does not show hide/block actions for outgoing streams', () => {
    render(<StreamCard stream={makeStream({ sender: WALLET, recipient: OTHER })} />)
    openMenu()
    // The options menu still exists (for pinning) but hide/block are absent.
    expect(screen.getByText('Pin to top')).toBeInTheDocument()
    expect(screen.queryByText('Hide stream')).not.toBeInTheDocument()
    expect(screen.queryByText('Unhide stream')).not.toBeInTheDocument()
    expect(screen.queryByText('Block sender')).not.toBeInTheDocument()
    expect(screen.queryByText('Unblock sender')).not.toBeInTheDocument()
  })

  it('does not render the options menu at all in selectable mode', () => {
    render(<StreamCard stream={makeStream()} selectable />)
    expect(screen.queryByTestId('stream-card-menu-stream-abc')).not.toBeInTheDocument()
  })
})

describe('StreamCard — hide/unhide', () => {
  it('hides the stream from the normal view', () => {
    render(<StreamCard stream={makeStream()} />)
    openMenu()
    fireEvent.click(screen.getByText('Hide stream'))

    expect(hidden.hideStream).toHaveBeenCalledWith('stream-abc')
    expect(hidden.unhideStream).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith(
      'Stream hidden',
      expect.objectContaining({ description: expect.stringContaining('Show hidden streams') }),
    )
  })

  it('shows Unhide stream in the hidden view and unhides on click', () => {
    render(<StreamCard stream={makeStream()} isHiddenView />)
    openMenu()
    expect(screen.queryByText('Hide stream')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Unhide stream'))

    expect(hidden.unhideStream).toHaveBeenCalledWith('stream-abc')
    expect(hidden.hideStream).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Stream unhidden')
  })
})

describe('StreamCard — block/unblock sender', () => {
  it('blocks the sender and also hides the stream', () => {
    render(<StreamCard stream={makeStream()} />)
    openMenu()
    fireEvent.click(screen.getByText('Block sender'))

    expect(hidden.blockSender).toHaveBeenCalledWith(OTHER)
    expect(hidden.hideStream).toHaveBeenCalledWith('stream-abc')
    expect(hidden.unblockSender).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith(
      'Sender blocked',
      expect.objectContaining({ description: expect.stringContaining('hidden automatically') }),
    )
  })

  it('shows Unblock sender for a blocked sender and unblocks on click', () => {
    hidden.blocked.add(OTHER)
    render(<StreamCard stream={makeStream()} isHiddenView />)
    openMenu()
    expect(screen.queryByText('Block sender')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Unblock sender'))

    expect(hidden.unblockSender).toHaveBeenCalledWith(OTHER)
    expect(hidden.blockSender).not.toHaveBeenCalled()
    // Unblocking leaves the stream's hidden state alone.
    expect(hidden.unhideStream).not.toHaveBeenCalled()
    expect(hidden.hideStream).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Sender unblocked')
  })
})

// Issue #916: coverage for the pin/unpin action (handlePinToggle in
// components/streams/stream-card.tsx).
describe('StreamCard — pin/unpin', () => {
  it('"Pin to top" calls pinStream and shows a pinned toast', () => {
    render(<StreamCard stream={makeStream()} />)
    openMenu()
    expect(screen.getByText('Pin to top')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Pin to top'))

    expect(hidden.pinStream).toHaveBeenCalledWith('stream-abc')
    expect(hidden.unpinStream).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Stream pinned to top')
  })

  it('shows "Unpin stream" for a pinned card and calls unpinStream', () => {
    hidden.pinned.add('stream-abc')
    render(<StreamCard stream={makeStream()} />)
    openMenu()
    expect(screen.queryByText('Pin to top')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Unpin stream'))

    expect(hidden.unpinStream).toHaveBeenCalledWith('stream-abc')
    expect(hidden.pinStream).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Stream unpinned')
  })
})
