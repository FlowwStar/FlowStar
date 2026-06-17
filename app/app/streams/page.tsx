'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { RequireWallet } from '@/components/layout/require-wallet'
import { StreamCard } from '@/components/streams/stream-card'
import { EmptyStreams } from '@/components/streams/empty-state'
import { StreamStatusBadge } from '@/components/streams/stream-status-badge'
import { Input } from '@/components/ui/input'
import { useStreams } from '@/hooks/use-streams'
import { useNow } from '@/hooks/use-now'
import { getStreamStatus, shortenAddress } from '@/lib/stream-utils'
import type { StreamStatus } from '@/types/stream'

const STATUS_FILTERS: { label: string; value: StreamStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Streaming', value: 'streaming' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

function StreamsPage() {
  const { all } = useStreams()
  const now = useNow(5000)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StreamStatus | 'all'>('all')

  const filtered = all.filter((s) => {
    const matchesStatus =
      statusFilter === 'all' || getStreamStatus(s, now) === statusFilter
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      s.id.includes(q) ||
      s.sender.toLowerCase().includes(q) ||
      s.recipient.toLowerCase().includes(q) ||
      s.token.symbol.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Streams</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All streams you've sent or received.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by address or token…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
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
        search || statusFilter !== 'all' ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
            <p className="text-sm font-medium">No streams match your filters</p>
            <button
              onClick={() => { setSearch(''); setStatusFilter('all') }}
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
      <StreamsPage />
    </RequireWallet>
  )
}
