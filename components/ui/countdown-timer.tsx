'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useNow } from '@/hooks/use-now'
import { formatTimeRemaining } from '@/lib/stream-utils'

interface CountdownTimerProps {
  /** Target UNIX timestamp (seconds). */
  target: bigint
  className?: string
  endedLabel?: string
  /** Callback when a significant state change occurs (e.g., timer expires). */
  onStateChange?: (state: 'expired' | 'active') => void
}

/** Live "2d 4h 13m" countdown to a target timestamp. */
export function CountdownTimer({
  target,
  className,
  endedLabel = 'Ended',
  onStateChange,
}: CountdownTimerProps) {
  const now = useNow(1000)
  const ended = Number(target) <= now

  const [lastState, setLastState] = useState<'expired' | 'active'>(ended ? 'expired' : 'active')

  useEffect(() => {
    const newState = ended ? 'expired' : 'active'
    if (newState !== lastState) {
      setLastState(newState)
      onStateChange?.(newState)
    }
  }, [ended, lastState, onStateChange])

  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {ended ? endedLabel : formatTimeRemaining(target, now)}
    </span>
  )
}
