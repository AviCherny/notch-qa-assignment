"""
Test suite: Words in User Message — inbound content filter

Feature: if the customer's message body contains a configured keyword,
the conversation is unassigned — the AI does NOT respond.

Scope: config-layer CRUD tests — add a keyword, verify it persists,
delete it, verify it's removed.

Test isolation:
  Each test adds a unique timestamped keyword to avoid cross-run collisions.
  Cleanup always runs (finally block), restoring the system to its pre-test state.
"""

import time
import random
import string

import allure
import pytest

from pages.automation_audit_page import AutomationAuditPage

SECTION = "Words in User Message"


def unique_word() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase, k=5))
    return f"autotest_{int(time.time())}_{suffix}"


@pytest.mark.e2e
@allure.feature("Automation Audit")
@allure.story("Words in User Message")
class TestWordsInMessage:

    # -------------------------------------------------------------------------
    # TC-01: Keyword is saved to config
    #
    # Verifies: adding a keyword via the UI persists it in the Automation Audit
    # list. This is the necessary precondition for the AI to apply the rule.
    # -------------------------------------------------------------------------
    @allure.title("Added keyword appears in the Words in User Message list")
    def test_added_keyword_appears_in_list(self, page):
        word = unique_word()
        audit = AutomationAuditPage(page)

        audit.navigate_to()
        audit.add_entry(SECTION, word)

        try:
            entries = audit.get_entries(SECTION)
            assert any(word in e for e in entries), (
                f"Expected '{word}' in entries, got: {entries}"
            )
        finally:
            audit.remove_entry(SECTION, word)

    # -------------------------------------------------------------------------
    # TC-02: Deleting a keyword removes it from config
    #
    # Verifies: the × on a chip removes the rule. If deletion is broken,
    # stale keywords permanently block conversations — a high-impact bug.
    # -------------------------------------------------------------------------
    @allure.title("Deleted keyword is removed from the Words in User Message list")
    def test_deleted_keyword_is_removed_from_list(self, page):
        word = unique_word()
        audit = AutomationAuditPage(page)

        # Arrange
        audit.navigate_to()
        audit.add_entry(SECTION, word)

        # Act
        audit.remove_entry(SECTION, word)

        # Assert
        entries = audit.get_entries(SECTION)
        assert not any(word in e for e in entries), (
            f"Expected '{word}' to be gone, but still found in: {entries}"
        )
