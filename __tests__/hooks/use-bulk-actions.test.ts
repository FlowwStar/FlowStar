import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBulkActions } from '@/hooks/use-bulk-actions'

describe('useBulkActions', () => {
  it('tracks per-item success and failure and reports final status', async () => {
    const { result } = renderHook(() => useBulkActions())

    const action = vi.fn(async (id: string) => {
      if (id === 'bad') throw new Error('boom')
    })

    act(() => {
      result.current.runBulk(['good-1', 'bad', 'good-2'], action)
    })

    await waitFor(() => expect(result.current.status).toBe('done'))

    expect(action).toHaveBeenCalledTimes(3)
    expect(result.current.succeeded).toBe(2)
    expect(result.current.failed).toBe(1)
    expect(result.current.progress).toEqual({ done: 3, total: 3 })
    expect(result.current.results).toEqual([
      { id: 'good-1', success: true },
      { id: 'bad', success: false, error: 'boom' },
      { id: 'good-2', success: true },
    ])
  })

  it('resets to idle with empty results', async () => {
    const { result } = renderHook(() => useBulkActions())

    act(() => {
      result.current.runBulk(['a'], async () => {})
    })
    await waitFor(() => expect(result.current.status).toBe('done'))

    act(() => result.current.reset())

    expect(result.current.status).toBe('idle')
    expect(result.current.results).toEqual([])
    expect(result.current.progress).toEqual({ done: 0, total: 0 })
  })
})
