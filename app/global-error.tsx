'use client'

import { useEffect } from 'react'
import { captureError } from '@/lib/sentry'
import './globals.css'

type Props = { error: Error & { digest?: string }; reset: () => void }

/**
 * Catches errors thrown in the root layout. It replaces the root layout when
 * active, so it must render its own <html> and <body>.
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    void captureError(error, { operation: 'global-error' })
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-border p-6 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try again or contact support.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
