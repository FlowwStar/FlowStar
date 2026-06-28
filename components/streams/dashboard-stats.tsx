'use client'

import { useNow } from '@/hooks/use-now'
import { getStreamStatus, getWithdrawableAmount } from '@/lib/stream-utils'
import { TokenAmount } from '@/components/ui/token-amount'
import type { StreamData } from '@/types/stream'

interface DashboardStatsProps {
  sent: StreamData[]
  received: StreamData[]
}

/**
 * Aggregates per-token totals. Only ticks every second when there are
 * active (streaming) streams; otherwise uses a 60s interval to avoid
 * unnecessary re-renders on dashboards with only static streams.
 */
export function DashboardStats({ sent, received }: DashboardStatsProps) {
  const hasActiveStreams =
    sent.some((s) => !s.cancelled && Math.floor(Date.now() / 1000) < Number(s.endTime) && Math.floor(Date.now() / 1000) >= Number(s.startTime)) ||
    received.some((s) => !s.cancelled && Math.floor(Date.now() / 1000) < Number(s.endTime) && Math.floor(Date.now() / 1000) >= Number(s.startTime))

  const now = useNow(hasActiveStreams ? 1000 : 60000)

  const activeReceiving = received.filter(
    (s) => getStreamStatus(s, now) === 'streaming',
  ).length
  const activeSending = sent.filter(
    (s) => getStreamStatus(s, now) === 'streaming',
  ).length

  const withdrawableByToken = new Map<
    string,
    { amount: bigint; token: StreamData['token'] }
  >()
  for (const s of received) {
    const amt = getWithdrawableAmount(s, now)
    const existing = withdrawableByToken.get(s.token.symbol)
    if (existing) existing.amount += amt
    else withdrawableByToken.set(s.token.symbol, { amount: amt, token: s.token })
  }
  const topWithdrawable = [...withdrawableByToken.values()].sort((a, b) =>
    a.amount > b.amount ? -1 : 1,
  )[0]

  const stats = [
    {
      label: 'Available to withdraw',
      value: topWithdrawable ? (
        <TokenAmount
          amount={topWithdrawable.amount}
          token={topWithdrawable.token}
          maxFractionDigits={2}
        />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
      hint:
        withdrawableByToken.size > 1
          ? `+${withdrawableByToken.size - 1} more token${withdrawableByToken.size > 2 ? 's' : ''}`
          : 'across received streams',
    },
    {
      label: 'Receiving',
      value: <span>{received.length}</span>,
      hint: `${activeReceiving} streaming now`,
    },
    {
      label: 'Sending',
      value: <span>{sent.length}</span>,
      hint: `${activeSending} streaming now`,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
            {stat.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse">
          <div className="h-3.5 w-32 rounded bg-muted" />
          <div className="mt-2 h-8 w-24 rounded bg-muted" />
          <div className="mt-1 h-3 w-28 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
