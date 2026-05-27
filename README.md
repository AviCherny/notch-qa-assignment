# Notch — Automation Audit Test Suite

E2E test suite for the **Automation Audit** feature on `/config/guardrails`.
QA home assignment submission.

---

## Deliverables

| Part | What | Where |
|------|------|-------|
| Part 1 | Test suite design — all 4 sub-features, 50+ test cases | `test-plan-automation-audit.docx` |
| Part 2 | Playwright implementation — config CRUD + full pipeline E2E | `tests/e2e/` |

---

## What's Being Tested

The **Automation Audit** section defines deterministic rules controlling whether the AI responds or hands off to a human.

| Category | Checks | Effect |
|----------|--------|--------|
| Emails patterns to unassign | Sender email address | Unassign conversation |
| Subjects | Email subject line | Unassign conversation |
| Words in User Message | Customer message body | Unassign conversation |
| Words in Assistant's Reply | AI draft reply | Suppress reply, hand to human |

---

## Stack

| Layer | Tool |
|-------|------|
| Language | TypeScript |
| Test runner | Playwright |
| Reporting | Allure |
| CI/CD | GitHub Actions → GitHub Pages |

---

## Architecture

```
Test
 └── Page Object (extends BasePage)
       └── BasePage — shared navigateTo(), waitForLoadState()
             └── Playwright page
```

```
tests/
 └── e2e/
     ├── words-in-message.spec.ts    # Config CRUD: add/delete keyword
     └── cancel-playground.spec.ts  # Full pipeline: add rule → Playground → assert red/green

pages/
 ├── BasePage.ts                     # Shared navigation helpers
 ├── AutomationAuditPage.ts          # /config/guardrails — all 4 rule sections
 └── PlaygroundPage.ts               # /tests/playground — email simulation

auth/
 └── global-setup.ts                 # Session auth (3 strategies — see Auth section)

config.ts                            # Base URL, timeouts — single source of truth
playwright.config.ts                 # Reporter, video/trace on failure, storageState
.github/workflows/playwright.yml     # CI: test → Allure report → GitHub Pages
```

---

## Setup

### Prerequisites

- Node.js 18+
- Google Chrome installed

### Install

```bash
npm install
npx playwright install chromium
```

---

## Auth

The app uses Google OAuth (Descope). Three strategies are supported — the first available one is used:

### 1. Saved session (default for local dev)

On first run, a browser window opens. Log in with Google. The session is saved automatically to `auth/auth.json` and reused on all subsequent runs.

```bash
npx playwright test    # opens browser on first run, reuses session after
```

To force re-login: `rm auth/auth.json`

### 2. Token injection via environment variables (for CI or shared setups)

Extract your session cookies from Chrome DevTools after logging in:

```
Chrome → DevTools → Application → Cookies → guardio.app.getnotch.dev
Copy the values of "DS" and "DSR"
```

Create a `.env` file (see `.env.example`):

```bash
NOTCH_DS_TOKEN=<your DS cookie value>
NOTCH_DSR_TOKEN=<your DSR cookie value>
```

`global-setup.ts` will create `auth/auth.json` automatically from these values — no interactive login needed.

### 3. CI via GitHub secret (`AUTH_JSON_B64`)

Generate the secret from an existing session:

```bash
base64 -w 0 auth/auth.json    # Linux/macOS
certutil -encode auth/auth.json auth_b64.txt  # Windows (then copy the middle lines)
```

Add the result as a GitHub secret named `AUTH_JSON_B64`. The CI workflow restores it automatically.

---

## Running Tests

```bash
npm test                  # standard run
npm run test:headed       # headed mode (useful for debugging)
npm run test:debug        # pauses at each Playwright step
```

---

## Allure Report

```bash
# Generate and open locally
npm run report
```

CI publishes the report to GitHub Pages after every push to `main`.

---

## CI/CD

Every push to `main` triggers: **test → Allure report → GitHub Pages deploy**.

Required GitHub secrets:

| Secret | Description |
|--------|-------------|
| `AUTH_JSON_B64` | Base64-encoded `auth/auth.json` (session tokens) |

Optional:

| Secret | Description |
|--------|-------------|
| `NOTCH_BASE_URL` | Override base URL (defaults to `https://guardio.app.getnotch.dev`) |

---

## Design Decisions

**Selector strategy** — All selectors anchor on visible text or ARIA roles, never on CSS class hashes. Hashes change on every rebuild; text content changes only when the product copy changes intentionally.

**Test isolation** — Config-CRUD tests add a unique timestamped keyword and remove it in `finally`, even on failure. No test leaves state in the system.

**Save before Playground** — The config UI operates in draft mode (changes are unsaved until "Save" is clicked). The cancel-playground test explicitly saves before running the simulation — this is the necessary step for the rule to reach the AI pipeline.

**Why `BasePage`** — Shared `navigateTo()` + `waitForLoadState('networkidle')` lives in one place. If the load pattern changes, one file changes, not every page.
