/**
 * Tests for components/pwa/service-worker-register.tsx
 *
 * Strategy
 * ─────────
 * ServiceWorkerRegister renders nothing — it is a pure side-effect component
 * that calls `navigator.serviceWorker.register('/sw.js')` on mount.
 *
 * We mock `navigator.serviceWorker` at the object descriptor level so the
 * component's `'serviceWorker' in navigator` guard passes correctly, and
 * then assert that `register` was called with the expected path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Installs a mock serviceWorker on navigator and returns the register spy. */
function mockServiceWorker(options: { resolves?: boolean } = {}) {
  const register = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    writable: true,
    value: { register },
  })
  return register
}

/** Removes navigator.serviceWorker so the `'serviceWorker' in navigator` guard fails. */
function removeServiceWorker() {
  // Delete the property so that `'serviceWorker' in navigator` evaluates to
  // false, matching real browsers that don't support service workers.
  const nav = navigator as unknown as Record<string, unknown>
  delete nav['serviceWorker']
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ServiceWorkerRegister', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls navigator.serviceWorker.register with /sw.js on mount', () => {
    const register = mockServiceWorker()

    render(<ServiceWorkerRegister />)

    expect(register).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('renders nothing (null) into the DOM', () => {
    mockServiceWorker()

    const { container } = render(<ServiceWorkerRegister />)

    expect(container).toBeEmptyDOMElement()
  })

  it('does not throw when registration rejects (offline/unsupported browser)', async () => {
    const register = vi.fn().mockRejectedValue(new Error('Registration failed'))
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      writable: true,
      value: { register },
    })

    // Should not throw even though the promise rejects — the component silently
    // swallows registration failures so the app continues without offline support.
    expect(() => render(<ServiceWorkerRegister />)).not.toThrow()

    // Allow the rejected promise to settle without an unhandled rejection.
    await vi.waitFor(() => expect(register).toHaveBeenCalled())
  })

  it('does not call register when navigator.serviceWorker is unavailable', () => {
    removeServiceWorker()

    // No error should be thrown and no register call should occur.
    expect(() => render(<ServiceWorkerRegister />)).not.toThrow()
  })

  it('only registers once across multiple renders', () => {
    const register = mockServiceWorker()

    const { rerender } = render(<ServiceWorkerRegister />)
    rerender(<ServiceWorkerRegister />)

    // useEffect with [] dependency fires only on mount, not on re-renders.
    expect(register).toHaveBeenCalledTimes(1)
  })
})
