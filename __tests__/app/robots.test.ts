import { describe, it, expect } from 'vitest'
import robots from '@/app/robots'
import { SITE_URL } from '@/lib/site'

describe('app/robots.ts', () => {
  const result = robots()
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules]

  it('defines a single rule for all user agents', () => {
    expect(rules).toHaveLength(1)
    expect(rules[0].userAgent).toBe('*')
  })

  it('allows the public site root', () => {
    expect(rules[0].allow).toBe('/')
  })

  it('disallows the authenticated /app/ area', () => {
    expect(rules[0].disallow).toBe('/app/')
  })

  it('points sitemap to the site URL from lib/site.ts', () => {
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`)
  })
})
