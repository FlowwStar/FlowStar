import type { Meta, StoryObj } from '@storybook/react'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const meta: Meta<typeof Toaster> = {
  title: 'UI/Sonner',
  component: Toaster,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof meta>

function ToastTriggers() {
  return (
    <div className="flex gap-3 flex-wrap">
      <Button
        onClick={() =>
          toast.success('Success notification', {
            description: 'This is a success toast with a description',
          })
        }
        variant="default"
      >
        Show Success
      </Button>
      <Button
        onClick={() =>
          toast.error('Error notification', {
            description: 'Something went wrong',
          })
        }
        variant="destructive"
      >
        Show Error
      </Button>
      <Button
        onClick={() =>
          toast.info('Information', {
            description: 'Here is some useful information',
          })
        }
        variant="outline"
      >
        Show Info
      </Button>
      <Button
        onClick={() =>
          toast.warning('Warning', {
            description: 'Please be careful with this action',
          })
        }
        variant="outline"
      >
        Show Warning
      </Button>
      <Button
        onClick={() => toast.loading('Loading...', { id: 'loading-toast' })}
        variant="outline"
      >
        Show Loading
      </Button>
      <Button
        onClick={() => toast.dismiss('loading-toast')}
        variant="ghost"
      >
        Dismiss
      </Button>
    </div>
  )
}

export const Default: Story = {
  render: () => (
    <>
      <Toaster />
      <ToastTriggers />
    </>
  ),
}

export const SuccessToast: Story = {
  render: () => (
    <>
      <Toaster />
      <Button onClick={() => toast.success('Operation completed successfully!')}>
        Trigger Success Toast
      </Button>
    </>
  ),
}

export const ErrorToast: Story = {
  render: () => (
    <>
      <Toaster />
      <Button onClick={() => toast.error('An error occurred', { description: 'Please try again' })}>
        Trigger Error Toast
      </Button>
    </>
  ),
}

export const InfoToast: Story = {
  render: () => (
    <>
      <Toaster />
      <Button onClick={() => toast.info('New update available', { description: 'Click to learn more' })}>
        Trigger Info Toast
      </Button>
    </>
  ),
}

export const WithLongMessage: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        onClick={() =>
          toast.success('Transaction confirmed', {
            description:
              'Your transaction has been successfully processed and added to the blockchain. You can view it in the explorer.',
          })
        }
      >
        Trigger Long Message Toast
      </Button>
    </>
  ),
}
