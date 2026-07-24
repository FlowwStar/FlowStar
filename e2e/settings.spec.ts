import { test, expect, type Page } from '@playwright/test'

// ─── Shared helper: inject xBull mock so the wallet-gated settings page renders
async function withWallet(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('walletId', 'xbull')
    ;(window as any).xBullSDK = {
      connect: async () => ({
        publicKey: 'GBQTESTWALLETADDRESS000000000000000000000000000000000000',
      }),
      signXDR: async () => 'AAAAAgAAAAA...dummy-signature...',
    }
  })
}

test.describe('Settings page — wallet gate', () => {
  test('shows connect-wallet prompt when not connected', async ({ page }) => {
    await page.goto('/app/settings')
    await expect(
      page.locator('text=Connect your wallet').or(page.locator('text=Connect wallet')).first(),
    ).toBeVisible()
  })
})

test.describe('Settings page — display preferences', () => {
  test.beforeEach(async ({ page }) => {
    await withWallet(page)
    await page.goto('/app/settings')
    await page.waitForLoadState('networkidle')
  })

  test('renders the Settings heading and sections', async ({ page }) => {
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible()
    await expect(page.locator('h2:has-text("Display")')).toBeVisible()
    await expect(page.locator('h2:has-text("Webhooks")')).toBeVisible()
  })

  test('"Show USD values" toggle defaults to checked', async ({ page }) => {
    const usdToggle = page.locator('input[aria-label="Show USD values"]')
    await expect(usdToggle).toBeChecked()
  })

  test('toggling "Show USD values" persists to localStorage', async ({ page }) => {
    const usdToggle = page.locator('input[aria-label="Show USD values"]')
    await expect(usdToggle).toBeChecked()

    await usdToggle.click()
    await expect(usdToggle).not.toBeChecked()

    const stored = await page.evaluate(() => localStorage.getItem('flowstar-show-usd'))
    expect(stored).toBe('false')
  })

  test('USD toggle preference survives a page reload', async ({ page }) => {
    const usdToggle = page.locator('input[aria-label="Show USD values"]')
    await usdToggle.click()
    await expect(usdToggle).not.toBeChecked()

    await page.reload()
    await page.waitForLoadState('networkidle')

    const reloadedToggle = page.locator('input[aria-label="Show USD values"]')
    await expect(reloadedToggle).not.toBeChecked()
  })
})

test.describe('Settings page — webhook management', () => {
  test.beforeEach(async ({ page }) => {
    await withWallet(page)
    await page.goto('/app/settings')
    await page.waitForLoadState('networkidle')
  })

  test('registering a webhook with an invalid URL shows a validation error', async ({
    page,
  }) => {
    await page.locator('#webhook-url').fill('not-a-valid-url')
    await page.locator('button:has-text("Register webhook")').click()
    await expect(page.locator('text=Invalid URL')).toBeVisible()
  })

  test('registers a webhook and shows it in the registered list', async ({ page }) => {
    await page.locator('#webhook-url').fill('https://example.com/webhook')
    await page.locator('button:has-text("Register webhook")').click()

    await expect(page.locator('text=Registered webhooks')).toBeVisible()
    await expect(page.locator('p.font-mono:has-text("https://example.com/webhook")')).toBeVisible()
  })

  test('registered webhook persists across reload', async ({ page }) => {
    await page.locator('#webhook-url').fill('https://example.com/persisted-hook')
    await page.locator('button:has-text("Register webhook")').click()
    await expect(page.locator('text=https://example.com/persisted-hook')).toBeVisible()

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=https://example.com/persisted-hook')).toBeVisible()

    const stored = await page.evaluate(() => localStorage.getItem('flowstar_webhooks'))
    expect(stored).toContain('https://example.com/persisted-hook')
  })

  test('toggling a registered webhook off updates its enabled state', async ({ page }) => {
    await page.locator('#webhook-url').fill('https://example.com/toggle-hook')
    await page.locator('button:has-text("Register webhook")').click()
    await expect(page.locator('text=https://example.com/toggle-hook')).toBeVisible()

    const hookRow = page
      .locator('div')
      .filter({ hasText: 'https://example.com/toggle-hook' })
      .first()
    const disableBtn = hookRow.locator('button[title="Disable"]')
    await disableBtn.click()

    await expect(hookRow.locator('button[title="Enable"]')).toBeVisible()
  })

  test('removing a registered webhook deletes it from the list', async ({ page }) => {
    await page.locator('#webhook-url').fill('https://example.com/remove-hook')
    await page.locator('button:has-text("Register webhook")').click()
    await expect(page.locator('text=https://example.com/remove-hook')).toBeVisible()

    const hookRow = page
      .locator('div')
      .filter({ hasText: 'https://example.com/remove-hook' })
      .first()
    await hookRow.locator('button[title="Remove"]').click()

    await expect(page.locator('text=https://example.com/remove-hook')).not.toBeVisible()
  })

  test('deselecting all event types blocks registration with an error', async ({ page }) => {
    // All 6 event-type pills start selected except "Topped Up" and "Transferred";
    // deselect the four that start selected to reach zero selected events.
    for (const label of ['Stream Created', 'Withdrawal', 'Cancelled', 'Completed']) {
      await page.locator(`button:has-text("${label}")`).click()
    }
    await page.locator('#webhook-url').fill('https://example.com/no-events')
    await page.locator('button:has-text("Register webhook")').click()
    await expect(page.locator('text=Select at least one event type.')).toBeVisible()
  })
})
