import type { Meta, StoryObj } from '@storybook/react'
import { Brand } from './brand'

const meta = {
  title: 'Layout/Brand',
  component: Brand,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    showWordmark: { control: 'boolean' },
    href: { control: 'text' },
  },
} satisfies Meta<typeof Brand>

export default meta
type Story = StoryObj<typeof meta>

// Logo mark with the FlowStar wordmark
export const Default: Story = {
  args: {
    href: '/',
    showWordmark: true,
  },
}

// Compact logo mark only, as used in tight spaces
export const Small: Story = {
  args: {
    href: '/',
    showWordmark: false,
  },
}
