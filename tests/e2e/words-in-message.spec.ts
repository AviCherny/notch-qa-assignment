import { test, expect } from '@playwright/test';
import { AutomationAuditPage } from '../../pages/AutomationAuditPage';

/**
 * Test suite: Words in User Message (inbound content filter)
 *
 * Feature: If the customer's message body contains a configured keyword,
 * the conversation is unassigned — the AI does NOT respond.
 *
 * Scope: Config-layer CRUD tests — add a keyword, verify it persists,
 * delete it, verify it's removed.
 *
 * Why not the Playground?
 *   The Playground (Tests → Playground) renders a blank panel in this
 *   environment — no email composition form is shown. The full E2E flow
 *   (add keyword → send mock email via Playground → assert red/green result)
 *   is documented below under TC-03 as a spec-only test case.
 *
 *   Config-layer verification is still meaningful: if the keyword is saved
 *   to the config, the AI pipeline WILL apply it. The config state IS the
 *   system state for these deterministic rules.
 *
 * Test isolation:
 *   Each test adds a unique timestamped keyword to avoid cross-run collisions.
 *   afterEach removes it, restoring the system to its pre-test state.
 */

const SECTION = 'Words in User Message' as const;

// Each test generates its own unique keyword — no shared state, safe to run in parallel
const uniqueWord = () => `autotest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

test.describe('Words in User Message — inbound content filter', () => {
  // ---------------------------------------------------------------------------
  // TC-01: Keyword is saved to config
  //
  // Verifies: adding a keyword via the UI persists it in the Automation Audit
  // list. This is the necessary precondition for the AI to apply the rule.
  // ---------------------------------------------------------------------------
  test('added keyword appears in the Words in User Message list', async ({ page }) => {
    const word = uniqueWord();
    const auditPage = new AutomationAuditPage(page);

    await auditPage.navigateTo();
    await auditPage.addEntry(SECTION, word);

    try {
      const entries = await auditPage.getEntries(SECTION);
      expect(entries.some(e => e.includes(word))).toBe(true);
    } finally {
      await auditPage.removeEntry(SECTION, word).catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // TC-02: Deleting a keyword removes it from config
  //
  // Verifies: the delete (×) on a chip removes the rule. If deletion is broken,
  // stale keywords would permanently block conversations — a high-impact bug.
  // ---------------------------------------------------------------------------
  test('deleted keyword is removed from the Words in User Message list', async ({ page }) => {
    const word = uniqueWord();
    const auditPage = new AutomationAuditPage(page);

    // Arrange
    await auditPage.navigateTo();
    await auditPage.addEntry(SECTION, word);

    // Act
    await auditPage.removeEntry(SECTION, word);

    // Assert
    const after = await auditPage.getEntries(SECTION);
    expect(after.some(e => e.includes(word))).toBe(false);
  });
});

/**
 * Full test plan — cases covered by this suite in code, and cases documented
 * for implementation when the Playground is available:
 *
 * IMPLEMENTED (config-layer):
 *   TC-01  Keyword added → appears in list                       ✅ above
 *   TC-02  Keyword deleted → removed from list                   ✅ above
 *
 * SPEC-ONLY (require Playground email simulation):
 *   TC-03  Rule triggers: message body contains keyword → AI blocked (red)
 *   TC-04  Baseline: clean message, no blocked keywords → AI responds (green)
 *   TC-05  Case insensitivity: "LAWSUIT" blocks same as "lawsuit"
 *   TC-06  Partial match: does "law" block a message containing "lawsuit"?
 *   TC-07  Subject isolation: keyword in Subject does NOT trigger "Words in
 *          User Message" — it would only trigger the "Subjects" rule
 *   TC-08  Empty body: no crash, result is green
 *   TC-09  Unicode / special characters in keyword
 *   TC-10  Multiple keywords in one message: still blocked
 *
 * HOW TC-03 WOULD LOOK (Playground available):
 *
 *   test('AI is blocked when message body contains a configured keyword', async () => {
 *     await auditPage.navigateTo();
 *     await auditPage.addEntry(SECTION, BLOCKED_WORD);
 *
 *     await playground.navigateTo();
 *     await playground.fillEmail('customer@example.com');
 *     await playground.fillSubject('Help needed');
 *     await playground.fillBody(`I need help with ${BLOCKED_WORD}.`);
 *     await playground.run();
 *
 *     expect(await playground.getResult()).toBe('blocked');
 *   });
 */
