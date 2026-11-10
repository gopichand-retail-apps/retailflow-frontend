import { cleanup, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoUser, Product } from '../api'
import type { CartEntry, CartTotals } from '../domain/money'
import { renderWithRetailContent, stubRetailContentModel } from '../test-utils'
import { CartPanel } from './CartPanel'

const product: Product = {
  id: 'product-coffee-beans',
  sku: 'PAN-2041',
  barcode: '850000000001',
  name: 'Daybreak Coffee Beans',
  description: '12 oz whole bean medium roast',
  category: 'Pantry',
  unitPriceMinor: 1840,
  stockQuantity: 1,
  lowStockThreshold: 6,
  imageUrl: '/images/coffee-beans.webp',
}
const cashier: DemoUser = {
  id: 'user-cashier-01',
  storeId: 'store-demo-01',
  displayName: 'Alex Morgan',
  role: 'cashier',
}
const entry: CartEntry = { product, quantity: 1 }
const totals: CartTotals = { subtotalMinor: 1840, discountMinor: 0, taxMinor: 152, totalMinor: 1992 }

describe('CartPanel', () => {
  beforeEach(stubRetailContentModel)
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('keeps checkout disabled when the basket is empty', async () => {
    renderWithRetailContent(
      <CartPanel
        entries={[]}
        totals={{ subtotalMinor: 0, discountMinor: 0, taxMinor: 0, totalMinor: 0 }}
        products={[product]}
        user={cashier}
        discountBasisPoints={0}
        onDiscountChange={vi.fn()}
        onQuantityChange={vi.fn()}
        onCheckout={vi.fn()}
      />,
    )

    await screen.findByText('Your basket is clear')
    expect(screen.getByRole('button', { name: /Continue to tender/ })).toHaveProperty('disabled', true)
  })

  it('changes role-allowed discount and invokes checkout', async () => {
    const user = userEvent.setup()
    const onDiscountChange = vi.fn()
    const onCheckout = vi.fn()
    renderWithRetailContent(
      <CartPanel
        entries={[entry]}
        totals={totals}
        products={[product]}
        user={cashier}
        discountBasisPoints={0}
        onDiscountChange={onDiscountChange}
        onQuantityChange={vi.fn()}
        onCheckout={onCheckout}
      />,
    )

    await screen.findByRole('heading', { name: 'Basket' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Discount' }), '500')
    await user.click(screen.getByRole('button', { name: /Continue to tender/ }))

    expect(onDiscountChange).toHaveBeenCalledWith(500)
    expect(onCheckout).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Add one Daybreak Coffee Beans' })).toHaveProperty('disabled', true)
  })

  it('lets a supervisor apply a larger discount and adjust an available item', async () => {
    const user = userEvent.setup()
    const onDiscountChange = vi.fn()
    const onQuantityChange = vi.fn()
    const onCheckout = vi.fn()
    const supervisor: DemoUser = { ...cashier, role: 'supervisor' }
    const stockedProduct = { ...product, stockQuantity: 4 }
    const multipleItems: CartEntry = { product: stockedProduct, quantity: 2 }
    const discountedTotals: CartTotals = {
      subtotalMinor: 3680,
      discountMinor: 920,
      taxMinor: 228,
      totalMinor: 2988,
    }
    const rendered = renderWithRetailContent(
      <CartPanel
        entries={[multipleItems]}
        totals={discountedTotals}
        products={[stockedProduct]}
        user={supervisor}
        discountBasisPoints={2500}
        onDiscountChange={onDiscountChange}
        onQuantityChange={onQuantityChange}
        onCheckout={onCheckout}
      />,
    )

    await screen.findByRole('heading', { name: 'Basket' })
    expect(screen.getByText('−$9.20')).toBeTruthy()
    const discountSelect = screen.getByRole('combobox', { name: 'Discount' }) as HTMLSelectElement
    expect(Array.from(discountSelect.options).some((option) => option.value === '5000')).toBe(true)

    const productImage = rendered.container.querySelector('.cart-line img')
    if (!productImage) throw new Error('Expected the cart product image to render')
    fireEvent.error(productImage)
    expect(productImage.classList.contains('is-missing')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Remove one Daybreak Coffee Beans' }))
    await user.click(screen.getByRole('button', { name: 'Add one Daybreak Coffee Beans' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Discount' }), '5000')

    expect(onQuantityChange).toHaveBeenNthCalledWith(1, product.id, 1)
    expect(onQuantityChange).toHaveBeenNthCalledWith(2, product.id, 3)
    expect(onDiscountChange).toHaveBeenCalledWith(5000)
    expect(onCheckout).not.toHaveBeenCalled()
  })
})
