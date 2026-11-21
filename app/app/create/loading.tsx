'use client'

export default function CreateStreamLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
      </div>

      {/* Form section skeleton */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        {/* Form fields skeleton */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        ))}

        {/* Button skeleton */}
        <div className="flex gap-3 pt-4">
          <div className="h-10 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
