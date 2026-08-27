'use client'
import { Suspense, useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Download, ListChecks, ArrowDownToLine, Ban, X, RefreshCw } from 'lucide-react'
import { RequireWallet } from '@/components/layout/require-wallet'
import { Button } from '@/components/ui/button'
import { streamsToCSV, downloadCSV } from '@/lib/export'
import { VirtualStreamList } from '@/components/streams/virtual-stream-list'
import { EmptyStreams } from '@/components/streams/empty-state'
import { Input } from '@/components/ui/input'
import { useStreams } from '@/hooks/use-streams'
import { useNow } from '@/hooks/use-now'
import { useWallet } from '@/hooks/use-wallet'
import { useContract } from '@/hooks/use-contract'
import { useBulkSelect } from '@/hooks/use-bulk-select'
import { useBulkActions } from '@/hooks/use-bulk-actions'
import { getStreamStatus, getWithdrawableAmount } from '@/lib/stream-utils'
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
  const { all, isRefreshingAfterHidden } = useStreams()
  const now = useNow(5000)
  const { address } = useWallet()
  const { withdraw, cancel } = useContract()
  const [selectMode, setSelectMode] = useState(false)

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

  const { selected, selectedItems, allSelected, someSelected, toggle, toggleAll, clear } =
    useBulkSelect(filtered)

  const {
    status: bulkStatus,
    results: bulkResults,
    succeeded,
    failed,
    runBulk,
    reset,
  } = useBulkActions()

  const eligibleWithdrawIds = selectedItems
    .filter((s) => s.recipient === address && getWithdrawableAmount(s, now) > 0n)
    .map((s) => s.id)

  const eligibleCancelIds = selectedItems
    .filter(
      (s) =>
        s.sender === address &&
        !s.cancelled &&
        getStreamStatus(s, now) !== 'completed',
    )
    .map((s) => s.id)

  const isBulkRunning = bulkStatus === 'running'
  const showBulkResults = bulkStatus === 'done' && bulkResults.length > 0

  const exitSelectMode = () => {
    setSelectMode(false)
    clear()
    reset()
  }

  const handleBulkWithdraw = async () => {
    reset()
    await runBulk(eligibleWithdrawIds, async (id) => {
      const stream = filtered.find((s) => s.id === id)
      if (!stream) return
      await withdraw(id, getWithdrawableAmount(stream, now))
    })
  }

  const handleBulkCancel = async () => {
    reset()
    await runBulk(eligibleCancelIds, async (id) => {
      await cancel(id)
    })
  }

  return (
    <RequireWallet>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Streams</h1>
            <p className="text-muted-foreground text-sm">
              All streams you&#39;ve sent or received.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Tab re-focus refreshing indicator */}
            {isRefreshingAfterHidden && (
              <span
                className="text-muted-foreground flex items-center gap-1 text-xs"
                aria-live="polite"
                aria-label="Refreshing stream data"
              >
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                Refreshing…
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const csv = streamsToCSV(all, now)
                downloadCSV(csv, `flowstar-streams-${new Date().toISOString().slice(0, 10)}.csv`)
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </div>

        {/* Bulk select toggle */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            data-testid="bulk-select-toggle"
          >
            <ListChecks className="mr-2 h-4 w-4" />
            {selectMode ? 'Done selecting' : 'Select'}
          </Button>
          {selectMode && (
            <Button size="sm" variant="ghost" onClick={() => toggleAll()}>
              Select all ({filtered.length})
            </Button>
          )}
        </div>

        {/* Bulk action bar */}
        {selectMode && someSelected && (
          <div className="bg-muted flex flex-wrap items-center gap-2 rounded-lg p-3">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              disabled={isBulkRunning || eligibleWithdrawIds.length === 0}
              onClick={handleBulkWithdraw}
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Withdraw ({eligibleWithdrawIds.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isBulkRunning || eligibleCancelIds.length === 0}
              onClick={handleBulkCancel}
            >
              <Ban className="mr-2 h-4 w-4" />
              Cancel ({eligibleCancelIds.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => clear()}>
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        )}

        {/* Bulk action results */}
        {showBulkResults && (
          <div className="bg-muted flex items-center justify-between rounded-lg p-3 text-sm">
            <span>
              {succeeded} succeeded, {failed} failed
            </span>
            <Button size="sm" variant="ghost" onClick={reset}>
              Dismiss
            </Button>
          </div>
        )}

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by ID, address, or token…"
              value={search}
              onChange={(e) => setParam('q', e.target.value)}
              className="pl-9"
              data-testid="streams-search-input"
            />
          </div>

          {/* Token filter */}
          <div className="flex flex-wrap gap-2">
            {TOKEN_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setParam('token', t)}
                aria-pressed={tokenFilter === t}
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

          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setParam('status', f.value)}
                aria-pressed={statusFilter === f.value}
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
            <div className="text-muted-foreground py-12 text-center">
              <p>No streams match your filters</p>
              <Button size="sm" variant="ghost" onClick={clearFilters} className="mt-2">
                Clear filters
              </Button>
            </div>
          ) : (
            <EmptyStreams />
          )
        ) : (
          <VirtualStreamList
            streams={filtered}
            selectable={selectMode}
            selectedIds={selected}
            onToggleSelect={toggle}
          />
        )}
      </div>
    </RequireWallet>
  )
}

export default function StreamsRoute() {
  return (
    <Suspense>
      <StreamsPage />
    </Suspense>
  )
}
