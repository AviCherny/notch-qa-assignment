/**
 * Global setup — runs once before the entire test suite.
 *
 * Auth strategy:
 *   The app uses Google OAuth via Descope, which cannot be automated directly.
 *   On the first run, this opens a headed Chrome window and waits for the user
 *   to complete login manually (up to 5 minutes).
 *   Once authenticated, the session is saved to auth/auth.json and reused by
 *   all subsequent test runs until the session expires.
 *
 * To force a fresh login: delete auth/auth.json and re-run.
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, 'auth.json');
const BROWSER_PROFILE = path.join(__dirname, '..', '.browser-profile');
const BASE_URL = 'https://guardio.app.getnotch.dev';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default async function globalSetup(_config: FullConfig) {
  if (fs.existsSync(AUTH_FILE)) {
    console.log('[auth] Reusing saved session (auth/auth.json).');
    return;
  }

  console.log('\n[auth] No saved session found.');
  console.log('[auth] Opening browser — please sign in with Google.');
  console.log(`[auth] You have ${LOGIN_TIMEOUT_MS / 60_000} minutes.\n`);

  fs.mkdirSync(BROWSER_PROFILE, { recursive: true });

  // Use a persistent context so Chrome handles Google OAuth naturally.
  // A fresh Playwright context triggers Google's bot detection; a real
  // Chrome profile does not.
  const browser = await chromium.launchPersistentContext(BROWSER_PROFILE, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/config/guardrails`);
  await page.bringToFront();

  // Wait until the URL leaves the login/auth domain and lands on the app
  await page.waitForURL(
    url => url.hostname.includes('getnotch.dev') && !url.pathname.startsWith('/login'),
    { timeout: LOGIN_TIMEOUT_MS }
  );
  await page.waitForLoadState('networkidle');

  // Save session state for all tests
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await browser.storageState({ path: AUTH_FILE });
  await browser.close();

  console.log('[auth] Login successful. Session saved to auth/auth.json\n');
}
