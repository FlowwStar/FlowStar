import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only active in production — avoids noise during development.
  enabled: process.env.NODE_ENV === 'production',

  // Capture 10% of transactions for performance monitoring.
  tracesSampleRate: 0.1,

  // Scrub sensitive data before it leaves the browser.
  beforeSend(event) {
    if (event.request?.data) {
      // Never log raw transaction payloads.
      event.request.data = '[REDACTED]'
    }
    // Truncate any full Stellar addresses in breadcrumbs to the first 8 chars.
    if (event.breadcrumbs?.values) {
      event.breadcrumbs.values = event.breadcrumbs.values.map((b) => {
        if (typeof b.message === 'string') {
          b.message = b.message.replace(/\b(G[A-Z2-7]{55})\b/g, (addr) => `${addr.slice(0, 8)}…`)
        }
        return b
      })
    }
    return event
  },
})
