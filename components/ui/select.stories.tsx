import type { Meta, StoryObj } from "@storybook/react"
import { Select } from "./select"
import React from "react"

const meta = {
  title: "UI/Select",
  component: Select,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

// Default select with placeholder
export const Default: Story = {
  render: () => {
    const [value, setValue] = React.useState<string>("")
    const items = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
      { value: "option3", label: "Option 3" },
    ]

    return (
      <div className="w-96">
        <Select
          value={value}
          onChange={(newValue) => setValue(newValue)}
          placeholder="Select an option"
          items={items}
        />
      </div>
    )
  },
}

// Select with selected value
export const WithSelectedValue: Story = {
  render: () => {
    const [value, setValue] = React.useState<string>("option2")
    const items = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
      { value: "option3", label: "Option 3" },
    ]

    return (
      <div className="w-96">
        <Select
          value={value}
          onChange={(newValue) => setValue(newValue)}
          items={items}
        />
      </div>
    )
  },
}

// Disabled select
export const Disabled: Story = {
  render: () => {
    const items = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
      { value: "option3", label: "Option 3" },
    ]

    return (
      <div className="w-96">
        <Select
          disabled
          placeholder="Select an option (disabled)"
          items={items}
        />
      </div>
    )
  },
}

// Select with many options
export const ManyOptions: Story = {
  render: () => {
    const [value, setValue] = React.useState<string>("")
    const items = Array.from({ length: 20 }, (_, i) => ({
      value: `option${i + 1}`,
      label: `Option ${i + 1}`,
    }))

    return (
      <div className="w-96">
        <Select
          value={value}
          onChange={(newValue) => setValue(newValue)}
          placeholder="Select from many options"
          items={items}
        />
      </div>
    )
  },
}

// Token selection (common use case)
export const TokenSelection: Story = {
  render: () => {
    const [value, setValue] = React.useState<string>("")
    const tokens = [
      { value: "usdc", label: "USDC" },
      { value: "usdt", label: "USDT" },
      { value: "eur", label: "EUR" },
      { value: "xlm", label: "XLM" },
    ]

    return (
      <div className="space-y-2 w-96">
        <label className="text-sm font-medium">Select Token</label>
        <Select
          value={value}
          onChange={(newValue) => setValue(newValue)}
          placeholder="Choose a token"
          items={tokens}
        />
      </div>
    )
  },
}

// Recurrence selection (from batch create page)
export const RecurrenceSelection: Story = {
  render: () => {
    const [value, setValue] = React.useState<string>("")
    const recurrenceOptions = [
      { value: "once", label: "Once" },
      { value: "daily", label: "Daily" },
      { value: "weekly", label: "Weekly" },
      { value: "monthly", label: "Monthly" },
      { value: "yearly", label: "Yearly" },
    ]

    return (
      <div className="space-y-2 w-96">
        <label className="text-sm font-medium">Recurrence</label>
        <Select
          value={value}
          onChange={(newValue) => setValue(newValue)}
          placeholder="Select recurrence"
          items={recurrenceOptions}
        />
      </div>
    )
  },
}

// Select with error state
export const WithError: Story = {
  render: () => {
    const [value, setValue] = React.useState<string>("")
    const items = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
    ]

    return (
      <div className="space-y-2 w-96">
        <label className="text-sm font-medium">Required Field</label>
        <Select
          value={value}
          onChange={(newValue) => setValue(newValue)}
          placeholder="Select an option"
          items={items}
          aria-invalid={!value}
        />
        {!value && <p className="text-xs text-destructive">This field is required</p>}
      </div>
    )
  },
}

// Multiple selects side by side
export const MultipleSelects: Story = {
  render: () => {
    const [token, setToken] = React.useState<string>("")
    const [recurrence, setRecurrence] = React.useState<string>("")

    const tokenItems = [
      { value: "usdc", label: "USDC" },
      { value: "usdt", label: "USDT" },
    ]

    const recurrenceItems = [
      { value: "once", label: "Once" },
      { value: "monthly", label: "Monthly" },
    ]

    return (
      <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
        <div className="space-y-2">
          <label className="text-sm font-medium">Token</label>
          <Select
            value={token}
            onChange={setToken}
            placeholder="Select token"
            items={tokenItems}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Recurrence</label>
          <Select
            value={recurrence}
            onChange={setRecurrence}
            placeholder="Select recurrence"
            items={recurrenceItems}
          />
        </div>
      </div>
    )
  },
}
