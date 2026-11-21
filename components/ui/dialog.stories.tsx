import type { Meta, StoryObj } from "@storybook/react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog"
import { Button } from "./button"

const meta = {
  title: "UI/Dialog",
  component: Dialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

// Basic dialog with trigger
export const BasicDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>This is a basic dialog component.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>Dialog content goes here.</p>
        </div>
      </DialogContent>
    </Dialog>
  ),
}

// Dialog with footer actions
export const WithFooter: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Confirmation Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Action</DialogTitle>
          <DialogDescription>Are you sure you want to continue?</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>This action cannot be undone.</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

// Dialog without close button
export const WithoutCloseButton: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog (No Close Button)</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Dialog Without Close Button</DialogTitle>
          <DialogDescription>Close via the buttons below</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>You must use the action buttons to close this dialog.</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

// Long content dialog
export const LongContent: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Long Content Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>Please read our terms carefully</DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-64 overflow-y-auto space-y-2">
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
          <p>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
          <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
          <p>Nisi ut aliquip ex ea commodo consequat.</p>
          <p>Duis aute irure dolor in reprehenderit in voluptate velit esse.</p>
          <p>Cillum dolore eu fugiat nulla pariatur.</p>
          <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui.</p>
          <p>Officia deserunt mollit anim id est laborum sed ut perspiciatis.</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline">Decline</Button>
          <Button>Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

// Stream operation dialog example
export const StreamOperationDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Withdraw from Stream</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>Withdraw your available balance from this stream</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Amount to Withdraw</label>
            <input type="text" placeholder="0.00" className="w-full mt-1 px-2 py-1 border rounded" />
          </div>
          <div>
            <label className="text-sm font-medium">Available Balance</label>
            <p className="text-lg font-bold">1,250.50 USDC</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Withdraw</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

// Simple alert-style dialog
export const AlertDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Stream</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Stream?</DialogTitle>
          <DialogDescription>This action cannot be undone</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>Are you sure you want to permanently delete this stream?</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

// Dialog with form content
export const FormDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Create New Stream</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Stream</DialogTitle>
          <DialogDescription>Set up a new payment stream</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Recipient Address</label>
            <input type="text" placeholder="GXXX..." className="w-full mt-1 px-2 py-1 border rounded" />
          </div>
          <div>
            <label className="text-sm font-medium">Amount</label>
            <input type="number" placeholder="0.00" className="w-full mt-1 px-2 py-1 border rounded" />
          </div>
          <div>
            <label className="text-sm font-medium">Token</label>
            <select className="w-full mt-1 px-2 py-1 border rounded">
              <option>USDC</option>
              <option>USDT</option>
              <option>EUR</option>
            </select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Create Stream</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

// Dialog with complex header structure
export const ComplexHeader: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>View Details</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transaction Preview</DialogTitle>
          <DialogDescription>Review the details of your transaction before confirming</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">From</span>
              <span className="font-mono text-sm">GXXX...XXX</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To</span>
              <span className="font-mono text-sm">GYYY...YYY</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold">1,000.00 USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gas Fee</span>
              <span>0.01 USDC</span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-medium">Total</span>
              <span className="font-bold">1,000.01 USDC</span>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Confirm Transaction</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
