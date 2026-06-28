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
  Timer,
  AlertTriangle,
  Link as LinkIcon,
  Wallet,
  Share2,
  MessageCircle,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConnectWalletButton } from '@/components/layout/connect-wallet-button'
import { StreamStatusBadge } from '@/components/streams/stream-status-badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { TokenAmount } from '@/components/ui/token-amount'
import { CountdownTimer } from '@/components/ui/countdown-timer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FeeEstimateDialog } from '@/components/ui/fee-estimate-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { calculateFeeBreakdown, TYPICAL_FEES, isHighFee } from '@/lib/fee-utils'
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
  formatRate,
} from '@/lib/stream-utils'
import { explorerUrl } from '@/lib/stellar'
import { useNetwork } from '@/components/providers/network-provider'
import { useAutoWithdraw } from '@/hooks/use-auto-withdraw'
import { UnlockChart } from '@/components/streams/unlock-chart'
import { StreamTimeline } from '@/components/streams/stream-timeline'
import { bumpStreamTtl } from '@/lib/contract'

// ─── Address copy button ────────────────────────────────────────────────────

function CopyableAddress({ address, href }: { address: string; href?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <span className="inline-flex items-center gap-1">
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
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label="View on Stellar Expert"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </span>
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
  const { network } = useNetwork()
  const [inputAmount, setInputAmount] = useState('')
  const [showFeeEstimate, setShowFeeEstimate] = useState(false)

  const max = formatTokenAmount(withdrawable, token.decimals, token.decimals)
  const parsed = inputAmount ? parseTokenAmount(inputAmount, token.decimals) : 0n
  const invalid = parsed <= 0n || parsed > withdrawable

  // Calculate estimated fees
  const estimatedFee = TYPICAL_FEES.withdraw.typical
  const feeBreakdown = calculateFeeBreakdown(estimatedFee)
  const withdrawFeeHigh = isHighFee(estimatedFee, TYPICAL_FEES.withdraw.typical)

  async function handleWithdraw() {
    try {
      const hash = await withdraw(streamId, parsed)
      toast.success('Withdrawal successful', {
        description: `${formatTokenAmount(parsed, token.decimals, 4)} ${token.symbol} sent to your wallet.`,
        ...(hash && {
          action: {
            label: 'View transaction',
            onClick: () => window.open(explorerUrl(network, 'tx', hash), '_blank'),
          },
        }),
      })
      onClose()
      setInputAmount('')
    } catch {
      // error shown inline
    }
  }

  return (
    <>
      <Dialog open={open && !showFeeEstimate} onOpenChange={(o) => !o && onClose()}>
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

            {/* Fee info */}
            <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Estimated network fee: <span className="font-mono text-foreground">{(estimatedFee / 1e7).toFixed(7)} XLM</span>
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Fee will be shown again before wallet confirmation.
              </p>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
              <Button
                onClick={() => setShowFeeEstimate(true)}
                disabled={pending || invalid || !inputAmount}
              >
                {pending ? 'Withdrawing…' : 'Review fees'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FeeEstimateDialog
        open={showFeeEstimate}
        onConfirm={handleWithdraw}
        onCancel={() => setShowFeeEstimate(false)}
        fees={feeBreakdown}
        action="withdrawal"
        averageFee={TYPICAL_FEES.withdraw.typical}
        isHighFee={withdrawFeeHigh}
        loading={pending}
      />
    </>
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
  const { network } = useNetwork()
  const router = useRouter()
  const [showFeeEstimate, setShowFeeEstimate] = useState(false)

  const estimatedFee = TYPICAL_FEES.cancel.typical
  const feeBreakdown = calculateFeeBreakdown(estimatedFee)
  const cancelFeeHigh = isHighFee(estimatedFee, TYPICAL_FEES.cancel.typical)

  async function handleCancel() {
    try {
      const hash = await cancel(streamId)
      toast.success('Stream cancelled', {
        description: 'Unlocked funds sent to recipient. Remainder returned to you.',
        ...(hash && {
          action: {
            label: 'View transaction',
            onClick: () => window.open(explorerUrl(network, 'tx', hash), '_blank'),
          },
        }),
      })
      onClose()
      router.push('/app')
    } catch {
      // error shown inline
    }
  }

  return (
    <>
      <Dialog open={open && !showFeeEstimate} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel stream</DialogTitle>
            <DialogDescription>
              Unlocked funds will be sent to the recipient. Any remaining locked
              tokens will be returned to your wallet. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {/* Fee info */}
          <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Estimated network fee: <span className="font-mono text-foreground">{(estimatedFee / 1e7).toFixed(7)} XLM</span>
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>Keep stream</Button>
            <Button
              variant="destructive"
              onClick={() => setShowFeeEstimate(true)}
              disabled={pending}
            >
              {pending ? 'Cancelling…' : 'Review & cancel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FeeEstimateDialog
        open={showFeeEstimate}
        onConfirm={handleCancel}
        onCancel={() => setShowFeeEstimate(false)}
        fees={feeBreakdown}
        action="stream cancellation"
        averageFee={TYPICAL_FEES.cancel.typical}
        isHighFee={cancelFeeHigh}
        loading={pending}
      />
    </>
  )
}

// ─── Auto-withdraw settings ─────────────────────────────────────────────────

const INTERVAL_OPTIONS = [
  { label: 'Every 6 hours', hours: 6 },
  { label: 'Every 12 hours', hours: 12 },
  { label: 'Every 24 hours', hours: 24 },
  { label: 'Every 48 hours', hours: 48 },
] as const

function AutoWithdrawSection({
  stream,
}: {
  stream: import('@/types/stream').StreamData
}) {
  const { settings, updateSettings, lastAutoWithdraw, autoWithdrawPending, withdrawalHistory } = useAutoWithdraw(stream)
  const [minDisplay, setMinDisplay] = useState('')
  const [maxDisplay, setMaxDisplay] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const STRATEGY_OPTIONS: Array<{ value: import('@/hooks/use-auto-withdraw').WithdrawStrategy; label: string; description: string }> = [
    { value: 'time-based', label: 'Time-based', description: 'Withdraw on fixed intervals' },
    { value: 'threshold-based', label: 'Threshold-based', description: 'Withdraw when amount reaches threshold' },
    { value: 'gas-optimized', label: 'Gas-optimized', description: 'Limit frequency to reduce gas costs' },
    { value: 'max', label: 'Max amount', description: 'Always withdraw maximum available' },
  ]

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Auto-withdraw
          </h2>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
            className="peer sr-only"
            aria-label="Enable auto-withdraw"
          />
          <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors after:absolute after:left-[2px] after:top-[2px] after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </div>

      {settings.enabled && (
        <div className="space-y-4 pt-1">
          <p className="text-xs text-muted-foreground">
            Automatically withdraw funds using your chosen strategy. The app must be open and your wallet connected.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">Strategy</Label>
            <div className="space-y-2">
              {STRATEGY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateSettings({ strategy: opt.value })}
                  className={
                    'w-full text-left p-3 rounded-lg border transition-colors ' +
                    (settings.strategy === opt.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50')
                  }
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {settings.strategy === 'time-based' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Frequency</Label>
              <div className="flex flex-wrap gap-2">
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.hours}
                    type="button"
                    onClick={() => updateSettings({ intervalHours: opt.hours })}
                    className={
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                      (settings.intervalHours === opt.hours
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary hover:text-primary')
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {settings.strategy === 'threshold-based' && (
            <div className="space-y-1.5">
              <Label htmlFor="threshold" className="text-xs">
                Threshold (% of total deposited)
              </Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                max="100"
                value={settings.thresholdPercentage}
                onChange={(e) => updateSettings({ thresholdPercentage: parseInt(e.target.value) || 50 })}
                className="max-w-48"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="min-amount" className="text-xs">
              Minimum amount ({stream.token.symbol})
            </Label>
            <Input
              id="min-amount"
              type="number"
              min="0"
              step="any"
              placeholder="0 (no minimum)"
              value={minDisplay}
              onChange={(e) => {
                setMinDisplay(e.target.value)
                const raw = e.target.value
                  ? parseTokenAmount(e.target.value, stream.token.decimals).toString()
                  : '0'
                updateSettings({ minAmountRaw: raw })
              }}
              className="max-w-48"
            />
            <p className="text-xs text-muted-foreground">
              Skip auto-withdraw if the available amount is below this threshold.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max-limit" className="text-xs">
              Maximum safety limit ({stream.token.symbol})
            </Label>
            <Input
              id="max-limit"
              type="number"
              min="0"
              step="any"
              placeholder="0 (no limit)"
              value={maxDisplay}
              onChange={(e) => {
                setMaxDisplay(e.target.value)
                const raw = e.target.value
                  ? parseTokenAmount(e.target.value, stream.token.decimals).toString()
                  : '0'
                updateSettings({ maxSafetyLimitRaw: raw })
              }}
              className="max-w-48"
            />
            <p className="text-xs text-muted-foreground">
              Never withdraw more than this amount per transaction.
            </p>
          </div>

          {autoWithdrawPending && (
            <p className="text-xs text-primary">Auto-withdrawing...</p>
          )}
          {lastAutoWithdraw && (
            <p className="text-xs text-muted-foreground">
              Last auto-withdrawal: {new Date(lastAutoWithdraw).toLocaleTimeString()}
            </p>
          )}

          {withdrawalHistory.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-primary hover:underline"
              >
                {showHistory ? 'Hide' : 'Show'} withdrawal history ({withdrawalHistory.length})
              </button>
              {showHistory && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {withdrawalHistory.map((entry, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground font-mono p-1.5 bg-secondary rounded">
                      <p>{new Date(entry.timestamp).toLocaleTimeString()}</p>
                      <p className={entry.error ? 'text-destructive' : 'text-primary'}>
                        {entry.error ? `Error: ${entry.error}` : `Withdrew: ${entry.amount}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TTL warning ───────────────────────────────────────────────────────────

const TTL_DAYS = 30
const WARN_DAYS = 7

function estimateDaysSinceLastWrite(stream: import('@/types/stream').StreamData, nowSeconds: number): number {
  const now = BigInt(nowSeconds)
  const lastWrite = stream.withdrawnAmount > 0n
    ? now
    : stream.cancelled
      ? now
      : stream.startTime
  return Number(now - lastWrite) / 86400
}

function TtlWarning({ stream, nowSeconds }: { stream: import('@/types/stream').StreamData; nowSeconds: number }) {
  const { address } = useWallet()
  const { network } = useNetwork()
  const [bumping, setBumping] = useState(false)
  const [bumped, setBumped] = useState(false)

  const daysSinceWrite = estimateDaysSinceLastWrite(stream, nowSeconds)
  const estimatedDaysLeft = TTL_DAYS - daysSinceWrite

  if (bumped || estimatedDaysLeft > WARN_DAYS || estimatedDaysLeft < 0) return null

  async function handleBump() {
    if (!address) return
    setBumping(true)
    try {
      await bumpStreamTtl(network, stream.id, address)
      setBumped(true)
      toast.success('Storage TTL extended by 30 days')
    } catch {
      toast.error('Failed to extend TTL')
    } finally {
      setBumping(false)
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-500" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
          Storage may be expiring soon
        </p>
        <p className="text-xs text-yellow-600 dark:text-yellow-400/80">
          This stream&apos;s on-chain data may expire in ~{Math.max(0, Math.floor(estimatedDaysLeft))} day{Math.floor(estimatedDaysLeft) !== 1 ? 's' : ''}.
          Extend the TTL to prevent data loss and keep the stream active.
        </p>
        {address && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleBump}
            disabled={bumping}
            className="mt-2 border-yellow-500/40 text-yellow-700 hover:bg-yellow-500/10 dark:text-yellow-400"
          >
            {bumping ? 'Extending…' : 'Extend TTL'}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Rate display ──────────────────────────────────────────────────────────

function RateDisplay({ stream }: { stream: import('@/types/stream').StreamData }) {
  const [expanded, setExpanded] = useState(false)
  const rate = formatRate(stream.amountPerSecond, stream.token.decimals, stream.token.symbol)

  return (
    <div className="text-right">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="font-mono text-sm font-medium text-primary hover:underline"
      >
        {rate.best}
      </button>
      {expanded && (
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground font-mono">
          <p>{rate.perMinute}</p>
          <p>{rate.perHour}</p>
          <p>{rate.perDay}</p>
          <p>{rate.perMonth}</p>
          <p>{rate.perYear}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

function ShareButtons({ streamId }: { streamId: string }) {
  const [copied, setCopied] = useState(false)
  const [showShare, setShowShare] = useState(false)

  const streamUrl = typeof window !== 'undefined' ? window.location.href : `https://flowstar.app/app/stream/${streamId}`
  const shareText = `Check out this token stream on FlowStar - Stream #${streamId}`

  function copyLink() {
    navigator.clipboard.writeText(streamUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    toast.success('Link copied to clipboard')
  }

  function shareToTwitter() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(streamUrl)}`
    window.open(url, '_blank', 'width=550,height=420')
  }

  function shareToTelegram() {
    const url = `https://t.me/share/url?url=${encodeURIComponent(streamUrl)}&text=${encodeURIComponent(shareText)}`
    window.open(url, '_blank', 'width=550,height=420')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowShare(!showShare)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Share stream"
      >
        <Share2 className="size-4" />
        Share
      </button>

      {showShare && (
        <div className="absolute right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50">
          <div className="flex flex-col gap-1 p-2 min-w-max">
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
              aria-label="Copy link"
            >
              {copied ? <Check className="size-4" /> : <LinkIcon className="size-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={shareToTwitter}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
              aria-label="Share on Twitter"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7" />
              </svg>
              Twitter
            </button>
            <button
              onClick={shareToTelegram}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
              aria-label="Share on Telegram"
            >
              <MessageCircle className="size-4" />
              Telegram
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectPrompt() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <Wallet className="size-5 shrink-0 text-muted-foreground" />
      <p className="text-sm text-muted-foreground flex-1">
        Connect your wallet to withdraw, cancel, or interact with this stream.
      </p>
      <ConnectWalletButton />
    </div>
  )
}

function StreamDetail({ id }: { id: string }) {
  const { stream, loading } = useStream(id)
  const { address, isConnected } = useWallet()
  const { network, config } = useNetwork()
  const router = useRouter()
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

  function handleDuplicate() {
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
        params.set('cliffAmount', (Number(stream.cliffAmount) / Math.pow(10, stream.token.decimals)).toString())
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
          Dashboard
        </Link>
        <ShareButtons streamId={stream.id} />
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
        {(canWithdraw || canCancel || isSender) && (
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
            {isSender && (
              <Button
                variant="outline"
                onClick={handleDuplicate}
                className="gap-1.5"
              >
                <Copy className="size-4" />
                Duplicate stream
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
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Details
        </h2>
        <DetailRow label="Sender">
          <CopyableAddress address={stream.sender} href={explorerUrl(network, 'account', stream.sender)} />
        </DetailRow>
        <DetailRow label="Recipient">
          <CopyableAddress address={stream.recipient} href={explorerUrl(network, 'account', stream.recipient)} />
        </DetailRow>
        <DetailRow label="Token">
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{stream.token.symbol}</span>
            <CopyableAddress
              address={stream.token.address}
              href={explorerUrl(network, 'contract', stream.token.address)}
            />
          </div>
        </DetailRow>
        {config.streamContractId && (
          <DetailRow label="Stream Contract">
            <CopyableAddress
              address={config.streamContractId}
              href={explorerUrl(network, 'contract', config.streamContractId)}
            />
          </DetailRow>
        )}
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
          <RateDisplay stream={stream} />
        </DetailRow>
        <DetailRow label="Start">
          <span>
            {formatDateTime(stream.startTime)}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({new Date(Number(stream.startTime) * 1000).toUTCString().replace(' GMT', ' UTC')})
            </span>
          </span>
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
          <span>
            {formatDateTime(stream.endTime)}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({new Date(Number(stream.endTime) * 1000).toUTCString().replace(' GMT', ' UTC')})
            </span>
          </span>
        </DetailRow>
        <DetailRow label="Network">
          <span className="capitalize">{network}</span>
        </DetailRow>
      </div>

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
  return <StreamDetail id={id} />
}
