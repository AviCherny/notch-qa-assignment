import { type Page } from '@playwright/test';

export type PlaygroundResult = 'pass' | 'blocked';

/**
 * Page Object for the Playground.
 * URL: /tests/playground
 *
 * The Playground simulates the full inbound email pipeline:
 *   1. User fills in From email, Subject, and message Body
 *   2. Clicks the run button ("Hit" or equivalent)
 *   3. The system evaluates all configured Automation Audit rules
 *   4. Result is displayed: green checkmark (AI responds) or red X (blocked)
 *
 * Selector strategy: role + label text, not CSS class names.
 * If a field doesn't match, inspect the actual label text in the app and update
 * the name: /regex/ patterns in getByRole/getByLabel below.
 */
export class PlaygroundPage {
  constructor(private readonly page: Page) {}

  async navigateTo() {
    await this.page.goto('/tests/playground');
    await this.page.waitForLoadState('networkidle');
  }

  async fillEmail(email: string) {
    await this.page
      .getByRole('textbox', { name: /from|sender|email/i })
      .fill(email);
  }

  async fillSubject(subject: string) {
    await this.page
      .getByRole('textbox', { name: /subject/i })
      .fill(subject);
  }

  async fillBody(body: string) {
    // The message body may be a <textarea> or a rich-text div with role="textbox"
    await this.page
      .getByRole('textbox', { name: /message|body|content|text/i })
      .fill(body);
  }

  /**
   * Clicks the run/send button and waits for the result to render.
   */
  async run() {
    await this.page.getByRole('button', { name: /send|run|hit|submit|simulate/i }).click();
    // The result takes a moment to compute — wait for network to settle
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Reads the simulation result from the UI.
   *
   * Returns:
   *   'pass'    — green checkmark, AI would respond
   *   'blocked' — red X, conversation handed to human
   *
   * NOTE: The exact text shown depends on the app's current copy.
   * If this throws unexpectedly, open the Playground, run a test manually,
   * and inspect the result element to find the right text/selector.
   */
  async getResult(): Promise<PlaygroundResult> {
    // Give the result panel up to 15 seconds to appear after running
    const resultPanel = this.page.locator(
      '[data-testid*="result"], [class*="result"], [class*="Result"], [class*="outcome"]'
    );
    await resultPanel.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {
      // Result panel may not have a distinct wrapper — proceed and check text
    });

    // Check for "pass" indicators (green checkmark path)
    const passVisible = await this.page
      .getByText(/AI will respond|will respond|pass/i)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (passVisible) return 'pass';

    // Check for "blocked" indicators (red X path)
    const blockedVisible = await this.page
      .getByText(/will not respond|unassigned|blocked|hand.*human|human agent/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (blockedVisible) return 'blocked';

    throw new Error(
      'Could not determine Playground result.\n' +
        'The result text did not match any known pattern.\n' +
        'Inspect the result panel in the app and update getResult() in PlaygroundPage.ts.'
    );
  }
}
