import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNow } from '@/hooks/use-now'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns current unix time in seconds on mount', () => {
    const { result } = renderHook(() => useNow())
    expect(result.current).toBe(1704067200) // 2024-01-01T00:00:00Z
  })

  it('updates every second by default', () => {
    const { result } = renderHook(() => useNow())
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toBe(1704067201)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current).toBe(1704067203)
  })

  it('uses a custom interval', () => {
    const { result } = renderHook(() => useNow(5000))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current).toBe(1704067200) // not updated yet
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current).toBe(1704067205)
  })

  it('clears interval on unmount', () => {
    const clearSpy = vi.spyOn(global, 'clearInterval')
    const { unmount } = renderHook(() => useNow())
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })
})
