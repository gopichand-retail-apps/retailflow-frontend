import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiFailure, type DemoRole, type DemoUser, type Product, type SaleDetail } from './api'
import App from './App'
import { ContentProvider } from './content'

const contentModel = JSON.parse(readFileSync(resolve('public/retailflow-model.json'), 'utf8')) as unknown
const product: Product = {
  id: 'product-coffee-beans',
  sku: 'PAN-2041',
  barcode: '850000000001',
  name: 'Daybreak Coffee Beans',
  description: '12 oz whole bean bag',
  category: 'Pantry',
  unitPriceMinor: 1840,
  stockQuantity: 18,
  lowStockThreshold: 6,
  imageUrl: '/images/coffee-beans.webp',
}
const users: Record<DemoRole, DemoUser> = {
  cashier: { id: 'user-cashier-01', storeId: 'store-demo-01', displayName: 'Alex Morgan', role: 'cashier' },
  supervisor: { id: 'user-supervisor-01', storeId: 'store-demo-01', displayName: 'Jordan Lee', role: 'supervisor' },
  store_admin: { id: 'user-admin-01', storeId: 'store-demo-01', displayName: 'Taylor Chen', role: 'store_admin' },
}
const sale: SaleDetail = {
  id: 'sale-demo-01',
  cashierId: users.cashier.id,
  storeId: 'store-demo-01',
  receiptNumber: 'RF-20261030-TEST0001',
  status: 'completed',
  subtotalMinor: 1840,
  discountMinor: 0,
  taxMinor: 152,
  totalMinor: 1992,
  currency: 'USD',
  createdAt: '2026-10-30T12:00:00.000Z',
  lines: [
    {
      id: 'sale-line-01',
      productId: product.id,
      sku: product.sku,
      name: 'Daybreak Coffee Beans',
      unitPriceMinor: 1840,
      quantity: 1,
      subtotalMinor: 1840,
      discountMinor: 0,
      taxMinor: 152,
      totalMinor: 1992,
      returnedQuantity: 0,
      refundedMinor: 0,
    },
  ],
  tenders: [{ kind: 'cash', amountMinor: 1992 }],
  returns: [],
}

function renderApp() {
  return render(
    <ContentProvider appId="retailflow" modelUrl="/retailflow-model.json">
      <App />
    </ContentProvider>,
  )
}

async function signInAs(role: DemoRole) {
  const user = userEvent.setup()
  const name = role === 'store_admin' ? 'Store admin' : role === 'supervisor' ? 'Supervisor' : 'Cashier'
  renderApp()
  await user.click(await screen.findByText(name, { selector: 'strong' }))
  await screen.findByRole('heading', { name: 'Build a basket' }, { timeout: 5000 })
  return user
}

function setupApi(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => contentModel,
    }),
  )
  vi.spyOn(api, 'me').mockRejectedValue(new ApiFailure('AUTH_REQUIRED', 401))
  vi.spyOn(api, 'demoRoles').mockResolvedValue({ roles: ['cashier', 'supervisor', 'store_admin'] })
  vi.spyOn(api, 'login').mockImplementation(async (role) => ({ user: users[role], demoMode: true }))
  vi.spyOn(api, 'products').mockResolvedValue({ products: [product] })
  vi.spyOn(api, 'sales').mockResolvedValue({ sales: [sale] })
  vi.spyOn(api, 'overview').mockResolvedValue({
    salesToday: 1,
    grossMinor: 1992,
    lowStockCount: 0,
    productCount: 1,
    returnsToday: 0,
  })
  vi.spyOn(api, 'settings').mockResolvedValue({
    settings: { name: 'Field & Found', demoTaxBasisPoints: 825 },
  })
  vi.spyOn(api, 'createSale').mockResolvedValue({ sale, duplicate: false })
  vi.spyOn(api, 'sale').mockResolvedValue({ sale })
  vi.spyOn(api, 'returnSale').mockResolvedValue({
    return: { id: 'return-demo-01', saleId: sale.id, refundMinor: 1992, reason: 'customer_request' },
  })
  vi.spyOn(api, 'adjustStock').mockResolvedValue({ stockQuantity: 19 })
  vi.spyOn(api, 'updateSettings').mockResolvedValue({
    settings: { name: 'Field & Found', demoTaxBasisPoints: 900 },
  })
}

describe('RetailFlow app recovery workflows', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '')
      },
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open')
        this.dispatchEvent(new Event('close'))
      },
    })
    setupApi()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
    sessionStorage.clear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('waits for session restoration before showing the workspace', async () => {
    let resolveSession: (value: { user: DemoUser }) => void = () => {}
    vi.mocked(api.me).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve
        }),
    )
    renderApp()

    expect(await screen.findByText('Opening store workspace…')).toBeTruthy()
    resolveSession({ user: users.cashier })
    await screen.findByRole('heading', { name: 'Build a basket' }, { timeout: 5000 })
  })

  it('surfaces role-service failures instead of offering unsupported roles', async () => {
    vi.mocked(api.demoRoles).mockRejectedValueOnce(new ApiFailure('ROLE_SERVICE_UNAVAILABLE', 503))
    renderApp()

    expect((await screen.findByRole('alert')).textContent).toContain('request could not be completed')
    expect(screen.queryByRole('button', { name: /Cashier/ })).toBeNull()
  })

  it('shows and dismisses a safe notice when initial store data cannot load', async () => {
    vi.mocked(api.products).mockRejectedValueOnce(new ApiFailure('CATALOG_UNAVAILABLE', 503))
    const user = await signInAs('cashier')

    expect((await screen.findByRole('status')).textContent).toContain('request could not be completed')
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(screen.queryByText(/request could not be completed/i)).toBeNull()
  })

  it('keeps sandbox checkout errors in the tender dialog', async () => {
    vi.mocked(api.createSale).mockRejectedValueOnce(new ApiFailure('CHECKOUT_REJECTED', 409))
    const user = await signInAs('cashier')

    await user.click(screen.getByRole('button', { name: 'Add Daybreak Coffee Beans to basket' }))
    await user.click(screen.getByRole('button', { name: /Continue to tender/ }))
    await screen.findByRole('dialog', { name: 'Choose tender' }, { timeout: 5000 })
    await user.selectOptions(screen.getByLabelText('Tender method'), 'sandbox')
    await user.click(screen.getByRole('button', { name: 'Complete sale' }))

    expect((await screen.findByRole('alert')).textContent).toContain('request could not be completed')
    expect(screen.queryByText(/offline cash draft/)).toBeNull()
  })

  it('does not open a receipt when checkout idempotency reports a duplicate', async () => {
    vi.mocked(api.createSale).mockResolvedValueOnce({ sale, duplicate: true })
    const user = await signInAs('cashier')

    await user.click(screen.getByRole('button', { name: 'Add Daybreak Coffee Beans to basket' }))
    await user.click(screen.getByRole('button', { name: /Continue to tender/ }))
    await user.click(await screen.findByRole('button', { name: 'Complete sale' }))

    expect(await screen.findByText('Sale was already recorded. Duplicate request ignored.')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Receipt' })).toBeNull()
    expect(await screen.findByRole('heading', { name: 'Sales & returns' })).toBeTruthy()
  })

  it('retains offline drafts after a sync error and retries them explicitly', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    vi.mocked(api.createSale)
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce({ sale, duplicate: false })
    const user = await signInAs('cashier')

    await user.click(screen.getByRole('button', { name: 'Add Daybreak Coffee Beans to basket' }))
    await user.click(screen.getByRole('button', { name: /Continue to tender/ }))
    await user.click(await screen.findByRole('button', { name: 'Save cash draft' }))
    expect(await screen.findByText('1 offline cash draft')).toBeTruthy()

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    window.dispatchEvent(new Event('online'))
    expect(
      await screen.findByText(
        'Offline draft needs review: The API could not be reached. Check the local services and retry.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('1 offline cash draft')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Retry sync' }))
    expect(await screen.findByText('Offline cash sale RF-20261030-TEST0001 synced.')).toBeTruthy()
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('retailflow.pending-checkouts.v1') ?? '[]')).toEqual([])
    })
  })

  it('requires confirmation before clearing pending cash drafts', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const user = await signInAs('cashier')
    await user.click(screen.getByRole('button', { name: 'Add Daybreak Coffee Beans to basket' }))
    await user.click(screen.getByRole('button', { name: /Continue to tender/ }))
    await user.click(await screen.findByRole('button', { name: 'Save cash draft' }))
    expect(await screen.findByText('1 offline cash draft')).toBeTruthy()

    const confirm = vi.spyOn(window, 'confirm')
    confirm.mockReturnValueOnce(false).mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByText('1 offline cash draft')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(screen.queryByText('1 offline cash draft')).toBeNull())
    expect(JSON.parse(localStorage.getItem('retailflow.pending-checkouts.v1') ?? '[]')).toEqual([])
  })

  it('shows a safe notice when opening a sale fails', async () => {
    vi.mocked(api.sale).mockRejectedValueOnce(new ApiFailure('SALE_UNAVAILABLE', 503))
    const user = await signInAs('supervisor')

    await user.click(screen.getByRole('button', { name: 'Sales & returns' }))
    await user.click(await screen.findByRole('button', { name: sale.receiptNumber }))

    expect((await screen.findByRole('status')).textContent).toContain('request could not be completed')
  })

  it('keeps return failures visible in the selected sale workflow', async () => {
    vi.mocked(api.returnSale).mockRejectedValueOnce(new ApiFailure('RETURN_UNAVAILABLE', 503))
    const user = await signInAs('supervisor')

    await user.click(screen.getByRole('button', { name: 'Sales & returns' }))
    await user.click(await screen.findByRole('button', { name: sale.receiptNumber }))
    await user.click(await screen.findByRole('button', { name: 'Record return' }))
    await user.type(await screen.findByRole('spinbutton', { name: 'Quantity of Daybreak Coffee Beans to return' }), '1')
    await user.click(screen.getByRole('button', { name: 'Record simulated refund' }))

    expect((await screen.findByRole('alert')).textContent).toContain('request could not be completed')
    expect(screen.getByRole('heading', { name: 'Return items' })).toBeTruthy()
  })

  it('reports stock and settings mutation failures safely', async () => {
    vi.mocked(api.adjustStock).mockRejectedValueOnce(new ApiFailure('STOCK_UNAVAILABLE', 503))
    const user = await signInAs('store_admin')

    await user.click(screen.getByRole('button', { name: 'Inventory' }))
    await user.click(await screen.findByRole('button', { name: 'Add one Daybreak Coffee Beans' }))
    expect((await screen.findByRole('status')).textContent).toContain('request could not be completed')

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }))
    vi.mocked(api.updateSettings).mockRejectedValueOnce(new ApiFailure('SETTINGS_UNAVAILABLE', 503))
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(await screen.findByRole('button', { name: 'Save tax rate' }))

    expect((await screen.findByRole('status')).textContent).toContain('request could not be completed')
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
  })
})
