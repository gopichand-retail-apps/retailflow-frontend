import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl } from './api.js'

describe('resolveApiBaseUrl', () => {
  it('follows the page hostname for the local frontend/backend pair', () => {
    expect(resolveApiBaseUrl('http://localhost:5001', 'http://127.0.0.1:5002')).toBe('http://localhost:5002')
    expect(resolveApiBaseUrl('http://127.0.0.1:5001', 'http://localhost:5002')).toBe('http://127.0.0.1:5002')
  })

  it('keeps an explicitly configured non-loopback backend host', () => {
    expect(resolveApiBaseUrl('http://localhost:5001', 'https://api.example.test')).toBe('https://api.example.test')
  })
})
