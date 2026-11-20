import { afterEach, describe, expect, it, vi } from 'vitest'
import sitemap from '@/app/sitemap'
import { SITE_URL } from '@/lib/site'

describe('app/sitemap', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('lists the landing page, dashboard and create routes', () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(urls).toEqual([SITE_URL, `${SITE_URL}/app`, `${SITE_URL}/app/create`])
  })

  it('builds every entry as an absolute URL from SITE_URL', () => {
    for (const { url } of sitemap()) {
      expect(url.startsWith(SITE_URL)).toBe(true)
      expect(() => new URL(url)).not.toThrow()
      expect(new URL(url).protocol).toMatch(/^https?:$/)
    }
  })

  it('does not contain duplicate URLs', () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(new Set(urls).size).toBe(urls.length)
  })

  it('excludes dynamic and settings/analytics private routes', () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname)

    expect(paths).not.toContain('/app/settings')
    expect(paths).not.toContain('/app/analytics')
    expect(paths).not.toContain('/app/streams')
    expect(paths).not.toContain('/app/create/batch')
    expect(paths.some((p) => p.startsWith('/app/stream/'))).toBe(false)
    expect(paths.some((p) => p.includes('['))).toBe(false)
  })

  it('gives every entry valid metadata', () => {
    for (const entry of sitemap()) {
      expect(entry.lastModified).toBeInstanceOf(Date)
      expect(entry.changeFrequency).toBeDefined()
      expect(entry.priority).toBeGreaterThan(0)
      expect(entry.priority).toBeLessThanOrEqual(1)
    }
  })

  it('gives the homepage the highest priority', () => {
    const entries = sitemap()
    const max = Math.max(...entries.map((e) => e.priority ?? 0))

    expect(entries[0].url).toBe(SITE_URL)
    expect(entries[0].priority).toBe(max)
  })

  it('uses NEXT_PUBLIC_SITE_URL when set', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test')
    const { default: freshSitemap } = await import('@/app/sitemap')

    expect(freshSitemap().map((e) => e.url)).toEqual([
      'https://example.test',
      'https://example.test/app',
      'https://example.test/app/create',
    ])
  })

  it('falls back to https://flowstar.app when NEXT_PUBLIC_SITE_URL is unset', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    const { default: freshSitemap } = await import('@/app/sitemap')

    expect(freshSitemap()[0].url).toBe('https://flowstar.app')
  })
})
