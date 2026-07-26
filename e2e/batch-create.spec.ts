import { test, expect, type Page } from '@playwright/test'

// ─── Shared helper: inject xBull mock so the wallet-gated batch page renders ─
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

function csvFile(name: string, content: string) {
  return {
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(content),
  }
}

const RECIPIENT_A = 'GBQTESTWALLETADDRESS000000000000000000000000000000000000'
const RECIPIENT_B = 'GBQTESTWALLETADDRESS000000000000000000000000000000000001'

test.describe('Batch create — CSV upload flow', () => {
  test.beforeEach(async ({ page }) => {
    await withWallet(page)
    await page.goto('/app/create/batch')
    await page.waitForLoadState('networkidle')
  })

  test('valid CSV uploads and previews all rows as valid', async ({ page }) => {
    const csv = [
      'recipient,amount,start_time,end_time',
      `${RECIPIENT_A},100,2025-01-01T00:00:00Z,2025-12-31T00:00:00Z`,
      `${RECIPIENT_B},250,2025-02-01T00:00:00Z,2025-11-30T00:00:00Z`,
    ].join('\n')

    await page.locator('#csvFile').setInputFiles(csvFile('batch.csv', csv))

    await expect(page.locator('text=Preview rows')).toBeVisible()
    await expect(page.locator('text=2 row(s) loaded, 2 valid.')).toBeVisible()
    await expect(page.locator('td span:has-text("Valid")')).toHaveCount(2)
    await expect(page.locator('button:has-text("Execute batch")')).toBeEnabled()
  })

  test('CSV with invalid rows surfaces per-row errors and disables execution', async ({
    page,
  }) => {
    const csv = [
      'recipient,amount,start_time,end_time',
      `not-a-valid-address,100,2025-01-01T00:00:00Z,2025-12-31T00:00:00Z`,
      `${RECIPIENT_A},abc,2025-01-01T00:00:00Z,2025-12-31T00:00:00Z`,
      `${RECIPIENT_A},100,2025-12-31T00:00:00Z,2025-01-01T00:00:00Z`,
    ].join('\n')

    await page
      .locator('#csvFile')
      .setInputFiles(csvFile('invalid-batch.csv', csv))

    await expect(page.locator('text=3 row(s) loaded, 0 valid.')).toBeVisible()
    await expect(page.locator('text=Invalid recipient address')).toBeVisible()
    await expect(page.locator('text=Invalid amount')).toBeVisible()
    await expect(
      page.locator('text=end_time must be after start_time'),
    ).toBeVisible()
    await expect(
      page.locator('button:has-text("Execute batch")'),
    ).toBeDisabled()
  })

  test('cliff_time column variant is parsed into the preview', async ({
    page,
  }) => {
    const csv = [
      'recipient,amount,start_time,end_time,cliff_time',
      `${RECIPIENT_A},100,2025-01-01T00:00:00Z,2025-12-31T00:00:00Z,2025-03-01T00:00:00Z`,
    ].join('\n')

    await page
      .locator('#csvFile')
      .setInputFiles(csvFile('cliff-time.csv', csv))

    await expect(page.locator('text=1 row(s) loaded, 1 valid.')).toBeVisible()
    const cliffCell = page
      .locator('table tbody tr')
      .first()
      .locator('td')
      .nth(5)
    await expect(cliffCell).not.toContainText('none')
  })

  test('cliff_duration column variant resolves relative to start_time', async ({
    page,
  }) => {
    const csv = [
      'recipient,amount,start_time,end_time,cliff_duration',
      `${RECIPIENT_A},100,2025-01-01T00:00:00Z,2025-12-31T00:00:00Z,30d`,
    ].join('\n')

    await page
      .locator('#csvFile')
      .setInputFiles(csvFile('cliff-duration.csv', csv))

    await expect(page.locator('text=1 row(s) loaded, 1 valid.')).toBeVisible()
    const cliffCell = page
      .locator('table tbody tr')
      .first()
      .locator('td')
      .nth(5)
    await expect(cliffCell).not.toContainText('none')
  })

  test('an out-of-range cliff_duration is flagged as a row error', async ({
    page,
  }) => {
    const csv = [
      'recipient,amount,start_time,end_time,cliff_duration',
      `${RECIPIENT_A},100,2025-01-01T00:00:00Z,2025-02-01T00:00:00Z,400d`,
    ].join('\n')

    await page
      .locator('#csvFile')
      .setInputFiles(csvFile('cliff-duration-invalid.csv', csv))

    await expect(page.locator('text=1 row(s) loaded, 0 valid.')).toBeVisible()
    await expect(
      page.locator('text=cliff_duration must land between start_time and end_time'),
    ).toBeVisible()
  })

  test('rejects non-csv file extensions before parsing', async ({ page }) => {
    await page.locator('#csvFile').setInputFiles({
      name: 'batch.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('recipient,amount,start_time,end_time'),
    })

    await expect(page.locator('text=Please upload a .csv file.')).toBeVisible()
  })
})
