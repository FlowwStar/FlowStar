'use client'

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted" />
      </div>

      {/* Settings sections skeleton */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-6 space-y-4">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
