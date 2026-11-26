import { useEffect, useRef, useState } from 'react'
import { api, type DemoUser, type SaleDetail } from './api'
import {
  DRAFT_STORAGE_KEY,
  addDraft,
  loadDraftQueue,
  ownedDrafts,
  removeDraft,
  reviewDrafts,
  saveDraftQueue,
  setAsideDrafts,
  type DraftOwner,
  type PendingCheckout,
  type ReviewDraft,
} from './domain/pending-queue'

export interface DraftQueueEvents {
  onSynced: (sale: SaleDetail) => void
  onSyncFailed: (error: unknown) => void
  onSaveFailed: () => void
}

export interface RegisterDrafts {
  /** Drafts saved on this register by the signed-in operator in their own store. */
  mine: PendingCheckout[]
  /** Unattributed, unreadable or set-aside drafts. Only supervisors and administrators see them. */
  review: ReviewDraft[]
  /** True while the server has not yet confirmed the draft being synced. */
  syncing: boolean
  save: (draft: Omit<PendingCheckout, 'owner'>) => void
  setAside: () => void
  retry: () => void
}

function ownerOf(user: DemoUser | null): DraftOwner | null {
  return user ? { storeId: user.storeId, userId: user.id } : null
}

/**
 * The register's pending cash drafts, bound to the operator who saved them. Only the signed-in
 * owner's drafts are shown or synced; nothing is removed except a draft the server confirmed.
 */
export function useDraftQueue(user: DemoUser | null, online: boolean, events: DraftQueueEvents): RegisterDrafts {
  const [queue, setQueue] = useState(loadDraftQueue)
  const [retryVersion, setRetryVersion] = useState(0)
  const [syncingKey, setSyncingKey] = useState<string | null>(null)
  const eventsRef = useRef(events)
  const owner = ownerOf(user)
  const mine = owner ? ownedDrafts(queue, owner) : []
  const firstDraft = mine[0]

  useEffect(() => {
    eventsRef.current = events
  })

  useEffect(() => {
    if (!saveDraftQueue(queue)) eventsRef.current.onSaveFailed()
  }, [queue])

  useEffect(() => {
    // Another tab on this register changed the queue: adopt it so this tab's next save cannot drop those drafts.
    const adopt = (event: StorageEvent) => {
      if (event.key === DRAFT_STORAGE_KEY) setQueue(loadDraftQueue())
    }
    window.addEventListener('storage', adopt)
    return () => window.removeEventListener('storage', adopt)
  }, [])

  useEffect(() => {
    if (!online || !firstDraft) return
    let active = true
    setSyncingKey(firstDraft.idempotencyKey)
    api
      .createSale(firstDraft.payload, firstDraft.idempotencyKey)
      .then(({ sale }) => {
        if (!active) return
        setQueue((current) => removeDraft(current, firstDraft))
        eventsRef.current.onSynced(sale)
      })
      .catch((error: unknown) => {
        if (active) eventsRef.current.onSyncFailed(error)
      })
      .finally(() => {
        if (active) setSyncingKey(null)
      })
    return () => {
      active = false
      setSyncingKey(null)
    }
  }, [firstDraft, online, retryVersion])

  return {
    mine,
    review: user && user.role !== 'cashier' ? reviewDrafts(queue, user.storeId) : [],
    syncing: syncingKey !== null && syncingKey === firstDraft?.idempotencyKey,
    save: (draft) => {
      if (owner) setQueue((current) => addDraft(current, { ...draft, owner }))
    },
    setAside: () => {
      if (owner) setQueue((current) => setAsideDrafts(current, owner))
    },
    retry: () => setRetryVersion((version) => version + 1),
  }
}
