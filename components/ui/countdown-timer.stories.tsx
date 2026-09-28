import type { Meta, StoryObj } from "@storybook/react"
import { CountdownTimer } from "./countdown-timer"

const meta = {
  title: "UI/CountdownTimer",
  component: CountdownTimer,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CountdownTimer>

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
        <CountdownTimer target={thirtyDaysFromNow} />
      </div>
    )
  },
}

// Imminent (5 minutes from now)
export const Imminent: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const fiveMinutesFromNow = BigInt(now + 5 * 60)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Target: 5 minutes from now</p>
        <CountdownTimer target={fiveMinutesFromNow} />
      </div>
    )
  },
}

// Expired (1 hour ago)
export const Expired: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const oneHourAgo = BigInt(now - 60 * 60)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Target: 1 hour ago</p>
        <CountdownTimer target={oneHourAgo} />
      </div>
    )
  },
}

// Custom ended label
export const CustomEndedLabel: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const pastTime = BigInt(now - 60 * 60)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Custom ended label: "Completed"</p>
        <CountdownTimer target={pastTime} endedLabel="Completed" />
      </div>
    )
  },
}

// Very short time remaining (30 seconds)
export const VeryShortTime: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const thirtySecondsFromNow = BigInt(now + 30)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Target: 30 seconds from now</p>
        <CountdownTimer target={thirtySecondsFromNow} />
      </div>
    )
  },
}

// Multiple timers with different states
export const MultipleStates: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const farFuture = BigInt(now + 30 * 24 * 60 * 60)
    const imminent = BigInt(now + 5 * 60)
    const expired = BigInt(now - 60 * 60)

    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Far future:</p>
          <CountdownTimer target={farFuture} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Imminent:</p>
          <CountdownTimer target={imminent} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Expired:</p>
          <CountdownTimer target={expired} />
        </div>
      </div>
    )
  },
}

// With custom className
export const WithCustomClassName: Story = {
  render: () => {
    const now = Math.floor(Date.now() / 1000)
    const futureTime = BigInt(now + 7 * 24 * 60 * 60)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">With custom styling</p>
        <CountdownTimer
          target={futureTime}
          className="text-lg font-bold text-accent"
        />
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
        <CountdownTimer target={oneDayFromNow} />
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
        <CountdownTimer target={oneHourFromNow} />
      </div>
    )
  },
}
