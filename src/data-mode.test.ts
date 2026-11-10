import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_IS_MOCK, parseIsMockValue, resolveModeApiBaseUrl } from './config'

describe('RetailFlow data mode', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to mock mode and accepts only exact mode values', () => {
    expect(DEFAULT_IS_MOCK).toBe(true)
    expect(parseIsMockValue(undefined)).toBe(true)
    expect(parseIsMockValue('true')).toBe(true)
    expect(parseIsMockValue('false')).toBe(false)
    expect(() => parseIsMockValue('yes')).toThrow('VITE_IS_MOCK')
  })

  it('selects only the configured API for each mode', () => {
    expect(
      resolveModeApiBaseUrl({
        isMock: true,
        mockApiBaseUrl: 'http://127.0.0.1:5004',
        realApiBaseUrl: 'http://127.0.0.1:5005',
        localApiBaseUrl: 'http://127.0.0.1:5002',
        isDevelopment: false,
      }),
    ).toBe('http://127.0.0.1:5004')
    expect(
      resolveModeApiBaseUrl({
        isMock: false,
        mockApiBaseUrl: 'http://127.0.0.1:5004',
        realApiBaseUrl: 'https://api.example.test',
        localApiBaseUrl: 'http://127.0.0.1:5002',
        isDevelopment: true,
      }),
    ).toBe('https://api.example.test')
  })

  it('requires explicit production endpoints and rejects invalid API origins', () => {
    const config = {
      isMock: true,
      localApiBaseUrl: 'http://127.0.0.1:5002',
      isDevelopment: false,
    }
    expect(() => resolveModeApiBaseUrl(config)).toThrow('VITE_MOCK_API_BASE_URL')
    expect(() =>
      resolveModeApiBaseUrl({
        ...config,
        isMock: false,
      }),
    ).toThrow('VITE_REAL_API_BASE_URL')
    expect(() =>
      resolveModeApiBaseUrl({
        ...config,
        mockApiBaseUrl: 'https://mock.example.test/api/v1',
      }),
    ).toThrow('HTTP(S) origin')
    expect(() =>
      resolveModeApiBaseUrl({
        ...config,
        mockApiBaseUrl: 'not-an-absolute-url',
      }),
    ).toThrow('absolute HTTP(S) origin')
  })

  it('uses only a loopback fallback for a local development mock API', () => {
    expect(
      resolveModeApiBaseUrl({
        isMock: true,
        localApiBaseUrl: 'http://127.0.0.1:5002',
        isDevelopment: true,
      }),
    ).toBe('http://127.0.0.1:5002')

    expect(() =>
      resolveModeApiBaseUrl({
        isMock: true,
        localApiBaseUrl: 'https://api.example.test',
        isDevelopment: true,
      }),
    ).toThrow('loopback API')
  })
})
