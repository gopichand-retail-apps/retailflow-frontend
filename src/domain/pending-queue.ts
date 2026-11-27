import { z } from 'zod'
import type { CheckoutRequest } from '../api.js'

export const DRAFT_STORAGE_KEY = 'retailflow.pending-checkouts.v1'

const ownerSchema = z.object({ storeId: z.string().min(1), userId: z.string().min(1) })
const storedDraftSchema = z.object({
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
  owner: ownerSchema.optional(),
  setAside: z.literal(true).optional(),
})

export type DraftOwner = z.infer<typeof ownerSchema>
type StoredDraft = z.infer<typeof storedDraftSchema>

export type PendingCheckout = {
  idempotencyKey: string
  createdAt: string
  payload: CheckoutRequest
  owner: DraftOwner
}

export type ReviewReason = 'unknown_owner' | 'set_aside' | 'unreadable'

export interface ReviewDraft {
  reason: ReviewReason
  createdAt: string | null
  unitCount: number | null
  totalMinor: number | null
  storeId: string | null
}

type QueueEntry =
  | { kind: 'owned'; draft: PendingCheckout }
  | { kind: 'review'; reason: ReviewReason; raw: unknown; draft: StoredDraft | null }

/**
 * Every entry found on this register. Entries this version cannot attribute or read stay in the
 * queue as review items with their original bytes, so reading and writing never drops a record.
 */
export interface DraftQueue {
  entries: readonly QueueEntry[]
  writable: boolean
}

function classify(raw: unknown): QueueEntry {
  const parsed = storedDraftSchema.safeParse(raw)
  if (!parsed.success) return { kind: 'review', reason: 'unreadable', raw, draft: null }

  const { owner, setAside, ...draft } = parsed.data
  if (!owner) return { kind: 'review', reason: 'unknown_owner', raw, draft: parsed.data }
  if (setAside) return { kind: 'review', reason: 'set_aside', raw, draft: parsed.data }
  return { kind: 'owned', draft: { ...draft, owner } }
}

function serialize(entry: QueueEntry): unknown {
  return entry.kind === 'owned' ? entry.draft : entry.raw
}

function sameOwner(left: DraftOwner, right: DraftOwner): boolean {
  return left.storeId === right.storeId && left.userId === right.userId
}

export function loadDraftQueue(): DraftQueue {
  let text: string | null
  try {
    text = localStorage.getItem(DRAFT_STORAGE_KEY)
  } catch {
    return { entries: [], writable: false }
  }
  if (text === null) return { entries: [], writable: true }

  try {
    const parsed: unknown = JSON.parse(text)
    return { entries: (Array.isArray(parsed) ? parsed : [parsed]).map(classify), writable: true }
  } catch {
    return { entries: [classify(text)], writable: true }
  }
}

export function saveDraftQueue(queue: DraftQueue): boolean {
  if (!queue.writable) return false
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(queue.entries.map(serialize)))
    return true
  } catch {
    return false
  }
}

export function ownedDrafts(queue: DraftQueue, owner: DraftOwner): PendingCheckout[] {
  return queue.entries.flatMap((entry) =>
    entry.kind === 'owned' && sameOwner(entry.draft.owner, owner) ? [entry.draft] : [],
  )
}

export function addDraft(queue: DraftQueue, draft: PendingCheckout): DraftQueue {
  return { ...queue, entries: [...queue.entries, { kind: 'owned', draft }] }
}

export function removeDraft(queue: DraftQueue, target: { idempotencyKey: string; owner: DraftOwner }): DraftQueue {
  const entries = queue.entries.filter(
    (entry) =>
      !(
        entry.kind === 'owned' &&
        entry.draft.idempotencyKey === target.idempotencyKey &&
        sameOwner(entry.draft.owner, target.owner)
      ),
  )
  return { ...queue, entries }
}

/** Moves the operator's own drafts to the review list. Nothing is deleted. */
export function setAsideDrafts(queue: DraftQueue, owner: DraftOwner): DraftQueue {
  const entries = queue.entries.map((entry): QueueEntry => {
    if (entry.kind !== 'owned' || !sameOwner(entry.draft.owner, owner)) return entry
    const raw = { ...entry.draft, setAside: true as const }
    return { kind: 'review', reason: 'set_aside', raw, draft: raw }
  })
  return { ...queue, entries }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function reviewDrafts(queue: DraftQueue, storeId: string): ReviewDraft[] {
  return queue.entries.flatMap((entry): ReviewDraft[] => {
    if (entry.kind !== 'review') return []
    const draft = entry.draft
    const draftStoreId = draft?.owner?.storeId ?? null
    if (entry.reason === 'set_aside' && draftStoreId !== storeId) return []

    return [
      {
        reason: entry.reason,
        createdAt: draft?.createdAt ?? null,
        unitCount: draft ? sum(draft.payload.items.map((item) => item.quantity)) : null,
        totalMinor: draft ? sum(draft.payload.tenders.map((tender) => tender.amountMinor)) : null,
        storeId: draftStoreId,
      },
    ]
  })
}
