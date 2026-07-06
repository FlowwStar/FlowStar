'use client'

import { useState } from 'react'
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  RefreshCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react'
import { useStreamHistory, type TimelineEvent, type TimelineEventType } from '@/hooks/use-stream-history'
import { explorerUrl } from '@/lib/stellar'
import { useNetwork } from '@/components/providers/network-provider'

function eventIcon(type: TimelineEventType) {
  switch (type) {
    case 'created':
      return <Plus className="size-4" />
    case 'withdrawal':
      return <ArrowDownLeft className="size-4" />
    case 'topup':
      return <ArrowUpRight className="size-4" />
    case 'transfer':
      return <RefreshCcw className="size-4" />
    case 'cancellation':
      return <X className="size-4" />
  }
}

function eventColor(type: TimelineEventType): string {
  switch (type) {
    case 'created':
      return 'bg-primary/10 text-primary border-primary/20'
    case 'withdrawal':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
    case 'topup':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400'
    case 'transfer':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400'
    case 'cancellation':
      return 'bg-destructive/10 text-destructive border-destructive/20'
  }
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function shortenHash(hash: string): string {
  if (!hash || hash.length < 12) return hash
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

interface TimelineItemProps {
  event: TimelineEvent
  isLast: boolean
  explorerBase: string
}

function TimelineItem({ event, isLast, explorerBase }: TimelineItemProps) {
  return (
    <div className="flex gap-3">
      {/* Icon + line */}
      <div className="flex flex-col items-center">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${eventColor(event.type)}`}>
          {eventIcon(event.type)}
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
      </div>

      {/* Content */}
      <div className={`pb-6 ${isLast ? '' : ''} min-w-0 flex-1`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{event.description}</p>
            {event.amount && (
              <p className="text-xs text-muted-foreground">Amount: {event.amount}</p>
            )}
            {event.from && event.to && (
              <p className="text-xs text-muted-foreground font-mono">
                {event.from.slice(0, 8)}…→ {event.to.slice(0, 8)}…
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(event.timestamp)}
            </span>
            {event.txHash && (
              <a
                href={explorerBase + event.txHash}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
              >
                {shortenHash(event.txHash)}
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface StreamTimelineProps {
  streamId: string
}

export function StreamTimeline({ streamId }: StreamTimelineProps) {
  const { events, loading, refetch } = useStreamHistory(streamId)
  const { network } = useNetwork()
  const [collapsed, setCollapsed] = useState(false)

  const explorerBase = `https://stellar.expert/explorer/${network === 'testnet' ? 'testnet' : 'public'}/tx/`

  const displayEvents = collapsed ? events.slice(0, 3) : events

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Transaction history
          </h2>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Refresh timeline"
        >
          <RefreshCcw className="size-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <RefreshCcw className="size-4 animate-spin" />
          Loading history…
        </div>
      ) : events.length === 0 ? (
        <div className="py-6 text-center">
          <Clock className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            No transaction history found for this stream.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            History is populated from on-chain events after the stream is active.
          </p>
        </div>
      ) : (
        <div>
          {displayEvents.map((event, i) => (
            <TimelineItem
              key={`${event.txHash}-${event.timestamp}-${i}`}
              event={event}
              isLast={i === displayEvents.length - 1}
              explorerBase={explorerBase}
            />
          ))}

          {events.length > 3 && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {collapsed ? (
                <>
                  <ChevronDown className="size-3.5" />
                  Show {events.length - 3} more events
                </>
              ) : (
                <>
                  <ChevronUp className="size-3.5" />
                  Collapse
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
