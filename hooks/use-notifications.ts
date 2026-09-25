'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { xdr, scValToNative } from '@stellar/stellar-sdk'
import { useNetwork } from '@/components/providers/network-provider'
import { fetchStreamsForAddress } from '@/lib/contract'
import { isNotificationTypeEnabled } from '@/hooks/use-notification-preferences'

// Polling interval, ledger-cursor dedup, and per-wallet scoping are
// documented in docs/adr/ADR-008-notification-polling-and-dedup.md.
const POLL_INTERVAL = 30_000
/** Ledger cursor used for dedup. Global key: not scoped per wallet or network yet. */
const STORAGE_KEY = 'flowstar:last-seen-ledger'
/** Persisted notification list (newest first, max 50). Global key: not scoped per wallet yet. */
const NOTIF_STORAGE_KEY = 'flowstar:notifications'

/** A notification shown in the bell and persisted to localStorage. */
export interface AppNotification {
  /** `${Date.now()}-${random}`. Used for React keys and dismissal only, not for dedup. */
  id: string
  type: 'stream_created' | 'stream_cancelled' | 'withdrawal'
  title: string
  body: string
  /** ms since epoch when the notification was created client-side. */
  timestamp: number
  read: boolean
}

/** Last processed ledger, or `0` if none (first run) or on the server. */
function getLastSeenLedger(): number {
  if (typeof window === 'undefined') return 0
  return Number(localStorage.getItem(STORAGE_KEY) || '0')
}

function setLastSeenLedger(seq: number) {
  localStorage.setItem(STORAGE_KEY, String(seq))
}

function getSavedNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveNotifications(notifs: AppNotification[]) {
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifs.slice(0, 50)))
}

async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function showBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/flowstar-logo-v2.png' })
  }
}

interface ContractEvent {
  type: string
  ledger: number
  value: {
    xdr: string
  }
  topic: string[]
}

/**
 * Classifies a raw event by substring-matching its topic strings. Returns
 * `null` for events the bell doesn't surface.
 */
function decodeEventTopic(topics: string[]): {
  eventType: 'StreamCreatedEvent' | 'WithdrawEvent' | 'CancelEvent' | null
} {
  const topicStr = topics.join(',')
  if (topicStr.includes('StreamCreatedEvent') || topicStr.includes('create_stream')) {
    return { eventType: 'StreamCreatedEvent' }
  }
  if (topicStr.includes('WithdrawEvent') || topicStr.includes('withdraw')) {
    return { eventType: 'WithdrawEvent' }
  }
  if (topicStr.includes('CancelEvent') || topicStr.includes('cancel')) {
    return { eventType: 'CancelEvent' }
  }
  return { eventType: null }
}

/**
 * Events carry the full struct payload (stream_id, sender, recipient, ...)
 * in `value.xdr` rather than the topics — none of the contract's events
 * declare `#[topic]` fields. We only need `stream_id` here since caller-side
 * scoping is done by cross-referencing against the connected wallet's own
 * sent/received stream IDs.
 */
function decodeEventStreamId(value: { xdr: string }): string | null {
  try {
    const scVal = xdr.ScVal.fromXDR(value.xdr, 'base64')
    const native = scValToNative(scVal) as Record<string, unknown>
    const streamId = native?.stream_id
    if (streamId === undefined || streamId === null) return null
    return String(streamId)
  } catch {
    return null
  }
}

/**
 * Fetches up to 100 of the contract's events from `startLedger` onward via
 * RPC `getEvents`. The result is shared by all users and not wallet-filtered.
 *
 * Never throws. `retentionError` is true when the RPC says `startLedger` is
 * older than its retention window. On any other failure it returns no events
 * and `latestLedger: startLedger`, so the caller's cursor doesn't move.
 */
async function fetchContractEvents(
  startLedger: number,
  rpcUrl: string,
  contractId: string,
): Promise<{
  events: ContractEvent[]
  latestLedger: number
  retentionError: boolean
}> {
  if (!contractId) {
    return {
      events: [],
      latestLedger: startLedger,
      retentionError: false,
    }
  }

  try {
    const body: Record<string, unknown> = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getEvents',
      params: {
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [contractId],
          },
        ],
        pagination: { limit: 100 },
      },
    }

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const json = (await res.json()) as {
      result?: {
        events?: ContractEvent[]
        latestLedger?: number
      }
      error?: {
        code?: number
        message?: string
      }
    }

    const errorMessage = json.error?.message?.toLowerCase() ?? ''

    if (
      errorMessage.includes('oldest ledger') ||
      errorMessage.includes('retention') ||
      errorMessage.includes('before oldest ledger')
    ) {
      return {
        events: [],
        latestLedger: startLedger,
        retentionError: true,
      }
    }

    return {
      events: json.result?.events ?? [],
      latestLedger: json.result?.latestLedger ?? startLedger,
      retentionError: false,
    }
  } catch {
    return {
      events: [],
      latestLedger: startLedger,
      retentionError: false,
    }
  }
}

/** Oldest ledger the RPC still retains (from `getHealth`), or `null` on failure. */
async function fetchOldestLedger(rpcUrl: string): Promise<number | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
      }),
    })

    const json = (await res.json()) as {
      result?: {
        oldestLedger?: number
      }
    }

    return json.result?.oldestLedger ?? null
  } catch {
    return null
  }
}

/**
 * Polls the streaming contract's events and turns the ones that concern the
 * connected wallet into in-app (and, if permitted, browser) notifications.
 * Full rationale: docs/adr/ADR-008-notification-polling-and-dedup.md.
 *
 * Polling contract:
 * - Runs only while `walletAddress` and a stream contract ID are both set,
 *   so it never polls in mock mode. It polls once immediately, then every
 *   30s. It restarts when the wallet, network, RPC URL, or contract ID
 *   changes, and stops on unmount.
 * - Browser notification permission is requested when polling starts.
 *
 * Dedup contract (ledger cursor, not event IDs):
 * - Each poll requests events from `lastSeenLedger + 1`, then advances the
 *   cursor to the response's `latestLedger` if it moved forward.
 * - First run (cursor `0`): the cursor is set to `latestLedger - 1` and no
 *   events are processed, so history is never replayed into the bell.
 * - Retention error: the cursor is reset to `oldestLedger - 1`, or to the
 *   `latestLedger - 1` if that lookup fails, so polling can't get stuck on the
 *   same error forever (#229/#280). If every call fails the cursor is left
 *   alone and the next poll retries.
 *
 * Per-wallet scoping (#228/#279):
 * - Events are matched by `stream_id` against the wallet's own sent and
 *   received streams. Only stream created/cancelled events for received
 *   streams, and withdrawals from sent streams, produce notifications.
 *   Types disabled in notification preferences are dropped.
 *
 * Known gaps (see the ADR): both storage keys are global, not per wallet or
 * network, so a wallet switch shows the previous wallet's list. Events past
 * the first 100 per poll are skipped. Multiple tabs can each add the same
 * event.
 *
 * @param walletAddress - Connected wallet, or `null` to stop polling.
 * @returns `notifications` (newest first, max 50), `unreadCount`, and
 *   `markAllRead`, `clearAll`, and `dismissNotification(id)`. All three
 *   persist to localStorage.
 */
export function useNotifications(walletAddress: string | null) {
  const { network, config } = useNetwork()
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    getSavedNotifications(),
  )
  const [unreadCount, setUnreadCount] = useState(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.read).length)
  }, [notifications])

  const addNotification = useCallback(
    (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
      if (!isNotificationTypeEnabled(notif.type)) return
      const newNotif: AppNotification = {
        ...notif,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        read: false,
      }
      setNotifications((prev) => {
        const updated = [newNotif, ...prev].slice(0, 50)
        saveNotifications(updated)
        return updated
      })
      showBrowserNotification(notif.title, notif.body)
    },
    [],
  )

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }))
      saveNotifications(updated)
      return updated
    })
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    saveNotifications([])
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id)
      saveNotifications(updated)
      return updated
    })
  }, [])

  useEffect(() => {
    const rpcUrl = config.rpcUrl
    const contractId = config.streamContractId
    if (!walletAddress || !contractId) return
    const address = walletAddress

    requestNotificationPermission()

    async function poll() {
      const lastLedger = getLastSeenLedger()
      let startLedger = lastLedger

      if (startLedger === 0) {
        try {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getLatestLedger',
            }),
          })
          const json = (await res.json()) as { result?: { sequence?: number } }
          startLedger = (json.result?.sequence ?? 1) - 1
          setLastSeenLedger(startLedger)
          return
        } catch {
          return
        }
      }

      const { events, latestLedger, retentionError } = await fetchContractEvents(
        startLedger + 1,
        rpcUrl,
        contractId,
      )

      if (retentionError) {
        // The stored ledger has fallen outside the RPC's retention window.
        // Reset it to the oldest ledger the RPC still holds so the next poll
        // can catch up from there rather than staying permanently frozen.
        const oldestLedger = await fetchOldestLedger(rpcUrl)

        if (oldestLedger !== null) {
          // Use oldestLedger - 1 so the next poll starts AT the oldest
          // retained ledger (fetchContractEvents is called with startLedger + 1).
          setLastSeenLedger(oldestLedger - 1)
        } else {
          // fetchOldestLedger failed (RPC unreachable). Fall back to the
          // current tip so we don't miss future events while not replaying
          // a potentially huge backlog on recovery.
          try {
            const res = await fetch(rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getLatestLedger',
              }),
            })
            const json = (await res.json()) as {
              result?: { sequence?: number }
            }
            const sequence = json.result?.sequence
            if (sequence !== undefined) {
              setLastSeenLedger(sequence - 1)
            }
          } catch {
            // Both RPC calls failed — leave lastSeenLedger unchanged and
            // retry on the next poll cycle.
          }
        }

        return
      }

      if (events.length > 0) {
        // Scope events to this wallet: the contract emits one shared event
        // stream for every user, so we cross-reference each event's
        // stream_id against the streams this wallet actually sent/received
        // before surfacing a notification for it.
        const myStreams = await fetchStreamsForAddress(network, address)
        const sentIds = new Set(myStreams.filter((s) => s.sender === address).map((s) => s.id))
        const receivedIds = new Set(
          myStreams.filter((s) => s.recipient === address).map((s) => s.id),
        )

        for (const event of events) {
          const { eventType } = decodeEventTopic(event.topic ?? [])
          if (!eventType) continue

          const streamId = decodeEventStreamId(event.value)
          if (!streamId) continue

          if (eventType === 'StreamCreatedEvent' && receivedIds.has(streamId)) {
            addNotification({
              type: 'stream_created',
              title: 'New stream received',
              body: 'A new payment stream has been created for you.',
            })
          } else if (eventType === 'CancelEvent' && receivedIds.has(streamId)) {
            addNotification({
              type: 'stream_cancelled',
              title: 'Stream cancelled',
              body: 'A stream you are receiving has been cancelled.',
            })
          } else if (eventType === 'WithdrawEvent' && sentIds.has(streamId)) {
            addNotification({
              type: 'withdrawal',
              title: 'Withdrawal from your stream',
              body: 'A withdrawal has been made from a stream you sent.',
            })
          }
        }
      }

      if (latestLedger > startLedger) {
        setLastSeenLedger(latestLedger)
      }
    }

    poll()
    pollingRef.current = setInterval(poll, POLL_INTERVAL)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [walletAddress, addNotification, config.rpcUrl, config.streamContractId, network])

  return { notifications, unreadCount, markAllRead, clearAll, dismissNotification }
}
