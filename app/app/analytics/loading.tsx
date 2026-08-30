'use client'

import { ChartSkeleton } from '@/components/analytics/charts'

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted" />
      </div>

      {/* Charts skeleton */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
