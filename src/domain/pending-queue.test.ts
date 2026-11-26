import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addDraft,
  loadDraftQueue,
  ownedDrafts,
  removeDraft,
  reviewDrafts,
  saveDraftQueue,
  setAsideDrafts,
  type DraftOwner,
  type PendingCheckout,
} from './pending-queue'

const STORAGE_KEY = 'retailflow.pending-checkouts.v1'
const cashier: DraftOwner = { storeId: 'store-demo-01', userId: 'user-cashier-01' }
const otherCashier: DraftOwner = { storeId: 'store-demo-01', userId: 'user-cashier-02' }
const otherStoreCashier: DraftOwner = { storeId: 'store-demo-02', userId: 'user-cashier-01' }

function makeDraft(owner: DraftOwner, key: string): PendingCheckout {
  return {
    idempotencyKey: key,
    createdAt: '2026-10-30T12:00:00.000Z',
    payload: {
      items: [{ productId: 'product-coffee-beans', quantity: 2 }],
      discountBasisPoints: 0,
      tenders: [{ kind: 'cash', amountMinor: 3984 }],
    },
    owner,
  }
}

const legacyDraft = {
  idempotencyKey: 'offline-checkout-legacy',
  createdAt: '2026-10-29T09:30:00.000Z',
  payload: {
    items: [{ productId: 'product-coffee-beans', quantity: 1 }],
    discountBasisPoints: 0,
    tenders: [{ kind: 'cash', amountMinor: 1992 }],
  },
}

function stored(): unknown[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown[]
}

describe('ownership-aware draft queue', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('round-trips drafts together with the operator who saved them', () => {
    const draft = makeDraft(cashier, 'offline-checkout-001')
    expect(saveDraftQueue(addDraft(loadDraftQueue(), draft))).toBe(true)

    expect(ownedDrafts(loadDraftQueue(), cashier)).toEqual([draft])
  })

  it('offers a draft only to the same operator in the same store', () => {
    let queue = addDraft(loadDraftQueue(), makeDraft(cashier, 'offline-checkout-001'))
    queue = addDraft(queue, makeDraft(otherCashier, 'offline-checkout-002'))
    queue = addDraft(queue, makeDraft(otherStoreCashier, 'offline-checkout-003'))

    expect(ownedDrafts(queue, cashier).map((draft) => draft.idempotencyKey)).toEqual(['offline-checkout-001'])
    expect(ownedDrafts(queue, otherCashier).map((draft) => draft.idempotencyKey)).toEqual(['offline-checkout-002'])
    expect(ownedDrafts(queue, otherStoreCashier).map((draft) => draft.idempotencyKey)).toEqual(['offline-checkout-003'])
    expect(reviewDrafts(queue, 'store-demo-01')).toEqual([])
  })

  it('keeps a legacy draft with no owner for review and never offers it for sync', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([legacyDraft]))
    const queue = loadDraftQueue()

    expect(ownedDrafts(queue, cashier)).toEqual([])
    expect(reviewDrafts(queue, 'store-demo-01')).toEqual([
      {
        reason: 'unknown_owner',
        createdAt: '2026-10-29T09:30:00.000Z',
        unitCount: 1,
        totalMinor: 1992,
        storeId: null,
      },
    ])

    expect(saveDraftQueue(queue)).toBe(true)
    expect(stored()).toEqual([legacyDraft])
  })

  it('keeps malformed storage and invalid entries for review instead of dropping them', () => {
    localStorage.setItem(STORAGE_KEY, '{ not json')
    const malformed = loadDraftQueue()
    expect(reviewDrafts(malformed, 'store-demo-01')).toEqual([
      { reason: 'unreadable', createdAt: null, unitCount: null, totalMinor: null, storeId: null },
    ])
    expect(saveDraftQueue(malformed)).toBe(true)
    expect(JSON.stringify(stored())).toContain('{ not json')

    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ bad: true }, legacyDraft]))
    const mixed = loadDraftQueue()
    expect(reviewDrafts(mixed, 'store-demo-01').map((item) => item.reason)).toEqual(['unreadable', 'unknown_owner'])
    expect(saveDraftQueue(mixed)).toBe(true)
    expect(stored()).toEqual([{ bad: true }, legacyDraft])
  })

  it('keeps a stored value that is not a list for review', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ unexpected: 'shape' }))
    const queue = loadDraftQueue()

    expect(reviewDrafts(queue, 'store-demo-01').map((item) => item.reason)).toEqual(['unreadable'])
    saveDraftQueue(queue)
    expect(stored()).toEqual([{ unexpected: 'shape' }])
  })

  it('sets aside only the signed-in operator drafts and removes nothing', () => {
    let queue = addDraft(loadDraftQueue(), makeDraft(cashier, 'offline-checkout-001'))
    queue = addDraft(queue, makeDraft(cashier, 'offline-checkout-002'))
    queue = addDraft(queue, makeDraft(otherCashier, 'offline-checkout-003'))
    saveDraftQueue(queue)

    const aside = setAsideDrafts(queue, cashier)
    saveDraftQueue(aside)

    expect(ownedDrafts(aside, cashier)).toEqual([])
    expect(ownedDrafts(aside, otherCashier)).toHaveLength(1)
    expect(stored()).toHaveLength(3)
    expect(reviewDrafts(aside, 'store-demo-01').map((item) => item.reason)).toEqual(['set_aside', 'set_aside'])
    expect(reviewDrafts(loadDraftQueue(), 'store-demo-01')).toHaveLength(2)
  })

  it('shows set-aside drafts only to the store they came from', () => {
    const aside = setAsideDrafts(addDraft(loadDraftQueue(), makeDraft(cashier, 'offline-checkout-001')), cashier)

    expect(reviewDrafts(aside, 'store-demo-01')).toHaveLength(1)
    expect(reviewDrafts(aside, 'store-demo-02')).toEqual([])
    expect(reviewDrafts(aside, 'store-demo-01')[0]).toMatchObject({ storeId: 'store-demo-01', totalMinor: 3984 })
  })

  it('removes a synced draft only for its owner and key', () => {
    let queue = addDraft(loadDraftQueue(), makeDraft(cashier, 'offline-checkout-001'))
    queue = addDraft(queue, makeDraft(otherCashier, 'offline-checkout-001'))

    const removed = removeDraft(queue, { idempotencyKey: 'offline-checkout-001', owner: cashier })

    expect(ownedDrafts(removed, cashier)).toEqual([])
    expect(ownedDrafts(removed, otherCashier)).toHaveLength(1)
  })

  it('does not overwrite storage it could not read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const queue = loadDraftQueue()

    expect(queue.writable).toBe(false)
    expect(saveDraftQueue(addDraft(queue, makeDraft(cashier, 'offline-checkout-001')))).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('reports when browser storage is unavailable for writing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError')
    })

    expect(saveDraftQueue(addDraft(loadDraftQueue(), makeDraft(cashier, 'offline-checkout-001')))).toBe(false)
  })
})
