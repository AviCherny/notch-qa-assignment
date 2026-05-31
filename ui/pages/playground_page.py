from typing import Literal

import allure
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from ui.pages.base_page import BasePage
from config import TIMEOUTS

PlaygroundResult = Literal["allowed", "blocked"]


class PlaygroundPage(BasePage):
    @allure.step("Navigate to Playground")
    def navigate_to(self) -> None:
        super().navigate_to("/tests/playground")
        # SPA lands in thread view — must click the "Playground" sidebar item
        # to enter form state (fresh simulation form with Customer Email textarea).
        pg_link = self.page.get_by_text("Playground", exact=True).first
        pg_link.wait_for(state="visible", timeout=TIMEOUTS["element"])
        pg_link.click()
        self.page.get_by_placeholder("e.g. mark@meta.com", exact=False).wait_for(
            state="visible", timeout=TIMEOUTS["element"]
        )

    @allure.step("Send simulation email: subject={subject}")
    def send_email(self, from_: str, subject: str, body: str) -> "PlaygroundPage":
        self.page.get_by_placeholder("e.g. mark@meta.com", exact=False).fill(from_)

        # Default channel is Chat — switch to Email.
        channel_box = self.page.get_by_role("combobox").first
        channel_box.click()
        email_opt = self.page.get_by_role("option", name="Email")
        email_opt.wait_for(state="visible", timeout=TIMEOUTS["element"])
        email_opt.click()
        email_opt.wait_for(state="hidden", timeout=TIMEOUTS["element"])

        quill = self.page.locator("[contenteditable='true']:visible").first
        quill.scroll_into_view_if_needed()

        # Subject input is optional — skip gracefully if layout differs.
        subject_input = (
            self.page.locator("[id^='quill-editor']")
            .locator("input[type='text']")
            .first
        )
        if subject_input.is_visible():
            subject_input.click()
            subject_input.fill(subject)

        quill.click()
        quill.fill(body)
        self.page.get_by_role("button", name="Send as customer").click()

        return self

    @allure.step("Read simulation result")
    def get_result(self) -> PlaygroundResult:
        # Capture existing "Escalated" badges before send — ignore unrelated conversations.
        # nth(baseline) targets the next badge; TimeoutError → no new badge → allowed.
        baseline = self.page.get_by_text("Escalated", exact=True).count()
        try:
            self.page.get_by_text("Escalated", exact=True).nth(baseline).wait_for(
                state="visible", timeout=TIMEOUTS["result"]
            )
            return "blocked"
        except PlaywrightTimeoutError:
            return "allowed"
