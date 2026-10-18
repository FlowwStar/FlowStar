/**
 * Page-level component tests for app/app/create/batch/page.tsx  (#768)
 *
 * Strategy
 * ─────────
 * BatchCreatePage is a self-contained page that orchestrates a three-step
 * flow: CSV upload → preview table → execute batch. We test the composition
 * at the component level — faster feedback than e2e for the core logic.
 *
 * Three main scenarios are covered:
 *   1. Wallet gate — shows the connect prompt when the wallet is disconnected.
 *   2. CSV → preview — uploading a mock CSV renders the preview table with
 *      the parsed rows.
 *   3. Execute batch — clicking "Execute batch" calls the `createStreamsBatch`
 *      hook with the correct arguments and shows a success toast.
 *
 * Mocked boundaries
 * ─────────────────
 * • useWallet           — controls connected/disconnected state
 * • useContract         — provides createStreamsBatch + pending + error
 * • useNetwork          — returns testnet config with a known token list
 * • ConnectWalletButton — thin stub (no wallet provider required)
 * • next/link           — thin <a> stub (no Next.js router required)
 * • sonner toast        — spy so we can assert toast calls
 * • lib/export          — stub downloadCSV (avoids DOM blob APIs)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import BatchCreatePage from '@/app/app/create/batch/page'

// ─── jsdom polyfill: File.prototype.text ──────────────────────────────────────
// jsdom doesn't implement the `text()` method on File/Blob. The batch page
// calls `await file.text()` inside `loadCsv`. We polyfill it so tests work.
if (!File.prototype.text) {
  File.prototype.text = function () {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(this)
    })
  }
}

// ─── Static test data ─────────────────────────────────────────────────────────

/** Valid Stellar G-addresses for test rows */
const RECIPIENT_A = 'GBWEDYWFGPNPAWCYOKWMCRPTR4IMV4SNZ7CVOZHPUXGHVXXPJSCFKVXQ'
const RECIPIENT_B = 'GAOX4FK7CC443IEAF6ADXCRQDYWDAD5SLNIVR5CS7GFJYRCRZWLGX7FW'

/** Unix timestamps well in the future so end > start */
const START_TS = String(Math.floor(Date.now() / 1000) + 100)
const END_TS = String(Math.floor(Date.now() / 1000) + 100 + 30 * 24 * 3600)

/** A minimal valid CSV with two rows */
const VALID_CSV = [
  'recipient,amount,start_time,end_time',
  `${RECIPIENT_A},100,${START_TS},${END_TS}`,
  `${RECIPIENT_B},200,${START_TS},${END_TS}`,
].join('\n')

/** CSV with one invalid and one valid row */
const MIXED_CSV = [
  'recipient,amount,start_time,end_time',
  `not-a-valid-address,100,${START_TS},${END_TS}`,
  `${RECIPIENT_A},200,${START_TS},${END_TS}`,
].join('\n')

// ─── Mock: useWallet ──────────────────────────────────────────────────────────

const mockUseWallet = vi.fn()

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: () => mockUseWallet(),
}))

// ─── Mock: useContract ───────────────────────────────────────────────────────

const mockCreateStreamsBatch = vi.fn()

vi.mock('@/hooks/use-contract', () => ({
  useContract: () => ({
    createStreamsBatch: mockCreateStreamsBatch,
    pending: false,
    error: null,
  }),
}))

// ─── Mock: useNetwork ────────────────────────────────────────────────────────

vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => ({
    config: {
      knownTokens: [
        {
          address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
          symbol: 'XLM',
          decimals: 7,
        },
      ],
    },
  }),
}))

// ─── Mock: ConnectWalletButton ───────────────────────────────────────────────

vi.mock('@/components/layout/connect-wallet-button', () => ({
  ConnectWalletButton: () => <button data-testid="connect-btn">Connect wallet</button>,
}))

// ─── Mock: next/link ─────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// ─── Mock: sonner ────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

// ─── Mock: lib/export (downloadCSV uses DOM Blob APIs not available in jsdom) ─

vi.mock('@/lib/export', () => ({
  downloadCSV: vi.fn(),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate uploading a CSV string as a File through the file input. */
async function uploadCsv(csvContent: string, fileName = 'batch.csv') {
  const file = new File([csvContent], fileName, { type: 'text/csv' })
  const input = screen.getByLabelText(/csv file/i)
  await userEvent.upload(input, file)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BatchCreatePage — page-level composition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Wallet gate ─────────────────────────────────────────────────────────────

  describe('wallet gate', () => {
    it('shows the connect prompt when wallet is disconnected', () => {
      mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: false })

      render(<BatchCreatePage />)

      expect(screen.getByText('Connect your wallet')).toBeInTheDocument()
      expect(screen.getByTestId('connect-btn')).toBeInTheDocument()
    })

    it('renders nothing while reconnecting', () => {
      mockUseWallet.mockReturnValue({ isConnected: false, reconnecting: true })

      const { container } = render(<BatchCreatePage />)

      expect(container).toBeEmptyDOMElement()
    })

    it('renders the batch form when wallet is connected', () => {
      mockUseWallet.mockReturnValue({ isConnected: true, reconnecting: false })

      render(<BatchCreatePage />)

      expect(screen.getByText(/batch create streams/i)).toBeInTheDocument()
    })
  })

  // ── CSV upload → preview ────────────────────────────────────────────────────

  describe('CSV upload → preview table', () => {
    beforeEach(() => {
      mockUseWallet.mockReturnValue({ isConnected: true, reconnecting: false })
    })

    it('shows the preview table after uploading a valid CSV', async () => {
      render(<BatchCreatePage />)
      await uploadCsv(VALID_CSV)

      await waitFor(() => {
        expect(screen.getByText(/preview rows/i)).toBeInTheDocument()
      })
    })

    it('renders a row for each CSV data row', async () => {
      render(<BatchCreatePage />)
      await uploadCsv(VALID_CSV)

      await waitFor(() => {
        // Two data rows should appear in the table
        expect(screen.getByText(RECIPIENT_A)).toBeInTheDocument()
        expect(screen.getByText(RECIPIENT_B)).toBeInTheDocument()
      })
    })

    it('marks valid rows with "Valid" status', async () => {
      render(<BatchCreatePage />)
      await uploadCsv(VALID_CSV)

      await waitFor(() => {
        const validBadges = screen.getAllByText('Valid')
        expect(validBadges.length).toBe(2)
      })
    })

    it('marks invalid rows with an error status', async () => {
      render(<BatchCreatePage />)
      await uploadCsv(MIXED_CSV)

      await waitFor(() => {
        // One row is invalid (bad address), one is valid
        expect(screen.getByText('Invalid recipient address')).toBeInTheDocument()
        expect(screen.getByText('Valid')).toBeInTheDocument()
      })
    })

    it('shows a checksum-specific error for a near-miss recipient address (issue #143)', async () => {
      // Same length/prefix/alphabet as a real G-address, but not
      // checksum-valid — e.g. a single mistyped character.
      const nearMissAddress = 'G' + 'A'.repeat(55)
      const checksumCsv = [
        'recipient,amount,start_time,end_time',
        `${nearMissAddress},100,${START_TS},${END_TS}`,
      ].join('\n')

      render(<BatchCreatePage />)
      await uploadCsv(checksumCsv)

      await waitFor(() => {
        expect(
          screen.getByText('Invalid recipient address checksum — check for a mistyped character'),
        ).toBeInTheDocument()
      })
    })

    it('shows an upload error for non-CSV files', async () => {
      render(<BatchCreatePage />)

      const file = new File(['data'], 'batch.txt', { type: 'text/plain' })
      const input = screen.getByLabelText(/csv file/i)
      // Use fireEvent so the onChange fires even for a type not matching `accept`
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText(/please upload a \.csv file/i)).toBeInTheDocument()
      })
    })

    it('shows the token and row count metadata in the preview', async () => {
      render(<BatchCreatePage />)
      await uploadCsv(VALID_CSV)

      await waitFor(() => {
        expect(screen.getByText(/token: xlm/i)).toBeInTheDocument()
        expect(screen.getByText(/rows: 2/i)).toBeInTheDocument()
        expect(screen.getByText(/valid: 2/i)).toBeInTheDocument()
      })
    })
  })

  // ── Execute batch ───────────────────────────────────────────────────────────

  describe('Execute batch', () => {
    beforeEach(() => {
      mockUseWallet.mockReturnValue({ isConnected: true, reconnecting: false })
      mockCreateStreamsBatch.mockResolvedValue(['stream-id-1', 'stream-id-2'])
    })

    it('calls createStreamsBatch with the correct number of valid rows', async () => {
      render(<BatchCreatePage />)
      await uploadCsv(VALID_CSV)

      await waitFor(() => screen.getByText(/preview rows/i))

      fireEvent.click(screen.getByRole('button', { name: /execute batch/i }))

      await waitFor(() => {
        expect(mockCreateStreamsBatch).toHaveBeenCalledTimes(1)
        const [inputs] = mockCreateStreamsBatch.mock.calls[0]
        expect(inputs).toHaveLength(2)
      })
    })

    it('passes the correct recipient addresses to createStreamsBatch', async () => {
      render(<BatchCreatePage />)
      await uploadCsv(VALID_CSV)

      await waitFor(() => screen.getByText(/preview rows/i))

      fireEvent.click(screen.getByRole('button', { name: /execute batch/i }))

      await waitFor(() => {
        const [inputs] = mockCreateStreamsBatch.mock.calls[0]
        const recipients = inputs.map((r: { recipient: string }) => r.recipient)
        expect(recipients).toContain(RECIPIENT_A)
        expect(recipients).toContain(RECIPIENT_B)
      })
    })

    it('shows a success toast after batch executes', async () => {
      render(<BatchCreatePage />)
      await uploadCsv(VALID_CSV)

      await waitFor(() => screen.getByText(/preview rows/i))

      fireEvent.click(screen.getByRole('button', { name: /execute batch/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled()
      })
    })

    it('shows an error toast when createStreamsBatch rejects', async () => {
      mockCreateStreamsBatch.mockRejectedValue(new Error('Simulated contract failure'))

      render(<BatchCreatePage />)
      await uploadCsv(VALID_CSV)

      await waitFor(() => screen.getByText(/preview rows/i))

      fireEvent.click(screen.getByRole('button', { name: /execute batch/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })

    it('only submits valid rows — skips invalid ones', async () => {
      render(<BatchCreatePage />)
      await uploadCsv(MIXED_CSV)

      await waitFor(() => screen.getByText(/preview rows/i))

      fireEvent.click(screen.getByRole('button', { name: /execute batch/i }))

      await waitFor(() => {
        expect(mockCreateStreamsBatch).toHaveBeenCalledTimes(1)
        const [inputs] = mockCreateStreamsBatch.mock.calls[0]
        // Only 1 row is valid (RECIPIENT_A row has bad address)
        expect(inputs).toHaveLength(1)
        expect(inputs[0].recipient).toBe(RECIPIENT_A)
      })
    })

    it('disables the Execute batch button when no valid rows are present', async () => {
      render(<BatchCreatePage />)

      // CSV with only invalid rows
      const allInvalidCsv = [
        'recipient,amount,start_time,end_time',
        `bad-address,100,${START_TS},${END_TS}`,
      ].join('\n')
      await uploadCsv(allInvalidCsv)

      await waitFor(() => screen.getByText(/preview rows/i))

      const executeBtn = screen.getByRole('button', { name: /execute batch/i })
      expect(executeBtn).toBeDisabled()
    })
  })
})
