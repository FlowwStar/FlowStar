import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  imageResponse: vi.fn(),
  shortenAddress: vi.fn(),
  captureError: vi.fn(),
}))

vi.mock('@vercel/og', () => ({ ImageResponse: mocks.imageResponse }))
vi.mock('next/og', () => ({ ImageResponse: mocks.imageResponse }))
vi.mock('@/lib/stream-utils', () => ({ shortenAddress: mocks.shortenAddress }))
vi.mock('@/lib/sentry', () => ({ captureError: mocks.captureError }))

import { GET } from '@/app/api/og/route'

function requestFor(query: string): Request {
  return { url: `http://localhost/api/og?${query}` } as Request
}

describe('/api/og', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.imageResponse.mockImplementation(function (
      _element: unknown,
      init: { width: number; height: number },
    ) {
      return new Response('mock-image', {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'x-image-size': `${init.width}x${init.height}`,
        },
      })
    })
    mocks.shortenAddress.mockImplementation((value: string) => `short:${value.slice(0, 6)}`)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns an image response with the stream details', async () => {
    const response = await GET(
      requestFor(
        'streamId=stream-123&amount=42&symbol=XLM&sender=GSENDER111&recipient=GRECIPIENT222&status=active',
      ),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('x-image-size')).toBe('1200x630')
    expect(mocks.imageResponse).toHaveBeenCalledOnce()
    expect(mocks.imageResponse).toHaveBeenCalledWith(expect.anything(), {
      width: 1200,
      height: 630,
    })
    expect(mocks.shortenAddress).toHaveBeenCalledWith('GSENDER111')
    expect(mocks.shortenAddress).toHaveBeenCalledWith('GRECIPIENT222')
    expect(mocks.captureError).not.toHaveBeenCalled()

    render(mocks.imageResponse.mock.calls[0][0] as ReactElement)
    expect(screen.getByText('42 XLM')).toBeInTheDocument()
    expect(screen.getByText('short:GSENDE')).toBeInTheDocument()
    expect(screen.getByText('short:GRECIP')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('falls back gracefully and reports invalid stream ids', async () => {
    mocks.shortenAddress.mockImplementationOnce(() => {
      throw new Error('invalid stream id')
    })

    const response = await GET(requestFor('streamId=invalid&sender=INVALID'))

    expect(response.status).toBe(500)
    expect(await response.text()).toBe('Failed to generate OG image')
    expect(mocks.captureError).toHaveBeenCalledOnce()
    expect(mocks.captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'invalid stream id' }),
      { operation: 'og-image:generate' },
    )
    expect(mocks.imageResponse).not.toHaveBeenCalled()
  })
})
