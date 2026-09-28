import type { Meta, StoryObj } from "@storybook/react"
import { Label } from "./label"
import { Input } from "./input"

const meta = {
  title: "UI/Label",
  component: Label,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

// Basic label
export const Default: Story = {
  args: {
    children: "Email Address",
    htmlFor: "email-input",
  },
}

// Label with input (common pattern)
export const WithInput: Story = {
  render: () => (
    <div className="space-y-2 w-96">
      <Label htmlFor="email">Email Address</Label>
      <Input id="email" type="email" placeholder="your@email.com" />
    </div>
  ),
}

// Disabled state
export const DisabledState: Story = {
  render: () => (
    <div className="space-y-2 w-96">
      <Label htmlFor="disabled-input" className="opacity-50">
        Disabled Field
      </Label>
      <Input id="disabled-input" placeholder="This field is disabled" disabled />
    </div>
  ),
}

// Required field indicator
export const RequiredField: Story = {
  render: () => (
    <div className="space-y-2 w-96">
      <Label htmlFor="required" className="flex gap-1">
        Name
        <span className="text-destructive">*</span>
      </Label>
      <Input id="required" type="text" placeholder="Enter your name" required />
    </div>
  ),
}

// Label with error message
export const WithError: Story = {
  render: () => (
    <div className="space-y-2 w-96">
      <Label htmlFor="error-field" className="text-destructive">
        Username
      </Label>
      <Input id="error-field" type="text" placeholder="Username" aria-invalid={true} />
      <p className="text-xs text-destructive">Username already taken</p>
    </div>
  ),
}

// Label with helper text
export const WithHelperText: Story = {
  render: () => (
    <div className="space-y-2 w-96">
      <Label htmlFor="password">Password</Label>
      <Input id="password" type="password" placeholder="Enter password" />
      <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
    </div>
  ),
}

// Form field group
export const FormFieldGroup: Story = {
  render: () => (
    <div className="space-y-6 w-96">
      <div className="space-y-2">
        <Label htmlFor="first-name">First Name</Label>
        <Input id="first-name" type="text" placeholder="John" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="last-name">Last Name</Label>
        <Input id="last-name" type="text" placeholder="Doe" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="flex gap-1">
          Email
          <span className="text-destructive">*</span>
        </Label>
        <Input id="email" type="email" placeholder="john@example.com" required />
      </div>
    </div>
  ),
}

// Label styling variations
export const StylingVariations: Story = {
  render: () => (
    <div className="space-y-8">
      <div className="space-y-2 w-96">
        <Label className="text-base font-semibold">Large Label</Label>
        <Input placeholder="Input with large label" />
      </div>
      <div className="space-y-2 w-96">
        <Label className="text-sm">Small Label</Label>
        <Input placeholder="Input with small label" />
      </div>
      <div className="space-y-2 w-96">
        <Label className="font-bold uppercase">Uppercase Label</Label>
        <Input placeholder="Input with uppercase label" />
      </div>
    </div>
  ),
}
