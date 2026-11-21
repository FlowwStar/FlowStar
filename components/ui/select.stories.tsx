import type { Meta, StoryObj } from '@storybook/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

const meta = {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

function SelectShowcase({ disabled = false, invalid = false, placeholder = 'Choose a token' }: {
  disabled?: boolean
  invalid?: boolean
  placeholder?: string
}) {
  return (
    <Select disabled={disabled}>
      <SelectTrigger aria-invalid={invalid} className="w-48">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="xlm">XLM</SelectItem>
        <SelectItem value="usdc">USDC</SelectItem>
        <SelectItem value="eurc">EURC</SelectItem>
      </SelectContent>
    </Select>
  )
}

export const Default: Story = {
  render: () => <SelectShowcase />,
}

export const WithPlaceholder: Story = {
  render: () => <SelectShowcase placeholder="Select an asset" />,
}

export const Disabled: Story = {
  render: () => <SelectShowcase disabled />,
}

export const Invalid: Story = {
  render: () => <SelectShowcase invalid />,
}
