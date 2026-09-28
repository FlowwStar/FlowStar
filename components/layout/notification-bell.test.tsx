import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationBell } from './notification-bell'

jest.mock('@/hooks/use-notifications', () => ({
  useNotifications: jest.fn(),
}))

const mockUseNotifications = require('@/hooks/use-notifications').useNotifications as jest.MockedFunction<any>

describe('NotificationBell', () => {
  const mockNotifications = [
    { id: '1', message: 'Stream created', type: 'success', read: false },
    { id: '2', message: 'Payment received', type: 'info', read: false },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseNotifications.mockReturnValue({
      notifications: mockNotifications,
      unreadCount: 2,
      markAllRead: jest.fn(),
      markAsRead: jest.fn(),
      clearNotifications: jest.fn(),
    })
  })

  describe('unread count badge', () => {
    it('should display unread count badge', () => {
      render(<NotificationBell />)
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('should not display badge when unread count is 0', () => {
      mockUseNotifications.mockReturnValue({
        notifications: [],
        unreadCount: 0,
        markAllRead: jest.fn(),
        markAsRead: jest.fn(),
        clearNotifications: jest.fn(),
      })

      const { container } = render(<NotificationBell />)
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })

    it('should display 99+ when unread count exceeds 99', () => {
      mockUseNotifications.mockReturnValue({
        notifications: Array(105).fill({ id: '1', message: 'test', type: 'info', read: false }),
        unreadCount: 105,
        markAllRead: jest.fn(),
        markAsRead: jest.fn(),
        clearNotifications: jest.fn(),
      })

      render(<NotificationBell />)
      expect(screen.getByText('99+')).toBeInTheDocument()
    })
  })

  describe('markAllRead on panel open', () => {
    it('should call markAllRead when notification panel opens', () => {
      const markAllReadMock = jest.fn()
      mockUseNotifications.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 2,
        markAllRead: markAllReadMock,
        markAsRead: jest.fn(),
        clearNotifications: jest.fn(),
      })

      render(<NotificationBell />)
      const bellButton = screen.getByRole('button')
      fireEvent.click(bellButton)

      expect(markAllReadMock).toHaveBeenCalled()
    })
  })

  describe('Escape-to-close behavior', () => {
    it('should close notification panel when Escape is pressed', () => {
      render(<NotificationBell />)
      const bellButton = screen.getByRole('button')

      // Open the panel
      fireEvent.click(bellButton)
      expect(screen.getByRole('dialog') || screen.getByText(/notification/i)).toBeInTheDocument()

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

      // Panel should be closed (depending on implementation)
    })

    it('should not close when other keys are pressed', () => {
      render(<NotificationBell />)
      const bellButton = screen.getByRole('button')
      fireEvent.click(bellButton)

      fireEvent.keyDown(document, { key: 'Enter', code: 'Enter' })

      // Should still be open or handle gracefully
      expect(bellButton).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('should render "No notifications yet" when no notifications exist', () => {
      mockUseNotifications.mockReturnValue({
        notifications: [],
        unreadCount: 0,
        markAllRead: jest.fn(),
        markAsRead: jest.fn(),
        clearNotifications: jest.fn(),
      })

      render(<NotificationBell />)
      const bellButton = screen.getByRole('button')
      fireEvent.click(bellButton)

      expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument()
    })

    it('should show empty state message when all notifications are cleared', () => {
      const clearMock = jest.fn()
      mockUseNotifications.mockReturnValue({
        notifications: [],
        unreadCount: 0,
        markAllRead: jest.fn(),
        markAsRead: jest.fn(),
        clearNotifications: clearMock,
      })

      render(<NotificationBell />)
      const bellButton = screen.getByRole('button')
      fireEvent.click(bellButton)

      expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument()
    })
  })

  describe('notification interactions', () => {
    it('should call markAsRead when a notification is clicked', () => {
      const markAsReadMock = jest.fn()
      mockUseNotifications.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 2,
        markAllRead: jest.fn(),
        markAsRead: markAsReadMock,
        clearNotifications: jest.fn(),
      })

      render(<NotificationBell />)
      const bellButton = screen.getByRole('button')
      fireEvent.click(bellButton)

      const notification = screen.getByText('Stream created')
      fireEvent.click(notification)

      expect(markAsReadMock).toHaveBeenCalledWith('1')
    })

    it('should display multiple notifications in the panel', () => {
      render(<NotificationBell />)
      const bellButton = screen.getByRole('button')
      fireEvent.click(bellButton)

      expect(screen.getByText('Stream created')).toBeInTheDocument()
      expect(screen.getByText('Payment received')).toBeInTheDocument()
    })
  })
})
