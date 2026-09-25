'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Plus, ArrowDownToLine, RefreshCw, WifiOff } from 'lucide-react'
import { RequireWallet } from '@/components/layout/require-wallet'
import { TestnetFaucetBanner } from '@/components/layout/testnet-faucet-banner'
import { DashboardStats, DashboardStatsSkeleton } from '@/components/streams/dashboard-stats'
import { StreamCardSkeleton } from '@/components/streams/stream-card'
import { VirtualStreamList } from '@/components/streams/virtual-stream-list'
import { EmptyStreams } from '@/components/streams/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { SectionErrorBoundary } from '@/components/error-boundary/section-error-boundary'
import { ComponentErrorBoundary } from '@/components/error-boundary/component-error-boundary'
import { useStreams } from '@/hooks/use-streams'
import { useContract } from '@/hooks/use-contract'
import { useNow } from '@/hooks/use-now'
import { useHiddenStreams } from '@/hooks/use-hidden-streams'
import { getWithdrawableAmount } from '@/lib/stream-utils'
import { dashboardCopy } from '@/lib/copy/dashboard'
import type { StreamData } from '@/types/stream'

export function Dashboard() {
  const {
    sent: allSent,
    received: allReceived,
    all: allStreams,
    loading,
    isRefreshingAfterHidden,
    stale,
    lastUpdated,
  } = useStreams()
  const { withdrawAll, pending } = useContract()
  const now = useNow(1000)
  const { hiddenIds, blockedSenders, pinnedIds } = useHiddenStreams()

  // Hidden streams (and streams from blocked senders) never appear on the
  // dashboard — neither in the lists nor in the counts (issue #151).
  const isVisible = (s: StreamData) => !hiddenIds.has(s.id) && !blockedSenders.has(s.sender)

  // Pinned streams float to the top of every tab (issue #835).
  const sortPinned = (arr: StreamData[]) => [
    ...arr.filter((s) => pinnedIds.has(s.id)),
    ...arr.filter((s) => !pinnedIds.has(s.id)),
  ]

  const received = sortPinned(allReceived.filter(isVisible))
  const all = sortPinned(allStreams.filter(isVisible))
  const sent = sortPinned(allSent)
  const [withdrawProgress, setWithdrawProgress] = useState<{
    current: number
    total: number
  } | null>(null)

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

  return (
    <RequireWallet>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{dashboardCopy.header.title}</h1>
            <p className="text-muted-foreground text-sm">
              {dashboardCopy.header.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* "Refreshing…" indicator — shown briefly on tab re-focus after a
                long hidden period so the user knows fresh data is being loaded. */}
            {isRefreshingAfterHidden && (
              <span
                className="text-muted-foreground flex items-center gap-1 text-xs"
                aria-live="polite"
                aria-label={dashboardCopy.header.refreshingAriaLabel}
              >
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                {dashboardCopy.header.refreshing}
              </span>
            )}
            {withdrawableStreams.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleWithdrawAll}
                disabled={isWithdrawingAll || pending}
                data-testid="withdraw-all-btn"
              >
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                {isWithdrawingAll
                  ? dashboardCopy.header.withdrawingAll(withdrawProgress.current, withdrawProgress.total)
                  : dashboardCopy.header.withdrawAll(withdrawableStreams.length)}
                <span className="sr-only">
                  {isWithdrawingAll
                    ? `${withdrawProgress.current}/${withdrawProgress.total}`
                    : withdrawableStreams.length}
                </span>
              </Button>
            )}
            <Button size="sm" nativeButton={false} asChild>
              <Link href="/app/create">
                <Plus className="mr-2 h-4 w-4" />
                {dashboardCopy.header.newStream}
              </Link>
            </Button>
          </div>
        </div>

        {/* Testnet faucet banner */}
        <TestnetFaucetBanner />

        {/* Offline / stale-data banner */}
        {stale && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400"
          >
            <WifiOff className="size-4 shrink-0" />
            <span>
              {dashboardCopy.offlineBanner.message}
              {lastUpdated && dashboardCopy.offlineBanner.fromTime(new Date(lastUpdated).toLocaleString())}
              {dashboardCopy.offlineBanner.outdatedWarning}
            </span>
          </div>
        )}

        {/* Stats */}
        <SectionErrorBoundary>
          {loading ? (
            <DashboardStatsSkeleton />
          ) : (
            <DashboardStats sent={sent} received={received} />
          )}
        </SectionErrorBoundary>

        {/* Stream list */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">{dashboardCopy.tabs.all(all.length)}</TabsTrigger>
            <TabsTrigger value="receiving">{dashboardCopy.tabs.receiving(received.length)}</TabsTrigger>
            <TabsTrigger value="sending">{dashboardCopy.tabs.sending(sent.length)}</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <ComponentErrorBoundary>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <StreamCardSkeleton key={i} />
                  ))}
                </div>
              ) : all.length === 0 ? (
                <EmptyStreams />
              ) : (
                <VirtualStreamList streams={all} />
              )}
            </ComponentErrorBoundary>
          </TabsContent>

          <TabsContent value="receiving" className="mt-4">
            <ComponentErrorBoundary>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <StreamCardSkeleton key={i} />
                  ))}
                </div>
              ) : received.length === 0 ? (
                <EmptyStreams />
              ) : (
                <VirtualStreamList streams={received} />
              )}
            </ComponentErrorBoundary>
          </TabsContent>

          <TabsContent value="sending" className="mt-4">
            <ComponentErrorBoundary>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <StreamCardSkeleton key={i} />
                  ))}
                </div>
              ) : sent.length === 0 ? (
                <EmptyStreams />
              ) : (
                <VirtualStreamList streams={sent} />
              )}
            </ComponentErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>
    </RequireWallet>
  )
}
