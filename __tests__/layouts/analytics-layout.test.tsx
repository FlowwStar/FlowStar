import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AnalyticsLayout from '@/app/app/analytics/layout'

describe('AnalyticsLayout', () => {
  it('renders children exactly once', () => {
    const html = renderToStaticMarkup(
      <AnalyticsLayout>
        <span data-layout-child>child</span>
      </AnalyticsLayout>,
    )

    expect(html.match(/data-layout-child/g)).toHaveLength(1)
  })
})
