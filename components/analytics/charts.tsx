'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatTokenAmount, shortenAddress } from '@/lib/stream-utils'
import { analyticsCopy } from '@/lib/copy/analytics'
import type { StreamStatus } from '@/types/stream'

const copy = analyticsCopy.charts

interface SeriesPoint {
  label: string
  count: number
  volume: number
}

interface TokenShare {
  symbol: string
  amount: bigint
  count: number
  decimals: number
}

interface RecipientSummary {
  address: string
  federationName: string | null
  count: number
  totals: Array<{ symbol: string; amount: bigint; decimals: number }>
}

/** Minimum visible width (%) for progress/share bars so small values don't disappear */
const MIN_BAR_WIDTH_PCT = 1.5

// Shared chart color tokens (defined once in globals.css, so they already
// render correctly in both light and dark themes).
const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

const STATUS_LABEL: Record<StreamStatus, string> = copy.statusLabels

const STATUS_COLOR: Record<StreamStatus, string> = {
  streaming: 'var(--color-chart-1)',
  scheduled: 'var(--color-chart-3)',
  completed: 'var(--color-chart-5)',
  cancelled: 'var(--color-chart-4)',
}

interface Props {
  series: SeriesPoint[]
  topTokens: TokenShare[]
  tokenShares: TokenShare[]
  totalVolume: bigint
  statusBreakdown: Array<{ status: StreamStatus; count: number }>
  topRecipients: RecipientSummary[]
  unlockProgress: { unlocked: bigint; deposited: bigint }
}

/** Tooltip content shared by the recharts-based charts, styled to match the app's cards. */
function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
  label?: string
  formatter?: (name: string, value: number | string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: entry.color }}
          />
          {formatter && entry.name !== undefined && entry.value !== undefined
            ? formatter(entry.name, entry.value)
            : `${entry.name}: ${entry.value}`}
        </p>
      ))}
    </div>
  )
}

export function AnalyticsCharts({
  series,
  topTokens,
  tokenShares,
  totalVolume,
  statusBreakdown,
  topRecipients,
  unlockProgress,
}: Props) {
  const hasStatusData = statusBreakdown.some((s) => s.count > 0)
  const unlockPct =
    unlockProgress.deposited > 0n
      ? Number((unlockProgress.unlocked * 10000n) / unlockProgress.deposited) / 100
      : 0

  return (
    <>
      {/* Streaming volume over time — interactive area chart */}
      <Card>
        <CardHeader>
          <CardTitle>{copy.volume.title}</CardTitle>
          <CardDescription>{copy.volume.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.volume.empty}</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(name, value) =>
                        name === 'volume'
                          ? copy.volume.tooltip(Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 }))
                          : `${name}: ${value}`
                      }
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  name="volume"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill="url(#volumeFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Token distribution — donut chart */}
        <Card>
          <CardHeader>
            <CardTitle>{copy.tokenDistribution.title}</CardTitle>
            <CardDescription>{copy.tokenDistribution.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {tokenShares.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.tokenDistribution.empty}</p>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={200} className="max-w-[200px]">
                  <PieChart>
                    <Pie
                      data={tokenShares}
                      dataKey={(d: TokenShare) => Number(d.amount)}
                      nameKey="symbol"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={2}
                      stroke="var(--color-card)"
                    >
                      {tokenShares.map((entry, i) => (
                        <Cell key={entry.symbol} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={
                        <ChartTooltip
                          formatter={(name, value) => {
                            const share = tokenShares.find((t) => t.symbol === name)
                            return share
                              ? `${name}: ${formatTokenAmount(share.amount, share.decimals)}`
                              : `${name}: ${value}`
                          }}
                        />
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2">
                  {tokenShares.map((token, i) => (
                    <div key={token.symbol} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        {token.symbol}
                      </span>
                      <span className="font-medium">
                        {formatTokenAmount(token.amount, token.decimals)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stream status breakdown — bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>{copy.statusBreakdown.title}</CardTitle>
            <CardDescription>{copy.statusBreakdown.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasStatusData ? (
              <p className="text-sm text-muted-foreground">{copy.statusBreakdown.empty}</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={statusBreakdown.map((s) => ({ ...s, name: STATUS_LABEL[s.status] }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip formatter={(name, value) => `${name}: ${value}`} />} />
                  <Bar dataKey="count" name={copy.statusBreakdown.seriesName} radius={[6, 6, 0, 0]}>
                    {statusBreakdown.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLOR[entry.status]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Top recipients */}
        <Card>
          <CardHeader>
            <CardTitle>{copy.topRecipients.title}</CardTitle>
            <CardDescription>{copy.topRecipients.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topRecipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.topRecipients.empty}</p>
            ) : (
              topRecipients.map((recipient) => (
                <div
                  key={recipient.address}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p
                      className="truncate font-mono text-sm"
                      title={recipient.federationName ? recipient.address : undefined}
                    >
                      {recipient.federationName ?? shortenAddress(recipient.address, 5)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {copy.topRecipients.streamCount(recipient.count)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {recipient.totals.map((t) => (
                      <Badge key={t.symbol} variant="secondary">
                        {formatTokenAmount(t.amount, t.decimals, 2)} {t.symbol}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top tokens by volume (kept from the original list view) */}
        <Card>
          <CardHeader>
            <CardTitle>{copy.topTokens.title}</CardTitle>
            <CardDescription>{copy.topTokens.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topTokens.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.topTokens.empty}</p>
            ) : (
              topTokens.map((token) => (
                <div
                  key={token.symbol}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{token.symbol}</p>
                    <p className="text-xs text-muted-foreground">{copy.topTokens.streamCount(token.count)}</p>
                  </div>
                  <Badge variant="secondary">
                    {formatTokenAmount(token.amount, token.decimals)} {token.symbol}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unlock progress — aggregate progress bar */}
      <Card>
        <CardHeader>
          <CardTitle>{copy.unlockProgress.title}</CardTitle>
          <CardDescription>{copy.unlockProgress.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {unlockProgress.deposited === 0n ? (
            <p className="text-sm text-muted-foreground">{copy.unlockProgress.empty}</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{copy.unlockProgress.unlocked}</span>
                <span className="font-medium">{unlockPct.toFixed(1)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-3 rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.max(unlockPct > 0 ? MIN_BAR_WIDTH_PCT : 0, unlockPct)}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

export function ChartSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-64 animate-pulse rounded-xl border border-border bg-card/50" />
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="h-56 animate-pulse rounded-xl border border-border bg-card/50" />
        <div className="h-56 animate-pulse rounded-xl border border-border bg-card/50" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card/50" />
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card/50" />
      </div>
      <div className="h-24 animate-pulse rounded-xl border border-border bg-card/50" />
    </div>
  )
}
