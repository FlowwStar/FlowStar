'use client'

import { useShowUsd } from '@/hooks/use-show-usd'

export function UsdToggle() {
  const [showUsd, setShowUsd] = useShowUsd()

  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-medium">Show USD values</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Display approximate USD equivalents on stream cards and the dashboard.
        </p>
      </div>
      <input
        type="checkbox"
        checked={showUsd}
        onChange={(e) => setShowUsd(e.target.checked)}
        className="size-4 accent-primary"
        aria-label="Show USD values"
      />
    </label>
  )
}
