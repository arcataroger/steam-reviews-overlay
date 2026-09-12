import { defineConfig } from '@playwright/test'

// Several reviewers run this suite at once in the same checkout. Sharing `test-results/` made them
// delete each other's trace artifacts mid-run, and the ENOENT that followed looked like a test
// failure in every report. Give each run its own directory.
const outputDir = process.env.PW_OUTPUT_DIR || `test-results/run-${process.pid}`

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir,
  timeout: 120_000,
  retries: 1,
  workers: 1, // one persistent Chromium context with the extension at a time
  reporter: [['list']],
  expect: { timeout: 10_000 },
  use: { trace: 'retain-on-failure' },
})
