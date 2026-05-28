import pytest
import ui.flows as flows

_SECTION = "Words in User Message"
_BLOCKED_WORD = "cancel"


@pytest.fixture
def cleanup_blocked_word(page):
    """Removes the blocked word from config after the test — runs even on failure."""
    yield
    audit = flows.navigate_to_guardrails(page)
    audit.remove_entry(_SECTION, _BLOCKED_WORD)
    audit.save()
