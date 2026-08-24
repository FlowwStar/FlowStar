import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from '@/components/ThemeToggle'

const mockSetTheme = vi.fn()
let currentTheme = 'system'

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: currentTheme,
    setTheme: mockSetTheme,
  }),
}))

describe('ThemeToggle', () => {
  it('renders a button with type="button"', () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button')
    expect(button).toBeDefined()
    expect(button.getAttribute('type')).toBe('button')
  })

  it('cycles through theme options on click', () => {
    currentTheme = 'system'
    render(<ThemeToggle />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })
})
