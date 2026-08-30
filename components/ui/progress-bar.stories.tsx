import type { Meta, StoryObj } from '@storybook/react'
import { ProgressBar } from './progress-bar'

const meta = {
  title: 'UI/ProgressBar',
  component: ProgressBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProgressBar>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default progress bar at 50% completion
 */
export const Default: Story = {
  args: {
    value: 0.5,
  },
}

/**
 * Progress bar showing 0% completion (empty state)
 */
export const Empty: Story = {
  args: {
    value: 0,
  },
}

/**
 * Progress bar showing 25% completion
 */
export const QuarterComplete: Story = {
  args: {
    value: 0.25,
  },
}

/**
 * Progress bar showing 50% completion (half-way)
 */
export const HalfComplete: Story = {
  args: {
    value: 0.5,
  },
}

/**
 * Progress bar showing 75% completion
 */
export const ThreeQuartersComplete: Story = {
  args: {
    value: 0.75,
  },
}

/**
 * Progress bar showing 100% completion (full state)
 */
export const Complete: Story = {
  args: {
    value: 1,
  },
}

/**
 * Progress bar with indeterminate shimmer effect
 * Useful for operations with unknown duration
 */
export const IndeterminateShimmer: Story = {
  args: {
    value: 0.5,
    indeterminateShimmer: true,
  },
}

/**
 * Small size variant
 */
export const SmallSize: Story = {
  args: {
    value: 0.5,
    size: 'sm',
  },
}

/**
 * Default size variant (default)
 */
export const DefaultSize: Story = {
  args: {
    value: 0.5,
    size: 'default',
  },
}

/**
 * Large size variant
 */
export const LargeSize: Story = {
  args: {
    value: 0.5,
    size: 'lg',
  },
}

/**
 * Progress bar with a secondary marker (e.g., withdrawn portion)
 * Marker shows at 30% while progress is at 50%
 */
export const WithMarker: Story = {
  args: {
    value: 0.5,
    marker: 0.3,
  },
}

/**
 * Edge case: negative value (should be clamped to 0)
 * The component should restrict negative values and display as empty
 */
export const NegativeValue: Story = {
  args: {
    value: -0.5,
  },
}

/**
 * Edge case: value exceeding 100% (should be clamped to 1)
 * The component should restrict values over 1 and display as full
 */
export const ExceedingValue: Story = {
  args: {
    value: 1.5,
  },
}

/**
 * Edge case: marker with negative value (should be clamped to 0)
 */
export const NegativeMarker: Story = {
  args: {
    value: 0.5,
    marker: -0.3,
  },
}

/**
 * Edge case: marker exceeding 100% (should be clamped to 1)
 */
export const ExceedingMarker: Story = {
  args: {
    value: 0.5,
    marker: 1.5,
  },
}

/**
 * Small size with indeterminate shimmer
 */
export const SmallWithShimmer: Story = {
  args: {
    value: 0.5,
    size: 'sm',
    indeterminateShimmer: true,
  },
}

/**
 * Large size with indeterminate shimmer
 */
export const LargeWithShimmer: Story = {
  args: {
    value: 0.5,
    size: 'lg',
    indeterminateShimmer: true,
  },
}

/**
 * Custom CSS class example
 */
export const WithCustomClass: Story = {
  args: {
    value: 0.5,
    className: 'w-full max-w-md',
  },
}

/**
 * Multiple progress bars showing progression
 */
export const ProgressionSequence: Story = {
  render: () => (
    <div className="space-y-6 w-full max-w-md">
      <div>
        <p className="text-sm font-medium mb-2">0% - No progress</p>
        <ProgressBar value={0} />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">25% - Starting</p>
        <ProgressBar value={0.25} />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">50% - Halfway</p>
        <ProgressBar value={0.5} />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">75% - Nearly done</p>
        <ProgressBar value={0.75} />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">100% - Complete</p>
        <ProgressBar value={1} />
      </div>
    </div>
  ),
}

/**
 * All size variants together
 */
export const AllSizeVariants: Story = {
  render: () => (
    <div className="space-y-6 w-full max-w-md">
      <div>
        <p className="text-sm font-medium mb-2">Small</p>
        <ProgressBar value={0.6} size="sm" />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Default</p>
        <ProgressBar value={0.6} size="default" />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Large</p>
        <ProgressBar value={0.6} size="lg" />
      </div>
    </div>
  ),
}
