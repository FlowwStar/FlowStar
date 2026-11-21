'use client'

export default function StreamDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back button skeleton */}
      <div className="h-6 w-32 animate-pulse rounded bg-muted" />

      {/* Header section skeleton */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Timeline/Activity section skeleton */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-3 border border-border rounded">
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-48 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
