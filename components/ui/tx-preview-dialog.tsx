'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2, Cpu, MemoryStick, Coins } from 'lucide-react'
import { simulateCreateStreamPreview, type SimulationPreview } from '@/lib/contract'
import type { CreateStreamInput } from '@/types/stream'
import type { NetworkName } from '@/lib/stellar'

interface Props {
  open: boolean
  input: CreateStreamInput | null
  network: NetworkName
  sender: string
  operationLabel?: string
  onConfirm: () => void
  onCancel: () => void
  pending: boolean
}

function ResourceRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  )
}

export function TxPreviewDialog({
  open,
  input,
  network,
  sender,
  operationLabel = 'Create Stream',
  onConfirm,
  onCancel,
  pending,
}: Props) {
  const [preview, setPreview] = useState<SimulationPreview | null>(null)
  const [simulating, setSimulating] = useState(false)

  useEffect(() => {
    if (!open || !input || !sender) return
    setPreview(null)
    setSimulating(true)
    simulateCreateStreamPreview(network, input, sender)
      .then(setPreview)
      .finally(() => setSimulating(false))
  }, [open, input, network, sender])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && !simulating && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transaction Preview</DialogTitle>
          <DialogDescription>
            Review the simulation results before signing with your wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          {/* Operation label */}
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Operation</p>
            <p className="mt-0.5 font-medium">{operationLabel}</p>
          </div>

          {/* Simulation result */}
          {simulating && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">Simulating transaction…</span>
            </div>
          )}

          {preview && (
            <>
              {/* Success/failure */}
              <div className={`flex items-center gap-3 rounded-lg border p-3 ${
                preview.success
                  ? 'border-green-500/30 bg-green-500/10'
                  : 'border-destructive/30 bg-destructive/10'
              }`}>
                {preview.success ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                )}
                <div>
                  <p className={`text-sm font-medium ${preview.success ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
                    Simulation {preview.success ? 'succeeded' : 'failed'}
                  </p>
                  {preview.errorMessage && (
                    <p className="mt-0.5 text-xs text-destructive/80 line-clamp-3">{preview.errorMessage}</p>
                  )}
                </div>
              </div>

              {/* Fee + Resources */}
              {preview.success && (
                <div className="divide-y divide-border rounded-lg border border-border">
                  <div className="px-4 py-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated cost</p>
                    <ResourceRow
                      icon={<Coins className="h-4 w-4" />}
                      label="Network fee"
                      value={`${preview.estimatedFeeXlm} XLM (${preview.estimatedFeeUsd})`}
                    />
                  </div>
                  <div className="px-4 py-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Resource usage</p>
                    <ResourceRow
                      icon={<Cpu className="h-4 w-4" />}
                      label="CPU instructions"
                      value={preview.cpuInstructions.toLocaleString()}
                    />
                    <ResourceRow
                      icon={<MemoryStick className="h-4 w-4" />}
                      label="Memory"
                      value={`${preview.memoryBytes.toLocaleString()} bytes`}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onCancel} disabled={pending || simulating}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending || simulating || preview?.success === false}
          >
            {pending ? 'Signing…' : simulating ? 'Simulating…' : 'Confirm & Sign →'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
