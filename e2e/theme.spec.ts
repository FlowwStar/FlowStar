import { test, expect, type Page } from '@playwright/test'

async function chooseTheme(page: Page, theme: 'Dark' | 'Light') {
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await page.getByRole('menuitem', { name: theme, exact: true }).click()
}

test.describe('Theme persistence', () => {
  test('selected theme survives a reload', async ({ page }) => {
    await page.goto('/app')

    await chooseTheme(page, 'Dark')
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')

    await page.reload()
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)

    await chooseTheme(page, 'Light')
    await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/)
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light')

    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/)
  })
})
