import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { StreamData } from '@/types/stream'

const mockUseStreams = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/use-streams', () => ({ useStreams: mockUseStreams }))

import { useActivityFeed } from '@/hooks/use-activity-feed'

const TOKEN = { address: 'CUSDC', symbol: 'USDC', decimals: 7 }

const makeStream = (overrides: Partial<StreamData> = {}): StreamData => ({
  id: '1',
  sender: 'GSENDER',
  recipient: 'GRECIPIENT',
  token: TOKEN,
  depositedAmount: 1000n,
  withdrawnAmount: 0n,
  startTime: 0n,
  endTime: 9999999999n,
  cliffTime: 0n,
  cliffAmount: 0n,
  amountPerSecond: 1n,
  linearAmount: 1000n,
  duration: 9999999999n,
  cancelled: false,
  ...overrides,
})

describe('useActivityFeed', () => {
  it('returns no events when walletAddress is null', () => {
    mockUseStreams.mockReturnValue({ all: [makeStream()] })
    const { result } = renderHook(() => useActivityFeed(null))
    expect(result.current.events).toEqual([])
    expect(result.current.total).toBe(0)
  })

  it('derives a created event for each stream', () => {
    mockUseStreams.mockReturnValue({ all: [makeStream()] })
    const { result } = renderHook(() => useActivityFeed('GSENDER'))
    expect(result.current.events.some((e) => e.type === 'stream.created')).toBe(true)
    expect(result.current.events[0].role).toBe('sent')
  })

  it('marks role as received when wallet is the recipient', () => {
    mockUseStreams.mockReturnValue({ all: [makeStream()] })
    const { result } = renderHook(() => useActivityFeed('GRECIPIENT'))
    expect(result.current.events[0].role).toBe('received')
  })

  it('adds a withdrawal event when withdrawnAmount > 0', () => {
    mockUseStreams.mockReturnValue({
      all: [makeStream({ withdrawnAmount: 500n })],
    })
    const { result } = renderHook(() => useActivityFeed('GSENDER'))
    expect(result.current.events.some((e) => e.type === 'stream.withdrawal')).toBe(true)
  })

  it('adds a cancelled event when the stream is cancelled', () => {
    mockUseStreams.mockReturnValue({
      all: [makeStream({ cancelled: true })],
    })
    const { result } = renderHook(() => useActivityFeed('GSENDER'))
    expect(result.current.events.some((e) => e.type === 'stream.cancelled')).toBe(true)
  })

  it('filters events by eventType', () => {
    mockUseStreams.mockReturnValue({
      all: [makeStream({ withdrawnAmount: 500n })],
    })
    const { result } = renderHook(() => useActivityFeed('GSENDER'))
    act(() => {
      result.current.setFilter({ eventType: 'stream.withdrawal', role: 'all' })
    })
    expect(result.current.events.every((e) => e.type === 'stream.withdrawal')).toBe(true)
  })

  it('resets to page 1 when the filter changes', () => {
    mockUseStreams.mockReturnValue({ all: [makeStream()] })
    const { result } = renderHook(() => useActivityFeed('GSENDER'))
    act(() => {
      result.current.loadMore()
    })
    act(() => {
      result.current.setFilter({ eventType: 'all', role: 'received' })
    })
    expect(result.current.events).toEqual([])
  })

  it('adds a completed event when stream has ended and all tokens are withdrawn', () => {
    mockUseStreams.mockReturnValue({
      all: [makeStream({ endTime: 1n, withdrawnAmount: 1000n })],
    })
    const { result } = renderHook(() => useActivityFeed('GSENDER'))
    expect(result.current.events.some((e) => e.type === 'stream.completed')).toBe(true)
  })

  describe('deriveEvents — description text', () => {
    const DEPOSITED = 10_000_000n // 1 USDC at 7 decimals

    it('stream.created sent: description mentions sender action and recipient address', () => {
      mockUseStreams.mockReturnValue({
        all: [makeStream({ depositedAmount: DEPOSITED })],
      })
      const { result } = renderHook(() => useActivityFeed('GSENDER'))
      const ev = result.current.events.find((e) => e.type === 'stream.created')!
      expect(ev.role).toBe('sent')
      expect(ev.description).toContain('You started streaming')
      expect(ev.description).toContain('USDC')
      expect(ev.description).toContain('GRECI')
    })

    it('stream.created received: description mentions incoming stream and sender address', () => {
      mockUseStreams.mockReturnValue({
        all: [makeStream({ depositedAmount: DEPOSITED })],
      })
      const { result } = renderHook(() => useActivityFeed('GRECIPIENT'))
      const ev = result.current.events.find((e) => e.type === 'stream.created')!
      expect(ev.role).toBe('received')
      expect(ev.description).toContain('Incoming stream of')
      expect(ev.description).toContain('USDC')
      expect(ev.description).toContain('GSEND')
    })

    it('stream.withdrawal received: "You" appears in description', () => {
      mockUseStreams.mockReturnValue({
        all: [makeStream({ depositedAmount: DEPOSITED, withdrawnAmount: 5_000_000n })],
      })
      const { result } = renderHook(() => useActivityFeed('GRECIPIENT'))
      const ev = result.current.events.find((e) => e.type === 'stream.withdrawal')!
      expect(ev.role).toBe('received')
      expect(ev.description).toContain('You withdrew')
      expect(ev.description).toContain('USDC')
    })

    it('stream.withdrawal sent: recipient address snippet appears in description', () => {
      mockUseStreams.mockReturnValue({
        all: [makeStream({ depositedAmount: DEPOSITED, withdrawnAmount: 5_000_000n })],
      })
      const { result } = renderHook(() => useActivityFeed('GSENDER'))
      const ev = result.current.events.find((e) => e.type === 'stream.withdrawal')!
      expect(ev.role).toBe('sent')
      expect(ev.description).toContain('withdrew')
      expect(ev.description).toContain('GRECI')
    })

    it('stream.cancelled sent: description contains "You cancelled" and returned amount', () => {
      mockUseStreams.mockReturnValue({
        all: [makeStream({ depositedAmount: DEPOSITED, cancelled: true })],
      })
      const { result } = renderHook(() => useActivityFeed('GSENDER'))
      const ev = result.current.events.find((e) => e.type === 'stream.cancelled')!
      expect(ev.role).toBe('sent')
      expect(ev.description).toContain('You cancelled')
      expect(ev.description).toContain('USDC returned')
    })

    it('stream.cancelled received: description contains "was cancelled" and returned amount', () => {
      mockUseStreams.mockReturnValue({
        all: [makeStream({ depositedAmount: DEPOSITED, cancelled: true })],
      })
      const { result } = renderHook(() => useActivityFeed('GRECIPIENT'))
      const ev = result.current.events.find((e) => e.type === 'stream.cancelled')!
      expect(ev.role).toBe('received')
      expect(ev.description).toContain('was cancelled')
      expect(ev.description).toContain('USDC returned')
    })

    it('stream.completed: description contains "fully unlocked" and token symbol', () => {
      mockUseStreams.mockReturnValue({
        all: [makeStream({ depositedAmount: DEPOSITED, withdrawnAmount: DEPOSITED, endTime: 1n })],
      })
      const { result } = renderHook(() => useActivityFeed('GSENDER'))
      const ev = result.current.events.find((e) => e.type === 'stream.completed')!
      expect(ev).toBeDefined()
      expect(ev.description).toContain('fully unlocked')
      expect(ev.description).toContain('USDC')
    })
  })
})
