'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowDownLeft, ArrowUpRight, MoreVertical, EyeOff, Eye, UserX, UserCheck, Link2, Check, Pin, PinOff } from 'lucide-react'
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
import { getFederationNameForAddress } from '@/lib/address-book'
import { streamCardCopy as copy } from '@/lib/copy/streams'
import { SITE_URL } from '@/lib/site'
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
  /** Compact/dense layout — single-row design for high-density lists (issue #832). */
  compact?: boolean
}

function StreamCardInner({
  stream,
  selectable,
  selected,
  onToggleSelect,
  isHiddenView,
  compact = false,
}: StreamCardProps) {
  const interval = getInterval(stream)
  const now = useNow(interval)
  const { address } = useWallet()
  const { usdPrice, loading: priceLoading } = useTokenPrice(stream.token.symbol)
  const [showUsd] = useShowUsd()
  const isCancelling = useIsStreamCancelling(stream.id)
  const { isBlocked, hideStream, unhideStream, blockSender, unblockSender, isPinned, pinStream, unpinStream } = useHiddenStreams()
  const status = getStreamStatus(stream, now)
  const progress = getStreamProgress(stream, now)
  const withdrawnFrac =
    stream.depositedAmount > 0n
      ? Number((stream.withdrawnAmount * 10000n) / stream.depositedAmount) / 10000
      : 0

  const rate = formatRate(stream.amountPerSecond, stream.token.decimals, stream.token.symbol)
  const isOutgoing = address === stream.sender
  const counterparty = isOutgoing ? stream.recipient : stream.sender
  // Issue #155: show a known Federation name (e.g. alice*domain.com) for the
  // counterparty address when one was resolved earlier in the address book.
  const counterpartyFederationName = getFederationNameForAddress(counterparty)
  const direction = isOutgoing ? copy.direction.sending : copy.direction.receiving
  const displayAmount = formatTokenAmount(stream.depositedAmount, stream.token.decimals, 2)
  const ariaLabel = copy.ariaLabel(direction, displayAmount, stream.token.symbol, status, (progress * 100).toFixed(0))

  const usdValue =
    showUsd && usdPrice !== null
      ? (Number(stream.depositedAmount) / Math.pow(10, stream.token.decimals)) * usdPrice
      : null

  // "Hide stream" / "Block sender" only make sense for incoming streams —
  // recipients are the ones who didn't opt in (issue #151).
  const showHideMenu = !isOutgoing && !selectable

  // "Pin to top" is available on all streams (issue #835).
  const showOptionsMenu = !selectable
  const pinned = isPinned(stream.id)

  function handlePinToggle(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (pinned) {
      unpinStream(stream.id)
      toast.success(copy.toasts.unpinned)
    } else {
      pinStream(stream.id)
      toast.success(copy.toasts.pinned)
    }
  }

  function handleHideToggle(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (isHiddenView) {
      unhideStream(stream.id)
      toast.success(copy.toasts.unhidden)
    } else {
      hideStream(stream.id)
      toast.success(copy.toasts.hidden, {
        description: copy.toasts.hiddenDescription,
      })
    }
  }

  function handleBlockToggle(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (isBlocked(stream.sender)) {
      unblockSender(stream.sender)
      toast.success(copy.toasts.senderUnblocked)
    } else {
      blockSender(stream.sender)
      hideStream(stream.id)
      toast.success(copy.toasts.senderBlocked, {
        description: copy.toasts.senderBlockedDescription,
      })
    }
  }

  const [copiedLink, setCopiedLink] = useState(false)

  function handleCopyLink(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/app/stream/${stream.id}`
        : `${SITE_URL}/app/stream/${stream.id}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 1500)
    toast.success(copy.toasts.linkCopied)
  }

  return (
    <Link
      href={`/app/stream/${stream.id}`}
      className={
        'group relative block rounded-2xl border bg-card transition-colors hover:border-primary/40 ' +
        (compact ? 'px-3 py-2' : 'p-5') + ' ' +
        (selectable && selected ? 'border-primary' : pinned ? 'border-primary/60' : 'border-border')
      }
      aria-label={ariaLabel}
      data-testid={`stream-card-${stream.id}`}
    >
      {/* Pin indicator — small badge in top-left corner of pinned full-height cards */}
      {pinned && !compact && (
        <span
          className="absolute left-3 top-3 z-10 flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-label={copy.pinnedToTop}
          title={copy.pinnedToTop}
        >
          <Pin className="size-3" />
        </span>
      )}
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
          aria-label={copy.selectStream(stream.id)}
          data-testid={`stream-card-select-${stream.id}`}
          className="absolute right-4 top-1/2 z-10 size-4 -translate-y-1/2 accent-primary"
        />
      )}
      {/* Copy-link quick action — visible on hover for all non-selectable cards */}
      {!selectable && (
        <div
          className={
            'absolute z-10 top-1/2 -translate-y-1/2 ' +
            (showOptionsMenu ? 'right-11' : 'right-3')
          }
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <button
            type="button"
            aria-label={copy.copyLink}
            data-testid={`stream-card-copy-link-${stream.id}`}
            onClick={handleCopyLink}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
          >
            {copiedLink ? (
              <Check className="size-4 text-primary" />
            ) : (
              <Link2 className="size-4" />
            )}
          </button>
        </div>
      )}
      {showOptionsMenu && (
        <div
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={copy.options}
                data-testid={`stream-card-menu-${stream.id}`}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handlePinToggle}>
                {pinned ? (
                  <>
                    <PinOff className="size-4 mr-2" />
                    {copy.menu.unpin}
                  </>
                ) : (
                  <>
                    <Pin className="size-4 mr-2" />
                    {copy.menu.pin}
                  </>
                )}
              </DropdownMenuItem>
              {showHideMenu && (
                <>
                  <DropdownMenuItem onClick={handleHideToggle}>
                    {isHiddenView ? (
                      <>
                        <Eye className="size-4 mr-2" />
                        {copy.menu.unhide}
                      </>
                    ) : (
                      <>
                        <EyeOff className="size-4 mr-2" />
                        {copy.menu.hide}
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBlockToggle} variant="destructive">
                    {isBlocked(stream.sender) ? (
                      <>
                        <UserCheck className="size-4 mr-2" />
                        {copy.menu.unblock}
                      </>
                    ) : (
                      <>
                        <UserX className="size-4 mr-2" />
                        {copy.menu.block}
                      </>
                    )}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {compact ? (
        /* ── Compact / dense single-row layout (issue #832) ── */
        <div className={'flex items-center gap-3 ' + (!selectable ? 'pr-20' : 'pr-8')}>
          {/* Direction icon — smaller in compact mode */}
          <span
            className={
              'flex size-6 shrink-0 items-center justify-center rounded-md ' +
              (isOutgoing ? 'bg-secondary text-muted-foreground' : 'bg-primary/10 text-primary')
            }
          >
            {isOutgoing ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownLeft className="size-3.5" />
            )}
          </span>

          {/* Counterparty */}
          <p
            className="w-24 shrink-0 truncate font-mono text-xs text-muted-foreground"
            title={counterpartyFederationName ? counterparty : undefined}
          >
            {counterpartyFederationName ?? shortenAddress(counterparty, 4)}
          </p>

          {/* Amount */}
          <TokenAmount
            amount={stream.depositedAmount}
            token={stream.token}
            className="shrink-0 text-sm font-semibold tabular-nums"
            maxFractionDigits={2}
          />

          {/* Progress bar — slim, fills available width */}
          <div className="min-w-0 flex-1">
            <ProgressBar
              value={progress}
              label={copy.progressLabel}
              marker={withdrawnFrac}
              indeterminateShimmer={status === 'streaming'}
            />
          </div>

          {/* Unlocked % */}
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {(progress * 100).toFixed(0)}%
          </span>

          {/* Status badge */}
          {isCancelling ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              {copy.cancelling}
            </span>
          ) : (
            <StreamStatusBadge status={status} />
          )}
        </div>
      ) : (
        /* ── Default full-height layout ── */
        <>
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
                  {stream.metadata?.name ?? (isOutgoing ? copy.direction.sendingTo : copy.direction.receivingFrom)}
                </p>
                <p
                  className="font-mono text-xs text-muted-foreground"
                  title={counterpartyFederationName ? counterparty : undefined}
                >
                  {counterpartyFederationName ?? shortenAddress(counterparty, 5)}
                </p>
              </div>
            </div>
            {isCancelling ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive">
                <span className="size-1.5 animate-pulse rounded-full bg-current" />
                {copy.cancelling}
              </span>
            ) : (
              <StreamStatusBadge status={status} />
            )}
          </div>

          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{copy.total}</p>
              <TokenAmount
                amount={stream.depositedAmount}
                token={stream.token}
                className="text-lg font-semibold"
                maxFractionDigits={2}
              />
              {/* Issue #675: loading and unavailable previously rendered
                  identically (nothing) — show a distinct skeleton while the
                  price is still being fetched. */}
              {showUsd && usdValue === null && priceLoading ? (
                <div className="mt-0.5 h-3 w-12 animate-pulse rounded bg-muted" aria-label={copy.loadingPrice} />
              ) : (
                usdValue !== null && (
                  <p className="text-xs text-muted-foreground">{formatUsd(usdValue)}</p>
                )
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {status === 'scheduled'
                  ? copy.timing.startsIn
                  : status === 'completed' || status === 'cancelled'
                    ? copy.timing.ended
                    : copy.timing.endsIn}
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
              label={copy.progressLabel}
              marker={withdrawnFrac}
              indeterminateShimmer={status === 'streaming'}
            />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{copy.unlocked((progress * 100).toFixed(1))}</span>
              <span>
                <TokenAmount
                  amount={stream.withdrawnAmount}
                  token={stream.token}
                  showSymbol={false}
                  maxFractionDigits={2}
                />{' '}
                {copy.withdrawn}
              </span>
            </div>
          </div>
        </>
      )}
    </Link>
  )
}

export const StreamCard = memo(StreamCardInner)

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function StreamCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex animate-pulse items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2">
        <div className="size-6 shrink-0 rounded-md bg-muted" />
        <div className="h-3 w-24 shrink-0 rounded bg-muted" />
        <div className="h-4 w-16 shrink-0 rounded bg-muted" />
        <div className="h-2 min-w-0 flex-1 rounded-full bg-muted" />
        <div className="h-3 w-8 shrink-0 rounded bg-muted" />
        <div className="h-5 w-16 shrink-0 rounded-full bg-muted" />
      </div>
    )
  }

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
