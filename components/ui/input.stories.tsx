import type { Meta, StoryObj } from "@storybook/react"
import { Input } from "./input"

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
    type: { control: "select", options: ["text", "email", "password", "number", "file"] },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

// Default input state
export const Default: Story = {
  args: {
    placeholder: "Enter text...",
    type: "text",
  },
}

// Disabled input
export const Disabled: Story = {
  args: {
    placeholder: "Disabled input",
    disabled: true,
    type: "text",
  },
}

// Invalid state with aria-invalid
export const Invalid: Story = {
  args: {
    placeholder: "Invalid input",
    "aria-invalid": true,
    type: "text",
  },
}

// File input type
export const FileInput: Story = {
  args: {
    type: "file",
  },
}

// Email input
export const EmailInput: Story = {
  args: {
    type: "email",
    placeholder: "your@email.com",
  },
}

// Password input
export const PasswordInput: Story = {
  args: {
    type: "password",
    placeholder: "Enter password...",
  },
}

// Number input
export const NumberInput: Story = {
  args: {
    type: "number",
    placeholder: "0",
  },
}

// With value
export const WithValue: Story = {
  args: {
    type: "text",
    value: "Sample input value",
    disabled: false,
  },
}

// Large field
export const LargeField: Story = {
  args: {
    type: "text",
    placeholder: "Large input field",
    className: "w-96",
  },
}

// Comparison of states
export const StateComparison: Story = {
  render: () => (
    <div className="space-y-4 w-96">
      <div>
        <label className="text-sm font-medium mb-1 block">Default</label>
        <Input type="text" placeholder="Default state" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Disabled</label>
        <Input type="text" placeholder="Disabled state" disabled />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Invalid</label>
        <Input type="text" placeholder="Invalid state" aria-invalid={true} />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">With Value</label>
        <Input type="text" value="User input" disabled={false} />
      </div>
    </div>
  ),
}
