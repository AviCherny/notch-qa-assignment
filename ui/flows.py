import allure
from playwright.sync_api import Page

from ui.pages.automation_audit_page import AutomationAuditPage
from ui.pages.playground_page import PlaygroundPage, PlaygroundResult


@allure.step("Navigate to Guardrails config")
def navigate_to_guardrails(page: Page) -> AutomationAuditPage:
    audit = AutomationAuditPage(page)
    audit.navigate_to()
    return audit


@allure.step("Run Playground simulation: subject={subject}")
def run_simulation(page: Page, from_: str, subject: str, body: str) -> PlaygroundResult:
    playground = PlaygroundPage(page)
    playground.navigate_to()
    playground.send_email(from_=from_, subject=subject, body=body)
    return playground.get_result()
