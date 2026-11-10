/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly VITE_IS_MOCK?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_MOCK_API_BASE_URL?: string
  readonly VITE_REAL_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
