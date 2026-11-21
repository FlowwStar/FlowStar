import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationPreferencesSettings } from '@/components/notifications/notification-preferences'

vi.mock('sonner', () => ({
  toast: { warning: vi.fn() },
}))

describe('NotificationPreferencesSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders a toggle per notification type', () => {
    render(<NotificationPreferencesSettings />)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(3)
    expect(screen.getByText('Stream created')).toBeInTheDocument()
    expect(screen.getByText('Stream cancelled')).toBeInTheDocument()
    expect(screen.getByText('Withdrawal')).toBeInTheDocument()
  })

  it('toggling persists via the hook', async () => {
    const user = userEvent.setup()
    render(<NotificationPreferencesSettings />)

    const toggle = screen.getByRole('switch', {
      name: 'Disable Stream created notifications',
    })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).toHaveAccessibleName('Enable Stream created notifications')

    const stored = JSON.parse(localStorage.getItem('flowstar:notification-preferences') || '{}')
    expect(stored.stream_created).toBe(false)
  })
})
