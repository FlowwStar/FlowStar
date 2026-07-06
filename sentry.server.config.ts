import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: process.env.NODE_ENV === 'production',

  // Lower sample rate on the server — API routes aren't the hot path.
  tracesSampleRate: 0.05,

  beforeSend(event) {
    // Never log amounts or raw XDR payloads from server-side RPC calls.
    if (event.extra) {
      delete event.extra['amount']
      delete event.extra['xdr']
    }
    return event
  },
})
