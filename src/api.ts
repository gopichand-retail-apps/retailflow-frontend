import { z } from 'zod'
import { isMock, resolveModeApiBaseUrl } from './config'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1'])
const TRACE_ID_KEY = 'retailflow.trace-id.v1'

export function resolveApiBaseUrl(pageOrigin: string, configuredBase?: string): string {
  const pageUrl = new URL(pageOrigin)
  const apiUrl = new URL(configuredBase ?? `${pageUrl.protocol}//${pageUrl.hostname}:5002`)
  if (apiUrl.port === '5002' && LOOPBACK_HOSTS.has(pageUrl.hostname) && LOOPBACK_HOSTS.has(apiUrl.hostname)) {
    apiUrl.hostname = pageUrl.hostname
  }
  return apiUrl.origin
}

function apiBaseUrl(): string {
  const localApiBaseUrl = resolveApiBaseUrl(window.location.origin, import.meta.env.VITE_API_BASE_URL)
  return resolveModeApiBaseUrl({
    isMock,
    mockApiBaseUrl: import.meta.env.VITE_MOCK_API_BASE_URL,
    realApiBaseUrl: import.meta.env.VITE_REAL_API_BASE_URL,
    localApiBaseUrl,
    isDevelopment: import.meta.env.DEV,
  })
}

function traceparentForRequest(): string {
  let traceId: string
  try {
    const stored = sessionStorage.getItem(TRACE_ID_KEY)
    traceId =
      stored && /^[0-9a-f]{32}$/i.test(stored) && !/^0+$/.test(stored)
        ? stored.toLowerCase()
        : crypto.randomUUID().replaceAll('-', '')
    sessionStorage.setItem(TRACE_ID_KEY, traceId)
  } catch {
    traceId = crypto.randomUUID().replaceAll('-', '')
  }

  const spanId = crypto.randomUUID().replaceAll('-', '').slice(0, 16)
  return `00-${traceId}-${spanId}-01`
}

const roleSchema = z.enum(['cashier', 'supervisor', 'store_admin'])
const userSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  displayName: z.string().min(1),
  role: roleSchema,
})
const productSchema = z.object({
  id: z.string(),
  sku: z.string(),
  barcode: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  unitPriceMinor: z.number().int(),
  stockQuantity: z.number().int(),
  lowStockThreshold: z.number().int(),
  imageUrl: z.string(),
})
const overviewSchema = z.object({
  salesToday: z.number().int(),
  grossMinor: z.number().int(),
  lowStockCount: z.number().int(),
  productCount: z.number().int(),
  returnsToday: z.number().int(),
})
const saleSummarySchema = z.object({
  id: z.string(),
  cashierId: z.string(),
  receiptNumber: z.string(),
  status: z.enum(['completed', 'partially_returned', 'returned']),
  subtotalMinor: z.number().int(),
  discountMinor: z.number().int(),
  taxMinor: z.number().int(),
  totalMinor: z.number().int(),
  currency: z.literal('USD'),
  createdAt: z.string(),
})
const saleDetailSchema = saleSummarySchema.extend({
  storeId: z.string(),
  lines: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      sku: z.string(),
      name: z.string(),
      unitPriceMinor: z.number().int(),
      quantity: z.number().int(),
      subtotalMinor: z.number().int(),
      discountMinor: z.number().int(),
      taxMinor: z.number().int(),
      totalMinor: z.number().int(),
      returnedQuantity: z.number().int(),
      refundedMinor: z.number().int(),
    }),
  ),
  tenders: z.array(z.object({ kind: z.enum(['cash', 'sandbox']), amountMinor: z.number().int() })),
  returns: z.array(
    z.object({
      id: z.string(),
      reason: z.string(),
      refundMinor: z.number().int(),
      createdAt: z.string(),
    }),
  ),
})
const storeSettingsSchema = z.object({ name: z.string(), demoTaxBasisPoints: z.number().int() })
const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    traceId: z.string().optional(),
  }),
})
const loginResponseSchema = z.object({ user: userSchema, demoMode: z.boolean() })
const demoRolesResponseSchema = z.object({ roles: z.array(roleSchema).min(1) })
const userResponseSchema = z.object({ user: userSchema })
const productsResponseSchema = z.object({ products: z.array(productSchema) })
const salesResponseSchema = z.object({ sales: z.array(saleSummarySchema) })
const saleResponseSchema = z.object({ sale: saleDetailSchema, duplicate: z.boolean().optional() })
const returnResponseSchema = z.object({
  return: z.object({ id: z.string(), saleId: z.string(), refundMinor: z.number().int(), reason: z.string() }),
})
const settingsResponseSchema = z.object({ settings: storeSettingsSchema })
const adjustmentResponseSchema = z.object({ stockQuantity: z.number().int() })

export type DemoUser = z.infer<typeof userSchema>
export type DemoRole = DemoUser['role']
export type Product = z.infer<typeof productSchema>
export type Overview = z.infer<typeof overviewSchema>
export type SaleSummary = z.infer<typeof saleSummarySchema>
export type SaleDetail = z.infer<typeof saleDetailSchema>
export type StoreSettings = z.infer<typeof storeSettingsSchema>
export type CheckoutRequest = {
  items: Array<{ productId: string; quantity: number }>
  discountBasisPoints: number
  tenders: Array<{ kind: 'cash' | 'sandbox'; amountMinor: number }>
}
export type ReturnRequest = {
  items: Array<{ saleLineId: string; quantity: number }>
  reason: 'customer_request' | 'damaged' | 'other'
}

export class ApiFailure extends Error {
  readonly code: string
  readonly status: number
  readonly traceId: string | undefined

  constructor(code: string, status: number, traceId?: string) {
    super(code)
    this.name = 'ApiFailure'
    this.code = code
    this.status = status
    this.traceId = traceId
  }
}

async function request<T extends z.ZodType>(path: string, schema: T, init: RequestInit = {}): Promise<z.output<T>> {
  const headers = new Headers(init.headers)
  headers.set('X-Request-ID', crypto.randomUUID())
  headers.set('traceparent', traceparentForRequest())
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers, credentials: 'include' })
  const payload: unknown = await response.json().catch(() => undefined)

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(payload)
    const details = parsedError.success ? parsedError.data.error : null
    throw new ApiFailure(details?.code ?? 'REQUEST_FAILED', response.status, details?.traceId)
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) throw new ApiFailure('INVALID_RESPONSE', 502)
  return parsed.data
}

async function requestNoContent(path: string, init: RequestInit = {}): Promise<void> {
  const headers = new Headers(init.headers)
  headers.set('X-Request-ID', crypto.randomUUID())
  headers.set('traceparent', traceparentForRequest())
  const response = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers, credentials: 'include' })
  if (response.ok) return

  const payload: unknown = await response.json().catch(() => undefined)
  const parsedError = apiErrorSchema.safeParse(payload)
  const details = parsedError.success ? parsedError.data.error : null
  throw new ApiFailure(details?.code ?? 'REQUEST_FAILED', response.status, details?.traceId)
}

export const api = {
  me: () => request('/api/v1/auth/me', userResponseSchema),
  demoRoles: () => request('/api/v1/auth/demo-roles', demoRolesResponseSchema),
  login: (role: DemoRole) =>
    request('/api/v1/auth/demo-login', loginResponseSchema, {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),
  logout: () => requestNoContent('/api/v1/auth/logout', { method: 'POST' }),
  overview: () => request('/api/v1/overview', overviewSchema),
  products: () => request('/api/v1/products', productsResponseSchema),
  sales: () => request('/api/v1/sales?limit=50', salesResponseSchema),
  sale: (id: string) => request(`/api/v1/sales/${encodeURIComponent(id)}`, saleResponseSchema),
  createSale: (payload: CheckoutRequest, idempotencyKey: string) =>
    request('/api/v1/sales', saleResponseSchema, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    }),
  returnSale: (saleId: string, payload: ReturnRequest, idempotencyKey: string) =>
    request(`/api/v1/sales/${encodeURIComponent(saleId)}/returns`, returnResponseSchema, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    }),
  adjustStock: (productId: string, payload: { quantityDelta: number; reason: string }) =>
    request(`/api/v1/products/${encodeURIComponent(productId)}/adjustments`, adjustmentResponseSchema, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  settings: () => request('/api/v1/settings', settingsResponseSchema),
  updateSettings: (demoTaxBasisPoints: number) =>
    request('/api/v1/settings', settingsResponseSchema, {
      method: 'PATCH',
      body: JSON.stringify({ demoTaxBasisPoints }),
    }),
}
