import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStreamsViewPreference } from '@/hooks/use-streams-view-preference'

const KEY = 'flowstar:streams-view'

describe('useStreamsViewPreference', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to "list" when nothing is stored', () => {
    const { result } = renderHook(() => useStreamsViewPreference())
    expect(result.current.view).toBe('list')
  })

  it('reads a previously stored preference', () => {
    localStorage.setItem(KEY, 'compact')
    const { result } = renderHook(() => useStreamsViewPreference())
    expect(result.current.view).toBe('compact')
  })

  it('ignores an invalid stored value and falls back to the default', () => {
    localStorage.setItem(KEY, 'not-a-real-view')
    const { result } = renderHook(() => useStreamsViewPreference())
    expect(result.current.view).toBe('list')
  })

  it('setView updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useStreamsViewPreference())

    act(() => {
      result.current.setView('timeline')
    })

    expect(result.current.view).toBe('timeline')
    expect(localStorage.getItem(KEY)).toBe('timeline')
  })
})
