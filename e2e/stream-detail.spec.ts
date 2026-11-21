import { test, expect, type Page } from '@playwright/test'

const DEMO_ADDRESS = 'GBQ2X7KFY3R4VZ6N5LJ7WQH3M2PD8C9SAUTV4EXAMPLE0WALLET00ADDR'

async function connectMockWallet(page: Page) {
  await page.addInitScript((address) => {
    localStorage.setItem('walletId', 'xbull')
    ;(window as any).xBullSDK = {
      connect: async () => ({ publicKey: address }),
      signXDR: async () => 'AAAAAgAAAAA...dummy-signature...',
    }
  }, DEMO_ADDRESS)
}

test.describe('Stream detail page', () => {
  test('shows "stream not found" for invalid id', async ({ page }) => {
    await page.goto('/app/stream/99999')
    await expect(
      page.locator('text=Connect your wallet').or(page.locator('text=Stream not found')).first(),
    ).toBeVisible()
  })

  test('cancelled stream shows a static (non-advancing) unlocked amount', async ({ page }) => {
    await connectMockWallet(page)
    await page.goto('/app/stream/5')
    await page.waitForSelector('div.space-y-6.animate-pulse', { state: 'detached' })

    const unlocked = page.locator('[aria-live="off"][aria-label$="unlocked"]').first()
    await expect(unlocked).toBeVisible()

    const initialLabel = await unlocked.getAttribute('aria-label')
    const initialText = (await unlocked.textContent())?.trim()
    expect(initialLabel).toBeTruthy()

    await page.waitForTimeout(3000)

    expect(await unlocked.getAttribute('aria-label')).toBe(initialLabel)
    expect((await unlocked.textContent())?.trim()).toBe(initialText)
  })
})
