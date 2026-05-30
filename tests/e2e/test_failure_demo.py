import allure
import pytest

import ui.flows as flows

# fmt: off
#
# Intentionally failing test.
#
# No config rules are added — the Playground will return "allowed" for a clean email.
# The assertion is wrong by design: it asserts "blocked" to trigger a failure.
#
# Why it exists:
#   pytest.mark.xfail(strict=True) tells pytest to expect this test to fail.
#   If it somehow passes, that becomes the error. This guarantees the diagnostics
#   pipeline (screenshot → video → Playwright trace) is exercised on every CI run,
#   so you can see it working in the Allure report without needing a real product bug.
#
# fmt: on


@pytest.mark.xfail(strict=True, reason="Intentional failure — demonstrates Allure failure artifacts")
@pytest.mark.e2e
@allure.feature("Automation Audit")
@allure.story("Failure Diagnostics Demo")
@allure.title("Clean email incorrectly asserted as blocked [INTENTIONAL FAILURE — artifact demo]")
def test_failure_diagnostics_demo(page):
    result = flows.run_simulation(
        page,
        from_="demo@example.com",
        subject="Hello",
        body="Just a regular message with no blocked words.",
    )

    # Wrong on purpose — result will be "allowed", not "blocked"
    assert result == "blocked", (
        f"Expected 'blocked' (wrong by design — actual result is '{result}'). "
        "This failure demonstrates the Allure diagnostic artifacts pipeline."
    )

