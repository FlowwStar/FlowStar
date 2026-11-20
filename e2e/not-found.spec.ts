import { test, expect } from '@playwright/test'

test.describe('Not-found pages', () => {
  test('renders the app not-found page for an unknown route', async ({ page }) => {
    await page.goto('/does-not-exist')

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await expect(
      page.getByText("The page you're looking for doesn't exist or has been moved."),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  })

  test('renders the stream not-found state for an unknown stream id', async ({ page }) => {
    await page.goto('/app/stream/999999999')

    await expect(page.getByText('Stream not found')).toBeVisible()
    await expect(page.getByText('This stream may not exist or may have expired.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
      'href',
      '/app',
    )
  })
})
