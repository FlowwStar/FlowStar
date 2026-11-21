'use client'

import { DashboardStatsSkeleton } from '@/components/streams/dashboard-stats'
import { StreamCardSkeleton } from '@/components/streams/stream-card'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted" />
      </div>

      {/* Stats skeleton */}
      <DashboardStatsSkeleton />

      {/* Stream list skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StreamCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
