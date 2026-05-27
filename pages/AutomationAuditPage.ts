import { type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * The four rule categories in the Automation Audit section.
 * Values match the exact heading text rendered in the app (/config/guardrails).
 *
 * NOTE: Headings are plain div/p elements — NOT semantic h1-h6 — so we use
 * getByText() to locate them, not getByRole('heading').
 */
export type AuditSection =
  | 'Emails patterns to unassign'
  | 'Subjects'
  | 'Words in User Message'
  | "Words in Assistant's Reply";

/**
 * Page Object for the Automation Audit configuration section.
 * URL: /config/guardrails
 *
 * The section lives at the BOTTOM of a long page — escalation settings render
 * first, then the Automation Audit block below. Every method scrolls the
 * target card into view before interacting.
 *
 * Each sub-section has:
 *   - A plain-text heading (NOT a semantic heading element)
 *   - A chip/tag container holding existing entries
 *   - A hidden <textarea> that receives keyboard input when the container is clicked
 *
 * Selector strategy: anchor on heading text via getByText(), scope to the
 * nearest div that also contains a textbox. Never use styled-component hashes.
 */
export class AutomationAuditPage extends BasePage {
  async navigateTo(): Promise<void> {
    await super.navigateTo('/config/guardrails');
  }

  /**
   * Returns a locator scoped to the section card that contains the given heading.
   *
   * Strategy: find all divs that contain BOTH the section heading text AND a
   * <textarea> (the tag input). .last() picks the most-nested div that satisfies
   * both conditions — the card itself, not a parent wrapper.
   */
  private sectionCard(title: AuditSection): Locator {
    return this.page
      .locator('div')
      .filter({ has: this.page.getByText(title, { exact: false }) })
      .filter({ has: this.page.getByRole('textbox') })
      .last();
  }

  /**
   * Adds an entry to the given section and waits for it to appear as a chip.
   *
   * The chip container overlays a hidden <textarea>. Clicking the container
   * focuses the textarea; typing then appends to it. Enter commits.
   */
  async addEntry(section: AuditSection, value: string): Promise<void> {
    const card = this.sectionCard(section);
    await card.scrollIntoViewIfNeeded();

    const input = card.getByRole('textbox');
    await input.click();
    await input.fill(value);
    await input.press('Enter');

    // exact: false — chip element textContent includes "×" as a child
    await card.getByText(value, { exact: false }).first().waitFor({ state: 'visible', timeout: 8_000 });
  }

  /**
   * Removes a single entry from the given section.
   * Safe to call in afterEach even if the entry was never added.
   */
  async removeEntry(section: AuditSection, value: string): Promise<void> {
    const card = this.sectionCard(section);
    await card.scrollIntoViewIfNeeded();

    // exact: false — chip element textContent includes "×" as a child element
    const chipText = card.getByText(value, { exact: false }).first();
    if ((await chipText.count()) === 0) return;

    const chipWrapper = chipText.locator('..');
    const deleteBtn = chipWrapper
      .locator('button, [role="button"], svg, span')
      .last();

    if ((await deleteBtn.count()) > 0) {
      await deleteBtn.click();
    } else {
      // Fallback: focus textarea and Backspace to remove last chip
      await card.getByRole('textbox').click();
      await card.getByRole('textbox').press('Backspace');
    }

    await chipText.waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {});
  }

  /**
   * Persists pending config changes to the backend.
   *
   * After any add/remove, the page shows a "Discard / Save" toolbar.
   * Clicking Save submits the change. The toolbar disappears on success.
   *
   * Call this when tests need the rule to be active in the AI pipeline
   * (e.g. before running a Playground simulation).
   */
  async save(): Promise<void> {
    const saveBtn = this.page.getByRole('button', { name: /^save$/i });
    await saveBtn.click();
    // Toolbar disappears once the save completes
    await saveBtn.waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Returns the text of all chip entries currently listed in the given section.
   */
  async getEntries(section: AuditSection): Promise<string[]> {
    const card = this.sectionCard(section);
    await card.scrollIntoViewIfNeeded();

    const raw = await card.innerText();
    const descriptionPatterns = [
      /^The AI will/i,
      /^Unassigns/i,
      /^Add a/i,
      /^Add an/i,
    ];

    return raw
      .split('\n')
      .map(t => t.replace(/×/g, '').trim())
      .filter(t => {
        if (!t || t === section) return false;
        return !descriptionPatterns.some(re => re.test(t));
      });
  }
}
