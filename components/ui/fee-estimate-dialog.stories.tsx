import type { Meta, StoryObj } from '@storybook/react'
import { FeeEstimateDialog, type FeeBreakdown } from './fee-estimate-dialog'

const meta = {
  title: 'UI/FeeEstimateDialog',
  component: FeeEstimateDialog,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof FeeEstimateDialog>

export default meta
type Story = StoryObj<typeof meta>

const normalFees: FeeBreakdown = {
  minFee: 50_000,
  bufferFee: 7_500,
  totalEstimated: 57_500,
  estimatedUsd: 0.007,
}

const highFees: FeeBreakdown = {
  minFee: 500_000,
  bufferFee: 75_000,
  totalEstimated: 575_000,
  estimatedUsd: 0.07,
}

const actions = {
  onConfirm: () => undefined,
  onCancel: () => undefined,
}

export const NormalFee: Story = {
  args: {
    ...actions,
    open: true,
    fees: normalFees,
    action: 'create stream',
    averageFee: 100_000,
  },
}

export const HighFeeWarning: Story = {
  args: {
    ...actions,
    open: true,
    fees: highFees,
    action: 'withdraw funds',
    averageFee: 100_000,
    isHighFee: true,
  },
}

export const Loading: Story = {
  args: {
    ...actions,
    open: true,
    fees: normalFees,
    action: 'create stream',
    loading: true,
  },
}
