# Notch — Automation Audit Test Suite

QA home assignment submission. Tests the **Automation Audit** feature on `/config/guardrails`.

---

## Deliverables

| Part | What | Where |
|---|---|---|
| Part 1 | Test suite design — all 4 sub-features, 50+ test cases | [TEST-SUITE.md](TEST-SUITE.md) |
| Part 2 | Playwright implementation — Words in User Message (config CRUD) | `tests/e2e/words-in-message.spec.ts` |

---

## What's Being Tested

The **Automation Audit** section defines deterministic rules that control whether the AI responds to a conversation or hands it off to a human.

| Category | Checks | Effect |
|---|---|---|
| Emails patterns to unassign | Sender email address | Unassign conversation |
| Subjects | Email subject line | Unassign conversation |
| Words in User Message | Customer message body | Unassign conversation |
| Words in Assistant's Reply | AI draft reply | Suppress reply, hand to human |

---

## Running the Tests

### Prerequisites

- Node.js 18+
- Google Chrome installed

### Install

```bash
npm install
npx playwright install chromium
```

### Auth

The app uses Google OAuth (Descope). Auth cannot be automated — the accepted approach is to log in once manually and save the session.

```bash
# First run — browser opens, log in with Google, session is saved automatically
npx playwright test --headed

# Subsequent runs reuse the saved session (auth/auth.json)
npm test
```

To force re-authentication, delete `auth/auth.json` and run again.

### Run Tests

```bash
npm test                 # standard run
npm run test:headed      # headed mode (useful for debugging)
npm run test:debug       # pauses at each step
```

---

## Project Structure

```
/
├── TEST-SUITE.md                          # Part 1 — full test plan (50+ cases)
├── tests/
│   └── e2e/
│       └── words-in-message.spec.ts       # Part 2 — implemented tests (2 passing)
├── pages/
│   ├── AutomationAuditPage.ts             # POM for /config/guardrails
│   └── PlaygroundPage.ts                  # POM for /tests/playground
├── auth/
│   └── global-setup.ts                    # Session auth handler
├── playwright.config.ts
└── package.json
```

---

## Implementation Notes

### Why config-layer tests?

The Playground (`Tests → Playground`) renders a blank panel in the current environment — the email simulation form is not available. Full E2E tests (add keyword → send mock email via Playground → assert green/red result) are documented as spec-only test cases in `TEST-SUITE.md` and as commented code stubs in the test file itself, showing exactly what they would look like if the Playground were functional.

Config-layer tests are meaningful on their own: the Automation Audit rules are deterministic. If a keyword is saved to the config, the AI pipeline **will** apply it — the config state is the system state.

### Selector philosophy

All selectors anchor on visible text content, not styled-component class hashes. Class hashes change on every rebuild; text content is stable unless the product copy changes intentionally.

### Test isolation

Each test adds a unique `autotest_<timestamp>` keyword. `afterEach` always removes it, even on failure — no test leaves state in the system.
