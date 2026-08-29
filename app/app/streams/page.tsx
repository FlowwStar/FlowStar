'use client'
import { Suspense, useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  Download,
  ListChecks,
  ArrowDownToLine,
  Ban,
  X,
  RefreshCw,
  EyeOff,
  Eye,
  LayoutList,
  GanttChartSquare,
  Archive,
} from 'lucide-react'
import { RequireWallet } from '@/components/layout/require-wallet'
import { Button } from '@/components/ui/button'
import { streamsToCSV, downloadCSV } from '@/lib/export'
import { VirtualStreamList } from '@/components/streams/virtual-stream-list'
import { StreamGanttView } from '@/components/streams/stream-gantt-view'
import { EmptyStreams } from '@/components/streams/empty-state'
import { Input } from '@/components/ui/input'
import { useStreams } from '@/hooks/use-streams'
import { useArchivedStreams } from '@/hooks/use-archived-streams'
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

// Issue #688: read-only card for the Archived tab. Archived streams are
// terminal (cancelled, or fully withdrawn past end_time) so none of the
// active-stream actions (withdraw/cancel/select) apply — just the option to
// permanently clean them up via cleanup_stream().
function ArchivedStreamRow({
  streamId,
  onRemoved,
}: {
  streamId: string
  onRemoved: () => void
}) {
  const { cleanup, pending } = useContract()
  const [confirming, setConfirming] = useState(false)

  async function handleRemove() {
    await cleanup(streamId)
    setConfirming(false)
    onRemoved()
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <span className="font-mono text-sm text-muted-foreground">Stream #{streamId}</span>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Remove permanently?</span>
          <Button size="sm" variant="destructive" disabled={pending} onClick={handleRemove}>
            {pending ? 'Removing…' : 'Confirm'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
          Remove from history
        </Button>
      )}
    </div>
  )
}

function ArchivedStreamsTab() {
  const { address } = useWallet()
  const { sent, received, loading, refetch } = useArchivedStreams(address)
  const ids = [...new Set([...sent, ...received].map((id) => id))]

  if (loading && ids.length === 0) {
    return <p className="text-muted-foreground py-12 text-center text-sm">Loading archive…</p>
  }

  if (ids.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No archived streams yet. Streams appear here once cancelled or fully withdrawn.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {ids.map((id) => (
        <ArchivedStreamRow key={id} streamId={id} onRemoved={refetch} />
      ))}
    </div>
  )
}

function StreamsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { all, isRefreshingAfterHidden } = useStreams()
  const now = useNow(5000)
  const { address } = useWallet()
  const { withdraw, cancel } = useContract()
  const [selectMode, setSelectMode] = useState(false)
  const { hiddenIds, blockedSenders } = useHiddenStreams()
  const [showHidden, setShowHidden] = useState(false)
  const { view, setView } = useStreamsViewPreference()
  // Issue #688: Active vs Archived tab.
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active')

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
    const matchesStatus = statusFilter === 'all' || getStreamStatus(s, now) === statusFilter
    // When "Show hidden streams" is off, hidden/blocked streams don't appear
    // at all (issue #151). When it's on, only the concealed ones are shown,
    // so the user can review/un-hide them.
    const concealed = isConcealed(s)
    if (showHidden ? !concealed : concealed) return false

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

  const { selected, selectedItems, allSelected, toggle, toggleAll, clear } =
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
    <RequireWallet>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Streams</h1>
            <p className="text-muted-foreground text-sm">All streams you&#39;ve sent or received.</p>
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
              disabled={all.length === 0}
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

        {/* Issue #688: Active / Archived tabs */}
        <div className="flex items-center gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            aria-pressed={activeTab === 'active'}
            className={
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' +
              (activeTab === 'active'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archived')}
            aria-pressed={activeTab === 'archived'}
            className={
              'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' +
              (activeTab === 'archived'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            <Archive className="size-3.5" />
            Archived
          </button>
        </div>

        {activeTab === 'archived' ? (
          <ArchivedStreamsTab />
        ) : (
          <>
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
            {selectMode && selected.size > 0 && (
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
            ) : view === 'timeline' ? (
              <StreamGanttView streams={filtered} nowSeconds={now} />
            ) : (
              <VirtualStreamList
                streams={filtered}
                selectable={selectMode}
                selectedIds={selected}
                onToggleSelect={toggle}
              />
            )}
          </>
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
