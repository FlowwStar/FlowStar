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
}

export interface WebhookDelivery {
  webhookId: string
  eventType: WebhookEventType
  statusCode: number | null
  deliveredAt: number
  success: boolean
}

const STORAGE_KEY = 'flowstar_webhooks'
const HISTORY_KEY = 'flowstar_webhook_history'
const MAX_HISTORY = 50

export interface WebhookPayload {
  event: WebhookEventType | string
  timestamp: string
  data: Record<string, unknown>
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

async function deliverWithRetry(
  url: string,
  payload: WebhookPayload,
  retries = 3
): Promise<{ statusCode: number | null; success: boolean }> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  const addWebhook = useCallback((url: string, events: WebhookEventType[]) => {
    const hook: WebhookConfig = {
      id: crypto.randomUUID(),
      url,
      events,
      enabled: true,
      createdAt: Date.now(),
    }
    setWebhooks((prev) => {
      const next = [...prev, hook]
      reportSaveResult(saveWebhooks(next))
      return next
    })
  }, [reportSaveResult])

  const removeWebhook = useCallback((id: string) => {
    setWebhooks((prev) => {
      const next = prev.filter((h) => h.id !== id)
      reportSaveResult(saveWebhooks(next))
      return next
    })
  }, [reportSaveResult])

  const toggleWebhook = useCallback((id: string) => {
    setWebhooks((prev) => {
      const next = prev.map((h) => (h.id === id ? { ...h, enabled: !h.enabled } : h))
      reportSaveResult(saveWebhooks(next))
      return next
    })
  }, [reportSaveResult])

  const fireEvent = useCallback(
    async (eventType: WebhookEventType, data: WebhookPayload) => {
      const active = webhooks.filter((h) => h.enabled && h.events.includes(eventType))
      for (const hook of active) {
        const payload = { event: eventType, timestamp: new Date().toISOString(), data }
        const result = await deliverWithRetry(hook.url, payload)
        const delivery: WebhookDelivery = {
          webhookId: hook.id,
          eventType,
          statusCode: result.statusCode,
          deliveredAt: Date.now(),
          success: result.success,
        }
        setHistory((prev) => {
          const next = [delivery, ...prev]
          reportSaveResult(saveHistory(next))
          return next
        })
      }
    },
    [webhooks, reportSaveResult]
  )

  const testWebhook = useCallback(async (id: string): Promise<boolean> => {
    const hook = webhooks.find((h) => h.id === id)
    if (!hook) return false
    const payload = {
      event: 'stream.created',
      timestamp: new Date().toISOString(),
      data: { stream_id: 0, note: 'FlowStar webhook test' },
    }
    const result = await deliverWithRetry(hook.url, payload, 1)
    return result.success
  }, [webhooks])

  return { webhooks, history, addWebhook, removeWebhook, toggleWebhook, fireEvent, testWebhook }
}
