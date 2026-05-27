import allure
import pytest
import ui.flows as flows

SECTION = "Words in User Message"
BLOCKED_WORD = "cancel"


@pytest.mark.e2e
@allure.feature("Automation Audit")
@allure.story("Words in User Message")
@allure.title("Message body containing a blocked word returns red (AI blocked)")
def test_blocked_word_in_body_returns_red(page, cleanup_blocked_word):
    audit = flows.navigate_to_guardrails(page)
    audit.add_entry(SECTION, BLOCKED_WORD)
    audit.save()

    result = flows.run_simulation(
        page,
        from_="customer@example.com",
        subject="Account question",
        body=f"I want to {BLOCKED_WORD} my subscription.",
    )

    assert result == "blocked"
