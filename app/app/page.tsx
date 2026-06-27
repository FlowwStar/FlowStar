'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Plus, ArrowDownToLine } from 'lucide-react'
import { RequireWallet } from '@/components/layout/require-wallet'
import { DashboardStats } from '@/components/streams/dashboard-stats'
import { StreamCard } from '@/components/streams/stream-card'
import { EmptyStreams } from '@/components/streams/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { SectionErrorBoundary } from '@/components/error-boundary/section-error-boundary'
import { ComponentErrorBoundary } from '@/components/error-boundary/component-error-boundary'
import { useStreams } from '@/hooks/use-streams'
import { useContract } from '@/hooks/use-contract'
import { useNow } from '@/hooks/use-now'
import { getWithdrawableAmount } from '@/lib/stream-utils'

function Dashboard() {
  const { sent, received, all, loading } = useStreams()
  const { withdrawAll, pending } = useContract()
  const now = useNow(1000)
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

      {/* Stream list */}
      <SectionErrorBoundary sectionName="Stream list">
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="received">Receiving ({received.length})</TabsTrigger>
            <TabsTrigger value="sent">Sending ({sent.length})</TabsTrigger>
          </TabsList>

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
      <Dashboard />
    </RequireWallet>
  )
}
