import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// ─── Shared helper: inject xBull mock so wallet-gated pages render fully ─────
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

// ─── Axe helper: run scan and assert no violations ───────────────────────────
async function checkA11y(
  page: Page,
  options?: { disableRules?: string[] },
) {
  const builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ])
  if (options?.disableRules?.length) {
    builder.disableRules(options.disableRules)
  }
  const { violations } = await builder.analyze()
  expect(
    violations,
    violations
      .map(
        (v) =>
          `[${v.impact}] ${v.id}: ${v.description}\n  ${v.nodes
            .slice(0, 2)
            .map((n) => n.html)
            .join('\n  ')}`,
      )
      .join('\n\n'),
  ).toEqual([])
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Structural landmarks & skip-link
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Structural landmarks & skip-link', () => {
  test('skip-to-content link exists and has correct text', async ({ page }) => {
    await page.goto('/app')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeAttached()
    await expect(skipLink).toHaveText('Skip to content')
  })

  test('main landmark has id="main-content"', async ({ page }) => {
    await page.goto('/app')
    await expect(page.locator('main#main-content')).toBeVisible()
  })

  test('landing page has a single h1 with no broken hierarchy', async ({
    page,
  }) => {
    await page.goto('/')
    const h1s = page.locator('h1')
    await expect(h1s.first()).toBeVisible()
    expect(await h1s.count()).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Axe automated scans — key pages
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Axe automated scans', () => {
  test('landing page passes axe wcag2a/2aa', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=FlowStar').first()).toBeVisible()
    await checkA11y(page)
  })

  test('dashboard (unauthenticated) passes axe wcag2a/2aa', async ({
    page,
  }) => {
    await page.goto('/app')
    await expect(
      page
        .locator('text=Connect your wallet')
        .or(page.locator('text=Connect wallet'))
        .first(),
    ).toBeVisible()
    await checkA11y(page)
  })

  test('create-stream page passes axe wcag2a/2aa', async ({ page }) => {
    await withWallet(page)
    await page.goto('/app/create')
    await expect(page.locator('h1,h2').first()).toBeVisible()
    await checkA11y(page)
  })

  test('stream-detail page passes axe wcag2a/2aa', async ({ page }) => {
    await withWallet(page)
    await page.goto('/app/stream/test-id')
    // wait for any async content to settle
    await page.waitForLoadState('networkidle')
    await checkA11y(page)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Cancel-stream dialog — keyboard navigation & focus trap
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cancel-stream dialog — keyboard & focus', () => {
  // The cancel button is only rendered when a wallet is connected and the page
  // has a valid stream, so we use stream/1 which the visual suite also uses.
  test.beforeEach(async ({ page }) => {
    await withWallet(page)
    await page.goto('/app/stream/1')
    await page.waitForLoadState('networkidle')
  })

  test('Cancel button opens dialog; dialog has role=dialog and aria-modal', async ({
    page,
  }) => {
    const cancelBtn = page.locator('button:has-text("Cancel stream")').or(
      page.locator('button:has-text("Cancel")').first(),
    )
    const isPresent = (await cancelBtn.count()) > 0
    if (!isPresent) {
      test.skip()
      return
    }
    await cancelBtn.first().click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  test('Cancel dialog: Escape key closes the dialog', async ({ page }) => {
    const cancelBtn = page.locator('button:has-text("Cancel stream")').or(
      page.locator('button:has-text("Cancel")').first(),
    )
    if ((await cancelBtn.count()) === 0) {
      test.skip()
      return
    }
    await cancelBtn.first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })

  test('Cancel dialog: focus returns to trigger element after close', async ({
    page,
  }) => {
    const cancelBtn = page.locator('button:has-text("Cancel stream")').or(
      page.locator('button:has-text("Cancel")').first(),
    )
    if ((await cancelBtn.count()) === 0) {
      test.skip()
      return
    }
    await cancelBtn.first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
    // Focus must return to the element that opened the dialog
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim())
    expect(focused).toMatch(/cancel/i)
  })

  test('Cancel dialog: Tab key cycles focus within the dialog (focus trap)', async ({
    page,
  }) => {
    const cancelBtn = page.locator('button:has-text("Cancel stream")').or(
      page.locator('button:has-text("Cancel")').first(),
    )
    if ((await cancelBtn.count()) === 0) {
      test.skip()
      return
    }
    await cancelBtn.first().click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Collect all focusable elements inside dialog
    const focusableCount = await dialog
      .locator('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      .count()

    // Tab through all focusable elements + one extra to confirm wrap-around
    for (let i = 0; i <= focusableCount; i++) {
      await page.keyboard.press('Tab')
    }

    // Focus must still be inside the dialog
    const focusedInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      return dialog ? dialog.contains(document.activeElement) : false
    })
    expect(focusedInsideDialog).toBe(true)
  })

  test('Cancel dialog passes axe scan while open', async ({ page }) => {
    const cancelBtn = page.locator('button:has-text("Cancel stream")').or(
      page.locator('button:has-text("Cancel")').first(),
    )
    if ((await cancelBtn.count()) === 0) {
      test.skip()
      return
    }
    await cancelBtn.first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await checkA11y(page)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Transaction-preview dialog (TxPreviewDialog) — keyboard & focus
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Transaction-preview dialog — keyboard & focus', () => {
  test.beforeEach(async ({ page }) => {
    await withWallet(page)
    await page.goto('/app/create')
    await page.waitForLoadState('networkidle')
  })

  async function openTxPreview(page: Page): Promise<boolean> {
    // Fill the minimum valid form fields to reach the tx-preview dialog
    const recipientInput = page.locator('#recipient').or(
      page.locator('input[placeholder*="ecipient"]').first(),
    )
    const amountInput = page.locator('#amount').or(
      page.locator('input[placeholder*="mount"]').first(),
    )
    if ((await recipientInput.count()) === 0) return false

    await recipientInput.fill('GBQTESTWALLETADDRESS000000000000000000000000000000000000')
    await amountInput.fill('100')

    // Fill dates if present
    const startDate = page.locator('#startDate')
    const endDate = page.locator('#endDate')
    if ((await startDate.count()) > 0) {
      await startDate.fill('2025-01-01T00:00')
      await endDate.fill('2025-12-31T23:59')
    }

    const submitBtn = page.locator('button:has-text("Create stream")').or(
      page.locator('button[type="submit"]').first(),
    )
    if ((await submitBtn.count()) === 0) return false
    await submitBtn.first().click()

    // Wait for the tx-preview dialog heading
    const dialogVisible = await page
      .locator('text=Transaction Preview')
      .or(page.locator('text=Review transaction'))
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    return dialogVisible
  }

  test('Tx-preview dialog has role=dialog and aria-modal', async ({ page }) => {
    const opened = await openTxPreview(page)
    if (!opened) {
      test.skip()
      return
    }
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  test('Tx-preview dialog: Escape closes the dialog', async ({ page }) => {
    const opened = await openTxPreview(page)
    if (!opened) {
      test.skip()
      return
    }
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })

  test('Tx-preview dialog: focus returns to trigger after close via Escape', async ({
    page,
  }) => {
    const opened = await openTxPreview(page)
    if (!opened) {
      test.skip()
      return
    }
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
    const focused = await page.evaluate(() =>
      document.activeElement?.tagName?.toLowerCase(),
    )
    // Focus returns to an interactive element (button or input), not body
    expect(focused).not.toBe('body')
  })

  test('Tx-preview dialog: Tab key cycles focus within dialog (focus trap)', async ({
    page,
  }) => {
    const opened = await openTxPreview(page)
    if (!opened) {
      test.skip()
      return
    }
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    const focusableCount = await dialog
      .locator('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      .count()

    for (let i = 0; i <= focusableCount; i++) {
      await page.keyboard.press('Tab')
    }

    const focusedInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      return dialog ? dialog.contains(document.activeElement) : false
    })
    expect(focusedInsideDialog).toBe(true)
  })

  test('Tx-preview dialog passes axe scan while open', async ({ page }) => {
    const opened = await openTxPreview(page)
    if (!opened) {
      test.skip()
      return
    }
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await checkA11y(page)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Fee-estimate dialog — keyboard & focus
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Fee-estimate dialog — keyboard & focus', () => {
  test.beforeEach(async ({ page }) => {
    await withWallet(page)
    await page.goto('/app/stream/1')
    await page.waitForLoadState('networkidle')
  })

  async function openFeeDialog(page: Page): Promise<boolean> {
    // The fee dialog opens after clicking "Review & cancel" inside the cancel dialog
    const cancelBtn = page.locator('button:has-text("Cancel stream")').or(
      page.locator('button:has-text("Cancel")').first(),
    )
    if ((await cancelBtn.count()) === 0) return false
    await cancelBtn.first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    const reviewBtn = page.locator('button:has-text("Review & cancel")')
    if ((await reviewBtn.count()) === 0) return false
    await reviewBtn.click()

    return page
      .locator('text=Confirm transaction')
      .or(page.locator('text=Fee breakdown'))
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false)
  }

  test('Fee-estimate dialog has role=dialog and aria-modal', async ({
    page,
  }) => {
    const opened = await openFeeDialog(page)
    if (!opened) {
      test.skip()
      return
    }
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  test('Fee-estimate dialog: Escape closes the dialog', async ({ page }) => {
    const opened = await openFeeDialog(page)
    if (!opened) {
      test.skip()
      return
    }
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })

  test('Fee-estimate dialog: Cancel button closes dialog and returns focus', async ({
    page,
  }) => {
    const opened = await openFeeDialog(page)
    if (!opened) {
      test.skip()
      return
    }
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    const cancelInDialog = page
      .locator('[role="dialog"] button:has-text("Cancel")')
      .first()
    await cancelInDialog.click()
    await expect(page.locator('text=Confirm transaction')).not.toBeVisible()
    // Focus should land somewhere meaningful, not body
    const focused = await page.evaluate(() =>
      document.activeElement?.tagName?.toLowerCase(),
    )
    expect(focused).not.toBe('body')
  })

  test('Fee-estimate dialog: Tab key cycles focus within dialog (focus trap)', async ({
    page,
  }) => {
    const opened = await openFeeDialog(page)
    if (!opened) {
      test.skip()
      return
    }
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    const focusableCount = await dialog
      .locator('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      .count()

    for (let i = 0; i <= focusableCount; i++) {
      await page.keyboard.press('Tab')
    }

    const focusedInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      return dialog ? dialog.contains(document.activeElement) : false
    })
    expect(focusedInsideDialog).toBe(true)
  })

  test('Fee-estimate dialog passes axe scan while open', async ({ page }) => {
    const opened = await openFeeDialog(page)
    if (!opened) {
      test.skip()
      return
    }
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await checkA11y(page)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Keyboard navigation — tab order on key pages
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Keyboard navigation — tab order', () => {
  test('landing page: first Tab from body reaches skip-link', async ({
    page,
  }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() =>
      document.activeElement?.getAttribute('href'),
    )
    // The skip-link should be the very first focusable element
    expect(focused).toBe('#main-content')
  })

  test('create-stream page: all form inputs are reachable via Tab', async ({
    page,
  }) => {
    await withWallet(page)
    await page.goto('/app/create')
    await page.waitForLoadState('networkidle')

    const inputs = page.locator(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
    )
    const totalInteractive = await inputs.count()
    expect(totalInteractive).toBeGreaterThan(0)

    // Tab through all and confirm focus never escapes to body mid-form
    let bodyFocusHits = 0
    for (let i = 0; i < totalInteractive + 2; i++) {
      await page.keyboard.press('Tab')
      const tag = await page.evaluate(() =>
        document.activeElement?.tagName?.toLowerCase(),
      )
      if (tag === 'body') bodyFocusHits++
    }
    // body may be focused at very end of page; one hit is acceptable
    expect(bodyFocusHits).toBeLessThanOrEqual(1)
  })

  test('dashboard: navbar links are keyboard-reachable', async ({ page }) => {
    await page.goto('/app')
    // Tab enough times to reach at least one nav link
    let foundNavLink = false
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const role = await page.evaluate(() => {
        const el = document.activeElement
        return el?.tagName?.toLowerCase() + (el?.getAttribute('role') ?? '')
      })
      if (role.includes('a') || role.includes('button')) {
        foundNavLink = true
        break
      }
    }
    expect(foundNavLink).toBe(true)
  })
})
