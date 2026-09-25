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
  Rows3,
  Archive,
} from 'lucide-react'
import { RequireWallet } from '@/components/layout/require-wallet'
import { Button } from '@/components/ui/button'
import { streamsToCSV, downloadCSV } from '@/lib/export'
import { VirtualStreamList } from '@/components/streams/virtual-stream-list'
import { StreamGanttView } from '@/components/streams/stream-gantt-view'
import { EmptyStreams } from '@/components/streams/empty-state'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { streamsCopy, type SortOption } from '@/lib/copy/streams'

const SORT_OPTIONS = streamsCopy.filters.sortOptions
const STATUS_FILTERS = streamsCopy.filters.statusFilters

const TOKEN_OPTIONS = ['all', 'XLM', 'USDC', 'EURC'] as const

// Issue #688: read-only card for the Archived tab. Archived streams are
// terminal (cancelled, or fully withdrawn past end_time) so none of the
// active-stream actions (withdraw/cancel/select) apply — just the option to
// permanently clean them up via cleanup_stream().
function ArchivedStreamRow({ streamId, onRemoved }: { streamId: string; onRemoved: () => void }) {
  const { cleanup, pending } = useContract()
  const [confirming, setConfirming] = useState(false)

  async function handleRemove() {
    await cleanup(streamId)
    setConfirming(false)
    onRemoved()
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <span className="font-mono text-sm text-muted-foreground">{streamsCopy.archivedTab.streamPrefix(streamId)}</span>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{streamsCopy.archivedTab.removePrompt}</span>
          <Button size="sm" variant="destructive" disabled={pending} onClick={handleRemove}>
            {pending ? streamsCopy.archivedTab.removing : streamsCopy.archivedTab.confirmRemove}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            {streamsCopy.archivedTab.cancelRemove}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
          {streamsCopy.archivedTab.removeFromHistory}
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
    return <p className="text-muted-foreground py-12 text-center text-sm">{streamsCopy.archivedTab.loading}</p>
  }

  if (ids.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        {streamsCopy.archivedTab.empty}
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
  const { hiddenIds, blockedSenders, hideStream } = useHiddenStreams()
  const [showHidden, setShowHidden] = useState(false)
  const { view, setView } = useStreamsViewPreference()
  // Issue #688: Active vs Archived tab.
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active')

  const search = searchParams.get('q') ?? ''
  const statusFilter = (searchParams.get('status') ?? 'all') as StreamStatus | 'all'
  const tokenFilter = searchParams.get('token') ?? 'all'
  const sortBy = (searchParams.get('sort') ?? 'default') as SortOption

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

  if (sortBy !== 'default') {
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'amount-desc':
          return a.depositedAmount < b.depositedAmount ? 1 : a.depositedAmount > b.depositedAmount ? -1 : 0
        case 'amount-asc':
          return a.depositedAmount < b.depositedAmount ? -1 : a.depositedAmount > b.depositedAmount ? 1 : 0
        case 'start-desc':
          return a.startTime < b.startTime ? 1 : a.startTime > b.startTime ? -1 : 0
        case 'start-asc':
          return a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0
        case 'end-asc':
          return a.endTime < b.endTime ? -1 : a.endTime > b.endTime ? 1 : 0
        case 'end-desc':
          return a.endTime < b.endTime ? 1 : a.endTime > b.endTime ? -1 : 0
        default:
          return 0
      }
    })
  }

  const hasFilters = search || statusFilter !== 'all' || tokenFilter !== 'all'

  const { selected, selectedItems, allSelected, toggle, toggleAll, clear } = useBulkSelect(filtered)

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

  const handleBulkHide = () => {
    selectedItems.forEach((s) => hideStream(s.id))
    exitSelectMode()
  }

  return (
    <RequireWallet>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{streamsCopy.header.title}</h1>
            <p className="text-muted-foreground text-sm">
              {streamsCopy.header.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Tab re-focus refreshing indicator */}
            {isRefreshingAfterHidden && (
              <span
                className="text-muted-foreground flex items-center gap-1 text-xs"
                aria-live="polite"
                aria-label={streamsCopy.header.refreshingAriaLabel}
              >
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                {streamsCopy.header.refreshing}
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
              {streamsCopy.header.downloadCSV}
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
            {streamsCopy.tabs.active}
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
            {streamsCopy.tabs.archived}
          </button>
        </div>

        {activeTab === 'archived' ? (
          <ArchivedStreamsTab />
        ) : (
          <>
            <div className="flex items-center gap-2">
              {/* List / Compact / Timeline view toggle */}
              <div className="flex items-center rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  aria-pressed={view === 'list'}
                  aria-label={streamsCopy.views.listAriaLabel}
                  className={
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ' +
                    (view === 'list'
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground')
                  }
                >
                  <LayoutList className="size-3.5" />
                  <span className="hidden sm:inline">{streamsCopy.views.list}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView('compact')}
                  aria-pressed={view === 'compact'}
                  aria-label={streamsCopy.views.compactAriaLabel}
                  className={
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ' +
                    (view === 'compact'
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground')
                  }
                >
                  <Rows3 className="size-3.5" />
                  <span className="hidden sm:inline">{streamsCopy.views.compact}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView('timeline')}
                  aria-pressed={view === 'timeline'}
                  aria-label={streamsCopy.views.timelineAriaLabel}
                  className={
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ' +
                    (view === 'timeline'
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground')
                  }
                >
                  <GanttChartSquare className="size-3.5" />
                  <span className="hidden sm:inline">{streamsCopy.views.timeline}</span>
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
                  {showHidden
                    ? streamsCopy.hiddenToggle.showingHidden
                    : streamsCopy.hiddenToggle.hiddenCount(hiddenCount)}
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
                {selectMode ? streamsCopy.bulkSelect.doneSelecting : streamsCopy.bulkSelect.select}
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
                  {streamsCopy.bulkSelect.selectAll(filtered.length)}
                </label>
              )}
            </div>

            {/* Bulk action bar */}
            {selectMode && selected.size > 0 && (
              <div className="bg-muted flex flex-wrap items-center gap-2 rounded-lg p-3">
                <span className="text-sm font-medium" data-testid="bulk-selected-count">
                  {streamsCopy.bulkSelect.selectedCount(selected.size)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBulkRunning || eligibleWithdrawIds.length === 0}
                  onClick={handleBulkWithdraw}
                  data-testid="bulk-withdraw-button"
                >
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  {streamsCopy.bulkSelect.withdraw(eligibleWithdrawIds.length)}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBulkRunning || eligibleCancelIds.length === 0}
                  onClick={handleBulkCancel}
                  data-testid="bulk-cancel-button"
                >
                  <Ban className="mr-2 h-4 w-4" />
                  {streamsCopy.bulkSelect.cancel(eligibleCancelIds.length)}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBulkRunning || selected.size === 0}
                  onClick={handleBulkHide}
                  data-testid="bulk-hide-button"
                >
                  <EyeOff className="mr-2 h-4 w-4" />
                  {streamsCopy.bulkSelect.hideSelected(selected.size)}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => clear()}>
                  <X className="mr-2 h-4 w-4" />
                  {streamsCopy.bulkSelect.clear}
                </Button>
              </div>
            )}

            {/* Bulk action results */}
            {showBulkResults && (
              <div
                className="bg-muted flex items-center justify-between rounded-lg p-3 text-sm"
                data-testid="bulk-results"
              >
                <span>
                  {streamsCopy.bulkSelect.results(succeeded, failed)}
                </span>
                <Button size="sm" variant="ghost" onClick={reset}>
                  {streamsCopy.bulkSelect.dismiss}
                </Button>
              </div>
            )}

            {/* Filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder={streamsCopy.filters.searchPlaceholder}
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
                    {t === 'all' ? streamsCopy.filters.allTokens : t}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{streamsCopy.filters.sortByLabel}</span>
                <Select value={sortBy} onValueChange={(v) => setParam('sort', v)}>
                  <SelectTrigger className="h-8 w-[200px] text-xs" data-testid="streams-sort-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <p>{streamsCopy.empty.noMatch}</p>
                  <Button size="sm" variant="ghost" onClick={clearFilters} className="mt-2">
                    {streamsCopy.empty.clearFilters}
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
                compact={view === 'compact'}
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
