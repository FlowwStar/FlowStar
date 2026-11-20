import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Hero } from './hero'

// The app ships a single dark palette on `:root`. These overrides emulate a
// light theme so the Hero can be reviewed against both backgrounds.
const lightThemeVars = {
  colorScheme: 'light',
  '--background': 'oklch(0.99 0.003 240)',
  '--foreground': 'oklch(0.18 0.012 240)',
  '--card': 'oklch(1 0 0)',
  '--card-foreground': 'oklch(0.18 0.012 240)',
  '--muted': 'oklch(0.95 0.005 240)',
  '--muted-foreground': 'oklch(0.45 0.015 240)',
  '--border': 'oklch(0.9 0.006 240)',
  background: 'var(--background)',
  color: 'var(--foreground)',
} as React.CSSProperties

const darkThemeVars = {
  colorScheme: 'dark',
  background: 'var(--background)',
  color: 'var(--foreground)',
} as React.CSSProperties

const meta = {
  title: 'Landing/Hero',
  component: Hero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Hero>

export default meta
type Story = StoryObj<typeof meta>

/** Default presentation using the app's native (dark) palette. */
export const Default: Story = {}

/** Hero rendered on the dark theme. */
export const DarkTheme: Story = {
  decorators: [
    (Story) => (
      <div className="dark" style={darkThemeVars}>
        <Story />
      </div>
    ),
  ],
}

/** Hero rendered with light theme colour tokens. */
export const LightTheme: Story = {
  decorators: [
    (Story) => (
      <div style={lightThemeVars}>
        <Story />
      </div>
    ),
  ],
}

/** Hero on a mobile viewport: single column, preview stacked below the copy. */
export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false },
  },
}
