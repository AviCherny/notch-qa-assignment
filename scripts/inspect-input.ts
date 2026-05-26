/**
 * Inspect how the tag input works in the Automation Audit section.
 * Run: npx ts-node --transpile-only scripts/inspect-input.ts
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '..', 'auth', 'auth.json');
const OUT = path.join(__dirname, '..', 'screenshots');
const BASE = 'https://guardio.app.getnotch.dev';

async function shot(page: any, name: string) {
  await page.screenshot({ path: path.join(OUT, `inspect_${name}.png`) });
  console.log(`  -> inspect_${name}.png`);
}

async function run() {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({ storageState: AUTH_FILE, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/config/guardrails`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Scroll to the "Words in Assistant's Reply" section (empty = input visible)
  await page.getByText("Words in Assistant's Reply").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot(page, '1_words_assistant_visible');

  // Inspect the input in "Words in Assistant's Reply"
  const replySection = page.locator('div').filter({ hasText: /Words in Assistant's Reply/i }).last();

  // Find all focusable elements in this section
  const focusable = await replySection.evaluate((el: any) => {
    const inputs = el.querySelectorAll('input, textarea, [contenteditable], [data-slate-editor]');
    return Array.from(inputs).map((inp: any) => ({
      tag: inp.tagName,
      type: inp.type,
      placeholder: inp.placeholder,
      contenteditable: inp.contentEditable,
      classes: inp.className,
      visible: inp.offsetWidth > 0 && inp.offsetHeight > 0,
      outerHTML: inp.outerHTML.substring(0, 300),
    }));
  });
  console.log('\nFocusable elements in "Words in Assistant\'s Reply":');
  console.log(JSON.stringify(focusable, null, 2));

  // Now try clicking the placeholder area and see what happens
  const placeholder = page.getByPlaceholder(/paperwork/i);
  const placeholderExists = await placeholder.count();
  console.log(`\n"paperwork" placeholder exists: ${placeholderExists}`);

  if (placeholderExists > 0) {
    const tag = await placeholder.evaluate((el: any) => el.tagName);
    const classes = await placeholder.evaluate((el: any) => el.className);
    console.log(`  tag: ${tag}`);
    console.log(`  classes: ${classes}`);

    await placeholder.click();
    await page.waitForTimeout(500);
    await shot(page, '2_after_click_placeholder');

    await placeholder.fill('testword123');
    await page.waitForTimeout(300);
    await shot(page, '3_after_type');

    await placeholder.press('Enter');
    await page.waitForTimeout(1000);
    await shot(page, '4_after_enter');

    // Check if chip was added
    const chipText = await page.getByText('testword123').count();
    console.log(`  "testword123" chips: ${chipText}`);

    // Now delete the chip
    const chip = page.locator('div, span').filter({ hasText: /^testword123$/ }).last();
    const deleteBtn = chip.locator('button, [aria-label*="delete"], [aria-label*="remove"], svg').first();
    await deleteBtn.click().catch(() => {
      // Try clicking the × symbol
      page.getByText('testword123').locator('..').locator('button').first().click();
    });
    await page.waitForTimeout(500);
    await shot(page, '5_after_delete');
  }

  // Also inspect the "Words in User Message" section (has chips)
  console.log('\n\nInspecting "Words in User Message" section...');
  await page.getByText('Words in User Message').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const userMsgSection = page.locator('div').filter({ hasText: /Words in User Message/i }).last();

  // Get all inputs INCLUDING data-slate, react-select, etc.
  const allInputsInSection = await userMsgSection.evaluate((el: any) => {
    const found: any[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      const el2 = node as any;
      if (['INPUT', 'TEXTAREA'].includes(el2.tagName) || el2.contentEditable === 'true') {
        found.push({
          tag: el2.tagName,
          type: el2.type,
          placeholder: el2.placeholder,
          contenteditable: el2.contentEditable,
          classes: el2.className?.substring(0, 80),
          visible: el2.offsetWidth > 0 && el2.offsetHeight > 0,
        });
      }
    }
    return found;
  });
  console.log('All inputs in "Words in User Message":');
  console.log(JSON.stringify(allInputsInSection, null, 2));

  // Click in the chip container area of "Words in User Message"
  await userMsgSection.click();
  await page.waitForTimeout(500);
  await shot(page, '6_after_click_words_section');

  // Check for inputs that appeared after clicking
  const inputsAfterClick = await userMsgSection.evaluate((el: any) => {
    const found: any[] = [];
    const walker = (document as any).createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      const el2 = node as any;
      if (['INPUT', 'TEXTAREA'].includes(el2.tagName) || el2.contentEditable === 'true') {
        found.push({
          tag: el2.tagName,
          type: el2.type,
          placeholder: el2.placeholder,
          contenteditable: el2.contentEditable,
          visible: el2.offsetWidth > 0 && el2.offsetHeight > 0,
        });
      }
    }
    return found;
  });
  console.log('Inputs after click:');
  console.log(JSON.stringify(inputsAfterClick, null, 2));

  await browser.close();
  console.log('\nDone.');
}

run().catch(e => { console.error(e); process.exit(1); });
