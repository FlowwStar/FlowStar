import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { fn, mocked } from 'storybook/test'
import * as sentryModule from '@/lib/sentry'
import { PageErrorBoundary } from './page-error-boundary'

const meta: Meta<typeof PageErrorBoundary> = {
  title: 'Error/PageErrorBoundary',
  component: PageErrorBoundary,
  parameters: {
    layout: 'fullscreen',
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
      <div className="p-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page rendered successfully.</p>
      </div>
    ),
  },
}

/** Child component that throws an error: shows the full-screen fallback UI. */
export const WithError: Story = {
  args: {
    children: <ErrorThrowingChild message="Something went wrong while rendering this page" />,
  },
}

/** Thrown error has an empty message, so the generic fallback message is shown. */
export const WithEmptyErrorMessage: Story = {
  args: {
    children: <ErrorThrowingChild message="" />,
  },
}

function ErrorThrowingChild({ message }: { message: string }): never {
  throw new Error(message)
}
