'use client'

/**
 * Shared chart primitives for the analytics page.
 *
 * Fix #367 — `TokenShare` now carries a `decimals` field so that
 * `formatTokenAmount` can use the token's real decimal precision instead of
 * the previously hardcoded value of 7 (XLM's decimals). Any custom token with
 * a different decimal count will now display the correct amount.
 */

import { formatTokenAmount } from '@/lib/stream-utils'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A single token's aggregated volume entry used by the analytics charts.
 *
 * `decimals` is required so that amounts are formatted with the token's own
 * precision rather than a hardcoded fallback.
 */
export interface TokenShare {
  symbol: string
  /** Raw amount in the token's smallest unit (e.g. stroops for XLM). */
  amount: bigint
  count: number
  /** Number of decimal places for this token (e.g. 7 for XLM, 6 for USDC). */
  decimals: number
}

// ─── Formatters ──────────────────────────────────────────────────────────────

/**
 * Format a token amount for compact display in charts (2 decimal places).
 *
 * Uses the token's actual `decimals` value — never a hardcoded constant.
 */
export function formatChartAmount(amount: bigint, decimals: number): string {
  return formatTokenAmount(amount, decimals, 2)
}

// ─── Volume bar ──────────────────────────────────────────────────────────────

interface VolumeBarProps {
  token: TokenShare
  totalVolume: bigint
}

/**
 * A horizontal bar representing one token's share of total streamed volume.
 * The bar width is proportional to the token's share of `totalVolume`.
 */
export function VolumeBar({ token, totalVolume }: VolumeBarProps) {
  const pct =
    totalVolume > 0n
      ? Math.max(8, (Number(token.amount) / Number(totalVolume)) * 100)
      : 8

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{token.symbol}</span>
        {/* Fix #367 — use token.decimals instead of the hardcoded 7 */}
        <span className="font-medium">{formatChartAmount(token.amount, token.decimals)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-secondary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Top token badge ─────────────────────────────────────────────────────────

interface TopTokenRowProps {
  token: TokenShare
}

/**
 * A single row in the "Top tokens by volume" card.
 * Renders the token symbol, stream count, and formatted amount.
 */
export function TopTokenRow({ token }: TopTokenRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <div>
        <p className="font-medium">{token.symbol}</p>
        <p className="text-xs text-muted-foreground">{token.count} streams</p>
      </div>
      <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
        {/* Fix #367 — use token.decimals instead of the hardcoded 7 */}
        {formatChartAmount(token.amount, token.decimals)} {token.symbol}
      </span>
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
  decimals: number
}

/** Minimum bar width in pixels so very small values are still visible */
const MIN_BAR_WIDTH_PX = 8;

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
              ) : (() => {
                const maxCount = Math.max(...series.map(p => p.count))
                return series.map((point) => {
                  const pct = maxCount > 0 ? Math.max(MIN_BAR_WIDTH_PX / 100, point.count / maxCount) * 100 : 0
                  return (
                    <div key={point.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{point.label}</span>
                        <span className="font-medium">{point.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  )
                })
              })()}
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
                <Badge variant="secondary">{formatTokenAmount(token.amount, token.decimals)} {token.symbol}</Badge>
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
                  <span className="font-medium">{formatTokenAmount(token.amount, token.decimals)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-secondary"
                    style={{
                      width: `${Math.max(MIN_BAR_WIDTH_PX, (Number(token.amount) / Math.max(1, Number(totalVolume))) * 100) || 0}%`,
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
