import * as Sentry from '@sentry/nextjs'

// @sentry/nextjs v10 only initialises on the server/edge through this hook;
// the sentry.*.config.ts files are no longer picked up automatically.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
