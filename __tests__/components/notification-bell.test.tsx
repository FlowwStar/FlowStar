import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationBell } from '@/components/layout/notification-bell'
import { useNotifications } from '@/hooks/use-notifications'

vi.mock('@/hooks/use-wallet', () => ({ useWallet: vi.fn(() => ({ address: 'GSENDER111' })) }))
vi.mock('@/hooks/use-notifications', () => ({ useNotifications: vi.fn() }))

const mockedUseNotifications = useNotifications as unknown as ReturnType<typeof vi.fn>

function makeNotification(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'notif-1',
    type: 'stream_created',
    title: 'Stream created',
    body: 'A new stream was created for you.',
    timestamp: Date.now(),
    read: false,
    ...overrides,
  }
}

function setNotifications(notifications: ReturnType<typeof makeNotification>[]) {
  mockedUseNotifications.mockReturnValue({
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAllRead: vi.fn(),
    clearAll: vi.fn(),
    dismissNotification: vi.fn(),
  })
}

describe('NotificationBell', () => {
  beforeEach(() => {
    setNotifications([])
  })

  it('shows the unread badge count', () => {
    setNotifications([makeNotification({ id: 'a' }), makeNotification({ id: 'b', read: true })])
    render(<NotificationBell />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('toggle opens and closes the panel', async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('notification-bell-trigger'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(screen.getByTestId('notification-bell-trigger'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('click outside closes it', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <NotificationBell />
        <button>outside</button>
      </div>,
    )

    await user.click(screen.getByTestId('notification-bell-trigger'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(screen.getByText('outside'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Escape closes it', async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)

    await user.click(screen.getByTestId('notification-bell-trigger'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('each notification renders title and body', async () => {
    const user = userEvent.setup()
    setNotifications([
      makeNotification({ id: 'a', title: 'Stream created', body: 'First stream body' }),
      makeNotification({ id: 'b', title: 'Withdrawal', body: 'Second stream body' }),
    ])
    render(<NotificationBell />)

    await user.click(screen.getByTestId('notification-bell-trigger'))

    expect(screen.getByText('Stream created')).toBeInTheDocument()
    expect(screen.getByText('First stream body')).toBeInTheDocument()
    expect(screen.getByText('Withdrawal')).toBeInTheDocument()
    expect(screen.getByText('Second stream body')).toBeInTheDocument()
  })
})
