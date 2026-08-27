import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UsdToggle } from '@/app/app/settings/usd-toggle'

const mockSetShowUsd = vi.fn()
let currentShowUsd = true

vi.mock('@/hooks/use-show-usd', () => ({
  useShowUsd: () => [currentShowUsd, mockSetShowUsd],
}))

describe('UsdToggle', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('reflects the current value from useShowUsd as checked', () => {
    currentShowUsd = true
    render(<UsdToggle />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('reflects a false value from useShowUsd as unchecked', () => {
    currentShowUsd = false
    render(<UsdToggle />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('calls setShowUsd with the new value when toggled', () => {
    currentShowUsd = false
    render(<UsdToggle />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(mockSetShowUsd).toHaveBeenCalledWith(true)
  })
})
