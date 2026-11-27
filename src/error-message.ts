import { ApiFailure } from './api'

export function errorMessage(
  error: unknown,
  translate: (key: string) => string,
  messages: Record<string, string>,
): string {
  if (error instanceof ApiFailure) {
    const key = `errors.${error.code}`
    return Object.hasOwn(messages, key) ? translate(key) : translate('errors.requestFailed')
  }

  return error instanceof TypeError ? translate('errors.network') : translate('errors.requestFailed')
}

/**
 * True when the server may have recorded the write even though the browser saw a failure:
 * the reply was lost, the server failed, or the response could not be read. The caller keeps
 * the idempotency key and shows "awaiting confirmation" instead of treating the write as failed.
 */
export function isOutcomeUnknown(error: unknown): boolean {
  if (error instanceof ApiFailure) return error.status >= 500
  return error instanceof TypeError
}
