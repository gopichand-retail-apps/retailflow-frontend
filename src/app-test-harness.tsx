import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { api, ApiFailure, type DemoRole, type DemoUser, type Product, type SaleDetail } from './api'
import App from './App'
import { ContentProvider } from './content'
import { stubNativeDialogs, stubRetailContentModel } from './test-utils'

// Shared fixtures for the draft-ownership and stable-key App tests.
export const STORAGE_KEY = 'retailflow.pending-checkouts.v1'
export const product: Product = {
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
export const users: Record<DemoRole, DemoUser> = {
  cashier: { id: 'user-cashier-01', storeId: 'store-demo-01', displayName: 'Alex Morgan', role: 'cashier' },
  supervisor: { id: 'user-supervisor-01', storeId: 'store-demo-01', displayName: 'Jordan Lee', role: 'supervisor' },
  store_admin: { id: 'user-admin-01', storeId: 'store-demo-01', displayName: 'Taylor Chen', role: 'store_admin' },
}
export const sale: SaleDetail = {
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
export const cashierOwner = { storeId: 'store-demo-01', userId: 'user-cashier-01' }
export const draftPayload = {
  items: [{ productId: product.id, quantity: 1 }],
  discountBasisPoints: 0,
  tenders: [{ kind: 'cash', amountMinor: 1992 }],
}
export const ownedDraft = {
  idempotencyKey: 'offline-checkout-owned',
  createdAt: '2026-10-30T12:00:00.000Z',
  payload: draftPayload,
  owner: cashierOwner,
}
export const legacyDraft = {
  idempotencyKey: 'offline-checkout-legacy',
  createdAt: '2026-10-29T09:30:00.000Z',
  payload: draftPayload,
}

export function seedQueue(entries: unknown[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function storedQueue(): Array<Record<string, unknown>> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<Record<string, unknown>>
}

export function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
}

export function keysSent(spy: { mock: { calls: Array<[unknown, string]> } }): string[] {
  return spy.mock.calls.map((call) => call[1])
}

export async function signIn(role: DemoRole) {
  const user = userEvent.setup()
  const name = role === 'store_admin' ? 'Store admin' : role === 'supervisor' ? 'Supervisor' : 'Cashier'
  render(
    <ContentProvider appId="retailflow" modelUrl="/retailflow-model.json">
      <App />
    </ContentProvider>,
  )
  await user.click(await screen.findByText(name, { selector: 'strong' }))
  await screen.findByRole('heading', { name: 'Build a basket' }, { timeout: 5000 })
  return user
}

export async function switchTo(user: ReturnType<typeof userEvent.setup>, role: DemoRole) {
  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  const name = role === 'store_admin' ? 'Store admin' : role === 'supervisor' ? 'Supervisor' : 'Cashier'
  await user.click(await screen.findByText(name, { selector: 'strong' }))
  await screen.findByRole('heading', { name: 'Build a basket' }, { timeout: 5000 })
}

export async function openTender(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add Daybreak Coffee Beans to basket' }))
  await user.click(screen.getByRole('button', { name: /Continue to tender/ }))
  await screen.findByRole('dialog', { name: 'Choose tender' })
}

export function setupApi(): void {
  stubRetailContentModel()
  vi.spyOn(api, 'me').mockRejectedValue(new ApiFailure('AUTH_REQUIRED', 401))
  vi.spyOn(api, 'demoRoles').mockResolvedValue({ roles: ['cashier', 'supervisor', 'store_admin'] })
  vi.spyOn(api, 'login').mockImplementation(async (role) => ({ user: users[role], demoMode: true }))
  vi.spyOn(api, 'logout').mockResolvedValue(undefined)
  vi.spyOn(api, 'products').mockResolvedValue({ products: [product] })
  vi.spyOn(api, 'sales').mockResolvedValue({ sales: [sale] })
  vi.spyOn(api, 'overview').mockResolvedValue({
    salesToday: 1,
    grossMinor: 1992,
    lowStockCount: 0,
    productCount: 1,
    returnsToday: 0,
  })
  vi.spyOn(api, 'settings').mockResolvedValue({ settings: { name: 'Field & Found', demoTaxBasisPoints: 825 } })
  vi.spyOn(api, 'createSale').mockResolvedValue({ sale, duplicate: false })
  vi.spyOn(api, 'sale').mockResolvedValue({ sale })
  vi.spyOn(api, 'returnSale').mockResolvedValue({
    return: { id: 'return-demo-01', saleId: sale.id, refundMinor: 1992, reason: 'customer_request' },
  })
}

export function prepareHarness(): void {
  stubNativeDialogs()
  setupApi()
}

export function resetHarness(): void {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  setOnline(true)
}
