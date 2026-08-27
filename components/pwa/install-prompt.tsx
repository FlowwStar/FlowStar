'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Minimal typing for the non-standard `beforeinstallprompt` event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'flowstar:install-prompt-dismissed'

/**
 * Surfaces the browser's native "Add to Home Screen" prompt on supported
 * mobile/desktop browsers (issue #150). Chrome/Edge/Android fire
 * `beforeinstallprompt`; we intercept it, suppress the automatic mini-infobar,
 * and show our own small banner so it matches the rest of the UI.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === '1')

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredPrompt || dismissed) return null

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-md"
    >
      <Download className="size-3.5 text-primary" />
      <span>Install FlowStar for quick access</span>
      <Button size="sm" className="h-6 rounded-full px-2.5 text-[11px]" onClick={handleInstall}>
        Install
      </Button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
