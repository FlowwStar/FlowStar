import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBulkActions } from '@/hooks/useBulkActions'

describe('useBulkActions', () => {
  it('starts idle with empty progress and results', () => {
    const { result } = renderHook(() => useBulkActions())
    expect(result.current.status).toBe('idle')
    expect(result.current.progress).toEqual({ done: 0, total: 0 })
    expect(result.current.results).toEqual([])
  })

  it('runs an action over every id and reports success', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useBulkActions())
    await act(async () => {
      await result.current.runBulk(['1', '2', '3'], action)
    })
    expect(action).toHaveBeenCalledTimes(3)
    expect(result.current.status).toBe('done')
    expect(result.current.progress).toEqual({ done: 3, total: 3 })
    expect(result.current.succeeded).toBe(3)
    expect(result.current.failed).toBe(0)
  })

  it('tracks failures separately from successes', async () => {
    const action = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useBulkActions())
    await act(async () => {
      await result.current.runBulk(['1', '2'], action)
    })
    expect(result.current.succeeded).toBe(1)
    expect(result.current.failed).toBe(1)
    expect(result.current.results.find((r) => r.id === '2')?.error).toBe('boom')
  })
})
