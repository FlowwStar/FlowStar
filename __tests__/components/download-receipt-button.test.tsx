import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DownloadReceiptButton } from '@/components/streams/download-receipt-button'
import type { StreamData } from '@/types/stream'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const TOKEN = { address: 'TADDR', symbol: 'USDC', decimals: 7 }

function makeStream(): StreamData {
  return {
    id: 'stream-123',
    sender: 'GSENDER123',
    recipient: 'GRECIPIENT456',
    token: TOKEN,
    depositedAmount: 1_000_000_000n,
    withdrawnAmount: 0n,
    startTime: 1000n,
    endTime: 2000n,
    cliffTime: 1000n,
    cliffAmount: 0n,
    amountPerSecond: 1_000_000n,
    linearAmount: 1_000_000_000n,
    duration: 1000n,
    cancelled: false,
  }
}

describe('DownloadReceiptButton openInBrowser', () => {
  const blobUrl = 'blob:http://localhost/receipt'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => blobUrl),
      revokeObjectURL: vi.fn(),
    })
    vi.stubGlobal('open', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('revokes the receipt blob URL after the new tab has had time to load', () => {
    render(<DownloadReceiptButton stream={makeStream()} />)

    fireEvent.click(screen.getByRole('button', { name: /download receipt/i }))
    fireEvent.click(screen.getByText(/view & print html/i))

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(window.open).toHaveBeenCalledWith(blobUrl, '_blank')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(9_999)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl)
  })
})
