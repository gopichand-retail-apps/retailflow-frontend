import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiFailure, type DemoRole, type Product, type SaleDetail } from './api'

const user = {
  id: 'user-cashier-01',
  storeId: 'store-demo-01',
  displayName: 'Alex Morgan',
  role: 'cashier' as DemoRole,
}

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

const sale: SaleDetail = {
  id: 'sale-demo-01',
  cashierId: user.id,
  storeId: user.storeId,
  receiptNumber: 'RF-20261030-TEST0001',
  status: 'completed',
  subtotalMinor: 1840,
  discountMinor: 0,
  taxMinor: 152,
  totalMinor: 1992,
  currency: 'USD',
  createdAt: '2026-10-30T12:00:00.000Z',
  lines: [],
  tenders: [],
  returns: [],
}

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

describe('RetailFlow API client', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('validates successful identity, catalog, sale, settings, and mutation responses', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ user }))
      .mockResolvedValueOnce(jsonResponse({ user, demoMode: true }))
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce(
        jsonResponse({
          salesToday: 1,
          grossMinor: 1992,
          lowStockCount: 1,
          productCount: 8,
          returnsToday: 0,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ products: [product] }))
      .mockResolvedValueOnce(jsonResponse({ sales: [sale] }))
      .mockResolvedValueOnce(jsonResponse({ sale }))
      .mockResolvedValueOnce(jsonResponse({ sale, duplicate: false }))
      .mockResolvedValueOnce(
        jsonResponse({
          return: { id: 'return-01', saleId: sale.id, refundMinor: 1992, reason: 'customer_request' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ stockQuantity: 19 }))
      .mockResolvedValueOnce(jsonResponse({ settings: { name: 'Field & Found', demoTaxBasisPoints: 825 } }))
      .mockResolvedValueOnce(jsonResponse({ settings: { name: 'Field & Found', demoTaxBasisPoints: 900 } }))

    expect(await api.me()).toEqual({ user })
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v1/auth/me')
    expect((await api.login('cashier')).user).toEqual(user)
    await expect(api.logout()).resolves.toBeUndefined()
    expect(await api.overview()).toMatchObject({ salesToday: 1, grossMinor: 1992 })
    expect((await api.products()).products[0]).toEqual(product)
    expect((await api.sales()).sales[0]).toMatchObject({
      id: sale.id,
      cashierId: sale.cashierId,
      receiptNumber: sale.receiptNumber,
      status: sale.status,
      totalMinor: sale.totalMinor,
    })
    expect((await api.sale(sale.id)).sale).toEqual(sale)
    expect(
      (
        await api.createSale(
          {
            items: [{ productId: product.id, quantity: 1 }],
            discountBasisPoints: 0,
            tenders: [{ kind: 'cash', amountMinor: 1992 }],
          },
          'checkout-key-0001',
        )
      ).duplicate,
    ).toBe(false)
    expect(
      (
        await api.returnSale(
          sale.id,
          {
            items: [{ saleLineId: 'sale-line-01', quantity: 1 }],
            reason: 'customer_request',
          },
          'return-key-0001',
        )
      ).return.refundMinor,
    ).toBe(1992)
    expect(
      (await api.adjustStock(product.id, { quantityDelta: 1, reason: 'Receiving correction' })).stockQuantity,
    ).toBe(19)
    expect((await api.settings()).settings.demoTaxBasisPoints).toBe(825)
    expect((await api.updateSettings(900)).settings.demoTaxBasisPoints).toBe(900)

    expect(fetchMock).toHaveBeenCalledTimes(12)
    expect(fetchMock.mock.calls[7]?.[1]).toMatchObject({ method: 'POST' })
    const checkoutHeaders = new Headers(fetchMock.mock.calls[7]?.[1]?.headers)
    expect(checkoutHeaders.get('Idempotency-Key')).toBe('checkout-key-0001')
    expect(checkoutHeaders.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
  })

  it('maps HTTP and invalid response failures to safe ApiFailure values', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: { code: 'AUTH_REQUIRED', message: 'Sign in', traceId: '4bf92f3577b34da6a3ce929d0e0e4736' },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ user: { id: 'invalid' } }))
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => {
          throw new Error('invalid json')
        },
      })

    await expect(api.me()).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      status: 401,
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    })
    await expect(api.me()).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 })
    await expect(api.logout()).rejects.toBeInstanceOf(ApiFailure)
  })

  it('validates server-provided synthetic roles', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ roles: ['cashier', 'supervisor'] }))
    await expect(api.demoRoles()).resolves.toEqual({ roles: ['cashier', 'supervisor'] })
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v1/auth/demo-roles')

    fetchMock.mockResolvedValueOnce(jsonResponse({ roles: ['owner'] }))
    await expect(api.demoRoles()).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 })
  })

  it('validates roles supplied by the backend outside mock mode', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ roles: ['cashier', 'supervisor'] }))
    await expect(api.demoRoles()).resolves.toEqual({ roles: ['cashier', 'supervisor'] })
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v1/auth/demo-roles')

    fetchMock.mockResolvedValueOnce(jsonResponse({ roles: ['owner'] }))
    await expect(api.demoRoles()).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 })
  })

  it('creates a fresh trace context when browser storage is unavailable', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem() {
        throw new Error('Storage unavailable')
      },
      setItem() {
        throw new Error('Storage unavailable')
      },
    })
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        salesToday: 0,
        grossMinor: 0,
        lowStockCount: 0,
        productCount: 0,
        returnsToday: 0,
      }),
    )

    await expect(api.overview()).resolves.toMatchObject({ salesToday: 0 })

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(headers.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
  })
})
