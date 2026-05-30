# CLAUDE.md — Notch Test Suite Assignment

## What This Project Is

A QA assignment for Notch — an AI-powered customer support agent company.
The goal: design and partially implement an end-to-end test suite for the **Automation Audit** feature.

---

## Start Here

Read these files first, in this order:

1. [ASSIGNMENT.md](ASSIGNMENT.md) — the feature spec, scope, and exact requirements
2. [notch-company.md](notch-company.md) — company context and product domain
3. [qa-philosophy.md](qa-philosophy.md) — QA approach and testing philosophy

---

## Project Structure

```
/                                       # root
├── CLAUDE.md                           # this file
├── ASSIGNMENT.md                       # feature spec
├── DESIGN.md                           # design rationale for all key decisions
├── test-plan-automation-audit.docx     # Part 1: full test plan (50+ cases)
├── notch-company.md                    # company context
├── qa-philosophy.md                    # QA philosophy
├── config.py                           # BASE_URL, TIMEOUTS, output dirs
├── pytest.ini                          # markers, log config
├── tests/                              # pytest test files
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
├── auth/                               # session auth setup + saved session
└── .github/workflows/tests.yml         # CI: test → Allure report → GitHub Pages
```

---

## Key Constraints

- **Auth:** Google OAuth (Descope) — cannot be automated. Run in **headed mode**, let user log in manually, then tests proceed automatically.
- **Base URL:** `https://guardio.app.getnotch.dev`
- **Guardrails URL:** `/config/guardrails`
- **Playground URL:** `/tests/playground`
- **Scope:** Only the 4 Automation Audit sub-features (email patterns, subjects, words in message, words in reply)

---

## Feature Under Test

The **Automation Audit** section defines deterministic rules controlling whether the AI responds or hands off to a human.

- **Inbound rules** — trigger on: sender email, subject line, message body → result: conversation unassigned
- **Outbound rules** — trigger on: AI's draft reply → result: reply suppressed, handed to human

Verification is done via the **Playground**: send a mock email → system shows result as "Escalated" (blocked) or no escalation (AI responded).

---

## Standards for This Project

- Code must run — no skeleton, no stubs
- Page Object Model — no raw selectors in test files
- Config separated from test logic (base URL, credentials handling, timeouts)
- Structure should be presentable to a senior engineer — clean, intentional, no over-engineering
