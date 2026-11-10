import { z } from 'zod'
import type { CheckoutRequest } from '../api.js'

const pendingCheckoutSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  createdAt: z.string(),
  payload: z.object({
    items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })),
    discountBasisPoints: z.number().int().min(0).max(10_000),
    tenders: z.array(
      z.object({
        kind: z.enum(['cash', 'sandbox']),
        amountMinor: z.number().int().positive(),
      }),
    ),
  }),
})

export type PendingCheckout = {
  idempotencyKey: string
  createdAt: string
  payload: CheckoutRequest
}

const STORAGE_KEY = 'retailflow.pending-checkouts.v1'

export function readPendingCheckouts(): PendingCheckout[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const parsed: unknown = JSON.parse(stored)
    const result = z.array(pendingCheckoutSchema).safeParse(parsed)
    return result.success ? result.data : []
  } catch {
    return []
  }
}

export function writePendingCheckouts(queue: PendingCheckout[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
    return true
  } catch {
    return false
  }
}
