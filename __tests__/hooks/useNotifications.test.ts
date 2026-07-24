import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotifications } from '@/hooks/useNotifications'

class MockNotification {
  static permission = 'granted'
  static requestPermission = vi.fn().mockResolvedValue('granted')
  constructor(public title: string, public options?: NotificationOptions) {}
}

describe('useNotifications', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('Notification', MockNotification)
  })

  it('starts with no notifications and default preferences enabled', () => {
    const { result } = renderHook(() => useNotifications())
    expect(result.current.notifications).toEqual([])
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.prefs.stream_received).toBe(true)
  })

  it('adds a notification and increments unreadCount', () => {
    const { result } = renderHook(() => useNotifications())
    act(() => {
      result.current.addNotification({
        type: 'stream_received',
        message: 'You received a stream',
        streamId: '1',
      })
    })
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.unreadCount).toBe(1)
  })

  it('does not add a notification when the type preference is disabled', () => {
    const { result } = renderHook(() => useNotifications())
    act(() => {
      result.current.updatePref('stream_received', false)
    })
    act(() => {
      result.current.addNotification({
        type: 'stream_received',
        message: 'You received a stream',
        streamId: '1',
      })
    })
    expect(result.current.notifications).toHaveLength(0)
  })

  it('markAllRead marks every notification as read', () => {
    const { result } = renderHook(() => useNotifications())
    act(() => {
      result.current.addNotification({
        type: 'cliff_reached',
        message: 'Cliff reached',
        streamId: '1',
      })
    })
    act(() => {
      result.current.markAllRead()
    })
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.notifications.every((n) => n.read)).toBe(true)
  })

  it('updatePref persists the preference to localStorage', () => {
    const { result } = renderHook(() => useNotifications())
    act(() => {
      result.current.updatePref('topup_received', false)
    })
    const stored = JSON.parse(localStorage.getItem('flowstar_notif_prefs') ?? '{}')
    expect(stored.topup_received).toBe(false)
  })
})
