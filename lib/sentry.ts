'use client'

/**
 * Thin wrapper around Sentry so the rest of the codebase doesn't import
 * @sentry/nextjs directly (keeps the dependency swappable and tree-shakeable).
 */

let _sentry: typeof import('@sentry/nextjs') | null = null

async function getSentry() {
  if (_sentry) return _sentry
  try {
    _sentry = await import('@sentry/nextjs')
  } catch {
    _sentry = null
  }
  return _sentry
}

/** Report an error to Sentry with optional context tags. */
export async function captureError(
  err: unknown,
  context?: {
    walletAddress?: string
    operation?: string
    extra?: Record<string, unknown>
  },
): Promise<void> {
  const sentry = await getSentry()
  if (!sentry) return

  sentry.withScope((scope) => {
    if (context?.walletAddress) {
      // Attach wallet public key as user id — never a private key.
      scope.setUser({ id: context.walletAddress.slice(0, 8) + '…' })
    }
    if (context?.operation) {
      scope.setTag('operation', context.operation)
    }
    if (context?.extra) {
      Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v))
    }
    sentry.captureException(err)
  })
}

/** Set the connected wallet address as Sentry user context. Call on wallet connect/disconnect. */
export async function setSentryUser(walletAddress: string | null): Promise<void> {
  const sentry = await getSentry()
  if (!sentry) return
  if (walletAddress) {
    sentry.setUser({ id: walletAddress.slice(0, 8) + '…' })
  } else {
    sentry.setUser(null)
  }
}
