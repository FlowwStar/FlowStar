/**
 * Tests for components/landing/sections.tsx — Landing page sections
 *
 * Strategy
 * ─────────
 * Sections are presentational components that render marketing content.
 * We verify each section renders with correct headings and body text.
 *
 * Mocked boundaries
 * ─────────────────
 * • next/link — thin <a> stub (no Next.js router required)
 * • Button component — renders as <button> or link (no Radix/shadcn overhead)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { Features, HowItWorks, UseCases, CTA, Footer } from '@/components/landing/sections'

describe('Landing Sections', () => {
  describe('Features', () => {
    it('renders Features section heading', () => {
      render(<Features />)
      expect(screen.getByText('Why FlowStar')).toBeInTheDocument()
      expect(screen.getByText('Programmable money that moves continuously')).toBeInTheDocument()
    })

    it('renders all feature cards with titles and descriptions', () => {
      render(<Features />)
      expect(screen.getByText('Per-second unlocking')).toBeInTheDocument()
      expect(screen.getByText(/Funds unlock continuously down to the second/)).toBeInTheDocument()

      expect(screen.getByText('Non-custodial')).toBeInTheDocument()
      expect(screen.getByText(/Streams live in a Soroban smart contract/)).toBeInTheDocument()

      expect(screen.getByText('Cliffs & schedules')).toBeInTheDocument()
      expect(screen.getByText(/Add a cliff before unlocking starts/)).toBeInTheDocument()

      expect(screen.getByText('Withdraw anytime')).toBeInTheDocument()
      expect(screen.getByText(/Recipients withdraw unlocked funds whenever they want/)).toBeInTheDocument()
    })
  })

  describe('HowItWorks', () => {
    it('renders HowItWorks section heading', () => {
      render(<HowItWorks />)
      expect(screen.getByText('How it works')).toBeInTheDocument()
      expect(screen.getByText('Three steps from transfer to stream')).toBeInTheDocument()
    })

    it('renders all three steps with titles and descriptions', () => {
      render(<HowItWorks />)
      expect(screen.getByText('Connect your wallet')).toBeInTheDocument()
      expect(screen.getByText(/Sign in with Freighter, xBull, LOBSTR, or Albedo/)).toBeInTheDocument()

      expect(screen.getByText('Create a stream')).toBeInTheDocument()
      expect(screen.getByText(/Pick a token, recipient, amount, and schedule/)).toBeInTheDocument()

      expect(screen.getByText('Watch it flow')).toBeInTheDocument()
      expect(screen.getByText(/The recipient withdraws unlocked funds anytime/)).toBeInTheDocument()
    })

    it('renders step numbers', () => {
      render(<HowItWorks />)
      expect(screen.getByText('01')).toBeInTheDocument()
      expect(screen.getByText('02')).toBeInTheDocument()
      expect(screen.getByText('03')).toBeInTheDocument()
    })
  })

  describe('UseCases', () => {
    it('renders UseCases section heading', () => {
      render(<UseCases />)
      expect(screen.getByText('Use cases')).toBeInTheDocument()
      expect(screen.getByText('One primitive, many payment flows')).toBeInTheDocument()
    })

    it('renders all use case cards with titles and descriptions', () => {
      render(<UseCases />)
      expect(screen.getByText('Payroll')).toBeInTheDocument()
      expect(screen.getByText(/Pay contributors a salary that streams every second/)).toBeInTheDocument()

      expect(screen.getByText('Token vesting')).toBeInTheDocument()
      expect(screen.getByText(/Vest team and investor allocations on-chain/)).toBeInTheDocument()

      expect(screen.getByText('Grants')).toBeInTheDocument()
      expect(screen.getByText(/Fund builders progressively/)).toBeInTheDocument()

      expect(screen.getByText('Subscriptions')).toBeInTheDocument()
      expect(screen.getByText(/Bill continuously for services/)).toBeInTheDocument()
    })
  })

  describe('CTA', () => {
    it('renders call-to-action section heading', () => {
      render(<CTA />)
      expect(screen.getByText('Start streaming in minutes')).toBeInTheDocument()
    })

    it('renders CTA description', () => {
      render(<CTA />)
      expect(screen.getByText(/Connect a wallet and create your first stream/)).toBeInTheDocument()
    })

    it('renders CTA button with Create a stream link', () => {
      render(<CTA />)
      const link = screen.getByRole('link', { name: /Create a stream/ })
      expect(link).toHaveAttribute('href', '/app/create')
    })
  })

  describe('Footer', () => {
    it('renders footer with brand', () => {
      render(<Footer />)
      // Brand component renders a logo/text, check for footer structure
      const footer = screen.getByRole('contentinfo')
      expect(footer).toBeInTheDocument()
    })

    it('renders footer description', () => {
      render(<Footer />)
      expect(screen.getByText(/FlowStar streams tokens on Stellar/)).toBeInTheDocument()
    })
  })
})
