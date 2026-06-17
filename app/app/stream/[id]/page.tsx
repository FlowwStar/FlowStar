'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { RequireWallet } from '@/components/layout/require-wallet'
import { StreamStatusBadge } from '@/components/streams/stream-status-badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { TokenAmount } from '@/components/ui/token-amount'
import { CountdownTimer } from '@/components/ui/countdown-timer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useStream } from '@/hooks/use-streams'
import { useContract } from '@/hooks/use-contract'
import { useWallet } from '@/hooks/use-wallet'
import { useNow } from '@/hooks/use-now'
import {
  getStreamStatus,
  getStreamProgress,
  getUnlockedAmount,
  getWithdrawableAmount,
  formatTokenAmount,
  formatDateTime,
  parseTokenAmount,
  shortenAddress,
} from '@/lib/stream-utils'
import { NETWORK } from '@/lib/stellar'

// ─── Address copy button ────────────────────────────────────────────────────

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="group inline-flex items-center gap-1.5 font-mono text-sm hover:text-primary transition-colors"
    >
      <span className="truncate max-w-[200px] sm:max-w-xs">{shortenAddress(address, 6)}</span>
      {copied ? (
        <Check className="size-3.5 text-primary shrink-0" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  )
}

// ─── Detail row ─────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  )
}

// ─── Withdraw dialog ────────────────────────────────────────────────────────

function WithdrawDialog({
  open,
  onClose,
  streamId,
  withdrawable,
  token,
}: {
  open: boolean
  onClose: () => void
  streamId: string
  withdrawable: bigint
  token: { symbol: string; decimals: number; address: string }
}) {
  const { withdraw, pending, error } = useContract()
  const [inputAmount, setInputAmount] = useState('')

  const max = formatTokenAmount(withdrawable, token.decimals, token.decimals)
  const parsed = inputAmount ? parseTokenAmount(inputAmount, token.decimals) : 0n
  const invalid = parsed <= 0n || parsed > withdrawable

  async function handleWithdraw() {
    try {
      await withdraw(streamId, parsed)
      toast.success('Withdrawal successful', {
        description: `${formatTokenAmount(parsed, token.decimals, 4)} ${token.symbol} sent to your wallet.`,
      })
      onClose()
      setInputAmount('')
    } catch {
      // error shown inline
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Withdraw funds</DialogTitle>
          <DialogDescription>
            Enter how much to withdraw. Max:{' '}
            <span className="font-mono font-medium text-foreground">
              {max} {token.symbol}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-amount">Amount ({token.symbol})</Label>
            <div className="flex gap-2">
              <Input
                id="withdraw-amount"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                aria-invalid={!!inputAmount && invalid}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setInputAmount(max)}
              >
                Max
              </Button>
            </div>
            {inputAmount && invalid && (
              <p className="text-xs text-destructive">Amount exceeds withdrawable balance</p>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button onClick={handleWithdraw} disabled={pending || invalid || !inputAmount}>
              {pending ? 'Withdrawing…' : 'Withdraw'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Cancel dialog ───────────────────────────────────────────────────────────

function CancelDialog({
  open,
  onClose,
  streamId,
}: {
  open: boolean
  onClose: () => void
  streamId: string
}) {
  const { cancel, pending, error } = useContract()
  const router = useRouter()

  async function handleCancel() {
    try {
      await cancel(streamId)
      toast.success('Stream cancelled', {
        description: 'Unlocked funds sent to recipient. Remainder returned to you.',
      })
      onClose()
      router.push('/app')
    } catch {
      // error shown inline
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel stream</DialogTitle>
          <DialogDescription>
            Unlocked funds will be sent to the recipient. Any remaining locked
            tokens will be returned to your wallet. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Keep stream</Button>
          <Button variant="destructive" onClick={handleCancel} disabled={pending}>
            {pending ? 'Cancelling…' : 'Cancel stream'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

function StreamDetail({ id }: { id: string }) {
  const { stream, loading } = useStream(id)
  const { address } = useWallet()
  const now = useNow(1000)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground text-sm">
        Loading stream…
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-medium">Stream not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This stream may not exist or may have expired.
        </p>
        <Button asChild className="mt-6">
          <Link href="/app">Back to dashboard</Link>
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
  const canCancel = isSender && !stream.cancelled && status !== 'completed'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back */}
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Dashboard
      </Link>

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
                {isSender ? 'Sending' : 'Receiving'}{' '}
                <TokenAmount
                  amount={stream.depositedAmount}
                  token={stream.token}
                  maxFractionDigits={2}
                />
              </p>
              <p className="text-xs text-muted-foreground">Stream #{stream.id}</p>
            </div>
          </div>
          <StreamStatusBadge status={status} />
        </div>

        {/* Live counter */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Unlocked so far
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
            {formatTokenAmount(unlocked, stream.token.decimals, 4)}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {stream.token.symbol}
            </span>
          </p>
        </div>

        {/* Progress */}
        <div>
          <ProgressBar
            value={progress}
            marker={withdrawnFrac}
            indeterminateShimmer={status === 'streaming'}
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{(progress * 100).toFixed(2)}% unlocked</span>
            <span>
              <TokenAmount
                amount={stream.withdrawnAmount}
                token={stream.token}
                showSymbol={false}
                maxFractionDigits={2}
              />{' '}
              / <TokenAmount
                amount={stream.depositedAmount}
                token={stream.token}
                maxFractionDigits={2}
              />{' '}
              withdrawn
            </span>
          </div>
        </div>

        {/* Countdown */}
        {(status === 'streaming' || status === 'scheduled') && (
          <div className="flex gap-6 text-sm">
            {status === 'scheduled' && (
              <div>
                <p className="text-xs text-muted-foreground">Starts in</p>
                <CountdownTimer target={stream.startTime} className="font-medium" />
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">
                {status === 'scheduled' ? 'Duration' : 'Ends in'}
              </p>
              <CountdownTimer target={stream.endTime} className="font-medium" />
            </div>
          </div>
        )}

        {/* Actions */}
        {(canWithdraw || canCancel) && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
            {canWithdraw && (
              <Button onClick={() => setWithdrawOpen(true)} className="gap-1.5">
                <ArrowDownLeft className="size-4" />
                Withdraw{' '}
                <span className="font-mono">
                  {formatTokenAmount(withdrawable, stream.token.decimals, 2)}{' '}
                  {stream.token.symbol}
                </span>
              </Button>
            )}
            {canCancel && (
              <Button
                variant="secondary"
                onClick={() => setCancelOpen(true)}
              >
                Cancel stream
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Details
        </h2>
        <DetailRow label="Sender">
          <CopyableAddress address={stream.sender} />
        </DetailRow>
        <DetailRow label="Recipient">
          <CopyableAddress address={stream.recipient} />
        </DetailRow>
        <DetailRow label="Token">
          <span className="font-mono">{stream.token.symbol}</span>
        </DetailRow>
        <DetailRow label="Total deposited">
          <TokenAmount amount={stream.depositedAmount} token={stream.token} maxFractionDigits={4} />
        </DetailRow>
        <DetailRow label="Withdrawn">
          <TokenAmount amount={stream.withdrawnAmount} token={stream.token} maxFractionDigits={4} />
        </DetailRow>
        <DetailRow label="Withdrawable now">
          <span className={withdrawable > 0n ? 'text-primary font-medium' : ''}>
            <TokenAmount amount={withdrawable} token={stream.token} maxFractionDigits={4} />
          </span>
        </DetailRow>
        <DetailRow label="Rate">
          <span className="font-mono">
            {formatTokenAmount(stream.amountPerSecond, stream.token.decimals, 6)}{' '}
            {stream.token.symbol}/s
          </span>
        </DetailRow>
        <DetailRow label="Start">
          {formatDateTime(stream.startTime)}
        </DetailRow>
        {stream.cliffTime > stream.startTime && (
          <DetailRow label="Cliff">
            {formatDateTime(stream.cliffTime)}
            {stream.cliffAmount > 0n && (
              <span className="text-muted-foreground ml-1">
                (+<TokenAmount amount={stream.cliffAmount} token={stream.token} maxFractionDigits={2} />)
              </span>
            )}
          </DetailRow>
        )}
        <DetailRow label="End">
          {formatDateTime(stream.endTime)}
        </DetailRow>
        <DetailRow label="Network">
          <span className="capitalize">{NETWORK.name}</span>
        </DetailRow>
      </div>

      {/* Dialogs */}
      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        streamId={stream.id}
        withdrawable={withdrawable}
        token={stream.token}
      />
      <CancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        streamId={stream.id}
      />
    </div>
  )
}

export default function StreamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return (
    <RequireWallet>
      <StreamDetail id={id} />
    </RequireWallet>
  )
}
