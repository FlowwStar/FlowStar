'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatTokenAmount } from '@/lib/stream-utils'

interface SeriesPoint {
  label: string
  count: number
}

interface TokenShare {
  symbol: string
  amount: bigint
  count: number
}

interface Props {
  series: SeriesPoint[]
  topTokens: TokenShare[]
  tokenShares: TokenShare[]
  totalVolume: bigint
}

export function AnalyticsCharts({ series, topTokens, tokenShares, totalVolume }: Props) {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Streams created over time</CardTitle>
            <CardDescription>Daily stream creation activity for the selected window.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {series.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stream activity yet for this period.</p>
              ) : series.map((point) => (
                <div key={point.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{point.label}</span>
                    <span className="font-medium">{point.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, point.count * 20)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top tokens by volume</CardTitle>
            <CardDescription>Most-used tokens across created streams.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topTokens.length === 0 ? (
              <p className="text-sm text-muted-foreground">No volume data yet.</p>
            ) : topTokens.map((token) => (
              <div key={token.symbol} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="font-medium">{token.symbol}</p>
                  <p className="text-xs text-muted-foreground">{token.count} streams</p>
                </div>
                <Badge variant="secondary">{formatTokenAmount(token.amount, 7)} {token.symbol}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Token distribution</CardTitle>
            <CardDescription>Visible token mix across the current dataset.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tokenShares.length === 0 ? (
              <p className="text-sm text-muted-foreground">No token distribution data available yet.</p>
            ) : tokenShares.map((token) => (
              <div key={token.symbol} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{token.symbol}</span>
                  <span className="font-medium">{formatTokenAmount(token.amount, 7)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-secondary"
                    style={{
                      width: `${Math.max(8, (Number(token.amount) / Math.max(1, Number(totalVolume))) * 100) || 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export function ChartSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card/50" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card/50" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card/50" />
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card/50" />
      </div>
    </div>
  )
}
