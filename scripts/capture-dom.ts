/**
 * One-shot DOM capture using saved auth session.
 * Captures full-page screenshots + DOM of all relevant pages.
 * Run: npx ts-node scripts/capture-dom.ts
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '..', 'auth', 'auth.json');
const OUT = path.join(__dirname, '..', 'screenshots');
const BASE = 'https://guardio.app.getnotch.dev';

const PAGES = [
  { name: 'guardrails',      url: `${BASE}/config/guardrails` },
  { name: 'rules',           url: `${BASE}/config/rules` },
  { name: 'automation',      url: `${BASE}/config/automation` },
  { name: 'playground',      url: `${BASE}/tests/playground` },
  { name: 'conversations',   url: `${BASE}/tests/conversations` },
];

async function run() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({ storageState: AUTH_FILE, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  for (const { name, url } of PAGES) {
    console.log(`\n[${name}] ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 });
      await page.waitForTimeout(1500);

      // Full page screenshot (scrolls through entire page)
      await page.screenshot({ path: path.join(OUT, `dom_${name}_top.png`), fullPage: false });

      // Scroll and capture more
      await page.evaluate('window.scrollTo(0, 500)');
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `dom_${name}_mid.png`), fullPage: false });

      await page.evaluate('window.scrollTo(0, 99999)');
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `dom_${name}_bottom.png`), fullPage: false });

      // Save DOM
      const html = await page.content();
      fs.writeFileSync(path.join(OUT, `dom_${name}.html`), html);

      console.log(`  -> Saved screenshots + DOM`);
    } catch (e: any) {
      console.log(`  -> Failed: ${e.message}`);
    }
  }

  await browser.close();
  console.log('\nDone. Check screenshots/dom_*.png');
}

run().catch(e => { console.error(e); process.exit(1); });
