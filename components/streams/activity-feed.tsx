'use client'

import Link from 'next/link'
import {
  CirclePlay,
  ArrowDownToLine,
  XCircle,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useActivityFeed, type ActivityEventType } from '@/hooks/use-activity-feed'

const EVENT_ICONS: Record<ActivityEventType, React.ElementType> = {
  'stream.created': CirclePlay,
  'stream.withdrawal': ArrowDownToLine,
  'stream.cancelled': XCircle,
  'stream.completed': CheckCircle2,
  'stream.topped_up': TrendingUp,
  'stream.transferred': RefreshCw,
}

const EVENT_COLORS: Record<ActivityEventType, string> = {
  'stream.created': 'text-blue-500',
  'stream.withdrawal': 'text-yellow-500',
  'stream.cancelled': 'text-destructive',
  'stream.completed': 'text-green-500',
  'stream.topped_up': 'text-purple-500',
  'stream.transferred': 'text-cyan-500',
}

const ALL_TYPES: { value: ActivityEventType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'stream.created', label: 'Created' },
  { value: 'stream.withdrawal', label: 'Withdrawal' },
  { value: 'stream.cancelled', label: 'Cancelled' },
  { value: 'stream.completed', label: 'Completed' },
]

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(ts).toLocaleDateString()
}

function absoluteTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

interface ActivityFeedProps {
  walletAddress: string | null
}

export function ActivityFeed({ walletAddress }: ActivityFeedProps) {
  const { events, hasMore, loadMore, filter, setFilter } = useActivityFeed(walletAddress)

  if (!walletAddress) return null

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-1">
          {ALL_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setFilter((f) => ({ ...f, eventType: t.value }))}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filter.eventType === t.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {(['all', 'sent', 'received'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setFilter((f) => ({ ...f, role: r }))}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filter.role === r
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Activity className="size-8 opacity-30" />
          <p className="text-sm">No activity yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {events.map((event) => {
            const Icon = EVENT_ICONS[event.type]
            const color = EVENT_COLORS[event.type]
            return (
              <Link
                key={event.id}
                href={`/app/stream/${event.streamId}`}
                className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors group"
              >
                <Icon className={`size-4 mt-0.5 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{event.description}</p>
                </div>
                <time
                  dateTime={new Date(event.timestamp).toISOString()}
                  title={absoluteTime(event.timestamp)}
                  className="text-xs text-muted-foreground shrink-0 tabular-nums"
                >
                  {relativeTime(event.timestamp)}
                </time>
              </Link>
            )
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
