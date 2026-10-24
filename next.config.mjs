import { createRequire } from 'node:module'

const { withSentryConfig } = createRequire(import.meta.url)('@sentry/nextjs')

export const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  connect-src 'self' https://*.stellar.org https://horizon.stellar.org https://horizon-testnet.stellar.org https://soroban-testnet.stellar.org https://api.stellar.expert https://*.sentry.io;
`.replace(/\s{2,}/g, ' ').trim()

export const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: cspHeader,
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

/** @type {import('next').NextConfig} */
export const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

// Bundle analyzer — run with: ANALYZE=true npm run build
async function withBundleAnalyzer(config) {
  if (process.env.ANALYZE !== 'true') return config
  try {
    const { default: analyzer } = await import('@next/bundle-analyzer')
    return analyzer({ enabled: true })(config)
  } catch {
    // This warning explains why optional bundle analysis was skipped.
    // eslint-disable-next-line no-console
    console.warn('[FlowStar] @next/bundle-analyzer not installed — skipping analysis')
    return config
  }
}

const analyzedConfig = await withBundleAnalyzer(nextConfig)

export default withSentryConfig(analyzedConfig, {
  // Sentry org/project set via env vars: SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN.
  silent: true,
  // Upload source maps only in CI to avoid leaking local paths.
  disableSourceMapUpload: process.env.CI !== 'true',
  // Automatically instrument Next.js server routes.
  autoInstrumentServerFunctions: true,
  // Tree-shake unused Sentry features to keep bundle small.
  widenClientFileUpload: false,
})
