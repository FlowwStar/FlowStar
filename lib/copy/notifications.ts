// Centralized UI copy for the notification bell (components/layout/notification-bell.tsx).
// First step toward i18n-readiness — extracted so this component's strings
// live in one place instead of scattered through JSX (issue #961).

export const notificationsCopy = {
  dismissAria: 'Dismiss notification',
  triggerAriaLabel: (unreadCount: number) =>
    `Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`,
  badgeOverflow: '9+',
  panelAria: 'Notifications',
  heading: 'Notifications',
  clearAll: 'Clear all',
  empty: 'No notifications yet',
}
