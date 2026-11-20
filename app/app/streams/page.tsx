'use client'

import { Suspense, useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Download, ArrowDownToLine, XCircle, CheckSquare, Square, MinusSquare } from 'lucide-react'
import { toast } from 'sonner'
import { RequireWallet } from '@/components/layout/require-wallet'
import { Button } from '@/components/ui/button'
import { streamsToCSV, downloadCSV } from '@/lib/export'
import { StreamCard } from '@/components/streams/stream-card'
import { EmptyStreams } from '@/components/streams/empty-state'
import { Input } from '@/components/ui/input'
import { useStreams } from '@/hooks/use-streams'
import { useNow } from '@/hooks/use-now'
import { useContract } from '@/hooks/use-contract'
import { useWallet } from '@/hooks/use-wallet'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { useBulkActions } from '@/hooks/useBulkActions'
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
  const { withdraw, cancel } = useContract()
  const { address } = useWallet()
  const now = useNow(5000)
  const [bulkMode, setBulkMode] = useState(false)

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

  // ── Bulk select ──────────────────────────────────────────────────────────
  const { selected, selectedItems, allSelected, someSelected, toggle, toggleAll, clear } =
    useBulkSelect(filtered)

  const { status: bulkStatus, progress, results, succeeded, failed, runBulk } = useBulkActions()

  // Streams the wallet can withdraw from (received + have balance)
  const withdrawableSelected = selectedItems.filter(
    (s) => s.recipient === address && getWithdrawableAmount(s, now) > 0n,
  )

  // Streams the wallet can cancel (sent + not already cancelled)
  const cancellableSelected = selectedItems.filter(
    (s) => s.sender === address && !s.cancelled && getStreamStatus(s, now) !== 'completed',
  )

  async function handleBulkWithdraw() {
    if (withdrawableSelected.length === 0) return
    await runBulk(
      withdrawableSelected.map((s) => s.id),
      async (id) => {
        const stream = withdrawableSelected.find((s) => s.id === id)!
        const amount = getWithdrawableAmount(stream, Math.floor(Date.now() / 1000))
        await withdraw(id, amount)
      },
    )
    toast.success(`Withdrew from ${withdrawableSelected.length} stream${withdrawableSelected.length !== 1 ? 's' : ''}`)
    clear()
  }

  async function handleBulkCancel() {
    if (cancellableSelected.length === 0) return
    const confirmed = window.confirm(
      `Cancel ${cancellableSelected.length} stream${cancellableSelected.length !== 1 ? 's' : ''}? This cannot be undone.`,
    )
    if (!confirmed) return
    await runBulk(
      cancellableSelected.map((s) => s.id),
      async (id) => { await cancel(id) },
    )
    toast.success(`Cancelled ${cancellableSelected.length} stream${cancellableSelected.length !== 1 ? 's' : ''}`)
    clear()
  }

  function exitBulkMode() {
    setBulkMode(false)
    clear()
  }

  const isBulkRunning = bulkStatus === 'running'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Streams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All streams you've sent or received.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!bulkMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setBulkMode(true)}
                disabled={filtered.length === 0}
              >
                <CheckSquare className="size-4" />
                <span className="hidden sm:inline">Select</span>
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
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={exitBulkMode} disabled={isBulkRunning}>
              Done
            </Button>
          )}
        </div>
      </div>

      {/* Bulk action toolbar */}
      {bulkMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          {/* Select all toggle */}
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 transition-opacity"
            aria-label={allSelected ? 'Deselect all' : 'Select all'}
          >
            {allSelected ? (
              <CheckSquare className="size-4" />
            ) : someSelected ? (
              <MinusSquare className="size-4" />
            ) : (
              <Square className="size-4" />
            )}
            {allSelected ? 'Deselect all' : 'Select all'}
            {someSelected && (
              <span className="ml-1 text-muted-foreground font-normal">
                ({selected.size} of {filtered.length})
              </span>
            )}
          </button>

          <div className="ml-auto flex flex-wrap gap-2">
            {withdrawableSelected.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={handleBulkWithdraw}
                disabled={isBulkRunning}
              >
                <ArrowDownToLine className="size-4" />
                Withdraw ({withdrawableSelected.length})
              </Button>
            )}
            {cancellableSelected.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={handleBulkCancel}
                disabled={isBulkRunning}
              >
                <XCircle className="size-4" />
                Cancel ({cancellableSelected.length})
              </Button>
            )}
            {someSelected && withdrawableSelected.length === 0 && cancellableSelected.length === 0 && (
              <span className="text-xs text-muted-foreground self-center">
                No actions available for selected streams
              </span>
            )}
          </div>

          {/* Bulk progress feedback */}
          {bulkStatus !== 'idle' && (
            <div className="w-full mt-1 text-xs text-muted-foreground">
              {bulkStatus === 'running'
                ? `Processing ${progress.done} / ${progress.total}…`
                : `Done — ${succeeded} succeeded, ${failed} failed`}
            </div>
          )}
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
          {filtered.map((s) => {
            if (bulkMode) {
              const isSelected = selected.has(s.id)
              return (
                <div key={s.id} className="relative">
                  {/* Overlay for selection */}
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={
                      'absolute inset-0 z-10 rounded-2xl border-2 transition-colors ' +
                      (isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:border-primary/40')
                    }
                    aria-label={`${isSelected ? 'Deselect' : 'Select'} stream ${s.id}`}
                  >
                    <span className="absolute right-3 top-3">
                      {isSelected ? (
                        <CheckSquare className="size-5 text-primary" />
                      ) : (
                        <Square className="size-5 text-muted-foreground/50" />
                      )}
                    </span>
                  </button>
                  <div className="pointer-events-none opacity-90">
                    <StreamCard stream={s} />
                  </div>
                </div>
              )
            }
            return <StreamCard key={s.id} stream={s} />
          })}
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
