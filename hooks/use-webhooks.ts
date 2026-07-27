'use client'

import { useState, useCallback, useEffect } from 'react'

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

function loadWebhooks(): WebhookConfig[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveWebhooks(hooks: WebhookConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hooks))
}

function loadHistory(): WebhookDelivery[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveHistory(history: WebhookDelivery[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

async function deliverWithRetry(
  url: string,
  payload: object,
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

export function useWebhooks() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [history, setHistory] = useState<WebhookDelivery[]>([])

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
      saveWebhooks(next)
      return next
    })
  }, [])

  const removeWebhook = useCallback((id: string) => {
    setWebhooks((prev) => {
      const next = prev.filter((h) => h.id !== id)
      saveWebhooks(next)
      return next
    })
  }, [])

  const toggleWebhook = useCallback((id: string) => {
    setWebhooks((prev) => {
      const next = prev.map((h) => (h.id === id ? { ...h, enabled: !h.enabled } : h))
      saveWebhooks(next)
      return next
    })
  }, [])

  const fireEvent = useCallback(
    async (eventType: WebhookEventType, data: object) => {
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
          saveHistory(next)
          return next
        })
      }
    },
    [webhooks]
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
