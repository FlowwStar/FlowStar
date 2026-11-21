import type { Metadata } from 'next'
import { LandingHeader, Hero } from '@/components/landing/hero'

export const metadata: Metadata = {
  title: 'FlowStar — Stream tokens by the second on Stellar',
  description:
    'Stream tokens by the second on Stellar. Create vesting schedules, payroll, and grants that unlock continuously — withdraw anytime, cancel anytime.',
}
import {
  Features,
  HowItWorks,
  UseCases,
  CTA,
  Footer,
} from '@/components/landing/sections'

export default function LandingPage() {
  return (
    <div className="relative min-h-svh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium focus:outline-none"
      >
        Skip to content
      </a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Hero />
        <Features />
        <HowItWorks />
        <UseCases />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
