'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNetwork } from '@/components/providers/network-provider'

/** Kind of lifecycle event shown on a stream's timeline. */
export type TimelineEventType =
  | 'created'
  | 'withdrawal'
  | 'topup'
  | 'transfer'
  | 'cancellation'

/** One entry on a stream's timeline, built from a contract event. */
export interface TimelineEvent {
  type: TimelineEventType
  /** Hash of the transaction that emitted the event; `''` if the RPC omitted it. */
  txHash: string
  /** ms since epoch from the event's `ledgerClosedAt`, or fetch time if missing. */
  timestamp: number
  ledger: number
  /** Fixed human-readable label for `type`, e.g. "Stream created". */
  description: string
  /** Not populated yet: the event payload (`value.xdr`) isn't decoded. */
  amount?: string
  /** Not populated yet. */
  from?: string
  /** Not populated yet. */
  to?: string
}

/**
 * Classifies a raw event by case-insensitive substring match on its topic
 * strings. Returns `null` for events that don't map to a timeline type.
 */
function decodeEventType(topics: string[]): TimelineEventType | null {
  const joined = topics.join(',').toLowerCase()
  if (joined.includes('create') || joined.includes('stream_created')) return 'created'
  if (joined.includes('withdraw')) return 'withdrawal'
  if (joined.includes('topup') || joined.includes('top_up') || joined.includes('deposit')) return 'topup'
  if (joined.includes('transfer')) return 'transfer'
  if (joined.includes('cancel')) return 'cancellation'
  return null
}

interface HorizonTransaction {
  hash: string
  ledger: number
  created_at: string
  envelope_xdr?: string
}

/**
 * Unused: not called anywhere; `useStreamHistory` reads only from Soroban RPC
 * (see #363). It lists Horizon transactions for the contract account and
 * labels every one as `'created'`. Horizon generally doesn't index Soroban
 * contract accounts, so it usually returns `[]`.
 */
async function fetchHorizonTransactions(
  horizonUrl: string,
  contractId: string,
  streamId: string,
): Promise<TimelineEvent[]> {
  if (!contractId) return []

  const events: TimelineEvent[] = []

  try {
    const res = await fetch(
      `${horizonUrl}/accounts/${contractId}/transactions?limit=200&order=desc`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) return []
    const data = await res.json() as { _embedded?: { records?: HorizonTransaction[] } }
    const records = data._embedded?.records ?? []

    for (const tx of records) {
      events.push({
        type: 'created',
        txHash: tx.hash,
        timestamp: new Date(tx.created_at).getTime(),
        ledger: tx.ledger,
        description: `Transaction on stream #${streamId}`,
      })
    }
  } catch {
    // Horizon may not index Soroban contract accounts — fall back to empty
  }

  return events
}

/**
 * Fetches up to 200 of the streaming contract's events via Soroban RPC
 * `getEvents`, starting at ledger 1, and maps them to timeline entries.
 *
 * Caveats:
 * - `streamId` is accepted but not used to filter, so the result covers
 *   every stream on the contract, not just this one.
 * - RPC nodes keep events only for a limited window, so `startLedger: 1` is
 *   usually rejected. That error has no `result`, so the function returns `[]`.
 *
 * Never throws. Returns `[]` on any failure.
 */
async function fetchRpcEvents(
  rpcUrl: string,
  contractId: string,
  streamId: string,
): Promise<TimelineEvent[]> {
  if (!contractId) return []

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getEvents',
        params: {
          startLedger: 1,
          filters: [
            {
              type: 'contract',
              contractIds: [contractId],
            },
          ],
          pagination: { limit: 200 },
        },
      }),
    })

    const json = await res.json() as {
      result?: {
        events?: Array<{
          type: string
          ledger: number
          ledgerClosedAt: string
          txHash: string
          topic: string[]
          value: { xdr: string }
        }>
      }
    }

    const raw = json.result?.events ?? []
    const events: TimelineEvent[] = []

    for (const ev of raw) {
      const eventType = decodeEventType(ev.topic ?? [])
      if (!eventType) continue

      const ts = ev.ledgerClosedAt
        ? new Date(ev.ledgerClosedAt).getTime()
        : Date.now()

      let description = ''
      switch (eventType) {
        case 'created':
          description = 'Stream created'
          break
        case 'withdrawal':
          description = 'Withdrawal from stream'
          break
        case 'topup':
          description = 'Stream topped up'
          break
        case 'transfer':
          description = 'Stream transferred to new recipient'
          break
        case 'cancellation':
          description = 'Stream cancelled'
          break
      }

      events.push({
        type: eventType,
        txHash: ev.txHash ?? '',
        timestamp: ts,
        ledger: ev.ledger,
        description,
      })
    }

    return events
  } catch {
    return []
  }
}

/**
 * Loads the event timeline for a stream.
 *
 * Data source: Soroban RPC `getEvents` on the network's stream contract
 * (`config.rpcUrl`, `config.streamContractId`) only. Horizon is not queried.
 * See `fetchRpcEvents` for current limitations: results aren't filtered to
 * `streamId`, and the history window is limited by RPC retention.
 *
 * Fetches on mount and whenever `streamId`, the RPC URL, or the contract ID
 * changes. Does nothing if `streamId` is empty.
 *
 * @param streamId - ID of the stream whose history to load.
 * @returns
 * - `events`: `TimelineEvent[]`, newest first. Empty on error.
 * - `loading`: true while a fetch is in progress.
 * - `refetch()`: reloads the timeline.
 */
export function useStreamHistory(streamId: string) {
  const { config, network } = useNetwork()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!streamId) return
    setLoading(true)
    try {
      const rpcEvents = await fetchRpcEvents(
        config.rpcUrl,
        config.streamContractId,
        streamId,
      )

      const allEvents = rpcEvents.sort((a, b) => b.timestamp - a.timestamp)
      setEvents(allEvents)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [streamId, config.rpcUrl, config.streamContractId])

  useEffect(() => {
    load()
  }, [load])

  return { events, loading, refetch: load }
}
