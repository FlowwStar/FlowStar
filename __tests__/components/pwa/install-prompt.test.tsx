/**
 * Tests for components/pwa/install-prompt.tsx
 *
 * Strategy
 * ─────────
 * InstallPrompt is a client component that:
 *   1. Listens for the browser's `beforeinstallprompt` event and stores the
 *      deferred event reference in state.
 *   2. Renders a banner only when the event has been captured and the user
 *      hasn't already dismissed the prompt.
 *   3. Calls `deferredPrompt.prompt()` when the user clicks "Install".
 *   4. Persists a dismissed flag in localStorage and hides the banner when
 *      the user clicks the dismiss button.
 *
 * Mocked boundaries
 * ─────────────────
 * • localStorage      — supplied by jsdom, but we spy on getItem/setItem.
 * • window events     — we fire `beforeinstallprompt` via `window.dispatchEvent`.
 * • deferredPrompt    — we attach `.prompt` / `.userChoice` spies to a
 *                       synthetic event object.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { InstallPrompt } from '@/components/pwa/install-prompt'

// ─── Constants ────────────────────────────────────────────────────────────────

const DISMISSED_KEY = 'flowstar:install-prompt-dismissed'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates and dispatches a synthetic `beforeinstallprompt` event with
 * `.prompt()` and `.userChoice` spies attached.
 */
function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const promptSpy = vi.fn().mockResolvedValue(undefined)
  const userChoice = Promise.resolve({ outcome })

  const event = new Event('beforeinstallprompt', { bubbles: true, cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  event.prompt = promptSpy
  event.userChoice = userChoice

  act(() => {
    window.dispatchEvent(event)
  })

  return { promptSpy, userChoice }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('visibility', () => {
    it('renders nothing before beforeinstallprompt fires', () => {
      const { container } = render(<InstallPrompt />)

      expect(container).toBeEmptyDOMElement()
    })

    it('shows the install banner after beforeinstallprompt fires', async () => {
      render(<InstallPrompt />)
      fireBeforeInstallPrompt()

      await waitFor(() => {
        expect(screen.getByText(/install flowstar/i)).toBeInTheDocument()
      })
    })

    it('does not render when the user has already dismissed (localStorage flag set)', () => {
      localStorage.setItem(DISMISSED_KEY, '1')

      render(<InstallPrompt />)
      fireBeforeInstallPrompt()

      expect(screen.queryByText(/install flowstar/i)).not.toBeInTheDocument()
    })
  })

  describe('install action', () => {
    it('calls deferredPrompt.prompt() when Install button is clicked', async () => {
      render(<InstallPrompt />)
      const { promptSpy } = fireBeforeInstallPrompt()

      await waitFor(() => screen.getByRole('button', { name: /^install$/i }))

      fireEvent.click(screen.getByRole('button', { name: /^install$/i }))

      await waitFor(() => expect(promptSpy).toHaveBeenCalledTimes(1))
    })

    it('hides the banner after Install is clicked', async () => {
      render(<InstallPrompt />)
      fireBeforeInstallPrompt('accepted')

      await waitFor(() => screen.getByRole('button', { name: /^install$/i }))
      fireEvent.click(screen.getByRole('button', { name: /^install$/i }))

      // After prompt resolves and userChoice is awaited, deferredPrompt is
      // cleared → banner disappears.
      await waitFor(() => {
        expect(screen.queryByText(/install flowstar/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('dismiss action', () => {
    it('hides the banner when the dismiss button is clicked', async () => {
      render(<InstallPrompt />)
      fireBeforeInstallPrompt()

      await waitFor(() => screen.getByRole('button', { name: /dismiss install prompt/i }))

      fireEvent.click(screen.getByRole('button', { name: /dismiss install prompt/i }))

      await waitFor(() => {
        expect(screen.queryByText(/install flowstar/i)).not.toBeInTheDocument()
      })
    })

    it('persists the dismissed flag to localStorage on dismiss', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      render(<InstallPrompt />)
      fireBeforeInstallPrompt()

      await waitFor(() => screen.getByRole('button', { name: /dismiss install prompt/i }))
      fireEvent.click(screen.getByRole('button', { name: /dismiss install prompt/i }))

      expect(setItemSpy).toHaveBeenCalledWith(DISMISSED_KEY, '1')
    })

    it('does not show the banner again after dismissing if remounted', async () => {
      render(<InstallPrompt />)
      fireBeforeInstallPrompt()

      await waitFor(() => screen.getByRole('button', { name: /dismiss install prompt/i }))
      fireEvent.click(screen.getByRole('button', { name: /dismiss install prompt/i }))

      // Unmount and remount (localStorage flag survives)
      render(<InstallPrompt />)
      fireBeforeInstallPrompt()

      expect(screen.queryByText(/install flowstar/i)).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('renders the banner with role="status"', async () => {
      render(<InstallPrompt />)
      fireBeforeInstallPrompt()

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument()
      })
    })

    it('dismiss button has an accessible aria-label', async () => {
      render(<InstallPrompt />)
      fireBeforeInstallPrompt()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /dismiss install prompt/i })).toBeInTheDocument()
      })
    })
  })
})
