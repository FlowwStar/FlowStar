import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── mock @/lib/site so tests are not coupled to the env variable ─────────────
vi.mock('@/lib/site', () => ({
  SITE_URL: 'https://flowstar.app',
}))

// Import after the mock is in place so the module picks up the stub value.
import sitemap from '@/app/sitemap'

describe('sitemap', () => {
  // ── return shape ─────────────────────────────────────────────────────────────

  describe('return shape', () => {
    it('returns exactly three entries', () => {
      expect(sitemap()).toHaveLength(3)
    })

    it('every entry has a url, lastModified Date, changeFrequency, and priority', () => {
      for (const entry of sitemap()) {
        expect(entry).toHaveProperty('url')
        expect(entry.lastModified).toBeInstanceOf(Date)
        expect(entry).toHaveProperty('changeFrequency')
        expect(entry).toHaveProperty('priority')
      }
    })
  })

  // ── URLs ─────────────────────────────────────────────────────────────────────

  describe('URLs', () => {
    it('the first entry points at the root', () => {
      const [root] = sitemap()
      expect(root.url).toBe('https://flowstar.app')
    })

    it('the second entry points at /app', () => {
      const [, app] = sitemap()
      expect(app.url).toBe('https://flowstar.app/app')
    })

    it('the third entry points at /app/create', () => {
      const [, , create] = sitemap()
      expect(create.url).toBe('https://flowstar.app/app/create')
    })
  })

  // ── priorities ───────────────────────────────────────────────────────────────

  describe('priorities', () => {
    it('root has priority 1 (highest)', () => {
      const [root] = sitemap()
      expect(root.priority).toBe(1)
    })

    it('/app has priority 0.9', () => {
      const [, app] = sitemap()
      expect(app.priority).toBe(0.9)
    })

    it('/app/create has priority 0.8', () => {
      const [, , create] = sitemap()
      expect(create.priority).toBe(0.8)
    })

    it('priorities are in descending order', () => {
      const priorities = sitemap().map((e) => e.priority as number)
      expect(priorities).toStrictEqual([...priorities].sort((a, b) => b - a))
    })
  })

  // ── changeFrequency ──────────────────────────────────────────────────────────

  describe('changeFrequency', () => {
    it('root is "daily"', () => {
      const [root] = sitemap()
      expect(root.changeFrequency).toBe('daily')
    })

    it('/app is "daily"', () => {
      const [, app] = sitemap()
      expect(app.changeFrequency).toBe('daily')
    })

    it('/app/create is "weekly"', () => {
      const [, , create] = sitemap()
      expect(create.changeFrequency).toBe('weekly')
    })
  })

  // ── lastModified ─────────────────────────────────────────────────────────────

  describe('lastModified', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('every entry has a lastModified that reflects the current time', () => {
      const now = new Date('2026-01-15T12:00:00Z')
      vi.setSystemTime(now)
      for (const entry of sitemap()) {
        expect(entry.lastModified).toEqual(now)
      }
    })

    it('lastModified updates to reflect a later call time', () => {
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
      const firstCall = sitemap().map((e) => e.lastModified as Date)

      vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
      const secondCall = sitemap().map((e) => e.lastModified as Date)

      for (let i = 0; i < 3; i++) {
        expect(secondCall[i].getTime()).toBeGreaterThan(firstCall[i].getTime())
      }
    })
  })

  // ── SITE_URL integration ─────────────────────────────────────────────────────

  describe('SITE_URL integration', () => {
    it('every URL is prefixed with the value from SITE_URL', () => {
      for (const entry of sitemap()) {
        expect(entry.url).toMatch(/^https:\/\/flowstar\.app/)
      }
    })

    it('no entry contains a double slash in the path segment', () => {
      for (const entry of sitemap()) {
        const path = entry.url.replace(/^https?:\/\/[^/]+/, '')
        expect(path).not.toMatch(/\/\//)
      }
    })
  })
})
