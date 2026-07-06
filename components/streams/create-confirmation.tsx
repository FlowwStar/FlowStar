'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import { formatDateTime, formatTokenAmount, formatRate, shortenAddress } from '@/lib/stream-utils'
import { calculateFeeBreakdown, TYPICAL_FEES } from '@/lib/fee-utils'
import type { TokenInfo } from '@/types/stream'

interface ConfirmationProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  pending: boolean
  feeEstimate?: string | null
  recipient: string
  token: TokenInfo
  totalAmount: bigint
  startTime: bigint
  endTime: bigint
  cliffTime: bigint
  cliffAmount: bigint
  amountPerSecond: bigint
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right font-medium">{value}</span>
    </div>
  )
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
  const rate = formatRate(amountPerSecond, token.decimals, token.symbol)

  // Calculate fee breakdown if estimate is available
  const estimatedFeeStroops = feeEstimate ? Math.ceil(parseFloat(feeEstimate) * 1e7) : TYPICAL_FEES.createStream.typical
  const feeBreakdown = calculateFeeBreakdown(estimatedFeeStroops)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onCancel()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm stream creation</DialogTitle>
          <DialogDescription>
            Review the details below. You&apos;ll sign two transactions: one token approval, then stream creation.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Stream details</h3>
            <Row label="Recipient" value={<span className="font-mono">{shortenAddress(recipient, 8)}</span>} />
            <Row label="Token" value={token.symbol} />
            <Row
              label="Total amount"
              value={`${formatTokenAmount(totalAmount, token.decimals, 4)} ${token.symbol}`}
            />
            <Row label="Rate" value={rate.perDay} />
            <Row label="Start" value={formatDateTime(startTime)} />
            <Row label="End" value={formatDateTime(endTime)} />
            {cliffTime > startTime && (
              <Row
                label="Cliff"
                value={
                  <>
                    {formatDateTime(cliffTime)}
                    {cliffAmount > 0n && (
                      <span className="text-muted-foreground ml-1">
                        (+{formatTokenAmount(cliffAmount, token.decimals, 4)} {token.symbol})
                      </span>
                    )}
                  </>
                }
              />
            )}
          </div>

          {/* Fee breakdown section */}
          <div className="border-t border-border pt-3 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Network fees</h3>
            <div className="space-y-2">
              <Row
                label="Network fee"
                value={<span className="font-mono">{(feeBreakdown.networkFee / 1e7).toFixed(7)} XLM</span>}
              />
              {feeBreakdown.cpuFee > 0 && (
                <Row
                  label="CPU resources"
                  value={<span className="font-mono">{(feeBreakdown.cpuFee / 1e7).toFixed(7)} XLM</span>}
                />
              )}
              {feeBreakdown.memoryFee > 0 && (
                <Row
                  label="Memory resources"
                  value={<span className="font-mono">{(feeBreakdown.memoryFee / 1e7).toFixed(7)} XLM</span>}
                />
              )}
              {feeBreakdown.storageFee > 0 && (
                <Row
                  label="Storage resources"
                  value={<span className="font-mono">{(feeBreakdown.storageFee / 1e7).toFixed(7)} XLM</span>}
                />
              )}
              <div className="flex items-start justify-between gap-4 py-2 border-t border-border bg-secondary/30 px-3 py-2 rounded">
                <span className="text-sm font-medium text-foreground">Total estimated</span>
                <span className="text-sm font-mono font-bold text-primary">
                  {(feeBreakdown.totalEstimated / 1e7).toFixed(7)} XLM
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 p-2.5">
              <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                Fees are estimated from transaction simulation. Actual costs may vary based on network conditions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Back
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? 'Creating…' : 'Confirm & sign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
