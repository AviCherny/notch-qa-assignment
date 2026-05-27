from playwright.sync_api import Page


class BasePage:
    """
    Base class for all Page Objects.
    Provides a shared navigate_to() so every page does the same thing on load:
    go to path, wait for networkidle.
    """

    def __init__(self, page: Page):
        self.page = page

    def navigate_to(self, path: str) -> None:
        self.page.goto(path)
        self.page.wait_for_load_state("networkidle")
