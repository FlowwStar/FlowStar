'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNow } from '@/hooks/use-now'
import {
  getUnlockedAmount,
  getStreamProgress,
  formatTokenAmount,
} from '@/lib/stream-utils'
import { ProgressBar } from '@/components/ui/progress-bar'
import type { StreamData } from '@/types/stream'

const NOW = Math.floor(Date.now() / 1000)

const STREAM_DURATION = 30 * 24 * 60 * 60

function buildDemoStream(now: number): StreamData {
  const start = now - 9 * 24 * 60 * 60
  return {
    id: 'demo',
    sender: 'GACME...PAYROLL',
    recipient: 'GD7HQ...ALICE',
    token: {
      address: 'demo',
      symbol: 'USDC',
      decimals: 7,
    },
    depositedAmount: 120_000n * 10n ** 7n,
    withdrawnAmount: 0n,
    startTime: BigInt(start),
    endTime: BigInt(start + STREAM_DURATION),
    cliffTime: BigInt(start),
    cliffAmount: 0n,
    amountPerSecond: (120_000n * 10n ** 7n) / BigInt(STREAM_DURATION),
    cancelled: false,
  }
}

export function LiveStreamPreview() {
  const now = useNow(1000)
  const [demoStream] = useState(() => buildDemoStream(NOW))
  const unlocked = getUnlockedAmount(demoStream, now)
  const progress = getStreamProgress(demoStream, now)

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/40 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          Streaming live
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          per second
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
            AC
          </span>
          <span className="font-mono text-muted-foreground">Acme Inc.</span>
        </div>
        <ArrowRight className="size-4 shrink-0 text-primary" />
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground">Alice</span>
          <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
            AL
          </span>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Unlocked so far
        </p>
        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
          {formatTokenAmount(unlocked, demoStream.token.decimals, 4)}
          <span className="ml-2 text-base text-muted-foreground">USDC</span>
        </p>
      </div>

      <div className="mt-5">
        <ProgressBar value={progress} indeterminateShimmer />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{(progress * 100).toFixed(2)}% unlocked</span>
          <span className="font-mono">
            {formatTokenAmount(demoStream.depositedAmount, 7, 0)} USDC total
          </span>
        </div>
      </div>
    </div>
  )
}
