import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { StreamData } from '@/types/stream'

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/contract', () => ({
  fetchStreamsForAddress: vi.fn(),
}))

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: vi.fn(() => ({
    network: 'testnet',
    config: { rpcUrl: 'https://rpc.test', streamContractId: 'CONTRACT123' },
  })),
}))

// The real SDK parses genuine XDR; tests only need to prove that
// `decodeEventStreamId` -> `scValToNative(xdr.ScVal.fromXDR(...))` is fed
// into the wallet-scoping filter, so the mock treats `value.xdr` as a
// pre-serialized JSON payload instead of real base64 XDR.
vi.mock('@stellar/stellar-sdk', () => ({
  xdr: { ScVal: { fromXDR: (raw: string) => raw } },
  scValToNative: (raw: string) => JSON.parse(raw),
}))

import { fetchStreamsForAddress } from '@/lib/contract'
import { useNotifications } from '@/hooks/use-notifications'

const WALLET = 'GWALLET_SELF'
const OTHER = 'GWALLET_OTHER'

const myStreams: StreamData[] = [
  {
    id: '1', // sent by the connected wallet
    sender: WALLET,
    recipient: OTHER,
    token: { address: 'TOKEN', symbol: 'USDC', decimals: 7 },
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
  },
  {
    id: '2', // received by the connected wallet
    sender: OTHER,
    recipient: WALLET,
    token: { address: 'TOKEN', symbol: 'USDC', decimals: 7 },
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
  },
]

function makeEvent(topic: string, streamId: string) {
  return {
    type: 'contract',
    ledger: 501,
    topic: [topic],
    value: { xdr: JSON.stringify({ stream_id: streamId }) },
  }
}

const NOTIF_STORAGE_KEY = 'flowstar:notifications'

function seedNotifications() {
  const now = Date.now()
  return [
    {
      id: 'n1',
      type: 'stream_created' as const,
      title: 'New stream received',
      body: 'A new payment stream has been created for you.',
      timestamp: now,
      read: false,
    },
    {
      id: 'n2',
      type: 'withdrawal' as const,
      title: 'Withdrawal from your stream',
      body: 'A withdrawal has been made from a stream you sent.',
      timestamp: now - 1000,
      read: false,
    },
    {
      id: 'n3',
      type: 'stream_cancelled' as const,
      title: 'Stream cancelled',
      body: 'A stream you are receiving has been cancelled.',
      timestamp: now - 2000,
      read: true,
    },
  ]
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Seed a non-zero last-seen ledger so the first poll fetches events
    // immediately instead of only bootstrapping the ledger cursor.
    localStorage.setItem('flowstar:last-seen-ledger', '500')
    vi.mocked(fetchStreamsForAddress).mockResolvedValue(myStreams)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('only surfaces notifications for streams the wallet actually sent or received', async () => {
    const events = [
      makeEvent('StreamCreatedEvent', '2'), // received by wallet -> notify
      makeEvent('StreamCreatedEvent', '99'), // unrelated stream -> no notify
      makeEvent('WithdrawEvent', '1'), // wallet is sender -> notify
      makeEvent('WithdrawEvent', '2'), // wallet is recipient, not sender -> no notify
      makeEvent('CancelEvent', '2'), // received by wallet -> notify
      makeEvent('CancelEvent', '99'), // unrelated stream -> no notify
    ]

    global.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string)
      if (body.method === 'getEvents') {
        return {
          json: async () => ({ result: { events, latestLedger: 505 } }),
        } as Response
      }
      return { json: async () => ({ result: {} }) } as Response
    })

    const { result } = renderHook(() => useNotifications(WALLET))

    await waitFor(() => expect(result.current.notifications).toHaveLength(3))

    expect(fetchStreamsForAddress).toHaveBeenCalledWith('testnet', WALLET)

    const bodies = result.current.notifications.map((n) => n.body)
    expect(bodies).toContain('A new payment stream has been created for you.')
    expect(bodies).toContain('A withdrawal has been made from a stream you sent.')
    expect(bodies).toContain('A stream you are receiving has been cancelled.')
  })

  it('does not notify at all when none of the events belong to the wallet', async () => {
    const events = [
      makeEvent('StreamCreatedEvent', '99'),
      makeEvent('WithdrawEvent', '99'),
      makeEvent('CancelEvent', '99'),
    ]

    global.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string)
      if (body.method === 'getEvents') {
        return {
          json: async () => ({ result: { events, latestLedger: 505 } }),
        } as Response
      }
      return { json: async () => ({ result: {} }) } as Response
    })

    const { result } = renderHook(() => useNotifications(WALLET))

    await waitFor(() => expect(fetchStreamsForAddress).toHaveBeenCalled())
    // Give the poll a tick to process events before asserting nothing landed.
    await new Promise((r) => setTimeout(r, 0))

    expect(result.current.notifications).toHaveLength(0)
  })

  it('accumulates notifications from a single poll and persists them', async () => {
    const events = [
      makeEvent('StreamCreatedEvent', '2'), // received by wallet -> notify
      makeEvent('WithdrawEvent', '1'), // wallet is sender -> notify
      makeEvent('CancelEvent', '2'), // received by wallet -> notify
    ]

    global.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string)
      if (body.method === 'getEvents') {
        return {
          json: async () => ({ result: { events, latestLedger: 505 } }),
        } as Response
      }
      return { json: async () => ({ result: {} }) } as Response
    })

    const { result } = renderHook(() => useNotifications(WALLET))

    await waitFor(() => expect(result.current.notifications).toHaveLength(3))

    expect(result.current.unreadCount).toBe(3)

    // New notifications are prepended, newest first.
    const bodies = result.current.notifications.map((n) => n.body)
    expect(bodies[0]).toBe('A stream you are receiving has been cancelled.')
    expect(bodies[1]).toBe('A withdrawal has been made from a stream you sent.')
    expect(bodies[2]).toBe('A new payment stream has been created for you.')

    const persisted = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) ?? '[]')
    expect(persisted).toHaveLength(3)
  })

  it('accumulates notifications across polls without duplicating', async () => {
    vi.useFakeTimers()
    const batches = [[makeEvent('StreamCreatedEvent', '2')], [makeEvent('WithdrawEvent', '1')]]
    let getEventsCalls = 0

    global.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string)
      if (body.method === 'getEvents') {
        const events = batches[getEventsCalls] ?? []
        getEventsCalls += 1
        return {
          json: async () => ({
            result: { events, latestLedger: 505 + getEventsCalls },
          }),
        } as Response
      }
      return { json: async () => ({ result: {} }) } as Response
    })

    const { result } = renderHook(() => useNotifications(WALLET))

    // Flush the initial poll (it runs on mount, not on a timer), which is
    // purely microtask-driven once the fetch mock resolves immediately.
    // waitFor can't be used here: it hangs under vitest fake timers.
    await act(async () => {
      for (let i = 0; i < 10; i += 1) await Promise.resolve()
    })
    expect(result.current.notifications).toHaveLength(1)

    // Advance past POLL_INTERVAL (30s) so the second poll runs.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(result.current.notifications).toHaveLength(2)
    expect(getEventsCalls).toBe(2)

    const persisted = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) ?? '[]')
    expect(persisted).toHaveLength(2)
  })

  it('restores persisted notifications and computes unreadCount on mount', () => {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(seedNotifications()))

    const { result } = renderHook(() => useNotifications(null))

    expect(result.current.notifications).toHaveLength(3)
    expect(result.current.unreadCount).toBe(2)
    expect(result.current.notifications[0].id).toBe('n1')
  })

  it('markAllRead marks every notification as read and updates unreadCount', () => {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(seedNotifications()))

    const { result } = renderHook(() => useNotifications(null))
    expect(result.current.unreadCount).toBe(2)

    act(() => {
      result.current.markAllRead()
    })

    expect(result.current.unreadCount).toBe(0)
    expect(result.current.notifications.every((n) => n.read)).toBe(true)

    const persisted = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) ?? '[]')
    expect(persisted).toHaveLength(3)
    expect(persisted.every((n: { read: boolean }) => n.read)).toBe(true)
  })

  it('clearAll dismisses all notifications and clears persisted state', () => {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(seedNotifications()))

    const { result } = renderHook(() => useNotifications(null))
    expect(result.current.notifications).toHaveLength(3)

    act(() => {
      result.current.clearAll()
    })

    expect(result.current.notifications).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)
    expect(localStorage.getItem(NOTIF_STORAGE_KEY)).toBe('[]')
  })
})
