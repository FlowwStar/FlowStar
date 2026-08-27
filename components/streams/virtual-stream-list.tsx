'use client'
import { useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { StreamCard, StreamCardSkeleton } from '@/components/streams/stream-card'
import type { StreamData } from '@/types/stream'

// ─── Constants ─────────────────────────────────────────────────────────────────
// Virtualization only pays off above this threshold. Below it the overhead of
// position calculations outweighs the DOM savings.
const VIRTUALIZATION_THRESHOLD = 50

// Estimated card height used before a card has been measured. Keeps the
// scrollbar thumb size reasonable on first render. Tweak if your design changes.
const ESTIMATED_CARD_HEIGHT = 160

// Cards to render above and below the visible area. Per the issue spec: 3–5.
const OVERSCAN_COUNT = 4

// ─── Types ─────────────────────────────────────────────────────────────────────
interface VirtualStreamListProps {
  streams: StreamData[]
  loading?: boolean
  skeletonCount?: number
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  className?: string
}

// ─── Flat list (< VIRTUALIZATION_THRESHOLD items) ──────────────────────────────
function FlatStreamList({
  streams,
  selectable,
  selectedIds,
  onToggleSelect,
  className = '',
}: Omit<VirtualStreamListProps, 'loading' | 'skeletonCount'>) {
  return (
    <div className={`space-y-3 ${className}`} data-testid="stream-list-flat">
      {streams.map((s) => (
        <StreamCard
          key={s.id}
          stream={s}
          selectable={selectable}
          selected={selectedIds?.has(s.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  )
}

// ─── Virtualized list (≥ VIRTUALIZATION_THRESHOLD items) ───────────────────────
function VirtualList({
  streams,
  selectable,
  selectedIds,
  onToggleSelect,
  className = '',
}: Omit<VirtualStreamListProps, 'loading' | 'skeletonCount'>) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Per-item height cache: keyed by stream id so that remeasuring one card
  // doesn't invalidate unrelated entries.
  const sizeCache = useRef<Record<string, number>>({})

  const estimateSize = useCallback(
    (index: number) => {
      const id = streams[index]?.id
      return id ? (sizeCache.current[id] ?? ESTIMATED_CARD_HEIGHT) : ESTIMATED_CARD_HEIGHT
    },
    [streams],
  )

  const virtualizer = useVirtualizer({
    count: streams.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: OVERSCAN_COUNT,
    // Dynamic height measurement: after each item renders, the virtualizer
    // calls this to get the real height and adjusts its layout.
    measureElement: (element) => element.getBoundingClientRect().height,
  })

  const totalHeight = virtualizer.getTotalSize()
  const items = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      // Make the list itself the scroll container. Use 100vh as a sensible
      // default; callers can override via className or a wrapper element.
      className={`overflow-y-auto ${className}`}
      style={{ height: '100vh', maxHeight: '100%' }}
      data-testid="stream-list-virtual"
    >
      {/* Spacer div — tells the browser the full scrollable height so the
          scrollbar thumb is sized correctly even before all items render. */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {items.map((virtualRow) => {
          const stream = streams[virtualRow.index]
          return (
            <div
              key={stream.id}
              // data-index is required by @tanstack/react-virtual for its
              // ResizeObserver-based dynamic measurement to work correctly.
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${virtualRow.start}px)`,
                // Bottom padding separates cards visually (replaces space-y-3).
                paddingBottom: '0.75rem',
              }}
            >
              <StreamCard
                stream={stream}
                selectable={selectable}
                selected={selectedIds?.has(stream.id)}
                onToggleSelect={onToggleSelect}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Skeleton list ──────────────────────────────────────────────────────────────
function SkeletonList({ count }: { count: number }) {
  return (
    <div className="space-y-3" data-testid="stream-list-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <StreamCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ─── Public component ───────────────────────────────────────────────────────────
/**
 * Renders a list of stream cards with automatic virtualization for large lists.
 *
 * - Flat list (no virtual overhead) when streams.length < 50
 * - @tanstack/react-virtual with dynamic row heights for 50+ streams
 * - 4-item overscan buffer above and below the viewport
 * - Falls back to skeletons while loading
 */
export function VirtualStreamList({
  streams,
  loading = false,
  skeletonCount = 3,
  selectable,
  selectedIds,
  onToggleSelect,
  className,
}: VirtualStreamListProps) {
  if (loading) {
    return <SkeletonList count={skeletonCount} />
  }

  const props = { streams, selectable, selectedIds, onToggleSelect, className }

  return streams.length >= VIRTUALIZATION_THRESHOLD ? (
    <VirtualList {...props} />
  ) : (
    <FlatStreamList {...props} />
  )
}
