import { test, expect, type Page } from '@playwright/test'

// hooks/use-notifications.ts only polls the RPC for contract events when a
// stream contract ID is configured — e2e runs in mock mode (no contract ID),
// so polling never fires here. Instead we simulate the poller's output: write
// the same AppNotification records it persists to `flowstar:notifications`
// (same titles/bodies as the stream_created / withdrawal / cancel branches),
// then reload so the hook picks them up.

const NOTIF_STORAGE_KEY = 'flowstar:notifications'

type SeedNotification = {
  id: string
  type: 'stream_created' | 'stream_cancelled' | 'withdrawal'
  title: string
  body: string
  read?: boolean
}

const STREAM_CREATED: SeedNotification = {
  id: 'n-created',
  type: 'stream_created',
  title: 'New stream received',
  body: 'A new payment stream has been created for you.',
}

const STREAM_CANCELLED: SeedNotification = {
  id: 'n-cancelled',
  type: 'stream_cancelled',
  title: 'Stream cancelled',
  body: 'A stream you are receiving has been cancelled.',
}

async function seedNotifications(page: Page, notifs: SeedNotification[]) {
  await page.evaluate(
    ({ key, notifs }) => {
      const now = Date.now()
      localStorage.setItem(
        key,
        JSON.stringify(notifs.map((n, i) => ({ read: false, ...n, timestamp: now - i * 1000 }))),
      )
    },
    { key: NOTIF_STORAGE_KEY, notifs },
  )
  await page.reload()
  await page.waitForLoadState('networkidle')
}

async function storedNotifications(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{ id: string; read: boolean }>,
    NOTIF_STORAGE_KEY,
  )
}

function bell(page: Page) {
  return page.getByTestId('notification-bell-trigger')
}

function panel(page: Page) {
  return page.getByRole('menu', { name: 'Notifications' })
}

test.describe('Notification bell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app')
    await page.waitForLoadState('networkidle')
  })

  test('shows an empty state when there are no notifications', async ({ page }) => {
    await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications')

    await bell(page).click()
    await expect(panel(page)).toBeVisible()
    await expect(panel(page).getByText('No notifications yet')).toBeVisible()
    await expect(panel(page).getByRole('button', { name: 'Clear all' })).toHaveCount(0)
  })

  test('a notification appears with an unread badge after a stream event', async ({ page }) => {
    await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications')

    await seedNotifications(page, [STREAM_CREATED])

    await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications (1 unread)')
    await expect(bell(page)).toContainText('1')

    await bell(page).click()
    await expect(panel(page).getByText(STREAM_CREATED.title)).toBeVisible()
    await expect(panel(page).getByText(STREAM_CREATED.body)).toBeVisible()
    await expect(panel(page).getByText('just now')).toBeVisible()
  })

  test('opening the bell marks all notifications as read', async ({ page }) => {
    await seedNotifications(page, [STREAM_CREATED, STREAM_CANCELLED])
    await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications (2 unread)')

    await bell(page).click()
    await expect(panel(page).getByText(STREAM_CREATED.title)).toBeVisible()
    await expect(panel(page).getByText(STREAM_CANCELLED.title)).toBeVisible()

    await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications')
    const stored = await storedNotifications(page)
    expect(stored).toHaveLength(2)
    expect(stored.every((n) => n.read)).toBe(true)
  })

  test('read state persists across a reload', async ({ page }) => {
    await seedNotifications(page, [STREAM_CREATED])
    await bell(page).click()
    await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications')

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications')
    await bell(page).click()
    await expect(panel(page).getByText(STREAM_CREATED.title)).toBeVisible()
  })

  test('dismissing one notification removes only that notification', async ({ page }) => {
    await seedNotifications(page, [STREAM_CREATED, STREAM_CANCELLED])
    await bell(page).click()

    const createdItem = panel(page).getByRole('menuitem').filter({ hasText: STREAM_CREATED.title })
    await createdItem.getByRole('button', { name: 'Dismiss notification' }).click()

    await expect(panel(page).getByText(STREAM_CREATED.title)).toHaveCount(0)
    await expect(panel(page).getByText(STREAM_CANCELLED.title)).toBeVisible()

    const stored = await storedNotifications(page)
    expect(stored.map((n) => n.id)).toEqual([STREAM_CANCELLED.id])
  })

  test('"Clear all" removes every notification', async ({ page }) => {
    await seedNotifications(page, [STREAM_CREATED, STREAM_CANCELLED])
    await bell(page).click()

    await panel(page).getByRole('button', { name: 'Clear all' }).click()

    await expect(panel(page).getByText('No notifications yet')).toBeVisible()
    expect(await storedNotifications(page)).toEqual([])
  })

  test('Escape closes the panel and returns focus to the bell', async ({ page }) => {
    await bell(page).click()
    await expect(panel(page)).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(panel(page)).toHaveCount(0)
    await expect(bell(page)).toBeFocused()
  })
})
