'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useStreams } from '@/hooks/use-streams'
import type { StreamData } from '@/types/stream'

export type ActivityEventType =
  | 'stream.created'
  | 'stream.withdrawal'
  | 'stream.cancelled'
  | 'stream.completed'
  | 'stream.topped_up'
  | 'stream.transferred'

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  streamId: string
  timestamp: number
  role: 'sent' | 'received'
  description: string
  token: string
  amount?: string
}

function deriveEvents(streams: StreamData[], walletAddress: string): ActivityEvent[] {
  const events: ActivityEvent[] = []
  const now = BigInt(Math.floor(Date.now() / 1000))

  for (const s of streams) {
    const role: 'sent' | 'received' = s.sender.toLowerCase() === walletAddress.toLowerCase()
      ? 'sent'
      : 'received'

    const fmt = (amount: bigint) =>
      (Number(amount) / 10 ** s.token.decimals).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })

    // Created event
    events.push({
      id: `created-${s.id}`,
      type: 'stream.created',
      streamId: s.id,
      timestamp: Number(s.startTime) * 1000,
      role,
      description:
        role === 'sent'
          ? `You started streaming ${fmt(s.depositedAmount)} ${s.token.symbol} to ${s.recipient.slice(0, 6)}…${s.recipient.slice(-4)}`
          : `Incoming stream of ${fmt(s.depositedAmount)} ${s.token.symbol} from ${s.sender.slice(0, 6)}…${s.sender.slice(-4)}`,
      token: s.token.symbol,
      amount: fmt(s.depositedAmount),
    })

    // Withdrawal event (infer from withdrawn amount)
    if (s.withdrawnAmount > 0n) {
      events.push({
        id: `withdrawal-${s.id}`,
        type: 'stream.withdrawal',
        streamId: s.id,
        timestamp: Number(s.startTime) * 1000 + 1,
        role,
        description: `${role === 'received' ? 'You' : s.recipient.slice(0, 6) + '…'} withdrew ${fmt(s.withdrawnAmount)} ${s.token.symbol} from Stream #${s.id}`,
        token: s.token.symbol,
        amount: fmt(s.withdrawnAmount),
      })
    }

    // Cancelled
    if (s.cancelled) {
      const returned = s.depositedAmount - s.withdrawnAmount
      events.push({
        id: `cancelled-${s.id}`,
        type: 'stream.cancelled',
        streamId: s.id,
        timestamp: Number(s.endTime) * 1000,
        role,
        description:
          role === 'sent'
            ? `You cancelled Stream #${s.id} — ${fmt(returned)} ${s.token.symbol} returned`
            : `Stream #${s.id} was cancelled — ${fmt(returned)} ${s.token.symbol} returned`,
        token: s.token.symbol,
        amount: fmt(returned),
      })
    }

    // Completed
    if (!s.cancelled && now >= s.endTime && s.withdrawnAmount >= s.depositedAmount) {
      events.push({
        id: `completed-${s.id}`,
        type: 'stream.completed',
        streamId: s.id,
        timestamp: Number(s.endTime) * 1000,
        role,
        description: `Stream #${s.id} fully unlocked — ${fmt(s.depositedAmount)} ${s.token.symbol}`,
        token: s.token.symbol,
        amount: fmt(s.depositedAmount),
      })
    }
  }

  return events.sort((a, b) => b.timestamp - a.timestamp)
}

export type ActivityFilter = {
  eventType: ActivityEventType | 'all'
  role: 'sent' | 'received' | 'all'
}

const PAGE_SIZE = 20

/**
 * Derives and paginates the activity feed for a wallet from the streams it
 * participates in.
 *
 * Filtering contract: events are derived from `useStreams().all` and narrowed
 * by the `filter` state, which matches on both `eventType` (an
 * `ActivityEventType` or `'all'`) and `role` (`'sent'`, `'received'`, or
 * `'all'`). A filter value of `'all'` disables that dimension. The returned
 * `total` reflects the number of events matching the current filter, and
 * `setFilter` updates the filter (resetting pagination to the first page).
 *
 * Pagination contract: matching events are exposed in pages of `PAGE_SIZE`
 * (20) via `events`, which always contains the first `page * PAGE_SIZE`
 * matches. `hasMore` is `true` while more matches remain beyond the visible
 * slice, and `loadMore` advances to the next page. Changing the filter resets
 * the page back to 1.
 *
 * @param walletAddress - Address used to derive events and determine each
 *   event's `sent`/`received` role; when `null`, no events are produced.
 * @returns The visible `events`, `hasMore`, `loadMore`, the current `filter`
 *   and `setFilter`, and the filtered `total` count.
 */
export function useActivityFeed(walletAddress: string | null) {
  const { all } = useStreams()
  const [filter, setFilter] = useState<ActivityFilter>({ eventType: 'all', role: 'all' })
  const [page, setPage] = useState(1)

  const allEvents = walletAddress ? deriveEvents(all, walletAddress) : []

  const filtered = allEvents.filter((e) => {
    if (filter.eventType !== 'all' && e.type !== filter.eventType) return false
    if (filter.role !== 'all' && e.role !== filter.role) return false
    return true
  })

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < filtered.length

  const loadMore = useCallback(() => setPage((p) => p + 1), [])

  // Reset page when filter changes
  useEffect(() => setPage(1), [filter])

  return { events: visible, hasMore, loadMore, filter, setFilter, total: filtered.length }
}
