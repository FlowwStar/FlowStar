import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBar } from '@/components/ui/progress-bar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the numeric aria-valuenow attribute from the progressbar element.
 * This is set to Math.round(clampedValue * 100) by the component.
 */
function getValueNow(): number {
  return Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))
}

/**
 * Returns the inline width style of the fill bar (the first child div of the
 * progressbar). We read the raw `style` attribute to bypass cssstyle parsing,
 * which is unreliable for CSS values like calc() in jsdom.
 * The component sets it to `${pct}%` where pct = clamped * 100.
 */
function getFillWidth(): string {
  const bar = screen.getByRole('progressbar')
  const fill = bar.firstElementChild!
  const raw = fill.getAttribute('style') ?? ''
  // Extract the width value from e.g. "width: 50%;"
  const match = raw.match(/width:\s*([^;]+)/)
  return match ? match[1].trim() : ''
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProgressBar', () => {
  // ── ARIA role & static attributes ──────────────────────────────────────────

  describe('accessibility attributes', () => {
    it('renders with role="progressbar"', () => {
      render(<ProgressBar value={0.5} />)
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('has aria-valuemin=0 and aria-valuemax=100', () => {
      render(<ProgressBar value={0.5} />)
      const bar = screen.getByRole('progressbar')
      expect(bar).toHaveAttribute('aria-valuemin', '0')
      expect(bar).toHaveAttribute('aria-valuemax', '100')
    })

    it('sets aria-valuenow to the rounded percentage', () => {
      render(<ProgressBar value={0.75} />)
      expect(getValueNow()).toBe(75)
    })
  })

  // ── Value clamping ──────────────────────────────────────────────────────────

  describe('value clamping', () => {
    it('clamps a value below 0 to 0%', () => {
      render(<ProgressBar value={-0.5} />)
      expect(getValueNow()).toBe(0)
      expect(getFillWidth()).toBe('0%')
    })

    it('clamps exactly 0 to 0%', () => {
      render(<ProgressBar value={0} />)
      expect(getValueNow()).toBe(0)
      expect(getFillWidth()).toBe('0%')
    })

    it('clamps a large negative value to 0%', () => {
      render(<ProgressBar value={-999} />)
      expect(getValueNow()).toBe(0)
      expect(getFillWidth()).toBe('0%')
    })

    it('clamps a value above 1 to 100%', () => {
      render(<ProgressBar value={1.5} />)
      expect(getValueNow()).toBe(100)
      expect(getFillWidth()).toBe('100%')
    })

    it('clamps exactly 1 to 100%', () => {
      render(<ProgressBar value={1} />)
      expect(getValueNow()).toBe(100)
      expect(getFillWidth()).toBe('100%')
    })

    it('clamps a large value above 1 to 100%', () => {
      render(<ProgressBar value={999} />)
      expect(getValueNow()).toBe(100)
      expect(getFillWidth()).toBe('100%')
    })

    it('renders mid-range values without clamping (0.5 → 50%)', () => {
      render(<ProgressBar value={0.5} />)
      expect(getValueNow()).toBe(50)
      expect(getFillWidth()).toBe('50%')
    })

    it('renders fractional values precisely (0.333 → ~33%)', () => {
      render(<ProgressBar value={0.333} />)
      // aria-valuenow is Math.round(33.3) = 33
      expect(getValueNow()).toBe(33)
      // fill width is the raw JS float: 0.333 * 100 = 33.300000000000004
      expect(getFillWidth()).toMatch(/^33\.3/)
    })
  })

  // ── Marker position math ────────────────────────────────────────────────────

  describe('optional marker', () => {
    /**
     * jsdom (via cssstyle) does not parse CSS calc() expressions, so
     * `element.style.left` returns '' for `calc(…)` values.  We instead
     * read the raw `style` attribute string which React writes verbatim,
     * bypassing CSSOM parsing entirely.
     *
     * Returns the raw `style` attribute of the marker element, or null when
     * no marker is rendered.
     */
    function getMarkerStyleAttr(): string | null {
      const bar = screen.getByRole('progressbar')
      const marker = bar.querySelector('[aria-hidden]')
      return marker ? marker.getAttribute('style') : null
    }

    it('renders a marker at the correct position for a valid value', () => {
      render(<ProgressBar value={0.5} marker={0.25} />)
      expect(getMarkerStyleAttr()).toContain('calc(25% - 1px)')
    })

    it('renders marker at 50% position', () => {
      render(<ProgressBar value={0.8} marker={0.5} />)
      expect(getMarkerStyleAttr()).toContain('calc(50% - 1px)')
    })

    it('renders marker at 100% position', () => {
      render(<ProgressBar value={1} marker={1} />)
      expect(getMarkerStyleAttr()).toContain('calc(100% - 1px)')
    })

    it('clamps a marker value below 0 — marker is not rendered (markerPct=0)', () => {
      // markerPct clamps to 0; the guard `markerPct > 0` prevents rendering.
      render(<ProgressBar value={0.5} marker={-0.5} />)
      expect(getMarkerStyleAttr()).toBeNull()
    })

    it('clamps a marker value above 1 to 100%', () => {
      render(<ProgressBar value={0.5} marker={1.5} />)
      expect(getMarkerStyleAttr()).toContain('calc(100% - 1px)')
    })

    it('does not render a marker when the prop is omitted', () => {
      render(<ProgressBar value={0.5} />)
      expect(getMarkerStyleAttr()).toBeNull()
    })

    it('does not render a marker when marker=0', () => {
      // markerPct = 0 → the guard `markerPct > 0` prevents rendering.
      render(<ProgressBar value={0.5} marker={0} />)
      expect(getMarkerStyleAttr()).toBeNull()
    })
  })

  // ── Indeterminate shimmer ───────────────────────────────────────────────────

  describe('indeterminate shimmer', () => {
    it('renders the shimmer overlay when value is mid-range and shimmer is enabled', () => {
      const { container } = render(
        <ProgressBar value={0.5} indeterminateShimmer />,
      )
      // querySelector returns Element | null; check for presence with toBeTruthy
      // rather than toBeInTheDocument() to avoid the null type mismatch.
      expect(container.querySelector('.animate-pulse')).toBeTruthy()
    })

    it('does not render the shimmer when value is 0', () => {
      const { container } = render(
        <ProgressBar value={0} indeterminateShimmer />,
      )
      expect(container.querySelector('.animate-pulse')).toBeNull()
    })

    it('does not render the shimmer when value is 1 (100%)', () => {
      const { container } = render(
        <ProgressBar value={1} indeterminateShimmer />,
      )
      expect(container.querySelector('.animate-pulse')).toBeNull()
    })

    it('does not render the shimmer when indeterminateShimmer is not set', () => {
      const { container } = render(<ProgressBar value={0.5} />)
      expect(container.querySelector('.animate-pulse')).toBeNull()
    })
  })
})
