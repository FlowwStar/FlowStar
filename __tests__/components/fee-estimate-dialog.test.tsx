import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FeeEstimateDialog } from '@/components/ui/fee-estimate-dialog'

const fees = {
  minFee: 50_000,
  bufferFee: 7_500,
  totalEstimated: 57_500,
  estimatedUsd: 0.0012,
}

describe('FeeEstimateDialog', () => {
  it('renders the total fee and fee breakdown', () => {
    render(
      <FeeEstimateDialog
        open
        fees={fees}
        action="creating a stream"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('0.0057500')).toBeInTheDocument()
    expect(screen.getByText('≈ $0.0012')).toBeInTheDocument()
    expect(screen.getByText('0.0050000 XLM')).toBeInTheDocument()
    expect(screen.getByText('0.0007500 XLM')).toBeInTheDocument()
    expect(screen.getByText('Base fee estimate')).toBeInTheDocument()
    expect(screen.getByText('Safety buffer (15%)')).toBeInTheDocument()
  })

  it('calls the cancel and confirm handlers', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <FeeEstimateDialog
        open
        fees={fees}
        action="creating a stream"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & pay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not render when closed', () => {
    render(
      <FeeEstimateDialog
        open={false}
        fees={fees}
        action="creating a stream"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
