'use client'

import React from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { captureError } from '@/lib/sentry'

interface State {
  error: Error | null
  key: number
}

interface Props {
  children: React.ReactNode
  /** Optional label shown in the fallback card, e.g. "Stream list" */
  sectionName?: string
  onReloadData?: () => void
}

/**
 * Tier 2 — Section-level boundary.
 * Wraps major page sections (stream list, analytics panel, sidebar).
 * Shows an inline error card; sibling sections keep working.
 * Reports errors to monitoring.
 */
export class SectionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, key: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError(error, {
      operation: `section_render:${this.props.sectionName ?? 'unknown'}`,
      extra: { componentStack: info.componentStack ?? '' },
    })
  }

  retry = () => this.setState((s) => ({ error: null, key: s.key + 1 }))

  render() {
    const { error, key } = this.state
    const { sectionName = 'This section', onReloadData } = this.props

    if (!error) {
      return (
        <React.Fragment key={key}>
          {this.props.children}
        </React.Fragment>
      )
    }

    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">{sectionName} failed to load</p>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {error.message || 'An unexpected error occurred.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={this.retry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
            {onReloadData && (
              <button
                onClick={() => { this.retry(); onReloadData() }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Reload data
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
}
