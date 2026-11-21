import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useNotificationPreferences,
  isNotificationTypeEnabled,
} from '@/hooks/use-notification-preferences'

const STORAGE_KEY = 'flowstar:notification-preferences'

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults all notification types to enabled when storage is empty', () => {
    const { result } = renderHook(() => useNotificationPreferences())
    expect(result.current.preferences).toEqual({
      stream_created: true,
      stream_cancelled: true,
      withdrawal: true,
    })
  })

  it('updates persist to localStorage', () => {
    const { result } = renderHook(() => useNotificationPreferences())
    act(() => {
      result.current.setPreference('withdrawal', false)
    })
    expect(result.current.preferences.withdrawal).toBe(false)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.withdrawal).toBe(false)
  })

  it('isNotificationTypeEnabled reflects saved preferences', () => {
    const { result } = renderHook(() => useNotificationPreferences())
    act(() => {
      result.current.setPreference('stream_created', false)
    })
    expect(isNotificationTypeEnabled('stream_created')).toBe(false)
    expect(isNotificationTypeEnabled('withdrawal')).toBe(true)
  })

  it('falls back to defaults when stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    const { result } = renderHook(() => useNotificationPreferences())
    expect(result.current.preferences).toEqual({
      stream_created: true,
      stream_cancelled: true,
      withdrawal: true,
    })
    expect(isNotificationTypeEnabled('withdrawal')).toBe(true)
  })

  it('calls onSaveError when persisting fails', () => {
    const onSaveError = vi.fn()
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded')
      })
    const { result } = renderHook(() => useNotificationPreferences(onSaveError))
    act(() => {
      result.current.setPreference('withdrawal', false)
    })
    expect(onSaveError).toHaveBeenCalledTimes(1)
    setItemSpy.mockRestore()
  })
})
