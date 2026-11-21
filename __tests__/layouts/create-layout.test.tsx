import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CreateLayout from '@/app/app/create/layout'

describe('CreateLayout', () => {
  it('renders children exactly once', () => {
    const html = renderToStaticMarkup(
      <CreateLayout>
        <span data-layout-child>child</span>
      </CreateLayout>,
    )

    expect(html.match(/data-layout-child/g)).toHaveLength(1)
  })
})
