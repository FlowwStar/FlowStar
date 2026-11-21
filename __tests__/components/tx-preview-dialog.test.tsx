import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TxPreviewDialog } from '@/components/ui/tx-preview-dialog'
import type { CreateStreamInput } from '@/types/stream'

const simulatePreview = vi.hoisted(() => vi.fn())
vi.mock('@/lib/contract', () => ({ simulateCreateStreamPreview: simulatePreview }))

const input: CreateStreamInput = {
  recipient: 'GRECIPIENT222',
  token: { address: 'CUSDC', symbol: 'USDC', decimals: 6 },
  totalAmount: 1_000_000n,
  startTime: 1_700_000_000n,
  endTime: 1_700_086_400n,
  cliffTime: 1_700_000_000n,
  cliffAmount: 0n,
}

function renderDialog(pending = false) {
  return render(
    <TxPreviewDialog
      open
      input={input}
      network="testnet"
      sender="GSENDER111"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      pending={pending}
    />,
  )
}

describe('TxPreviewDialog', () => {
  it('shows the simulating state and disables confirmation', () => {
    simulatePreview.mockReturnValue(new Promise(() => {}))
    renderDialog()

    expect(screen.getByText('Simulating transaction…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simulating…' })).toBeDisabled()
  })

  it('shows a successful simulation and enables confirmation', async () => {
    simulatePreview.mockResolvedValue({
      success: true,
      estimatedFeeXlm: '0.0115',
      estimatedFeeUsd: '~$0.001',
      cpuInstructions: 42_000,
      memoryBytes: 128,
    })
    renderDialog()

    await waitFor(() => expect(screen.getByText('Simulation succeeded')).toBeInTheDocument())
    expect(screen.getByText('0.0115 XLM (~$0.001)')).toBeInTheDocument()
    expect(screen.getByText('42,000')).toBeInTheDocument()
    expect(screen.getByText('128 bytes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirm & Sign/ })).toBeEnabled()
  })

  it('shows a failed simulation and disables confirmation', async () => {
    simulatePreview.mockResolvedValue({
      success: false,
      estimatedFeeXlm: '0',
      estimatedFeeUsd: '$0',
      cpuInstructions: 0,
      memoryBytes: 0,
      errorMessage: 'Insufficient balance',
    })
    renderDialog()

    await waitFor(() => expect(screen.getByText('Simulation failed')).toBeInTheDocument())
    expect(screen.getByText('Insufficient balance')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirm & Sign/ })).toBeDisabled()
  })

  it.each([true])('disables confirmation while pending', async (pending) => {
    simulatePreview.mockResolvedValue({
      success: true,
      estimatedFeeXlm: '0.0115',
      estimatedFeeUsd: '~$0.001',
      cpuInstructions: 42_000,
      memoryBytes: 128,
    })
    renderDialog(pending)

    await act(async () => {})
    await waitFor(() => expect(screen.getByText('Simulation succeeded')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Signing/ })).toBeDisabled()
  })

  it('allows the dialog to close through cancel', () => {
    const onCancel = vi.fn()
    render(
      <TxPreviewDialog
        open
        input={null}
        network="testnet"
        sender="GSENDER111"
        onConfirm={vi.fn()}
        onCancel={onCancel}
        pending={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
