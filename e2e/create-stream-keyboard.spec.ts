import { test, expect, type Page } from '@playwright/test'

const RECIPIENT = 'GA4M5Y74MXREPXU6LGRR7WOC6VLXJBLKJHZBJGDBKOFIP7GBM3MHF3G5'

async function connectMockWallet(page: Page) {
  await page.addInitScript((address) => {
    localStorage.setItem('walletId', 'xbull')
    ;(window as any).xBullSDK = {
      connect: async () => ({ publicKey: address }),
      signXDR: async () => 'AAAAAgAAAAA...dummy-signature...',
    }
  }, RECIPIENT)
}

async function tabTo(page: Page, selector: string) {
  const target = page.locator(selector).first()
  await expect(target).toBeVisible()
  for (let i = 0; i < 120; i++) {
    if (await target.evaluate((el) => document.activeElement === el)) {
      expect(await target.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
      return
    }
    await page.keyboard.press('Tab')
  }
  throw new Error(`Could not reach ${selector} using only the keyboard`)
}

test.describe('Create stream — keyboard only', () => {
  test('fills and submits the form and reaches the confirmation dialog', async ({ page }) => {
    await connectMockWallet(page)
    await page.goto('/app/create')
    await expect(page.locator('#amount')).toBeVisible()

    await tabTo(page, '#amount')
    await page.keyboard.type('1000')
    await expect(page.locator('#amount')).toHaveValue('1000')

    await tabTo(page, '#recipient')
    await page.keyboard.type(RECIPIENT)
    await expect(page.locator('#recipient')).toHaveValue(RECIPIENT)

    await expect(page.getByText('Checking recipient account...')).toHaveCount(0, {
      timeout: 10000,
    })
    const acknowledge = page.getByRole('button', { name: 'I understand, proceed' })
    if (await acknowledge.isVisible().catch(() => false)) {
      await tabTo(page, 'button:has-text("I understand, proceed")')
      await page.keyboard.press('Enter')
    }

    await tabTo(page, 'button[type="submit"]:has-text("Create stream")')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Transaction Preview')).toBeVisible()

    await tabTo(page, '[role="dialog"] button:has-text("Confirm & Sign")')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Confirm stream creation')).toBeVisible()

    const dialog = page.getByRole('dialog')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  })
})
