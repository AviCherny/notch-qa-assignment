import allure
from playwright.sync_api import Page

from ui.pages.automation_audit_page import AutomationAuditPage
from ui.pages.playground_page import PlaygroundPage


@allure.step("Navigate to Guardrails config")
def navigate_to_guardrails(page: Page) -> AutomationAuditPage:
    audit = AutomationAuditPage(page)
    audit.navigate_to()
    return audit


@allure.step("Navigate to Playground")
def navigate_to_playground(page: Page) -> PlaygroundPage:
    playground = PlaygroundPage(page)
    playground.navigate_to()
    return playground
