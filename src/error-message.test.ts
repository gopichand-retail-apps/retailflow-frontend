import { describe, expect, it } from 'vitest'
import { ApiFailure } from './api'
import { errorMessage } from './error-message'

const messages = {
  'errors.AUTH_REQUIRED': 'Please sign in.',
  'errors.requestFailed': 'Request failed.',
  'errors.network': 'Network unavailable.',
}
const translate = (key: string) => messages[key as keyof typeof messages] ?? key

describe('errorMessage', () => {
  it('uses a localized API error when one exists', () => {
    expect(errorMessage(new ApiFailure('AUTH_REQUIRED', 401), translate, messages)).toBe('Please sign in.')
  })

  it('falls back for unknown API errors, network failures, and other exceptions', () => {
    expect(errorMessage(new ApiFailure('UNKNOWN', 500), translate, messages)).toBe('Request failed.')
    expect(errorMessage(new TypeError('offline'), translate, messages)).toBe('Network unavailable.')
    expect(errorMessage(new Error('unexpected'), translate, messages)).toBe('Request failed.')
  })
})
