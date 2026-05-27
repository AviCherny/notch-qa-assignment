"""
TC-03: Words in User Message → Playground E2E

A keyword added to "Words in User Message" config must cause the AI pipeline
to block the conversation. Covers the full path:
  1. Add "cancel" to config and save to the backend
  2. Send a Playground email whose body contains "cancel"
  3. Assert the result is red (AI does not respond)

Cleanup is handled by the remove_blocked_word fixture — always runs after the
test, regardless of outcome.
"""

import allure
import pytest
import ui.flows as flows

SECTION = "Words in User Message"
BLOCKED_WORD = "cancel"


@pytest.fixture(autouse=True)
def remove_blocked_word(page):
    yield
    audit = flows.navigate_to_guardrails(page)
    audit.remove_entry(SECTION, BLOCKED_WORD)
    audit.save()


@pytest.mark.e2e
@allure.feature("Automation Audit")
@allure.story("Words in User Message")
@allure.title("Message body containing a blocked word returns red (AI blocked)")
def test_blocked_word_in_body_returns_red(page):
    audit = flows.navigate_to_guardrails(page)
    audit.add_entry(SECTION, BLOCKED_WORD)
    audit.save()

    playground = flows.navigate_to_playground(page)
    playground.fill_email("customer@example.com")
    playground.fill_subject("Account question")
    playground.fill_body(f"I want to {BLOCKED_WORD} my subscription.")
    playground.run()

    result = playground.get_result()
    assert result == "blocked", f"Expected 'blocked', got '{result}'"
