const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export const DEFAULT_IS_MOCK = true

export function parseIsMockValue(value: string | undefined): boolean {
  if (value === undefined) return DEFAULT_IS_MOCK
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error('VITE_IS_MOCK must be exactly "true" or "false".')
}

export const isMock = parseIsMockValue(import.meta.env.VITE_IS_MOCK)

interface ApiModeConfiguration {
  isMock: boolean
  mockApiBaseUrl?: string
  realApiBaseUrl?: string
  localApiBaseUrl: string
  isDevelopment: boolean
}

interface SelectedApiBaseUrl {
  value: string
  localMockFallback: boolean
}

function selectApiBaseUrl(config: ApiModeConfiguration): SelectedApiBaseUrl {
  if (config.isMock) {
    const configuredMockApiBaseUrl = config.mockApiBaseUrl?.trim()
    if (configuredMockApiBaseUrl) {
      return { value: configuredMockApiBaseUrl, localMockFallback: false }
    }
    if (!config.isDevelopment) {
      throw new Error('VITE_MOCK_API_BASE_URL is required for production mock mode.')
    }

    return { value: config.localApiBaseUrl.trim(), localMockFallback: true }
  }

  const configuredRealApiBaseUrl = config.realApiBaseUrl?.trim()
  if (!configuredRealApiBaseUrl) {
    throw new Error('VITE_REAL_API_BASE_URL is required when VITE_IS_MOCK=false.')
  }

  return { value: configuredRealApiBaseUrl, localMockFallback: false }
}

function parseApiOrigin(value: string): URL {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(value)
  } catch {
    throw new Error('The selected RetailFlow API must be an absolute HTTP(S) origin.')
  }

  if (
    (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
    parsedUrl.pathname !== '/' ||
    parsedUrl.search ||
    parsedUrl.hash ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error('The selected RetailFlow API must be an HTTP(S) origin without credentials or a path.')
  }

  return parsedUrl
}

export function resolveModeApiBaseUrl(config: ApiModeConfiguration): string {
  const selectedApiBaseUrl = selectApiBaseUrl(config)
  const parsedUrl = parseApiOrigin(selectedApiBaseUrl.value)

  if (selectedApiBaseUrl.localMockFallback && !LOOPBACK_HOSTS.has(parsedUrl.hostname)) {
    throw new Error('Local mock mode may only fall back to a loopback API.')
  }

  return parsedUrl.origin
}
