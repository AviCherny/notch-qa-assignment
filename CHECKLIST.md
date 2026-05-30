# Test Engineering Process Notes

Documents the decisions made during implementation — what was validated, what was adjusted, and why.

---

## Infrastructure Setup

**Python + pytest over TypeScript/Playwright**
Switched stacks mid-way. The Python ecosystem (pytest fixtures, allure-pytest, sync Playwright API)
produces cleaner test isolation and more readable teardown logic than async TypeScript.
The fixture system handles cleanup more explicitly than `afterEach` hooks.

**`ui/` package structure**
Separated page objects (`ui/pages/`) from navigation flows (`ui/flows.py`).
Flows own the multi-step orchestration (`navigate → act → navigate`);
page objects own element interaction. This keeps both layers narrow and replaceable independently.

**`BasePage.navigate_to()` with `@allure.step`**
Every navigation appears as a named step in the Allure timeline.
This makes failure diagnosis readable without opening a Playwright trace.

---

## Auth Strategy (3 Tiers)

Ranked by friction, applied in order:

1. **Saved session** (`auth/auth.json`) — zero friction for repeated local runs; populated via env-var token injection
2. **Token injection via env vars** (`NOTCH_DS_TOKEN` / `NOTCH_DSR_TOKEN`) — CI-safe, no browser needed
3. **Interactive login** — fallback when no session exists; opens a headed Chrome, waits 5 min, session persists in `.browser-profile`

The `ensure_auth` session-scoped fixture gates every test run — auth happens once per suite,
not once per test.

**Windows-specific auth behavior**: Chrome (not Chromium) stores session cookies using Windows DPAPI
encryption in the user profile directory. Playwright's `storage_state()` cannot decrypt these — it
returns empty cookies even from an authenticated persistent context. The fix: when interactive login
is used, tests reuse the `.browser-profile` directory directly via `launch_persistent_context` instead
of loading a cookie file. When tokens are injected via env vars, tests use a regular context with
the exported `auth.json` (works in CI on Linux where DPAPI isn't a factor).

---

## Selector Strategy

All selectors anchor on visible text or ARIA roles — never on CSS class hashes.
Class hashes change on every frontend rebuild; text content changes only when copy changes intentionally.

Key finding during exploration:
- Section headings are plain `div`/`p` elements, not semantic `h1-h6` → `get_by_text()`, not `get_by_role("heading")`
- Input is a hidden `<textarea>` overlaying a placeholder div → `get_by_role("textbox")` works
- Chip text content includes the "×" close element → `exact=False` required in `get_by_text()`
- Automation Audit section is at the bottom of a long page → `scroll_into_view_if_needed()` required before interaction

---

## Test Isolation

The test adds a config rule, runs the Playground simulation, then removes the rule in teardown —
regardless of pass or fail. A `finally`-style `cleanup_blocked_word` fixture handles this.

**Why teardown matters here:**
The config is persistent and shared. Without cleanup, a failed run leaves "cancel" in the blocklist,
which contaminates future runs and changes the system state for any human using the dashboard.

---

## Failure Diagnostics

On failure, the framework automatically captures:
- **Screenshot** — attached to Allure report
- **Video recording** — attached to Allure report (discarded on pass to save CI storage)
- **Playwright trace** — saved to `traces/<test_name>.zip`, openable at trace.playwright.dev

Tracing and video run for every test but only persist on failure. This keeps CI storage clean
without sacrificing debuggability on the runs that matter.

---

## CI/CD

The GitHub Actions pipeline runs on every push to `main`:
`test → allure generate → GitHub Pages deploy`

Auth is injected via `AUTH_JSON_B64` secret (base64-encoded `auth.json`).
The workflow restores it before running tests, so no browser interaction is needed in CI.
