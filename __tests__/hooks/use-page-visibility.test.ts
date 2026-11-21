import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePageVisibility } from '@/hooks/use-page-visibility'

// Issue #740 describes this hook as returning state that updates on
// visibilitychange. The real hook (hooks/use-page-visibility.ts) returns
// nothing — it's callback-based: it calls onVisible/onHidden depending on
// document.hidden when the event fires. These tests cover the real shape.

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

function fireVisibilityChange() {
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('usePageVisibility', () => {
  afterEach(() => {
    setDocumentHidden(false)
  })

  it('calls onHidden when the document becomes hidden', () => {
    const onVisible = vi.fn()
    const onHidden = vi.fn()
    renderHook(() => usePageVisibility({ onVisible, onHidden }))

    setDocumentHidden(true)
    fireVisibilityChange()

    expect(onHidden).toHaveBeenCalledTimes(1)
    expect(onVisible).not.toHaveBeenCalled()
  })

  it('calls onVisible when the document becomes visible again', () => {
    const onVisible = vi.fn()
    const onHidden = vi.fn()
    renderHook(() => usePageVisibility({ onVisible, onHidden }))

    setDocumentHidden(true)
    fireVisibilityChange()
    setDocumentHidden(false)
    fireVisibilityChange()

    expect(onHidden).toHaveBeenCalledTimes(1)
    expect(onVisible).toHaveBeenCalledTimes(1)
  })

  it('does not throw when a callback is omitted', () => {
    renderHook(() => usePageVisibility({ onHidden: vi.fn() }))
    setDocumentHidden(false)
    expect(() => fireVisibilityChange()).not.toThrow()
  })

  it('always calls the latest callback identity, even without re-registering the listener', () => {
    const onHiddenFirst = vi.fn()
    const onHiddenSecond = vi.fn()
    const { rerender } = renderHook(({ onHidden }) => usePageVisibility({ onHidden }), {
      initialProps: { onHidden: onHiddenFirst },
    })

    rerender({ onHidden: onHiddenSecond })

    setDocumentHidden(true)
    fireVisibilityChange()

    expect(onHiddenFirst).not.toHaveBeenCalled()
    expect(onHiddenSecond).toHaveBeenCalledTimes(1)
  })

  it('removes the listener on unmount', () => {
    const onHidden = vi.fn()
    const { unmount } = renderHook(() => usePageVisibility({ onHidden }))

    unmount()
    setDocumentHidden(true)
    fireVisibilityChange()

    expect(onHidden).not.toHaveBeenCalled()
  })
})
