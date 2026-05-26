import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  globalSetup: './auth/global-setup.ts',
  use: {
    baseURL: 'https://guardio.app.getnotch.dev',
    headless: false,
    viewport: { width: 1440, height: 900 },
    storageState: 'auth/auth.json',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { channel: 'chrome' },
    },
  ],
});
