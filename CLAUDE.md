# CLAUDE.md — Notch Test Suite Assignment

## What This Project Is

A QA home assignment for Notch — an AI-powered customer support agent company.
The goal: design and partially implement an end-to-end test suite for the **Automation Audit** feature.

This is an interview assignment. The bar is high. It will be presented in-person to a senior RnD lead (20 years experience, managed QA at Testim.io).

---

## Start Here

Read these files first, in this order:

1. [ASSIGNMENT.md](ASSIGNMENT.md) — the feature spec, scope, and exact requirements
2. [notch-company.md](notch-company.md) — company context, product domain, interviewer background
3. [qa-philosophy.md](qa-philosophy.md) — Avi's QA thinking and writing style (match this voice)

---

## Project Structure

```
/                          # root
├── CLAUDE.md              # this file
├── ASSIGNMENT.md          # feature spec
├── TEST-SUITE.md          # Part 1: full test plan (50+ cases)
├── notch-company.md       # company context
├── qa-philosophy.md       # QA style guide
├── tests/                 # Playwright test files
│   └── e2e/               # end-to-end flows
├── pages/                 # Page Object Model classes
├── auth/                  # session auth setup + saved session
└── playwright.config.ts   # config (headed mode, base URL, timeouts)
```

---

## Key Constraints

- **Auth:** Google OAuth — cannot be automated. Run in **headed mode**, let user log in manually, then tests proceed automatically.
- **Base URL:** `https://guardio.app.getnotch.dev/config/guardrails`
- **Playground URL:** `Tests → Playground` inside the dashboard
- **Scope:** Only the 4 Automation Audit sub-features (email patterns, subjects, words in message, words in reply)

---

## Feature Under Test

The **Automation Audit** section defines deterministic rules controlling whether the AI responds or hands off to a human.

- **Inbound rules** — trigger on: sender email, subject line, message body → result: conversation unassigned
- **Outbound rules** — trigger on: AI's draft reply → result: reply suppressed, handed to human

Verification is done via the **Playground**: send a mock email → system shows green (AI responds) or red (AI does not respond).

---

## What Exists

- `TEST-SUITE.md` — Part 1: full test plan covering all 4 sub-features (50+ cases)
- `tests/e2e/words-in-message.spec.ts` — Part 2: implemented Playwright tests (2 passing)
- `pages/AutomationAuditPage.ts` — Page Object for guardrails config section
- `pages/PlaygroundPage.ts` — Page Object for the Playground
- `auth/global-setup.ts` — session auth setup

---

## Standards for This Project

- Code must run — no skeleton, no stubs
- Page Object Model — no raw selectors in test files
- Config separated from test logic (base URL, credentials handling, timeouts)
- Headed mode for auth, automated after login
- Structure should be presentable to a senior engineer — clean, intentional, no over-engineering
