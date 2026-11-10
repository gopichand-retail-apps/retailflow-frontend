import { expect, test } from '@playwright/test'

const expectedDataMode = process.env.VITE_IS_MOCK === 'false' ? 'live' : 'mock'

test('cashier checks out through the selected API with server-owned data', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-mode', expectedDataMode)
  await expect(page.getByRole('button', { name: /Cashier/ })).toBeVisible()
  await page.getByRole('button', { name: /Cashier/ }).click()
  await expect(page.getByRole('heading', { name: 'Build a basket' })).toBeVisible()
  const search = page.getByRole('textbox', { name: 'Search or scan products' })
  await search.fill('850000000001')
  await search.press('Enter')
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await page.locator('.checkout-button').click({ timeout: 2_000 })
  await expect(page.locator('.checkout-modal')).toBeVisible({ timeout: 2_000 })
  await page.locator('.checkout-modal .primary-button').click({ timeout: 2_000 })

  await expect(page.getByRole('heading', { name: 'Receipt' })).toBeVisible()
  const receiptDialog = page.getByRole('dialog')
  await expect(receiptDialog.getByText(/^RF-/)).toBeVisible()
  await expect(receiptDialog.getByText('Daybreak Coffee Beans')).toBeVisible()
})

test('checkout preserves the basket and reports a selected-API outage', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-mode', expectedDataMode)
  await page.getByRole('button', { name: /Cashier/ }).click()
  await expect(page.getByRole('heading', { name: 'Build a basket' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Search or scan products' }).fill('850000000001')
  await page.getByRole('textbox', { name: 'Search or scan products' }).press('Enter')
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await page.route('**/api/v1/sales**', async (route) => {
    if (route.request().method() === 'POST') await route.abort()
    else await route.continue()
  })

  await page.locator('.checkout-button').click()
  await expect(page.locator('.checkout-modal')).toBeVisible()
  await page.locator('#tender-kind').selectOption('sandbox')
  await page.locator('.checkout-modal .primary-button').click()

  await expect(page.locator('.checkout-modal').getByRole('alert')).toHaveText(
    'The API could not be reached. Check the local services and retry.',
  )
  await expect(page.locator('.checkout-modal')).toBeVisible()
  await expect(page.locator('.cart-line')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Receipt' })).toHaveCount(0)
})
