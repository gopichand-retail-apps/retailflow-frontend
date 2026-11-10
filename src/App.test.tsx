import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiFailure, type DemoRole, type DemoUser, type Product, type SaleDetail } from './api'
import App from './App'
import { ContentProvider } from './content'
import { useContent } from './content-context'
import { contentModelSchema } from './content-schema'

const contentModelPath = resolve('public/retailflow-model.json')
const contentModel = JSON.parse(readFileSync(contentModelPath, 'utf8')) as unknown

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

function ContentProbe() {
  const { t } = useContent()
  return <span>{t('brand.name')}</span>
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

describe('RetailFlow app workflows', () => {
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

  it('updates rendered copy and document metadata when the model locale changes', async () => {
    const model = contentModelSchema.parse(contentModel)
    const localizedModel = {
      ...model,
      locale: 'es-ES',
      messages: {
        ...model.messages,
        'brand.name': 'RetailFlow ES',
        'meta.title': 'RetailFlow | Punto de venta',
        'meta.description': 'Demostracion de punto de venta sintetica.',
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => localizedModel,
      }),
    )

    render(
      <ContentProvider appId="retailflow" modelUrl="/retailflow-model.json">
        <ContentProbe />
      </ContentProvider>,
    )

    expect(await screen.findByText('RetailFlow ES')).toBeTruthy()
    expect(document.documentElement.lang).toBe('es-ES')
    expect(document.title).toBe(localizedModel.messages['meta.title'])
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      localizedModel.messages['meta.description'],
    )
  })

  it('signs in a cashier, scans a product, and completes a simulated cash checkout', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByText('Cashier', { selector: 'strong' }))
    await screen.findByRole('heading', { name: 'Build a basket' })
    await user.click(screen.getByRole('button', { name: 'Add Daybreak Coffee Beans to basket' }))
    expect(screen.getAllByText('$19.92').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Continue to tender/ }))
    await user.click(screen.getByRole('button', { name: 'Complete sale' }))

    expect(await screen.findByRole('heading', { name: 'Receipt' })).toBeTruthy()
    await waitFor(() =>
      expect(api.createSale).toHaveBeenCalledWith(
        {
          items: [{ productId: product.id, quantity: 1 }],
          discountBasisPoints: 0,
          tenders: [{ kind: 'cash', amountMinor: 1992 }],
        },
        expect.any(String),
      ),
    )
  })

  it('records a supervisor return and reports the simulated refund', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByText('Supervisor', { selector: 'strong' }))
    await screen.findByRole('heading', { name: 'Build a basket' })
    await user.click(screen.getByRole('button', { name: 'Sales & returns' }))
    await user.click(await screen.findByRole('button', { name: new RegExp(`^${sale.receiptNumber}$`) }))
    await user.click(await screen.findByRole('button', { name: 'Record return' }))
    await user.type(await screen.findByRole('spinbutton', { name: 'Quantity of Daybreak Coffee Beans to return' }), '1')
    await user.click(screen.getByRole('button', { name: 'Record simulated refund' }))

    expect(await screen.findByText('Simulated refund $19.92 recorded.')).toBeTruthy()
    expect(api.returnSale).toHaveBeenCalledWith(
      sale.id,
      { items: [{ saleLineId: 'sale-line-01', quantity: 1 }], reason: 'customer_request' },
      expect.any(String),
    )
  })

  it('saves demo settings only for the store administrator role', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: /Store admin/ }))
    await screen.findByRole('heading', { name: 'Build a basket' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const rate = await screen.findByRole('spinbutton', { name: 'Percentage' })
    await user.clear(rate)
    await user.type(rate, '9.00')
    await user.click(screen.getByRole('button', { name: 'Save tax rate' }))

    expect(await screen.findByText('Tax rate saved.')).toBeTruthy()
    expect(api.updateSettings).toHaveBeenCalledWith(900)
  })

  it('restores a valid server session without showing demo role selection', async () => {
    vi.mocked(api.me).mockResolvedValue({ user: users.cashier })
    renderApp()

    await screen.findByRole('heading', { name: 'Build a basket' })
    expect(screen.queryByRole('heading', { name: 'Choose a local test profile' })).toBeNull()
    expect(api.login).not.toHaveBeenCalled()
  })

  it('uses API-provided roles before authenticating a seeded user', async () => {
    vi.mocked(api.demoRoles).mockResolvedValue({ roles: ['supervisor'] })
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByText('Supervisor', { selector: 'strong' }))
    await screen.findByRole('heading', { name: 'Build a basket' })

    expect(api.demoRoles).toHaveBeenCalledOnce()
    expect(screen.queryByText('Cashier', { selector: 'strong' })).toBeNull()
    expect(api.login).toHaveBeenCalledWith('supervisor')
  })

  it('reports an unknown barcode without changing the basket', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByText('Cashier', { selector: 'strong' }))
    await screen.findByRole('heading', { name: 'Build a basket' })
    const search = screen.getByRole('textbox', { name: 'Search or scan products' })
    await user.type(search, 'not-a-barcode')
    await user.keyboard('{Enter}')

    expect(await screen.findByText('No product matched that barcode or SKU.')).toBeTruthy()
    expect(screen.getByText('Your basket is clear')).toBeTruthy()
  })

  it('keeps offline cash drafts pending until the server confirms sync', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    renderApp()
    await user.click(await screen.findByText('Cashier', { selector: 'strong' }))
    await screen.findByRole('heading', { name: 'Build a basket' })
    await user.click(screen.getByRole('button', { name: 'Add Daybreak Coffee Beans to basket' }))
    await user.click(screen.getByRole('button', { name: /Continue to tender/ }))
    await user.click(await screen.findByRole('button', { name: 'Save cash draft' }))
    expect(await screen.findByText('1 offline cash draft')).toBeTruthy()
    expect(api.createSale).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    window.dispatchEvent(new Event('online'))
    expect(await screen.findByText('Offline cash sale RF-20261030-TEST0001 synced.')).toBeTruthy()
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('retailflow.pending-checkouts.v1') ?? '[]')).toEqual([])
    })
    expect(api.createSale).toHaveBeenCalledOnce()
  })
})
