import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { fn, mocked } from 'storybook/test'
import * as sentryModule from '@/lib/sentry'
import { ComponentErrorBoundary } from './component-error-boundary'

const meta: Meta<typeof ComponentErrorBoundary> = {
  title: 'Error/ComponentErrorBoundary',
  component: ComponentErrorBoundary,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  beforeEach: () => {
    mocked(sentryModule).captureError = fn()
  },
}

export default meta
type Story = StoryObj<typeof meta>

/** Normal child renders without error. */
export const Default: Story = {
  args: {
    children: (
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm">This component rendered successfully.</p>
      </div>
    ),
    label: 'stream card',
  },
}

/** Child throws: the compact fallback with a Retry button is shown. */
export const WithError: Story = {
  args: {
    children: <ErrorThrowingChild />,
    label: 'stream card',
  },
}

/** No label provided: fallback uses the default "component" label. */
export const WithErrorDefaultLabel: Story = {
  args: {
    children: <ErrorThrowingChild />,
  },
}

/** One broken component does not hide its siblings. */
export const WithSiblings: Story = {
  render: () => (
    <div className="space-y-3">
      <ComponentErrorBoundary label="working card">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm">This component is working normally.</p>
        </div>
      </ComponentErrorBoundary>

      <ComponentErrorBoundary label="chart">
        <ErrorThrowingChild />
      </ComponentErrorBoundary>

      <ComponentErrorBoundary label="another card">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm">This component is also working fine.</p>
        </div>
      </ComponentErrorBoundary>
    </div>
  ),
}

function ErrorThrowingChild(): never {
  throw new Error('Something went wrong in this component')
}
