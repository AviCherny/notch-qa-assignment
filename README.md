# Notch — Automation Audit Test Suite

E2E test suite for the **Automation Audit** feature on `/config/guardrails`.
QA home assignment submission.

---

## Deliverables

| Part | What | Where |
|------|------|-------|
| Part 1 | Test suite design — all 4 sub-features, 50+ test cases | `test-plan-automation-audit.docx` |
| Part 2 | Playwright implementation — full pipeline E2E | `tests/e2e/` |

---

## What's Being Tested

The **Automation Audit** section defines deterministic rules controlling whether the AI responds or hands off to a human.

| Category | Checks | Effect |
|----------|--------|--------|
| Emails patterns to unassign | Sender email address | Unassign conversation |
| Subjects | Email subject line | Unassign conversation |
| Words in User Message | Customer message body | Unassign conversation |
| Words in Assistant's Reply | AI draft reply | Suppress reply, hand to human |

The implemented test covers **Words in User Message** — the full pipeline from config rule to Playground result.

---

## Stack

| Layer | Tool |
|-------|------|
| Language | Python 3.12 |
| Test runner | pytest |
| Browser automation | Playwright |
| Reporting | Allure |
| CI/CD | GitHub Actions → GitHub Pages |

---

## Architecture

```
Test
 └── Page Object (extends BasePage)
       └── BasePage — @allure.step navigate_to(), wait_for_load_state()
```

```
tests/
 ├── conftest.py                         # auth setup + browser/page fixtures + failure diagnostics
 └── e2e/
     └── test_cancel_playground.py       # TC-03: add "cancel" → save → Playground → assert red

ui/
 ├── flows.py                            # navigate_to_guardrails(), navigate_to_playground()
 └── pages/
     ├── base_page.py                    # shared navigate_to() with @allure.step
     ├── automation_audit_page.py        # /config/guardrails — all 4 rule sections
     └── playground_page.py             # /tests/playground — email simulation

config.py                                # BASE_URL, TIMEOUTS, PLAYWRIGHT_TRACE_DIR, PLAYWRIGHT_VIDEO_DIR
pytest.ini                               # markers, log config, -v --tb=short
.github/workflows/tests.yml              # CI: test → Allure report → GitHub Pages
```

---

## Setup

### Prerequisites

- Python 3.12+
- Google Chrome installed

### Install

```bash
python -m venv venv
source venv/bin/activate       # macOS/Linux
venv\Scripts\activate          # Windows

pip install -r requirements.txt
playwright install chromium
```

---

## Network Access

The test target (`guardio.app.getnotch.dev`) is only accessible from the Notch internal network.
Run tests while connected to the Notch VPN or from within the office network.

---

## Auth

The app uses Google OAuth (Descope). Three strategies are supported — the first available one is used:

### 1. Saved session (default for local dev)

On first run, a browser window opens. Log in with Google. The session is saved automatically to `auth/auth.json` and reused on all subsequent runs.

```bash
pytest      # browser opens on first run, reuses session after
```

To force re-login: `rm auth/auth.json`

### 2. Token injection via environment variables

Extract your session cookies from Chrome DevTools after logging in:

```
Chrome → DevTools → Application → Cookies → guardio.app.getnotch.dev
Copy the values of "DS" and "DSR" cookies
```

Create a `.env` file (see `.env.example`), then run:

```bash
export NOTCH_DS_TOKEN=<your DS cookie value>
export NOTCH_DSR_TOKEN=<your DSR cookie value>
pytest
```

`conftest.py` creates `auth/auth.json` automatically — no interactive login needed.

### 3. CI via GitHub secret (`AUTH_JSON_B64`)

Generate the secret from an existing local session:

```bash
# Linux / macOS / Git Bash (Windows):
base64 -w 0 auth/auth.json

# PowerShell (Windows):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("auth\auth.json")) | Set-Clipboard
```

Add the result as a GitHub secret named `AUTH_JSON_B64`.
GitHub → repo Settings → Secrets and variables → Actions → New repository secret.

The CI workflow restores it automatically before running tests.

---

## Running Tests

```bash
pytest                              # run the suite
pytest --headed                     # headed mode — watch the browser
pytest -m e2e                       # run only e2e-marked tests
pytest --alluredir=allure-results   # generate Allure data
```

---

## Failure Diagnostics

On test failure, the framework automatically:
- Attaches a **screenshot** to the Allure report
- Attaches a **video recording** to the Allure report
- Saves a **Playwright trace** to `traces/<test_name>.zip`

Open any trace at [trace.playwright.dev](https://trace.playwright.dev) — full timeline, DOM snapshots, network, console.

---

## Allure Report

```bash
# Generate and open locally (requires allure CLI)
allure generate allure-results --clean -o allure-report
allure open allure-report
```

CI publishes the report to GitHub Pages after every push to `main`.

---

## CI/CD

Every push to `main` triggers: **test → Allure report → GitHub Pages deploy**.

Required GitHub secret:

| Secret | Description |
|--------|-------------|
| `AUTH_JSON_B64` | Base64-encoded `auth/auth.json` (session tokens) |

---

## Design Decisions

**Selector strategy** — All selectors anchor on visible text or ARIA roles, never on CSS class hashes. Hashes change on every rebuild; text content changes only when the product copy changes intentionally.

**Test isolation** — The test cleans up after itself in a `finally` block, even on failure. No test leaves state in the system.

**Save before Playground** — The config UI operates in draft mode. The test explicitly calls `save()` after adding a rule — this is the step that pushes the rule to the AI pipeline. Without it, the Playground result would not reflect the config change.

**`@allure.step` on BasePage** — Every `navigate_to()` call appears as a named step in the Allure report, making the test timeline readable without opening the trace.

**Failure-only tracing and video** — Both tracing and video recording run for every test but are discarded on pass. Only failures produce a trace `.zip` and a video attached to the Allure report — keeps CI storage clean without sacrificing debuggability.
