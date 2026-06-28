'use client'

import { Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Download } from 'lucide-react'
import { RequireWallet } from '@/components/layout/require-wallet'
import { Button } from '@/components/ui/button'
import { streamsToCSV, downloadCSV } from '@/lib/export'
import { StreamCard } from '@/components/streams/stream-card'
import { EmptyStreams } from '@/components/streams/empty-state'
import { Input } from '@/components/ui/input'
import { useStreams } from '@/hooks/use-streams'
import { useNow } from '@/hooks/use-now'
import { getStreamStatus } from '@/lib/stream-utils'
import type { StreamStatus } from '@/types/stream'

const STATUS_FILTERS: { label: string; value: StreamStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Streaming', value: 'streaming' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

const TOKEN_OPTIONS = ['all', 'XLM', 'USDC', 'EURC'] as const

function StreamsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { all } = useStreams()
  const now = useNow(5000)

  const search = searchParams.get('q') ?? ''
  const statusFilter = (searchParams.get('status') ?? 'all') as StreamStatus | 'all'
  const tokenFilter = searchParams.get('token') ?? 'all'

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!value || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const clearFilters = useCallback(() => {
    router.replace('?', { scroll: false })
  }, [router])

  const filtered = all.filter((s) => {
    const matchesStatus =
      statusFilter === 'all' || getStreamStatus(s, now) === statusFilter
    const matchesToken =
      tokenFilter === 'all' ||
      s.token.symbol.toUpperCase() === tokenFilter.toUpperCase()
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      s.id.includes(q) ||
      s.sender.toLowerCase().includes(q) ||
      s.recipient.toLowerCase().includes(q) ||
      s.token.symbol.toLowerCase().includes(q)
    return matchesStatus && matchesToken && matchesSearch
  })

  const hasFilters = search || statusFilter !== 'all' || tokenFilter !== 'all'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Streams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All streams you've sent or received.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={all.length === 0}
          onClick={() => {
            const csv = streamsToCSV(all, now)
            downloadCSV(csv, `flowstar-streams-${new Date().toISOString().slice(0, 10)}.csv`)
          }}
        >
          <Download className="size-4" />
          Download CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by address or token…"
              value={search}
              onChange={(e) => setParam('q', e.target.value)}
              className="pl-9"
            />
          </div>
          {/* Token filter */}
          <div className="flex flex-wrap gap-2">
            {TOKEN_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setParam('token', t)}
                className={
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                  (tokenFilter === t
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground')
                }
              >
                {t === 'all' ? 'All tokens' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setParam('status', f.value)}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                (statusFilter === f.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground')
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        hasFilters ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
            <p className="text-sm font-medium">No streams match your filters</p>
            <button
              onClick={clearFilters}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <EmptyStreams />
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((s) => (
            <StreamCard key={s.id} stream={s} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function StreamsRoute() {
  return (
    <RequireWallet>
      <Suspense>
        <StreamsPage />
      </Suspense>
    </RequireWallet>
  )
}
