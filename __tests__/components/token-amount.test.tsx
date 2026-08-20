import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TokenAmount } from '@/components/ui/token-amount'
import type { TokenInfo } from '@/types/stream'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** USDC-like token: 7 decimals, symbol "USDC" */
const USDC: TokenInfo = { decimals: 7, symbol: 'USDC' }

/** XLM-like token: 7 decimals, symbol "XLM" */
const XLM: TokenInfo = { decimals: 7, symbol: 'XLM' }

/** EURC token: 7 decimals, symbol "EURC" */
const EURC: TokenInfo = { decimals: 7, symbol: 'EURC' }

/** Zero-decimal token (whole units only) */
const WHOLE: TokenInfo = { decimals: 0, symbol: 'WHL' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Renders a <TokenAmount> and returns the container's text content,
 * trimmed of surrounding whitespace.
 */
function renderText(
  amount: bigint,
  token: TokenInfo,
  props: Partial<Parameters<typeof TokenAmount>[0]> = {},
): string {
  const { container } = render(<TokenAmount amount={amount} token={token} {...props} />)
  return container.textContent?.trim() ?? ''
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TokenAmount', () => {
  // ── Formatted display ──────────────────────────────────────────────────────

  describe('formatted display', () => {
    it('renders zero as "0" with symbol', () => {
      renderText(0n, USDC)
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('USDC')).toBeInTheDocument()
    })

    it('renders a whole number amount correctly (1 USDC = 10_000_000 stroops)', () => {
      // 1 USDC = 1 * 10^7 = 10_000_000
      renderText(10_000_000n, USDC)
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('renders 100 USDC correctly', () => {
      renderText(1_000_000_000n, USDC)
      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('renders a fractional amount (0.5 USDC)', () => {
      // 0.5 * 10^7 = 5_000_000
      renderText(5_000_000n, USDC)
      expect(screen.getByText('0.5')).toBeInTheDocument()
    })

    it('renders a small fractional amount (0.0001 USDC)', () => {
      // 0.0001 * 10^7 = 1000 (4 decimal places, within default maxFractionDigits=4)
      renderText(1_000n, USDC)
      expect(screen.getByText('0.0001')).toBeInTheDocument()
    })

    it('trims trailing zeros in fractional part (0.25 USDC)', () => {
      // 0.25 * 10^7 = 2_500_000
      renderText(2_500_000n, USDC)
      expect(screen.getByText('0.25')).toBeInTheDocument()
    })

    it('renders large amounts with thousands separator', () => {
      // 1_234_567 USDC = 1_234_567 * 10^7
      renderText(12_345_670_000_000n, USDC)
      expect(screen.getByText('1,234,567')).toBeInTheDocument()
    })

    it('renders a negative amount correctly', () => {
      // -1 USDC
      renderText(-10_000_000n, USDC)
      expect(screen.getByText('-1')).toBeInTheDocument()
    })
  })

  // ── Decimal handling ───────────────────────────────────────────────────────

  describe('decimal handling', () => {
    it('applies token decimals correctly for 7-decimal token', () => {
      // 1.2345 XLM = 12_345_000 stroops (7 decimals)
      renderText(12_345_000n, XLM)
      expect(screen.getByText('1.2345')).toBeInTheDocument()
    })

    it('applies token decimals correctly for 0-decimal token (whole units only)', () => {
      renderText(42n, WHOLE)
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('respects maxFractionDigits=0 — no fractional part shown', () => {
      // 1.5 USDC, but maxFractionDigits=0 should truncate the fraction
      renderText(15_000_000n, USDC, { maxFractionDigits: 0 })
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('respects maxFractionDigits=2 — rounds display to 2 decimal places', () => {
      // 1.23456789 USDC at 7 decimals: 12_345_678, first 2 decimals of frac → "1.23"
      renderText(12_345_678n, USDC, { maxFractionDigits: 2 })
      expect(screen.getByText('1.23')).toBeInTheDocument()
    })

    it('default maxFractionDigits=4 caps display to 4 decimal places', () => {
      // 0.12345678 USDC: raw = 1_234_567; at 7 dec frac = "1234567" sliced to 4 → "1234"
      renderText(1_234_567n, USDC)
      expect(screen.getByText('0.1234')).toBeInTheDocument()
    })

    it('handles EURC (7 decimals) the same as USDC', () => {
      renderText(10_000_000n, EURC)
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('EURC')).toBeInTheDocument()
    })
  })

  // ── Symbol rendering ───────────────────────────────────────────────────────

  describe('symbol rendering', () => {
    it('shows the token symbol by default', () => {
      renderText(10_000_000n, USDC)
      expect(screen.getByText('USDC')).toBeInTheDocument()
    })

    it('shows the correct symbol for XLM token', () => {
      renderText(10_000_000n, XLM)
      expect(screen.getByText('XLM')).toBeInTheDocument()
    })

    it('hides the symbol when showSymbol=false', () => {
      const { queryByText } = render(
        <TokenAmount amount={10_000_000n} token={USDC} showSymbol={false} />,
      )
      expect(queryByText('USDC')).toBeNull()
    })

    it('applies symbolClassName to the symbol span', () => {
      const { container } = render(
        <TokenAmount amount={10_000_000n} token={USDC} symbolClassName="text-red-500" />,
      )
      const symbolSpan = container.querySelector('.text-red-500')
      expect(symbolSpan).toBeInTheDocument()
      expect(symbolSpan?.textContent).toBe('USDC')
    })
  })

  // ── Compact notation ───────────────────────────────────────────────────────

  describe('compact notation', () => {
    it('renders compact notation for thousands (1,200 → "1.2K")', () => {
      // 1200 USDC = 12_000_000_000 stroops
      const { container } = render(<TokenAmount amount={12_000_000_000n} token={USDC} compact />)
      // Compact output from Intl.NumberFormat should contain "K"
      expect(container.textContent).toMatch(/1\.2K/)
    })

    it('renders compact notation for millions (2,500,000 → "2.5M")', () => {
      // 2_500_000 USDC = 25_000_000_000_000 stroops
      const { container } = render(
        <TokenAmount amount={25_000_000_000_000n} token={USDC} compact />,
      )
      expect(container.textContent).toMatch(/2\.5M/)
    })

    it('compact mode still shows symbol by default', () => {
      render(<TokenAmount amount={12_000_000_000n} token={USDC} compact />)
      expect(screen.getByText('USDC')).toBeInTheDocument()
    })

    it('compact mode hides symbol when showSymbol=false', () => {
      const { queryByText } = render(
        <TokenAmount amount={12_000_000_000n} token={USDC} compact showSymbol={false} />,
      )
      expect(queryByText('USDC')).toBeNull()
    })
  })

  // ── CSS / className passthrough ────────────────────────────────────────────

  describe('className passthrough', () => {
    it('applies custom className to the outer span', () => {
      const { container } = render(
        <TokenAmount amount={10_000_000n} token={USDC} className="text-green-500" />,
      )
      const outer = container.querySelector('span')
      expect(outer?.className).toContain('text-green-500')
    })

    it('always includes font-mono and tabular-nums on the outer span', () => {
      const { container } = render(<TokenAmount amount={10_000_000n} token={USDC} />)
      const outer = container.querySelector('span')
      expect(outer?.className).toContain('font-mono')
      expect(outer?.className).toContain('tabular-nums')
    })
  })
})
