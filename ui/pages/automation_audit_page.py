from typing import Literal

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
    """
    Page Object for the Automation Audit configuration section.
    URL: /config/guardrails

    The section lives at the BOTTOM of a long page — escalation settings render
    first, then the Automation Audit block below. Every method scrolls the
    target card into view before interacting.

    Each sub-section has:
      - A plain-text heading (NOT a semantic heading element)
      - A chip/tag container holding existing entries
      - A hidden <textarea> that receives keyboard input when the container is clicked

    Selector strategy: anchor on heading text via get_by_text(), scope to the
    nearest div that also contains a textbox. Never use styled-component hashes.
    """

    def navigate_to(self) -> None:
        super().navigate_to("/config/guardrails")

    def _section_card(self, title: AuditSection) -> Locator:
        """
        Returns a locator scoped to the section card that contains the given heading.

        Strategy: find all divs that contain BOTH the section heading text AND a
        <textarea> (the tag input). .last picks the most-nested div — the card
        itself, not a parent wrapper.
        """
        return (
            self.page.locator("div")
            .filter(has=self.page.get_by_text(title, exact=False))
            .filter(has=self.page.get_by_role("textbox"))
            .last
        )

    def add_entry(self, section: AuditSection, value: str) -> None:
        """Adds an entry and waits for the chip to appear."""
        card = self._section_card(section)
        card.scroll_into_view_if_needed()

        inp = card.get_by_role("textbox")
        inp.click()
        inp.fill(value)
        inp.press("Enter")

        # exact=False — chip textContent includes "×" as a child element
        card.get_by_text(value, exact=False).first.wait_for(state="visible", timeout=8_000)

    def remove_entry(self, section: AuditSection, value: str) -> None:
        """Removes an entry. Safe to call even if the entry was never added."""
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

    def save(self) -> None:
        """
        Persists pending config changes to the backend.

        After any add/remove the page shows a "Discard / Save" toolbar.
        Save submits the change; the toolbar disappears on success.
        Call this before running Playground simulations.
        """
        save_btn = self.page.get_by_role("button", name="Save")
        save_btn.click()
        # Toolbar disappears once the save completes
        save_btn.wait_for(state="detached", timeout=10_000)
        self.page.wait_for_load_state("networkidle")

    def get_entries(self, section: AuditSection) -> list[str]:
        """Returns the text of all chip entries currently listed in the given section."""
        card = self._section_card(section)
        card.scroll_into_view_if_needed()

        raw = card.inner_text()
        description_patterns = (
            "The AI will",
            "Unassigns",
            "Add a",
            "Add an",
        )

        results = []
        for line in raw.splitlines():
            text = line.replace("×", "").strip()
            if not text or text == section:
                continue
            if any(text.startswith(p) for p in description_patterns):
                continue
            results.append(text)
        return results
