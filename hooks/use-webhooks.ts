'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

export type WebhookEventType =
  | 'stream.created'
  | 'stream.withdrawal'
  | 'stream.cancelled'
  | 'stream.completed'
  | 'stream.topped_up'
  | 'stream.transferred'

export interface WebhookConfig {
  id: string
  url: string
  events: WebhookEventType[]
  enabled: boolean
  createdAt: number
  /**
   * Per-webhook secret used to HMAC-sign every delivery (see
   * `X-FlowStar-Signature` in `signPayload`). Generated once at registration
   * time and never sent anywhere except as the signing key for this
   * browser's own outgoing requests.
   */
  secret: string
}

export interface WebhookDelivery {
  webhookId: string
  eventType: WebhookEventType
  statusCode: number | null
  deliveredAt: number
  success: boolean
  payload?: WebhookPayload
}

const STORAGE_KEY = 'flowstar_webhooks'
const HISTORY_KEY = 'flowstar_webhook_history'
const MAX_HISTORY = 50

// Issue #821: version of the delivered payload shape, so integrators can
// detect a future breaking change instead of guessing from field presence.
// Bump only for breaking changes — see docs/WEBHOOKS.md for the policy.
export const WEBHOOK_SCHEMA_VERSION = 1

export interface WebhookPayload {
  schema_version: number
  event: WebhookEventType | string
  timestamp: string
  data: Record<string, unknown>
}

function buildPayload(event: WebhookEventType, data: Record<string, unknown>): WebhookPayload {
  return {
    schema_version: WEBHOOK_SCHEMA_VERSION,
    event,
    timestamp: new Date().toISOString(),
    data,
  }
}

/** Header carrying the HMAC-SHA256 signature of the raw request body. */
export const WEBHOOK_SIGNATURE_HEADER = 'X-FlowStar-Signature'

/** Generates a random per-webhook signing secret (32 bytes, hex-encoded). */
function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Computes `sha256=<hex hmac>` for `body`, keyed by `secret`, in the same
 * format GitHub/Stripe use for their webhook signature headers. Verify by
 * recomputing this over the exact raw request body you received (not a
 * re-serialized copy) and comparing in constant time.
 */
async function signPayload(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return `sha256=${bytesToHex(signature)}`
}

function loadWebhooks(): WebhookConfig[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

// Issue #677: these used to call localStorage.setItem unguarded, which can
// throw (quota exceeded, private browsing) and crash the settings UI
// interaction that triggered it. Now wrapped in try/catch, matching
// use-form-draft.ts's already-guarded pattern, and reports success so
// callers can surface a warning instead of silently losing the write.
function saveWebhooks(hooks: WebhookConfig[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hooks))
    return true
  } catch {
    return false
  }
}

function loadHistory(): WebhookDelivery[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveHistory(history: WebhookDelivery[]): boolean {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
    return true
  } catch {
    return false
  }
}

/**
 * POSTs `payload` to `url` with an HMAC signature, retrying on failure.
 *
 * Retry/backoff strategy:
 * - Up to `retries` attempts total (default 3), i.e. the initial attempt plus
 *   up to 2 retries.
 * - A retry is scheduled after a non-2xx response or a thrown network error,
 *   using exponential backoff: `1000 * 2 ** attempt` ms, so 1s, then 2s
 *   (attempt is 0-indexed).
 * - The final attempt never sleeps; it returns immediately with
 *   `success: false` and the last observed `statusCode` (or `null` when the
 *   request threw).
 *
 * The signature is computed once over the serialized body and reused across
 * attempts, so retries deliver byte-identical payloads.
 *
 * @returns `{ statusCode, success }` — `statusCode` is the last HTTP status
 *   seen (or `null` if the request never completed), and `success` is true
 *   only when a response with `res.ok` was received.
 */
async function deliverWithRetry(
  url: string,
  secret: string,
  payload: WebhookPayload,
  retries = 3,
): Promise<{ statusCode: number | null; success: boolean }> {
  const body = JSON.stringify(payload)
  const signature = await signPayload(secret, body)
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [WEBHOOK_SIGNATURE_HEADER]: signature,
        },
        body,
      })
      if (res.ok) return { statusCode: res.status, success: true }
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      if (attempt === retries - 1) return { statusCode: res.status, success: false }
    } catch {
      if (attempt === retries - 1) return { statusCode: null, success: false }
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
    }
  }
  return { statusCode: null, success: false }
}

/**
 * Manages this browser's webhook registrations and their delivery history.
 *
 * State is persisted to `localStorage` (registrations under
 * `flowstar_webhooks`, history under `flowstar_webhook_history`, capped at
 * `MAX_HISTORY` entries) and hydrated on mount. Writes are guarded and, on
 * failure, reported through the optional `onSaveError` callback at most once
 * per failure streak (see issue #677).
 *
 * @param onSaveError Optional callback invoked the first time a persistence
 *   write fails, so callers can surface a warning instead of silently losing
 *   the write. Not called again until a subsequent write succeeds.
 *
 * @returns An object with:
 * - `webhooks` — the current `WebhookConfig[]` registrations.
 * - `history` — the most recent `WebhookDelivery[]`, newest first.
 * - `addWebhook(url, events)` — registers a webhook and returns its newly
 *   generated signing `secret` (shown once; not retrievable later).
 * - `removeWebhook(id)` — deletes the registration with the given id.
 * - `toggleWebhook(id)` — flips the `enabled` flag of the given registration.
 * - `fireEvent(eventType, data)` — delivers `data` to every enabled webhook
 *   subscribed to `eventType`, recording each attempt in `history`.
 * - `resendDelivery(delivery)` — re-delivers a stored delivery's payload to
 *   its webhook; resolves to whether the resend succeeded.
 */
export function useWebhooks(onSaveError?: () => void) {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [history, setHistory] = useState<WebhookDelivery[]>([])
  const hasWarnedRef = useRef(false)

  // Issue #677: only warn once per failure streak, resetting as soon as a
  // save succeeds again — a lightweight one-time notice, not a toast per
  // keystroke/action while storage stays unavailable.
  const reportSaveResult = useCallback(
    (ok: boolean) => {
      if (ok) {
        hasWarnedRef.current = false
        return
      }
      if (!hasWarnedRef.current) {
        hasWarnedRef.current = true
        onSaveError?.()
      }
    },
    [onSaveError],
  )

  useEffect(() => {
    setWebhooks(loadWebhooks())
    setHistory(loadHistory())
  }, [])

  const addWebhook = useCallback(
    (url: string, events: WebhookEventType[]): string => {
      const hook: WebhookConfig = {
        id: crypto.randomUUID(),
        url,
        events,
        enabled: true,
        createdAt: Date.now(),
        secret: generateSecret(),
      }
      setWebhooks((prev) => {
        const next = [...prev, hook]
        reportSaveResult(saveWebhooks(next))
        return next
      })
      // Returned so the caller can show it once — it's not otherwise
      // retrievable from the UI after this point (see docs/WEBHOOKS.md).
      return hook.secret
    },
    [reportSaveResult],
  )

  const removeWebhook = useCallback(
    (id: string) => {
      setWebhooks((prev) => {
        const next = prev.filter((h) => h.id !== id)
        reportSaveResult(saveWebhooks(next))
        return next
      })
    },
    [reportSaveResult],
  )

  const toggleWebhook = useCallback(
    (id: string) => {
      setWebhooks((prev) => {
        const next = prev.map((h) => (h.id === id ? { ...h, enabled: !h.enabled } : h))
        reportSaveResult(saveWebhooks(next))
        return next
      })
    },
    [reportSaveResult],
  )

  const fireEvent = useCallback(
    async (eventType: WebhookEventType, data: Record<string, unknown>) => {
      const active = webhooks.filter((h) => h.enabled && h.events.includes(eventType))
      for (const hook of active) {
        const payload = buildPayload(eventType, data)
        const result = await deliverWithRetry(hook.url, hook.secret, payload)
        const delivery: WebhookDelivery = {
          webhookId: hook.id,
          eventType,
          statusCode: result.statusCode,
          deliveredAt: Date.now(),
          success: result.success,
          payload,
        }
        setHistory((prev) => {
          const next = [delivery, ...prev]
          reportSaveResult(saveHistory(next))
          return next
        })
      }
    },
    [webhooks, reportSaveResult],
  )

  const resendDelivery = useCallback(
    async (delivery: WebhookDelivery): Promise<boolean> => {
      const hook = webhooks.find((h) => h.id === delivery.webhookId)
      if (!hook || !delivery.payload) return false
      const result = await deliverWithRetry(hook.url, delivery.payload)

/* … truncated 1031 chars — edit only what you need near the top … */
