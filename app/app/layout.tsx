import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/navbar'
import { MockModeBanner } from '@/components/layout/mock-mode-banner'
import { PageErrorBoundary } from '@/components/error-boundary/page-error-boundary'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage your active and historical token streams on Stellar.',
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <PageErrorBoundary>
      <div className="flex min-h-svh flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium focus:outline-none"
        >
          Skip to content
        </a>
        <Navbar />
        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10"
        >
          {children}
        </main>
        <MockModeBanner />
      </div>
    </PageErrorBoundary>
  )
}
