import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoUser, Product, SaleDetail, SaleSummary } from '../api'
import { renderWithRetailContent, stubRetailContentModel } from '../test-utils'
import { InventoryView, SalesView, SettingsView } from './StoreViews'

const product: Product = {
  id: 'product-coffee-beans',
  sku: 'PAN-2041',
  barcode: '850000000001',
  name: 'Daybreak Coffee Beans',
  description: '12 oz whole bean medium roast',
  category: 'Pantry',
  unitPriceMinor: 1840,
  stockQuantity: 4,
  lowStockThreshold: 6,
  imageUrl: '/images/coffee-beans.webp',
}

const cashier: DemoUser = {
  id: 'user-cashier-01',
  storeId: 'store-demo-01',
  displayName: 'Alex Morgan',
  role: 'cashier',
}

const supervisor: DemoUser = { ...cashier, id: 'user-supervisor-01', role: 'supervisor' }

const summary: SaleSummary = {
  id: 'sale-demo-01',
  cashierId: cashier.id,
  receiptNumber: 'RF-20261030-TEST0001',
  status: 'completed',
  subtotalMinor: 1840,
  discountMinor: 0,
  taxMinor: 152,
  totalMinor: 1992,
  currency: 'USD',
  createdAt: '2026-10-30T12:00:00.000Z',
}

const detail: SaleDetail = {
  ...summary,
  storeId: 'store-demo-01',
  lines: [
    {
      id: 'sale-line-01',
      productId: product.id,
      sku: product.sku,
      name: product.name,
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

describe('RetailFlow store views', () => {
  beforeEach(stubRetailContentModel)
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('filters receipts and lets a cashier open a sale without return controls', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onReturn = vi.fn()
    renderWithRetailContent(
      <SalesView sales={[summary]} selectedSale={null} user={cashier} onSelect={onSelect} onReturn={onReturn} />,
    )

    await screen.findByRole('heading', { name: 'Sales & returns' })
    await user.click(screen.getByRole('button', { name: summary.receiptNumber }))
    expect(onSelect).toHaveBeenCalledWith(summary.id)
    expect(screen.queryByRole('button', { name: 'Record return' })).toBeNull()
    await user.type(screen.getByRole('textbox', { name: 'Filter receipts' }), 'not-a-receipt')
    expect(screen.getByText('No matching transactions.')).toBeTruthy()
  })

  it('shows supervisor return controls for a selected sale', async () => {
    const onReturn = vi.fn()
    renderWithRetailContent(
      <SalesView sales={[summary]} selectedSale={detail} user={supervisor} onSelect={vi.fn()} onReturn={onReturn} />,
    )

    await screen.findByRole('heading', { name: 'Sales & returns' })
    expect(screen.getByRole('button', { name: 'Record return' })).toBeTruthy()
  })

  it('hides stock adjustment controls from a cashier', async () => {
    renderWithRetailContent(<InventoryView products={[product]} user={cashier} onAdjust={vi.fn()} />)

    await screen.findByRole('heading', { name: 'Inventory' })
    expect(screen.getByText('Supervisor')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add one Daybreak Coffee Beans' })).toBeNull()
  })

  it('records an admin inventory adjustment', async () => {
    const user = userEvent.setup()
    const onAdjust = vi.fn()
    const admin: DemoUser = { ...supervisor, id: 'user-admin-01', role: 'store_admin' }
    renderWithRetailContent(<InventoryView products={[product]} user={admin} onAdjust={onAdjust} />)

    await screen.findByRole('heading', { name: 'Inventory' })
    await user.click(screen.getByRole('button', { name: 'Add one Daybreak Coffee Beans' }))
    expect(onAdjust).toHaveBeenCalledWith(product.id, 1, 'Receiving correction')
  })

  it('prevents removing unavailable stock and records both adjustment directions', async () => {
    const user = userEvent.setup()
    const onAdjust = vi.fn()
    const admin: DemoUser = { ...supervisor, id: 'user-admin-01', role: 'store_admin' }
    const availableProduct = { ...product, stockQuantity: 4 }
    const unavailableProduct = {
      ...product,
      id: 'product-house-blend',
      sku: 'PAN-2042',
      stockQuantity: 0,
      lowStockThreshold: 5,
    }
    renderWithRetailContent(
      <InventoryView products={[availableProduct, unavailableProduct]} user={admin} onAdjust={onAdjust} />,
    )

    await screen.findByRole('heading', { name: 'Inventory' })
    expect(screen.getByRole('button', { name: 'Remove one House Blend Drip' })).toHaveProperty('disabled', true)
    await user.click(screen.getByRole('button', { name: 'Remove one Daybreak Coffee Beans' }))
    await user.click(screen.getByRole('button', { name: 'Add one Daybreak Coffee Beans' }))

    expect(onAdjust).toHaveBeenNthCalledWith(1, product.id, -1, 'Cycle count correction')
    expect(onAdjust).toHaveBeenNthCalledWith(2, product.id, 1, 'Receiving correction')
  })

  it('renders prior refunds and hides return actions for a fully returned sale', async () => {
    const returnedSale: SaleDetail = {
      ...detail,
      status: 'returned',
      tenders: [{ kind: 'sandbox', amountMinor: 1992 }],
      returns: [
        {
          id: 'return-demo-01',
          reason: 'damaged',
          refundMinor: 1992,
          createdAt: '2026-10-30T12:15:00.000Z',
        },
      ],
    }
    renderWithRetailContent(
      <SalesView
        sales={[summary]}
        selectedSale={returnedSale}
        user={supervisor}
        onSelect={vi.fn()}
        onReturn={vi.fn()}
      />,
    )

    await screen.findByRole('heading', { name: 'Sales & returns' })
    expect(screen.getByText(/Sandbox tender/)).toBeTruthy()
    expect(screen.getByText(/Damaged item/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Record return' })).toBeNull()
  })

  it('validates demo rates and saves valid administrator settings', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderWithRetailContent(
      <SettingsView storeName="Field & Found" taxBasisPoints={825} isAdmin busy={false} onSave={onSave} />,
    )
    await screen.findByRole('heading', { name: 'Settings' })
    const rate = screen.getByRole('spinbutton', { name: 'Percentage' })
    await user.clear(rate)
    await user.type(rate, '101')
    await user.click(screen.getByRole('button', { name: 'Save tax rate' }))
    expect(screen.getByText('Enter a test tax rate from 0 to 100.')).toBeTruthy()

    await user.clear(rate)
    await user.type(rate, '9.00')
    await user.click(screen.getByRole('button', { name: 'Save tax rate' }))
    expect(onSave).toHaveBeenCalledWith(900)
  })

  it('shows the permission boundary and busy state for demo settings', async () => {
    const deniedView = renderWithRetailContent(
      <SettingsView storeName="Field & Found" taxBasisPoints={825} isAdmin={false} busy={false} onSave={vi.fn()} />,
    )
    await screen.findByRole('heading', { name: 'Settings' })

    expect(screen.getByRole('spinbutton', { name: 'Percentage' })).toHaveProperty('disabled', true)
    expect(screen.getByText('Store administrator role required to change this value.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save tax rate' })).toBeNull()

    deniedView.unmount()
    renderWithRetailContent(
      <SettingsView storeName="Field & Found" taxBasisPoints={825} isAdmin busy onSave={vi.fn()} />,
    )

    expect(await screen.findByRole('button', { name: 'Saving…' })).toHaveProperty('disabled', true)
  })
})
