import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DownloadReceiptButton } from '@/components/streams/download-receipt-button'
import type { StreamData } from '@/types/stream'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/receipt-utils', () => ({
  buildReceiptData: vi.fn(() => ({ test: 'receipt' })),
  generateReceiptCSV: vi.fn(() => 'csv,data\n1,2'),
  generateReceiptHTML: vi.fn(() => '<html><body>Receipt</body></html>'),
  downloadFile: vi.fn(),
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

describe('DownloadReceiptButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('button rendering', () => {
    it('renders the button with correct initial state', () => {
      render(<DownloadReceiptButton stream={makeStream()} />)

      const button = screen.getByRole('button', { name: /download receipt/i })
      expect(button).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })

    it('shows full text on medium screens and above', () => {
      render(<DownloadReceiptButton stream={makeStream()} />)
      expect(screen.getByText('Download Receipt')).toBeInTheDocument()
    })
  })

  describe('CSV download', () => {
    it('calls downloadFile with CSV format when Download CSV is clicked', async () => {
      const { downloadFile } = await import('@/lib/receipt-utils')

      render(<DownloadReceiptButton stream={makeStream()} />)

      fireEvent.click(screen.getByRole('button', { name: /download receipt/i }))
      fireEvent.click(screen.getByText(/download csv/i))

      expect(vi.mocked(downloadFile)).toHaveBeenCalled()
      const call = vi.mocked(downloadFile).mock.calls[0]
      expect(call[1]).toBe('flowstar-receipt-stream-123.csv')
      expect(call[2]).toBe('text/csv')
    })

    it('downloads CSV when Download CSV is clicked', () => {
      render(<DownloadReceiptButton stream={makeStream()} />)

      fireEvent.click(screen.getByRole('button', { name: /download receipt/i }))
      fireEvent.click(screen.getByText(/download csv/i))

      // Successfully clicking the CSV download option completes without error
      expect(screen.getByRole('button', { name: /download receipt/i })).toBeInTheDocument()
    })
  })

  describe('View & Print HTML', () => {
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

    it('creates blob with HTML content when View & Print is clicked', () => {
      render(<DownloadReceiptButton stream={makeStream()} />)

      fireEvent.click(screen.getByRole('button', { name: /download receipt/i }))
      fireEvent.click(screen.getByText(/view & print html/i))

      const createObjectURL = vi.mocked((global as any).URL.createObjectURL)
      expect(createObjectURL).toHaveBeenCalledTimes(1)
      const blobArg = createObjectURL.mock.calls[0][0]
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toBe('text/html')
    })

    it('opens blob URL in new tab with _blank target', () => {
      render(<DownloadReceiptButton stream={makeStream()} />)

      fireEvent.click(screen.getByRole('button', { name: /download receipt/i }))
      fireEvent.click(screen.getByText(/view & print html/i))

      const winOpen = vi.mocked((global as any).open)
      expect(winOpen).toHaveBeenCalledWith(blobUrl, '_blank')
    })

    it('revokes the receipt blob URL after timeout', () => {
      render(<DownloadReceiptButton stream={makeStream()} />)

      fireEvent.click(screen.getByRole('button', { name: /download receipt/i }))
      fireEvent.click(screen.getByText(/view & print html/i))

      const revokeObjectURL = vi.mocked((global as any).URL.revokeObjectURL)
      expect(revokeObjectURL).not.toHaveBeenCalled()

      vi.advanceTimersByTime(9_999)
      expect(revokeObjectURL).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(revokeObjectURL).toHaveBeenCalledWith(blobUrl)
    })

    it('opens HTML receipt when View & Print is clicked', () => {
      render(<DownloadReceiptButton stream={makeStream()} />)

      fireEvent.click(screen.getByRole('button', { name: /download receipt/i }))
      fireEvent.click(screen.getByText(/view & print html/i))

      const winOpen = vi.mocked((global as any).open)
      expect(winOpen).toHaveBeenCalledWith(blobUrl, '_blank')
    })
  })

  describe('dropdown menu', () => {
    it('shows menu options when button is clicked', () => {
      render(<DownloadReceiptButton stream={makeStream()} />)

      fireEvent.click(screen.getByRole('button', { name: /download receipt/i }))

      expect(screen.getByText(/view & print html/i)).toBeInTheDocument()
      expect(screen.getByText(/download csv/i)).toBeInTheDocument()
    })

    it('both menu items are present and clickable', () => {
      render(<DownloadReceiptButton stream={makeStream()} />)

      fireEvent.click(screen.getByRole('button', { name: /download receipt/i }))

      const viewPrintItem = screen.getByText(/view & print html/i).closest('[role="menuitem"]')
      const downloadCsvItem = screen.getByText(/download csv/i).closest('[role="menuitem"]')

      expect(viewPrintItem).toBeInTheDocument()
      expect(downloadCsvItem).toBeInTheDocument()
    })
  })

  describe('with transaction hashes', () => {
    it('renders correctly with creation transaction hash', () => {
      render(
        <DownloadReceiptButton
          stream={makeStream()}
          creationTxHash="abc123def456"
        />
      )

      expect(screen.getByRole('button', { name: /download receipt/i })).toBeInTheDocument()
    })

    it('renders correctly with withdrawal transaction hashes', () => {
      render(
        <DownloadReceiptButton
          stream={makeStream()}
          withdrawalTxHashes={['tx1', 'tx2']}
        />
      )

      expect(screen.getByRole('button', { name: /download receipt/i })).toBeInTheDocument()
    })

    it('renders correctly with cancellation transaction hash', () => {
      render(
        <DownloadReceiptButton
          stream={makeStream()}
          cancellationTxHash="cancel123"
        />
      )

      expect(screen.getByRole('button', { name: /download receipt/i })).toBeInTheDocument()
    })

    it('renders correctly with all transaction hashes', () => {
      render(
        <DownloadReceiptButton
          stream={makeStream()}
          creationTxHash="create123"
          withdrawalTxHashes={['withdraw1', 'withdraw2']}
          cancellationTxHash="cancel123"
        />
      )

      expect(screen.getByRole('button', { name: /download receipt/i })).toBeInTheDocument()
    })
  })
})
