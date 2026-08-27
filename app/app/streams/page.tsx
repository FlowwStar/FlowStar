'use client'

import { Suspense, useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Download, ListChecks, ArrowDownToLine, Ban, X, EyeOff, Eye, LayoutList, GanttChartSquare } from 'lucide-react'
import { RequireWallet } from '@/components/layout/require-wallet'
import { Button } from '@/components/ui/button'
import { streamsToCSV, downloadCSV } from '@/lib/export'
import { StreamCard } from '@/components/streams/stream-card'
import { StreamGanttView } from '@/components/streams/stream-gantt-view'
import { EmptyStreams } from '@/components/streams/empty-state'
import { Input } from '@/components/ui/input'
import { useStreams } from '@/hooks/use-streams'
import { useNow } from '@/hooks/use-now'
import { useWallet } from '@/hooks/use-wallet'
import { useContract } from '@/hooks/use-contract'
import { useBulkSelect } from '@/hooks/use-bulk-select'
import { useBulkActions } from '@/hooks/use-bulk-actions'
import { useHiddenStreams } from '@/hooks/use-hidden-streams'
import { useStreamsViewPreference } from '@/hooks/use-streams-view-preference'
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
  const { all } = useStreams()
  const now = useNow(5000)
  const { address } = useWallet()
  const { withdraw, cancel } = useContract()
  const [selectMode, setSelectMode] = useState(false)
  const { hiddenIds, blockedSenders } = useHiddenStreams()
  const [showHidden, setShowHidden] = useState(false)
  const { view, setView } = useStreamsViewPreference()

  const search = searchParams.get('q') ?? ''
  const statusFilter = (searchParams.get('status') ?? 'all') as StreamStatus | 'all'
  const tokenFilter = searchParams.get('token') ?? 'all'

  const isConcealed = (s: (typeof all)[number]) =>
    hiddenIds.has(s.id) || blockedSenders.has(s.sender)
  const hiddenCount = all.filter(isConcealed).length

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
    // When "Show hidden streams" is off, hidden/blocked streams don't appear
    // at all (issue #151). When it's on, only the concealed ones are shown,
    // so the user can review/un-hide them.
    const concealed = isConcealed(s)
    if (showHidden ? !concealed : concealed) return false

    const matchesStatus = statusFilter === 'all' || getStreamStatus(s, now) === statusFilter
    const matchesToken =
      tokenFilter === 'all' || s.token.symbol.toUpperCase() === tokenFilter.toUpperCase()
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
    .filter((s) => s.sender === address && !s.cancelled && getStreamStatus(s, now) !== 'completed')
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Streams</h1>
          <p className="mt-1 text-sm text-muted-foreground">All streams you've sent or received.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* List / Timeline view toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              aria-label="List view"
              className={
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ' +
                (view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')
              }
            >
              <LayoutList className="size-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => setView('timeline')}
              aria-pressed={view === 'timeline'}
              aria-label="Timeline view"
              className={
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ' +
                (view === 'timeline' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')
              }
            >
              <GanttChartSquare className="size-3.5" />
              <span className="hidden sm:inline">Timeline</span>
            </button>
          </div>
          <Button
            variant={showHidden ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowHidden((v) => !v)}
            data-testid="show-hidden-toggle"
          >
            {showHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            <span className="hidden sm:inline">
              {showHidden ? 'Showing hidden' : `Hidden${hiddenCount > 0 ? ` (${hiddenCount})` : ''}`}
            </span>
          </Button>
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
            <span className="hidden sm:inline">Download CSV</span>
          </Button>
        </div>
      </div>

      {/* Bulk select toggle */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant={selectMode ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          disabled={filtered.length === 0}
          onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          data-testid="bulk-select-toggle"
        >
          <ListChecks className="size-4" />
          {selectMode ? 'Done selecting' : 'Select'}
        </Button>

        {selectMode && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="size-4 accent-primary"
              data-testid="bulk-select-all"
            />
            Select all ({filtered.length})
          </label>
        )}
      </div>

      {/* Bulk action bar */}
      {selectMode && someSelected && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
          <span className="text-sm font-medium" data-testid="bulk-selected-count">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={eligibleWithdrawIds.length === 0 || isBulkRunning}
            onClick={handleBulkWithdraw}
            data-testid="bulk-withdraw-button"
          >
            <ArrowDownToLine className="size-4" />
            Withdraw ({eligibleWithdrawIds.length})
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={eligibleCancelIds.length === 0 || isBulkRunning}
            onClick={handleBulkCancel}
            data-testid="bulk-cancel-button"
          >
            <Ban className="size-4" />
            Cancel ({eligibleCancelIds.length})
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={clear}>
            <X className="size-4" />
            Clear
          </Button>
        </div>
      )}

      {/* Bulk action results */}
      {showBulkResults && (
        <div
          className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm"
          data-testid="bulk-results"
        >
          <span>
            {succeeded} succeeded, {failed} failed
          </span>
          <Button size="sm" variant="ghost" onClick={reset}>
            Dismiss
          </Button>
        </div>
      )}

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
              data-testid="streams-search-input"
            />
          </div>
          {/* Token filter */}
          <div className="flex flex-wrap gap-2">
            {TOKEN_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
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
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
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
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
            <p className="text-sm font-medium">No streams match your filters</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <EmptyStreams />
        )
      ) : view === 'timeline' ? (
        <StreamGanttView streams={filtered} nowSeconds={now} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((s) => (
            <StreamCard
              key={s.id}
              stream={s}
              selectable={selectMode}
              selected={selected.has(s.id)}
              onToggleSelect={toggle}
              isHiddenView={showHidden}
            />
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
