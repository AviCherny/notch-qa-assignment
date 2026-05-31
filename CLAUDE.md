# CLAUDE.md — Notch Test Suite Assignment

QA home assignment for Notch — design and partial implementation of an E2E test suite for the **Automation Audit** feature.

---

## Read First

Context documents, in order:

1. [ASSIGNMENT.md](ASSIGNMENT.md) — feature spec, scope, exact deliverables
2. [DESIGN.md](DESIGN.md) — every architectural decision and its rationale
3. [notch-company.md](notch-company.md) — company context and product domain
4. [qa-philosophy.md](qa-philosophy.md) — QA approach and testing philosophy
5. [test-plan-automation-audit.docx](test-plan-automation-audit.docx) — full test plan (50+ cases)

---

## Setup

```sh
pip install -r requirements.txt
playwright install chromium
```

---

## Auth

Google OAuth (Descope) cannot be automated. Three options, applied in priority order:

**Option A — Token injection (CI and first-time local):**
Set `NOTCH_DS_TOKEN` and `NOTCH_DSR_TOKEN` as env vars (extract from DevTools → Application → Local Storage after a manual login). The suite injects them automatically.

**Option B — Saved session (repeat local runs):**
On first run without env vars, a browser opens and waits for manual login. After login, the session is saved to `auth/auth.json` and reused automatically on every subsequent run — no action needed.

**Option C — Interactive fallback:**
If no tokens and no saved session, the suite opens a browser, waits up to 5 minutes for manual login, saves the session, and continues.

---

## Running Tests

```sh
# Run all tests (headed required for auth fallback)
pytest tests/ --headed

# With Allure report
pytest tests/ --headed --alluredir=allure-results
allure serve allure-results
```

---

## Project Structure

```
/
├── CLAUDE.md                           # this file — start here
├── ASSIGNMENT.md                       # feature spec
├── DESIGN.md                           # design rationale
├── test-plan-automation-audit.docx     # Part 1: full test plan (50+ cases)
├── notch-company.md                    # company context
├── qa-philosophy.md                    # QA philosophy
├── config.py                           # BASE_URL, TIMEOUTS, output dirs
├── pytest.ini                          # markers, log config
├── requirements.txt                    # pinned dependencies
├── tests/
│   ├── conftest.py                     # auth + browser/page fixtures + diagnostics
│   └── e2e/
│       ├── conftest.py                 # cleanup fixture factory
│       ├── test_words_in_message.py    # TC: add "cancel" → save → Playground → assert blocked
│       └── test_failure_demo.py        # xfail(strict=True) — exercises diagnostics pipeline
├── ui/
│   ├── flows.py                        # navigate_to_guardrails(), run_simulation()
│   └── pages/
│       ├── base_page.py                # shared navigate_to() with @allure.step
│       ├── automation_audit_page.py    # /config/guardrails — all 4 rule sections
│       └── playground_page.py         # /tests/playground — email simulation
├── auth/                               # saved session storage
└── .github/workflows/tests.yml         # CI: test → Allure report → GitHub Pages
```

---

## Key Constraints

| | |
|---|---|
| Base URL | `https://guardio.app.getnotch.dev` |
| Guardrails config | `/config/guardrails` |
| Playground | `/tests/playground` |
| Scope | 4 Automation Audit rules only (email patterns, subjects, words in message, words in reply) |

---

## Coding Standards

- [ ] Code must run — no skeletons, no stubs
- [ ] Page Object Model — no raw selectors in test files
- [ ] `config.py` owns all URLs and timeouts — nothing hardcoded in tests
- [ ] Every test cleans up after itself, pass or fail
- [ ] Clean and intentional — presentable to a senior engineer
