/**
 * Captures the Automation Audit section and Playground with correct interactions.
 * Run: npx ts-node --transpile-only scripts/capture-sections.ts
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '..', 'auth', 'auth.json');
const OUT = path.join(__dirname, '..', 'screenshots');
const BASE = 'https://guardio.app.getnotch.dev';

async function shot(page: any, name: string) {
  const p = path.join(OUT, `capture_${name}.png`);
  await page.screenshot({ path: p });
  console.log(`  Saved: capture_${name}.png`);
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({ storageState: AUTH_FILE, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // --- 1. Guardrails page: scroll to Automation Audit ---
  console.log('\n[1] Loading Guardrails page...');
  await page.goto(`${BASE}/config/guardrails`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('  Scrolling to Automation Audit section...');
  await page.getByText('Automation Audit').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot(page, '1_automation_audit_visible');

  // Scroll down a bit more to see the full section
  await page.evaluate('window.scrollBy(0, 200)');
  await page.waitForTimeout(500);
  await shot(page, '2_automation_audit_sections');

  await page.evaluate('window.scrollBy(0, 400)');
  await page.waitForTimeout(500);
  await shot(page, '3_automation_audit_bottom');

  // Capture the DOM of the section
  const auditSectionText = await page.evaluate(() => {
    const el = (document as any).querySelector('*');
    // Try to find a parent containing 'Automation Audit' text
    const all = (document as any).querySelectorAll('*');
    for (const node of all) {
      if (node.innerText && node.innerText.includes('Automation Audit') && node.innerText.includes('Words in User Message')) {
        return node.outerHTML.substring(0, 5000);
      }
    }
    return 'not found';
  });
  fs.writeFileSync(path.join(OUT, 'capture_audit_section.html'), auditSectionText);
  console.log('  Audit section HTML saved (first 5000 chars)');

  // Check what elements are in the "Words in User Message" area
  console.log('\n[2] Examining Words in User Message section...');
  const wordsSection = page.locator('div').filter({ hasText: /Words in User Message/i }).last();

  const inputs = await wordsSection.locator('input, textarea, [role="textbox"], [contenteditable]').all();
  console.log(`  Input elements found: ${inputs.length}`);
  for (let i = 0; i < inputs.length; i++) {
    const tag = await inputs[i].evaluate((el: any) => el.tagName);
    const placeholder = await inputs[i].getAttribute('placeholder');
    const role = await inputs[i].getAttribute('role');
    console.log(`  [${i}] tag=${tag} placeholder="${placeholder}" role="${role}"`);
  }

  // Capture the "Words in User Message" input interaction
  const wordsInput = page.getByPlaceholder(/Add a word/i).first();
  const wordsInputVisible = await wordsInput.isVisible().catch(() => false);
  console.log(`  "Add a word" input visible: ${wordsInputVisible}`);

  if (!wordsInputVisible) {
    // Try clicking the section container to reveal input
    await wordsSection.click();
    await page.waitForTimeout(500);
    await shot(page, '4_after_click_words_section');

    const wordsInputAfter = await page.getByPlaceholder(/Add a word/i).first().isVisible().catch(() => false);
    console.log(`  "Add a word" input visible after click: ${wordsInputAfter}`);
  }

  // --- 2. Playground page ---
  console.log('\n[3] Loading Playground page...');
  await page.goto(`${BASE}/tests/playground`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await shot(page, '5_playground_initial');

  const playgroundText = await page.evaluate(() => (document as any).body.innerText);
  fs.writeFileSync(path.join(OUT, 'capture_playground_text.txt'), playgroundText);
  console.log('  Playground text saved');

  // Check for any inputs/buttons on playground
  const pgInputs = await page.locator('input, textarea, [role="textbox"]').all();
  console.log(`  Playground input elements: ${pgInputs.length}`);
  for (let i = 0; i < pgInputs.length; i++) {
    const placeholder = await pgInputs[i].getAttribute('placeholder');
    const tag = await pgInputs[i].evaluate((el: any) => el.tagName);
    console.log(`  [${i}] tag=${tag} placeholder="${placeholder}"`);
  }

  const pgButtons = await page.locator('button').all();
  console.log(`  Playground buttons: ${pgButtons.length}`);
  for (let i = 0; i < pgButtons.length; i++) {
    const text = await pgButtons[i].innerText().catch(() => '');
    if (text) console.log(`  btn[${i}]: "${text.trim()}"`);
  }

  await browser.close();
  console.log('\nDone.');
}

run().catch(e => { console.error(e); process.exit(1); });
