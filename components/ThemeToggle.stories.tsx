import type { Meta, StoryObj } from '@storybook/react'
import { ThemeProvider } from 'next-themes'
import { ThemeToggle } from './ThemeToggle'

const meta = {
  title: 'Layout/ThemeToggle',
  component: ThemeToggle,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof meta>

// Each story gets its own storage key, cleared before render, so the theme
// always starts from the story's state even after clicking the toggle.
const storageKey = (theme: 'light' | 'dark') => `storybook-theme-toggle-${theme}`

function themeStory(theme: 'light' | 'dark'): Story {
  return {
    beforeEach: () => {
      localStorage.removeItem(storageKey(theme))
    },
    decorators: [
      (Story) => (
        <ThemeProvider
          attribute="class"
          defaultTheme={theme}
          enableSystem
          storageKey={storageKey(theme)}
        >
          <div className={theme === 'dark' ? 'dark' : undefined}>
            <div className="rounded-lg bg-background p-4 text-foreground">
              <Story />
            </div>
          </div>
        </ThemeProvider>
      ),
    ],
  }
}

// Light theme active (sun icon)
export const Light: Story = themeStory('light')

// Dark theme active (moon icon)
export const Dark: Story = themeStory('dark')
