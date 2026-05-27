"""
Test suite: Words in User Message — Playground E2E

Feature: if the customer's message body contains a configured keyword,
the AI does NOT respond (conversation unassigned → red result).

This suite covers the full pipeline:
  1. Add a blocking keyword to config and save it to the backend
  2. Simulate an inbound email whose body contains that keyword via Playground
  3. Assert the result is blocked (red X)

Test isolation:
  The finally block removes the keyword and saves — regardless of outcome.
  The system is left in the same state it was before the test ran.
"""

import allure
import pytest

from pages.automation_audit_page import AutomationAuditPage
from pages.playground_page import PlaygroundPage

SECTION      = "Words in User Message"
BLOCKED_WORD = "cancel"


@pytest.mark.e2e
@allure.feature("Automation Audit")
@allure.story("Playground")
class TestCancelPlayground:

    # -------------------------------------------------------------------------
    # TC-03: blocked keyword in message body → AI does not respond
    #
    # Covers the critical path: config rule → AI pipeline → Playground result.
    # -------------------------------------------------------------------------
    @allure.title("Message body containing a blocked word returns red (AI blocked)")
    def test_blocked_word_in_body_returns_red(self, page):
        audit      = AutomationAuditPage(page)
        playground = PlaygroundPage(page)

        # Arrange: add the blocking keyword and save to backend
        audit.navigate_to()
        audit.add_entry(SECTION, BLOCKED_WORD)
        audit.save()

        try:
            # Act: simulate an inbound email containing the blocked word
            playground.navigate_to()
            playground.fill_email("customer@example.com")
            playground.fill_subject("Account question")
            playground.fill_body(f"I want to {BLOCKED_WORD} my subscription.")
            playground.run()

            # Assert: AI pipeline matched the rule → blocked (red X)
            result = playground.get_result()
            assert result == "blocked", f"Expected 'blocked', got '{result}'"

        finally:
            # Cleanup: remove keyword so the rule doesn't affect other tests
            audit.navigate_to()
            try:
                audit.remove_entry(SECTION, BLOCKED_WORD)
                audit.save()
            except Exception:
                pass

    # -------------------------------------------------------------------------
    # TC-04: clean message body (no blocked keywords) → AI responds
    #
    # Baseline: without any matching keyword the Playground must return green.
    # Catches regressions where every message gets blocked regardless of config.
    # -------------------------------------------------------------------------
    @allure.title("Message body with no blocked keywords returns green (AI responds)")
    def test_clean_body_returns_green(self, page):
        playground = PlaygroundPage(page)

        playground.navigate_to()
        playground.fill_email("customer@example.com")
        playground.fill_subject("General inquiry")
        playground.fill_body("Hello, I have a question about my account.")
        playground.run()

        result = playground.get_result()
        assert result == "pass", f"Expected 'pass', got '{result}'"
