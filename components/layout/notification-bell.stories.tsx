import type { Meta, StoryObj } from '@storybook/react'
import { NotificationBell } from './notification-bell'

const meta = {
  title: 'Layout/NotificationBell',
  component: NotificationBell,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof NotificationBell>

export default meta
type Story = StoryObj<typeof meta>

export const NoNotifications: Story = {
  beforeEach: () => {
    localStorage.removeItem('notifications')
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
}

export const UnreadNotifications: Story = {
  beforeEach: () => {
    const notifications = [
      { id: '1', title: 'Stream Created', message: 'Your stream is active', read: false },
      { id: '2', title: 'Payment Received', message: '10 USDC received', read: true },
    ]
    localStorage.setItem('notifications', JSON.stringify(notifications))
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
}

export const LongNotificationList: Story = {
  beforeEach: () => {
    const notifications = Array.from({ length: 15 }, (_, i) => ({
      id: `${i}`,
      title: `Notification ${i + 1}`,
      message: `This is notification number ${i + 1}`,
      read: i > 5,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    }))
    localStorage.setItem('notifications', JSON.stringify(notifications))
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
}
