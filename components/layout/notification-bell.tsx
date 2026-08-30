'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { formatTimeAgo } from '@/lib/stream-utils'
import { useWallet } from '@/hooks/use-wallet'
import { useNotifications, type AppNotification } from '@/hooks/use-notifications'

function NotificationItem({
  notification,
  onDismiss,
}: {
  notification: AppNotification
  onDismiss: (id: string) => void
  itemRef,
}: {
  notification: AppNotification
  itemRef?: (el: HTMLDivElement | null) => void
}) {
  return (
    <div
      ref={itemRef}
      role="menuitem"
      tabIndex={-1}
      className={
        'border-b border-border px-4 py-3 last:border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ' +
        (notification.read ? 'opacity-60' : '')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{notification.title}</p>
        <div className="flex shrink-0 items-center gap-1.5 mt-0.5">
          {!notification.read && (
            <span className="size-2 rounded-full bg-primary" />
          )}
          <button
            onClick={() => onDismiss(notification.id)}
            aria-label="Dismiss notification"
            className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{notification.body}</p>
      <p className="mt-1 text-xs text-muted-foreground">{formatTimeAgo(notification.timestamp)}</p>
    </div>
  )
}

export function NotificationBell() {
  const { address } = useWallet()
  const { notifications, unreadCount, markAllRead, clearAll, dismissNotification } = useNotifications(address)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (notifications.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => {
          const next = i < notifications.length - 1 ? i + 1 : 0
          itemRefs.current[next]?.focus()
          return next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => {
          const next = i > 0 ? i - 1 : notifications.length - 1
          itemRefs.current[next]?.focus()
          return next
        })
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, notifications.length])

  // Issue #684: move focus into the dropdown on open — first notification
  // item if there is one, otherwise the panel itself.
  useEffect(() => {
    if (!open) return
    itemRefs.current = itemRefs.current.slice(0, notifications.length)
    if (notifications.length > 0) {
      setActiveIndex(0)
      itemRefs.current[0]?.focus()
    } else {
      setActiveIndex(-1)
      panelRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleToggle() {
    setOpen((v) => !v)
    if (!open && unreadCount > 0) {
      markAllRead()
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        data-testid="notification-bell-trigger"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Notifications"
          tabIndex={-1}
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-lg focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onDismiss={dismissNotification} />
              notifications.map((n, idx) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  itemRef={(el) => {
                    itemRefs.current[idx] = el
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
