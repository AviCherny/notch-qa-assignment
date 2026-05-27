from typing import Literal

import allure
from playwright.sync_api import Locator

from ui.pages.base_page import BasePage

# Values match the exact heading text rendered in the app (/config/guardrails).
# Headings are plain div/p elements — NOT semantic h1-h6 — so we use
# get_by_text(), not get_by_role("heading").
AuditSection = Literal[
    "Emails patterns to unassign",
    "Subjects",
    "Words in User Message",
    "Words in Assistant's Reply",
]


class AutomationAuditPage(BasePage):
    @allure.step("Navigate to Guardrails config")
    def navigate_to(self) -> None:
        super().navigate_to("/config/guardrails")

    def _section_card(self, title: AuditSection) -> Locator:
        return (
            self.page.locator("div")
            .filter(has=self.page.get_by_text(title, exact=False))
            .filter(has=self.page.get_by_role("textbox"))
            .last
        )

    @allure.step("Add '{value}' to {section}")
    def add_entry(self, section: AuditSection, value: str) -> None:
        card = self._section_card(section)
        card.scroll_into_view_if_needed()

        inp = card.get_by_role("textbox")
        inp.click()
        inp.fill(value)
        inp.press("Enter")

        # exact=False — chip textContent includes "×" as a child element
        card.get_by_text(value, exact=False).first.wait_for(state="visible", timeout=8_000)

    @allure.step("Remove '{value}' from {section}")
    def remove_entry(self, section: AuditSection, value: str) -> None:
        card = self._section_card(section)
        card.scroll_into_view_if_needed()

        chip_text = card.get_by_text(value, exact=False).first
        if chip_text.count() == 0:
            return

        # Chip wrapper contains the label + a close affordance (×).
        # Go up to the wrapper and click the last child (the × button).
        chip_wrapper = chip_text.locator("..")
        delete_btn = chip_wrapper.locator('button, [role="button"], svg, span').last

        if delete_btn.count() > 0:
            delete_btn.click()
        else:
            # Fallback: focus textarea and Backspace to remove last chip
            card.get_by_role("textbox").click()
            card.get_by_role("textbox").press("Backspace")

        chip_text.wait_for(state="detached", timeout=8_000)

    @allure.step("Save config changes")
    def save(self) -> None:
        save_btn = self.page.get_by_role("button", name="Save")
        save_btn.click()
        save_btn.wait_for(state="detached", timeout=10_000)  # toolbar disappears on success
        self.page.wait_for_load_state("networkidle")

