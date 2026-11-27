import { expect, test, type Page } from '@playwright/test'

// POS-02 against the real local API (in-memory PGlite started by the Playwright config).
const apiBase = `http://127.0.0.1:${process.env.RETAILFLOW_E2E_API_PORT ?? 5004}`
const DRAFT_KEY = 'retailflow.pending-checkouts.v1'

async function signIn(page: Page, role: RegExp): Promise<void> {
  await page.getByRole('button', { name: role }).click()
  await expect(page.getByRole('heading', { name: 'Build a basket' })).toBeVisible()
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: /Cashier/ })).toBeVisible()
}

async function scanCoffee(page: Page): Promise<void> {
  const search = page.getByRole('textbox', { name: 'Search or scan products' })
  await search.fill('850000000001')
  await search.press('Enter')
  await expect(page.locator('.cart-line')).toHaveCount(1)
}

test('a lost checkout reply stays with its cashier and replays to the same receipt', async ({ page }) => {
  await page.goto('/')
  await signIn(page, /Cashier/)
  await scanCoffee(page)

  // The server records the sale, but the reply never reaches the register.
  const recordedReceipts = new Set<string>()
  await page.route('**/api/v1/sales', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const response = await route.fetch()
    const body = (await response.json()) as { sale: { receiptNumber: string } }
    recordedReceipts.add(body.sale.receiptNumber)
    await route.abort('connectionreset')
  })
  await page.getByRole('button', { name: 'Continue to tender' }).click()
  await page.getByRole('button', { name: 'Complete sale', exact: true }).click()

  await expect(page.locator('.pending-banner')).toContainText('Draft saved on this register')
  await expect(page.getByRole('dialog', { name: 'Receipt' })).toHaveCount(0)
  expect(recordedReceipts.size).toBe(1)
  const [recorded] = [...recordedReceipts]
  await page.unroute('**/api/v1/sales')
  await signOut(page)

  // A second operator on the same register neither sees nor submits the draft.
  const supervisorPosts: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/sales')) supervisorPosts.push(request.url())
  })
  await signIn(page, /Supervisor/)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.pending-banner')).toHaveCount(0)
  expect(supervisorPosts).toEqual([])
  expect(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)).toContain('user-cashier-01')
  await signOut(page)

  // The original cashier signs back in; the same key replays the sale the server already recorded.
  await signIn(page, /Cashier/)
  await expect(page.getByText(`Offline cash sale ${recorded} synced.`)).toBeVisible()
  await expect(page.locator('.pending-banner')).toHaveCount(0)
  expect(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)).toBe('[]')
})

test('a return confirmed after an unclear reply is recorded once with one key', async ({ page }) => {
  await page.goto('/')
  await signIn(page, /Cashier/)
  await scanCoffee(page)
  await page.getByRole('button', { name: 'Continue to tender' }).click()
  await page.getByRole('button', { name: 'Complete sale', exact: true }).click()
  const receipt = page.getByRole('dialog', { name: 'Receipt' })
  const receiptNumber = await receipt.getByText(/^RF-/).innerText()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await signOut(page)
  await signIn(page, /Supervisor/)
  await page.getByRole('button', { name: /^Sales & returns/ }).click()
  await page.getByRole('button', { name: receiptNumber, exact: true }).click()
  await page.getByRole('button', { name: 'Record return', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Quantity of Daybreak Coffee Beans to return' }).fill('1')

  // First attempt: the server records the return, then the register sees a 503.
  const keys: string[] = []
  await page.route('**/api/v1/sales/*/returns', async (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '')
    if (keys.length > 1) return route.continue()
    await route.fetch()
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
  })
  await page.getByRole('button', { name: 'Record simulated refund' }).click()
  await expect(page.getByText(/could not confirm whether this return was recorded/)).toBeVisible()
  await page.getByRole('button', { name: 'Confirm return status' }).click()
  await expect(page.getByText('Simulated refund $19.92 recorded.')).toBeVisible()

  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])
  const list = (await (await page.request.get(`${apiBase}/api/v1/sales`)).json()) as {
    sales: Array<{ id: string; receiptNumber: string }>
  }
  const saleId = list.sales.find((sale) => sale.receiptNumber === receiptNumber)?.id
  const detail = (await (await page.request.get(`${apiBase}/api/v1/sales/${saleId}`)).json()) as {
    sale: { returns: unknown[]; lines: Array<{ returnedQuantity: number }> }
  }
  expect(detail.sale.returns).toHaveLength(1)
  expect(detail.sale.lines[0]?.returnedQuantity).toBe(1)
})

test('draft, review and awaiting states fit 320 to 1280 px and work from the keyboard', async ({ page }, info) => {
  const legacyDraft = {
    idempotencyKey: 'offline-checkout-legacy-e2e',
    createdAt: '2026-10-29T09:30:00.000Z',
    payload: {
      items: [{ productId: 'product-coffee-beans', quantity: 1 }],
      discountBasisPoints: 0,
      tenders: [{ kind: 'cash', amountMinor: 1992 }],
    },
  }
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    [DRAFT_KEY, JSON.stringify([legacyDraft])],
  )
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto('/')
  await signIn(page, /Supervisor/)

  // Save a draft of the supervisor's own while offline, so the banner and review list show together.
  await expect(page.getByRole('button', { name: 'Add Daybreak Coffee Beans to basket' })).toBeVisible()
  await page.context().setOffline(true)
  await scanCoffee(page)
  await page.getByRole('button', { name: 'Continue to tender' }).click()
  await page.getByRole('button', { name: 'Save cash draft' }).click()
  await expect(page.locator('.pending-banner')).toBeVisible()
  const summary = page.locator('.review-drafts summary')
  await expect(summary).toHaveText('1 draft on this register needs review')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Owner unknown')).toBeVisible()

  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: info.outputPath(`drafts-${width}.png`), fullPage: true })
  }

  await page.getByRole('button', { name: 'Set aside' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Drafts set aside for supervisor review. Nothing was deleted.')).toBeVisible()
  await expect(page.locator('.pending-banner')).toHaveCount(0)
  await expect(summary).toHaveText('2 drafts on this register need review')

  // An unclear checkout outcome keeps the dialog open in "awaiting confirmation".
  await page.context().setOffline(false)
  await page.route('**/api/v1/sales', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      : route.continue(),
  )
  await scanCoffee(page)
  await page.getByRole('button', { name: 'Continue to tender' }).click()
  await page.getByRole('button', { name: 'Complete sale', exact: true }).click()
  await expect(page.getByText(/could not confirm whether this sale was recorded/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm sale status' })).toBeVisible()
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: info.outputPath(`awaiting-${width}.png`) })
  }
})
