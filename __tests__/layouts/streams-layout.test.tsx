import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import StreamsLayout from '@/app/app/streams/layout'

describe('StreamsLayout', () => {
  it('renders children exactly once', () => {
    const html = renderToStaticMarkup(
      <StreamsLayout>
        <span data-layout-child>child</span>
      </StreamsLayout>,
    )

    expect(html.match(/data-layout-child/g)).toHaveLength(1)
  })
})
