"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { ConnectWalletButton } from "@/components/layout/connect-wallet-button";
import { StreamStatusBadge } from "@/components/streams/stream-status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TokenAmount } from "@/components/ui/token-amount";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import { AccessibleCountdownTimer } from "@/components/ui/accessible-countdown-timer";
import { AccessibleUnlockAmount } from "@/components/ui/accessible-unlock-amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeeEstimateDialog } from "@/components/ui/fee-estimate-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  calculateFeeBreakdown,
  TYPICAL_FEES,
  isHighFee,
} from "@/lib/fee-utils";
import { useStream } from "@/hooks/use-streams";
import { useContract } from "@/hooks/use-contract";
import { useUndoableCancel, useIsStreamCancelling } from "@/hooks/use-undo-cancel";
import { useWallet } from "@/hooks/use-wallet";
import { useNow } from "@/hooks/use-now";
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
  SECONDS_PER_DAY,
} from "@/lib/stream-utils";
import { explorerUrl } from "@/lib/stellar";
import { useNetwork } from "@/components/providers/network-provider";
import { useAutoWithdraw } from "@/hooks/use-auto-withdraw";
import { useTokenPrice } from "@/hooks/use-token-price";
import { UnlockChart } from "@/components/streams/unlock-chart";
import { StreamTimeline } from "@/components/streams/stream-timeline";
import { DownloadReceiptButton } from "@/components/streams/download-receipt-button";
import { bumpStreamTtl } from "@/lib/contract";
import { getFederationNameForAddress } from "@/lib/address-book";
import { QrShareDialog } from "@/components/streams/qr-share-dialog";
import { streamDetailCopy as copy } from "@/lib/copy/stream-detail";

// ─── Address copy button ────────────────────────────────────────────────────

function CopyableAddress({
  address,
  href,
  federationName,
}: {
  address: string;
  href?: string;
  /** Issue #155: known Federation name (e.g. alice*domain.com) for this address, if any. */
  federationName?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={copy}
        aria-label={copy.copyableAddress.copyAriaLabel}
        title={federationName ? address : undefined}
        className="group inline-flex items-center gap-1.5 font-mono text-sm hover:text-primary transition-colors"
      >
        <span className="truncate max-w-[200px] sm:max-w-xs">
          {federationName ?? shortenAddress(address, 6)}
        </span>
        {copied ? (
          <Check className="size-3.5 text-primary shrink-0" />
        ) : (
          <Copy className="size-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? copy.copyableAddress.copiedStatus : ""}
      </span>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label={copy.copyableAddress.viewOnExplorerAriaLabel}
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </span>
  );
}

// ─── Detail row ─────────────────────────────────────────────────────────────

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  );
}

// ─── Withdraw dialog ────────────────────────────────────────────────────────

function WithdrawDialog({
  open,
  onClose,
  streamId,
  withdrawable,
  token,
}: {
  open: boolean;
  onClose: () => void;
  streamId: string;
  withdrawable: bigint;
  token: { symbol: string; decimals: number; address: string };
}) {
  const { withdraw, pending, error } = useContract();
  const { network } = useNetwork();
  const { usdPrice: xlmPrice } = useTokenPrice("XLM");
  const [inputAmount, setInputAmount] = useState("");
  const [showFeeEstimate, setShowFeeEstimate] = useState(false);

  const max = formatTokenAmount(withdrawable, token.decimals, token.decimals);
  const parsed = inputAmount
    ? parseTokenAmount(inputAmount, token.decimals)
    : 0n;
  const invalid = parsed <= 0n || parsed > withdrawable;

  // Calculate estimated fees
  const estimatedFee = TYPICAL_FEES.withdraw.typical;
  const feeBreakdown = calculateFeeBreakdown(estimatedFee, xlmPrice ?? undefined);
  const withdrawFeeHigh = isHighFee(
    feeBreakdown.totalEstimated,
    TYPICAL_FEES.withdraw.typical,
  );

  async function handleWithdraw() {
    try {
      const hash = await withdraw(streamId, parsed);
      toast.success(copy.withdrawDialog.successToastTitle, {
        description: copy.withdrawDialog.successToastDescription(
          formatTokenAmount(parsed, token.decimals, 4),
          token.symbol,
        ),
        ...(hash && {
          action: {
            label: copy.withdrawDialog.viewTransactionAction,
            onClick: () =>
              window.open(explorerUrl(network, "tx", hash), "_blank"),
          },
        }),
      });
      onClose();
      setInputAmount("");
    } catch {
      // error shown inline
    }
  }

  return (
    <>
      <Dialog
        open={open && !showFeeEstimate}
        onOpenChange={(o) => !o && onClose()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{copy.withdrawDialog.title}</DialogTitle>
            <DialogDescription>
              {copy.withdrawDialog.maxPrefix}{" "}
              <span className="font-mono font-medium text-foreground">
                {max} {token.symbol}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="withdraw-amount">
                {copy.withdrawDialog.amountLabel(token.symbol)}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="withdraw-amount"
                  type="number"
                  min="0"
                  step="any"
                  placeholder={copy.withdrawDialog.amountPlaceholder}
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
                  {copy.withdrawDialog.maxButton}
                </Button>
              </div>
              {inputAmount && invalid && (
                <p className="text-xs text-destructive">
                  {copy.withdrawDialog.exceedsBalance}
                </p>
              )}
            </div>

            {/* Fee info */}
            <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                {copy.withdrawDialog.estimatedFeeLabel}{" "}
                <span className="font-mono text-foreground">
                  {(estimatedFee / 1e7).toFixed(7)} XLM
                </span>
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {copy.withdrawDialog.feeShownAgainNote}
              </p>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={pending}>
                {copy.withdrawDialog.cancelButton}
              </Button>
              <Button
                onClick={() => setShowFeeEstimate(true)}
                disabled={pending || invalid || !inputAmount}
              >
                {pending ? copy.withdrawDialog.withdrawing : copy.withdrawDialog.reviewFeesButton}
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
  );
}

// ─── Cancel dialog ───────────────────────────────────────────────────────────

function CancelDialog({
  open,
  onClose,
  streamId,
}: {
  open: boolean;
  onClose: () => void;
  streamId: string;
}) {
  const { scheduleCancel } = useUndoableCancel();
  const { usdPrice: xlmPrice } = useTokenPrice("XLM");
  const [showFeeEstimate, setShowFeeEstimate] = useState(false);

  const estimatedFee = TYPICAL_FEES.cancel.typical;
  const feeBreakdown = calculateFeeBreakdown(estimatedFee, xlmPrice ?? undefined);
  const cancelFeeHigh = isHighFee(feeBreakdown.totalEstimated, TYPICAL_FEES.cancel.typical);

  function handleCancel() {
    // Don't submit immediately — schedule an undoable cancellation. The
    // actual `cancel` transaction (and its success/error toast) fires from
    // useUndoableCancel once the countdown expires without being undone.
    scheduleCancel(streamId);
    setShowFeeEstimate(false);
    onClose();
  }

  return (
    <>
      <Dialog
        open={open && !showFeeEstimate}
        onOpenChange={(o) => !o && onClose()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{copy.cancelDialog.title}</DialogTitle>
            <DialogDescription>{copy.cancelDialog.description}</DialogDescription>
          </DialogHeader>

          {/* Fee info */}
          <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              {copy.cancelDialog.estimatedFeeLabel}{" "}
              <span className="font-mono text-foreground">
                {(estimatedFee / 1e7).toFixed(7)} XLM
              </span>
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              {copy.cancelDialog.keepStreamButton}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowFeeEstimate(true)}
            >
              {copy.cancelDialog.reviewAndCancelButton}
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
        loading={false}
      />
    </>
  );
}

// ─── Auto-withdraw settings ─────────────────────────────────────────────────

const INTERVAL_OPTIONS = [
  { label: copy.autoWithdraw.intervalOptionLabels[0], hours: 6 },
  { label: copy.autoWithdraw.intervalOptionLabels[1], hours: 12 },
  { label: copy.autoWithdraw.intervalOptionLabels[2], hours: 24 },
  { label: copy.autoWithdraw.intervalOptionLabels[3], hours: 48 },
] as const;

function AutoWithdrawSection({
  stream,
}: {
  stream: import("@/types/stream").StreamData;
}) {
  const {
    settings,
    updateSettings,
    lastAutoWithdraw,
    autoWithdrawPending,
    withdrawalHistory,
  } = useAutoWithdraw(stream);
  const [minDisplay, setMinDisplay] = useState("");
  const [maxDisplay, setMaxDisplay] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const STRATEGY_OPTIONS: Array<{
    value: import("@/hooks/use-auto-withdraw").WithdrawStrategy;
    label: string;
    description: string;
  }> = [
    {
      value: "time-based",
      ...copy.autoWithdraw.strategies.timeBased,
    },
    {
      value: "threshold-based",
      ...copy.autoWithdraw.strategies.thresholdBased,
    },
    {
      value: "gas-optimized",
      ...copy.autoWithdraw.strategies.gasOptimized,
    },
    {
      value: "max",
      ...copy.autoWithdraw.strategies.max,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {copy.autoWithdraw.title}
          </h2>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
            className="peer sr-only"
            aria-label={copy.autoWithdraw.enableAriaLabel}
          />
          <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors after:absolute after:left-[2px] after:top-[2px] after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </div>

      {settings.enabled && (
        <div className="space-y-4 pt-1">
          <p className="text-xs text-muted-foreground">
            {copy.autoWithdraw.helpText}
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">{copy.autoWithdraw.strategyLabel}</Label>
            <div className="space-y-2">
              {STRATEGY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateSettings({ strategy: opt.value })}
                  aria-pressed={settings.strategy === opt.value}
                  className={
                    "w-full text-left p-3 rounded-lg border transition-colors " +
                    (settings.strategy === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50")
                  }
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {settings.strategy === "time-based" && (
            <div className="space-y-1.5">
              <Label className="text-xs">{copy.autoWithdraw.frequencyLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.hours}
                    type="button"
                    onClick={() => updateSettings({ intervalHours: opt.hours })}
                    aria-pressed={settings.intervalHours === opt.hours}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                      (settings.intervalHours === opt.hours
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary hover:text-primary")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {settings.strategy === "threshold-based" && (
            <div className="space-y-1.5">
              <Label htmlFor="threshold" className="text-xs">
                {copy.autoWithdraw.thresholdLabel}
              </Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                max="100"
                value={settings.thresholdPercentage}
                onChange={(e) =>
                  updateSettings({
                    thresholdPercentage: parseInt(e.target.value) || 50,
                  })
                }
                className="max-w-48"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="min-amount" className="text-xs">
              {copy.autoWithdraw.minAmountLabel(stream.token.symbol)}
            </Label>
            <Input
              id="min-amount"
              type="number"
              min="0"
              step="any"
              placeholder={copy.autoWithdraw.minAmountPlaceholder}
              value={minDisplay}
              onChange={(e) => {
                setMinDisplay(e.target.value);
                const raw = e.target.value
                  ? parseTokenAmount(
                      e.target.value,
                      stream.token.decimals,
                    ).toString()
                  : "0";
                updateSettings({ minAmountRaw: raw });
              }}
              className="max-w-48"
            />
            <p className="text-xs text-muted-foreground">
              {copy.autoWithdraw.minAmountHelp}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max-limit" className="text-xs">
              {copy.autoWithdraw.maxLimitLabel(stream.token.symbol)}
            </Label>
            <Input
              id="max-limit"
              type="number"
              min="0"
              step="any"
              placeholder={copy.autoWithdraw.maxLimitPlaceholder}
              value={maxDisplay}
              onChange={(e) => {
                setMaxDisplay(e.target.value);
                const raw = e.target.value
                  ? parseTokenAmount(
                      e.target.value,
                      stream.token.decimals,
                    ).toString()
                  : "0";
                updateSettings({ maxSafetyLimitRaw: raw });
              }}
              className="max-w-48"
            />
            <p className="text-xs text-muted-foreground">
              {copy.autoWithdraw.maxLimitHelp}
            </p>
          </div>

          {autoWithdrawPending && (
            <p className="text-xs text-primary">
              {copy.autoWithdraw.autoWithdrawingStatus}
            </p>
          )}
          {lastAutoWithdraw && (
            <p className="text-xs text-muted-foreground">
              {copy.autoWithdraw.lastAutoWithdrawalPrefix}{" "}
              {new Date(lastAutoWithdraw).toLocaleTimeString()}
            </p>
          )}

          {withdrawalHistory.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-primary hover:underline"
                aria-expanded={showHistory}
                aria-controls="stream-withdrawal-history"
              >
                {showHistory
                  ? copy.autoWithdraw.hideHistoryButton
                  : copy.autoWithdraw.showHistoryButton}{" "}
                {copy.autoWithdraw.withdrawalHistorySuffix} (
                {withdrawalHistory.length})
              </button>
              {showHistory && (
                <div
                  id="stream-withdrawal-history"
                  className="space-y-1 max-h-32 overflow-y-auto"
                >
                  {withdrawalHistory.map((entry, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-muted-foreground font-mono p-1.5 bg-secondary rounded"
                    >
                      <p>{new Date(entry.timestamp).toLocaleTimeString()}</p>
                      <p
                        className={
                          entry.error ? "text-destructive" : "text-primary"
                        }
                      >
                        {entry.error
                          ? `${copy.autoWithdraw.historyErrorPrefix} ${entry.error}`
                          : `${copy.autoWithdraw.historyWithdrewPrefix} ${entry.amount}`}
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
  );
}

// ─── TTL warning ───────────────────────────────────────────────────────────

const TTL_DAYS = 30;
const WARN_DAYS = 7;

function estimateDaysSinceLastWrite(
  stream: import("@/types/stream").StreamData,
  nowSeconds: number,
): number {
  const now = BigInt(nowSeconds);
  const lastWrite =
    stream.withdrawnAmount > 0n
      ? now
      : stream.cancelled
        ? now
        : stream.startTime;
  return Number(now - lastWrite) / SECONDS_PER_DAY;
}

function TtlWarning({
  stream,
  nowSeconds,
}: {
  stream: import("@/types/stream").StreamData;
  nowSeconds: number;
}) {
  const { address } = useWallet();
  const { network } = useNetwork();
  const [bumping, setBumping] = useState(false);
  const [bumped, setBumped] = useState(false);

  const daysSinceWrite = estimateDaysSinceLastWrite(stream, nowSeconds);
  const estimatedDaysLeft = TTL_DAYS - daysSinceWrite;

  if (bumped || estimatedDaysLeft > WARN_DAYS || estimatedDaysLeft < 0)
    return null;

  async function handleBump() {
    if (!address) return;
    setBumping(true);
    try {
      await bumpStreamTtl(network, stream.id, address);
      setBumped(true);
      toast.success(copy.ttlWarning.successToast);
    } catch {
      toast.error(copy.ttlWarning.errorToast);
    } finally {
      setBumping(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-500" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
          {copy.ttlWarning.title}
        </p>
        <p className="text-xs text-yellow-600 dark:text-yellow-400/80">
          {copy.ttlWarning.body(
            Math.max(0, Math.floor(estimatedDaysLeft)),
            Math.floor(estimatedDaysLeft) !== 1,
          )}
        </p>
        {address && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleBump}
            disabled={bumping}
            className="mt-2 border-yellow-500/40 text-yellow-700 hover:bg-yellow-500/10 dark:text-yellow-400"
          >
            {bumping ? copy.ttlWarning.extendingButton : copy.ttlWarning.extendTtlButton}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Rate display ──────────────────────────────────────────────────────────

function RateDisplay({
  stream,
}: {
  stream: import("@/types/stream").StreamData;
}) {
  const [expanded, setExpanded] = useState(false);
  const rate = formatRate(
    stream.amountPerSecond,
    stream.token.decimals,
    stream.token.symbol,
  );

  return (
    <div className="text-right">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="rate-breakdown"
        onClick={() => setExpanded((v) => !v)}
        className="font-mono text-sm font-medium text-primary hover:underline"
      >
        {rate.best}
      </button>
      {expanded && (
        <div id="rate-breakdown" className="mt-1 space-y-0.5 text-xs text-muted-foreground font-mono">
          <p>{rate.perMinute}</p>
          <p>{rate.perHour}</p>
          <p>{rate.perDay}</p>
          <p>{rate.perMonth}</p>
          <p>{rate.perYear}</p>
        </div>
      )}
    </div>
  );
}

// ─── Stream detail skeleton ──────────────────────────────────────────────────

function StreamDetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-pulse">
      {/* Back bar */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-4 w-12 rounded bg-muted" />
      </div>
      {/* Header card */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-muted" />
            <div className="space-y-1.5">
              <div className="h-4 w-36 rounded bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
          </div>
          <div className="h-5 w-16 rounded-full bg-muted" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-9 w-48 rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-muted" />
          <div className="flex justify-between">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
        </div>
      </div>
      {/* Details card */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <div className="h-3.5 w-16 rounded bg-muted" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex justify-between py-2 border-b border-border last:border-0"
          >
            <div className="h-3.5 w-20 rounded bg-muted" />
            <div className="h-3.5 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

function ShareButtons({
  stream,
  status,
}: {
  stream: import("@/types/stream").StreamData;
  status: import("@/types/stream").StreamStatus;
}) {
  const streamId = stream.id;
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const streamUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://flowstar.app/app/stream/${streamId}`;
  const shareText = copy.shareButtons.shareText(streamId);

  function copyLink() {
    navigator.clipboard.writeText(streamUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success(copy.shareButtons.linkCopiedToast);
  }

  function shareToTwitter() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(streamUrl)}`;
    window.open(url, "_blank", "width=550,height=420");
  }

  function shareToTelegram() {
    const url = `https://t.me/share/url?url=${encodeURIComponent(streamUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "width=550,height=420");
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowShare(!showShare)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-label={copy.shareButtons.shareAriaLabel}
      >
        <Share2 className="size-4" />
        {copy.shareButtons.shareButton}
      </button>

      {showShare && (
        <div className="absolute right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50">
          <div className="flex flex-col gap-1 p-2 min-w-max">
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
              aria-label={copy.shareButtons.copyLinkAriaLabel}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <LinkIcon className="size-4" />
              )}
              {copied ? copy.shareButtons.copiedLinkButton : copy.shareButtons.copyLinkButton}
            </button>
            <button
              onClick={shareToTwitter}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
              aria-label={copy.shareButtons.twitterAriaLabel}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7" />
              </svg>
              {copy.shareButtons.twitterButton}
            </button>
            <button
              onClick={shareToTelegram}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
              aria-label={copy.shareButtons.telegramAriaLabel}
            >
              <MessageCircle className="size-4" />
              {copy.shareButtons.telegramButton}
            </button>
            <button
              onClick={() => {
                setShowShare(false);
                setShowQr(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
              aria-label={copy.shareButtons.qrAriaLabel}
            >
              <QrCode className="size-4" />
              {copy.shareButtons.qrButton}
            </button>
          </div>
        </div>
      )}

      {/* Issue #153: QR code sharing modal */}
      <QrShareDialog
        open={showQr}
        onOpenChange={setShowQr}
        streamUrl={streamUrl}
        stream={stream}
        status={status}
      />
    </div>
  );
}

function ConnectPrompt() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <Wallet className="size-5 shrink-0 text-muted-foreground" />
      <p className="text-sm text-muted-foreground flex-1">
        {copy.connectPrompt.body}
      </p>
      <ConnectWalletButton />
    </div>
  );
}

function StreamDetail({ id }: { id: string }) {
  const { stream, loading } = useStream(id);
  const { address, isConnected } = useWallet();
  const { network, config } = useNetwork();
  const router = useRouter();
  const now = useNow(1000);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const isCancelling = useIsStreamCancelling(id);

  if (loading) {
    return <StreamDetailSkeleton />;
  }

  if (!stream) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-medium">{copy.notFound.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {copy.notFound.body}
        </p>
        <Button asChild className="mt-6">
          <Link href="/app">{copy.notFound.backButton}</Link>
        </Button>
      </div>
    );
  }

  const status = getStreamStatus(stream, now);
  const progress = getStreamProgress(stream, now);
  const unlocked = getUnlockedAmount(stream, now);
  const withdrawable = getWithdrawableAmount(stream, now);
  const withdrawnFrac =
    stream.depositedAmount > 0n
      ? Number((stream.withdrawnAmount * 10000n) / stream.depositedAmount) /
        10000
      : 0;

  const isRecipient = address === stream.recipient;
  const isSender = address === stream.sender;
  const canWithdraw = isRecipient && !stream.cancelled && withdrawable > 0n;
  const canCancel =
    isSender && !stream.cancelled && status !== "completed" && !isCancelling;

  function handleDuplicate() {
    if (!stream) return;
    const durationSecs = Number(stream.endTime - stream.startTime);
    const cliffSecs = Number(stream.cliffTime - stream.startTime);
    const hasCliff = stream.cliffTime > stream.startTime;
    const params = new URLSearchParams({
      clone: stream.id,
      recipient: stream.recipient,
      token: stream.token.address,
      amount: (
        Number(stream.depositedAmount) / Math.pow(10, stream.token.decimals)
      ).toString(),
      duration: durationSecs.toString(),
    });
    if (hasCliff) {
      params.set("cliff", cliffSecs.toString());
      if (stream.cliffAmount > 0n) {
        params.set(
          "cliffAmount",
          (
            Number(stream.cliffAmount) / Math.pow(10, stream.token.decimals)
          ).toString(),
        );
      }
    }
    router.push(`/app/create?${params.toString()}`);
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
                "flex size-10 items-center justify-center rounded-xl " +
                (isSender
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary/10 text-primary")
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
                {isSender ? copy.header.sending : copy.header.receiving}{" "}
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
              isCompleted={status === "completed"}
              isCliffReached={
                Number(stream.cliffTime) <= now && stream.cliffAmount > 0n
              }
            />
          </div>
        </div>

        {/* Progress */}
        <div>
          <ProgressBar
            value={progress}
            marker={withdrawnFrac}
            indeterminateShimmer={status === "streaming"}
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
              />{" "}
              /{" "}
              <TokenAmount
                amount={stream.depositedAmount}
                token={stream.token}
                maxFractionDigits={2}
              />{" "}
              {copy.header.withdrawnSuffix}
            </span>
          </div>
        </div>

        {/* Countdown */}
        {(status === "streaming" || status === "scheduled") && (
          <div className="flex flex-wrap gap-6 text-sm">
            {status === "scheduled" && (
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
                {status === "scheduled" ? copy.header.durationLabel : copy.header.endsInLabel}
              </p>
              <AccessibleCountdownTimer
                target={stream.endTime}
                className="font-medium"
              />
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
        {(canWithdraw || canCancel || isSender) && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
            {canWithdraw && (
              <Button onClick={() => setWithdrawOpen(true)} className="gap-1.5">
                <ArrowDownLeft className="size-4" />
                {copy.header.withdrawButton}{" "}
                <span className="font-mono">
                  {formatTokenAmount(withdrawable, stream.token.decimals, 2)}{" "}
                  {stream.token.symbol}
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
              <Button
                variant="outline"
                onClick={handleDuplicate}
                className="gap-1.5"
              >
                <Copy className="size-4" />
                {copy.header.duplicateStreamButton}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* TTL warning */}
      {!stream.cancelled && status !== "completed" && (
        <TtlWarning stream={stream} nowSeconds={now} />
      )}

      {/* Unlock chart */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <UnlockChart stream={stream} nowSeconds={now} />
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
          {copy.details.sectionTitle}
        </h2>
        <DetailRow label={copy.details.sender}>
          <CopyableAddress
            address={stream.sender}
            href={explorerUrl(network, "account", stream.sender)}
          />
        </DetailRow>
        <DetailRow label={copy.details.recipient}>
          <CopyableAddress
            address={stream.recipient}
            href={explorerUrl(network, "account", stream.recipient)}
            federationName={getFederationNameForAddress(stream.recipient)}
          />
        </DetailRow>
        <DetailRow label={copy.details.token}>
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{stream.token.symbol}</span>
            <CopyableAddress
              address={stream.token.address}
              href={explorerUrl(network, "contract", stream.token.address)}
            />
          </div>
        </DetailRow>
        {config.streamContractId && (
          <DetailRow label={copy.details.streamContract}>
            <CopyableAddress
              address={config.streamContractId}
              href={explorerUrl(network, "contract", config.streamContractId)}
            />
          </DetailRow>
        )}
        <DetailRow label={copy.details.totalDeposited}>
          <TokenAmount
            amount={stream.depositedAmount}
            token={stream.token}
            maxFractionDigits={4}
          />
        </DetailRow>
        <DetailRow label={copy.details.withdrawn}>
          <TokenAmount
            amount={stream.withdrawnAmount}
            token={stream.token}
            maxFractionDigits={4}
          />
        </DetailRow>
        <DetailRow label={copy.details.withdrawableNow}>
          <span className={withdrawable > 0n ? "text-primary font-medium" : ""}>
            <TokenAmount
              amount={withdrawable}
              token={stream.token}
              maxFractionDigits={4}
            />
          </span>
        </DetailRow>
        <DetailRow label={copy.details.rate}>
          <RateDisplay stream={stream} />
        </DetailRow>
        <DetailRow label={copy.details.start}>
          <span>
            {formatDateTime(stream.startTime)}
            <span className="ml-1.5 text-xs text-muted-foreground">
              (
              {new Date(Number(stream.startTime) * 1000)
                .toUTCString()
                .replace(" GMT", " UTC")}
              )
            </span>
          </span>
        </DetailRow>
        {stream.cliffTime > stream.startTime && (
          <DetailRow label={copy.details.cliff}>
            {formatDateTime(stream.cliffTime)}
            {stream.cliffAmount > 0n && (
              <span className="text-muted-foreground ml-1">
                (+
                <TokenAmount
                  amount={stream.cliffAmount}
                  token={stream.token}
                  maxFractionDigits={2}
                />
                )
              </span>
            )}
          </DetailRow>
        )}
        <DetailRow label={copy.details.end}>
          <span>
            {formatDateTime(stream.endTime)}
            <span className="ml-1.5 text-xs text-muted-foreground">
              (
              {new Date(Number(stream.endTime) * 1000)
                .toUTCString()
                .replace(" GMT", " UTC")}
              )
            </span>
          </span>
        </DetailRow>
        <DetailRow label={copy.details.network}>
          <span className="capitalize">{network}</span>
        </DetailRow>
      </div>

      {/* Transaction history timeline */}
      <StreamTimeline streamId={stream.id} />

      {/* Auto-withdraw (recipients only, active streams) */}
      {isRecipient && !stream.cancelled && status !== "completed" && (
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
  );
}

export default function StreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <StreamDetail id={id} />;
}
