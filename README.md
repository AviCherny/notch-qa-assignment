# Notch QA Assignment — UI Automation

Playwright-based end-to-end test suite for the Notch Guardrails configuration flow.

## Stack

- Python 3.12
- pytest + pytest-playwright
- Allure (reports)
- GitHub Actions (CI/CD → GitHub Pages)

## Setup

```bash
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\playwright install chromium
```

## Authentication

The app authenticates via `DS` and `DSR` tokens stored in **localStorage**.
Google OAuth blocks automation browsers, so login must be done manually once.

### One-time setup (local)

1. Open **Chrome** and navigate to `https://guardio.app.getnotch.dev`
2. Log in with your Google account
3. Open **DevTools → Application → Local Storage → https://guardio.app.getnotch.dev**
4. Copy the values of `DS` and `DSR`
5. Run the save script and paste when prompted:

```bash
venv\Scripts\python scripts\save_auth.py
```

This creates `auth/auth.json` which is reused for all subsequent test runs.

### CI (GitHub Actions)

The session is injected via a base64-encoded secret:

```bash
# Generate once from a valid auth/auth.json:
base64 -w 0 auth/auth.json
```

Add the output as a GitHub secret named `AUTH_JSON_B64`.

## Running tests

```bash
# Headless (default)
venv\Scripts\pytest -m e2e

# Headed (see the browser)
venv\Scripts\pytest -m e2e --headed

# With Allure report
venv\Scripts\pytest -m e2e --alluredir=allure-results
allure serve allure-results
```

## Project structure

```
ui/
  pages/
    base_page.py              # navigate_to, wait_for_url
    automation_audit_page.py  # Guardrails config page (add/remove/save)
    playground_page.py        # Playground simulation page
  flows.py                    # Reusable multi-step flows

tests/
  conftest.py                 # Auth, browser context, screenshot/video on failure
  e2e/
    conftest.py               # cleanup_blocked_word fixture
    test_cancel_playground.py # Main test

scripts/
  save_auth.py                # One-time auth setup helper
```

## CI/CD

On every push to `main`:
1. Tests run against `https://guardio.app.getnotch.dev`
2. Allure report is generated
3. Report is published to GitHub Pages (on success)

Traces and videos are attached to Allure on failure.
