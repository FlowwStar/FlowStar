import type { Meta, StoryObj } from "@storybook/react"
import { AccessibleCountdownTimer } from "./accessible-countdown-timer"

const meta = {
  title: "UI/AccessibleCountdownTimer",
  component: AccessibleCountdownTimer,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AccessibleCountdownTimer>

export default meta
type Story = StoryObj<typeof meta>

// Far future target (30 days from now)
export const FarFuture: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const thirtyDaysFromNow = BigInt(now + 30 * 24 * 60 * 60)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Target: 30 days from now</p>
        <AccessibleCountdownTimer target={thirtyDaysFromNow} />
        <p className="text-xs text-muted-foreground">
          Screen reader will announce: "30 days, 0 hours, 0 minutes remaining"
        </p>
      </div>
    )
  },
}

// Imminent (less than 1 minute remaining)
export const Imminent: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const thirtySecondsFromNow = BigInt(now + 30)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Target: 30 seconds from now</p>
        <AccessibleCountdownTimer target={thirtySecondsFromNow} />
        <p className="text-xs text-muted-foreground">
          Screen reader will announce: "0 minutes, 30 seconds remaining"
        </p>
      </div>
    )
  },
}

// Already expired
export const Expired: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const oneHourAgo = BigInt(now - 60 * 60)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Target: 1 hour ago</p>
        <AccessibleCountdownTimer target={oneHourAgo} />
        <p className="text-xs text-muted-foreground">
          Screen reader will announce: "Timer expired"
        </p>
      </div>
    )
  },
}

// One day remaining
export const OneDayRemaining: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const oneDayFromNow = BigInt(now + 24 * 60 * 60)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Target: 1 day from now</p>
        <AccessibleCountdownTimer target={oneDayFromNow} />
        <p className="text-xs text-muted-foreground">
          Screen reader will announce: "1 day, 0 hours, 0 minutes remaining"
        </p>
      </div>
    )
  },
}

// One hour remaining
export const OneHourRemaining: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const oneHourFromNow = BigInt(now + 60 * 60)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Target: 1 hour from now</p>
        <AccessibleCountdownTimer target={oneHourFromNow} />
        <p className="text-xs text-muted-foreground">
          Screen reader will announce: "1 hour, 0 minutes remaining"
        </p>
      </div>
    )
  },
}

// Five minutes remaining
export const FiveMinutesRemaining: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const fiveMinutesFromNow = BigInt(now + 5 * 60)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Target: 5 minutes from now</p>
        <AccessibleCountdownTimer target={fiveMinutesFromNow} />
        <p className="text-xs text-muted-foreground">
          Screen reader will announce: "5 minutes remaining"
        </p>
      </div>
    )
  },
}

// Custom ended label with accessibility
export const CustomEndedLabel: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const pastTime = BigInt(now - 60 * 60)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Custom ended label: "Completed"</p>
        <AccessibleCountdownTimer target={pastTime} endedLabel="Completed" />
        <p className="text-xs text-muted-foreground">
          Screen reader will announce: "Completed"
        </p>
      </div>
    )
  },
}

// Multiple timers demonstrating live region updates
export const MultipleTimers: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const farFuture = BigInt(now + 30 * 24 * 60 * 60)
    const imminent = BigInt(now + 30)
    const expired = BigInt(now - 60 * 60)

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Far future:</p>
          <AccessibleCountdownTimer target={farFuture} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Imminent:</p>
          <AccessibleCountdownTimer target={imminent} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Expired:</p>
          <AccessibleCountdownTimer target={expired} />
        </div>
        <p className="text-xs text-muted-foreground">
          Screen readers will announce each timer's state including live updates as they change
        </p>
      </div>
    )
  },
}
