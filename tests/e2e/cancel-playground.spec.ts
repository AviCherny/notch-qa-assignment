import { test, expect } from '@playwright/test';
import { AutomationAuditPage } from '../../pages/AutomationAuditPage';
import { PlaygroundPage } from '../../pages/PlaygroundPage';

/**
 * Test suite: Words in User Message — Playground E2E
 *
 * Feature: if the customer's message body contains a configured keyword,
 * the AI does NOT respond (conversation unassigned → red result).
 *
 * This test covers the full pipeline:
 *   1. Add a blocking keyword to the config and save it
 *   2. Simulate an inbound email whose body contains that keyword
 *   3. Assert the Playground returns a blocked (red) result
 *
 * Test isolation:
 *   The finally block removes the keyword and saves — regardless of outcome.
 *   The system is left in the same state it was before the test ran.
 */

const SECTION = 'Words in User Message' as const;
const BLOCKED_WORD = 'cancel';

test.describe('Words in User Message — full pipeline via Playground', () => {
  // ---------------------------------------------------------------------------
  // TC-03: blocked keyword in message body → AI does not respond
  //
  // Covers the critical path: config rule → AI pipeline → Playground result.
  // This is the "does it actually work end-to-end?" test.
  // ---------------------------------------------------------------------------
  test('message body containing a blocked word returns red (AI blocked)', async ({ page }) => {
    const auditPage = new AutomationAuditPage(page);
    const playground = new PlaygroundPage(page);

    // Arrange: add the blocking keyword and persist it to the backend
    await auditPage.navigateTo();
    await auditPage.addEntry(SECTION, BLOCKED_WORD);
    await auditPage.save();

    try {
      // Act: simulate an inbound email whose body contains the blocked word
      await playground.navigateTo();
      await playground.fillEmail('customer@example.com');
      await playground.fillSubject('Account question');
      await playground.fillBody(`I want to ${BLOCKED_WORD} my subscription.`);
      await playground.run();

      // Assert: the AI pipeline matched the rule → blocked (red X)
      const result = await playground.getResult();
      expect(result).toBe('blocked');
    } finally {
      // Cleanup: remove the keyword so the rule does not affect other tests
      await auditPage.navigateTo();
      await auditPage.removeEntry(SECTION, BLOCKED_WORD).catch(() => {});
      await auditPage.save().catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // TC-04: clean message body (no blocked keywords) → AI responds
  //
  // Baseline: without any matching keyword, the Playground must return green.
  // Catches regressions where every message gets blocked regardless of config.
  // ---------------------------------------------------------------------------
  test('message body with no blocked keywords returns green (AI responds)', async ({ page }) => {
    const playground = new PlaygroundPage(page);

    await playground.navigateTo();
    await playground.fillEmail('customer@example.com');
    await playground.fillSubject('General inquiry');
    await playground.fillBody('Hello, I have a question about my account.');
    await playground.run();

    const result = await playground.getResult();
    expect(result).toBe('pass');
  });
});
