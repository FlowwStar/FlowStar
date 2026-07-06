'use client'

import { useState, useRef, useEffect } from 'react'
import { Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNow } from '@/hooks/use-now'
import { formatTimeRemaining } from '@/lib/stream-utils'
import { Button } from '@/components/ui/button'

interface AccessibleCountdownTimerProps {
  /** Target UNIX timestamp (seconds). */
  target: bigint
  className?: string
  endedLabel?: string
  /** Whether to hide the read button (for embedded usage). */
  hideButton?: boolean
  /** Callback when a significant state change occurs (e.g., timer expires). */
  onStateChange?: (state: 'expired' | 'active') => void
}

/**
 * Accessible countdown timer that minimizes screen reader announcements.
 *
 * - Display uses `aria-live="off"` to prevent rapid updates from being announced
 * - Provides a "Read current time" button for on-demand announcements
 * - Only announces significant state changes (expired, cliff reached, etc.)
 * - Uses `aria-atomic="true"` on announcements for clarity
 */
export function AccessibleCountdownTimer({
  target,
  className,
  endedLabel = 'Ended',
  hideButton = false,
  onStateChange,
}: AccessibleCountdownTimerProps) {
  const now = useNow(1000)
  const ended = Number(target) <= now
  const displayText = formatTimeRemaining(target, now)

  const [lastState, setLastState] = useState<'expired' | 'active'>(ended ? 'expired' : 'active')
  const [announcementText, setAnnouncementText] = useState('')
  const announceRef = useRef<HTMLDivElement>(null)

  // Announce state changes
  useEffect(() => {
    const newState = ended ? 'expired' : 'active'
    if (newState !== lastState) {
      setLastState(newState)
      onStateChange?.(newState)

      if (newState === 'expired') {
        setAnnouncementText(`Countdown finished. ${endedLabel}.`)
      } else {
        setAnnouncementText('Countdown resumed.')
      }
    }
  }, [ended, lastState, endedLabel, onStateChange])

  function announceCurrentTime() {
    const timeText = ended ? endedLabel : displayText
    setAnnouncementText(`Time remaining: ${timeText}`)
    // Focus the announcement for immediate reading
    announceRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-2">
      {/* Display with aria-live="off" to prevent announcement spam */}
      <span
        className={cn('font-mono tabular-nums', className)}
        aria-live="off"
        aria-label={`Time remaining: ${ended ? endedLabel : displayText}`}
      >
        {ended ? endedLabel : displayText}
      </span>

      {/* On-demand read button */}
      {!hideButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={announceCurrentTime}
          className="h-6 w-6 p-0"
          aria-label="Announce current time remaining"
          title="Click to announce the current time to screen readers"
        >
          <Volume2 className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Live region for announcements */}
      <div
        ref={announceRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        tabIndex={-1}
      >
        {announcementText}
      </div>
    </div>
  )
}
