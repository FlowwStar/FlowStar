import type { Meta, StoryObj } from '@storybook/react'
import { WebhookSettings } from './webhook-settings'

const meta = {
  title: 'Settings/WebhookSettings',
  component: WebhookSettings,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof WebhookSettings>

export default meta
type Story = StoryObj<typeof meta>

export const EmptyState: Story = {
  beforeEach: () => {
    localStorage.removeItem('webhooks')
    localStorage.removeItem('webhook_deliveries')
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
}

export const RegisteredWebhook: Story = {
  beforeEach: () => {
    const webhooks = [
      {
        id: 'wh_1',
        url: 'https://api.example.com/webhooks/flowstar',
        events: ['stream.created', 'payment.received'],
        active: true,
        createdAt: new Date().toISOString(),
      },
    ]
    localStorage.setItem('webhooks', JSON.stringify(webhooks))
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
}

export const DeliveryHistory: Story = {
  beforeEach: () => {
    const webhooks = [
      {
        id: 'wh_1',
        url: 'https://api.example.com/webhooks/flowstar',
        events: ['stream.created', 'payment.received'],
        active: true,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]
    const deliveries = [
      {
        id: 'del_1',
        webhookId: 'wh_1',
        status: 'success',
        statusCode: 200,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'del_2',
        webhookId: 'wh_1',
        status: 'failed',
        statusCode: 500,
        error: 'Internal Server Error',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        retries: 3,
      },
      {
        id: 'del_3',
        webhookId: 'wh_1',
        status: 'success',
        statusCode: 200,
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
    ]
    localStorage.setItem('webhooks', JSON.stringify(webhooks))
    localStorage.setItem('webhook_deliveries', JSON.stringify(deliveries))
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
}
