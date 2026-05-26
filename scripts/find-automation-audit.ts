/**
 * Targeted exploration: find where the Automation Audit keyword rules section lives.
 * Run: npx ts-node scripts/find-automation-audit.ts
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '..', 'auth', 'auth.json');
const OUT = path.join(__dirname, '..', 'screenshots');
const BASE = 'https://guardio.app.getnotch.dev';

async function shot(page: any, name: string) {
  const p = path.join(OUT, `find_${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  Saved: find_${name}.png`);
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // 1. Guardrails page — wait longer and take fullPage screenshot
  console.log('\n[1] Guardrails page (full)...');
  await page.goto(`${BASE}/config/guardrails`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await shot(page, '1_guardrails_full');

  // Dump all visible text content to find sections
  const guardrailsText = await page.evaluate(() => (document as any).body.innerText);
  fs.writeFileSync(path.join(OUT, 'find_1_guardrails_text.txt'), guardrailsText);
  console.log('  Text snapshot saved');

  // 2. Try clicking "Automation" in the sidebar to expand it
  console.log('\n[2] Clicking Automation in sidebar...');
  try {
    await page.getByRole('link', { name: /automation/i }).first().click();
    await page.waitForTimeout(2000);
    await shot(page, '2_after_automation_click');
  } catch (e) {
    console.log('  Could not click Automation');
  }

  // 3. Look for "Automation Audit" text anywhere on the page
  const hasAudit = await page.getByText(/automation audit/i).count();
  console.log(`\n[3] "Automation Audit" occurrences: ${hasAudit}`);

  // 4. Look for keyword sections
  for (const text of ['Email patterns', 'Subjects', 'Words in user', "Words in assistant"]) {
    const count = await page.getByText(new RegExp(text, 'i')).count();
    console.log(`  "${text}": ${count} matches`);
  }

  // 5. Scroll to bottom and capture
  await page.evaluate('window.scrollTo(0, 99999)');
  await page.waitForTimeout(1000);
  await shot(page, '3_guardrails_scrolled_bottom');

  // 6. Check current URL (might have redirected)
  console.log(`\n[4] Current URL: ${page.url()}`);

  // 7. Try the Automation Level page
  console.log('\n[5] Automation Level page...');
  await page.goto(`${BASE}/config/automation-level`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await shot(page, '5_automation_level');

  // 8. Navigate via sidebar — look for any link containing "audit"
  await page.goto(`${BASE}/config/guardrails`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const allLinks = await page.evaluate(() => {
    return Array.from((document as any).querySelectorAll('a, [role="menuitem"], [role="button"]'))
      .map((el: any) => ({ text: el.innerText?.trim(), href: el.href }))
      .filter((x: any) => x.text);
  });
  fs.writeFileSync(path.join(OUT, 'find_links.json'), JSON.stringify(allLinks, null, 2));
  console.log(`\n[6] Found ${allLinks.length} clickable elements. Saved to find_links.json`);

  await browser.close();
  console.log('\nDone. Check screenshots/find_*.png and find_*.txt');
}

run().catch(e => { console.error(e); process.exit(1); });
