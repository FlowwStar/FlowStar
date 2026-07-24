import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormDraft, clearExpiredDrafts } from '@/hooks/use-form-draft'

describe('useFormDraft', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-saves the value after the debounce window', () => {
    const onChange = vi.fn()
    const { rerender } = renderHook(
      ({ value }) => useFormDraft('test-key', value, onChange),
      { initialProps: { value: { foo: 'bar' } } },
    )
    rerender({ value: { foo: 'baz' } })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    const raw = localStorage.getItem('flowstar_draft_test-key')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).data).toEqual({ foo: 'baz' })
  })

  it('does not save when disabled', () => {
    const onChange = vi.fn()
    renderHook(() => useFormDraft('disabled-key', { foo: 'bar' }, onChange, false))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(localStorage.getItem('flowstar_draft_disabled-key')).toBeNull()
  })

  it('restore calls onChange with the saved draft', () => {
    localStorage.setItem(
      'flowstar_draft_restore-key',
      JSON.stringify({ data: { foo: 'restored' }, savedAt: Date.now() }),
    )
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useFormDraft('restore-key', { foo: 'bar' }, onChange),
    )
    act(() => {
      result.current.restore()
    })
    expect(onChange).toHaveBeenCalledWith({ foo: 'restored' })
  })

  it('loadDraft returns null for an expired draft and clears storage', () => {
    localStorage.setItem(
      'flowstar_draft_expired-key',
      JSON.stringify({ data: { foo: 'old' }, savedAt: Date.now() - 25 * 60 * 60 * 1000 }),
    )
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useFormDraft('expired-key', { foo: 'bar' }, onChange),
    )
    expect(result.current.loadDraft()).toBeNull()
    expect(localStorage.getItem('flowstar_draft_expired-key')).toBeNull()
  })

  it('discard removes the stored draft', () => {
    localStorage.setItem(
      'flowstar_draft_discard-key',
      JSON.stringify({ data: { foo: 'bar' }, savedAt: Date.now() }),
    )
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useFormDraft('discard-key', { foo: 'bar' }, onChange),
    )
    act(() => {
      result.current.discard()
    })
    expect(localStorage.getItem('flowstar_draft_discard-key')).toBeNull()
  })
})

describe('clearExpiredDrafts', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('removes only expired draft entries', () => {
    localStorage.setItem(
      'flowstar_draft_fresh',
      JSON.stringify({ data: {}, savedAt: Date.now() }),
    )
    localStorage.setItem(
      'flowstar_draft_old',
      JSON.stringify({ data: {}, savedAt: Date.now() - 25 * 60 * 60 * 1000 }),
    )
    clearExpiredDrafts()
    expect(localStorage.getItem('flowstar_draft_fresh')).not.toBeNull()
    expect(localStorage.getItem('flowstar_draft_old')).toBeNull()
  })
})
