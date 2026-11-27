export interface IntentKeyHolder {
  /** Returns the key for this payload, creating one only when no unresolved intent matches it. */
  acquire(fingerprint: string): string
  isPending(fingerprint: string): boolean
  /** Discard after a confirmed result, on sign-out, or when the user abandons the form. */
  release(): void
}

/**
 * Holds one idempotency key per unresolved user intent, in memory only.
 * The key is created when the user confirms, reused for every retry of the same payload,
 * and replaced as soon as the payload changes.
 */
export function createIntentKeyHolder(newKey: () => string = () => crypto.randomUUID()): IntentKeyHolder {
  let current: { fingerprint: string; key: string } | null = null

  return {
    acquire(fingerprint) {
      if (current?.fingerprint !== fingerprint) current = { fingerprint, key: newKey() }
      return current.key
    },
    isPending: (fingerprint) => current?.fingerprint === fingerprint,
    release() {
      current = null
    },
  }
}
