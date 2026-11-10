import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readPendingCheckouts, writePendingCheckouts, type PendingCheckout } from './pending-queue'

const draft: PendingCheckout = {
  idempotencyKey: 'offline-checkout-001',
  createdAt: '2026-10-30T12:00:00.000Z',
  payload: {
    items: [{ productId: 'product-coffee-beans', quantity: 1 }],
    discountBasisPoints: 0,
    tenders: [{ kind: 'cash', amountMinor: 1992 }],
  },
}

describe('offline checkout queue', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('round-trips validated local drafts', () => {
    expect(writePendingCheckouts([draft])).toBe(true)
    expect(readPendingCheckouts()).toEqual([draft])
  })

  it('ignores malformed JSON and entries with invalid schemas', () => {
    localStorage.setItem('retailflow.pending-checkouts.v1', '{')
    expect(readPendingCheckouts()).toEqual([])

    localStorage.setItem('retailflow.pending-checkouts.v1', JSON.stringify([{ bad: true }]))
    expect(readPendingCheckouts()).toEqual([])
  })

  it('reports when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError')
    })

    expect(writePendingCheckouts([draft])).toBe(false)
  })
})
