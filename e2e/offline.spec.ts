import { test, expect, type Page } from '@playwright/test'

async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers are not supported in this browser')
    }
    await navigator.serviceWorker.ready
  })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
}

test.describe('Offline PWA support', () => {
  test('serves the cached app shell offline and the offline page for uncached routes', async ({
    page,
    context,
  }) => {
    await page.goto('/app')
    await page.waitForLoadState('networkidle')
    await waitForServiceWorker(page)

    await context.setOffline(true)

    await page.reload()
    await expect(
      page.locator('text=Connect your wallet').or(page.locator('text=Connect wallet')).first(),
    ).toBeVisible()

    await page.goto('/offline-uncached-route')
    await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible()
    await expect(page.getByText("FlowStar can't reach the network right now.")).toBeVisible()
  })
})
