'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { RequireWallet } from '@/components/layout/require-wallet'
import { DashboardStats } from '@/components/streams/dashboard-stats'
import { StreamCard } from '@/components/streams/stream-card'
import { EmptyStreams } from '@/components/streams/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useStreams } from '@/hooks/use-streams'

function Dashboard() {
  const { sent, received, all, loading } = useStreams()

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
        <Button asChild className="gap-1.5">
          <Link href="/app/create">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New stream</span>
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <DashboardStats sent={sent} received={received} />

      {/* Stream list */}
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
                <StreamCard key={s.id} stream={s} />
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
                <StreamCard key={s.id} stream={s} />
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
                <StreamCard key={s.id} stream={s} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
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
