'use client'

import { memo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowDownLeft, ArrowUpRight, MoreVertical, EyeOff, Eye, UserX, UserCheck } from 'lucide-react'
import { useNow } from '@/hooks/use-now'
import { useWallet } from '@/hooks/use-wallet'
import { useTokenPrice, formatUsd } from '@/hooks/use-token-price'
import { useShowUsd } from '@/hooks/use-show-usd'
import { useIsStreamCancelling } from '@/hooks/use-undo-cancel'
import { useHiddenStreams } from '@/hooks/use-hidden-streams'
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
import { AccessibleCountdownTimer } from '@/components/ui/accessible-countdown-timer'
import { StreamStatusBadge } from '@/components/streams/stream-status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { StreamData } from '@/types/stream'

// Pick update interval based on a quick pre-check of stream state.
// completed/cancelled streams never change — no interval needed.
// scheduled streams only need minute-level updates for the countdown.
// streaming streams need per-second updates for the live counter.
function getInterval(stream: StreamData): number | null {
  const nowSec = Math.floor(Date.now() / 1000)
  if (stream.cancelled) return null
  if (nowSec >= Number(stream.endTime)) return null // completed
  if (nowSec < Number(stream.startTime)) return 60000 // scheduled: 1 min
  return 1000 // streaming: 1 sec
}

interface StreamCardProps {
  stream: StreamData
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  /** Render in "hidden streams" view — flips Hide/Block actions to Unhide/Unblock. */
  isHiddenView?: boolean
}

function StreamCardInner({
  stream,
  selectable,
  selected,
  onToggleSelect,
  isHiddenView,
}: StreamCardProps) {
  const interval = getInterval(stream)
  const now = useNow(interval)
  const { address } = useWallet()
  const { usdPrice } = useTokenPrice(stream.token.symbol)
  const [showUsd] = useShowUsd()
  const isCancelling = useIsStreamCancelling(stream.id)
  const { isBlocked, hideStream, unhideStream, blockSender, unblockSender } = useHiddenStreams()
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

  const usdValue =
    showUsd && usdPrice !== null
      ? (Number(stream.depositedAmount) / Math.pow(10, stream.token.decimals)) * usdPrice
      : null

  // "Hide stream" / "Block sender" only make sense for incoming streams —
  // recipients are the ones who didn't opt in (issue #151).
  const showHideMenu = !isOutgoing && !selectable

  function handleHideToggle(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (isHiddenView) {
      unhideStream(stream.id)
      toast.success('Stream unhidden')
    } else {
      hideStream(stream.id)
      toast.success('Stream hidden', {
        description: 'Use "Show hidden streams" on the streams page to bring it back.',
      })
    }
  }

  function handleBlockToggle(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (isBlocked(stream.sender)) {
      unblockSender(stream.sender)
      toast.success('Sender unblocked')
    } else {
      blockSender(stream.sender)
      hideStream(stream.id)
      toast.success('Sender blocked', {
        description: 'Future streams from this address will be hidden automatically.',
      })
    }
  }

  return (
    <Link
      href={`/app/stream/${stream.id}`}
      className={
        'group relative block rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 ' +
        (selectable && selected ? 'border-primary' : 'border-border')
      }
      aria-label={ariaLabel}
      data-testid={`stream-card-${stream.id}`}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => {}}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleSelect?.(stream.id)
          }}
          aria-label={`Select stream ${stream.id}`}
          data-testid={`stream-card-select-${stream.id}`}
          className="absolute right-4 top-4 z-10 size-4 accent-primary"
        />
      )}
      {showHideMenu && (
        <div
          className="absolute right-3 top-3 z-10"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Stream options"
                data-testid={`stream-card-menu-${stream.id}`}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleHideToggle}>
                {isHiddenView ? (
                  <>
                    <Eye className="size-4 mr-2" />
                    Unhide stream
                  </>
                ) : (
                  <>
                    <EyeOff className="size-4 mr-2" />
                    Hide stream
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBlockToggle} variant="destructive">
                {isBlocked(stream.sender) ? (
                  <>
                    <UserCheck className="size-4 mr-2" />
                    Unblock sender
                  </>
                ) : (
                  <>
                    <UserX className="size-4 mr-2" />
                    Block sender
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={
              'flex size-9 items-center justify-center rounded-lg ' +
              (isOutgoing ? 'bg-secondary text-muted-foreground' : 'bg-primary/10 text-primary')
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
              {stream.metadata?.name ?? (isOutgoing ? 'Sending to' : 'Receiving from')}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {shortenAddress(counterparty, 5)}
            </p>
          </div>
        </div>
        {isCancelling ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive">
            <span className="size-1.5 animate-pulse rounded-full bg-current" />
            Cancelling…
          </span>
        ) : (
          <StreamStatusBadge status={status} />
        )}
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
          {usdValue !== null && (
            <p className="text-xs text-muted-foreground">{formatUsd(usdValue)}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {status === 'scheduled'
              ? 'Starts in'
              : status === 'completed' || status === 'cancelled'
                ? 'Ended'
                : 'Ends in'}
          </p>
          <div className="text-sm font-medium">
            {status === 'scheduled' ? (
              <AccessibleCountdownTimer target={stream.startTime} hideButton />
            ) : status === 'completed' || status === 'cancelled' ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <AccessibleCountdownTimer target={stream.endTime} hideButton />
            )}
          </div>
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
