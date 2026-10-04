import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QrShareDialog } from '@/components/streams/qr-share-dialog'
import type { StreamData } from '@/types/stream'

const { mockToastSuccess, mockWriteText } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockWriteText: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
  },
}))

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, ...props }: any) => (
    <svg data-testid="qr-svg" data-value={value} {...props} />
  ),
  QRCodeCanvas: ({ value, ...props }: any) => (
    <canvas data-testid="qr-canvas" data-value={value} {...props} />
  ),
}))

const STREAM_URL = 'https://flowstar.app/stream/stream-123'

function makeStream(overrides?: Partial<StreamData>): StreamData {
  return {
    id: 'stream-123',
    sender: 'GABC1111111111111111111111111111111111111111111111111111',
    recipient: 'GDEF2222222222222222222222222222222222222222222222222222',
    token: { address: 'CCUSDC', symbol: 'USDC', decimals: 7 },
    depositedAmount: 100_000_000n,
    withdrawnAmount: 0n,
    startTime: 1_700_000_000n,
    endTime: 1_700_500_000n,
    cliffTime: 1_700_000_100n,
    cliffAmount: 0n,
    amountPerSecond: 100n,
    linearAmount: 100_000_000n,
    duration: 600n,
    cancelled: false,
    metadata: { name: 'Q2 Salary', category: 'payroll', memo: 'memo' },
    ...overrides,
  }
}

describe('QrShareDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true,
    })
  })

  it('renders a QR code for the given stream URL', () => {
    render(
      <QrShareDialog
        open
        onOpenChange={vi.fn()}
        streamUrl={STREAM_URL}
        stream={makeStream()}
        status="streaming"
      />,
    )

    expect(screen.getByText('Share stream')).toBeInTheDocument()
    expect(screen.getByText(STREAM_URL)).toBeInTheDocument()

    // The dialog renders in a portal, so query the document rather than `container`.
    const qrSvg = screen.getByTestId('qr-svg')
    expect(qrSvg).toHaveAttribute('data-value', STREAM_URL)
    expect(screen.getByTestId('qr-canvas')).toHaveAttribute('data-value', STREAM_URL)
  })

  it('copies the stream URL and downloads the QR image when actions are triggered', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const toDataURLSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockImplementation(() => {
        return 'data:image/png;base64,abc123'
      })

    render(
      <QrShareDialog
        open
        onOpenChange={vi.fn()}
        streamUrl={STREAM_URL}
        stream={makeStream({ id: 'stream-456' })}
        status="scheduled"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /copy stream link/i }))
    expect(mockWriteText).toHaveBeenCalledWith(STREAM_URL)
    expect(mockToastSuccess).toHaveBeenCalledWith('Link copied to clipboard')

    fireEvent.click(screen.getByRole('button', { name: /download qr/i }))
    expect(toDataURLSpy).toHaveBeenCalledWith('image/png')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledWith('QR code downloaded')

    clickSpy.mockRestore()
    toDataURLSpy.mockRestore()
  })
})
