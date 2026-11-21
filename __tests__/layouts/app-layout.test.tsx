import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import AppLayout from '@/app/app/layout'

vi.mock('@/components/layout/navbar', () => ({ Navbar: () => null }))
vi.mock('@/components/layout/breadcrumb', () => ({ Breadcrumb: () => null }))
vi.mock('@/components/layout/mock-mode-banner', () => ({ MockModeBanner: () => null }))
vi.mock('@/components/error-boundary/page-error-boundary', () => ({
  PageErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('AppLayout', () => {
  it('renders children exactly once', () => {
    const html = renderToStaticMarkup(
      <AppLayout>
        <span data-layout-child>child</span>
      </AppLayout>,
    )

    expect(html.match(/data-layout-child/g)).toHaveLength(1)
  })
})
