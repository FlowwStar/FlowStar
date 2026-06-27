'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Clock3, TrendingUp, Wallet2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SectionErrorBoundary } from '@/components/error-boundary/section-error-boundary'
import { useStreams } from '@/hooks/use-streams'
import { useNetwork } from '@/components/providers/network-provider'
import { getAllTokens } from '@/lib/stellar'
import type { StreamData } from '@/types/stream'

const AnalyticsCharts = dynamic(
  () => import('@/components/analytics/charts').then((m) => m.AnalyticsCharts),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  },
)

function ChartSkeleton() {
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

interface AnalyticsSnapshot {
  totalVolume: bigint
  activeCount: number
  totalStreams: number
  averageDurationDays: number
  tokenShares: Array<{ symbol: string; amount: bigint; count: number }>
  series: Array<{ label: string; count: number }>
  topTokens: Array<{ symbol: string; amount: bigint; count: number }>
}

const RANGE_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
] as const

function buildSnapshot(streams: StreamData[], range: string): AnalyticsSnapshot {
  const now = Math.floor(Date.now() / 1000)
  const cutoff = range === 'all' ? 0 : Date.now() - Number.parseInt(range.replace('d', ''), 10) * 24 * 60 * 60 * 1000
  const filtered = streams.filter((stream) => Number(stream.startTime) * 1000 >= cutoff || range === 'all')

  const totalVolume = filtered.reduce((sum, stream) => sum + stream.depositedAmount, 0n)
  const activeCount = filtered.filter((stream) => !stream.cancelled && Number(stream.endTime) > now).length
  const totalStreams = filtered.length
  const averageDurationDays = filtered.length > 0
    ? filtered.reduce((sum, stream) => sum + Number(stream.endTime - stream.startTime) / 86400, 0) / filtered.length
    : 0

  const tokenGroups = new Map<string, { amount: bigint; count: number; decimals: number }>()
  filtered.forEach((stream) => {
    const key = stream.token.symbol
    const entry = tokenGroups.get(key) ?? { amount: 0n, count: 0, decimals: stream.token.decimals }
    entry.amount += stream.depositedAmount
    entry.count += 1
    tokenGroups.set(key, entry)
  })

  const tokenShares = Array.from(tokenGroups.entries()).map(([symbol, entry]) => ({
    symbol,
    amount: entry.amount,
    count: entry.count,
  }))

  const seriesMap = new Map<string, number>()
  filtered.forEach((stream) => {
    const day = new Date(Number(stream.startTime) * 1000).toISOString().slice(0, 10)
    seriesMap.set(day, (seriesMap.get(day) ?? 0) + 1)
  })

  const series = Array.from(seriesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({ label, count }))

  const topTokens = [...tokenShares].sort((a, b) => Number(b.amount - a.amount)).slice(0, 4)

  return {
    totalVolume,
    activeCount,
    totalStreams,
    averageDurationDays,
    tokenShares,
    series,
    topTokens,
  }
}

export default function AnalyticsPage() {
  const { all } = useStreams({ enablePolling: false })
  const { network } = useNetwork()
  const [range, setRange] = useState('30d')
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const snapshot = useMemo(() => buildSnapshot(all, range), [all, range])

  const tokens = useMemo(() => getAllTokens(network), [network])

  if (!mounted) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Platform analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Public signals that highlight traction, usage, and stream growth.</p>
        </div>
        <div className="w-full max-w-[180px]">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total volume streamed</CardDescription>
            <CardTitle className="text-2xl font-semibold">{snapshot.totalVolume > 0n ? formatCompactAmount(snapshot.totalVolume, 7) : '0'}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet2 className="size-4" /> Across the visible stream history
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active streams</CardDescription>
            <CardTitle className="text-2xl font-semibold">{snapshot.activeCount}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="size-4" /> Currently streaming now
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total streams created</CardDescription>
            <CardTitle className="text-2xl font-semibold">{snapshot.totalStreams}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="size-4" /> All-time stream count
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average duration</CardDescription>
            <CardTitle className="text-2xl font-semibold">{snapshot.averageDurationDays.toFixed(1)}d</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="size-4" /> Average stream length
          </CardContent>
        </Card>
      </div>

      <SectionErrorBoundary sectionName="Analytics charts">
        <AnalyticsCharts
          series={snapshot.series}
          topTokens={snapshot.topTokens}
          tokenShares={snapshot.tokenShares}
          totalVolume={snapshot.totalVolume}
        />
      </SectionErrorBoundary>

      <Card>
        <CardHeader>
          <CardTitle>Network context</CardTitle>
          <CardDescription>Current public view and available tokens.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">This dashboard is built from the current app data and will be backed by on-chain aggregation once a public index is available.</p>
          <div className="flex flex-wrap gap-2">
            {tokens.map((token) => (
              <Badge key={token.address} variant="outline">{token.symbol}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
