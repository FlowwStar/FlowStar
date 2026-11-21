import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { StreamTemplates, type StreamTemplate } from './stream-templates'

const meta = {
  title: 'Streams/StreamTemplates',
  component: StreamTemplates,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    onSelect: (_template: StreamTemplate) => {},
  },
} satisfies Meta<typeof StreamTemplates>

export default meta
type Story = StoryObj<typeof meta>

// Default list with no template selected
export const Default: Story = {
  args: {
    selectedId: undefined,
  },
  render: function Render(args) {
    const [selectedId, setSelectedId] = useState(args.selectedId)
    return (
      <StreamTemplates
        selectedId={selectedId}
        onSelect={(template: StreamTemplate) => {
          setSelectedId(template.id)
          args.onSelect(template)
        }}
      />
    )
  },
}
