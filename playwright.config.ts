import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  retries: 1,
  workers: 1, // one persistent Chromium context with the extension at a time
  reporter: [['list']],
  expect: { timeout: 10_000 },
  use: { trace: 'retain-on-failure' },
})
