'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useContractPaused } from '@/hooks/use-contract-paused'

const DISMISS_KEY = 'flowstar:paused-banner-dismissed'

/**
 * Banner shown while the streaming contract is paused by its admin, so users
 * find out *before* signing a transaction that would otherwise fail on-chain
 * with `ContractPaused` (code 16). Polls `is_paused()` every 60s via
 * {@link useContractPaused}.
 *
 * Dismissible for the rest of the browser session (persisted in
 * `sessionStorage`, cleared when the tab/browser is closed) — it does not
 * reappear just from navigating between pages.
 *
 * # Issue #1144
 */
export function PausedBanner() {
  const paused = useContractPaused()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  if (!paused || dismissed) return null

  function dismiss() {
    window.sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-center text-sm font-medium text-amber-700 backdrop-blur-md dark:text-amber-400"
    >
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        FlowStar is temporarily paused by its admin — withdrawals, cancellations, and new streams
        are disabled until it resumes.
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-full border border-amber-500/40 px-2 py-0.5 text-xs hover:bg-amber-500/10"
      >
        Dismiss
      </button>
    </div>
  )
}
