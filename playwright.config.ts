import { defineConfig, devices } from '@playwright/test'

// Full browser matrix for local testing
const allBrowsers = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
]

// Chromium only for CI (faster)
const ciBrowsers = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
]

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Each worker gets its own test user account to avoid session conflicts
  // Requires E2E_TEST_EMAIL_0, E2E_TEST_EMAIL_1, etc. in .env.test
  workers: process.env.CI ? 1 : 4,
  reporter: process.env.CI ? 'github' : 'html',

  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: process.env.CI ? ciBrowsers : allBrowsers,

  webServer: {
    // Use --webpack locally to bypass Turbopack Windows "nul" reserved name bug
    // CI (Linux) can use Turbopack without issues
    command: process.env.CI ? 'npx next dev' : 'npx next dev --webpack',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
