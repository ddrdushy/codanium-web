import { defineConfig } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, 'e2e', '.auth', 'user.json');

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000, // 2 minutes per test (agents are slow)
  expect: { timeout: 30_000 },
  fullyParallel: false, // Run sequentially — agents share state
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:14001',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
    },
  ],
});
