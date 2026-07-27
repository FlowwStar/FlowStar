'use client'

import React from 'react'
import { RefreshCw } from 'lucide-react'
import { captureError } from '@/lib/sentry'

interface State {
  error: Error | null
  key: number
}

interface Props {
  children: React.ReactNode
  /** Compact label for the placeholder, e.g. "stream card" */
  label?: string
}

/**
 * Tier 3 — Component-level boundary.
 * Wraps individual stream cards, charts, and widgets. Shows a minimal
 * placeholder so one broken component doesn't hide sibling components.
 * Reports errors to monitoring.
 */
export class ComponentErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, key: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError(error, {
      operation: `component_render:${this.props.label ?? 'unknown'}`,
      extra: { componentStack: info.componentStack ?? '' },
    })
  }

  retry = () => this.setState((s) => ({ error: null, key: s.key + 1 }))

  render() {
    const { error, key } = this.state
    const { label = 'component' } = this.props

    if (!error) {
      return (
        <React.Fragment key={key}>
          {this.props.children}
        </React.Fragment>
      )
    }

    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-muted-foreground">
        <span>Failed to render {label}</span>
        <button
          onClick={this.retry}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted"
          aria-label={`Retry ${label}`}
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    )
  }
}
