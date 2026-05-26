/**
 * Captures what happens when you click the tag container in Automation Audit.
 * Run: npx ts-node scripts/capture-interaction.ts
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '..', 'auth', 'auth.json');
const OUT = path.join(__dirname, '..', 'screenshots');

async function run() {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto('https://guardio.app.getnotch.dev/config/guardrails', {
    waitUntil: 'networkidle',
  });

  // Scroll to Automation Audit section
  await page.getByText('Automation Audit').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'interact_01_audit_visible.png') });
  console.log('1. Automation Audit section visible');

  // Click the "Words in User Message" tag container to trigger the input
  const wordsSection = page.locator('div').filter({ hasText: /^Words in User Message$/ }).last();
  // Click the tag container (sc-gcUDKN) next to the section title
  const tagContainer = page
    .locator('.sc-gcUDKN, [class*="iSBrSo"]')
    .filter({ has: wordsSection.locator('..') })
    .first();

  // Simpler: just click after the divider in the Words in User Message block
  // Find the block by text and click the container below the hr
  const block = page
    .locator('div')
    .filter({ hasText: 'Words in User Message' })
    .filter({ hasText: 'The AI will unassign' })
    .last();

  await block.locator('.sc-gcUDKN').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, 'interact_02_after_click.png') });
  console.log('2. After clicking tag container');

  // Capture DOM after click
  const domAfterClick = await page.content();
  fs.writeFileSync(path.join(OUT, 'dom_guardrails_after_click.html'), domAfterClick);

  // Check if an input appeared
  const inputs = await page.locator('input, textarea').count();
  console.log(`   Inputs on page after click: ${inputs}`);

  const visibleInputs = page.locator('input:not([readonly]):not([type="hidden"]), textarea:not([readonly])');
  const count = await visibleInputs.count();
  console.log(`   Editable inputs: ${count}`);

  if (count > 0) {
    for (let i = 0; i < count; i++) {
      const placeholder = await visibleInputs.nth(i).getAttribute('placeholder');
      const type = await visibleInputs.nth(i).evaluate(el => el.tagName);
      console.log(`   Input ${i}: ${type} placeholder="${placeholder}"`);
    }
  }

  // Also capture the Playground page with a wait
  await page.goto('https://guardio.app.getnotch.dev/tests/playground', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'interact_03_playground.png') });
  console.log('3. Playground page');

  await page.evaluate('window.scrollTo(0, 500)');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'interact_04_playground_scrolled.png') });

  const playgroundDom = await page.content();
  fs.writeFileSync(path.join(OUT, 'dom_playground_waited.html'), playgroundDom);

  await browser.close();
  console.log('\nDone.');
}

run().catch(e => { console.error(e); process.exit(1); });
