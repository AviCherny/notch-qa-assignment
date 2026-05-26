/**
 * Exploration script — NOT a test file.
 * Purpose: open the Notch dashboard in headed mode, wait for manual Google login,
 * then navigate each relevant section and capture screenshots for test design.
 *
 * Uses a persistent browser profile so login is only needed once.
 * Run with: npx ts-node scripts/explore.ts
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://guardio.app.getnotch.dev';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const USER_DATA_DIR = path.join(__dirname, '..', '.browser-profile');
const LOGIN_TIMEOUT_MS = 300_000; // 5 minutes

async function screenshot(page: any, name: string) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  Saved: screenshots/${name}.png`);
}

async function isLoggedIn(page: any): Promise<boolean> {
  const url = page.url();
  if (!url.includes('getnotch.dev')) return false;

  // Login page is still showing — not logged in
  const loginVisible = await page.locator('text=Sign in to Notch').isVisible().catch(() => false);
  if (loginVisible) return false;

  // Page is blank (app shell loaded but no content yet) — not logged in
  const bodyText = await page.evaluate('document.body ? document.body.innerText.trim() : ""') as string;
  if (bodyText.length < 50) return false;

  return true;
}

async function run() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  // Persistent context = browser saves cookies/session across runs
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    slowMo: 200,
    viewport: { width: 1440, height: 900 },
    // Use real Chrome channel to avoid Google's bot detection
    channel: 'chrome',
  });

  const page = await context.newPage();

  // --- Step 1: Navigate to the app ---
  console.log('\n[1] Opening Notch dashboard...');
  await page.goto(`${BASE_URL}/config/guardrails`);
  await page.waitForLoadState('domcontentloaded');
  await page.bringToFront();
  await screenshot(page, '01_initial_load');

  // --- Step 2: Login if needed ---
  const alreadyLoggedIn = await isLoggedIn(page);

  if (!alreadyLoggedIn) {
    console.log('\n>>> Login required. Please sign in with Google.');
    console.log('>>> The browser window is open on your screen.');
    console.log('>>> You have 5 minutes.\n');

    // Wait for the login page to appear, then wait for it to be gone
    await page.waitForSelector('text=Sign in to Notch', { state: 'visible', timeout: 15_000 })
      .catch(() => { /* might already be past login page */ });

    // Poll until we reach authenticated content
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await page.waitForTimeout(2000);
      if (await isLoggedIn(page)) break;
    }

    if (!await isLoggedIn(page)) {
      throw new Error('Login timeout — please try again');
    }
    console.log('[2] Login complete. Session saved for future runs.\n');
  } else {
    console.log('[2] Already logged in (saved session). Continuing...\n');
  }

  await page.waitForLoadState('networkidle');
  await screenshot(page, '02_after_login_guardrails');

  // --- Step 3: Capture Automation Audit section ---
  console.log('[3] Capturing Automation Audit section...');
  await page.evaluate('window.scrollTo(0, 0)');
  await screenshot(page, '03_guardrails_top');

  await page.evaluate('window.scrollTo(0, 500)');
  await page.waitForTimeout(500);
  await screenshot(page, '04_guardrails_scroll1');

  await page.evaluate('window.scrollTo(0, 1000)');
  await page.waitForTimeout(500);
  await screenshot(page, '05_guardrails_scroll2');

  await page.evaluate('window.scrollTo(0, 1500)');
  await page.waitForTimeout(500);
  await screenshot(page, '06_guardrails_scroll3');

  await page.evaluate('window.scrollTo(0, 99999)');
  await page.waitForTimeout(500);
  await screenshot(page, '07_guardrails_bottom');

  // Save DOM snapshot
  const guardrailsHtml = await page.content();
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'guardrails_dom.html'), guardrailsHtml);
  console.log('  Saved: screenshots/guardrails_dom.html');

  // --- Step 4: Navigate to Playground ---
  console.log('\n[4] Navigating to Playground...');

  // Try clicking nav link first
  const playgroundLink = page.locator('a[href*="playground"], nav >> text=/playground/i').first();
  if (await playgroundLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await playgroundLink.click();
  } else {
    await page.goto(`${BASE_URL}/tests/playground`);
  }

  await page.waitForLoadState('networkidle');
  await page.evaluate('window.scrollTo(0, 0)');
  await screenshot(page, '08_playground_top');

  await page.evaluate('window.scrollTo(0, 500)');
  await page.waitForTimeout(500);
  await screenshot(page, '09_playground_scroll1');

  await page.evaluate('window.scrollTo(0, 99999)');
  await page.waitForTimeout(500);
  await screenshot(page, '10_playground_bottom');

  const playgroundHtml = await page.content();
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'playground_dom.html'), playgroundHtml);
  console.log('  Saved: screenshots/playground_dom.html');

  console.log('\n--- Exploration complete. Check screenshots/ folder. ---\n');
  await context.close();
}

run().catch((err) => {
  console.error('\nExploration failed:', err.message);
  process.exit(1);
});
