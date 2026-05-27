/**
 * Global setup — runs once before the entire test suite.
 *
 * Auth strategy (in order of preference):
 *
 *   1. Saved session (auth/auth.json) — reused if it exists and is not expired.
 *      To force re-login: delete auth/auth.json and re-run.
 *
 *   2. Token injection via environment variables (NOTCH_DS_TOKEN / NOTCH_DSR_TOKEN).
 *      Used in CI. Extract these values from browser DevTools after logging in:
 *        Chrome → DevTools → Application → Cookies → guardio.app.getnotch.dev
 *        Copy the values of "DS" and "DSR" cookies.
 *      Store as GitHub secrets and the workflow will inject them automatically.
 *
 *   3. Interactive login — opens a headed Chrome window and waits for the user
 *      to complete Google OAuth manually (up to 5 minutes). Session is saved
 *      automatically so subsequent runs skip this step.
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { BASE_URL } from '../config';

const AUTH_FILE        = path.join(__dirname, 'auth.json');
const BROWSER_PROFILE  = path.join(__dirname, '..', '.browser-profile');
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export default async function globalSetup(_config: FullConfig) {
  // --- Strategy 1: reuse saved session ---
  if (fs.existsSync(AUTH_FILE)) {
    console.log('[auth] Reusing saved session (auth/auth.json).');
    return;
  }

  // --- Strategy 2: inject tokens from environment (CI path) ---
  const dsToken  = process.env.NOTCH_DS_TOKEN;
  const dsrToken = process.env.NOTCH_DSR_TOKEN;

  if (dsToken && dsrToken) {
    console.log('[auth] Creating session from NOTCH_DS_TOKEN / NOTCH_DSR_TOKEN env vars.');

    const domain = new URL(BASE_URL).hostname;
    const authState = {
      cookies: [
        {
          name:     'DS',
          value:    dsToken,
          domain,
          path:     '/',
          httpOnly: true,
          secure:   true,
          sameSite: 'Lax' as const,
          expires:  -1,
        },
        {
          name:     'DSR',
          value:    dsrToken,
          domain,
          path:     '/',
          httpOnly: true,
          secure:   true,
          sameSite: 'Lax' as const,
          expires:  -1,
        },
      ],
      origins: [],
    };

    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authState, null, 2));
    console.log('[auth] Session created from env tokens.\n');
    return;
  }

  // --- Strategy 3: interactive login ---
  console.log('\n[auth] No saved session found.');
  console.log('[auth] Opening browser — please sign in with Google.');
  console.log(`[auth] You have ${LOGIN_TIMEOUT_MS / 60_000} minutes.\n`);

  fs.mkdirSync(BROWSER_PROFILE, { recursive: true });

  // Persistent context avoids Google bot detection that triggers on fresh contexts
  const browser = await chromium.launchPersistentContext(BROWSER_PROFILE, {
    headless: false,
    channel:  'chrome',
    viewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/config/guardrails`);
  await page.bringToFront();

  await page.waitForURL(
    url => url.hostname.includes('getnotch.dev') && !url.pathname.startsWith('/login'),
    { timeout: LOGIN_TIMEOUT_MS }
  );
  await page.waitForLoadState('networkidle');

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await browser.storageState({ path: AUTH_FILE });
  await browser.close();

  console.log('[auth] Login successful. Session saved to auth/auth.json\n');
}
