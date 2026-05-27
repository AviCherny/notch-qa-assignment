import { defineConfig } from '@playwright/test';
import { BASE_URL, TIMEOUTS } from './config';

export default defineConfig({
  testDir:     './tests',
  timeout:     60_000,
  globalSetup: './auth/global-setup.ts',

  reporter: [
    ['list'],
    ['allure-playwright', { outputFolder: 'allure-results' }],
  ],

  use: {
    baseURL:      BASE_URL,
    headless:     false,
    viewport:     { width: 1440, height: 900 },
    storageState: 'auth/auth.json',

    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
    trace:      'retain-on-failure',

    actionTimeout:     TIMEOUTS.element,
    navigationTimeout: TIMEOUTS.navigation,
  },

  projects: [
    {
      name: 'chromium',
      use: { channel: 'chrome' },
    },
  ],
});
