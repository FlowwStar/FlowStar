'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Droplets, ExternalLink } from 'lucide-react'

const FAUCET_URL = 'https://laboratory.stellar.org/#account-creator?network=test'
const DISMISS_STORAGE_KEY = 'flowstar:faucet-banner-dismissed'
const AUTO_DISMISS_MS = 5000

/**
 * Testnet-only banner that points users to the Stellar Friendbot faucet.
 *
 * The banner auto-dismisses itself after AUTO_DISMISS_MS milliseconds once
 * the user clicks the faucet link. It does NOT reload the page.
 */
export function TestnetFaucetBanner() {
  const [visible, setVisible] = useState(false)
  const [funded, setFunded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Show the banner only if the user hasn't dismissed it before.
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_STORAGE_KEY)
      if (!dismissed) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, '1')
    } catch {
      // localStorage unavailable — ignore
    }
  }

  function handleFaucetClick() {
    setFunded(true)
    // Auto-dismiss after a short delay so the user can read the confirmation.
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS)
  }

  // Clean up the auto-dismiss timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 border-b border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-400"
    >
      <Droplets className="size-4 shrink-0" />

      {funded ? (
        // ✅ Fix #369 — the banner simply dismisses itself; it never reloads the page,
        // so the success copy must not say "Reloading…".
        <span className="flex-1">
          Faucet opened — your testnet wallet should be funded shortly. This notice will close in a few seconds.
        </span>
      ) : (
        <>
          <span className="flex-1">
            Running on <strong>Stellar Testnet</strong> — need test XLM?{' '}
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleFaucetClick}
              className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-sky-300 transition-colors"
            >
              Get free testnet XLM from Friendbot
              <ExternalLink className="size-3" />
            </a>
          </span>
        </>
      )}

      <button
        onClick={dismiss}
        aria-label="Dismiss faucet banner"
        className="shrink-0 rounded p-0.5 text-sky-400/70 transition-colors hover:text-sky-300"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
