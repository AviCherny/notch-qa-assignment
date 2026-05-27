"""
TC-03: Words in User Message → Playground E2E

A keyword added to "Words in User Message" config must cause the AI pipeline
to block the conversation. This test covers the full path:
  1. Add "cancel" to config and save to the backend
  2. Send a Playground email whose body contains "cancel"
  3. Assert the result is red (AI does not respond)

Cleanup: the keyword is always removed in a finally block so the rule
doesn't affect other runs.
"""

import allure
import pytest

from ui.pages.automation_audit_page import AutomationAuditPage
from ui.pages.playground_page import PlaygroundPage

SECTION = "Words in User Message"
BLOCKED_WORD = "cancel"


@pytest.mark.e2e
@allure.feature("Automation Audit")
@allure.story("Words in User Message")
class TestCancelBlocksPlayground:

    @allure.title("Message body containing a blocked word returns red (AI blocked)")
    def test_blocked_word_in_body_returns_red(self, page):
        audit = AutomationAuditPage(page)
        playground = PlaygroundPage(page)

        # Arrange: add the blocking keyword and persist it to the backend
        audit.navigate_to()
        audit.add_entry(SECTION, BLOCKED_WORD)
        audit.save()

        try:
            # Act: simulate an inbound email whose body contains the blocked word
            playground.navigate_to()
            playground.fill_email("customer@example.com")
            playground.fill_subject("Account question")
            playground.fill_body(f"I want to {BLOCKED_WORD} my subscription.")
            playground.run()

            # Assert: rule matched → AI does not respond (red X)
            result = playground.get_result()
            assert result == "blocked", f"Expected 'blocked', got '{result}'"

        finally:
            # Cleanup: remove the keyword so this rule doesn't persist between runs
            audit.navigate_to()
            try:
                audit.remove_entry(SECTION, BLOCKED_WORD)
                audit.save()
            except Exception:
                pass
