'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useNow } from '@/hooks/use-now'
import { formatTimeRemaining } from '@/lib/stream-utils'

interface CountdownTimerProps {
  /** Target UNIX timestamp (seconds). */
  target: bigint
  className?: string
  endedLabel?: string
  /** Callback fired once when the timer transitions from active to expired. */
  onExpire?: () => void
}

/** Live "2d 4h 13m" countdown to a target timestamp. */
export function CountdownTimer({
  target,
  className,
  endedLabel = 'Ended',
  onExpire,
}: CountdownTimerProps) {
  const now = useNow(1000)
  const ended = Number(target) <= now

  // Mirror AccessibleCountdownTimer's state-change callback shape, but
  // filtered to the one transition (active -> expired) that a caller of
  // CountdownTimer actually wants. We track the previously-fired flag in
  // a ref so a target change from a far-future to a past timestamp still
  // fires exactly once and a parent re-render does not re-fire it.
  const firedRef = useRef(false)
  useEffect(() => {
    if (ended && !firedRef.current) {
      firedRef.current = true
      onExpire?.()
    } else if (!ended) {
      firedRef.current = false
    }
  }, [ended, onExpire])

  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {ended ? endedLabel : formatTimeRemaining(target, now)}
    </span>
  )
}
