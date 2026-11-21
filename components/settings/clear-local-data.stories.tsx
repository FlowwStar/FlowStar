import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { mocked } from 'storybook/test'
import * as settingsCopyModule from '@/lib/copy/settings'
import { ClearLocalData } from './clear-local-data'

const mockSettingsCopy = {
  clearLocalData: {
    title: 'Clear local data',
    description: 'Delete all stored preferences, form drafts, and configuration.',
    button: 'Clear local data',
    confirmPrompt: 'Are you sure? This action cannot be undone.',
    confirm: 'Clear everything',
    cancel: 'Cancel',
    toast: {
      cleared: (count: number) => `Cleared ${count} items`,
      reloading: 'Page reloading...',
    },
  },
}

const meta = {
  title: 'Settings/ClearLocalData',
  component: ClearLocalData,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  beforeEach: () => {
    mocked(settingsCopyModule).settingsCopy = mockSettingsCopy as any
  },
} satisfies Meta<typeof ClearLocalData>

export default meta
type Story = StoryObj<typeof meta>

/** Default state showing the clear data button. */
export const Default: Story = {}

/** Confirmation step with destructive action. */
export const Confirming: Story = {
  render: (args) => {
    const Component = (props: React.ComponentProps<typeof ClearLocalData>) => {
      const [confirming, setConfirming] = React.useState(true)

      // Render by intercepting the component and forcing the confirming state
      return (
        <div className="max-w-md">
          <div className="rounded-lg border border-destructive/40 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <svg className="size-4 text-destructive shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 0v2M7 9h10" />
              </svg>
              <div>
                <p className="text-sm font-medium">{mockSettingsCopy.clearLocalData.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mockSettingsCopy.clearLocalData.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {mockSettingsCopy.clearLocalData.confirmPrompt}
              </span>
              <button className="rounded px-3 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {mockSettingsCopy.clearLocalData.confirm}
              </button>
              <button className="rounded px-3 py-1.5 text-xs font-medium border border-border hover:bg-muted">
                {mockSettingsCopy.clearLocalData.cancel}
              </button>
            </div>
          </div>
        </div>
      )
    }
    return <Component {...args} />
  },
}
