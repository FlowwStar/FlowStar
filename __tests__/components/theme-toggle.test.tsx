import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { ThemeToggle } from '@/components/ThemeToggle'

const mockUseTheme = vi.fn()

vi.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}))

describe('ThemeToggle', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing before mount', () => {
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme: vi.fn() })

    expect(renderToString(<ThemeToggle />)).toBe('')
  })

  it('cycles light, dark, system, and light with the current theme label', async () => {
    let theme = 'light'
    const setTheme = vi.fn((nextTheme: string) => {
      theme = nextTheme
    })
    mockUseTheme.mockImplementation(() => ({ theme, setTheme }))

    const view = render(<ThemeToggle />)
    const button = await screen.findByRole('button')

    expect(button).toHaveAttribute('aria-label', 'Current theme: light. Click to switch.')

    button.click()
    expect(setTheme).toHaveBeenLastCalledWith('dark')
    view.rerender(<ThemeToggle />)
    expect(button).toHaveAttribute('aria-label', 'Current theme: dark. Click to switch.')

    button.click()
    expect(setTheme).toHaveBeenLastCalledWith('system')
    view.rerender(<ThemeToggle />)
    expect(button).toHaveAttribute('aria-label', 'Current theme: system. Click to switch.')

    button.click()
    expect(setTheme).toHaveBeenLastCalledWith('light')
    view.rerender(<ThemeToggle />)
    expect(button).toHaveAttribute('aria-label', 'Current theme: light. Click to switch.')
  })

  it('renders a button with type="button"', () => {
    mockUseTheme.mockReturnValue({ theme: 'system', setTheme: vi.fn() })

    render(<ThemeToggle />)
    const button = screen.getByRole('button')
    expect(button).toBeDefined()
    expect(button.getAttribute('type')).toBe('button')
  })
})
