import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { fn, mocked } from 'storybook/test'
import * as sentryModule from '@/lib/sentry'
import { SectionErrorBoundary } from './section-error-boundary'

const meta = {
  title: 'Error/SectionErrorBoundary',
  component: SectionErrorBoundary,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  beforeEach: () => {
    mocked(sentryModule).captureError = fn()
  },
} satisfies Meta<typeof SectionErrorBoundary>

export default meta
type Story = StoryObj<typeof meta>

/** Normal child renders without error. */
export const Default: Story = {
  args: {
    children: (
      <div className="p-4 rounded-lg border border-border">
        <p>This section rendered successfully.</p>
      </div>
    ),
    sectionName: 'Stream list',
  },
}

/** Child component that throws an error. */
export const WithError: Story = {
  args: {
    children: (
      <ErrorThrowingChild />
    ),
    sectionName: 'Analytics panel',
    onReloadData: fn(),
  },
}

/** Multiple sections, one with an error and one working. */
export const MultipleWithErrorBoundary: Story = {
  render: () => (
    <div className="space-y-4">
      <SectionErrorBoundary sectionName="Working section">
        <div className="p-4 rounded-lg border border-border">
          <p className="text-sm">This section is working normally.</p>
        </div>
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Failed section" onReloadData={fn()}>
        <ErrorThrowingChild />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Another working section">
        <div className="p-4 rounded-lg border border-border">
          <p className="text-sm">This section is also working fine.</p>
        </div>
      </SectionErrorBoundary>
    </div>
  ),
}

function ErrorThrowingChild() {
  throw new Error('Something went wrong in this section')
}
