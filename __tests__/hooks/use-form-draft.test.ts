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

  it('does not persist before the debounce window elapses', () => {
    const onChange = vi.fn()
    renderHook(() => useFormDraft('debounce-key', { foo: 'bar' }, onChange))

    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(localStorage.getItem('flowstar_draft_debounce-key')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    const raw = localStorage.getItem('flowstar_draft_debounce-key')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).data).toEqual({ foo: 'bar' })
  })

  it('loadDraft returns the stored data and savedAt for a fresh draft', () => {
    const savedAt = Date.now()
    localStorage.setItem(
      'flowstar_draft_freshload-key',
      JSON.stringify({ data: { foo: 'bar' }, savedAt }),
    )
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useFormDraft('freshload-key', { foo: 'baz' }, onChange),
    )
    expect(result.current.loadDraft()).toEqual({ data: { foo: 'bar' }, savedAt })
  })

  it('loadDraft returns null for corrupt JSON without throwing', () => {
    localStorage.setItem('flowstar_draft_corrupt-key', '{not valid json')
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useFormDraft('corrupt-key', { foo: 'bar' }, onChange),
    )
    expect(result.current.loadDraft()).toBeNull()
  })

  it('restore does nothing when there is no saved draft', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useFormDraft('nodraft-key', { foo: 'bar' }, onChange),
    )
    act(() => {
      result.current.restore()
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not re-save a restored draft back to storage', () => {
    const savedAt = Date.now()
    localStorage.setItem(
      'flowstar_draft_norewrite-key',
      JSON.stringify({ data: { foo: 'restored' }, savedAt }),
    )
    const onChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useFormDraft('norewrite-key', value, onChange),
      { initialProps: { value: { foo: 'fresh' } } },
    )

    act(() => {
      result.current.restore()
    })
    expect(onChange).toHaveBeenCalledWith({ foo: 'restored' })

    // Simulate the parent adopting the restored value.
    rerender({ value: { foo: 'restored' } })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const entry = JSON.parse(
      localStorage.getItem('flowstar_draft_norewrite-key')!,
    )
    expect(entry.data).toEqual({ foo: 'restored' })
    // The restore guard prevented the debounced auto-save from rewriting it.
    expect(entry.savedAt).toBe(savedAt)
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

  it('removes corrupt draft entries and leaves non-draft keys untouched', () => {
    localStorage.setItem('flowstar_draft_corrupt', '{oops')
    localStorage.setItem('unrelated-key', 'keep me')
    clearExpiredDrafts()
    expect(localStorage.getItem('flowstar_draft_corrupt')).toBeNull()
    expect(localStorage.getItem('unrelated-key')).toBe('keep me')
  })
})
