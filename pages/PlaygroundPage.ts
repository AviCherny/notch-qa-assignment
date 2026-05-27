import { BasePage } from './BasePage';
import { TIMEOUTS } from '../config';

export type PlaygroundResult = 'pass' | 'blocked';

/**
 * Page Object for the Playground.
 * URL: /tests/playground
 *
 * The Playground simulates the full inbound email pipeline:
 *   1. Fill in From address, Subject, and message Body
 *   2. Click the run button
 *   3. The system evaluates all configured Automation Audit rules
 *   4. Result: green checkmark (AI responds) or red X (blocked)
 *
 * Selector strategy: role + label text, not CSS class hashes.
 */
export class PlaygroundPage extends BasePage {
  async navigateTo(): Promise<void> {
    await super.navigateTo('/tests/playground');
  }

  async fillEmail(email: string): Promise<void> {
    await this.page
      .getByRole('textbox', { name: /from|sender|email/i })
      .fill(email);
  }

  async fillSubject(subject: string): Promise<void> {
    await this.page
      .getByRole('textbox', { name: /subject/i })
      .fill(subject);
  }

  async fillBody(body: string): Promise<void> {
    await this.page
      .getByRole('textbox', { name: /message|body|content|text/i })
      .fill(body);
  }

  async run(): Promise<void> {
    await this.page.getByRole('button', { name: /send|run|hit|submit|simulate/i }).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Reads the simulation result from the UI.
   *
   * Returns:
   *   'pass'    — green checkmark, AI would respond
   *   'blocked' — red X, conversation handed to human
   *
   * If this throws: open the Playground manually, run a test, and inspect
   * the result element to find the current text/selector, then update here.
   */
  async getResult(): Promise<PlaygroundResult> {
    const resultPanel = this.page.locator(
      '[data-testid*="result"], [class*="result"], [class*="Result"], [class*="outcome"]'
    );
    await resultPanel.first().waitFor({ state: 'visible', timeout: TIMEOUTS.result }).catch(() => {});

    const passVisible = await this.page
      .getByText(/AI will respond|will respond|pass/i)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (passVisible) return 'pass';

    const blockedVisible = await this.page
      .getByText(/will not respond|unassigned|blocked|hand.*human|human agent/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (blockedVisible) return 'blocked';

    throw new Error(
      'Could not determine Playground result — result text matched no known pattern.\n' +
      'Inspect the result panel in the app and update getResult() in PlaygroundPage.ts.'
    );
  }
}
