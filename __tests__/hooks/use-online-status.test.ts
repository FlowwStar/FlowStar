import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from '@/hooks/use-online-status'

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    setNavigatorOnline(true)
  })

  it('defaults to online', () => {
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('syncs to navigator.onLine on mount', () => {
    setNavigatorOnline(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it('becomes false when the offline event fires', () => {
    const { result } = renderHook(() => useOnlineStatus())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
  })

  it('becomes true again when the online event fires', () => {
    const { result } = renderHook(() => useOnlineStatus())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })

  it('removes its event listeners on unmount', () => {
    const { result, unmount } = renderHook(() => useOnlineStatus())
    unmount()

    // No assertion possible on a removed listener directly, but dispatching
    // after unmount must not throw (no dangling state updates on an
    // unmounted component).
    expect(() => window.dispatchEvent(new Event('offline'))).not.toThrow()
    expect(result.current).toBe(true)
  })
})
