'use client'

import { memo } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useNow } from '@/hooks/use-now'
import { useWallet } from '@/hooks/use-wallet'
import {
  getStreamProgress,
  getStreamStatus,
  formatTokenAmount,
  shortenAddress,
  formatRate,
} from '@/lib/stream-utils'
import { ProgressBar } from '@/components/ui/progress-bar'
import { TokenAmount } from '@/components/ui/token-amount'
import { CountdownTimer } from '@/components/ui/countdown-timer'
import { StreamStatusBadge } from '@/components/streams/stream-status-badge'
import type { StreamData } from '@/types/stream'

// Pick update interval based on a quick pre-check of stream state.
// completed/cancelled streams never change — no interval needed.
// scheduled streams only need minute-level updates for the countdown.
// streaming streams need per-second updates for the live counter.
function getInterval(stream: StreamData): number | null {
  const nowSec = Math.floor(Date.now() / 1000)
  if (stream.cancelled) return null
  if (nowSec >= Number(stream.endTime)) return null   // completed
  if (nowSec < Number(stream.startTime)) return 60000 // scheduled: 1 min
  return 1000                                          // streaming: 1 sec
}

function StreamCardInner({ stream }: { stream: StreamData }) {
  const interval = getInterval(stream)
  const now = useNow(interval)
  const { address } = useWallet()
  const status = getStreamStatus(stream, now)
  const progress = getStreamProgress(stream, now)
  const withdrawnFrac =
    stream.depositedAmount > 0n
      ? Number((stream.withdrawnAmount * 10000n) / stream.depositedAmount) / 10000
      : 0

  const rate = formatRate(stream.amountPerSecond, stream.token.decimals, stream.token.symbol)
  const isOutgoing = address === stream.sender
  const counterparty = isOutgoing ? stream.recipient : stream.sender
  const direction = isOutgoing ? 'Sending' : 'Receiving'
  const displayAmount = formatTokenAmount(stream.depositedAmount, stream.token.decimals, 2)
  const ariaLabel = `${direction} ${displayAmount} ${stream.token.symbol}, ${status}, ${(progress * 100).toFixed(0)}% unlocked`

  return (
    <Link
      href={`/app/stream/${stream.id}`}
      className="group block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
      aria-label={ariaLabel}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={
              'flex size-9 items-center justify-center rounded-lg ' +
              (isOutgoing
                ? 'bg-secondary text-muted-foreground'
                : 'bg-primary/10 text-primary')
            }
          >
            {isOutgoing ? (
              <ArrowUpRight className="size-4.5" />
            ) : (
              <ArrowDownLeft className="size-4.5" />
            )}
          </span>
          <div>
            <p className="text-sm font-medium">
              {isOutgoing ? 'Sending to' : 'Receiving from'}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {shortenAddress(counterparty, 5)}
            </p>
          </div>
        </div>
        <StreamStatusBadge status={status} />
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <TokenAmount
            amount={stream.depositedAmount}
            token={stream.token}
            className="text-lg font-semibold"
            maxFractionDigits={2}
          />
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {status === 'scheduled'
              ? 'Starts in'
              : status === 'completed' || status === 'cancelled'
                ? 'Ended'
                : 'Ends in'}
          </p>
          <p className="text-sm font-medium">
            {status === 'scheduled' ? (
              <CountdownTimer target={stream.startTime} />
            ) : status === 'completed' || status === 'cancelled' ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <CountdownTimer target={stream.endTime} />
            )}
          </p>
        </div>
      </div>

      {(status === 'streaming' || status === 'scheduled') && (
        <p className="mt-3 text-xs font-mono text-muted-foreground">{rate.best}</p>
      )}

      <div className="mt-4">
        <ProgressBar
          value={progress}
          marker={withdrawnFrac}
          indeterminateShimmer={status === 'streaming'}
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{(progress * 100).toFixed(1)}% unlocked</span>
          <span>
            <TokenAmount
              amount={stream.withdrawnAmount}
              token={stream.token}
              showSymbol={false}
              maxFractionDigits={2}
            />{' '}
            withdrawn
          </span>
        </div>
      </div>
    </Link>
  )
}

export const StreamCard = memo(StreamCardInner)

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function StreamCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-muted" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-20 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
        </div>
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-1.5">
          <div className="h-3 w-8 rounded bg-muted" />
          <div className="h-6 w-24 rounded bg-muted" />
        </div>
        <div className="space-y-1.5 text-right">
          <div className="h-3 w-12 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2 w-full rounded-full bg-muted" />
        <div className="flex justify-between">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
