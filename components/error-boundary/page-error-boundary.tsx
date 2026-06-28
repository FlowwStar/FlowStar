'use client'

import React from 'react'
import Link from 'next/link'
import { captureError } from '@/lib/sentry'

interface State {
  error: Error | null
}

interface Props {
  children: React.ReactNode
}

/**
 * Tier 1 — Page-level boundary.
 * Wraps entire pages. Shows a full-screen fallback with navigation back to
 * the dashboard and a reload button. Reports errors to monitoring.
 */
export class PageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError(error, {
      operation: 'page_render',
      extra: { componentStack: info.componentStack ?? '' },
    })
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive text-2xl">
            ⚠
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred on this page.'}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={this.reset}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Reload page
            </button>
            <Link
              href="/app"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Go to dashboard
            </Link>
          </div>

          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-2 overflow-auto rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {error.stack ?? String(error)}
            </pre>
            <button
              onClick={() => navigator.clipboard?.writeText(error.stack ?? String(error))}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Copy error details
            </button>
          </details>
        </div>
      </div>
    )
  }
}
