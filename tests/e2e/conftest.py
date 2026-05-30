import pytest
import ui.flows as flows


@pytest.fixture
def cleanup_blocked_word(page):
    """
    Factory fixture — call it with (section, word) to register a cleanup entry.
    All registered entries are removed after the test, even on failure.

    Usage:
        def test_something(page, cleanup_blocked_word):
            cleanup_blocked_word(SECTION, BLOCKED_WORD)
            # ... test body ...
    """
    cleanups: list[tuple[str, str]] = []
    yield lambda section, word: cleanups.append((section, word))
    if not cleanups:
        return
    audit = flows.navigate_to_guardrails(page)
    for section, word in cleanups:
        audit.remove_entry(section, word)
    audit.save()
