import re
from typing import Literal

import allure
from ui.pages.base_page import BasePage
from config import TIMEOUTS

PlaygroundResult = Literal["pass", "blocked"]


class PlaygroundPage(BasePage):
    """
    Page Object for the Playground.
    URL: /tests/playground

    The Playground simulates the full inbound email pipeline:
      1. Fill in From address, Subject, and message Body
      2. Click the run button
      3. The system evaluates all configured Automation Audit rules
      4. Result: green checkmark (AI responds) or red X (blocked)

    Selector strategy: role + label text / regex, not CSS class hashes.
    """

    @allure.step("Navigate to Playground")
    def navigate_to(self) -> None:
        super().navigate_to("/tests/playground")

    @allure.step("Fill email: {email}")
    def fill_email(self, email: str) -> None:
        self.page.get_by_role("textbox", name=re.compile(r"from|sender|email", re.I)).fill(email)

    @allure.step("Fill subject: {subject}")
    def fill_subject(self, subject: str) -> None:
        self.page.get_by_role("textbox", name=re.compile(r"subject", re.I)).fill(subject)

    @allure.step("Fill body: {body}")
    def fill_body(self, body: str) -> None:
        self.page.get_by_role("textbox", name=re.compile(r"message|body|content|text", re.I)).fill(body)

    @allure.step("Run simulation")
    def run(self) -> None:
        self.page.get_by_role("button", name=re.compile(r"send|run|hit|submit|simulate", re.I)).click()
        self.page.wait_for_load_state("networkidle")

    @allure.step("Read simulation result")
    def get_result(self) -> PlaygroundResult:
        """
        Reads the simulation result.

        Returns:
            'pass'    — green checkmark, AI would respond
            'blocked' — red X, conversation handed to human

        If this raises: open the Playground manually, run a test, inspect the
        result element and update the text patterns below.
        """
        result_panel = self.page.locator(
            '[data-testid*="result"], [class*="result"], [class*="Result"], [class*="outcome"]'
        )
        result_panel.first.wait_for(state="visible", timeout=TIMEOUTS["result"])

        try:
            if self.page.get_by_text(re.compile(r"AI will respond|will respond|pass", re.I)).is_visible(timeout=5_000):
                return "pass"
        except Exception:
            pass

        try:
            if self.page.get_by_text(re.compile(r"will not respond|unassigned|blocked|hand.*human", re.I)).is_visible(timeout=3_000):
                return "blocked"
        except Exception:
            pass

        raise RuntimeError(
            "Could not determine Playground result — result text matched no known pattern.\n"
            "Inspect the result panel in the app and update get_result() in playground_page.py."
        )
