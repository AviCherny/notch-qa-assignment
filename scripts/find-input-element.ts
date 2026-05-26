/**
 * Find the actual interactive input element in the tag sections.
 * Run: npx ts-node --transpile-only scripts/find-input-element.ts
 */

import { chromium } from '@playwright/test';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '..', 'auth', 'auth.json');
const BASE = 'https://guardio.app.getnotch.dev';

async function run() {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({ storageState: AUTH_FILE, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/config/guardrails`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Scroll to the empty "Words in Assistant's Reply" section to see the input
  await page.getByText("Words in Assistant's Reply").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  // Find the element containing the "Add a word (e.g., 'paperwork')" text
  const addWordElement = page.getByText(/Add a word \(e\.g\., 'paperwork'\)/i);
  const count = await addWordElement.count();
  console.log(`Elements with "Add a word (e.g., 'paperwork')" text: ${count}`);

  if (count > 0) {
    const tagName = await addWordElement.evaluate((el: any) => el.tagName);
    const role = await addWordElement.getAttribute('role');
    const isContentEditable = await addWordElement.evaluate((el: any) => el.contentEditable);
    const classes = await addWordElement.evaluate((el: any) => el.className?.substring(0, 100));
    const dataAttrs = await addWordElement.evaluate((el: any) => {
      const attrs: any = {};
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-')) attrs[attr.name] = attr.value;
      }
      return attrs;
    });

    console.log(`  tagName: ${tagName}`);
    console.log(`  role: ${role}`);
    console.log(`  contentEditable: ${isContentEditable}`);
    console.log(`  classes: ${classes}`);
    console.log(`  data-*: ${JSON.stringify(dataAttrs)}`);

    // Look at the parent
    const parentInfo = await addWordElement.evaluate((el: any) => {
      const p = el.parentElement;
      return {
        tag: p?.tagName,
        role: p?.getAttribute('role'),
        contentEditable: p?.contentEditable,
        classes: p?.className?.substring(0, 100),
      };
    });
    console.log(`  parent: ${JSON.stringify(parentInfo)}`);

    // Try clicking it and see if typing works
    await addWordElement.click();
    await page.waitForTimeout(300);

    // Try typing directly on the page
    await page.keyboard.type('testword999');
    await page.waitForTimeout(500);

    const screenshot = path.join(__dirname, '..', 'screenshots', 'inspect_typed.png');
    await page.screenshot({ path: screenshot });
    console.log(`  After typing screenshot saved`);

    // Check if anything appeared
    const typed = await page.getByText('testword999').count();
    console.log(`  "testword999" visible: ${typed}`);

    if (typed > 0) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const chip = await page.getByText('testword999').count();
      console.log(`  After Enter - "testword999" elements: ${chip}`);

      const screenshotAfter = path.join(__dirname, '..', 'screenshots', 'inspect_after_enter.png');
      await page.screenshot({ path: screenshotAfter });

      // Delete it
      const chipEl = page.locator('[class*="chip"], [class*="Chip"], [class*="tag"], [class*="Tag"]').filter({ hasText: /^testword999$/ });
      const chipCount = await chipEl.count();
      console.log(`  Chip count: ${chipCount}`);

      if (chipCount > 0) {
        const delBtn = chipEl.locator('button, svg').first();
        await delBtn.click();
        console.log('  Deleted chip');
      }
    }
  }

  // Now look at what the "Add a word" element actually is
  console.log('\n\nLooking at all elements with "Add" placeholder-style text...');
  const allAddElements = await page.locator('[placeholder*="Add"], [placeholder*="add"]').all();
  console.log(`Elements with "Add" placeholder: ${allAddElements.length}`);
  for (let i = 0; i < Math.min(allAddElements.length, 10); i++) {
    const tag = await allAddElements[i].evaluate((el: any) => el.tagName);
    const ph = await allAddElements[i].getAttribute('placeholder');
    console.log(`  [${i}] ${tag} placeholder="${ph}"`);
  }

  await browser.close();
  console.log('\nDone.');
}

run().catch(e => { console.error(e); process.exit(1); });
