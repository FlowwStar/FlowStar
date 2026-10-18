import { test, expect } from '@playwright/test'

test.describe('Landing page', () => {
  test('renders hero and navigates to app', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('banner').getByText('FlowStar', { exact: true })).toBeVisible()
    await expect(page.locator('text=Open app').first()).toBeVisible()

    await page.locator('text=Open app').first().click()
    await expect(page).toHaveURL('/app')
  })

  test('renders feature sections', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=How It Works').first()).toBeVisible()
  })
})
