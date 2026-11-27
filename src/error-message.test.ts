import { describe, expect, it } from 'vitest'
import { ApiFailure } from './api'
import { errorMessage, isOutcomeUnknown } from './error-message'

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

describe('isOutcomeUnknown', () => {
  it('treats lost replies, server failures and unreadable responses as possibly recorded', () => {
    expect(isOutcomeUnknown(new TypeError('Failed to fetch'))).toBe(true)
    expect(isOutcomeUnknown(new ApiFailure('SERVER_ERROR', 500))).toBe(true)
    expect(isOutcomeUnknown(new ApiFailure('SERVICE_UNAVAILABLE', 503))).toBe(true)
    expect(isOutcomeUnknown(new ApiFailure('INVALID_RESPONSE', 502))).toBe(true)
  })

  it('treats client rejections and unexpected exceptions as not recorded', () => {
    expect(isOutcomeUnknown(new ApiFailure('INSUFFICIENT_STOCK', 409))).toBe(false)
    expect(isOutcomeUnknown(new ApiFailure('IDEMPOTENCY_CONFLICT', 409))).toBe(false)
    expect(isOutcomeUnknown(new ApiFailure('INVALID_CHECKOUT', 400))).toBe(false)
    expect(isOutcomeUnknown(new Error('unexpected'))).toBe(false)
  })
})
