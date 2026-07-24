import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useShowUsd } from '@/hooks/use-show-usd'

describe('useShowUsd', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to showing USD when nothing is stored', () => {
    const { result } = renderHook(() => useShowUsd())
    expect(result.current[0]).toBe(true)
  })

  it('reads a previously stored false value', () => {
    localStorage.setItem('flowstar-show-usd', 'false')
    const { result } = renderHook(() => useShowUsd())
    expect(result.current[0]).toBe(false)
  })

  it('toggle updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useShowUsd())
    act(() => {
      result.current[1](false)
    })
    expect(result.current[0]).toBe(false)
    expect(localStorage.getItem('flowstar-show-usd')).toBe('false')
  })
})
