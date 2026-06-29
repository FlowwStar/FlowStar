'use client'

import { useState, useRef, useEffect } from 'react'
import { Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { formatTokenAmount } from '@/lib/stream-utils'

interface AccessibleUnlockAmountProps {
  amount: bigint
  decimals: number
  symbol: string
  className?: string
  /** Whether to hide the read button. */
  hideButton?: boolean
  /** Callback when a significant state change occurs (e.g., stream completed). */
  onStateChange?: (state: 'completed' | 'active' | 'cliff-reached') => void
  /** Whether the stream has reached its cliff. */
  isCliffReached?: boolean
  /** Whether the stream is fully completed. */
  isCompleted?: boolean
  /** Previous amount for change detection. */
  previousAmount?: bigint
}

/**
 * Accessible unlock amount display that minimizes screen reader announcements.
 *
 * - Display uses `aria-live="off"` to prevent rapid updates from being announced
 * - Provides a "Read current amount" button for on-demand announcements
 * - Only announces significant state changes (cliff reached, fully completed)
 * - Uses `aria-atomic="true"` for clear announcements
 */
export function AccessibleUnlockAmount({
  amount,
  decimals,
  symbol,
  className,
  hideButton = false,
  onStateChange,
  isCliffReached = false,
  isCompleted = false,
  previousAmount,
}: AccessibleUnlockAmountProps) {
  const displayText = formatTokenAmount(amount, decimals, 4)
  const [lastState, setLastState] = useState<'completed' | 'active' | 'cliff-reached'>(
    isCompleted ? 'completed' : isCliffReached ? 'cliff-reached' : 'active'
  )
  const [announcementText, setAnnouncementText] = useState('')
  const announceRef = useRef<HTMLDivElement>(null)

  // Announce state changes
  useEffect(() => {
    let newState: 'completed' | 'active' | 'cliff-reached' = 'active'
    if (isCompleted) newState = 'completed'
    else if (isCliffReached) newState = 'cliff-reached'

    if (newState !== lastState) {
      setLastState(newState)
      onStateChange?.(newState)

      if (newState === 'completed') {
        setAnnouncementText(`Stream completed. Total unlocked: ${displayText} ${symbol}.`)
      } else if (newState === 'cliff-reached') {
        setAnnouncementText(`Cliff period ended. ${displayText} ${symbol} now available.`)
      }
    }
  }, [isCompleted, isCliffReached, lastState, displayText, symbol, onStateChange])

  function announceCurrentAmount() {
    const percentageContext =
      previousAmount !== undefined && previousAmount > 0n
        ? ` (change: ${formatTokenAmount(amount - previousAmount, decimals, 4)} ${symbol})`
        : ''
    setAnnouncementText(`Current unlocked amount: ${displayText} ${symbol}${percentageContext}`)
    announceRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-2">
      {/* Display with aria-live="off" to prevent announcement spam */}
      <div
        className={cn('font-mono', className)}
        aria-live="off"
        aria-label={`${displayText} ${symbol} unlocked`}
      >
        {displayText}
        <span className="ml-2 text-base font-normal text-muted-foreground">{symbol}</span>
      </div>

      {/* On-demand read button */}
      {!hideButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={announceCurrentAmount}
          className="h-6 w-6 p-0"
          aria-label="Announce current unlocked amount"
          title="Click to announce the current amount to screen readers"
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
