'use client'

import { useWallet } from '@/hooks/use-wallet'
import {
  getStreamStatus,
  getStreamProgress,
  formatTokenAmount,
  formatDateTime,
  shortenAddress,
} from '@/lib/stream-utils'
import type { StreamData, StreamStatus } from '@/types/stream'

// Bar color per status — mirrors StreamStatusBadge's palette (streaming =
// primary/green, scheduled = amber, completed = gray, cancelled = red).
const BAR_STYLES: Record<StreamStatus, string> = {
  streaming: 'bg-primary',
  scheduled: 'bg-chart-3',
  completed: 'bg-muted-foreground/40',
  cancelled: 'bg-destructive',
}

// Width of the label column each row's bar track is offset by. Kept as a
// single constant so the axis ticks and the "today" line — which both live
// outside any individual row — line up with where the tracks actually start.
const LABEL_COL_REM = 11

interface StreamGanttViewProps {
  streams: StreamData[]
  nowSeconds: number
}

/**
 * Horizontal calendar/Gantt view of vesting schedules (issue #149). One row
 * per stream, X-axis is time. A shared "today" line spans every row, and
 * each bar shows a cliff marker when the stream has one.
 */
export function StreamGanttView({ streams, nowSeconds }: StreamGanttViewProps) {
  const { address } = useWallet()

  if (streams.length === 0) return null

  const starts = streams.map((s) => Number(s.startTime))
  const ends = streams.map((s) => Number(s.endTime))
  const rawMin = Math.min(...starts, nowSeconds)
  const rawMax = Math.max(...ends, nowSeconds)
  const pad = Math.max((rawMax - rawMin) * 0.05, 3600)
  const rangeStart = rawMin - pad
  const rangeEnd = rawMax + pad
  const rangeSpan = Math.max(rangeEnd - rangeStart, 1)

  const pct = (t: number) => ((t - rangeStart) / rangeSpan) * 100
  const nowPct = Math.min(Math.max(pct(nowSeconds), 0), 100)
  const ticks = Array.from({ length: 5 }, (_, i) => rangeStart + (rangeSpan * i) / 4)

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Time axis */}
          <div
            className="relative mb-3 h-4 border-b border-border"
            style={{ marginLeft: `${LABEL_COL_REM}rem` }}
          >
            {ticks.map((t, i) => (
              <span
                key={i}
                className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground"
                style={{ left: `${pct(t)}%` }}
              >
                {formatDateTime(t).split(',')[0]}
              </span>
            ))}
          </div>

          {/* Rows + shared "today" line */}
          <div className="relative space-y-2">
            <div
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-destructive/70"
              style={{ left: `calc(${LABEL_COL_REM}rem + (100% - ${LABEL_COL_REM}rem) * ${nowPct / 100})` }}
              aria-hidden
            >
              <span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap rounded bg-destructive px-1 py-0.5 text-[9px] font-medium text-destructive-foreground">
                Today
              </span>
            </div>

            {streams.map((s) => {
              const status = getStreamStatus(s, nowSeconds)
              const progress = getStreamProgress(s, nowSeconds)
              const isOutgoing = address === s.sender
              const counterparty = isOutgoing ? s.recipient : s.sender
              const startPct = pct(Number(s.startTime))
              const endPct = pct(Number(s.endTime))
              const widthPct = Math.max(endPct - startPct, 0.5)
              const hasCliff = s.cliffTime > s.startTime
              const cliffPct = hasCliff ? pct(Number(s.cliffTime)) : null
              const amount = formatTokenAmount(s.depositedAmount, s.token.decimals, 2)

              return (
                <div key={s.id} className="flex items-center">
                  {/* Label */}
                  <div className="w-44 shrink-0 pr-3">
                    <p className="truncate text-xs font-medium">
                      {s.metadata?.name ?? (isOutgoing ? 'Sending to' : 'Receiving from')}
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {shortenAddress(counterparty, 4)}
                    </p>
                  </div>

                  {/* Track + bar */}
                  <div className="relative h-6 flex-1 rounded-md bg-secondary/50">
                    <div
                      className={`group/bar absolute inset-y-0 rounded-md ${BAR_STYLES[status]} cursor-default`}
                      style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                    >
                      {hasCliff && cliffPct !== null && (
                        <div
                          className="absolute inset-y-0 w-0.5 bg-background/80"
                          style={{
                            left: `${Math.min(Math.max(((cliffPct - startPct) / widthPct) * 100, 0), 100)}%`,
                          }}
                          aria-hidden
                        />
                      )}

                      {/* Hover tooltip */}
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[11px] text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/bar:opacity-100"
                      >
                        <p className="font-medium">
                          {amount} {s.token.symbol}
                        </p>
                        <p className="text-muted-foreground">
                          {isOutgoing ? 'To' : 'From'} {shortenAddress(counterparty, 5)}
                        </p>
                        <p className="text-muted-foreground">{(progress * 100).toFixed(1)}% unlocked</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" /> Streaming
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-chart-3" /> Scheduled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground/40" /> Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-destructive" /> Cancelled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-0.5 bg-background/80 ring-1 ring-border" /> Cliff
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
