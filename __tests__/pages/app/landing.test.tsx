/**
 * Tests for app/page.tsx — Landing page composition (#765)
 *
 * Strategy
 * ─────────
 * LandingPage is a page-level composition component that assembles the full
 * marketing page. Its job is to render:
 *   1. LandingHeader  — top nav
 *   2. Hero           — headline + CTA
 *   3. Features       — feature-section grid
 *   4. HowItWorks     — step-by-step explainer
 *   5. UseCases       — use-case cards
 *   6. CTA            — bottom call-to-action
 *   7. Footer         — site footer
 *
 * We test:
 *   • Each section is present in the rendered output.
 *   • Sections appear in the expected document order (hero before features,
 *     features before footer, etc.).
 *
 * Mocked boundaries
 * ─────────────────
 * All landing sub-components are stubbed so the test doesn't need a router,
 * wallet context, or any data-fetching. Each stub renders a sentinel
 * data-testid that the composition assertions target.
 *
 * Following the pattern established in __tests__/pages/app/settings.test.tsx
 * (the reference for page-level composition tests in this codebase).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ─── Stub landing sub-components ─────────────────────────────────────────────

vi.mock('@/components/landing/hero', () => ({
  LandingHeader: () => <header data-testid="landing-header">Landing Header</header>,
  Hero: () => <section data-testid="hero">Hero</section>,
}))

vi.mock('@/components/landing/sections', () => ({
  Features: () => <section data-testid="features">Features</section>,
  HowItWorks: () => <section data-testid="how-it-works">How It Works</section>,
  UseCases: () => <section data-testid="use-cases">Use Cases</section>,
  CTA: () => <section data-testid="cta">CTA</section>,
  Footer: () => <footer data-testid="footer">Footer</footer>,
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

import LandingPage from '@/app/page'

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LandingPage composition (#765)', () => {
  it('renders the landing header', () => {
    render(<LandingPage />)
    expect(screen.getByTestId('landing-header')).toBeInTheDocument()
  })

  it('renders the Hero section', () => {
    render(<LandingPage />)
    expect(screen.getByTestId('hero')).toBeInTheDocument()
  })

  it('renders the Features section', () => {
    render(<LandingPage />)
    expect(screen.getByTestId('features')).toBeInTheDocument()
  })

  it('renders the HowItWorks section', () => {
    render(<LandingPage />)
    expect(screen.getByTestId('how-it-works')).toBeInTheDocument()
  })

  it('renders the UseCases section', () => {
    render(<LandingPage />)
    expect(screen.getByTestId('use-cases')).toBeInTheDocument()
  })

  it('renders the CTA section', () => {
    render(<LandingPage />)
    expect(screen.getByTestId('cta')).toBeInTheDocument()
  })

  it('renders the Footer', () => {
    render(<LandingPage />)
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('renders all seven sections together in a single pass', () => {
    render(<LandingPage />)

    expect(screen.getByTestId('landing-header')).toBeInTheDocument()
    expect(screen.getByTestId('hero')).toBeInTheDocument()
    expect(screen.getByTestId('features')).toBeInTheDocument()
    expect(screen.getByTestId('how-it-works')).toBeInTheDocument()
    expect(screen.getByTestId('use-cases')).toBeInTheDocument()
    expect(screen.getByTestId('cta')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('renders sections in the expected document order (header → hero → features → footer)', () => {
    render(<LandingPage />)

    const elements = [
      screen.getByTestId('landing-header'),
      screen.getByTestId('hero'),
      screen.getByTestId('features'),
      screen.getByTestId('how-it-works'),
      screen.getByTestId('use-cases'),
      screen.getByTestId('cta'),
      screen.getByTestId('footer'),
    ]

    // Each element should appear later in the document than the previous one.
    for (let i = 1; i < elements.length; i++) {
      expect(
        elements[i - 1].compareDocumentPosition(elements[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
  })

  it('wraps everything in a single root div', () => {
    const { container } = render(<LandingPage />)
    // The page root is a single <div className="relative min-h-svh">
    expect(container.firstElementChild?.tagName).toBe('DIV')
  })
})
