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
