import type { Meta, StoryObj } from '@storybook/react'
import { fn, mocked } from 'storybook/test'
import * as notificationPreferencesModule from '@/hooks/use-notification-preferences'
import { NotificationPreferencesSettings } from './notification-preferences'

const mockUseNotificationPreferences = (onError?: () => void) => ({
  preferences: {
    stream_created: true,
    stream_cancelled: true,
    withdrawal: true,
  },
  setPreference: fn(),
})

const mockUseNotificationPreferencesAllOff = (onError?: () => void) => ({
  preferences: {
    stream_created: false,
    stream_cancelled: false,
    withdrawal: false,
  },
  setPreference: fn(),
})

const meta = {
  title: 'Notifications/NotificationPreferencesSettings',
  component: NotificationPreferencesSettings,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  beforeEach: () => {
    mocked(notificationPreferencesModule).useNotificationPreferences = fn(mockUseNotificationPreferences)
  },
} satisfies Meta<typeof NotificationPreferencesSettings>

export default meta
type Story = StoryObj<typeof meta>

/** All notification types enabled (default state). */
export const AllEnabled: Story = {}

/** All notification toggles turned off. */
export const AllDisabled: Story = {
  beforeEach: () => {
    mocked(notificationPreferencesModule).useNotificationPreferences = fn(mockUseNotificationPreferencesAllOff)
  },
}

/** Mixed state with some notifications enabled and others disabled. */
export const PartiallyEnabled: Story = {
  beforeEach: () => {
    mocked(notificationPreferencesModule).useNotificationPreferences = fn((onError?: () => void) => ({
      preferences: {
        stream_created: true,
        stream_cancelled: false,
        withdrawal: true,
      },
      setPreference: fn(),
    }))
  },
}
