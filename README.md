# Notch — Automation Audit Test Suite

End-to-end test suite for the **Automation Audit** feature in Notch's configuration dashboard.

---

## What This Tests

The **Automation Audit** section on `/config/guardrails` defines deterministic rules that control whether the AI responds to a conversation or hands it off to a human. Four rule categories:

| Category | Checks | Triggers |
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
- Auth session saved in `auth/auth.json` (see below)

### Install

```bash
npm install
npx playwright install chromium
```

### Auth Setup

The app uses Google OAuth via Descope. Auth is handled by saving a session token to `auth/auth.json`.

**If `auth/auth.json` already exists** (e.g., it's checked in with valid tokens): run tests directly.

**If you need to re-authenticate:**
```bash
rm auth/auth.json
npx playwright test --headed
```
The browser will open to the login page. Sign in with Google. Once authenticated, the session is saved and tests run automatically.

### Run Tests

```bash
# Headed mode (required for initial auth; also useful for debugging)
npm run test:headed

# Standard run
npm test

# Debug mode (pauses at each step)
npm run test:debug
```

---

## Project Structure

```
/
├── tests/
│   └── e2e/
│       └── words-in-message.spec.ts   # Implemented test (config CRUD)
├── pages/
│   ├── AutomationAuditPage.ts         # Page Object for /config/guardrails
│   └── PlaygroundPage.ts              # Page Object for /tests/playground
├── auth/
│   ├── global-setup.ts                # Handles session auth before test run
│   └── auth.json                      # Saved session state (gitignored in prod)
├── scripts/                           # Exploration/dev utilities (not tests)
├── playwright.config.ts
└── tsconfig.json
```

---

## Test Design Notes

### Why Config-Layer Tests?

The Playground (`Tests → Playground`) shows a blank panel in the current environment — the email simulation form is not rendered. Full E2E tests (add keyword → send mock email → assert blocked/pass) are documented as spec-only comments in the test file, along with the exact code they would require.

Config-layer tests are still meaningful: the Automation Audit rules are deterministic. If a keyword is saved to the config, the AI pipeline **will** apply it — the config state IS the system state.

### Selector Philosophy

All selectors are anchored on visible text content, not on styled-component class hashes (like `sc-kWtpeL`). Class hashes change on every rebuild; text content is stable unless the product copy changes intentionally.

### Test Isolation

Each test adds a unique `autotest_<timestamp>` keyword. `afterEach` always removes it, even on failure. No test leaves state behind.
