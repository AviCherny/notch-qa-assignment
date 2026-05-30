# Notch — Automation Audit Test Suite

E2E test suite for the **Automation Audit** feature on `/config/guardrails`.
QA home assignment submission.

[![Tests](https://github.com/AviCherny/notch-qa-assignment/actions/workflows/tests.yml/badge.svg)](https://github.com/AviCherny/notch-qa-assignment/actions/workflows/tests.yml)
[![Allure Report](https://img.shields.io/badge/Allure-Report-orange)](https://avicherny.github.io/notch-qa-assignment/)

---

## Deliverables

| Part | What | Where |
|------|------|-------|
| Part 1 | Test suite design — all 4 sub-features, 50+ test cases | `test-plan-automation-audit.docx` |
| Part 2 | Playwright implementation — full pipeline E2E | `tests/e2e/` |
| Design | Rationale behind every key technical decision | [DESIGN.md](DESIGN.md) |

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
     ├── test_words_in_message.py        # TC: add "cancel" → save → Playground → assert blocked
     └── test_failure_demo.py            # xfail(strict=True) — exercises the diagnostics pipeline on every CI run

ui/
 ├── flows.py                            # navigate_to_guardrails(), run_simulation()
 └── pages/
     ├── base_page.py                    # shared navigate_to() with @allure.step
     ├── automation_audit_page.py        # /config/guardrails — all 4 rule sections
     └── playground_page.py             # /tests/playground — email simulation

config.py                                # BASE_URL, TIMEOUTS, trace/video output dirs
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

## Auth

The app uses Google OAuth (Descope). Three strategies are applied in order of availability:

### 1. Saved session (default for local dev)

On first run, a browser window opens. Log in with Google. The session is saved automatically to `auth/auth.json` and reused on all subsequent runs.

```bash
pytest      # browser opens on first run, reuses session after
```

To force re-login: `rm auth/auth.json`

### 2. Token injection via env vars (recommended when session expires)

Descope stores the session in **localStorage**, not cookies. Extract the tokens from Chrome DevTools:

```
Chrome → Log in to https://guardio.app.getnotch.dev
DevTools (F12) → Application → Storage → Local Storage → https://guardio.app.getnotch.dev
Copy the values of "DS" and "DSR" keys
```

Then set the environment variables — `conftest.py` builds `auth/auth.json` automatically:

```bash
export NOTCH_DS_TOKEN=<DS value>
export NOTCH_DSR_TOKEN=<DSR value>
pytest
```

Or create `auth/auth.json` directly:

```bash
python -c "from tests.conftest import _create_auth_from_tokens; _create_auth_from_tokens('PASTE_DS_HERE', 'PASTE_DSR_HERE')"
```

Tokens expire after ~24h. Repeat to refresh.

### 3. Interactive fallback

If neither `auth/auth.json` nor env vars are available, the fixture opens a real browser window and waits up to 5 minutes for manual login. The session is saved to `auth/auth.json` and strategy 1 takes over on all subsequent runs.

---

### CI setup

CI uses strategy 2 (token injection) via a GitHub secret. Generate the secret from an existing local session:

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

![Allure failure report example](allure-failure-example.jpg)

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

Live report: **[avicherny.github.io/notch-qa-assignment](https://avicherny.github.io/notch-qa-assignment/)**

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

**`test_failure_demo.py`** — A deliberately wrong assertion decorated with `@pytest.mark.xfail(strict=True)`. The test expects to fail; when it does, pytest records it as `XFAIL` (exit code 0) and CI stays green. The value: the Allure diagnostics pipeline (screenshot → video → trace) runs on every CI push, so the failure artifacts are always visible in the report — no need to wait for a real product bug to verify they work.

**Cleanup registered before add** — In the test body, `cleanup_blocked_word(SECTION, BLOCKED_WORD)` is called before `add_entry`. This registers the teardown immediately — so even if the test fails during navigation, before the rule is ever added, the cleanup is already scheduled. Defensive by design; costs nothing on the happy path.
