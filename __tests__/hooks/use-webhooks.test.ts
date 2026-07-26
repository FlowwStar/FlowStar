import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWebhooks } from '@/hooks/use-webhooks'

const originalFetch = global.fetch

describe('useWebhooks', () => {
  beforeEach(() => {
    localStorage.clear()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('starts empty when nothing is in storage', async () => {
    const { result } = renderHook(() => useWebhooks())
    await waitFor(() => {
      expect(result.current.webhooks).toEqual([])
      expect(result.current.history).toEqual([])
    })
  })

  it('adds a webhook and persists it to localStorage', async () => {
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    expect(result.current.webhooks).toHaveLength(1)
    expect(result.current.webhooks[0].url).toBe('https://example.com/hook')
    expect(result.current.webhooks[0].enabled).toBe(true)
    expect(JSON.parse(localStorage.getItem('flowstar_webhooks') ?? '[]')).toHaveLength(1)
  })

  it('removes a webhook by id', async () => {
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    const id = result.current.webhooks[0].id
    await act(async () => {
      result.current.removeWebhook(id)
    })
    expect(result.current.webhooks).toHaveLength(0)
  })

  it('toggles a webhook enabled state', async () => {
    const { result } = renderHook(() => useWebhooks())
    await act(async () => {
      result.current.addWebhook('https://example.com/hook', ['stream.created'])
    })
    const id = result.current.webhooks[0].id
    await act(async () => {
      result.current.toggleWebhook(id)
    })
    expect(result.current.webhooks[0].enabled).toBe(false)
  })

  it('testWebhook returns false for an unknown id', async () => {
    const { result } = renderHook(() => useWebhooks())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.testWebhook('does-not-exist')
    })
    expect(ok).toBe(false)
  })

  it('testWebhook returns true when the delivery succeeds', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200 } as Response)
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

  it('fireEvent only delivers to enabled webhooks subscribed to the event type', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200 } as Response)
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
})
