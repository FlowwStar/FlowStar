import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

// cn() wraps clsx (conditional class assembly) + twMerge (Tailwind conflict
// resolution). Tests are grouped by the three behaviour areas the task calls
// out: plain merging, falsy/conditional dropping, and Tailwind deduplication.

describe('cn', () => {
  // ── plain class strings ────────────────────────────────────────────────────

  describe('plain class strings', () => {
    it('returns a single class unchanged', () => {
      expect(cn('flex')).toBe('flex')
    })

    it('joins multiple class strings with a space', () => {
      expect(cn('flex', 'items-center', 'gap-2')).toBe('flex items-center gap-2')
    })

    it('returns an empty string when called with no arguments', () => {
      expect(cn()).toBe('')
    })

    it('returns an empty string when all arguments are empty strings', () => {
      expect(cn('', '', '')).toBe('')
    })

    it('handles a single string containing multiple space-separated classes', () => {
      expect(cn('flex items-center')).toBe('flex items-center')
    })
  })

  // ── conditional / falsy values ─────────────────────────────────────────────

  describe('conditional classes (falsy values are dropped)', () => {
    it('drops a falsy boolean (false)', () => {
      expect(cn('flex', false && 'hidden')).toBe('flex')
    })

    it('drops undefined', () => {
      expect(cn('flex', undefined)).toBe('flex')
    })

    it('drops null', () => {
      expect(cn('flex', null)).toBe('flex')
    })

    it('drops an empty string', () => {
      expect(cn('flex', '')).toBe('flex')
    })

    it('includes a class when the condition is truthy', () => {
      const isActive = true
      expect(cn('flex', isActive && 'bg-primary')).toBe('flex bg-primary')
    })

    it('handles an object map of class → boolean (clsx object syntax)', () => {
      expect(cn({ flex: true, hidden: false, 'items-center': true })).toBe(
        'flex items-center',
      )
    })

    it('handles an array of mixed truthy/falsy entries (clsx array syntax)', () => {
      expect(cn(['flex', false && 'hidden', 'gap-2'])).toBe('flex gap-2')
    })
  })

  // ── Tailwind conflict resolution (tailwind-merge) ──────────────────────────

  describe('conflicting Tailwind classes are deduplicated', () => {
    it('later padding utility wins over earlier one', () => {
      // Without twMerge both would appear; twMerge keeps only the last winner.
      expect(cn('p-4', 'p-2')).toBe('p-2')
    })

    it('later text-colour utility wins over earlier one', () => {
      expect(cn('text-red-500', 'text-blue-600')).toBe('text-blue-600')
    })

    it('later background-colour utility wins over earlier one', () => {
      expect(cn('bg-red-500', 'bg-green-400')).toBe('bg-green-400')
    })

    it('later font-weight utility wins over earlier one', () => {
      expect(cn('font-bold', 'font-normal')).toBe('font-normal')
    })

    it('keeps non-conflicting utilities from both sides', () => {
      // flex and p-2 are different groups — both should survive.
      const result = cn('flex p-4', 'p-2')
      expect(result).toContain('flex')
      expect(result).toContain('p-2')
      expect(result).not.toContain('p-4')
    })

    it('resolves conflict introduced by a conditional class', () => {
      // Base has p-4; conditional override applies p-2 when true.
      const override = true
      expect(cn('p-4', override && 'p-2')).toBe('p-2')
    })

    it('deduplicates the same class appearing twice', () => {
      // twMerge collapses identical utility classes to one occurrence.
      const result = cn('flex', 'flex')
      expect(result).toBe('flex')
    })
  })
})
