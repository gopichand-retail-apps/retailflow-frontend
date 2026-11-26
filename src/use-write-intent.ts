import { useMemo, useState } from 'react'
import { createIntentKeyHolder } from './domain/intent-key'
import { isOutcomeUnknown } from './error-message'

export interface WriteIntent {
  /** Key for this payload: created when the user confirms, reused on retry, replaced when the payload changes. */
  keyFor: (fingerprint: string) => string
  /** After a failure, keep the key and await confirmation only when the server may have recorded the write. */
  failed: (error: unknown) => void
  /** After a confirmed result, on sign-out, when the form is abandoned, or when the payload changes. */
  discard: () => void
}

/** One in-memory idempotency key per unresolved write, with its "awaiting confirmation" state. */
export function useWriteIntent(): WriteIntent & { awaiting: boolean } {
  const [holder] = useState(createIntentKeyHolder)
  const [awaiting, setAwaiting] = useState(false)
  const actions = useMemo<WriteIntent>(
    () => ({
      keyFor: (fingerprint) => holder.acquire(fingerprint),
      failed: (error) => {
        const unknown = isOutcomeUnknown(error)
        if (!unknown) holder.release()
        setAwaiting(unknown)
      },
      discard: () => {
        holder.release()
        setAwaiting(false)
      },
    }),
    [holder],
  )
  return { ...actions, awaiting }
}
