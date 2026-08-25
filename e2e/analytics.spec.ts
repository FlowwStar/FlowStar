import { test, expect, type Page } from '@playwright/test'

// The app ships with a built-in mock data store (lib/mock-data.ts) used
// whenever no on-chain contract id is configured. Its streams are keyed to
// DEMO_ADDRESS as sender/recipient, so connecting a mock wallet with this
// exact address surfaces deterministic "mock data" for chart rendering —
// the same convention e2e/visual.spec.ts uses for dashboard screenshots.
const DEMO_ADDRESS = 'GBQ2X7KFY3R4VZ6N5LJ7WQH3M2PD8C9SAUTV4EXAMPLE0WALLET00ADDR'

async function withWallet(page: Page, address: string = DEMO_ADDRESS) {
  await page.addInitScript((walletAddress) => {
    localStorage.setItem('walletId', 'xbull')
    ;(window as any).xBullSDK = {
      connect: async () => ({ publicKey: walletAddress }),
      signXDR: async () => 'AAAAAgAAAAA...dummy-signature...',
    }
  }, address)
}

test.describe('Analytics page — unauthenticated (no data)', () => {
  test('renders page structure with zero-state stats', async ({ page }) => {
    await page.goto('/app/analytics')
    await expect(page.locator('h1:has-text("Platform analytics")')).toBeVisible()
    await expect(page.locator('text=Total volume streamed')).toBeVisible()
    await expect(page.locator('text=Active streams')).toBeVisible()
    await expect(page.locator('text=Total streams created')).toBeVisible()
    await expect(page.locator('text=Average duration')).toBeVisible()
  })

  test('shows empty-state copy in the charts when there is no stream activity', async ({
    page,
  }) => {
    await page.goto('/app/analytics')
    await expect(page.locator('text=No stream activity yet for this period.')).toBeVisible()
    await expect(page.locator('text=No volume data yet.')).toBeVisible()
  })

  test('"Back to dashboard" link navigates to /app', async ({ page }) => {
    await page.goto('/app/analytics')
    await page.locator('a:has-text("Back to dashboard")').click()
    await expect(page).toHaveURL(/\/app$/)
  })
})

test.describe('Analytics page — chart rendering with mock data', () => {
  test.beforeEach(async ({ page }) => {
    await withWallet(page)
    await page.goto('/app/analytics')
    await page.waitForLoadState('networkidle')
  })

  test('default 30-day range reflects the mock streams within that window', async ({
    page,
  }) => {
    // Of the 5 seeded mock streams, only 3 fall within the last 30 days
    // (one is +90d old, one is +120d old); 2 of those 3 are active (one is
    // cancelled).
    const totalCard = page
      .locator('div')
      .filter({ has: page.locator('text=Total streams created') })
      .last()
    await expect(totalCard.locator('text=3')).toBeVisible()

    const activeCard = page
      .locator('div')
      .filter({ has: page.locator('text=Active streams') })
      .last()
    await expect(activeCard.locator('text=2')).toBeVisible()
  })

  test('switching range to "All time" includes all seeded mock streams', async ({
    page,
  }) => {
    await page.locator('button:has-text("30 days")').click()
    await page.locator('text=All time').click()

    const totalCard = page
      .locator('div')
      .filter({ has: page.locator('text=Total streams created') })
      .last()
    await expect(totalCard.locator('text=5')).toBeVisible()

    const activeCard = page
      .locator('div')
      .filter({ has: page.locator('text=Active streams') })
      .last()
    await expect(activeCard.locator('text=3')).toBeVisible()
  })

  test('renders the "Streams created over time" chart with data bars', async ({
    page,
  }) => {
    await expect(page.locator('text=Streams created over time')).toBeVisible()
    await expect(page.locator('text=No stream activity yet for this period.')).not.toBeVisible()
  })

  test('renders "Top tokens by volume" with the seeded token symbols', async ({
    page,
  }) => {
    await expect(page.locator('text=Top tokens by volume')).toBeVisible()
    // The default 30d window includes USDC and XLM denominated streams.
    await expect(page.locator('text=USDC').first()).toBeVisible()
  })

  test('renders "Token distribution" section', async ({ page }) => {
    await expect(page.locator('text=Token distribution')).toBeVisible()
  })

  test('network context card lists available tokens', async ({ page }) => {
    await expect(page.locator('text=Network context')).toBeVisible()
    await expect(page.locator('text=XLM').first()).toBeVisible()
  })
})
