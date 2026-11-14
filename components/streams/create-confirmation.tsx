"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import {
  formatDateTime,
  formatTokenAmount,
  formatRate,
  shortenAddress,
} from "@/lib/stream-utils";
import { calculateFeeBreakdown, TYPICAL_FEES } from "@/lib/fee-utils";
import { useTokenPrice } from "@/hooks/use-token-price";
import { createConfirmationCopy } from "@/lib/copy/create-form";
import type { TokenInfo } from "@/types/stream";

const copy = createConfirmationCopy;

interface ConfirmationProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
  feeEstimate?: string | null;
  recipient: string;
  token: TokenInfo;
  totalAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  cliffTime: bigint;
  cliffAmount: bigint;
  amountPerSecond: bigint;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right font-medium">{value}</span>
    </div>
  );
}

export function CreateConfirmation({
  open,
  onConfirm,
  onCancel,
  pending,
  feeEstimate,
  recipient,
  token,
  totalAmount,
  startTime,
  endTime,
  cliffTime,
  cliffAmount,
  amountPerSecond,
}: ConfirmationProps) {
  const rate = formatRate(amountPerSecond, token.decimals, token.symbol);

  // Fetch live XLM/USD price for fee USD estimate
  const { usdPrice: xlmPrice } = useTokenPrice("XLM");

  // Calculate fee breakdown if estimate is available
  const estimatedFeeStroops = feeEstimate
    ? Math.ceil(parseFloat(feeEstimate) * 1e7)
    : TYPICAL_FEES.createStream.typical;
  const feeBreakdown = calculateFeeBreakdown(
    estimatedFeeStroops,
    xlmPrice ?? undefined,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onCancel()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{copy.dialogTitle}</DialogTitle>
          <DialogDescription>{copy.dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              {copy.streamDetailsSectionTitle}
            </h3>
            <Row
              label={copy.recipientLabel}
              value={
                <span className="font-mono">
                  {shortenAddress(recipient, 8)}
                </span>
              }
            />
            <Row label={copy.tokenLabel} value={token.symbol} />
            <Row
              label={copy.totalAmountLabel}
              value={`${formatTokenAmount(totalAmount, token.decimals, 4)} ${token.symbol}`}
            />
            <Row label={copy.rateLabel} value={rate.perDay} />
            <Row label={copy.startLabel} value={formatDateTime(startTime)} />
            <Row label={copy.endLabel} value={formatDateTime(endTime)} />
            {cliffTime > startTime && (
              <Row
                label={copy.cliffLabel}
                value={
                  <>
                    {formatDateTime(cliffTime)}
                    {cliffAmount > 0n && (
                      <span className="text-muted-foreground ml-1">
                        (+{formatTokenAmount(cliffAmount, token.decimals, 4)}{" "}
                        {token.symbol})
                      </span>
                    )}
                  </>
                }
              />
            )}
          </div>

          {/* Fee breakdown section */}
          <div className="border-t border-border pt-3 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {copy.networkFeesSectionTitle}
            </h3>
            <div className="space-y-2">
              <Row
                label={copy.baseFeeEstimateLabel}
                value={
                  <span className="font-mono">
                    {(feeBreakdown.minFee / 1e7).toFixed(7)} XLM
                  </span>
                }
              />
              {feeBreakdown.bufferFee > 0 && (
                <Row
                  label={copy.safetyBufferLabel}
                  value={
                    <span className="font-mono">
                      {(feeBreakdown.bufferFee / 1e7).toFixed(7)} XLM
                    </span>
                  }
                />
              )}
              <div className="flex items-start justify-between gap-4 border-t border-border bg-secondary/30 px-3 py-2 rounded">
                <span className="text-sm font-medium text-foreground">
                  {copy.totalEstimatedLabel}
                </span>
                <span className="text-sm font-mono font-bold text-primary">
                  {(feeBreakdown.totalEstimated / 1e7).toFixed(7)} XLM
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 p-2.5">
              <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                {copy.feeDisclaimerText}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            {copy.backButton}
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? copy.pendingButton : copy.confirmButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
