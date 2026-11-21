import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import RootLayout from '@/app/layout'

vi.mock('@vercel/analytics/next', () => ({ Analytics: () => null }))
vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-geist-sans' }),
  Geist_Mono: () => ({ variable: '--font-geist-mono' }),
}))
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/providers/network-provider', () => ({
  NetworkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/providers/wallet-provider', () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('@/components/pwa/service-worker-register', () => ({
  ServiceWorkerRegister: () => null,
}))
vi.mock('@/components/pwa/install-prompt', () => ({ InstallPrompt: () => null }))

describe('RootLayout', () => {
  it('renders children exactly once', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <span data-layout-child>child</span>
      </RootLayout>,
    )

    expect(html.match(/data-layout-child/g)).toHaveLength(1)
  })
})
