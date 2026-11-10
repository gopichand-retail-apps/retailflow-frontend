import { defineConfig, devices } from '@playwright/test'

const isMock = process.env.VITE_IS_MOCK ?? 'true'
const frontendPort = Number(process.env.RETAILFLOW_E2E_FRONTEND_PORT ?? 5003)
const apiPort = Number(process.env.RETAILFLOW_E2E_API_PORT ?? 5004)
const frontendUrl = `http://127.0.0.1:${frontendPort}`
const apiBaseUrl = `http://127.0.0.1:${apiPort}`
const unavailableApiBaseUrl = 'http://127.0.0.1:1'

if (frontendPort === apiPort) {
  throw new Error('RetailFlow E2E frontend and API ports must be different.')
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../retailflow-backend',
      url: `${apiBaseUrl}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        HOST: '127.0.0.1',
        PORT: String(apiPort),
        FRONTEND_ORIGIN: frontendUrl,
        NODE_ENV: 'development',
        PGLITE_DATA_DIR: 'memory://',
      },
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        VITE_IS_MOCK: isMock,
        VITE_MOCK_API_BASE_URL: isMock === 'true' ? apiBaseUrl : unavailableApiBaseUrl,
        VITE_REAL_API_BASE_URL: isMock === 'false' ? apiBaseUrl : unavailableApiBaseUrl,
      },
    },
  ],
})
