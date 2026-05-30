import time
from typing import Literal

import allure
from ui.pages.base_page import BasePage
from config import TIMEOUTS

PlaygroundResult = Literal["allowed", "blocked"]


class PlaygroundPage(BasePage):
    @allure.step("Navigate to Playground")
    def navigate_to(self) -> None:
        super().navigate_to("/tests/playground")
        # The SPA navigates to the Tests section, but the Playground form only
        # renders after the "Playground" sidebar item is clicked.
        # Click it to enter form state (creates a fresh simulation view).
        pg_link = self.page.get_by_text("Playground", exact=True).first
        pg_link.wait_for(state="visible", timeout=TIMEOUTS["element"])
        pg_link.click()
        # Customer Email textarea confirms we're in "new simulation" form state.
        self.page.get_by_placeholder("e.g. mark@meta.com", exact=False).wait_for(
            state="visible", timeout=TIMEOUTS["element"]
        )

    @allure.step("Send simulation email: subject={subject}")
    def send_email(self, from_: str, subject: str, body: str) -> "PlaygroundPage":
        # Fill Customer Email
        self.page.get_by_placeholder("e.g. mark@meta.com", exact=False).fill(from_)

        # Switch Channel to Email (default is Chat).
        # Wait for the option to appear before clicking — avoids timing issues.
        channel_box = self.page.get_by_role("combobox").first
        channel_box.click()
        email_opt = self.page.get_by_role("option", name="Email")
        email_opt.wait_for(state="visible", timeout=5_000)
        email_opt.click()
        # Wait for the dropdown to close before continuing.
        email_opt.wait_for(state="hidden", timeout=5_000)

        # Scroll the Quill (message body) into view — brings Subject input into
        # the viewport too. scroll_into_view_if_needed() is synchronous; no delay needed.
        quill = self.page.locator("[contenteditable='true']:visible").first
        quill.scroll_into_view_if_needed()

        # Fill Subject — the input just above the Quill inside the compose area.
        # Guard with is_visible() to skip gracefully if the layout differs.
        subject_input = (
            self.page.locator("[id^='quill-editor']")
            .locator("input[type='text']")
            .first
        )
        if subject_input.is_visible():
            subject_input.click()
            subject_input.fill(subject)

        # Fill message body
        quill.click()
        quill.fill(body)

        # Send — creates a new simulation conversation
        self.page.get_by_role("button", name="Send as customer").click()

        return self

    @allure.step("Read simulation result")
    def get_result(self) -> PlaygroundResult:
        # Baseline: number of "Escalated" badges visible right after clicking Send
        # (any existing ones come from previous/unrelated conversations)
        baseline = self.page.get_by_text("Escalated", exact=True).count()

        # When a "Words in User Message" guardrail fires, the conversation is
        # escalated and an "Escalated" badge appears in the conversation list.
        # Poll until a new badge appears (= blocked) or the timeout expires (= pass).
        deadline = time.time() + TIMEOUTS["result"] / 1000
        while time.time() < deadline:
            if self.page.get_by_text("Escalated", exact=True).count() > baseline:
                return "blocked"
            self.page.wait_for_timeout(1000)

        return "allowed"
