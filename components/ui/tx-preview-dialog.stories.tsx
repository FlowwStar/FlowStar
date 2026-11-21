import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { TxPreviewDialog } from '@/components/ui/tx-preview-dialog'
import { Button } from '@/components/ui/button'
import type { CreateStreamInput } from '@/types/stream'

const meta: Meta<typeof TxPreviewDialog> = {
  title: 'UI/TxPreviewDialog',
  component: TxPreviewDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof meta>

const now = BigInt(Math.floor(Date.now() / 1000))

const mockInput: CreateStreamInput = {
  recipient: 'GDZSTFXVCDTUJ76ZAV2HA72KYRMF5QJMJBFPMJDHKHXU4LBKCZW75J2Z',
  token: {
    address: 'CBBT7UGKPGP7EOUDJYVWGXQKD4CWPVD54PH43D5F7WAJT3XJVJ2XPMA',
    symbol: 'USDC',
    decimals: 6,
  },
  totalAmount: 1000000000n, // 1000 USDC
  startTime: now,
  endTime: now + 86400n * 30n, // 30 days
  cliffTime: now,
  cliffAmount: 0n,
}

function DialogTrigger() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const handleConfirm = () => {
    setPending(true)
    setTimeout(() => {
      setPending(false)
      setOpen(false)
    }, 2000)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Transaction Preview</Button>
      <TxPreviewDialog
        open={open}
        input={mockInput}
        network="testnet"
        sender="GBZXVUKUU3YQZRYOFQHP53BQXW5X5O4MHVK2D7MKQZH7VH6HMQQXOXM"
        operationLabel="Create 30-day Stream"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
        pending={pending}
      />
    </>
  )
}

export const Default: Story = {
  render: () => <DialogTrigger />,
}

function SimulatingState() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Simulating Dialog</Button>
      <TxPreviewDialog
        open={open}
        input={mockInput}
        network="testnet"
        sender="GBZXVUKUU3YQZRYOFQHP53BQXW5X5O4MHVK2D7MKQZH7VH6HMQQXOXM"
        operationLabel="Create 30-day Stream"
        onConfirm={() => {}}
        onCancel={() => setOpen(false)}
        pending={false}
      />
    </>
  )
}

export const Simulating: Story = {
  render: () => <SimulatingState />,
  parameters: {
    docs: {
      description: {
        story: 'Shows the simulating state with spinner while transaction is being simulated',
      },
    },
  },
}

function SuccessState() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const handleConfirm = () => {
    setPending(true)
    setTimeout(() => {
      setPending(false)
      setOpen(false)
    }, 2000)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Success Preview</Button>
      <TxPreviewDialog
        open={open}
        input={mockInput}
        network="testnet"
        sender="GBZXVUKUU3YQZRYOFQHP53BQXW5X5O4MHVK2D7MKQZH7VH6HMQQXOXM"
        operationLabel="Create 30-day Stream"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
        pending={pending}
      />
    </>
  )
}

export const SuccessSimulation: Story = {
  render: () => <SuccessState />,
  parameters: {
    docs: {
      description: {
        story: 'Shows successful simulation with estimated fees and resource usage',
      },
    },
  },
}

function FailedState() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="destructive">
        Open Failed Preview
      </Button>
      <TxPreviewDialog
        open={open}
        input={mockInput}
        network="testnet"
        sender="GBZXVUKUU3YQZRYOFQHP53BQXW5X5O4MHVK2D7MKQZH7VH6HMQQXOXM"
        operationLabel="Create 30-day Stream"
        onConfirm={() => {}}
        onCancel={() => setOpen(false)}
        pending={false}
      />
    </>
  )
}

export const FailedSimulation: Story = {
  render: () => <FailedState />,
  parameters: {
    docs: {
      description: {
        story: 'Shows failed simulation with error message, confirm button is disabled',
      },
    },
  },
}

function PendingState() {
  const [open, setOpen] = useState(true)

  return (
    <TxPreviewDialog
      open={open}
      input={mockInput}
      network="testnet"
      sender="GBZXVUKUU3YQZRYOFQHP53BQXW5X5O4MHVK2D7MKQZH7VH6HMQQXOXM"
      operationLabel="Create 30-day Stream"
      onConfirm={() => {}}
      onCancel={() => setOpen(false)}
      pending={true}
    />
  )
}

export const PendingSign: Story = {
  render: () => <PendingState />,
  parameters: {
    docs: {
      description: {
        story: 'Shows pending state when user is signing the transaction in their wallet',
      },
    },
  },
}
