# Design Rationale

## Language and Framework

Python + Playwright + pytest.

Python because test code gets read by people who aren't QA engineers. Developers review tests too, and Python reads close enough to plain English that the intent is clear without knowing the framework. I've used TypeScript Playwright in the past — the async model is fine, but pytest's fixture system handles teardown logic more cleanly, which matters here because cleanup is load-bearing (more on that below).

Playwright over Selenium for one reason: auto-wait. With Selenium you end up writing explicit waits everywhere, and eventually someone replaces one with `time.sleep(2)`, and now the suite is flaky by default. Playwright waits for elements to be actionable before every interaction. That removes an entire class of failure at the framework level rather than requiring discipline per test.

Selenium is the right call when a company has an existing Grid or needs legacy browser coverage. For a new project with no prior investment, Playwright wins.

---

## Auth Strategy

Google OAuth (Descope) can't be automated — it's designed to resist it. Three strategies, applied in order of availability:

1. **Saved session** (`auth/auth.json`) — zero friction for local dev. Run once, save tokens, reuse forever.
2. **Token injection via env vars** (`NOTCH_DS_TOKEN` / `NOTCH_DSR_TOKEN`) — CI-safe. Extract cookies from DevTools after a manual login, inject at pipeline runtime. No browser interaction needed.
3. **Interactive fallback** — opens a real Chrome window, waits 5 minutes for manual login, saves the session. Runs once, then strategy 1 takes over.

The `ensure_auth` fixture is session-scoped — auth happens once per suite run, not once per test.

One non-obvious issue on Windows: persistent context cookies are encrypted in the Chrome profile and `storage_state()` returns them empty. The workaround is reading cookies directly from the live page context rather than from the saved state file.

---

## Selector Strategy

All selectors anchor on visible text or ARIA roles. Never on CSS class names.

Class names in modern frontend frameworks are generated hashes that change on every rebuild. A selector like `.sc-abc123` silently breaks whenever the frontend ships a change. Text content and ARIA roles change only when the product intentionally changes — which is the right time for a test to break.

Notch-specific findings from DOM exploration:

- Section headings are plain `div`/`p` elements — not semantic `h1-h6`. `get_by_role("heading")` finds nothing; `get_by_text()` works.
- The keyword input is a hidden `<textarea>` that overlays a placeholder div. `get_by_role("textbox")` locates it correctly.
- Chip text content includes the "×" close element as a child node, so `get_by_text(value, exact=True)` misses chips. `exact=False` is required.
- The Automation Audit section sits at the bottom of a long page. `scroll_into_view_if_needed()` is called before interacting with any section — without it, clicks land on the wrong element or miss entirely.

---

## Test Isolation

The test adds a config rule, runs the Playground, then removes the rule in teardown — whether the test passed or failed.

This matters more than it might seem. The Automation Audit config is persistent and shared. If a test fails mid-run and leaves "cancel" in the blocklist, every future run inherits that state, and anyone using the dashboard manually sees a rule they didn't add. The `cleanup_blocked_word` fixture handles teardown with a `yield` — equivalent to `finally` — so the cleanup runs regardless of test outcome.

Each test also gets a fresh browser context from the `page` fixture. No session state, cookies, or localStorage carry over between tests.

---

## Save Before Playground

The config UI operates in draft mode. Adding a keyword to a section updates the UI but does not push the rule to the AI pipeline until you explicitly save.

The test calls `save()` after adding the rule, before navigating to the Playground. Skipping this step produces a false negative: the Playground returns "allowed" not because the rule doesn't work, but because it was never persisted. This is the kind of silent failure that would waste debugging time.

---

## Reporting and Triage

A failing test is only useful if someone can understand what went wrong without reproducing it locally.

Every failed test automatically captures:
- **Screenshot** — browser state at the moment of failure, attached to the Allure report
- **Video** — full recording of the test session, attached to the Allure report
- **Playwright trace** — step-by-step recording with DOM snapshots, network requests, and console output, saved to `traces/<test_name>.zip` and openable at trace.playwright.dev
- **Console errors** — any JS errors from the browser session, attached to the Allure report

Tracing and video run for every test but are discarded on pass. Only failures produce a persistent artifact. This keeps CI storage clean without sacrificing debuggability on the runs that matter.

The triage flow: open the Allure report → find the failed test → open the trace → find the failed step → look at the DOM and network state at that point. In most cases that's enough to distinguish a product bug from an environment issue from a test bug.

---

## What I Would Do Next

**More sections covered.** The current implementation covers "Words in User Message." The same infrastructure handles all four sections — "Emails patterns to unassign," "Subjects," "Words in Assistant's Reply" — so adding tests is a matter of parameterization, not new plumbing.

**Negative path tests.** Right now the suite only covers the blocking case. The "allowed" case matters too: a rule should only trigger when the pattern actually matches, not on unrelated emails. Missing a false-positive test is how you end up with a rule that silently blocks things it shouldn't.

**Reply (outbound) tests.** "Words in Assistant's Reply" is the only outbound rule — it operates on the AI's draft, not the inbound email. The Playground should support simulating this, but it requires understanding how the reply field interacts with the config. Worth verifying manually before automating.

**Conflict detection.** What happens if the same keyword appears in both "Words in User Message" and "Words in Assistant's Reply"? Or if a sender email matches the pattern but the subject has a whitelist override? These edge cases are likely untested and are exactly where an AI agent will make a surprising decision.

**CI auth rotation.** The current CI strategy uses a base64-encoded session token as a GitHub secret. Session tokens expire. The right long-term solution is either a service account with a stable token or a programmatic auth flow that bypasses OAuth. Until that exists, someone needs to rotate the secret manually when tests start failing with 401s.

---

## AI Tools Used

I designed the structure first — page objects, fixture model, teardown strategy, selector approach. Once the skeleton was in place, Claude implemented inside it. The structure was the constraint. That's how I stayed in control of what came out.

The decisions that required real understanding of the problem were mine: session-scoped auth so the browser login happens once per suite run, not once per test; the `xfail(strict=True)` pattern so the diagnostics pipeline is exercised on every CI push; baseline capture in `get_result()` to handle pre-existing escalated conversations without false positives; `scroll_into_view_if_needed()` before every guardrails interaction because the section sits below the fold on a long page.

When I wasn't sure about a specific behavior (the Windows DPAPI cookie encryption issue, Playwright's storage state API), I cross-checked against documentation. Claude was fast; I was the constraint on what it was allowed to produce.

If something breaks, I open the trace, find the failed step, and I know what happened. I built it that way on purpose.
