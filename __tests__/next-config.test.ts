import { describe, it, expect } from 'vitest'
import { nextConfig, securityHeaders, cspHeader } from '../next.config.mjs'

describe('next.config security headers & CSP', () => {
  it('defines headers function in nextConfig', async () => {
    expect(nextConfig.headers).toBeTypeOf('function')
    const headersConfig = await nextConfig.headers!()
    expect(headersConfig).toHaveLength(1)
    expect(headersConfig[0].source).toBe('/:path*')
    expect(headersConfig[0].headers).toEqual(securityHeaders)
  })

  it('configures all required security headers', () => {
    const headerMap = Object.fromEntries(
      securityHeaders.map((h) => [h.key, h.value])
    )

    expect(headerMap['X-Content-Type-Options']).toBe('nosniff')
    expect(headerMap['X-Frame-Options']).toBe('DENY')
    expect(headerMap['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headerMap['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()')
    expect(headerMap['Content-Security-Policy']).toBeDefined()
  })

  it('configures CSP with required directives and Stellar RPC support', () => {
    expect(cspHeader).toContain("default-src 'self'")
    expect(cspHeader).toContain("object-src 'none'")
    expect(cspHeader).toContain("frame-ancestors 'none'")
    expect(cspHeader).toContain("base-uri 'self'")

    // Supports Tailwind / shadcn inline styles
    expect(cspHeader).toContain("style-src 'self' 'unsafe-inline'")

    // Supports Stellar Horizon & Soroban RPCs and stellar.expert price feeds
    expect(cspHeader).toContain('connect-src')
    expect(cspHeader).toContain('https://*.stellar.org')
    expect(cspHeader).toContain('https://horizon.stellar.org')
    expect(cspHeader).toContain('https://horizon-testnet.stellar.org')
    expect(cspHeader).toContain('https://soroban-testnet.stellar.org')
    expect(cspHeader).toContain('https://api.stellar.expert')
  })
})
