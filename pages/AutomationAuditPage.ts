import { type Locator, type Page } from '@playwright/test';

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
 * The section lives at the BOTTOM of /config/guardrails — the page first
 * renders escalation settings, then the Automation Audit block further down.
 *
 * Each sub-section has:
 *   - A plain-text heading (NOT a semantic heading element)
 *   - A chip/tag container holding existing entries
 *   - A hidden <textarea> that receives keyboard input when the container is clicked
 *
 * Selector strategy:
 *   - Anchor on the heading text via getByText() (case-insensitive, partial)
 *   - Scope to the nearest wrapping div that also contains a textbox (the <textarea>)
 *   - Never use styled-component class hashes — they change on rebuild
 */
export class AutomationAuditPage {
  constructor(private readonly page: Page) {}

  async navigateTo() {
    await this.page.goto('/config/guardrails');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Returns a locator scoped to the section card that contains the given heading.
   *
   * Strategy: find all div elements that contain BOTH the section heading text
   * AND a <textarea> (the tag input). `.last()` picks the most-nested div that
   * satisfies both conditions — i.e., the card itself, not a parent wrapper.
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
   * The chip container overlays a hidden <textarea>. Clicking anywhere in the
   * container focuses the textarea; typing then appends to it. Enter commits.
   */
  async addEntry(section: AuditSection, value: string): Promise<void> {
    const card = this.sectionCard(section);

    // Section is near the bottom of a long page — scroll it into view first
    await card.scrollIntoViewIfNeeded();

    const input = card.getByRole('textbox');
    await input.click();
    await input.fill(value);
    await input.press('Enter');

    // Wait for the chip to appear before proceeding.
    // exact: false because the chip element's textContent includes "×" as a child,
    // making the full text "value×" — a partial match is correct here.
    await card.getByText(value, { exact: false }).first().waitFor({ state: 'visible', timeout: 8_000 });
  }

  /**
   * Removes a single entry from the given section.
   * Safe to call in afterEach even if the entry was never added.
   *
   * Strategy: find the chip wrapper (an element that contains the chip text AND
   * a delete button), then click the button. Falls back to Backspace if no
   * button is found (works when the target chip is the last in the list).
   */
  async removeEntry(section: AuditSection, value: string): Promise<void> {
    const card = this.sectionCard(section);
    await card.scrollIntoViewIfNeeded();

    // exact: false — chip element textContent includes "×" as a child element
    const chipText = card.getByText(value, { exact: false }).first();
    if ((await chipText.count()) === 0) return;

    // The chip wrapper contains the label text + a close/delete affordance.
    // We go up to the chip wrapper (parent of the text span) and find the ×.
    const chipWrapper = chipText.locator('..');
    const deleteBtn = chipWrapper
      .locator('button, [role="button"], svg, span')
      .last(); // The × is the last child in the chip

    if ((await deleteBtn.count()) > 0) {
      await deleteBtn.click();
    } else {
      // Fallback: focus textarea and Backspace to remove last chip
      const input = card.getByRole('textbox');
      await input.click();
      await input.press('Backspace');
    }

    await chipText.waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {
      // Entry may already be gone — ignore
    });
  }

  /**
   * Returns the text of all chip entries currently listed in the given section.
   */
  async getEntries(section: AuditSection): Promise<string[]> {
    const card = this.sectionCard(section);
    await card.scrollIntoViewIfNeeded();

    // Read the card's full inner text, split into lines, strip ×, filter noise
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
