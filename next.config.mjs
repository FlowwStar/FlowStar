import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

// Bundle analyzer — run with: ANALYZE=true npm run build
async function withBundleAnalyzer(config) {
  if (process.env.ANALYZE !== 'true') return config
  try {
    const { default: analyzer } = await import('@next/bundle-analyzer')
    return analyzer({ enabled: true })(config)
  } catch {
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
