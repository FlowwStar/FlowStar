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
vi.mock('@/lib/stellar', () => ({
  getAllTokens: () => [{ address: 'CNATIVE', symbol: 'XLM', decimals: 7 }],
  saveCustomToken: vi.fn(),
  checkAccountInfo: vi.fn().mockResolvedValue({ exists: true, funded: true, transactionCount: 1 }),
}))

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

// ─── Heavy UI components (not under test here) ────────────────────────────────
vi.mock('@/components/streams/stream-preview', () => ({
  StreamPreview: () => null,
}))

vi.mock('@/components/streams/create-confirmation', () => ({
  CreateConfirmation: () => null,
}))

vi.mock('@/components/streams/stream-templates', () => ({
  StreamTemplates: () => null,
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
describe('CreateForm — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

      // No amount error should be present
      expect(screen.queryByText('Enter a valid amount greater than 0')).not.toBeInTheDocument()
    })
  })

  describe('cliff amount exceeds total amount', () => {
    it('shows cliff-exceeds-total error when cliff amount > total amount', async () => {
      render(<CreateForm />)

      // Set a valid recipient
      fireEvent.change(screen.getByPlaceholderText(/GABC/i), {
        target: { value: VALID_ADDRESS },
      })

      // Set total amount
      fireEvent.change(screen.getByLabelText(/total amount/i), {
        target: { value: '100' },
      })

      // Enable cliff via checkbox
      fireEvent.click(screen.getByLabelText(/add a cliff/i))

      // Set cliff amount higher than total
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
