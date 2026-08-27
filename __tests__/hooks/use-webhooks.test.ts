import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWebhooks } from '@/hooks/use-webhooks'
import type { WebhookConfig } from '@/hooks/use-webhooks'

const originalFetch = global.fetch

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOkResponse(status = 200): Response {
  return { ok: true, status } as Response
}

function makeFailResponse(status = 500): Response {
  return { ok: false, status } as Response
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useWebhooks', () => {
  beforeEach(() => {
    localStorage.clear()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    localStorage.clear()
  })

  // ── initial state ──────────────────────────────────────────────────────────

  it('starts empty when nothing is in storage', async () => {
    const { result } = renderHook(() => useWebhooks())
    await waitFor(() => {
      expect(result.current.webhooks).toEqual([])
      expect(result.current.history).toEqual([])
    })
  })

  it('loads persisted webhooks from localStorage on mount', async () => {
    const stored: WebhookConfig[] = [
      {
        id: 'wh-1',
        url: 'https://example.com/existing',
        events: ['stream.created'],
        enabled: true,
        createdAt: 1000,
      },
    ]
    localStorage.setItem('flowstar_webhooks', JSON.stringify(stored))

    const { result } = renderHook(() => useWebhooks())
    await waitFor(() => {
      expect(result.current.webhooks).toHaveLength(1)
      expect(result.current.webhooks[0].id).toBe('wh-1')
      expect(result.current.webhooks[0].url).toBe('https://example.com/existing')
    })
  })

  it('returns empty list if localStorage contains invalid JSON', async () => {
    localStorage.setItem('flowstar_webhooks', 'not-valid-json}}')
    const { result } = renderHook(() => useWebhooks())
    await waitFor(() => {
      expect(result.current.webhooks).toEqual([])
    })
  })

  // ── addWebhook ─────────────────────────────────────────────────────────────

  it('adds a webhook and persists it to localStorage', async () => {
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    expect(result.current.webhooks).toHaveLength(1)
    expect(result.current.webhooks[0].url).toBe('https://example.com/hook')
    expect(result.current.webhooks[0].events).toContain('stream.created')
    expect(result.current.webhooks[0].enabled).toBe(true)
    expect(result.current.webhooks[0].id).toBeTruthy()
    const stored = JSON.parse(localStorage.getItem('flowstar_webhooks') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].url).toBe('https://example.com/hook')
  })

  it('adds multiple webhooks independently', async () => {
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook1', ['stream.created'])
      result.current.addWebhook('https://example.com/hook2', ['stream.cancelled'])
    })
    expect(result.current.webhooks).toHaveLength(2)
    const stored = JSON.parse(localStorage.getItem('flowstar_webhooks') ?? '[]')
    expect(stored).toHaveLength(2)
  })

  // ── removeWebhook ──────────────────────────────────────────────────────────

  it('removes a webhook by id and persists to localStorage', async () => {
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    const id = result.current.webhooks[0].id
    await act(async () => {
      result.current.removeWebhook(id)
    })
    expect(result.current.webhooks).toHaveLength(0)
    const stored = JSON.parse(localStorage.getItem('flowstar_webhooks') ?? '[]')
    expect(stored).toHaveLength(0)
  })

  it('removing a non-existent id leaves other webhooks intact', async () => {
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    await act(async () => {
      result.current.removeWebhook('does-not-exist')
    })
    expect(result.current.webhooks).toHaveLength(1)
  })

  // ── toggleWebhook ──────────────────────────────────────────────────────────

  it('toggles a webhook from enabled to disabled and persists to localStorage', async () => {
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    const id = result.current.webhooks[0].id
    await act(async () => {
      result.current.toggleWebhook(id)
    })
    expect(result.current.webhooks[0].enabled).toBe(false)
    const stored = JSON.parse(localStorage.getItem('flowstar_webhooks') ?? '[]')
    expect(stored[0].enabled).toBe(false)
  })

  it('toggles a webhook back to enabled on second call', async () => {
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    const id = result.current.webhooks[0].id
    await act(async () => {
      result.current.toggleWebhook(id)
    })
    await act(async () => {
      result.current.toggleWebhook(id)
    })
    expect(result.current.webhooks[0].enabled).toBe(true)
  })

  // ── testWebhook ────────────────────────────────────────────────────────────

  it('testWebhook returns false for an unknown id', async () => {
    const { result } = renderHook(() => useWebhooks())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.testWebhook('does-not-exist')
    })
    expect(ok).toBe(false)
  })

  it('testWebhook returns true when the delivery succeeds', async () => {
    vi.mocked(global.fetch).mockResolvedValue(makeOkResponse())
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    const id = result.current.webhooks[0].id
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.testWebhook(id)
    })
    expect(ok).toBe(true)
  })

  it('testWebhook returns false when fetch fails with a non-ok response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(makeFailResponse())
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    const id = result.current.webhooks[0].id
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.testWebhook(id)
    })
    expect(ok).toBe(false)
  })

  it('testWebhook returns false when fetch throws a network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    const id = result.current.webhooks[0].id
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.testWebhook(id)
    })
    expect(ok).toBe(false)
  })

  // ── fireEvent ──────────────────────────────────────────────────────────────

  it('fireEvent only delivers to enabled webhooks subscribed to the event type', async () => {
    vi.mocked(global.fetch).mockResolvedValue(makeOkResponse())
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.withdrawal'])
    })
    await act(async () => {
      await result.current.fireEvent('stream.created', { stream_id: 1 })
    })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.history).toHaveLength(0)
  })

  it('fireEvent delivers to a subscribed enabled webhook and records delivery in history', async () => {
    vi.mocked(global.fetch).mockResolvedValue(makeOkResponse(200))
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    await act(async () => {
      await result.current.fireEvent('stream.created', { stream_id: 42 })
    })
    expect(global.fetch).toHaveBeenCalledOnce()
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].eventType).toBe('stream.created')
    expect(result.current.history[0].success).toBe(true)
    expect(result.current.history[0].statusCode).toBe(200)
  })

  it('fireEvent does not deliver to a disabled webhook', async () => {
    vi.mocked(global.fetch).mockResolvedValue(makeOkResponse())
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    const id = result.current.webhooks[0].id
    await act(async () => {
      result.current.toggleWebhook(id) // disable it
    })
    await act(async () => {
      await result.current.fireEvent('stream.created', { stream_id: 1 })
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fireEvent records failed delivery in history', async () => {
    vi.mocked(global.fetch).mockResolvedValue(makeFailResponse(503))
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.cancelled'])
    })
    await act(async () => {
      await result.current.fireEvent('stream.cancelled', { stream_id: 5 })
    })
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].success).toBe(false)
    expect(result.current.history[0].statusCode).toBe(503)
  })

  it('fireEvent sends to multiple webhooks subscribed to the same event', async () => {
    vi.mocked(global.fetch).mockResolvedValue(makeOkResponse())
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook1', ['stream.withdrawal'])
      result.current.addWebhook('https://example.com/hook2', ['stream.withdrawal'])
    })
    await act(async () => {
      await result.current.fireEvent('stream.withdrawal', { stream_id: 7 })
    })
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(result.current.history).toHaveLength(2)
  })

  it('fireEvent persists delivery history to localStorage', async () => {
    vi.mocked(global.fetch).mockResolvedValue(makeOkResponse())
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.topped_up'])
    })
    await act(async () => {
      await result.current.fireEvent('stream.topped_up', { stream_id: 3 })
    })
    const stored = JSON.parse(localStorage.getItem('flowstar_webhook_history') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].eventType).toBe('stream.topped_up')
    expect(stored[0].success).toBe(true)
  })
})
