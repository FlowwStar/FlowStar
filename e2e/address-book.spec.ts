import { test, expect, type Page } from '@playwright/test'

// ─── Shared helper: inject xBull mock so the wallet-gated create page renders ─
async function withWallet(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('walletId', 'xbull')
    ;(window as any).xBullSDK = {
      connect: async () => ({
        publicKey: 'GA4M5Y74MXREPXU6LGRR7WOC6VLXJBLKJHZBJGDBKOFIP7GBM3MHF3G5',
      }),
      signXDR: async () => 'AAAAAgAAAAA...dummy-signature...',
    }
  })
}

const ADDRESS_BOOK_KEY = 'flowstar:address-book'
const RECIPIENT = 'GBDQ4BW2OFH65L62HPK7CGYDIP35NXDW2I7X3RS3FEDJTTIYN7WN2AGR'
const DEFAULT_LABEL = 'Saved recipient'

async function openCreateForm(page: Page) {
  await page.goto('/app/create')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#recipient')).toBeVisible()
}

async function saveRecipient(page: Page, address: string) {
  await page.locator('#recipient').fill(address)
  const saveBtn = page.getByRole('button', { name: 'Save recipient' })
  await expect(saveBtn).toBeEnabled()
  await saveBtn.click()
  // .last(): saving twice in one test stacks two toasts.
  await expect(page.getByText('Recipient saved').last()).toBeVisible()
}

async function storedEntries(page: Page) {
  return page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key) ?? '[]') as Array<{
        id: string
        label: string
        address: string
      }>,
    ADDRESS_BOOK_KEY,
  )
}

function recentRecipients(page: Page) {
  return page.getByText('Recent recipients').locator('..')
}

function suggestionChip(page: Page) {
  return recentRecipients(page).getByTitle(RECIPIENT)
}

test.describe('Address book — create form', () => {
  test.beforeEach(async ({ page }) => {
    await withWallet(page)
    await openCreateForm(page)
  })

  test('shows no recent recipients when the address book is empty', async ({ page }) => {
    await expect(page.getByText('Recent recipients')).toHaveCount(0)
  })

  test('"Save recipient" stays disabled for an invalid address', async ({ page }) => {
    await page.locator('#recipient').fill('not-a-stellar-address')
    await expect(page.getByRole('button', { name: 'Save recipient' })).toBeDisabled()
  })

  test('saving a recipient adds it to the address book', async ({ page }) => {
    await saveRecipient(page, RECIPIENT)

    await expect(page.getByText('Recent recipients')).toBeVisible()
    await expect(suggestionChip(page)).toContainText(DEFAULT_LABEL)
    await expect(suggestionChip(page)).toContainText(RECIPIENT.slice(0, 8))

    const stored = await storedEntries(page)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ address: RECIPIENT, label: DEFAULT_LABEL })
  })

  test('saving the same address twice does not duplicate the entry', async ({ page }) => {
    await saveRecipient(page, RECIPIENT)
    await saveRecipient(page, RECIPIENT)

    await expect(recentRecipients(page).getByTitle(RECIPIENT)).toHaveCount(1)
    expect(await storedEntries(page)).toHaveLength(1)
  })

  test('a saved recipient is suggested on a later visit and fills the field', async ({ page }) => {
    await saveRecipient(page, RECIPIENT)

    await page.goto('/app')
    await openCreateForm(page)

    await expect(page.locator('#recipient')).toHaveValue('')
    await expect(suggestionChip(page)).toBeVisible()

    await suggestionChip(page).click()
    await expect(page.locator('#recipient')).toHaveValue(RECIPIENT)
  })

  test('renaming a saved recipient updates its label', async ({ page }) => {
    await saveRecipient(page, RECIPIENT)

    await page.getByRole('button', { name: `Rename ${DEFAULT_LABEL}` }).click()
    const dialog = page.getByRole('dialog', { name: 'Rename recipient' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Label').fill('Alice payroll')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('Recipient renamed')).toBeVisible()
    await expect(suggestionChip(page)).toContainText('Alice payroll')

    const stored = await storedEntries(page)
    expect(stored[0]).toMatchObject({ address: RECIPIENT, label: 'Alice payroll' })

    // The new label survives a later visit.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(suggestionChip(page)).toContainText('Alice payroll')
  })

  test('removing a saved recipient deletes it from the address book', async ({ page }) => {
    await saveRecipient(page, RECIPIENT)

    await page.getByRole('button', { name: `Remove ${DEFAULT_LABEL}` }).click()

    await expect(page.getByText('Recipient removed')).toBeVisible()
    await expect(page.getByText('Recent recipients')).toHaveCount(0)
    expect(await storedEntries(page)).toEqual([])

    // And it stays gone on a later visit.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Recent recipients')).toHaveCount(0)
  })
})
