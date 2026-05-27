import re
from typing import Literal

import allure
from ui.pages.base_page import BasePage
from config import TIMEOUTS

PlaygroundResult = Literal["pass", "blocked"]


class PlaygroundPage(BasePage):
    @allure.step("Navigate to Playground")
    def navigate_to(self) -> None:
        super().navigate_to("/tests/playground")

    @allure.step("Send simulation email: subject={subject}")
    def send_email(self, from_: str, subject: str, body: str) -> "PlaygroundPage":
        self.page.get_by_role("textbox", name=re.compile(r"from|sender|email", re.I)).fill(from_)
        self.page.get_by_role("textbox", name=re.compile(r"subject", re.I)).fill(subject)
        self.page.get_by_role("textbox", name=re.compile(r"message|body|content|text", re.I)).fill(body)
        self.page.get_by_role("button", name=re.compile(r"send|run|hit|submit|simulate", re.I)).click()
        self.page.wait_for_load_state("networkidle")
        return self

    @allure.step("Read simulation result")
    def get_result(self) -> PlaygroundResult:
        result_panel = self.page.locator(
            '[data-testid*="result"], [class*="result"], [class*="Result"], [class*="outcome"]'
        )
        result_panel.first.wait_for(state="visible", timeout=TIMEOUTS["result"])
        text = result_panel.first.inner_text().lower()

        if re.search(r"ai will respond|will respond|pass", text):
            return "pass"
        if re.search(r"will not respond|unassigned|blocked|hand.*human", text):
            return "blocked"

        raise RuntimeError(
            "Could not determine Playground result — result text matched no known pattern.\n"
            "Inspect the result panel in the app and update get_result() in playground_page.py."
        )
