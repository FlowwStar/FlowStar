import type { Meta, StoryObj } from '@storybook/react'
import { EmptyStreams } from './empty-state'

const meta = {
  title: 'Streams/EmptyStreams',
  component: EmptyStreams,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    showCreate: { control: 'boolean' },
  },
} satisfies Meta<typeof EmptyStreams>

export default meta
type Story = StoryObj<typeof meta>

/** The default empty state shown when a user has no streams. */
export const Default: Story = {}

/** Empty state with copy tailored to a filtered or specialized stream list. */
export const CustomTitleAndDescription: Story = {
  args: {
    title: 'No payroll streams',
    description: 'Create a payroll stream to pay contributors automatically over time.',
  },
}

/** Read-only empty state when stream creation is not available in the current view. */
export const WithoutCreateButton: Story = {
  args: {
    showCreate: false,
  },
}
