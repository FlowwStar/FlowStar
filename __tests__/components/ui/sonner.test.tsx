/**
 * Tests for components/ui/sonner.tsx  (closes #757)
 *
 * Asserts the Toaster renders with the app's expected theme/position
 * configuration and that the wrapper component mounts without errors.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Toaster } from '@/components/ui/sonner'
import React from 'react'

const mockUseTheme = vi.fn()

vi.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}))

vi.mock('sonner', () => ({
  Toaster: vi.fn(({ theme, className, ...props }: {
    theme?: string
    className?: string
    [key: string]: unknown
  }) => (
    <div
      data-testid="sonner-toaster"
      data-theme={theme}
      className={className}
      {...(props as React.HTMLAttributes<HTMLDivElement>)}
    />
  )),
}))

describe('Toaster (sonner wrapper)', () => {
  it('renders without crashing', () => {
    mockUseTheme.mockReturnValue({ theme: 'light' })
    const { getByTestId } = render(<Toaster />)
    expect(getByTestId('sonner-toaster')).toBeInTheDocument()
  })

  it('passes the current theme from useTheme to the Sonner Toaster', () => {
    mockUseTheme.mockReturnValue({ theme: 'dark' })
    const { getByTestId } = render(<Toaster />)
    expect(getByTestId('sonner-toaster')).toHaveAttribute('data-theme', 'dark')
  })

  it('defaults to "system" theme when useTheme returns undefined', () => {
    mockUseTheme.mockReturnValue({ theme: undefined })
    const { getByTestId } = render(<Toaster />)
    expect(getByTestId('sonner-toaster')).toHaveAttribute('data-theme', 'system')
  })

  it('applies the "toaster group" className', () => {
    mockUseTheme.mockReturnValue({ theme: 'light' })
    const { getByTestId } = render(<Toaster />)
    expect(getByTestId('sonner-toaster')).toHaveAttribute('class', 'toaster group')
  })

  it('passes through extra props to the underlying Sonner component', () => {
    mockUseTheme.mockReturnValue({ theme: 'light' })
    const { getByTestId } = render(<Toaster position="top-center" />)
    expect(getByTestId('sonner-toaster')).toHaveAttribute('position', 'top-center')
  })

  it('uses "system" theme when the theme value is "system"', () => {
    mockUseTheme.mockReturnValue({ theme: 'system' })
    const { getByTestId } = render(<Toaster />)
    expect(getByTestId('sonner-toaster')).toHaveAttribute('data-theme', 'system')
  })
})
