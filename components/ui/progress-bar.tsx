import { cn } from '@/lib/utils'

interface ProgressBarProps {
  /** 0–1 */
  value: number
  className?: string
  /** Optional secondary marker (0–1), e.g. withdrawn portion. */
  marker?: number
  indeterminateShimmer?: boolean
  /** Height variant. @default 'default' */
  size?: 'sm' | 'default' | 'lg'
}

/** Shows the % of a stream that has unlocked, with an optional withdrawn marker. */
export function ProgressBar({
  value,
  className,
  marker,
  indeterminateShimmer,
  size = 'default',
}: ProgressBarProps) {
  const sizeClasses = {
    sm: 'h-1',
    default: 'h-2',
    lg: 'h-3',
  }
  const pct = Math.min(Math.max(value, 0), 1) * 100
  const markerPct =
    marker != null ? Math.min(Math.max(marker, 0), 1) * 100 : null

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-secondary',
        sizeClasses[size],
        className,
      )}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      >
        {indeterminateShimmer && pct > 0 && pct < 100 && (
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/40" />
        )}
      </div>
      {markerPct != null && markerPct > 0 && (
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/70"
          style={{ left: `calc(${markerPct}% - 1px)` }}
          aria-hidden
        />
      )}
    </div>
  )
}
