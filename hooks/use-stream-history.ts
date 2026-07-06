'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNetwork } from '@/components/providers/network-provider'

export type TimelineEventType =
  | 'created'
  | 'withdrawal'
  | 'topup'
  | 'transfer'
  | 'cancellation'

export interface TimelineEvent {
  type: TimelineEventType
  txHash: string
  timestamp: number
  ledger: number
  description: string
  amount?: string
  from?: string
  to?: string
}

function decodeEventType(topics: string[]): TimelineEventType | null {
  const joined = topics.join(',').toLowerCase()
  if (joined.includes('create') || joined.includes('stream_created')) return 'created'
  if (joined.includes('withdraw')) return 'withdrawal'
  if (joined.includes('topup') || joined.includes('top_up') || joined.includes('deposit')) return 'topup'
  if (joined.includes('transfer')) return 'transfer'
  if (joined.includes('cancel')) return 'cancellation'
  return null
}

interface HorizonOperation {
  type: string
  transaction_hash: string
  created_at: string
  amount?: string
  from?: string
  to?: string
}

interface HorizonEffect {
  type: string
  created_at: string
  amount?: string
  account?: string
}

interface HorizonTransaction {
  hash: string
  ledger: number
  created_at: string
  envelope_xdr?: string
}

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
