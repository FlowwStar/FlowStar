'use client'

import { AlertTriangle, TrendingUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface FeeBreakdown {
  networkFee: number
  cpuFee: number
  memoryFee: number
  storageFee: number
  totalEstimated: number
  estimatedUsd?: number
  minFee: number
}

const FEE_WARNING_MULTIPLIER = 2.0

interface FeeEstimateDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  fees: FeeBreakdown
  action: string
  averageFee?: number
  isHighFee?: boolean
  loading?: boolean
}

export function FeeEstimateDialog({
  open,
  onConfirm,
  onCancel,
  fees,
  action,
  averageFee,
  isHighFee = false,
  loading = false,
}: FeeEstimateDialogProps) {
  const xlmAmount = (fees.totalEstimated / 1e7).toFixed(7)
  const avgXlmAmount = averageFee ? (averageFee / 1e7).toFixed(7) : null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm transaction</DialogTitle>
          <DialogDescription>
            Review the estimated fees before confirming {action}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* High Fee Warning */}
          {isHighFee && avgXlmAmount && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  High fee detected
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400/80">
                  This fee is ~{(fees.totalEstimated / (averageFee || 1)).toFixed(1)}x higher than average ({avgXlmAmount} XLM)
                </p>
              </div>
            </div>
          )}

          {/* Fee Summary Card */}
          <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Total estimated fee
              </p>
              <p className="font-mono text-2xl font-bold">
                {xlmAmount}
                <span className="ml-2 text-lg text-muted-foreground">XLM</span>
              </p>
              {fees.estimatedUsd && (
                <p className="text-xs text-muted-foreground">
                  ≈ ${fees.estimatedUsd.toFixed(4)}
                </p>
              )}
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Fee breakdown
            </p>
            <div className="space-y-2 rounded-lg border border-border p-3">
              <FeeRow
                label="Network fee"
                amount={fees.networkFee}
                percentage={(fees.networkFee / fees.totalEstimated) * 100}
              />
              {fees.cpuFee > 0 && (
                <FeeRow
                  label="CPU resources"
                  amount={fees.cpuFee}
                  percentage={(fees.cpuFee / fees.totalEstimated) * 100}
                />
              )}
              {fees.memoryFee > 0 && (
                <FeeRow
                  label="Memory resources"
                  amount={fees.memoryFee}
                  percentage={(fees.memoryFee / fees.totalEstimated) * 100}
                />
              )}
              {fees.storageFee > 0 && (
                <FeeRow
                  label="Storage resources"
                  amount={fees.storageFee}
                  percentage={(fees.storageFee / fees.totalEstimated) * 100}
                />
              )}
            </div>
          </div>

          {/* Info */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 space-y-2">
            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
              ℹ️ About these fees
            </p>
            <ul className="text-xs text-blue-600 dark:text-blue-400/80 space-y-1">
              <li>• Network fee is required for all transactions</li>
              <li>• Resource fees depend on contract complexity</li>
              <li>• Actual fee may vary based on network conditions</li>
              <li>• Fees are estimated from transaction simulation</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={isHighFee ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : ''}
          >
            {loading ? 'Confirming…' : 'Confirm & pay'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface FeeRowProps {
  label: string
  amount: number
  percentage: number
}

function FeeRow({ label, amount, percentage }: FeeRowProps) {
  const xlm = (amount / 1e7).toFixed(7)
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{label}</span>
        <div className="h-1 bg-primary/20 rounded flex-1 min-w-12 max-w-20">
          <div
            className="h-full bg-primary rounded"
            style={{ width: `${Math.max(2, Math.min(100, percentage))}%` }}
          />
        </div>
        <span className="text-muted-foreground w-8 text-right">{percentage.toFixed(0)}%</span>
      </div>
      <span className="font-mono text-foreground ml-2">{xlm} XLM</span>
    </div>
  )
}
