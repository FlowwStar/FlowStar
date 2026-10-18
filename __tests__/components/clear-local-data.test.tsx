import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClearLocalData } from '@/components/settings/clear-local-data'

const mockToastSuccess = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
  },
}))

describe('ClearLocalData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    mockToastSuccess.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('requires a confirmation step before clearing', () => {
    window.localStorage.setItem('flowstar:streams', '[]')
    render(<ClearLocalData />)

    expect(screen.queryByText("Are you sure? This can't be undone.")).not.toBeInTheDocument()

    screen.getByText('Clear local data').click()

    expect(screen.getByText("Are you sure? This can't be undone.")).toBeInTheDocument()
    // Clicking the initial button only arms the confirmation; nothing is removed yet.
    expect(window.localStorage.getItem('flowstar:streams')).toBe('[]')
  })

  it('only removes keys prefixed with flowstar, keeping other keys like walletId', () => {
    window.localStorage.setItem('flowstar:streams', '[]')
    window.localStorage.setItem('flowstar_notifications', '{}')
    window.localStorage.setItem('flowstar-network', 'testnet')
    window.localStorage.setItem('walletId', 'abc123')
    window.localStorage.setItem('unrelatedKey', 'keep-me')

    render(<ClearLocalData />)

    screen.getByText('Clear local data').click()
    screen.getByText('Confirm clear').click()

    expect(window.localStorage.getItem('flowstar:streams')).toBeNull()
    expect(window.localStorage.getItem('flowstar_notifications')).toBeNull()
    expect(window.localStorage.getItem('flowstar-network')).toBeNull()
    expect(window.localStorage.getItem('walletId')).toBe('abc123')
    expect(window.localStorage.getItem('unrelatedKey')).toBe('keep-me')
  })

  it('shows a success toast reporting how many items were cleared', () => {
    window.localStorage.setItem('flowstar:streams', '[]')
    window.localStorage.setItem('flowstar_notifications', '{}')
    window.localStorage.setItem('walletId', 'abc123')

    render(<ClearLocalData />)

    screen.getByText('Clear local data').click()
    screen.getByText('Confirm clear').click()

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Cleared 2 items of local data',
      expect.objectContaining({ description: 'Reloading…' }),
    )
  })

  it('cancel button dismisses the confirmation without clearing anything', () => {
    window.localStorage.setItem('flowstar:streams', '[]')
    render(<ClearLocalData />)

    screen.getByText('Clear local data').click()
    screen.getByText('Cancel').click()

    expect(screen.queryByText("Are you sure? This can't be undone.")).not.toBeInTheDocument()
    expect(window.localStorage.getItem('flowstar:streams')).toBe('[]')
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})
