import type { Meta, StoryObj } from "@storybook/react"
import { FeeEstimateDialog } from "./fee-estimate-dialog"
import { Button } from "./button"
import React from "react"

const meta = {
  title: "UI/FeeEstimateDialog",
  component: FeeEstimateDialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FeeEstimateDialog>

export default meta
type Story = StoryObj<typeof meta>

// Normal fee estimate (no warning)
export const NormalFee: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false)

    return (
      <>
        <Button onClick={() => setOpen(true)}>View Fee Estimate</Button>
        <FeeEstimateDialog
          open={open}
          onOpenChange={setOpen}
          estimatedFee="0.50"
          estimatedFeeUsd="0.50"
          networkFee="0.10"
          protocolFee="0.40"
          totalAmount="100.00"
          isHighFeeWarning={false}
        />
      </>
    )
  },
}

// High fee warning state
export const HighFeeWarning: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false)

    return (
      <>
        <Button onClick={() => setOpen(true)} variant="destructive">
          View Fee Estimate (High Fee)
        </Button>
        <FeeEstimateDialog
          open={open}
          onOpenChange={setOpen}
          estimatedFee="15.00"
          estimatedFeeUsd="15.00"
          networkFee="10.00"
          protocolFee="5.00"
          totalAmount="100.00"
          isHighFeeWarning={true}
        />
      </>
    )
  },
}

// Large transaction with normal fees
export const LargeTransaction: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false)

    return (
      <>
        <Button onClick={() => setOpen(true)}>View Fee Estimate</Button>
        <FeeEstimateDialog
          open={open}
          onOpenChange={setOpen}
          estimatedFee="5.25"
          estimatedFeeUsd="5.25"
          networkFee="1.00"
          protocolFee="4.25"
          totalAmount="10000.00"
          isHighFeeWarning={false}
        />
      </>
    )
  },
}

// Small transaction with high relative fees
export const SmallTransactionHighFeeRatio: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false)

    return (
      <>
        <Button onClick={() => setOpen(true)} variant="destructive">
          View Fee Estimate
        </Button>
        <FeeEstimateDialog
          open={open}
          onOpenChange={setOpen}
          estimatedFee="8.50"
          estimatedFeeUsd="8.50"
          networkFee="5.00"
          protocolFee="3.50"
          totalAmount="10.00"
          isHighFeeWarning={true}
        />
      </>
    )
  },
}

// Very high fees scenario
export const VeryHighFees: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false)

    return (
      <>
        <Button onClick={() => setOpen(true)} variant="destructive">
          View Fee Estimate (Very High)
        </Button>
        <FeeEstimateDialog
          open={open}
          onOpenChange={setOpen}
          estimatedFee="250.00"
          estimatedFeeUsd="250.00"
          networkFee="200.00"
          protocolFee="50.00"
          totalAmount="1000.00"
          isHighFeeWarning={true}
        />
      </>
    )
  },
}

// Minimal fees
export const MinimalFees: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false)

    return (
      <>
        <Button onClick={() => setOpen(true)}>View Fee Estimate</Button>
        <FeeEstimateDialog
          open={open}
          onOpenChange={setOpen}
          estimatedFee="0.01"
          estimatedFeeUsd="0.01"
          networkFee="0.005"
          protocolFee="0.005"
          totalAmount="100.00"
          isHighFeeWarning={false}
        />
      </>
    )
  },
}

// Comparison: Normal vs High Fee Side by Side (in separate components)
export const StateComparison: Story = {
  render: () => {
    const [normalOpen, setNormalOpen] = React.useState(false)
    const [highOpen, setHighOpen] = React.useState(false)

    return (
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="font-semibold">Normal Fee</h3>
          <Button onClick={() => setNormalOpen(true)} className="w-full">
            View Estimate
          </Button>
          <FeeEstimateDialog
            open={normalOpen}
            onOpenChange={setNormalOpen}
            estimatedFee="0.50"
            estimatedFeeUsd="0.50"
            networkFee="0.10"
            protocolFee="0.40"
            totalAmount="100.00"
            isHighFeeWarning={false}
          />
        </div>
        <div className="space-y-4">
          <h3 className="font-semibold">High Fee Warning</h3>
          <Button onClick={() => setHighOpen(true)} className="w-full" variant="destructive">
            View Estimate
          </Button>
          <FeeEstimateDialog
            open={highOpen}
            onOpenChange={setHighOpen}
            estimatedFee="25.00"
            estimatedFeeUsd="25.00"
            networkFee="20.00"
            protocolFee="5.00"
            totalAmount="100.00"
            isHighFeeWarning={true}
          />
        </div>
      </div>
    )
  },
}
