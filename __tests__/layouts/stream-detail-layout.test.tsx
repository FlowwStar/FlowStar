import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import StreamDetailLayout from '@/app/app/stream/[id]/layout'

vi.mock('@/app/app/stream/[id]/metadata', () => ({ generateMetadata: vi.fn() }))

describe('StreamDetailLayout', () => {
  it('renders children exactly once', () => {
    const html = renderToStaticMarkup(
      <StreamDetailLayout>
        <span data-layout-child>child</span>
      </StreamDetailLayout>,
    )

    expect(html.match(/data-layout-child/g)).toHaveLength(1)
  })
})
