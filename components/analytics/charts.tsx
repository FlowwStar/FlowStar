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
    </div>
  )
}
