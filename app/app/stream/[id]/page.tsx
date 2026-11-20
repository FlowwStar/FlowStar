'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowDownLeft, Copy, Trash2 } from 'lucide-react'
import { StreamStatusBadge } from '@/components/streams/stream-status-badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { TokenAmount } from '@/components/ui/token-amount'
import { AccessibleCountdownTimer } from '@/components/ui/accessible-countdown-timer'
import { AccessibleUnlockAmount } from '@/components/ui/accessible-unlock-amount'
import { Button } from '@/components/ui/button'
import { useStream } from '@/hooks/use-streams'
import { useIsStreamCancelling } from '@/hooks/use-undo-cancel'
import { useWallet } from '@/hooks/use-wallet'
import { useNow } from '@/hooks/use-now'
import {
  getStreamStatus,
  getStreamProgress,
  getUnlockedAmount,
  getWithdrawableAmount,
  formatTokenAmount,
} from '@/lib/stream-utils'
import { useNetwork } from '@/components/providers/network-provider'
import { UnlockChart } from '@/components/streams/unlock-chart'
import { StreamTimeline } from '@/components/streams/stream-timeline'
import { DownloadReceiptButton } from '@/components/streams/download-receipt-button'
import { streamDetailCopy as copy } from '@/lib/copy/stream-detail'
import { ShareButtons } from '@/components/stream-detail/share-buttons'
import { ConnectPrompt } from '@/components/stream-detail/connect-prompt'
import { StreamDetailSkeleton } from '@/components/stream-detail/stream-detail-skeleton'
import { TtlWarning } from '@/components/stream-detail/ttl-warning'
import { StreamDetails } from '@/components/stream-detail/stream-details'
import { AutoWithdrawSection } from '@/components/stream-detail/auto-withdraw-section'
import { WithdrawDialog } from '@/components/stream-detail/withdraw-dialog'
import { CancelDialog } from '@/components/stream-detail/cancel-dialog'
import { CleanupDialog } from '@/components/stream-detail/cleanup-dialog'

function StreamDetail({ id }: { id: string }) {
  const { stream, loading } = useStream(id)
  const { address, isConnected } = useWallet()
  const { network } = useNetwork()
  const router = useRouter()
  const now = useNow(1000)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cleanupOpen, setCleanupOpen] = useState(false)
  const isCancelling = useIsStreamCancelling(id)

  if (loading) {
    return <StreamDetailSkeleton />
  }

  if (!stream) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-medium">{copy.notFound.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{copy.notFound.body}</p>
        <Button asChild className="mt-6">
          <Link href="/app">{copy.notFound.backButton}</Link>
        </Button>
      </div>
    )
  }

  const status = getStreamStatus(stream, now)
  const progress = getStreamProgress(stream, now)
  const unlocked = getUnlockedAmount(stream, now)
  const withdrawable = getWithdrawableAmount(stream, now)
  const withdrawnFrac =
    stream.depositedAmount > 0n
      ? Number((stream.withdrawnAmount * 10000n) / stream.depositedAmount) / 10000
      : 0

  const isRecipient = address === stream.recipient
  const isSender = address === stream.sender
  const canWithdraw = isRecipient && !stream.cancelled && withdrawable > 0n
  const canCancel = isSender && !stream.cancelled && status !== 'completed' && !isCancelling
  // Issue #689: eligible for cleanup once terminal — cancelled, or fully
  // withdrawn past end_time — mirroring the contract's own eligibility check.
  const canCleanup =
    (isSender || isRecipient) &&
    (stream.cancelled ||
      (status === 'completed' && stream.withdrawnAmount >= stream.depositedAmount))

  function handleDuplicate() {
    if (!stream) return
    const durationSecs = Number(stream.endTime - stream.startTime)
    const cliffSecs = Number(stream.cliffTime - stream.startTime)
    const hasCliff = stream.cliffTime > stream.startTime
    const params = new URLSearchParams({
      clone: stream.id,
      recipient: stream.recipient,
      token: stream.token.address,
      amount: (Number(stream.depositedAmount) / Math.pow(10, stream.token.decimals)).toString(),
      duration: durationSecs.toString(),
    })
    if (hasCliff) {
      params.set('cliff', cliffSecs.toString())
      if (stream.cliffAmount > 0n) {
        params.set(
          'cliffAmount',
          (Number(stream.cliffAmount) / Math.pow(10, stream.token.decimals)).toString(),
        )
      }
    }
    router.push(`/app/create?${params.toString()}`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back + Share */}
      <div className="flex items-center justify-between">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {copy.header.backLabel}
        </Link>
        <ShareButtons stream={stream} status={status} />
      </div>

      {/* Connect prompt for unauthenticated visitors */}
      {!isConnected && <ConnectPrompt />}

      {/* Header card */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={
                'flex size-10 items-center justify-center rounded-xl ' +
                (isSender ? 'bg-secondary text-muted-foreground' : 'bg-primary/10 text-primary')
              }
            >
              {isSender ? (
                <ArrowUpRight className="size-5" />
              ) : (
                <ArrowDownLeft className="size-5" />
              )}
            </span>
            <div>
              <p className="font-medium">
                {isSender ? copy.header.sending : copy.header.receiving}{' '}
                <TokenAmount
                  amount={stream.depositedAmount}
                  token={stream.token}
                  maxFractionDigits={2}
                />
              </p>
              <p className="text-xs text-muted-foreground">
                {copy.header.streamIdPrefix}
                {stream.id}
              </p>
            </div>
          </div>
          <StreamStatusBadge status={status} />
        </div>

        {/* Live counter */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {copy.header.unlockedSoFarLabel}
          </p>
          <div className="mt-1">
            <AccessibleUnlockAmount
              amount={unlocked}
              decimals={stream.token.decimals}
              symbol={stream.token.symbol}
              className="font-mono text-3xl font-semibold tabular-nums"
              isCompleted={status === 'completed'}
              isCliffReached={Number(stream.cliffTime) <= now && stream.cliffAmount > 0n}
            />
          </div>
        </div>

        {/* Progress */}
        <div>
          <ProgressBar
            value={progress}
            label={copy.header.unlockProgressLabel}
            marker={withdrawnFrac}
            indeterminateShimmer={status === 'streaming'}
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>
              {(progress * 100).toFixed(2)}
              {copy.header.unlockedFraction}
            </span>
            <span>
              <TokenAmount
                amount={stream.withdrawnAmount}
                token={stream.token}
                showSymbol={false}
                maxFractionDigits={2}
              />{' '}
              /{' '}
              <TokenAmount
                amount={stream.depositedAmount}
                token={stream.token}
                maxFractionDigits={2}
              />{' '}
              {copy.header.withdrawnSuffix}
            </span>
          </div>
        </div>

        {/* Countdown */}
        {(status === 'streaming' || status === 'scheduled') && (
          <div className="flex flex-wrap gap-6 text-sm">
            {status === 'scheduled' && (
              <div>
                <p className="text-xs text-muted-foreground">{copy.header.startsInLabel}</p>
                <AccessibleCountdownTimer
                  target={stream.startTime}
                  className="font-medium"
                  hideButton
                />
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">
                {status === 'scheduled' ? copy.header.durationLabel : copy.header.endsInLabel}
              </p>
              <AccessibleCountdownTimer target={stream.endTime} className="font-medium" />
            </div>
          </div>
        )}

        {/* Cancelling state */}
        {isCancelling && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="size-1.5 animate-pulse rounded-full bg-current" />
            {copy.header.cancellingNotice}
          </div>
        )}

        {/* Actions */}
        {(canWithdraw || canCancel || canCleanup || isSender) && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
            {canWithdraw && (
              <Button onClick={() => setWithdrawOpen(true)} className="gap-1.5">
                <ArrowDownLeft className="size-4" />
                {copy.header.withdrawButton}{' '}
                <span className="font-mono">
                  {formatTokenAmount(withdrawable, stream.token.decimals, 2)} {stream.token.symbol}
                </span>
              </Button>
            )}
            {canCancel && (
              <Button variant="secondary" onClick={() => setCancelOpen(true)}>
                {copy.header.cancelStreamButton}
              </Button>
            )}
            <DownloadReceiptButton stream={stream} />
            {isSender && (
              <Button variant="outline" onClick={handleDuplicate} className="gap-1.5">
                <Copy className="size-4" />
                {copy.header.duplicateStreamButton}
              </Button>
            )}
            {canCleanup && (
              <Button
                variant="outline"
                onClick={() => setCleanupOpen(true)}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                {copy.header.removeFromHistoryButton}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* TTL warning */}
      {!stream.cancelled && status !== 'completed' && (
        <TtlWarning stream={stream} nowSeconds={now} />
      )}

      {/* Unlock chart */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <UnlockChart stream={stream} nowSeconds={now} />
      </div>

      {/* Details */}
      <StreamDetails stream={stream} withdrawable={withdrawable} network={network} />

      {/* Transaction history timeline */}
      <StreamTimeline streamId={stream.id} />

      {/* Auto-withdraw (recipients only, active streams) */}
      {isRecipient && !stream.cancelled && status !== 'completed' && (
        <AutoWithdrawSection stream={stream} />
      )}

      {/* Dialogs */}
      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        streamId={stream.id}
        withdrawable={withdrawable}
        token={stream.token}
      />
      <CancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} streamId={stream.id} />
      <CleanupDialog
        open={cleanupOpen}
        onClose={() => setCleanupOpen(false)}
        streamId={stream.id}
        onCleaned={() => router.push('/app')}
      />
    </div>
  )
}

export default function StreamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <StreamDetail id={id} />
}