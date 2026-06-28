'use client'

import Link from 'next/link'
import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, ArrowDownToLine, Search, X } from 'lucide-react'
import { RequireWallet } from '@/components/layout/require-wallet'
import { DashboardStats } from '@/components/streams/dashboard-stats'
import { StreamCard } from '@/components/streams/stream-card'
import { EmptyStreams } from '@/components/streams/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useStreams } from '@/hooks/use-streams'
import { useContract } from '@/hooks/use-contract'
import { useNow } from '@/hooks/use-now'
import { getWithdrawableAmount, getStreamStatus, getStreamProgress } from '@/lib/stream-utils'
import type { StreamData, StreamStatus } from '@/types/stream'

// ─── Filter / sort types ──────────────────────────────────────────────────────

type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | 'end_asc' | 'progress_desc'

const STATUS_OPTIONS: { value: StreamStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Highest amount' },
  { value: 'amount_asc', label: 'Lowest amount' },
  { value: 'end_asc', label: 'Ending soonest' },
  { value: 'progress_desc', label: 'Most progress' },
]

// ─── Hook: URL-synced filters ─────────────────────────────────────────────────

function useFilters() {
  const router = useRouter()
  const params = useSearchParams()

  const search = params.get('q') ?? ''
  const status = (params.get('status') ?? 'all') as StreamStatus | 'all'
  const token = params.get('token') ?? 'all'
  const sort = (params.get('sort') ?? 'newest') as SortKey

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value === '' || value === 'all' || value === 'newest') {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  function clear() {
    router.replace('?', { scroll: false })
  }

  const isActive = search !== '' || status !== 'all' || token !== 'all' || sort !== 'newest'

  return { search, status, token, sort, update, clear, isActive }
}

// ─── Filter + sort logic ──────────────────────────────────────────────────────

function applyFilters(
  streams: StreamData[],
  search: string,
  status: StreamStatus | 'all',
  token: string,
  sort: SortKey,
  nowSeconds: number,
): StreamData[] {
  let result = streams

  if (search) {
    const q = search.toLowerCase()
    result = result.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.sender.toLowerCase().includes(q) ||
        s.recipient.toLowerCase().includes(q) ||
        s.token.symbol.toLowerCase().includes(q),
    )
  }

  if (status !== 'all') {
    result = result.filter((s) => getStreamStatus(s, nowSeconds) === status)
  }

  if (token !== 'all') {
    result = result.filter((s) => s.token.symbol === token)
  }

  result = [...result].sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return Number(a.startTime - b.startTime)
      case 'amount_desc':
        return Number(b.depositedAmount - a.depositedAmount)
      case 'amount_asc':
        return Number(a.depositedAmount - b.depositedAmount)
      case 'end_asc':
        return Number(a.endTime - b.endTime)
      case 'progress_desc':
        return getStreamProgress(b, nowSeconds) - getStreamProgress(a, nowSeconds)
      case 'newest':
      default:
        return Number(b.startTime - a.startTime)
    }
  })

  return result
}

// ─── StreamGrid ───────────────────────────────────────────────────────────────

function StreamGrid({ streams }: { streams: StreamData[] }) {
  if (streams.length === 0) return <EmptyStreams />
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {streams.map((s) => (
        <StreamCard key={s.id} stream={s} />
      ))}
    </div>
  )
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

function FilterBar({
  tokens,
  filters,
}: {
  tokens: string[]
  filters: ReturnType<typeof useFilters>
}) {
  const { search, status, token, sort, update, clear, isActive } = filters

  return (
    <div className="space-y-2">
      {/* Search + sort row */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ID, address, or token…"
            value={search}
            onChange={(e) => update('q', e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => update('q', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Select value={sort} onValueChange={(v) => update('sort', v)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter chips row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={(v) => update('status', v)}>
          <SelectTrigger className="h-8 w-auto gap-1 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tokens.length > 0 && (
          <Select value={token} onValueChange={(v) => update('token', v)}>
            <SelectTrigger className="h-8 w-auto gap-1 text-xs">
              <SelectValue placeholder="Token" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tokens</SelectItem>
              {tokens.map((sym) => (
                <SelectItem key={sym} value={sym}>
                  {sym}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {isActive && (
          <Badge
            variant="secondary"
            className="cursor-pointer gap-1 text-xs"
            onClick={clear}
          >
            <X className="size-3" />
            Clear filters
          </Badge>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
import { SectionErrorBoundary } from '@/components/error-boundary/section-error-boundary'
import { ComponentErrorBoundary } from '@/components/error-boundary/component-error-boundary'
import { useStreams } from '@/hooks/use-streams'
import { useContract } from '@/hooks/use-contract'
import { useNow } from '@/hooks/use-now'
import { useWallet } from '@/hooks/use-wallet'
import { getWithdrawableAmount } from '@/lib/stream-utils'
import { ActivityFeed } from '@/components/streams/activity-feed'

function Dashboard() {
  const { sent, received, all, loading } = useStreams()
  const { withdrawAll, pending } = useContract()
  const now = useNow(1000)
  const filters = useFilters()
  const { address: walletAddress } = useWallet()
  const [withdrawProgress, setWithdrawProgress] = useState<{ current: number; total: number } | null>(null)

  const withdrawableStreams = received.filter((s) => getWithdrawableAmount(s, now) > 0n)
  const isWithdrawingAll = withdrawProgress !== null

  const handleWithdrawAll = async () => {
    setWithdrawProgress({ current: 0, total: withdrawableStreams.length })
    try {
      await withdrawAll(received, (current, total) => {
        setWithdrawProgress({ current, total })
      })
    } finally {
      setWithdrawProgress(null)
    }
  }

  // Derive unique token symbols for the filter dropdown
  const tokenSymbols = useMemo(
    () => [...new Set(all.map((s) => s.token.symbol))].sort(),
    [all],
  )

  const filteredAll = useMemo(
    () => applyFilters(all, filters.search, filters.status, filters.token, filters.sort, now),
    [all, filters.search, filters.status, filters.token, filters.sort, now],
  )
  const filteredReceived = useMemo(
    () => applyFilters(received, filters.search, filters.status, filters.token, filters.sort, now),
    [received, filters.search, filters.status, filters.token, filters.sort, now],
  )
  const filteredSent = useMemo(
    () => applyFilters(sent, filters.search, filters.status, filters.token, filters.sort, now),
    [sent, filters.search, filters.status, filters.token, filters.sort, now],
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your active and historical token streams.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {withdrawableStreams.length > 0 && (
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={handleWithdrawAll}
              disabled={pending || isWithdrawingAll}
            >
              <ArrowDownToLine className="size-4" />
              <span className="hidden sm:inline">
                {isWithdrawingAll
                  ? `Withdrawing ${withdrawProgress.current}/${withdrawProgress.total}…`
                  : `Withdraw all (${withdrawableStreams.length})`}
              </span>
              <span className="sm:hidden">
                {isWithdrawingAll
                  ? `${withdrawProgress.current}/${withdrawProgress.total}`
                  : withdrawableStreams.length}
              </span>
            </Button>
          )}
          <Button asChild className="gap-1.5">
            <Link href="/app/create">
              <Plus className="size-4" />
              <span className="hidden sm:inline">New stream</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <SectionErrorBoundary sectionName="Dashboard stats">
        <DashboardStats sent={sent} received={received} />
      </SectionErrorBoundary>

      {/* Search / filter */}
      <FilterBar tokens={tokenSymbols} filters={filters} />

      {/* Stream list */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All ({filteredAll.length}{filteredAll.length !== all.length ? `/${all.length}` : ''})
          </TabsTrigger>
          <TabsTrigger value="received">
            Receiving ({filteredReceived.length}{filteredReceived.length !== received.length ? `/${received.length}` : ''})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sending ({filteredSent.length}{filteredSent.length !== sent.length ? `/${sent.length}` : ''})
          </TabsTrigger>
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
          <TabsTrigger value="received">Receiving ({received.length})</TabsTrigger>
          <TabsTrigger value="sent">Sending ({sent.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
      <SectionErrorBoundary sectionName="Stream list">
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="received">Receiving ({received.length})</TabsTrigger>
            <TabsTrigger value="sent">Sending ({sent.length})</TabsTrigger>
          </TabsList>

        <TabsContent value="all" className="mt-4">
          <StreamGrid streams={filteredAll} />
        </TabsContent>

        <TabsContent value="received" className="mt-4">
          {filteredReceived.length === 0 && received.length === 0 ? (
            <EmptyStreams
              title="No incoming streams"
              description="You haven't received any streams yet."
              showCreate={false}
            />
          ) : (
            <StreamGrid streams={filteredReceived} />
          )}
        </TabsContent>
          <TabsContent value="all" className="mt-4">
            {all.length === 0 ? (
              <EmptyStreams />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {all.map((s) => (
                  <ComponentErrorBoundary key={s.id} label="stream card">
                    <StreamCard stream={s} />
                  </ComponentErrorBoundary>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="received" className="mt-4">
            {received.length === 0 ? (
              <EmptyStreams
                title="No incoming streams"
                description="You haven't received any streams yet."
                showCreate={false}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {received.map((s) => (
                  <ComponentErrorBoundary key={s.id} label="stream card">
                    <StreamCard stream={s} />
                  </ComponentErrorBoundary>
                ))}
              </div>
            )}
          </TabsContent>

        <TabsContent value="sent" className="mt-4">
          {filteredSent.length === 0 && sent.length === 0 ? (
            <EmptyStreams
              title="No outgoing streams"
              description="Create a stream to start sending tokens that unlock over time."
            />
          ) : (
            <StreamGrid streams={filteredSent} />
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityFeed walletAddress={walletAddress ?? null} />
        </TabsContent>
      </Tabs>
          <TabsContent value="sent" className="mt-4">
            {sent.length === 0 ? (
              <EmptyStreams
                title="No outgoing streams"
                description="Create a stream to start sending tokens that unlock over time."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sent.map((s) => (
                  <ComponentErrorBoundary key={s.id} label="stream card">
                    <StreamCard stream={s} />
                  </ComponentErrorBoundary>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SectionErrorBoundary>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <RequireWallet>
      <Suspense>
        <Dashboard />
      </Suspense>
    </RequireWallet>
  )
}
