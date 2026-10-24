import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateForm } from '@/app/app/create/create-form'

// ─── Next.js navigation ───────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

// ─── Wallet / contract hooks ──────────────────────────────────────────────────
vi.mock('@/hooks/use-wallet', () => ({
  useWallet: () => ({ address: 'GSENDERTEST111111111111111111111111111111111111' }),
}))

vi.mock('@/hooks/use-contract', () => ({
  useContract: () => ({
    createStream: vi.fn(),
    estimateFee: vi.fn(),
    pending: false,
    error: null,
  }),
}))

vi.mock('@/hooks/use-token-price', () => ({
  useTokenPrice: () => ({ usdPrice: null, stale: false, loading: false }),
}))

vi.mock('@/hooks/use-form-draft', () => ({
  useFormDraft: () => ({ loadDraft: () => null, restore: vi.fn(), discard: vi.fn() }),
  clearExpiredDrafts: vi.fn(),
}))

// ─── Stellar / contract lib ───────────────────────────────────────────────────
vi.mock('@/lib/stellar', async () => {
  const { StrKey } = await import('@stellar/stellar-sdk')
  const ED25519_SHAPE_RE = /^G[A-Z2-7]{55}$/
  return {
    getAllTokens: () => [{ address: 'CNATIVE', symbol: 'XLM', decimals: 7 }],
    saveCustomToken: vi.fn(),
    checkAccountInfo: vi
      .fn()
      .mockResolvedValue({ exists: true, funded: true, transactionCount: 1 }),
    validateStellarAddress: (address: string) => {
      const trimmed = address.trim()
      if (StrKey.isValidEd25519PublicKey(trimmed)) return { valid: true }
      if (ED25519_SHAPE_RE.test(trimmed)) return { valid: false, reason: 'checksum' }
      return { valid: false, reason: 'format' }
    },
  }
})

vi.mock('@/lib/contract', () => ({
  getTokenMetadata: vi.fn(),
  getTokenBalance: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/federation', () => ({
  isFederationAddress: () => false,
  resolveFederationAddress: vi.fn(),
}))

vi.mock('@/lib/address-book', () => ({
  addAddressBookEntry: vi.fn(),
  deleteAddressBookEntry: vi.fn(),
  getAddressBookEntries: () => [],
  touchAddressBookEntry: vi.fn(),
  updateAddressBookEntry: vi.fn(),
}))

vi.mock('@/lib/recurring', () => ({
  buildNextRunAt: vi.fn(),
  saveRecurringRule: vi.fn(),
}))

// ─── Network provider ─────────────────────────────────────────────────────────
vi.mock('@/components/providers/network-provider', () => ({
  useNetwork: () => ({ network: 'testnet' }),
}))

// ─── Heavy UI components ──────────────────────────────────────────────────────
vi.mock('@/components/streams/stream-preview', () => ({
  StreamPreview: () => null,
}))

vi.mock('@/components/streams/create-confirmation', () => ({
  CreateConfirmation: () => null,
}))

vi.mock('@/components/streams/stream-templates', () => ({
  StreamTemplates: ({ onSelect }: { onSelect: (template: any) => void }) => (
    <button
      type="button"
      data-testid="mock-apply-template"
      onClick={() =>
        onSelect({
          id: 'vesting-standard',
          label: 'Vesting Standard',
          cliffPercent: 25,
          cliffSeconds: 3600,
          durationSeconds: 14400,
        })
      }
    >
      Apply Vesting Template
    </button>
  ),
}))

vi.mock('@/components/ui/tx-preview-dialog', () => ({
  TxPreviewDialog: () => null,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────
const VALID_ADDRESS = 'GBWEDYWFGPNPAWCYOKWMCRPTR4IMV4SNZ7CVOZHPUXGHVXXPJSCFKVXQ'

function submitForm() {
  const btn = screen.getByRole('button', { name: /create stream/i })
  fireEvent.click(btn)
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('CreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('template cliff calculation (Issue #1029)', () => {
    it('preserves decimals for fractional amounts when applying a template with cliffPercent', async () => {
      render(<CreateForm />)

      // Enter a fractional amount (10.5)
      const amountInput = screen.getByLabelText(/total amount/i)
      fireEvent.change(amountInput, { target: { value: '10.5' } })

      // Apply template with 25% cliff
      fireEvent.click(screen.getByTestId('mock-apply-template'))

      // 10.5 * 25% = 2.625 (previously Math.floor dropped decimals and gave '2')
      await waitFor(() => {
        expect(screen.getByLabelText(/cliff amount/i)).toHaveValue(2.625)
      })
    })

    it('computes fractional cliff amount for small integer amounts under the threshold', async () => {
      render(<CreateForm />)

      // Enter amount 3 (3 * 25% = 0.75, previously Math.floor gave '0')
      const amountInput = screen.getByLabelText(/total amount/i)
      fireEvent.change(amountInput, { target: { value: '3' } })

      fireEvent.click(screen.getByTestId('mock-apply-template'))

      await waitFor(() => {
        expect(screen.getByLabelText(/cliff amount/i)).toHaveValue(0.75)
      })
    })
  })

  describe('required field validation', () => {
    it('shows recipient and amount errors when form is submitted empty', async () => {
      render(<CreateForm />)
      submitForm()

      await waitFor(() => {
        expect(screen.getByText('Invalid Stellar address format')).toBeInTheDocument()
        expect(screen.getByText('Enter a valid amount greater than 0')).toBeInTheDocument()
      })
    })
  })

  describe('invalid recipient address', () => {
    it('shows address-format error for a plainly invalid recipient', async () => {
      render(<CreateForm />)

      fireEvent.change(screen.getByPlaceholderText(/GABC/i), {
        target: { value: 'not-a-stellar-address' },
      })
      fireEvent.change(screen.getByLabelText(/total amount/i), {
        target: { value: '100' },
      })

      submitForm()

      await waitFor(() => {
        expect(screen.getByText('Invalid Stellar address format')).toBeInTheDocument()
      })

      expect(screen.queryByText('Enter a valid amount greater than 0')).not.toBeInTheDocument()
    })
  })

  describe('cliff amount exceeds total amount', () => {
    it('shows cliff-exceeds-total error when cliff amount > total amount', async () => {
      render(<CreateForm />)

      fireEvent.change(screen.getByPlaceholderText(/GABC/i), {
        target: { value: VALID_ADDRESS },
      })
      fireEvent.change(screen.getByLabelText(/total amount/i), {
        target: { value: '100' },
      })

      fireEvent.click(screen.getByLabelText(/add a cliff/i))

      await waitFor(() => {
        expect(screen.getByLabelText(/cliff amount/i)).toBeInTheDocument()
      })
      fireEvent.change(screen.getByLabelText(/cliff amount/i), {
        target: { value: '200' },
      })

      submitForm()

      await waitFor(() => {
        expect(screen.getByText('Cliff amount cannot exceed total amount')).toBeInTheDocument()
      })
    })
  })
})
