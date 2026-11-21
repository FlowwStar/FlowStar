import { test, expect } from '@playwright/test'

test.describe('Streams list', () => {
  test('shows the wallet prompt when disconnected', async ({ page }) => {
    await page.goto('/app/streams')
    await expect(page.getByRole('heading', { name: 'Connect your wallet' })).toBeVisible()
  })

  test('renders filters and the stream list or empty state', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('walletId', 'xbull')
      ;(window as any).xBullSDK = {
        connect: async () => ({
          publicKey: 'GBQ2X7KFY3R4VZ6N5LJ7WQH3M2PD8C9SAUTV4EXAMPLE0WALLET00ADDR',
        }),
      }
    })
    await page.goto('/app/streams')

    await expect(page.getByRole('heading', { name: 'Streams' })).toBeVisible()
    await expect(page.getByTestId('streams-search-input')).toBeVisible()
    await expect(page.getByRole('button', { name: 'All tokens' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Streaming' })).toBeVisible()
    await expect(
      page
        .getByTestId(/^stream-card-/)
        .first()
        .or(page.getByText('No streams yet')),
    ).toBeVisible()
  })
})
